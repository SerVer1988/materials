window.__B=window.__B||{};__B['plan']='2026-10-13a';
// ▸ plan.js — ПЛАН: потребность по заказам (из макроса CorelDRAW или вставкой текста), проверка наличия на складе,
// бронь из наличия, подбор обрезка под полосу, статусы закупки: закупить → заказано → получено
// Строка плана: {id, order, mat, size, w, l, qty (целых листов), stripW, stripL (полоса «дорезать», 0 = нет),
//                status:'buy'|'ordered'|'received', booked (листов, забронировано из наличия),
//                stripBook:{w,l,place}|null (забронированный обрезок под полосу), created}
let planFilter='open';                         // open | all
const PLAN_SEEN_KEY='lm7_plan_seen';
const PLAN_UI_KEY='lm7_plan_ui';               // свёрнутость заказов / материалов / блока «Готово» (только на этом устройстве)
const PLAN_MAX_AGE=3*24*60*60*1000;            // сообщение из макроса ждёт до 3 суток, если приложение было закрыто
const SZ_RE='(\\d{2,5})\\s*[хxХX×*]\\s*(\\d{2,5})';
let planUI={}; try{ planUI=JSON.parse(localStorage.getItem(PLAN_UI_KEY)||'{}')||{}; }catch(e){ planUI={}; }
function savePlanUI(){ try{ localStorage.setItem(PLAN_UI_KEY,JSON.stringify(planUI)); }catch(e){} }

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
    const q=rest.match(/(\d+(?:[.,]\d+)?)\s*(?:шт|лист)/i);          // «1шт», «4 листа», «0,7 листа»
    const qF=q?parseFloat(q[1].replace(',','.')):null;
    const w=+sheet[1], l=+sheet[2];
    if(!q){ out.push({mat,w,l,qty:strip?0:1,sw:strip?+strip[1]:0,sl:strip?+strip[2]:0,simple:!strip}); return; }
    if(strip){ out.push({mat,w,l,qty:Math.round(qF),sw:+strip[1],sl:+strip[2]}); return; }
    const isSheet=sheetCandidates(mat).some(sh=>sameDims(sh,{w,l}));
    if(!isSheet){                                                       // размер — раскладка, а не лист: повторяем её нужное число раз
      for(let k=0;k<Math.max(1,Math.round(qF));k++) out.push({mat,w,l,qty:1,sw:0,sl:0,simple:true});
      return;
    }
    // размер — лист, количество в листах (может быть дробным: 0,7 листа → полоса во всю ширину)
    const W=Math.min(w,l), L=Math.max(w,l);
    let whole=Math.floor(qF), frac=qF-whole;
    if(frac>=PLAN_WHOLE_RATIO){ whole++; frac=0; }
    out.push({mat,w,l,qty:whole,sw:frac>0.001?W:0,sl:frac>0.001?Math.round(frac*L):0,frac:qF!==Math.round(qF)?qF:null});
  });
  return out.filter(x=>!x.simple).concat(planFromBlocks(out.filter(x=>x.simple)));
}

