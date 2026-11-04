window.__B=window.__B||{};__B['notify']='2026-10-13a';
// ▸ notify.js — КОЛОКОЛЬЧИК: что изменили на других устройствах этого аккаунта.
//   При каждом слиянии с облаком (sync.js → mergePayload) сравниваем, какие записи пришли новые или исправленные чужой правкой:
//   приход, расход, обрезки, план заказа, статус заказа, удаления. Свои правки не считаются. Журнал хранится на этом устройстве.
//   Колокольчик в шапке появляется, когда в журнале есть записи; число — непрочитанные. Нажатие на запись открывает её и подсвечивает.
const NOTIF_KEY='lm7_notif', NOTIF_BASE='lm7_notif_base', NOTIF_MAX=100;
let notifs=[]; try{ notifs=JSON.parse(localStorage.getItem(NOTIF_KEY)||'[]')||[]; }catch(e){ notifs=[]; }
function persistNotifs(){ try{ localStorage.setItem(NOTIF_KEY,JSON.stringify(notifs.slice(0,NOTIF_MAX))); }catch(e){} }

// Как называть это устройство в журнале (пишется в каждую правку как _by)
function deviceLabel(){
  let d=localStorage.getItem('lm7_device'); if(d) return d;
  const ua=navigator.userAgent||'', touch=(navigator.maxTouchPoints||0)>1;
  let k='Компьютер';
  if(/iPad|Tablet/i.test(ua)||(/Android/i.test(ua)&&!/Mobile/i.test(ua))||(/Macintosh/.test(ua)&&touch)) k='Планшет';
  else if(/Mobile|iPhone|Android/i.test(ua)) k='Телефон';
  try{ localStorage.setItem('lm7_device',k); }catch(e){}
  return k;
}

// ── Слияние: снимок до и разбор после ──
function notifyBegin(){
  const before={}; REC_TABLES.forEach(t=>{ before[t]=new Map((db[t]||[]).map(r=>[r.id,r])); });
  return {t0:Date.now(), before, delBefore:new Set(deletedIds)};
}
function notifyEnd(nb){
  try{
    let base=+localStorage.getItem(NOTIF_BASE)||0;
    if(!base) base=nb.t0;                                           // первый запуск: старое не считаем новостями
    const items=[];
    REC_TABLES.forEach(t=>(db[t]||[]).forEach(r=>{
      const bef=nb.before[t].get(r.id);
      if(bef===r) return;                                          // осталась наша запись
      if(bef&&recHash(bef)===recHash(r)) return;                   // содержимое то же
      const kind=bef?'edit':'add', ts=r._u||(kind==='add'?r.id:0);
      if(!(ts>base)) return;                                       // пришло старое, к нам оно попало впервые
      items.push({t,r,kind,ts});
    }));
    deletedIds.forEach(id=>{
      if(nb.delBefore.has(id)) return;
      REC_TABLES.forEach(t=>{ const r=nb.before[t].get(id); if(r) items.push({t,r,kind:'del',ts:Date.now()}); });
    });
    const made=buildNotifs(items);
    if(made.length){
      const have=new Set(notifs.map(n=>n.k)); const fresh=made.filter(n=>!have.has(n.k));
      if(fresh.length){
        notifs=fresh.concat(notifs).slice(0,NOTIF_MAX); persistNotifs(); updateBell(true);
        if(document.visibilityState==='visible') toast(`🔔 На другом устройстве: ${fresh.length===1?fresh[0].text:fresh.length+' изменений'}`,'info');
      }
    }
    notifTouchBase(nb.t0);                                           // отсчёт сдвигается вперёд (с запасом на расхождение часов)
  }catch(e){ console.warn('notify error',e); }
}

