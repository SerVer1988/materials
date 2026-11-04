window.__B=window.__B||{};__B['orderfile']='2026-10-13a';
// ▸ orderfile.js — кнопка 📂 «открыть файл заказа в CorelDRAW».
//   Макрос присылает полный путь к .cdr вместе с заявкой / расходом; приложение запоминает его по заказу (и синхронизирует).
//   Кнопка открывает ссылку corelopen://open/<путь в base64url>; на компьютере её ловит маленькая программа из папки tools/CorelOpen
//   (Install.cmd, один раз) и открывает файл. Показывается только на компьютере (мышь); на телефоне кнопки нет.
let orderPaths={};      // {ключ заказа: [путь, время]}
try{ orderPaths=JSON.parse(localStorage.getItem('lm7_order_paths')||'{}')||{}; }catch(e){ orderPaths={}; }
function persistOrderPaths(){ try{ localStorage.setItem('lm7_order_paths',JSON.stringify(orderPaths)); }catch(e){} }
function mergeOrderPaths(p){
  const c=(p&&p.orderPaths)||{}; let ch=false;
  Object.keys(c).forEach(k=>{ if(!orderPaths[k]||(c[k][1]||0)>(orderPaths[k][1]||0)){ orderPaths[k]=c[k]; ch=true; } });
  if(ch) persistOrderPaths();
}
const validCdrPath=p=>typeof p==='string'&&p.length<500&&/\.cdr$/i.test(p.trim())&&/^([A-Za-z]:\\|\\\\)/.test(p.trim());
function setOrderPath(key,path){
  key=String(key||'').trim(); path=String(path||'').trim();
  if(!key||!validCdrPath(path)) return;
  if(orderPaths[key]&&orderPaths[key][0]===path) return;
  orderPaths[key]=[path,Date.now()]; persistOrderPaths();
  toast('📂 Путь к файлу заказа получен','ok');
  try{ save(); }catch(e){}
  if(typeof renderPlan==='function') renderPlan();
  if(typeof renderOrders==='function') renderOrders();
}
function orderPathFor(key){
  const e=orderPaths[key]; if(e&&e[0]) return e[0];
  const no=splitOrder(String(key||'')).no.toLowerCase();                    // короткий ключ заказа: ищем по номеру, если он один
  const same=Object.keys(orderPaths).filter(k=>orderPaths[k]&&orderPaths[k][0]&&splitOrder(k).no.toLowerCase()===no);
  return same.length===1?orderPaths[same[0]][0]:'';
}
function orderFileBtnOn(){
  const v=localStorage.getItem('lm7_file_btn');           // '1' / '0' — ручной выбор (необязательно)
  if(v==='1') return true; if(v==='0') return false;
  return !!(window.matchMedia&&matchMedia('(pointer: fine)').matches);
}
const OF_ICON='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v1H3V7Z"/><path d="M3 10h19l-2 8a2 2 0 0 1-2 1.5H5a2 2 0 0 1-2-2V10Z"/></svg>';
function orderFileBtn(key){
  if(!orderFileBtnOn()) return '';
  const known=!!orderPathFor(key);       // путь неизвестен — значок бледный: нажмите, и приложение подскажет, что сделать
  return `<span class="of-btn${known?'':' dim'}" role="button" aria-label="Открыть файл заказа" data-o="${escHtml(key)}" title="${known?'Открыть файл заказа в CorelDRAW':'Путь к файлу пока неизвестен'}" onclick="openOrderFile(this,event)">${OF_ICON}</span>`;
}
function b64u(s){
  const bytes=new TextEncoder().encode(s); let bin=''; bytes.forEach(b=>bin+=String.fromCharCode(b));
  return btoa(bin).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function openOrderFile(el,ev){
  if(ev) ev.stopPropagation();
  const path=orderPathFor(el.dataset.o);
  if(!path){ toast('Путь к файлу ещё не получен: откройте файл в CorelDRAW и запустите макрос «ОткрытьЗаказ» (приложение должно быть открыто на компьютере)','info'); return; }
  const a=document.createElement('a'); a.href='corelopen://open/'+b64u(path); a.style.display='none';
  document.body.appendChild(a); a.click(); a.remove();
  toast('📂 Открываю в CorelDRAW…','info');
}
