// ▸ orders.js — Заказы: бронь листов под заказ (vs запас), раздел «Заказы», закрытие заказа
// Заказ — строка вида «9-08-77_Талан» (номер_заказчик). В приходе и расходе хранится в поле order.
// Бронь = листы, пришедшие «под заказ», минус листы, уже израсходованные на этот заказ. Закрытый заказ бронь не держит.
let ordersFilter='open';      // open | closed | all
const ordersOpen=new Set();   // раскрытые карточки

const escHtml=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const m2fmt=v=>(Math.round(v*100)/100).toFixed(2);

function splitOrder(key){
  const i=key.indexOf('_');
  return i<0?{no:key,customer:''}:{no:key.slice(0,i),customer:key.slice(i+1).trim()};
}

// ── Список заказов: из справочника db.orders + все номера, встречающиеся в записях ──
function ordersList(){
  const map=new Map();
  (db.orders||[]).forEach(o=>{
    const prev=map.get(o.key);
    if(!prev || (o.ts||o.id||0)>=(prev.ts||prev.id||0)) map.set(o.key,o);
  });
  [...db.income,...db.expense].forEach(r=>{
    if(r.order && !map.has(r.order)) map.set(r.order,{id:0,key:r.order,status:'open'});
  });
  return [...map.values()].map(o=>({key:o.key,status:o.status==='closed'?'closed':'open',...splitOrder(o.key)}));
}
function ensureOrder(key){
  if(!db.orders) db.orders=[];
  if(!db.orders.some(o=>o.key===key)) db.orders.push({id:Date.now(),key,status:'open',created:now()});
}
function setOrderStatus(key,status){
  if(!db.orders) db.orders=[];
  const ts=Date.now();
  const mine=db.orders.filter(o=>o.key===key);
  if(!mine.length) db.orders.push({id:ts,key,status,ts,created:now()});
  mine.forEach(o=>{o.status=status;o.ts=ts;o.closedAt=status==='closed'?now():'';});
  save(); renderAll(); fillOrderSelects();
}

// ── Расчёт по заказам ──
function calcOrderData(){
  const res=new Map();
  const get=key=>{ if(!res.has(key)) res.set(key,{pos:new Map(),detFull:0,detScrap:0,expCount:0}); return res.get(key); };
  const pos=(o,mat,size,w,l)=>{ const k=`${mat}||${size}`; if(!o.pos.has(k)) o.pos.set(k,{mat,size,w:w||0,l:l||0,got:0,used:0}); return o.pos.get(k); };
  db.income.forEach(r=>{ if(r.order) pos(get(r.order),r.mat,r.size,r.w,r.l).got+=r.qty; });
  db.expense.forEach(r=>{
    if(!r.order) return;
    const o=get(r.order); o.expCount++;
    const full=(r.etype==='full'||!r.etype);
    const dd=parseSizeStr(r.det||'');
    const a=dd?dd.w*dd.l*r.qty/1e6:0;
    if(full){ pos(o,r.mat,r.size,r.w,r.l).used+=r.qty; o.detFull+=a; } else o.detScrap+=a;
  });
  return res;
}
// Бронь по позициям склада: ключ «материал||размер» → [{order,left}] только по открытым заказам
function calcReserves(){
  const data=calcOrderData(), open=new Set(ordersList().filter(o=>o.status==='open').map(o=>o.key)), out={};
  data.forEach((o,key)=>{
    if(!open.has(key)) return;
    o.pos.forEach((p,k)=>{ const left=p.got-p.used; if(left>0){ (out[k]=out[k]||[]).push({order:key,left}); } });
  });
  return out;
}
function orderPosBalance(key,mat,size){
  const o=calcOrderData().get(key); const p=o&&o.pos.get(`${mat}||${size}`);
  return p?p.got-p.used:0;
}
function orderShortageHint(rec){
  if(!rec.order || !(rec.etype==='full'||!rec.etype)) return;
  if(orderPosBalance(rec.order,rec.mat,rec.size)<0) setTimeout(()=>toast(`⚠️ Сверх брони заказа ${rec.order}: листов этого размера под заказ пришло меньше`,'err'),1100);
}

