// ▸ plan.js — ПЛАН: потребность по заказам (из макроса CorelDRAW или вставкой текста), проверка наличия на складе,
// бронь из наличия, подбор обрезка под полосу, статусы закупки: закупить → заказано → получено
// Строка плана: {id, order, mat, size, w, l, qty (целых листов), stripW, stripL (полоса «дорезать», 0 = нет),
//                status:'buy'|'ordered'|'received', booked (листов, забронировано из наличия), created}
let planFilter='open';                         // open | all
const PLAN_SEEN_KEY='lm7_plan_seen';
const PLAN_MAX_AGE=3*24*60*60*1000;            // сообщение из макроса ждёт до 3 суток, если приложение было закрыто
const SZ_RE='(\\d{2,5})\\s*[хxХX×*]\\s*(\\d{2,5})';

// ── Разбор текста заявки ──
// «На Заказ №105 требуется:
//  * ПВХ 3 мм - 1220х2440мм - 1шт + 1220х456 мм,
//  * Акрил 3 мм (мол.) - 1220х2440 мм - 2шт. + 1220х355 мм»
function parsePlanText(text){
  const out=[];
  String(text||'').split(/\r\n|\n|\r|\u2028/).forEach(raw=>{
    let s=raw.replace(/^[\s*•·\-–—]+/,'').replace(/^\d+[.)]\s+/,'').trim();
    if(!s) return;
    const all=[...s.matchAll(new RegExp(SZ_RE,'g'))];
    if(!all.length) return;                                    // заголовок и прочий текст пропускаем
    let mat=s.split(/\s[-–—]\s/)[0];
    if(mat===s || new RegExp(SZ_RE).test(mat)) mat=s.slice(0,all[0].index);
    mat=mat.replace(/[-–—:,\s]+$/,'').trim();
    const rest=s.slice(mat.length);
    const sizes=[...rest.matchAll(new RegExp(SZ_RE,'g'))];
    if(!mat||!sizes.length) return;
    const sheet=sizes[0];
    let strip=null;
    if(sizes[1] && /\+/.test(rest.slice(sheet.index+sheet[0].length,sizes[1].index))) strip=sizes[1];
    const q=rest.match(/(\d+)\s*шт/i);
    out.push({mat,w:+sheet[1],l:+sheet[2],qty:q?+q[1]:(strip?0:1),sw:strip?+strip[1]:0,sl:strip?+strip[2]:0});
  });
  return out;
}
const normName=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
function canonMat(name){ const n=normName(name); return MATS.find(m=>normName(m)===n)||String(name).replace(/\s+/g,' ').trim(); }
function fmtSheet(w,l){
  const hit=SIZES.find(s=>{ const p=parseSizeStr(s); return p&&p.w===w&&p.l===l; });
  return hit||`${w}х${l}`;
}
const sameDims=(a,b)=>a&&b&&((a.w===b.w&&a.l===b.l)||(a.w===b.l&&a.l===b.w));

// ── Добавление строк (с проверкой повторов) ──
function addPlanFromText(order,text,baseId){
  order=String(order||'').trim().replace(/\s+/g,' ');
  if(!order){ const m=String(text).match(/Заказ\s*№?\s*([^\s:,]+)/i); order=m?m[1]:''; }
  if(!order){ toast('Укажите заказ','err'); return false; }
  const parsed=parsePlanText(text);
  if(!parsed.length){ toast('Не удалось разобрать заявку: нужны строки вида «Материал - 1220х2440 - 1шт + 1220х456»','err'); return false; }
  if(!db.plan) db.plan=[];
  const base=baseId||Date.now()*100;
  let lines=parsed.map((p,i)=>({id:base+i,order,mat:canonMat(p.mat),size:fmtSheet(p.w,p.l),w:p.w,l:p.l,qty:p.qty,stripW:p.sw,stripL:p.sl,status:'buy',booked:0,created:now()}));
  lines=lines.filter(l=>!db.plan.some(x=>x.id===l.id));          // уже добавлено (с другого устройства)
  if(!lines.length) return false;
  const repeats=lines.filter(l=>db.plan.some(x=>x.order===order&&x.mat===l.mat));
  const commit=list=>{
    if(!list.length){ toast('Повторы пропущены, новых строк нет','info'); return; }
    list.forEach(l=>db.plan.push(l)); ensureOrder(order);
    save(); renderAll();
    toast(`📋 В план добавлено строк: ${list.length} (заказ ${order})`,'ok');
  };
  if(repeats.length){
    const desc=repeats.map(l=>`• ${l.mat} — ${l.size} — ${l.qty} шт`+(l.stripW?` + ${l.stripW}×${l.stripL}`:'')).join('\n');
    askDialog(`По заказу ${order} эти материалы уже есть в плане:\n${desc}\n\nВсё равно добавить?`,'Всё равно добавить','Пропустить повторы','bprim',
      ()=>commit(lines),()=>commit(lines.filter(l=>!repeats.includes(l))));
    return true;
  }
  commit(lines); return true;
}
function addPlanManual(){
  const order=document.getElementById('plan-order-inp').value;
  const text=document.getElementById('plan-text').value;
  if(addPlanFromText(order,text)){
    document.getElementById('plan-text').value='';
    togglePlanAdd(false);
  }
}
function togglePlanAdd(force){
  const p=document.getElementById('plan-add-panel');
  const show=force===undefined?p.style.display==='none':force;
  p.style.display=show?'block':'none';
}