const nOrdNo=o=>splitOrder(String(o||'')).no;
function recDescr(t,r){
  if(t==='income') return `Приход: ${r.mat} ${r.size||''} — ${r.qty} шт.${r.place?' ('+r.place+')':''}${r.order?' · заказ '+nOrdNo(r.order):''}`;
  if(t==='expense') return `Расход: ${r.mat}${r.size&&r.size!=='—'?' '+r.size:''}${r.etype==='merge'?' (объединённый рез)':' — '+(r.qty||0)+' шт.'}${r.order?' · заказ '+nOrdNo(r.order):''}`;
  if(t==='remainders') return `Обрезки: ${r.mat}`;
  if(t==='orders') return `Заказ ${nOrdNo(r.key)}: ${r.status==='closed'?'закрыт':'открыт'}`;
  return `План ${nOrdNo(r.order)}: ${r.mat}`;
}
const KIND_TXT={add:'добавлено',edit:'исправлено',del:'удалено'};
function buildNotifs(items){
  const out=[], ts0=Date.now();
  const mk=(o)=>Object.assign({ts:ts0,seen:false},o);
  const by=r=>r._by||'другое устройство';
  // заказы: интересен только статус (создание заказа — побочный эффект)
  items.filter(i=>i.t==='orders'&&i.kind==='edit').forEach(i=>out.push(mk({k:`orders:${i.r.id}:${i.ts}`,ts:i.ts,kind:'edit',t:'orders',order:i.r.key,by:by(i.r),text:recDescr('orders',i.r)})));
  // план: одна запись на заказ и вид правки
  const pl=new Map();
  items.filter(i=>i.t==='plan').forEach(i=>{ const k=i.kind+'|'+i.r.order; if(!pl.has(k)) pl.set(k,[]); pl.get(k).push(i); });
  pl.forEach(arr=>{
    const f=arr[0], mats=[...new Set(arr.map(i=>i.r.mat))];
    const text=arr.length===1||mats.length===1&&arr.length<=2?`План ${nOrdNo(f.r.order)}: ${mats.join(', ')} — ${KIND_TXT[f.kind]}`:`План ${nOrdNo(f.r.order)}: ${KIND_TXT[f.kind]} строк — ${arr.length}`;
    out.push(mk({k:`plan:${f.kind}:${f.r.order}:${Math.max(...arr.map(i=>i.ts))}`,ts:Math.max(...arr.map(i=>i.ts)),kind:f.kind,t:'plan',order:f.r.order,mat:mats.length===1?mats[0]:'',by:by(f.r),text}));
  });
  // приход / расход / обрезки: по записи, а если сразу много — одной строкой
  ['income','expense','remainders'].forEach(t=>['add','edit','del'].forEach(kind=>{
    const arr=items.filter(i=>i.t===t&&i.kind===kind); if(!arr.length) return;
    if(arr.length>6){
      const label={income:'Приход',expense:'Расход',remainders:'Обрезки'}[t];
      const last=arr[arr.length-1];
      out.push(mk({k:`${t}:${kind}:grp:${Math.max(...arr.map(i=>i.ts))}:${arr.length}`,ts:Math.max(...arr.map(i=>i.ts)),kind,t,rid:kind==='del'?null:last.r.id,mat:last.r.mat||'',by:by(last.r),text:`${label}: ${KIND_TXT[kind]} записей — ${arr.length}`}));
    } else arr.forEach(i=>out.push(mk({k:`${t}:${i.r.id}:${i.ts}:${kind}`,ts:i.ts,kind,t,rid:kind==='del'?null:i.r.id,mat:i.r.mat||'',by:by(i.r),text:`${recDescr(t,i.r)} — ${KIND_TXT[kind]}`})));
  }));
  return out.sort((a,b)=>b.ts-a.ts);
}

