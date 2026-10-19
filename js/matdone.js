window.__B=window.__B||{};__B['matdone']='2026-10-13a';
// ▸ matdone.js — Галочки «вырезано» по материалам заказа (План → По заказам).
//   Нажали кружок у материала — он «готов» (зелёная галочка, строка бледнеет). Когда отмечены ВСЕ материалы заказа —
//   заказ закрывается сам (если снять галочку — автозакрытый заказ снова открывается).
//   Хранится по ключу «заказ||материал» со временем правки и синхронизируется между устройствами.
let matDone={};     // {"заказ||материал":[1|0, время]}
try{ matDone=JSON.parse(localStorage.getItem('lm7_matdone')||'{}')||{}; }catch(e){ matDone={}; }
function persistMatDone(){ try{ localStorage.setItem('lm7_matdone',JSON.stringify(matDone)); }catch(e){} }
const mdKey=(o,m)=>o+'||'+m;
function matDoneGet(o,m){ const s=matDone[mdKey(o,m)]; return !!(s&&s[0]===1); }
// состояние 2 — позиция удалена из заказа (скрыта, в итог заказа не входит)
function matDoneHidden(o,m){ const s=matDone[mdKey(o,m)]; return !!(s&&s[0]===2); }
// Готов ли материал: ручная отметка (или её снятие) главнее; иначе — само: вырезано не меньше, чем нужно (совпало или перерасход)
function matDoneEff(o,e){
  const s=matDone[mdKey(o,e.mat)];
  if(s&&(s[0]===1||s[0]===0)) return s[0]===1;
  return e.spent>0.0005&&e.spent>=e.need-0.005;
}
// у заказа уже ставили галочки (включён «ручной» режим закрытия)
function matDoneHasAny(o){ const p=o+'||'; return Object.keys(matDone).some(k=>k.startsWith(p)); }
function toggleMatDone(el){
  const o=el.dataset.o, m=el.dataset.m; if(o===undefined||m===undefined) return;
  const cur=el.classList.contains('on');                 // что показано сейчас (с учётом автоматической галочки)
  matDone[mdKey(o,m)]=[cur?0:1,Date.now()];
  persistMatDone();
  // пользователь сам управляет заказом галочками — автозакрытие снова разрешено
  (db.orders||[]).filter(r=>r.key===o).forEach(r=>{ r.autoOff=false; });
  save();                         // при сохранении сработает автозакрытие / повторное открытие
  if(typeof renderPlan==='function') renderPlan();
}
function mergeMatDone(p){
  const c=(p&&p.matDone)||{}; let ch=false;
  Object.keys(c).forEach(k=>{ if(!matDone[k]||(c[k][1]||0)>(matDone[k][1]||0)){ matDone[k]=c[k]; ch=true; } });
  if(ch) persistMatDone();
}

// Удалить позицию материала из заказа: убираем строки плана этого материала и скрываем позицию
function deleteOrderMat(el){
  const o=el.dataset.o, mat=el.dataset.m; if(o===undefined||mat===undefined) return;
  confirm2(`Удалить позицию «${mat}» из заказа ${splitOrder(o).no}? Строки плана по этому материалу будут удалены (записи расхода останутся в Учёте).`,()=>{
    (db.plan||[]).filter(l=>l.order===o&&l.mat===mat).forEach(l=>deletedIds.add(l.id));
    db.plan=(db.plan||[]).filter(l=>!(l.order===o&&l.mat===mat));
    matDone[mdKey(o,mat)]=[2,Date.now()]; persistMatDone();
    save(); if(typeof renderPlan==='function') renderPlan();
    toast('🗑 Позиция удалена из заказа','ok');
  });
}