// Сообщение из макроса (строка «<код>::plan»)
function handleInboxPlan(p){
  if(!p||!p.id||localStorage.getItem(PLAN_SEEN_KEY)===p.id) return;
  localStorage.setItem(PLAN_SEEN_KEY,p.id);
  const age=Date.now()-new Date(p.t).getTime();
  if(isNaN(age)||age>PLAN_MAX_AGE) return;
  const baseId=(parseInt(String(p.id).replace(/\D/g,'').slice(-12),10)||0)*100;  // одинаковые id на всех устройствах → нет дублей
  go('plan',document.getElementById('nbtn-plan'));
  addPlanFromText(p.order||'',p.text||'',baseId||undefined);
}

// ── Расчёт по строке ──
function planContext(){
  const by=calcStockDetailed(), stockQ={};
  Object.keys(by).forEach(m=>by[m].forEach(s=>{ stockQ[`${m}||${s.size}`]=s.qty; }));
  const res=calcReserves(), recv={};
  db.income.forEach(r=>{ if(r.order){ const k=`${r.order}||${r.mat}||${r.size}`; recv[k]=(recv[k]||0)+r.qty; } });
  return {stockQ,res,recv};
}
// Подходящие обрезки под полосу (самый подходящий — первым)
function findStripScraps(mat,w,l){
  const out=[];
  db.remainders.forEach(rec=>(rec.pieces||[]).forEach(p=>{
    if(p.mat!==mat||p.type==='scrap_sub'||!(p.qty>0)) return;
    if((p.w>=w&&p.l>=l)||(p.w>=l&&p.l>=w)) out.push({w:p.w,l:p.l,qty:p.qty,place:p.place||rec.place||''});
  }));
  return out.sort((a,b)=>a.w*a.l-b.w*b.l);
}
function planLineInfo(line,ctx){
  const k=`${line.mat}||${line.size}`, rk=`${line.order}||${k}`;
  const booked=line.booked||0;
  const take=Math.min(Math.max(0,line.qty-booked),ctx.recv[rk]||0);
  ctx.recv[rk]=(ctx.recv[rk]||0)-take;
  const received=take, toBuy=Math.max(0,line.qty-booked-received);
  const stock=ctx.stockQ[k]||0, reserved=(ctx.res[k]||[]).reduce((s,x)=>s+x.left,0);
  const free=Math.max(0,stock-reserved);
  const hasStrip=line.stripW>0&&line.stripL>0;
  const stripDim={w:line.stripW,l:line.stripL};
  const stripDone=hasStrip&&db.expense.some(e=>e.order===line.order&&e.mat===line.mat&&e.det&&sameDims(parseSizeStr(e.det),stripDim));
  const scraps=hasStrip&&!stripDone?findStripScraps(line.mat,line.stripW,line.stripL):[];
  const covered=line.qty>0&&toBuy===0;
  const status=covered||line.status==='received'?'received':(line.status==='ordered'?'ordered':'buy');
  return {booked,received,toBuy,free,canBook:Math.min(free,toBuy),hasStrip,stripDone,scraps,covered,status};
}

// ── Действия ──
const planLine=id=>db.plan.find(x=>x.id===id);
function bookPlan(id){
  const l=planLine(id); if(!l) return;
  const info=planLineInfo(l,planContext());
  if(info.canBook<=0){ toast('Свободных листов этого материала и размера нет','err'); return; }
  l.booked=(l.booked||0)+info.canBook;
  save(); renderAll(); toast(`🔒 Забронировано из наличия: ${info.canBook} шт`,'ok');
}
function unbookPlan(id){ const l=planLine(id); if(!l) return; l.booked=0; save(); renderAll(); toast('Бронь снята','ok'); }
function setPlanStatus(id,st){ const l=planLine(id); if(!l) return; l.status=st; save(); renderAll(); }
function cutStrip(id){
  const l=planLine(id); if(!l||!l.stripW) return;
  fillExpenseForm({mat:l.mat,det:`${l.stripW}х${l.stripL}`,sheet:'',qty:1,note:'',order:l.order});   // дальше — обычный «Выбрать обрезок»
}
function deletePlanLine(id){
  const l=planLine(id); if(!l) return;
  confirm2(`Удалить строку плана: ${l.mat} — ${l.size}?`,()=>{ db.plan=softDelete(db.plan,id); save(); renderAll(); toast('Строка удалена'); });
}
function deletePlanOrder(i){
  const key=window.__planKeys[i];
  confirm2(`Удалить весь план по заказу ${key}?`,()=>{
    db.plan.filter(x=>x.order===key).forEach(x=>deletedIds.add(x.id));
    db.plan=db.plan.filter(x=>x.order!==key); save(); renderAll(); toast('План заказа удалён');
  });
}
function setPlanFilter(f){
  planFilter=f;
  ['open','all'].forEach(k=>document.getElementById('pfl-'+k)?.classList.toggle('on',k===f));
  renderPlan();
}

