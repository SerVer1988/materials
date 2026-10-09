// ▸ deeplink.js — приём данных из внешних программ (макрос CorelDRAW) через ссылку вида
//   ?add=expense&mat=Акрил 3 мм (чёр.)&det=1195х1299[&sheet=1220х2440][&qty=2][&note=...]
// Открывает «Расход», раскрывает форму и заполняет поля. Ничего не записывает — расход подтверждает пользователь.

// Читаем параметры при загрузке и сразу убираем их из адресной строки (чтобы обновление страницы не повторяло вставку)
let pendingDeepLink=(function(){
  try{
    const q=new URLSearchParams(location.search);
    if(q.get('add')!=='expense') return null;
    const d={mat:(q.get('mat')||'').trim(), det:(q.get('det')||'').trim(), sheet:(q.get('sheet')||'').trim(),
             qty:parseInt(q.get('qty')||'',10), note:(q.get('note')||'').trim()};
    history.replaceState(null,'',location.pathname+location.hash);
    return d;
  }catch(e){ return null; }
})();

// Вызывается из init() после первой отрисовки (и после ввода кода доступа)
function applyPendingDeepLink(){
  const d=pendingDeepLink; if(!d) return;
  pendingDeepLink=null;

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
  parseDetSize();

  toast('📥 Данные из CorelDRAW подставлены','ok');
}