// ── Поля «Заказ» в формах прихода и расхода ──
function fillOrderSelects(){
  const open=ordersList().filter(o=>o.status==='open').sort((a,b)=>b.key.localeCompare(a.key,'ru'));
  [['in-order','— В запас —'],['out-order','— без заказа —']].forEach(([id,empty])=>{
    const sel=document.getElementById(id); if(!sel) return;
    const cur=sel.value;
    sel.innerHTML=`<option value="">${empty}</option>`+open.map(o=>`<option value="${escHtml(o.key)}">${escHtml(o.key)}</option>`).join('')+`<option value="${CUSTOM_VAL}">➕ Новый заказ…</option>`;
    if([...sel.options].some(o=>o.value===cur)) sel.value=cur;
    onSelectChange(id,id+'-custom');
  });
}
// Выбрать заказ в поле (при редактировании/подстановке). Нет в списке — предлагаем как «новый».
function setOrderSelect(selId,key){
  const sel=document.getElementById(selId); if(!sel) return;
  const inp=document.querySelector(`#${selId}-custom input`);
  if(inp) inp.value='';
  if(!key){ sel.value=''; }
  else if([...sel.options].some(o=>o.value===key)){ sel.value=key; }
  else {
    const exists=ordersList().some(o=>o.key===key);  // заказ есть, но закрыт
    if(exists){ const op=new Option(key+' (закрыт)',key); sel.insertBefore(op,sel.options[sel.options.length-1]); sel.value=key; }
    else { sel.value=CUSTOM_VAL; if(inp) inp.value=key; }
  }
  onSelectChange(selId,selId+'-custom');
}
// Прочитать заказ из поля: '' = без заказа, null = ошибка (выбран «новый», но номер не введён)
function readOrderField(selId){
  const sel=document.getElementById(selId); if(!sel) return '';
  if(sel.value===CUSTOM_VAL){
    const v=(document.querySelector(`#${selId}-custom input`).value||'').trim().replace(/\s+/g,' ');
    return v||null;
  }
  return sel.value;
}
const ordTag=key=>key?`<div class="ord-tag" title="${escHtml(key)}">🔒 ${escHtml(key)}</div>`:'';

// ── Раздел «Заказы» ──
function setOrdersFilter(f){
  ordersFilter=f;
  ['open','closed','all'].forEach(k=>document.getElementById('ofl-'+k)?.classList.toggle('on',k===f));
  renderOrders();
}
function toggleOrderCard(i){
  const key=window.__ordKeys&&window.__ordKeys[i]; if(key===undefined) return;
  if(ordersOpen.has(key)) ordersOpen.delete(key); else ordersOpen.add(key);
  renderOrders();
}
function createOrder(){
  const inp=document.getElementById('ord-new-inp');
  const key=(inp.value||'').trim().replace(/\s+/g,' ');
  if(!key){ toast('Введите заказ: номер_заказчик','err'); return; }
  if(ordersList().some(o=>o.key===key)){ toast('Такой заказ уже есть','err'); return; }
  ensureOrder(key); inp.value='';
  ordersOpen.add(key); save(); fillOrderSelects(); renderOrders();
  toast('✅ Заказ создан','ok');
}
function closeOrder(i){
  const key=window.__ordKeys[i]; const o=calcOrderData().get(key);
  const left=o?[...o.pos.values()].reduce((s,p)=>s+Math.max(0,p.got-p.used),0):0;
  confirm2(`Закрыть заказ ${key}?`+(left?` Неизрасходованная бронь (${left} шт.) вернётся в запас.`:''),()=>{ setOrderStatus(key,'closed'); toast('🔒 Заказ закрыт','ok'); });
}
function reopenOrder(i){ setOrderStatus(window.__ordKeys[i],'open'); toast('Заказ открыт снова','ok'); }