// ── Отрисовка ──
const STATUS_TXT={buy:'Закупить',ordered:'Заказано',received:'Получено'};
function renderPlan(){
  const box=document.getElementById('plan-list'); if(!box) return;
  const closed=new Set(ordersList().filter(o=>o.status==='closed').map(o=>o.key));
  const q=(document.getElementById('plan-s')?.value||'').trim().toLowerCase();
  const ctx=planContext();
  const lines=[...(db.plan||[])].sort((a,b)=>a.id-b.id);
  const infos=new Map(); lines.forEach(l=>infos.set(l.id,planLineInfo(l,ctx)));   // порядок важен: распределение полученных листов
  const orders=[...new Set(lines.map(l=>l.order))]
    .filter(o=>planFilter==='all'||!closed.has(o)).filter(o=>!q||o.toLowerCase().includes(q))
    .sort((a,b)=>b.localeCompare(a,'ru',{numeric:true}));
  window.__planKeys=orders;
  if(!orders.length){ box.innerHTML='<div class="empty"><div class="ei">📋</div>Плана пока нет.<br>Отправьте заявку из CorelDRAW или нажмите «➕ Вставить заявку»</div>'; return; }
  box.innerHTML=orders.map((o,oi)=>{
    const ls=lines.filter(l=>l.order===o);
    const buyTotal=ls.reduce((s,l)=>s+infos.get(l.id).toBuy,0);
    const sp=splitOrder(o);
    const rows=ls.map(l=>{
      const f=infos.get(l.id);
      const stripTxt=f.hasStrip?` + <span class="pl-strip">${l.stripW}×${l.stripL}</span>`:'';
      let avail=`На складе свободно: <b>${f.free} шт</b>`;
      if(f.booked) avail+=` · из наличия забронировано <b>${f.booked}</b>`;
      if(f.received) avail+=` · получено под заказ <b>${f.received}</b>`;
      avail+=` · <b>к закупке: ${f.toBuy} шт</b>`;
      let strip='';
      if(f.hasStrip){
        if(f.stripDone) strip=`<div class="pl-line ok">✅ Полоса ${l.stripW}×${l.stripL} вырезана</div>`;
        else if(f.scraps.length){ const s=f.scraps[0]; strip=`<div class="pl-line ok">✂️ Полоса ${l.stripW}×${l.stripL}: подходит обрезок <b>${s.w}×${s.l}</b>${s.place?` (${escHtml(s.place)})`:''}${f.scraps.length>1?` и ещё ${f.scraps.length-1}`:''}</div>`; }
        else strip=`<div class="pl-line bad">⚠️ Полоса ${l.stripW}×${l.stripL}: подходящего обрезка нет — потребуется отдельный лист</div>`;
      }
      const btns=[];
      if(f.canBook>0) btns.push(`<button class="btn bprim" onclick="bookPlan(${l.id})">🔒 Забронировать из наличия (${f.canBook})</button>`);
      if(f.booked) btns.push(`<button class="btn bghost" onclick="unbookPlan(${l.id})">Снять бронь</button>`);
      if(f.status!=='received'){
        btns.push(l.status==='ordered'?`<button class="btn bghost" onclick="setPlanStatus(${l.id},'buy')">↩️ В закупку</button>`:`<button class="btn bghost" onclick="setPlanStatus(${l.id},'ordered')">📦 Заказано</button>`);
        btns.push(`<button class="btn bghost" onclick="setPlanStatus(${l.id},'received')">✅ Получено</button>`);
      }
      if(f.hasStrip&&!f.stripDone) btns.push(`<button class="btn bghost" onclick="cutStrip(${l.id})">✂️ Дорезать</button>`);
      btns.push(`<button class="btn bdng pl-del" onclick="deletePlanLine(${l.id})" title="Удалить строку">🗑</button>`);
      return `<div class="pl-row">
        <div class="pl-head"><div class="pl-name">${matChip(l.mat)}</div><span class="pl-st ${f.status}">${STATUS_TXT[f.status]}</span></div>
        <div class="pl-need"><b>${l.size}</b> мм — <b>${l.qty} шт</b>${stripTxt}</div>
        <div class="pl-line">${avail}</div>${strip}
        <div class="pl-btns">${btns.join('')}</div>
      </div>`;
    }).join('');
    return `<div class="ocard">
      <div class="ohead" style="cursor:default">
        <div class="otitle"><b>${escHtml(sp.no)}</b>${sp.customer?` <span class="ocust">${escHtml(sp.customer)}</span>`:''} ${closed.has(o)?'<span class="ostat closed">заказ закрыт</span>':''}</div>
        <div class="osum">Строк: <b>${ls.length}</b> · к закупке: <b>${buyTotal} шт</b> <button class="pl-clear" onclick="deletePlanOrder(${oi})">очистить план</button></div>
      </div>
      <div class="obody">${rows}</div>
    </div>`;
  }).join('');
}