// ── Колокольчик ──
function updateBell(ring){
  const b=document.getElementById('bell-btn'); if(!b) return;
  const unseen=notifs.filter(n=>!n.seen).length;
  b.style.display=notifs.length?'flex':'none';
  const bd=document.getElementById('bell-badge'); if(bd){ bd.textContent=unseen>99?'99+':unseen; bd.style.display=unseen?'flex':'none'; }
  b.classList.toggle('has-new',unseen>0);
  if(ring&&unseen){ b.classList.remove('ring'); void b.offsetWidth; b.classList.add('ring'); }
}
function agoText(ts){
  const m=Math.round((Date.now()-ts)/60000);
  if(m<1) return 'только что'; if(m<60) return m+' мин назад';
  const h=Math.round(m/60); if(h<24) return h+' ч назад';
  const d=new Date(ts); return d.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})+' '+d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
}
const NT_ICON={add:'➕',edit:'✏️',del:'🗑️'};
function closeNotifs(){ document.getElementById('notif-pop')?.remove(); }
function openNotifs(){
  closeNotifs();
  const wasUnseen=new Set(notifs.filter(n=>!n.seen).map(n=>n.k));
  const d=document.createElement('div'); d.id='notif-pop'; d.className='cols-pop'; d.onclick=closeNotifs;
  const rows=notifs.map((n,i)=>`<div class="nt-item${wasUnseen.has(n.k)?' unseen':''}" onclick="openNotif(${i})"><span class="nt-ic">${NT_ICON[n.kind]||'•'}</span><div class="nt-body"><div class="nt-text">${escHtml(n.text)}</div><div class="nt-meta">${escHtml(n.by||'')} · ${agoText(n.ts)}</div></div></div>`).join('');
  d.innerHTML=`<div class="cols-card nt-card" onclick="event.stopPropagation()"><div class="ctitle">🔔 Изменения на других устройствах</div>
    <div class="nt-list">${rows||'<div class="stk-empty">Пока ничего нет</div>'}</div>
    <div class="brow" style="margin-top:10px;gap:6px"><button class="btn bghost bsm" onclick="clearNotifs()">Очистить</button><button class="btn bprim bsm" onclick="closeNotifs()">Закрыть</button></div></div>`;
  document.body.appendChild(d);
  notifs.forEach(n=>n.seen=true); persistNotifs(); updateBell();      // открыли список — всё прочитано
}
function clearNotifs(){ notifs=[]; persistNotifs(); closeNotifs(); updateBell(); }

// ── Переход к правке ──
function notifFlashRow(sel,fallback){
  setTimeout(()=>{ const el=document.querySelector(sel)||(fallback&&document.querySelector(fallback)); if(el) flashEl(el); else toast('Запись не видна в списке: возможно, она старше последних 60','info'); },300);
}
function openNotif(i){
  const n=notifs[i]; if(!n) return;
  closeNotifs();
  const uchet=document.getElementById('nbtn-uchet');
  if(n.t==='plan'||n.t==='orders'){
    if(n.kind==='del'||!focusOrder(n.order,n.mat)) toast('Заказ не найден в приложении','err');
    return;
  }
  if(n.t==='income'||n.t==='expense'){
    const inc=n.t==='income';
    go(n.t,uchet);
    const s=document.getElementById(inc?'in-s':'out-s'); if(s) s.value='';
    if(inc){ inPlaceFilter=''; renderIn(); } else { outFilter=''; renderOut(); }
    if(n.kind==='del'||n.rid==null){ toast(n.kind==='del'?'Запись удалена на другом устройстве':'Открыт раздел','info'); return; }
    notifFlashRow(`#${inc?'in':'out'}-tbody tr[data-rid="${n.rid}"]`);
    return;
  }
  if(n.t==='remainders'){
    go('stock',document.getElementById('nbtn-stock'));
    setStockTab(document.querySelectorAll('#sec-stock .itab')[1],'rem');
    if(n.mat) remOpenGroups.add(n.mat);
    renderRemByMat();
    if(n.kind==='del'||n.rid==null){ toast(n.kind==='del'?'Запись удалена на другом устройстве':'Открыт раздел','info'); return; }
    notifFlashRow(`#sec-stock .piece-row[data-recid="${n.rid}"]`,n.mat?`#sec-stock .remcard[data-mat="${String(n.mat).replace(/"/g,'\\"')}"]`:null);
  }
}
// Отсчёт «что новое»: при первом запуске — с этого момента; после каждой успешной синхронизации — с её начала (с запасом на часы)
function notifTouchBase(t0){
  try{ const cur=+localStorage.getItem(NOTIF_BASE)||0; const nb=t0-20000; if(nb>cur) localStorage.setItem(NOTIF_BASE,String(nb)); }catch(e){}
}
if(!localStorage.getItem(NOTIF_BASE)){ try{ localStorage.setItem(NOTIF_BASE,String(Date.now())); }catch(e){} }   // первый запуск: всё, что было до этого, — не новости
document.addEventListener('DOMContentLoaded',()=>updateBell());
setTimeout(()=>updateBell(),0);