function orderTotals(o){
  let got=0,used=0,gotM2=0,usedM2=0;
  o.pos.forEach(p=>{ got+=p.got; used+=p.used; gotM2+=p.got*p.w*p.l/1e6; usedM2+=p.used*p.w*p.l/1e6; });
  return {got,used,diff:got-used,gotM2,usedM2,diffM2:gotM2-usedM2};
}
function diffLabel(diff,status,unit){
  if(diff===0) return `<span class="ostat ok">ровно</span>`;
  if(status==='closed') return diff>0?`<span class="ostat ok">экономия ${unit(diff)}</span>`:`<span class="ostat bad">недостача ${unit(-diff)}</span>`;
  return diff>0?`<span class="ostat info">в брони ${unit(diff)}</span>`:`<span class="ostat bad">перерасход ${unit(-diff)}</span>`;
}
function renderOrders(){
  const box=document.getElementById('orders-list'); if(!box) return;
  const q=(document.getElementById('ord-s')?.value||'').trim().toLowerCase();
  const data=calcOrderData();
  let list=ordersList().filter(o=>ordersFilter==='all'||o.status===ordersFilter).filter(o=>!q||o.key.toLowerCase().includes(q));
  if(!list.length){ box.innerHTML=`<div class="empty"><div class="ei">🧾</div>${ordersFilter==='closed'?'Закрытых заказов нет':'Заказов нет — создайте заказ выше или выберите его в приходе'}</div>`; window.__ordKeys=[]; return; }
  // группировка по заказчику
  const groups={};
  list.forEach(o=>{ (groups[o.customer||'Без заказчика']=groups[o.customer||'Без заказчика']||[]).push(o); });
  const keys=[]; let html='';
  Object.keys(groups).sort((a,b)=>a.localeCompare(b,'ru')).forEach(cust=>{
    const ords=groups[cust].sort((a,b)=>b.no.localeCompare(a.no,'ru',{numeric:true}));
    let gg=0,gu=0;
    ords.forEach(o=>{ const t=orderTotals(data.get(o.key)||{pos:new Map()}); gg+=t.got; gu+=t.used; });
    html+=`<div class="ogroup"><span>${escHtml(cust)}</span><span class="ogroup-sum">${ords.length} зак. · листов ${gu} из ${gg}</span></div>`;
    ords.forEach(o=>{
      const d=data.get(o.key)||{pos:new Map(),detFull:0,detScrap:0,expCount:0};
      const t=orderTotals(d), idx=keys.length; keys.push(o.key);
      const open=ordersOpen.has(o.key);
      const status=o.status==='closed'?'<span class="ostat closed">закрыт</span>':'<span class="ostat open">в работе</span>';
      let body='';
      if(open){
        const rows=[...d.pos.values()].sort((a,b)=>a.mat.localeCompare(b.mat,'ru')).map(p=>`
          <div class="opos">
            <div class="opos-name">${escHtml(p.mat)} <span class="opos-sz">${escHtml(p.size)}</span></div>
            <div class="opos-nums"><span>заказано <b>${p.got}</b></span><span>израсходовано <b>${p.used}</b></span>${diffLabel(p.got-p.used,o.status,n=>n+' шт.')}</div>
          </div>`).join('')||'<div class="opos-empty">Под этот заказ листы ещё не приходили</div>';
        const detTotal=d.detFull+d.detScrap, waste=t.usedM2-d.detFull;
        body=`<div class="obody">${rows}
          <div class="oarea">
            <div>Площадь: заказано <b>${m2fmt(t.gotM2)} м²</b> · израсходовано <b>${m2fmt(t.usedM2)} м²</b> ${diffLabel(Math.round(t.diffM2*100)/100,o.status,n=>m2fmt(n)+' м²')}</div>
            <div>Изделия: <b>${m2fmt(detTotal)} м²</b> (из листов ${m2fmt(d.detFull)} · из обрезков ${m2fmt(d.detScrap)})${d.detFull>0&&t.usedM2>0?` · в обрезки/отходы листов ≈ <b>${m2fmt(Math.max(0,waste))} м²</b>`:''}</div>
          </div>
          <div class="oactions">${o.status==='closed'?`<button class="btn bghost" onclick="reopenOrder(${idx})">↩️ Открыть снова</button>`:`<button class="btn bprim" onclick="closeOrder(${idx})">✅ Закрыть заказ</button>`}</div>
        </div>`;
      }
      html+=`<div class="ocard ${o.status==='closed'?'is-closed':''}">
        <div class="ohead" onclick="toggleOrderCard(${idx})">
          <div class="otitle"><b>${escHtml(o.no)}</b>${o.customer?` <span class="ocust">${escHtml(o.customer)}</span>`:''} ${status}</div>
          <div class="osum">листов: заказано <b>${t.got}</b> · израсходовано <b>${t.used}</b> ${diffLabel(t.diff,o.status,n=>n+' шт.')}</div>
          <span class="ochev">${open?'▲':'▼'}</span>
        </div>${body}</div>`;
    });
  });
  window.__ordKeys=keys;
  box.innerHTML=html;
}

// Поиск заказа по ключу из внешней команды (макрос CorelDRAW): точное совпадение без учёта регистра/пробелов,
// иначе — по номеру заказа, если он однозначный
function findOrderForCommand(key){
  const norm=x=>String(x||'').toLowerCase().replace(/\s+/g,' ').trim();
  const list=ordersList();
  const exact=list.find(o=>norm(o.key)===norm(key));
  if(exact) return exact;
  const no=norm(splitOrder(String(key||'')).no);
  const same=list.filter(o=>norm(o.no)===no);
  return same.length===1?same[0]:null;
}
