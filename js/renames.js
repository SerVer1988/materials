// ▸ renames.js — переименование материала / размера / места хранения во ВСЕХ данных приложения
// Замена запоминается ({from,to}) и применяется при каждой синхронизации — так старое имя не «воскресает» из облака
// или с другого устройства, где ещё не обновились данные.
const RENAME_KINDS=['mats','sizes','places'];

// Применяет одну замену к набору данных d = {mats,sizes,places,income,expense,remainders,fav}
function renameInData(kind,from,to,d){
  const list=d[kind];
  if(Array.isArray(list)){
    const i=list.indexOf(from);
    if(i>=0){ if(list.includes(to)) list.splice(i,1); else list[i]=to; }
  }
  const fix=(o,f)=>{ if(o && o[f]===from) o[f]=to; };
  if(kind==='mats'){
    (d.income||[]).forEach(r=>fix(r,'mat')); (d.expense||[]).forEach(r=>fix(r,'mat'));
    (d.remainders||[]).forEach(rec=>{ fix(rec,'mat'); (rec.pieces||[]).forEach(p=>fix(p,'mat')); });
  }
  if(kind==='sizes'){
    [...(d.income||[]),...(d.expense||[])].forEach(r=>{
      if(r.size===from){ r.size=to; const sz=parseSizeStr(to); if(sz){ r.w=sz.w; r.l=sz.l; } }
    });
  }
  if(kind==='places'){
    (d.income||[]).forEach(r=>fix(r,'place'));
    (d.remainders||[]).forEach(rec=>{ fix(rec,'place'); (rec.pieces||[]).forEach(p=>fix(p,'place')); });
  }
  if(Array.isArray(d.fav)){
    d.fav=[...new Set(d.fav.map(f=>{
      const k=f.indexOf('||'), m=f.slice(0,k), s=f.slice(k+2);
      if(kind==='mats'&&m===from) return `${to}||${s}`;
      if(kind==='sizes'&&s===from) return `${m}||${to}`;
      return f;
    }))];
  }
}
function localDataForRename(){
  return {mats:MATS,sizes:SIZES,places:PLACES,income:db.income,expense:db.expense,remainders:db.remainders,fav:[...favorites]};
}
function applyRenamesLocal(){
  const d=localDataForRename();
  RENAME_KINDS.forEach(k=>(renames[k]||[]).forEach(r=>renameInData(k,r.from,r.to,d)));
  favorites=new Set(d.fav);
}
function applyRenamesToPayload(p){
  const d={mats:p.MATS,sizes:p.SIZES,places:p.PLACES,income:p.db&&p.db.income,expense:p.db&&p.db.expense,remainders:p.db&&p.db.remainders,fav:p.fav};
  RENAME_KINDS.forEach(k=>(renames[k]||[]).forEach(r=>renameInData(k,r.from,r.to,d)));
  if(d.fav) p.fav=d.fav;
}
function mergeRenames(inc){
  RENAME_KINDS.forEach(k=>(inc[k]||[]).forEach(r=>{
    if(!renames[k].some(x=>x.from===r.from&&x.to===r.to)) renames[k].push(r);
  }));
}
// Новая замена: запоминаем и сразу применяем ко всем локальным данным
function addRename(kind,from,to){
  if(!from||!to||from===to) return;
  const arr=renames[kind]||(renames[kind]=[]);
  arr.forEach(r=>{ if(r.to===from) r.to=to; });                           // цепочка A→B, B→C  =>  A→C
  renames[kind]=arr.filter(r=>r.from!==to && r.from!==r.to);               // вернули старое имя — прежняя замена не нужна
  renames[kind].push({from,to,ts:Date.now()});
  applyRenamesLocal();
}
// Старое имя снова добавлено как новое значение — замена на него больше не должна действовать
function releaseRename(kind,name){
  if(!renames[kind]) return;
  renames[kind]=renames[kind].filter(r=>r.from!==name);
}
