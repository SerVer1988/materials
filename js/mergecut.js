window.__B=window.__B||{};__B['mergecut']='2026-10-13a';
// ▸ mergecut.js — ОБЪЕДИНЁННЫЙ РЕЗ: детали нескольких заказов (или одного) режутся на общих листах, а на раскладке подписей нет.
//   1) В Плане → «По заказам» нажимаете значок 🔗 у материала — он краснеет (выбран). Можно выбрать тот же материал в других заказах.
//      Можно выбрать и один материал одного заказа.
//   2) В CorelDRAW выделяете объекты раскладки (подписи не нужны) и запускаете макрос «ОбъединенныйРез»: он отправляет размер рамки объектов.
//   3) Приложение делит эту площадь между выбранными заказами ПРОПОРЦИОНАЛЬНО «нужно» — так экономия распределяется поровну по доле заказа —
//      и после подтверждения записывает в Расход по записи на каждый заказ (тип «merge»: склад не меняется, считается только площадь).
//   Выбор хранится на этом устройстве (то, на котором принимается макрос).
const MERGE_KEY='lm7_merge_sel';
let mergeSel=[];       // [{o: ключ заказа, mat}]
try{ mergeSel=JSON.parse(localStorage.getItem(MERGE_KEY)||'[]')||[]; }catch(e){ mergeSel=[]; }
function persistMergeSel(){ try{ localStorage.setItem(MERGE_KEY,JSON.stringify(mergeSel)); }catch(e){} }
const mergeHas=(o,m)=>mergeSel.some(x=>x.o===o&&normName(x.mat)===normName(m));

// Убираем из выбора заказы и материалы, которых уже нет в Плане или заказ закрыт
function mergePrune(bal){
  const closed=new Set(ordersList().filter(o=>o.status==='closed').map(o=>o.key));
  const n=mergeSel.length;
  mergeSel=mergeSel.filter(x=>!closed.has(x.o)&&bal.has(x.o)&&bal.get(x.o).has(x.mat));
  if(mergeSel.length!==n) persistMergeSel();
}
function toggleMergeSel(el){
  const o=el.dataset.o, m=el.dataset.m; if(o===undefined||m===undefined) return;
  if(mergeHas(o,m)){ mergeSel=mergeSel.filter(x=>!(x.o===o&&normName(x.mat)===normName(m))); }
  else {
    if(ordersList().some(x=>x.key===o&&x.status==='closed')){ toast('Заказ закрыт','err'); return; }
    if(mergeSel.length&&normName(mergeSel[0].mat)!==normName(m)){ toast(`Объединять можно только один материал: сейчас выбран «${mergeSel[0].mat}»`,'err'); return; }
    mergeSel.push({o,mat:m});
  }
  persistMergeSel(); renderPlan();
}
function clearMergeSel(){ mergeSel=[]; persistMergeSel(); renderPlan(); }
function mergeBarHtml(){
  if(!mergeSel.length) return '';
  const names=mergeSel.map(x=>escHtml(splitOrder(x.o).no)).join(', ');
  return `<div class="pl-mergebar"><div><b>🔗 Объединённый рез:</b> ${escHtml(mergeSel[0].mat)} · ${mergeSel.length===1?'заказ':'заказы'} ${names}<div class="pl-mergehint">Выделите объекты в CorelDRAW и запустите макрос «ОбъединенныйРез»</div></div><button class="btn bghost bsm" onclick="clearMergeSel()">Сбросить</button></div>`;
}

// Размер рамки объектов из макроса: делим площадь между выбранными заказами пропорционально «нужно»
function mergeCutShares(m2,sel,bal){
  const need=sel.map(x=>{ const e=bal.get(x.o)&&bal.get(x.o).get(x.mat); return e?Math.max(0,e.need):0; });
  const sum=need.reduce((a,b)=>a+b,0);
  const wt=need.map(v=>sum>0?v/sum:1/sel.length);
  const r4=v=>Math.round(v*1e4)/1e4;
  const shares=wt.map(w=>r4(m2*w));
  shares[shares.length-1]=r4(m2-shares.slice(0,-1).reduce((a,b)=>a+b,0));     // остаток — последнему, чтобы сумма совпала
  return sel.map((x,i)=>({o:x.o,mat:x.mat,need:need[i],pct:wt[i]*100,m2:shares[i]}));
}
function handleMergeCut(p){
  const w=+p.w, h=+p.h, n=parseInt(p.n,10)||0;
  if(!(w>0&&h>0)){ toast('⚠️ Из CorelDRAW пришёл пустой размер объектов','err'); return; }
  const bal=calcOrderBalance(); mergePrune(bal);
  if(!mergeSel.length){ toast('⚠️ Объединённый рез: отметьте материал значком 🔗 в «План → По заказам» и запустите макрос ещё раз','err'); return; }
  const sel=mergeSel.slice(), m2=w*h/1e6, parts=mergeCutShares(m2,sel,bal), mat=sel[0].mat;
  const rnd=v=>Math.round(v);
  const txt=`Объединённый рез · ${mat}\nОбъектов: ${n||'—'} · рамка ${rnd(w)}×${rnd(h)} мм = ${f2(m2)} м²\n\n`+
    parts.map(s=>`${splitOrder(s.o).no} ${splitOrder(s.o).customer} — ${Math.round(s.pct)}% — ${f2(s.m2)} м²`).join('\n')+
    (parts.length>1?'\n\nПлощадь делится пропорционально «нужно».':'')+'\n\nЗаписать в расход?';
  go('plan',document.getElementById('nbtn-plan')); planTabs('orders');
  askDialog(txt,'Записать','Отмена','bprim',()=>commitMergeCut(parts,mat,w,h,n),null);
}
function commitMergeCut(parts,mat,w,h,n){
  const mid='mc'+Date.now(), t=Date.now();
  parts.forEach((s,i)=>db.expense.push({id:t+i,dt:now(),mat,size:'—',w:0,l:0,qty:1,etype:'merge',order:s.o,det:'',m2:s.m2,
    mergeId:mid,mergeN:n,mergeBox:`${Math.round(w)}×${Math.round(h)}`,note:`Объединённый рез${parts.length>1?` (${parts.length} зак.)`:''}`}));
  save(); renderAll(); renderPlan();
  toast(`✅ Объединённый рез записан: ${f2(parts.reduce((a,s)=>a+s.m2,0))} м² на ${parts.length} зак.`,'ok');
}