// ── Размеры листов по материалам (первое слово названия). Порядок не важен: берётся самый маленький лист, на который помещается раскладка ──
const SHEETS_BY_FAMILY={
  'акрил':[[1220,2440],[2050,3050]],
  'пвх':[[1220,2440],[2050,3050]],
  'акп':[[1220,2440],[1500,4000],[1220,4000],[1500,5000]],
  'фанера':[[1220,2440],[1500,2440],[1500,1500]],
  'полик-нат':[[2050,3050]],
  'абс':[[1200,600],[1240,615],[1220,900]],
  'дсп':[[2750,2070]],
  'пэт':[[1250,2050]]
};
const PLAN_WHOLE_RATIO=0.75;   // раскладка занимает ≥ 75% длины листа — считаем целым листом (остаток слишком мал)
const familyOf=mat=>String(mat||'').toLowerCase().replace(/\s+/g,' ').trim().split(' ')[0];
function sheetCandidates(mat){
  const f=SHEETS_BY_FAMILY[familyOf(mat)];
  return f?f.map(([w,l])=>({w,l})):SIZES.map(parseSizeStr).filter(Boolean);
}
// Помещается ли раскладка a×b на лист sh; ширина листа W — меньшая сторона. Возвращает занятую длину листа
function fitBlock(a,b,sh){
  const W=Math.min(sh.w,sh.l), L=Math.max(sh.w,sh.l);
  let len=null;
  [[a,b],[b,a]].forEach(([bw,bl])=>{ if(bw<=W&&bl<=L&&(len===null||bl<len)) len=bl; });
  return len===null?null:{W,L,len};
}
function placeBlock(mat,a,b){
  let best=null;
  const tryList=list=>list.forEach(sh=>{ const f=fitBlock(a,b,sh); if(f&&(!best||sh.w*sh.l<best.area)) best={sh,f,area:sh.w*sh.l}; });
  tryList(sheetCandidates(mat));
  if(!best) tryList(SIZES.map(parseSizeStr).filter(Boolean));   // семейство неизвестно или не влезло — любой лист из справочника
  return best;
}
// Раскладки «Материал - 1155х2038 мм» (без количества) → листы.
// Блок, занимающий ≥75% листа, считается целым листом. Меньший блок остаётся В СВОЁМ РАЗМЕРЕ (300×150 так и пишется,
// не растягивается до ширины листа): так под него можно найти небольшой обрезок. Каждый малый блок — отдельная строка плана.
function planFromBlocks(list){
  const groups=new Map(), res=[];
  list.forEach(x=>{
    const pb=placeBlock(x.mat,x.w,x.l);
    if(!pb){ res.push({mat:x.mat,w:x.w,l:x.l,qty:1,sw:0,sl:0,blocks:[x.w+'×'+x.l],noFit:true}); return; }   // не помещается ни на один лист
    const key=x.mat+'||'+pb.sh.w+'x'+pb.sh.l;
    if(!groups.has(key)) groups.set(key,{mat:x.mat,sh:pb.sh,whole:[],small:[]});
    const g=groups.get(key);
    if(pb.f.len/pb.f.L>=PLAN_WHOLE_RATIO) g.whole.push(x.w+'×'+x.l); else g.small.push({w:x.w,l:x.l});
  });
  groups.forEach(g=>{
    if(g.whole.length) res.push({mat:g.mat,w:g.sh.w,l:g.sh.l,qty:g.whole.length,sw:0,sl:0,blocks:g.whole});
    g.small.forEach(b=>res.push({mat:g.mat,w:g.sh.w,l:g.sh.l,qty:0,sw:b.w,sl:b.l}));
  });
  return res;
}
const normName=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
function canonMat(name){ const n=normName(name); return MATS.find(m=>normName(m)===n)||normMaterial(String(name).replace(/\s+/g,' ').trim()); }
function fmtSheet(w,l){
  const hit=SIZES.find(s=>{ const p=parseSizeStr(s); return p&&p.w===w&&p.l===l; });
  return hit||`${w}х${l}`;
}
const sameDims=(a,b)=>a&&b&&((a.w===b.w&&a.l===b.l)||(a.w===b.l&&a.l===b.w));

// Размер полосы для ЗАКУПКИ: если полоса идёт во всю ширину листа, её длина округляется вверх до 100 мм (1177 → 1200), не больше длины листа.
// Только для показа; подбор обрезка и раскладка работают по точным размерам.
const ceil100=v=>Math.ceil(v/100)*100;
function stripBuyDims(l){
  const W=Math.min(l.w,l.l), L=Math.max(l.w,l.l);
  let a=l.stripW, b=l.stripL;
  if(a===W&&b!==W) b=Math.min(ceil100(b),L);          // полоса во всю ширину листа — длину округляем вверх
  else if(b===W&&a!==W) a=Math.min(ceil100(a),L);
  return a+'×'+b;                                      // обычный кусок (300×150) — как есть
}

