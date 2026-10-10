// ▸ deeplink.js — приём данных из внешних программ (макрос CorelDRAW) через ссылку вида
//   ?add=expense&mat=Акрил 3 мм (чёр.)&det=1195х1299[&sheet=1220х2440][&qty=2][&note=...]
// Открывает «Расход», раскрывает форму и заполняет поля. Ничего не записывает — расход подтверждает пользователь.

// Читаем параметры при загрузке и сразу убираем их из адресной строки (чтобы обновление страницы не повторяло вставку)
let pendingDeepLink=(function(){
  try{
    const q=new URLSearchParams(location.search);
    if(q.get('add')!=='expense') return null;
    const d={mat:(q.get('mat')||'').trim(), det:(q.get('det')||'').trim(), sheet:(q.get('sheet')||'').trim(),
             qty:parseInt(q.get('qty')||'',10), note:(q.get('note')||'').trim(), order:(q.get('order')||'').trim()};
    history.replaceState(null,'',location.pathname+location.hash);
    return d;
  }catch(e){ return null; }
})();

// Заполняет форму расхода (используется и ссылкой, и приёмом из облака): d = {mat, det, sheet, qty, note}
function fillExpenseForm(d){
  go('expense',document.getElementById('nbtn-uchet'));
  const panel=document.getElementById('add-expense');
  if(panel && !panel.classList.contains('open')) toggleAddPanel('add-expense');

  // материал
  const mat=document.getElementById('out-mat');
  mat.value=d.mat; acUpdateClear('out-mat');

  // размер листа: если передан и есть в списке — выбираем, иначе «— без листа —» (поиск обрезка)
  const sel=document.getElementById('out-pre');
  sel.value='';
  const sh=parseSizeStr(d.sheet);
  if(sh){
    const opt=[...sel.options].find(o=>{ const p=parseSizeStr(o.value); return p&&p.w===sh.w&&p.l===sh.l; });
    if(opt) sel.value=opt.value;
  }
  onSelectChange('out-pre','out-pre-custom');

  document.getElementById('out-qty').value=(d.qty>0?d.qty:1);
  document.getElementById('out-det').value=d.det;
  document.getElementById('out-note').value=d.note;
  setOrderSelect('out-order',d.order||'');   // заказ из макроса: выбираем существующий или предлагаем как новый
  parseDetSize();
}

// Вызывается из init() после первой отрисовки (и после ввода кода доступа)
function applyPendingDeepLink(){
  const d=pendingDeepLink; if(!d) return;
  pendingDeepLink=null;
  fillExpenseForm(d);
  toast('📥 Данные из CorelDRAW подставлены','ok');
}

// Страховка: ждём, пока приложение готово (код доступа введён, списки заполнены), и применяем сами —
// так работает даже если браузер подгрузил старую версию init.js без вызова applyPendingDeepLink()
(function(){
  if(!pendingDeepLink) return;
  let tries=0;
  const t=setInterval(()=>{
    tries++;
    if(!pendingDeepLink || tries>400){ clearInterval(t); return; } // ~60 секунд
    const acc=document.getElementById('access-screen');
    const sel=document.getElementById('out-pre');
    const ready=typeof go==='function' && acc && getComputedStyle(acc).display==='none' && sel && sel.options.length>1;
    if(ready){ clearInterval(t); applyPendingDeepLink(); }
  },150);
})();
