window.__B=window.__B||{};__B['managers']='2026-10-13a';
// ▸ managers.js — Менеджеры: номер (первая цифра номера заказа, например 9-10-53 → 9) → имя. Список 1–10 в «Настройках».
// Синхронизируется между устройствами: у каждого менеджера своя отметка времени, побеждает более поздняя правка.
let managers={};      // {"9":{n:"Иван",ts:1760000000000}}
try{ managers=JSON.parse(localStorage.getItem('lm7_managers')||'{}')||{}; }catch(e){ managers={}; }
function persistManagers(){ try{ localStorage.setItem('lm7_managers',JSON.stringify(managers)); }catch(e){} }
function managerName(no){
  const k=String(parseInt(no,10)); if(!no||k==='NaN') return '';
  const m=managers[k]; return (m&&m.n)?m.n:'';
}
// Имя менеджера без цифры («Иван»); если имя не задано — просто номер («9»)
function managerLabel(no){ if(no===''||no==null) return '—'; const n=managerName(no); return n?n:String(no); }
function setManager(k,name){
  managers[String(k)]={n:String(name||'').trim(),ts:Date.now()};
  persistManagers(); save();
  if(typeof renderOut==='function') renderOut();
  if(typeof renderStats==='function'&&document.getElementById('sec-stats')?.classList.contains('active')) renderStats();
}
function mergeManagers(p){
  const c=(p&&p.managers)||{}; let ch=false;
  Object.keys(c).forEach(k=>{ if(!managers[k]||(c[k].ts||0)>(managers[k].ts||0)){ managers[k]=c[k]; ch=true; } });
  if(ch){ persistManagers(); renderManagersCard(); }
}
function renderManagersCard(){
  const box=document.getElementById('mgr-list'); if(!box) return;
  // не затираем поле, в котором сейчас печатают
  const act=document.activeElement&&document.activeElement.id;
  let h='';
  for(let i=1;i<=10;i++){
    const m=managers[String(i)];
    h+=`<div class="mgr-row"><span class="mgr-n">${i}</span><input type="text" id="mgr-${i}" placeholder="Имя менеджера" value="${escHtml(m&&m.n?m.n:'')}" onchange="setManager(${i},this.value)"></div>`;
  }
  if(!box.dataset.ready||act&&!/^mgr-/.test(act)||!act){ box.innerHTML=h; box.dataset.ready='1'; }
}
window.addEventListener('load',renderManagersCard);
