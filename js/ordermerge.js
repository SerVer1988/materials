window.__B=window.__B||{};__B['ordermerge']='2026-10-13a';
// ▸ ordermerge.js — Объединение заказов. Если один и тот же заказ попал в приложение под разными названиями
//   (например, раньше ключ включал категорию: 8-09-34_Талан_Вывеска и 8-09-34_Талан_Задник), один заказ «вливается» в другой:
//   его строки плана, приходы и расходы переходят в выбранный заказ. Запоминается и синхронизируется как «псевдоним»:
//   на других устройствах и в записях, пришедших позже со старым названием, заказ тоже заменится.
let orderAlias={};      // {"старый ключ":{to:"новый ключ",ts:123}}
try{ orderAlias=JSON.parse(localStorage.getItem('lm7_order_alias')||'{}')||{}; }catch(e){ orderAlias={}; }
function persistOrderAlias(){ try{ localStorage.setItem('lm7_order_alias',JSON.stringify(orderAlias)); }catch(e){} }
function resolveOrderAlias(key){ let k=key, n=0; while(orderAlias[k]&&n++<10) k=orderAlias[k].to; return k; }
function applyOrderAliases(d){
  if(!d) return;
  ['income','expense','plan'].forEach(n=>(d[n]||[]).forEach(r=>{ if(r.order&&orderAlias[r.order]) r.order=resolveOrderAlias(r.order); }));
  if(d.orders) d.orders=d.orders.filter(o=>!orderAlias[o.key]);
}
function mergeOrderAliases(p){
  const c=(p&&p.orderAlias)||{}; let ch=false;
  Object.keys(c).forEach(k=>{ if(!orderAlias[k]||(c[k].ts||0)>(orderAlias[k].ts||0)){ orderAlias[k]=c[k]; ch=true; } });
  if(ch) persistOrderAlias();
}
function mergeOrders(from,to){
  if(!from||!to||from===to) return;
  if(resolveOrderAlias(to)===from){ toast('Нельзя: получится цикл','err'); return; }
  orderAlias[from]={to,ts:Date.now()}; persistOrderAlias();
  applyOrderAliases(db);
  ensureOrder(to);
  save(); renderAll(); if(typeof renderPlan==='function') renderPlan();
  toast(`🔗 Заказы объединены: ${to}`,'ok');
}
function closeMergeDialog(){ document.getElementById('merge-pop')?.remove(); }
function openMergeOrder(i){
  const from=(window.__planKeys||[])[i]; if(from===undefined) return;
  closeMergeDialog();
  const keys=new Set(); (db.plan||[]).forEach(l=>keys.add(l.order)); ordersList().forEach(o=>keys.add(o.key));
  const no=splitOrder(from).no.toLowerCase();
  const list=[...keys].filter(k=>k&&k!==from&&!orderAlias[k])
    .sort((a,b)=>((splitOrder(b).no.toLowerCase()===no)-(splitOrder(a).no.toLowerCase()===no))||b.localeCompare(a,'ru',{numeric:true}));
  const d=document.createElement('div'); d.id='merge-pop'; d.className='cols-pop'; d.onclick=closeMergeDialog;
  d.innerHTML=`<div class="cols-card" onclick="event.stopPropagation()"><div class="ctitle">Влить заказ в…</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">«${escHtml(from)}» → выберите заказ, который останется. Его строки плана и расход перейдут в него.</div>`+
    (list.length?list.map(k=>`<div class="merge-opt${splitOrder(k).no.toLowerCase()===no?' same':''}" data-k="${escHtml(k)}">${escHtml(k)}</div>`).join(''):'<div class="st-empty">Других заказов нет.</div>')+
    `<div class="brow" style="margin-top:10px"><button class="btn bghost bsm" onclick="closeMergeDialog()">Отмена</button></div></div>`;
  document.body.appendChild(d);
  d.querySelectorAll('.merge-opt').forEach(el=>el.addEventListener('click',()=>{
    const to=el.dataset.k; closeMergeDialog();
    askDialog(`Влить заказ\n«${from}»\nв заказ\n«${to}»?\n\nВсе строки плана и расходы этого заказа перейдут в «${to}».`,'Объединить','Отмена','bprim',()=>mergeOrders(from,to),null);
  }));
}