// ── Добавление строк (с проверкой повторов) ──
// auto=true — заявка из CorelDRAW: без вопросов. Если заказа нет — создаётся новый со всеми строками;
// если есть — добавляются только строки, которых в заказе ещё нет (материал + лист + размер полосы). Повторная отправка дублей не даёт.
function addPlanFromText(order,text,baseId,auto){
  order=String(order||'').trim().replace(/\s+/g,' ');
  if(!order){ const m=String(text).match(/Заказ\s*№?\s*([^\s:,]+)/i); order=m?m[1]:''; }
  if(!order){ toast('Укажите заказ','err'); return false; }
  const parsed=parsePlanText(text);
  if(!parsed.length){ toast('Не удалось разобрать заявку: нужны строки вида «Материал - 1220х2440 - 1шт + 1220х456»','err'); return false; }
  if(!db.plan) db.plan=[];
  const base=baseId||Date.now()*100;
  let lines=parsed.map((p,i)=>({id:base+i,order,mat:canonMat(p.mat),size:fmtSheet(p.w,p.l),w:p.w,l:p.l,qty:p.qty,stripW:p.sw,stripL:p.sl,blocks:p.blocks||null,frac:p.frac||null,noFit:!!p.noFit,status:'buy',booked:0,created:now()}));
  lines=lines.filter(l=>!db.plan.some(x=>x.id===l.id));          // уже добавлено (с другого устройства)
  if(!lines.length) return false;
  const isNewOrder=!db.plan.some(x=>x.order===order)&&!ordersList().some(o=>o.key===order);
  if(auto){
    const lineKey=l=>[l.mat,l.w+'x'+l.l,l.stripW||0,l.stripL||0].join('|');
    const have=new Set(db.plan.filter(x=>x.order===order).map(lineKey));
    lines=lines.filter(l=>{ const k=lineKey(l); if(have.has(k)) return false; have.add(k); return true; });
    if(!lines.length){ toast(`Заказ ${order}: все материалы уже в плане`,'info'); return false; }
  }
  const repeats=lines.filter(l=>db.plan.some(x=>x.order===order&&x.mat===l.mat));
  const commit=list=>{
    if(!list.length){ toast('Повторы пропущены, новых строк нет','info'); return; }
    list.forEach(l=>db.plan.push(l)); ensureOrder(order);
    save(); fillOrderSelects(); renderAll();
    toast(auto?(isNewOrder?`🆕 Новый заказ ${order}: строк ${list.length}`:`➕ В заказ ${order} добавлено строк: ${list.length}`):`📋 В план добавлено строк: ${list.length} (заказ ${order})`,'ok');
  };
  if(auto){ commit(lines); return true; }
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
// Форма заявки — панель «add-plan», открывается кнопкой «＋» внизу (navPlusClick)
function togglePlanAdd(force){
  const p=document.getElementById('add-plan'); if(!p) return;
  if(force===undefined) toggleAddPanel('add-plan'); else p.classList.toggle('open',!!force);
}

// Сообщение из макроса (строка «<код>::plan»)
function handleInboxPlan(p){
  if(!p||!p.id||localStorage.getItem(PLAN_SEEN_KEY)===p.id) return;
  localStorage.setItem(PLAN_SEEN_KEY,p.id);
  const age=Date.now()-new Date(p.t).getTime();
  if(isNaN(age)||age>PLAN_MAX_AGE) return;
  const baseId=(parseInt(String(p.id).replace(/\D/g,'').slice(-12),10)||0)*100;  // одинаковые id на всех устройствах → нет дублей
  go('plan',document.getElementById('nbtn-plan'));
  addPlanFromText(p.order||'',p.text||'',baseId||undefined,true);
}

// ── Расчёт по строке ──
function planContext(){
  const by=calcStockDetailed(), stockQ={};
  Object.keys(by).forEach(m=>by[m].forEach(s=>{ stockQ[`${m}||${s.size}`]=s.qty; }));
  const res=calcReserves(), recv={};
  db.income.forEach(r=>{ if(r.order){ const k=`${r.order}||${r.mat}||${r.size}`; recv[k]=(recv[k]||0)+r.qty; } });
  // Полосы без подходящего обрезка одного материала и листа делят листы между собой (по площади, до 75% листа);
  // «владелец» листа — первая полоса в каждой группе. Так «ПВХ 3 мм» со всех заказов складывается в минимум листов.
  const closed=new Set(ordersList().filter(o=>o.status==='closed').map(o=>o.key));
  const grp={}, sheetOwner=new Set();
  planAll().sort((a,b)=>a.id-b.id).forEach(l=>{
    if(closed.has(l.order)||!(l.stripW>0&&l.stripL>0)||l.stripBook||isStripDone(l)) return;
    if(findStripScraps(l.mat,l.stripW,l.stripL,l.id).length) return;
    const k=l.mat+'||'+l.size; (grp[k]=grp[k]||[]).push(l);
  });
  Object.keys(grp).forEach(k=>{
    const ls=grp[k], sh=parseSizeStr(ls[0].size), cap=(sh?sh.w*sh.l:1220*2440)*0.75;
    let run=cap+1;
    ls.forEach(l=>{ const a=l.stripW*l.stripL; if(run+a>cap){ sheetOwner.add(l.id); run=0; } run+=a; });
  });
  return {stockQ,res,recv,sheetOwner};
}
// Строки Плана (кроме автосозданных из брака, если запись брака удалена или снята)
function planAll(){ return (db.plan||[]).filter(x=>!x.fromBrak||db.expense.some(e=>e.id===x.fromBrak&&e.brak)); }
// Полоса уже вырезана (есть расход по этому заказу и материалу с размером изделия = полосе). Брак не в счёт — деталь надо резать заново.
function isStripDone(l){
  if(!(l.stripW>0&&l.stripL>0)) return false;
  const d={w:l.stripW,l:l.stripL};
  return db.expense.some(e=>!e.brak&&e.order===l.order&&e.mat===l.mat&&e.det&&sameDims(parseSizeStr(e.det),d));
}
// Действующие брони обрезков: открытые заказы, полоса ещё не вырезана
function activeStripBooks(){
  const closed=new Set(ordersList().filter(o=>o.status==='closed').map(o=>o.key));
  return planAll().filter(x=>x.stripBook&&!closed.has(x.order)&&!isStripDone(x));
}
// Для раздела «Склад → Обрезки»: ключ «материал||ШxД||место» → [заказы, где обрезок в брони]
function scrapBookingsMap(){
  const m={};
  activeStripBooks().forEach(x=>{ const b=x.stripBook, k=`${x.mat}||${b.w}x${b.l}||${b.place||''}`; (m[k]=m[k]||[]).push(x.order); });
  return m;
}
// Подходящие обрезки под полосу (самый подходящий — первым).
// Обрезки, уже забронированные под полосы ДРУГИХ строк плана (skipId — текущая строка), не предлагаются
function findStripScraps(mat,w,l,skipId){
  const out=[], used={};
  activeStripBooks().forEach(x=>{
    if(x.id===skipId||x.mat!==mat) return;
    const k=x.stripBook.w+'x'+x.stripBook.l+'|'+(x.stripBook.place||'');
    used[k]=(used[k]||0)+1;
  });
  db.remainders.forEach(rec=>(rec.pieces||[]).forEach(p=>{
    if(p.mat!==mat||p.type==='scrap_sub'||!(p.qty>0)) return;
    if(!((p.w>=w&&p.l>=l)||(p.w>=l&&p.l>=w))) return;
    const place=p.place||rec.place||'', k=p.w+'x'+p.l+'|'+place;
    const take=Math.min(used[k]||0,p.qty); used[k]=(used[k]||0)-take;
    const left=p.qty-take;
    if(left>0) out.push({w:p.w,l:p.l,qty:left,place});
  }));
  return out.sort((a,b)=>a.w*a.l-b.w*b.l);
}
function planLineInfo(line,ctx){
  const k=`${line.mat}||${line.size}`, rk=`${line.order}||${k}`;
  const booked=line.booked||0;
  const hasStrip=line.stripW>0&&line.stripL>0;
  const stripDone=hasStrip&&isStripDone(line);
  const scraps=hasStrip&&!stripDone?findStripScraps(line.mat,line.stripW,line.stripL,line.id):[];
  const stripBooked=hasStrip&&!stripDone&&!!line.stripBook;
  const canBookStrip=scraps.length>0&&!stripBooked;
  // Строка только из полосы (0 шт + 495×1138): если подходящего обрезка нет — на неё нужен целый лист.
  // Он попадает в «к закупке», а при «Получено» оформляется в приход. Если лист уже пришёл или забронирован из наличия — потребность сохраняется.
  const recvAvail=ctx.recv[rk]||0;
  const owner=ctx.sheetOwner?ctx.sheetOwner.has(line.id):scraps.length===0;
  const needSheet=hasStrip&&!stripDone&&!stripBooked&&((scraps.length===0&&owner)||(line.qty===0&&(recvAvail>0||booked>0)));
  const sharesSheet=hasStrip&&!stripDone&&!stripBooked&&scraps.length===0&&!owner&&!needSheet;
  const qtyEff=line.qty+(needSheet?1:0);
  const take=Math.min(Math.max(0,qtyEff-booked),recvAvail);
  ctx.recv[rk]=recvAvail-take;
  const received=take, toBuy=Math.max(0,qtyEff-booked-received);
  const stock=ctx.stockQ[k]||0, reserved=(ctx.res[k]||[]).reduce((s,x)=>s+x.left,0);
  const free=Math.max(0,stock-reserved);
  const covered=qtyEff>0&&toBuy===0;
  let status=covered||(line.status==='received'&&toBuy===0)?'received':(line.status==='ordered'?'ordered':'buy');
  if(line.qty===0&&hasStrip&&(stripDone||stripBooked)) status='received';     // строка только из полосы: обрезок в брони или полоса вырезана
  // «Готово» — всё по строке закрыто и мешать не должно: листы получены/забронированы, полоса вырезана или обрезок забронирован
  const done=status==='received'&&(!hasStrip||stripDone||stripBooked);
  return {booked,received,toBuy,free,canBook:Math.min(free,toBuy),hasStrip,stripDone,scraps,stripBooked,canBookStrip,covered,status,done,needSheet,sharesSheet};
}

// ── Получено → добавить в приход ──
let planRecvId=null, planRecvGroup=null;
function openPlanReceive(id){
  const l=planLine(id); if(!l) return;
  const f=planLineInfo(l,planContext());
  if(f.toBuy<=0){ setPlanStatus(id,'received'); return; }          // оприходовать нечего (например, только полоса) — просто отметка
  planRecvId=id;
  document.getElementById('plan-recv-info').textContent=`${l.mat} — ${l.size} мм · заказ ${l.order}`;
  document.getElementById('plan-recv-qty').value=f.toBuy;
  const sel=document.getElementById('plan-recv-place');
  sel.innerHTML=PLACES.map(p=>`<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('')+'<option value="">— не указано —</option>';
  document.getElementById('plan-recv-modal').classList.add('show');
}
function closePlanRecv(){ document.getElementById('plan-recv-modal').classList.remove('show'); planRecvId=null; planRecvGroup=null; }
function confirmPlanReceive(){
  if(planRecvGroup) return confirmGroupReceive();
  const l=planLine(planRecvId); if(!l) return;
  const qty=parseInt(document.getElementById('plan-recv-qty').value,10);
  if(!qty||qty<1){ toast('Укажите количество листов','err'); return; }
  const place=document.getElementById('plan-recv-place').value;
  if(!MATS.includes(l.mat)){ MATS.push(l.mat); releaseRename('mats',l.mat); }
  if(!SIZES.includes(l.size)) SIZES.push(l.size);
  db.income.push({id:Date.now(),dt:now(),mat:l.mat,size:l.size,w:l.w,l:l.l,qty,place,order:l.order,note:'Из плана закупок'});
  ensureOrder(l.order);
  closePlanRecv(); save(); fillAllSelects(); renderAll();
  toast(`📥 Добавлено в приход: ${l.mat} ${l.size} — ${qty} шт`,'ok');
}

// ── Действия ──
const planLine=id=>db.plan.find(x=>x.id===id);
function bookPlan(id){
  const l=planLine(id); if(!l) return;
  const info=planLineInfo(l,planContext());
  if(info.canBook<=0){ toast('Свободных листов этого материала и размера нет','err'); return; }
  l.booked=(l.booked||0)+info.canBook;
  save(); renderAll(); toast(`🔒 В брони: ${info.canBook} шт`,'ok');
}
function unbookPlan(id){ const l=planLine(id); if(!l) return; l.booked=0; save(); renderAll(); toast('Бронь снята','ok'); }
// Бронь именно того обрезка, который показан в строке «подходит обрезок …»
function bookStrip(id){
  const l=planLine(id); if(!l) return;
  const s=findStripScraps(l.mat,l.stripW,l.stripL,l.id)[0];
  if(!s){ toast('Подходящего обрезка уже нет','err'); renderAll(); return; }
  l.stripBook={w:s.w,l:s.l,place:s.place};
  save(); renderAll(); toast(`🔒 Обрезок ${s.w}×${s.l} в брони`,'ok');
}
function unbookStrip(id){ const l=planLine(id); if(!l) return; l.stripBook=null; save(); renderAll(); toast('Бронь обрезка снята','ok'); }
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

// ── Сворачивание ──
function togglePlanOrder(i){
  const key=window.__planKeys[i]; if(key===undefined) return;
  planUI['o:'+key]=!(window.__planCollapsed||{})[key]; savePlanUI(); renderPlan();
}
function togglePlanRow(id){ planUI['r:'+id]=!planUI['r:'+id]; savePlanUI(); renderPlan(); }
function togglePlanDone(i){
  const key=window.__planKeys[i]; if(key===undefined) return;
  planUI['d:'+key]=!planUI['d:'+key]; savePlanUI(); renderPlan();
}

// ── Отрисовка ──
const fmtFrac=v=>String(Math.round(v*100)/100).replace('.',',');
const STATUS_TXT={buy:'Закупить',ordered:'Заказано',received:'Получено'};
function planRowHtml(l,f){
  const rc=!!planUI['r:'+l.id];
  const stripTxt=f.hasStrip?` + <span class="pl-strip">${stripBuyDims(l)}</span>`:'';
  let avail=`На складе свободно: <b>${f.free} шт</b>`;
  if(f.booked) avail+=` · в брони из наличия <b>${f.booked}</b>`;
  if(f.received) avail+=` · получено под заказ <b>${f.received}</b>`;
  if(f.needSheet) avail+=` · на полосу нужен целый лист`;
  if(f.sharesSheet) avail+=` · полоса — из общего листа с другими полосами`;
  avail+=` · <b>к закупке: ${f.toBuy} шт</b>`;
  let strip='';
  if(f.hasStrip){
    if(f.stripDone) strip=`<div class="pl-line ok">✅ Полоса ${l.stripW}×${l.stripL} вырезана</div>`;
    else if(f.stripBooked){ const b=l.stripBook; strip=`<div class="pl-line ok">🔒 Полоса ${l.stripW}×${l.stripL}: в брони обрезок <b>${b.w}×${b.l}</b>${b.place?` (${escHtml(b.place)})`:''}</div>`; }
    else if(f.scraps.length){ const s=f.scraps[0]; strip=`<div class="pl-line ok">✂️ Полоса ${l.stripW}×${l.stripL}: подходит обрезок <b>${s.w}×${s.l}</b>${s.place?` (${escHtml(s.place)})`:''}${f.scraps.length>1?` и ещё ${f.scraps.length-1}`:''}</div>`; }
    else strip=`<div class="pl-line bad">⚠️ Полоса ${l.stripW}×${l.stripL}: подходящего обрезка нет — потребуется отдельный лист</div>`;
  }
  const btns=[];
  if(f.canBook>0) btns.push(`<button class="btn bprim" onclick="bookPlan(${l.id})">🔒 В бронь (${f.canBook})</button>`);
  if(f.booked) btns.push(`<button class="btn bghost" onclick="unbookPlan(${l.id})">Снять бронь</button>`);
  if(f.status!=='received'){
    btns.push(l.status==='ordered'?`<button class="btn bghost" onclick="setPlanStatus(${l.id},'buy')">↩️ В закупку</button>`:`<button class="btn bghost" onclick="setPlanStatus(${l.id},'ordered')">📦 Заказано</button>`);
    btns.push(`<button class="btn bghost" onclick="openPlanReceive(${l.id})">✅ Получено</button>`);
  }
  if(f.hasStrip&&!f.stripDone){
    if(f.stripBooked){
      btns.push(`<button class="btn bghost" onclick="unbookStrip(${l.id})">Снять бронь куска</button>`);
      btns.push(`<button class="btn bghost" onclick="cutStrip(${l.id})">✂️ Дорезать</button>`);
    } else if(f.canBookStrip) btns.push(`<button class="btn bprim" onclick="bookStrip(${l.id})">🔒 В бронь</button>`);
    else btns.push(`<button class="btn bghost" onclick="cutStrip(${l.id})">✂️ Дорезать</button>`);
  }
  btns.push(`<button class="btn bdng pl-del" onclick="deletePlanLine(${l.id})" title="Удалить строку">🗑</button>`);
  return `<div class="pl-row${rc?' collapsed':''}${f.done?' done':''}">
    <div class="pl-head" onclick="togglePlanRow(${l.id})"><span class="pl-arrow">${rc?'▸':'▾'}</span><div class="pl-name">${matChip(l.mat)}</div><span class="pl-st ${f.status}">${STATUS_TXT[f.status]}</span></div>
    <div class="pl-need"><b>${l.size}</b> мм — <b>${l.qty} шт</b>${stripTxt}</div>
    ${l.blocks?`<div class="pl-line">Раскладка: ${l.blocks.join(' + ')}${l.frac?` → <b>≈ ${fmtFrac(l.frac)} листа</b>`:''}</div>`:''}
    ${l.noFit?'<div class="pl-line bad">⚠️ Размер раскладки не помещается ни на один стандартный лист — проверьте</div>':''}
    <div class="pl-line">${avail}</div>${strip}
    <div class="pl-btns">${btns.join('')}</div>
  </div>`;
}
function renderPlanOrders(){
  const box=document.getElementById('plan-list'); if(!box) return;
  const closed=new Set(ordersList().filter(o=>o.status==='closed').map(o=>o.key));
  const q=(document.getElementById('plan-s')?.value||'').trim().toLowerCase();
  const ctx=planContext();
  const lines=planAll().sort((a,b)=>a.id-b.id);
  const infos=new Map(); lines.forEach(l=>infos.set(l.id,planLineInfo(l,ctx)));   // порядок важен: распределение полученных листов
  const stages=calcOrderStages();
  const orders=[...new Set(lines.map(l=>l.order))]
    .filter(o=>planFilter==='all'||!closed.has(o))
    .filter(o=>!q||o.toLowerCase().includes(q)||lines.some(l=>l.order===o&&l.mat.toLowerCase().includes(q)))
    .filter(o=>!planMat||lines.some(l=>l.order===o&&l.mat===planMat))
    .sort((a,b)=>b.localeCompare(a,'ru',{numeric:true}));
  window.__planKeys=orders; window.__planCollapsed={};
  if(!orders.length){ box.innerHTML='<div class="empty"><div class="ei">📋</div>Плана пока нет.<br>Отправьте заявку из CorelDRAW или нажмите «➕ Вставить заявку»</div>'; return; }
  box.innerHTML=orders.map((o,oi)=>{
    const ls=lines.filter(l=>l.order===o&&(!planMat||l.mat===planMat));
    const buyTotal=ls.reduce((s,l)=>s+infos.get(l.id).toBuy,0);
    const act=ls.filter(l=>!infos.get(l.id).done), done=ls.filter(l=>infos.get(l.id).done);
    const oc=planUI['o:'+o]!==undefined?!!planUI['o:'+o]:(ls.length>0&&!act.length);   // по умолчанию свёрнут, если всё готово
    window.__planCollapsed[o]=oc;
    const dOpen=!!planUI['d:'+o];
    const sp=splitOrder(o);
    const doneBlock=done.length?`<div class="pl-done">
        <div class="pl-done-head" onclick="togglePlanDone(${oi})"><span class="pl-arrow">${dOpen?'▾':'▸'}</span> Готово: <b>${done.length}</b></div>
        <div class="pl-done-body" style="display:${dOpen?'block':'none'}">${done.map(l=>planRowHtml(l,infos.get(l.id))).join('')}</div>
      </div>`:'';
    return `<div class="ocard">
      <div class="ohead pl-ohead" style="cursor:pointer" onclick="togglePlanOrder(${oi})">
        <div class="otitle"><span class="pl-arrow">${oc?'▸':'▾'}</span> <b>${escHtml(sp.no)}</b>${sp.customer?` <span class="ocust">${escHtml(sp.customer)}</span>`:''} ${stageTag(stages.get(o))}</div>
        <div class="osum">Строк: <b>${ls.length}</b> · к закупке: <b>${buyTotal} шт</b> <button class="pl-clear" onclick="event.stopPropagation();deletePlanOrder(${oi})">очистить план</button></div>
      </div>
      <div class="obody"${oc?' style="display:none"':''}>${act.map(l=>planRowHtml(l,infos.get(l.id))).join('')}${doneBlock}</div>
    </div>`;
  }).join('');
}

// ══════════════════════ ЗАКУПКА: материалы со всех заказов вместе ══════════════════════
let planView='buy', planMat='';
function setPlanView(v){ planView=v; renderPlan(); }
function setPlanMat(m){ planMat=(planMat===m)?'':m; renderPlan(); }

// Группы «материал + лист»: сколько нужно со всех открытых заказов, сколько есть свободно, сколько купить
function planGroupsData(){
  const ctx=planContext(), lines=planAll().sort((a,b)=>a.id-b.id);
  const closed=new Set(ordersList().filter(o=>o.status==='closed').map(o=>o.key));
  const infos=new Map(); lines.forEach(l=>infos.set(l.id,planLineInfo(l,ctx)));
  const groups=new Map(), matNeed=new Map(), matLines=new Map();
  lines.forEach(l=>{
    if(closed.has(l.order)) return;
    const f=infos.get(l.id), k=l.mat+'||'+l.size;
    if(!f.done) matLines.set(l.mat,(matLines.get(l.mat)||0)+1);
    if(!groups.has(k)) groups.set(k,{key:k,mat:l.mat,size:l.size,need:0,free:f.free,stock:ctx.stockQ[k]||0,orders:new Map(),lines:[],ordered:0,strips:0});
    const g=groups.get(k); g.lines.push(l);
    if(f.toBuy>0){ g.need+=f.toBuy; g.orders.set(l.order,(g.orders.get(l.order)||0)+f.toBuy); if(l.status==='ordered') g.ordered+=f.toBuy; matNeed.set(l.mat,(matNeed.get(l.mat)||0)+f.toBuy); }
    if(f.needSheet||f.sharesSheet) g.strips++;
  });
  groups.forEach(g=>{ g.cover=Math.min(g.free,g.need); g.buy=g.need-g.cover; g.wait=Math.min(g.ordered,g.buy); g.toOrder=g.buy-g.wait; });
  return {groups,infos,matNeed,matLines};
}
function planMatChips(counts,unit){
  const el=document.getElementById('plan-mats'); if(!el) return;
  const mats=[...counts.keys()].filter(m=>counts.get(m)>0).sort((a,b)=>a.localeCompare(b,'ru'));
  if(planMat&&!mats.includes(planMat)) planMat='';
  el.innerHTML=mats.length?`<div class="fchip${planMat?'':' on'}" onclick="setPlanMat('')">Все</div>`+mats.map(m=>`<div class="fchip${m===planMat?' on':''}" data-m="${escHtml(m)}" onclick="setPlanMat(this.dataset.m)">${escHtml(m)} · ${counts.get(m)}</div>`).join(''):'';
}
function planOrderShort(o){ const sp=splitOrder(o); return escHtml(sp.no)+(sp.customer?' '+escHtml(sp.customer.length>16?sp.customer.slice(0,15)+'…':sp.customer):''); }

function renderPlan(){
  const buy=planView==='buy';
  document.getElementById('pv-buy')?.classList.toggle('on',buy);
  document.getElementById('pv-ord')?.classList.toggle('on',!buy);
  const fw=document.getElementById('pfl-wrap'); if(fw) fw.style.display=buy?'none':'flex';
  const si=document.getElementById('plan-s'); if(si) si.placeholder=buy?'Поиск: материал или заказ…':'Поиск: заказ или материал…';
  if(buy) renderPlanBuy(); else { renderPlanOrders(); const G=planGroupsData(); planMatChips(G.matLines); }
}
function renderPlanBuy(){
  const box=document.getElementById('plan-list'); if(!box) return;
  const q=(document.getElementById('plan-s')?.value||'').trim().toLowerCase();
  const G=planGroupsData();
  planMatChips(G.matNeed);
  let gs=[...G.groups.values()].filter(g=>g.need>0)
    .filter(g=>!planMat||g.mat===planMat)
    .filter(g=>!q||g.mat.toLowerCase().includes(q)||[...g.orders.keys()].some(o=>o.toLowerCase().includes(q)));
  gs.sort((a,b)=>(b.toOrder>0)-(a.toOrder>0)||a.mat.localeCompare(b.mat,'ru'));
  window.__planGroupKeys=gs.map(g=>g.key);
  if(!gs.length){ box.innerHTML='<div class="empty"><div class="ei">🎉</div>Закупать нечего: всё есть в наличии или уже заказано.<br>Заявки появляются из CorelDRAW или кнопкой «＋».</div>'; return; }
  const tot=gs.reduce((s,g)=>({o:s.o+g.toOrder,w:s.w+g.wait,c:s.c+g.cover}),{o:0,w:0,c:0});
  const ords=new Set(); gs.forEach(g=>g.orders.forEach((n,o)=>ords.add(o)));
  const sum=`<div class="pg-sum"><b>${tot.o}</b> л. к закупке${tot.w?` · ждём ${tot.w}`:''}${tot.c?` · из наличия ${tot.c}`:''} <span class="pg-sub">· ${gs.length} поз. · ${ords.size} заказ.</span></div>`;
  box.innerHTML=sum+gs.map((g,i)=>{
    const badge=g.toOrder>0?`<div class="pg-badge buy">Купить ${g.toOrder}</div>`:(g.wait>0?`<div class="pg-badge wait">Ждём ${g.wait}</div>`:`<div class="pg-badge ok">Есть в наличии</div>`);
    const ords=[...g.orders.entries()].map(([o,n])=>`${planOrderShort(o)} ×${n}`).join(' · ');
    const btns=[];
    if(g.toOrder>0) btns.push(`<button class="btn bghost bsm" onclick="orderGroup(${i})">📦 Заказано (${g.toOrder})</button>`);
    if(g.buy>0) btns.push(`<button class="btn bghost bsm" onclick="receiveGroup(${i})">✅ Получено</button>`);
    if(g.cover>0) btns.push(`<button class="btn bprim bsm" onclick="bookGroup(${i})">🔒 В бронь (${g.cover})</button>`);
    return `<div class="pg">
      <div class="pg-top"><div class="pg-mat">${matChip(g.mat)}<span class="pg-sz">${escHtml(g.size)}</span></div>${badge}</div>
      <div class="pg-line">Нужно <b>${g.need}</b> · в наличии свободно <b>${g.free}</b>${g.cover?` → из наличия <b>${g.cover}</b>`:''}${g.strips?` · полос: ${g.strips}`:''}</div>
      <div class="pg-ord">${ords}</div>
      <div class="pg-btns">${btns.join('')}</div>
    </div>`;
  }).join('');
}
function planGroupByIdx(i){ const key=(window.__planGroupKeys||[])[i]; if(!key) return null; const G=planGroupsData(); return {G,g:G.groups.get(key)}; }
// «Заказано»: строки, которые не закрываются наличием, помечаются заказанными
function orderGroup(i){
  const r=planGroupByIdx(i); if(!r||!r.g) return;
  let cover=r.g.cover;
  r.g.lines.forEach(l=>{ const t=r.G.infos.get(l.id).toBuy; if(t<=0) return; const use=Math.min(cover,t); cover-=use; if(t-use>0&&l.status!=='ordered') l.status='ordered'; });
  save(); renderAll(); renderPlan(); toast('📦 Отмечено как заказано','ok');
}
// «Получено»: приход в запас (без заказа), затем сам бронируется под строки, которым нужен материал
function receiveGroup(i){
  const r=planGroupByIdx(i); if(!r||!r.g) return;
  planRecvId=null; planRecvGroup={key:r.g.key,mat:r.g.mat,size:r.g.size};
  document.getElementById('plan-recv-info').textContent=`${r.g.mat} — ${r.g.size} мм · в запас, затем в бронь под заказы`;
  document.getElementById('plan-recv-qty').value=Math.max(1,r.g.buy);
  const sel=document.getElementById('plan-recv-place');
  sel.innerHTML=PLACES.map(p=>`<option value="${escHtml(p)}">${escHtml(p)}</option>`).join('')+'<option value="">— не указано —</option>';
  document.getElementById('plan-recv-modal').classList.add('show');
}
function confirmGroupReceive(){
  const gr=planRecvGroup; if(!gr) return;
  const qty=parseInt(document.getElementById('plan-recv-qty').value,10);
  if(!qty||qty<1){ toast('Укажите количество листов','err'); return; }
  const place=document.getElementById('plan-recv-place').value, sz=parseSizeStr(gr.size)||{w:0,l:0};
  if(!MATS.includes(gr.mat)){ MATS.push(gr.mat); releaseRename('mats',gr.mat); }
  if(!SIZES.includes(gr.size)) SIZES.push(gr.size);
  db.income.push({id:Date.now(),dt:now(),mat:gr.mat,size:gr.size,w:sz.w,l:sz.l,qty,place,order:'',note:'Из плана закупок'});
  closePlanRecv();
  // теперь материал свободен на складе — сразу бронируем под строки плана
  const G=planGroupsData(), g=G.groups.get(gr.key); if(g) planAutoBook(g,G.infos);
  save(); fillAllSelects(); renderAll(); renderPlan();
  toast(`📥 Получено ${qty} л. ${gr.mat} — в наличии и в брони под заказы`,'ok');
}
function planAutoBook(g,infos){
  let avail=g.free;
  g.lines.forEach(l=>{ const f=infos.get(l.id); if(avail<=0||f.toBuy<=0) return; const t=Math.min(avail,f.toBuy); l.booked=(l.booked||0)+t; avail-=t; });
}
function bookGroup(i){
  const r=planGroupByIdx(i); if(!r||!r.g) return;
  planAutoBook(r.g,r.G.infos); save(); renderAll(); renderPlan();
  toast(`🔒 В брони: ${r.g.cover} л.`,'ok');
}
