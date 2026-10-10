// ▸ inbox.js — приём данных из макроса CorelDRAW через облако (без открытия вкладки браузера)
// Макрос кладёт данные в строку «<код доступа>::inbox» таблицы material_data; открытое приложение раз в пару секунд
// проверяет её и подставляет данные в форму расхода. Расход не записывается — его подтверждает пользователь.
const INBOX_ON_KEY='lm7_inbox_on';      // '1' / '0' — выбор пользователя в настройках
const INBOX_SEEN_KEY='lm7_inbox_seen';  // id последнего обработанного сообщения
const INBOX_MAX_AGE=15*60*1000;         // более старые сообщения не подставляем
const CMD_SEEN_KEY='lm7_cmd_seen';      // id последней обработанной команды (например, «закрыть заказ»)
const CMD_MAX_AGE=24*60*60*1000;        // команды ждут до суток, если приложение было закрыто

// По умолчанию включено на компьютере (мышь) и выключено на телефоне — чтобы телефон не реагировал на макрос
function inboxEnabled(){
  const v=localStorage.getItem(INBOX_ON_KEY);
  if(v==='1') return true;
  if(v==='0') return false;
  return !!(window.matchMedia && matchMedia('(pointer: fine)').matches);
}
function setInbox(on){
  localStorage.setItem(INBOX_ON_KEY,on?'1':'0');
  updateInboxBtns();
  if(on) inboxPoll();
}
function updateInboxBtns(){
  const on=inboxEnabled();
  const a=document.getElementById('inbox-btn-on'), b=document.getElementById('inbox-btn-off');
  if(a) a.classList.toggle('active',on);
  if(b) b.classList.toggle('active',!on);
}

// Команды из макроса (сейчас одна: closeOrder — закрыть заказ)
function handleInboxCommand(p){
  if(!p || !p.id || localStorage.getItem(CMD_SEEN_KEY)===p.id) return;
  localStorage.setItem(CMD_SEEN_KEY,p.id);
  const age=Date.now()-new Date(p.t).getTime();
  if(isNaN(age) || age>CMD_MAX_AGE) return;
  if(p.action==='closeOrder'){
    const o=findOrderForCommand(p.order||'');
    if(!o){ toast(`⚠️ Заказ «${p.order}» не найден в приложении`,'err'); return; }
    if(o.status==='closed'){ toast(`Заказ ${o.key} уже закрыт`,'info'); return; }
    setOrderStatus(o.key,'closed');
    toast(`🔒 Заказ ${o.key} закрыт (из CorelDRAW)`,'ok');
  }
}

let inboxBusy=false;
async function inboxPoll(){
  if(inboxBusy || !inboxEnabled() || !ACCESS_CODE) return;
  if(document.visibilityState!=='visible') return;
  const acc=document.getElementById('access-screen'), sel=document.getElementById('out-pre');
  if(!acc || getComputedStyle(acc).display!=='none' || !sel || sel.options.length<2) return; // приложение ещё не готово
  inboxBusy=true;
  try{
    const idIn=sbRowId()+'::inbox', idCmd=sbRowId()+'::cmd';
    const flt='in.'+encodeURIComponent(`("${idIn}","${idCmd}")`);
    const r=await fetch(`${SB_URL}/rest/v1/material_data?id=${flt}&select=id,payload`,{headers:SB_HDR});
    if(!r.ok) return;
    const rows=await r.json();
    const rowIn=rows.find(x=>x.id===idIn), rowCmd=rows.find(x=>x.id===idCmd);
    if(rowCmd) handleInboxCommand(rowCmd.payload);
    const p=rowIn && rowIn.payload;
    if(!p || !p.id) return;
    if(localStorage.getItem(INBOX_SEEN_KEY)===p.id) return;      // уже обработано
    localStorage.setItem(INBOX_SEEN_KEY,p.id);
    const age=Date.now()-new Date(p.t).getTime();                 // t — локальное время компьютера с макросом
    if(isNaN(age) || age>INBOX_MAX_AGE) return;                   // старое сообщение — пропускаем
    fillExpenseForm({mat:p.mat||'', det:p.det||'', sheet:p.sheet||'', qty:parseInt(p.qty)||1, note:p.note||'', order:p.order||''});
    toast('📥 Данные из CorelDRAW подставлены','ok');
  }catch(e){ /* нет связи — попробуем в следующий раз */ }
  finally{ inboxBusy=false; }
}
setInterval(inboxPoll,2500);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') inboxPoll(); });
window.addEventListener('focus',inboxPoll);
updateInboxBtns();
