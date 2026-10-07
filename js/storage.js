// ▸ storage.js — Локальное хранилище: save/load, ключи кусков, мягкое удаление
// ── Ключ куска для отслеживания удалений внутри записи ──
function makePieceKey(recId, piece){ return `${recId}|${piece.mat}|${piece.w}|${piece.l}`; }
// Преобразует видимый индекс (pi в отфильтрованном списке) в реальный индекс в rec.pieces
function realPieceIdx(rec, visiblePi){
  const visible = rec.pieces.map((p,ri)=>({p,ri}))
    .filter(({p})=>!deletedPieces.has(makePieceKey(rec.id,p)));
  return visible[visiblePi]?.ri ?? -1;
}

// ── Мягкое удаление: запоминает id чтобы merge не вернул запись ──
function softDelete(arr, id){
  deletedIds.add(id);
  return arr.filter(r=>r.id!==id);
}

// ── Сохраняет объединённые данные локально ──
function saveLocal(){
  localStorage.setItem('lm7',        JSON.stringify(db));
  localStorage.setItem('lm7_fav',    JSON.stringify([...favorites]));
  localStorage.setItem('lm7_mats',   JSON.stringify(MATS));
  localStorage.setItem('lm7_sizes',  JSON.stringify(SIZES));
  localStorage.setItem('lm7_places', JSON.stringify(PLACES));
  localStorage.setItem('lm7_deleted',JSON.stringify([...deletedIds]));
  localStorage.setItem('lm7_deleted_pieces',JSON.stringify([...deletedPieces]));
}

// ══════════════════════════════════════ STORAGE
function save(){
  // 1. Сразу в localStorage (мгновенно)
  localStorage.setItem('lm7',JSON.stringify(db));
  localStorage.setItem('lm7_fav',JSON.stringify([...favorites]));
  localStorage.setItem('lm7_mats',JSON.stringify(MATS));
  localStorage.setItem('lm7_sizes',JSON.stringify(SIZES));
  localStorage.setItem('lm7_places',JSON.stringify(PLACES));
  localStorage.setItem('lm7_deleted',JSON.stringify([...deletedIds]));
  localStorage.setItem('lm7_deleted_pieces',JSON.stringify([...deletedPieces]));
  upStats();
  // 2. В Supabase — с задержкой 1.5с чтобы не спамить при быстрых изменениях
  setSyncStatus('sync');
  clearTimeout(syncTimer);
  syncTimer=setTimeout(()=>sbPush(), 1500);
}

function applyPayload(p){
  if(!p) return;
  if(p.db){
    db=p.db;
    if(!db.remainders) db.remainders=[];
  }
  if(p.MATS && p.MATS.length)   MATS=p.MATS;
  if(p.SIZES && p.SIZES.length)  SIZES=p.SIZES;
  if(p.PLACES && p.PLACES.length) PLACES=p.PLACES;
  if(p.fav) favorites=new Set(p.fav);
}

function load(){
  // Локальные данные — показываем сразу
  const r=localStorage.getItem('lm7'); if(r) db=JSON.parse(r);
  if(!db.remainders) db.remainders=[];
  const fav=localStorage.getItem('lm7_fav'); if(fav) favorites=new Set(JSON.parse(fav));
  const cm=localStorage.getItem('lm7_mats'); if(cm) MATS=JSON.parse(cm);
  const cs=localStorage.getItem('lm7_sizes'); if(cs) SIZES=JSON.parse(cs);
  const cp=localStorage.getItem('lm7_places'); if(cp) PLACES=JSON.parse(cp);
  // migrate old data
  if(!r){const old=localStorage.getItem('lm6')||localStorage.getItem('lm5'); if(old){db=JSON.parse(old);if(!db.remainders)db.remainders=[];}}
  upStats();
}

function upStats(){ document.getElementById('hdr-s').textContent=`${db.income.length+db.expense.length} записей`; }
