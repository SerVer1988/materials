window.__B=window.__B||{};__B['matsizes']='2026-10-13a';
// ▸ matsizes.js — Размеры листов, закреплённые за материалом. Ввели материал в Приходе или Расходе — в списке размеров
// только его размеры. По умолчанию размеры берутся по семейству (акрил, ПВХ, АКП, фанера, ПЭТ…); в «Настройках» можно задать свои.
// Нет ограничения (материал неизвестен, семейства нет) — показываются все размеры.
let matSizes={};      // {"АКП 3 мм":{s:["1220х2440",...],ts:123}}  s=null — вернуть «по умолчанию», s=[] — «любые»
try{ matSizes=JSON.parse(localStorage.getItem('lm7_matsizes')||'{}')||{}; }catch(e){ matSizes={}; }
function persistMatSizes(){ try{ localStorage.setItem('lm7_matsizes',JSON.stringify(matSizes)); }catch(e){} }

// Размеры по умолчанию: по первому слову названия (таблица листов из plan.js), в написании из справочника SIZES
function msDefaultSizes(mat){
  if(typeof SHEETS_BY_FAMILY==='undefined') return null;
  const fam=SHEETS_BY_FAMILY[familyOf(mat)]; if(!fam) return null;
  const out=[];
  fam.forEach(([w,l])=>{ const hit=SIZES.find(s=>{ const p=parseSizeStr(s); return p&&sameDims(p,{w,l}); }); if(hit&&!out.includes(hit)) out.push(hit); });
  return out.length?out:null;
}
// Список размеров материала или null (= без ограничения)
function matSizeList(mat){
  if(!mat) return null;
  const o=matSizes[mat];
  if(o&&o.s!==undefined&&o.s!==null) return o.s.length?o.s.filter(s=>SIZES.includes(s)):null;
  return msDefaultSizes(mat);
}

// Перестроить выпадающий список размеров под материал. keep=true — не терять уже выбранный размер (программная подстановка)
function msFillSelect(sel,mat,keep){
  if(!sel) return;
  const list=matSizeList(mat), cur=sel.value;
  const hasNo=[...sel.options].some(o=>o.value===''), hasCustom=[...sel.options].some(o=>o.value===CUSTOM_VAL);
  const sizes=list?list.slice():SIZES.slice();
  if(keep&&cur&&cur!==CUSTOM_VAL&&!sizes.includes(cur)&&SIZES.includes(cur)) sizes.push(cur);
  const before=[...sel.options].map(o=>o.value).join('|');
  const after=[...(hasNo?['']:[]),...sizes,...(hasCustom?[CUSTOM_VAL]:[])].join('|');
  if(before!==after){
    sel.innerHTML='';
    if(hasNo) sel.appendChild(new Option('— без листа —',''));
    sizes.forEach(v=>sel.appendChild(new Option(v,v)));
    if(hasCustom) sel.appendChild(new Option('✏️ Свой вариант...',CUSTOM_VAL));
    if(cur===CUSTOM_VAL&&hasCustom) sel.value=CUSTOM_VAL;
    else if(cur===''&&hasNo) sel.value='';
    else if(sizes.includes(cur)) sel.value=cur;
    else sel.value=sizes[0]||'';
    if(typeof onSelectChange==='function'&&sel.id) { try{ onSelectChange(sel.id,sel.id+'-custom'); }catch(e){} }
  }
}
const msCanon=v=>{ const t=String(v||'').trim(); if(!t) return ''; return (typeof normMaterial==='function')?normMaterial(t):t; };
const msLast={in:null,out:null};
function msApply(kind,keep){
  const m=document.getElementById(kind+'-mat'), s=document.getElementById(kind+'-pre'); if(!m||!s) return;
  const mat=msCanon(m.value);
  msFillSelect(s,mat,keep);
  msLast[kind]=m.value;
  if(kind==='out'&&typeof parseDetSize==='function'){ try{ parseDetSize(); }catch(e){} }
}
function msSyncAll(){ ['in','out'].forEach(k=>{ const m=document.getElementById(k+'-mat'); if(m&&m.value!==msLast[k]) msApply(k,false); }); }

['input','change','focusout'].forEach(ev=>document.addEventListener(ev,e=>{
  const id=e.target&&e.target.id; if(id==='in-mat') msApply('in',false); else if(id==='out-mat') msApply('out',false);
}));
// выбор из выпадающего списка автодополнения ставит значение без событий — проверяем после клика
document.addEventListener('click',()=>setTimeout(msSyncAll,60));

// Программные подстановки (правка записи, данные из CorelDRAW, пересборка списков) — размер не теряем
window.addEventListener('load',()=>{
  ['editIncome','editExpense','fillExpenseForm','fillAllSelects'].forEach(name=>{
    const orig=window[name]; if(typeof orig!=='function') return;
    window[name]=function(){
      if(name!=='fillAllSelects'&&typeof window.fillAllSelects==='function'){ try{ window.fillAllSelects(); }catch(e){} }   // сначала все размеры, чтобы нужный выбрался
      const r=orig.apply(this,arguments);
      msApply('in',true); msApply('out',true);
      return r;
    };
  });
  msApply('in',true); msApply('out',true);
  renderMatSizesCard();
});

// ── Настройки: «Размеры листов по материалам» ──
function renderMatSizesCard(){
  const sel=document.getElementById('ms-mat'); if(!sel) return;
  if(!sel.options.length) MATS.forEach(m=>sel.appendChild(new Option(m,m)));
  renderMatSizes();
}
function renderMatSizes(){
  const sel=document.getElementById('ms-mat'), box=document.getElementById('ms-sizes'); if(!sel||!box||!sel.value) return;
  const mat=sel.value, cur=new Set(matSizeList(mat)||[]);
  const o=matSizes[mat], custom=!!(o&&o.s!==undefined&&o.s!==null);
  box.innerHTML=SIZES.map(s=>`<label class="ms-opt"><input type="checkbox" data-s="${escHtml(s)}"${cur.has(s)?' checked':''} onchange="msToggle()"> ${escHtml(s)}</label>`).join('')+
    `<div class="ms-note">${custom?'Свои размеры для этого материала.':(cur.size?'Размеры по умолчанию (по семейству материала).':'Ограничения нет — показываются все размеры.')}</div>`;
}
function msToggle(){
  const mat=document.getElementById('ms-mat').value; if(!mat) return;
  const arr=[...document.querySelectorAll('#ms-sizes input[type=checkbox]:checked')].map(i=>i.dataset.s);
  matSizes[mat]={s:arr,ts:Date.now()};              // пусто = любые размеры
  persistMatSizes(); save(); renderMatSizes(); msApply('in',true); msApply('out',true);
}
function msReset(){
  const mat=document.getElementById('ms-mat').value; if(!mat) return;
  matSizes[mat]={s:null,ts:Date.now()};              // вернуть «по умолчанию»
  persistMatSizes(); save(); renderMatSizes(); msApply('in',true); msApply('out',true);
  toast('Размеры материала — по умолчанию','ok');
}
function mergeMatSizes(p){
  const c=(p&&p.matSizes)||{}; let ch=false;
  Object.keys(c).forEach(k=>{ if(!matSizes[k]||(c[k].ts||0)>(matSizes[k].ts||0)){ matSizes[k]=c[k]; ch=true; } });
  if(ch){ persistMatSizes(); renderMatSizesCard(); }
}
