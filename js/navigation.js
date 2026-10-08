// ▸ navigation.js — Навигация: свайпы, вкладки, плюс-кнопка, панели; свайп внутри склада
// ══════════════════════════════════════ SWIPE NAVIGATION
(function(){
  const NAV_ORDER=['income','expense','stock','more'];
  let tX=0,tY=0,tT=0,swipeLocked=false;
  function currentIdx(){
    const active=document.querySelector('.sec.active');
    if(!active) return 0;
    const id=active.id.replace('sec-','');
    return Math.max(0,NAV_ORDER.indexOf(id));
  }
  function goIdx(i){
    if(i<0||i>=NAV_ORDER.length) return;
    const name=NAV_ORDER[i];
    const btn=document.querySelector(`.nbtn:nth-child(${i+1})`);
    if(btn) go(name,btn);
  }
  document.addEventListener('touchstart',e=>{
    // Не свайпаем если касание внутри скроллируемого элемента с горизонтальным скроллом
    const t=e.touches[0];
    tX=t.clientX; tY=t.clientY; tT=Date.now(); swipeLocked=false;
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(swipeLocked) return;
    const t=e.touches[0];
    const dx=t.clientX-tX, dy=t.clientY-tY;
    // Если вертикальное движение преобладает — это скролл, блокируем свайп
    if(Math.abs(dy)>Math.abs(dx)*1.2) swipeLocked=true;
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(swipeLocked) return;
    // Не реагируем на свайп внутри открытой модалки
    if(document.querySelector('.overlay.show')) return;
    const t=e.changedTouches[0];
    const dx=t.clientX-tX, dy=t.clientY-tY;
    const dt=Date.now()-tT;
    // Минимум 60px по горизонтали, время < 400ms, горизонталь преобладает
    if(dt>400||Math.abs(dx)<60||Math.abs(dy)>Math.abs(dx)*0.8) return;
    const idx=currentIdx();
    if(dx<0) goIdx(idx+1); // влево → следующий
    else      goIdx(idx-1); // вправо → предыдущий
  },{passive:true});
})();


// ── НОВАЯ НАВИГАЦИЯ ──
const TAB_NAMES = {income:'ПРИХОД', expense:'РАСХОД', stock:'ЛИСТЫ', more:'НАСТРОЙКИ'};

function setHdrTabName(name){
  const PILL_NAMES = {income:'ПРИХОД', expense:'РАСХОД', stock:'ЛИСТЫ', more:'НАСТРОЙКИ'};
  const PILL_ICONS = {income:'📥', expense:'📤', stock:'📄', more:'⚙️'};
  const el = document.getElementById('hdr-pill-text');
  if(el) el.textContent = PILL_NAMES[name] || name.toUpperCase();
  const ic = document.getElementById('hdr-pill-icon');
  if(ic) ic.textContent = PILL_ICONS[name] || '📄';
}

// Учёт — переключаемся на income или expense (запоминаем последний)
let lastUchetTab = 'income';
function goUchet(btn){
  // Если уже на учёте — не переключаем
  if(document.getElementById('sec-income').classList.contains('active') ||
     document.getElementById('sec-expense').classList.contains('active')) return;
  go(lastUchetTab, btn);
}

// Ещё — открывается как оверлей/секция, но кнопка в шапке
function goMore(btn){
  const isActive = document.getElementById('sec-more').classList.contains('active');
  if(isActive){
    // Возвращаемся на предыдущую вкладку
    const prevBtn = document.querySelector('.nbtn.active') || document.getElementById('nbtn-uchet');
    go(lastUchetTab, document.getElementById('nbtn-uchet'));
    document.getElementById('hdr-more-btn')?.classList.remove('active');
  } else {
    document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.nbtn').forEach(b=>b.classList.remove('active'));
    document.getElementById('sec-more').classList.add('active');
    document.getElementById('hdr-more-btn')?.classList.add('active');
    setHdrTabName('more');
    renderHist();['mats','sizes','places'].forEach(k=>renderListEditor(k));
  }
}

// Кнопка + по центру
function navPlusClick(){
  // Определяем контекст
  const onIncome = document.getElementById('sec-income').classList.contains('active');
  const onExpense = document.getElementById('sec-expense').classList.contains('active');
  const onStock = document.getElementById('sec-stock').classList.contains('active');
  if(onIncome){ toggleAddPanel('add-income'); return; }
  if(onExpense){ toggleAddPanel('add-expense'); return; }
  if(onStock && stockTab==='rem'){ toggleAddPanel('add-rem'); return; }
  // Склад/Листы — серый, ничего не делаем
}

// toggleHdrSearch убрана — поиск теперь в строке секции

function go(name,btn){
  document.querySelectorAll('.sec').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nbtn').forEach(b=>b.classList.remove('active'));
  document.getElementById('hdr-more-btn')?.classList.remove('active');
  document.getElementById(`sec-${name}`).classList.add('active');
  // Подсвечиваем нужную кнопку в навбаре
  if(name==='income'||name==='expense'){
    document.getElementById('nbtn-uchet')?.classList.add('active');
    lastUchetTab = name;
  } else if(name==='stock'){
    document.getElementById('nbtn-stock')?.classList.add('active');
  } else if(btn) {
    btn.classList.add('active');
  }
  setHdrTabName(name);
  // scroll list area to top
  const body=document.querySelector(`#sec-${name} .sec-body`);
  if(body) body.scrollTop=0;
  // Показываем нужную FAB
  ['income','expense','rem'].forEach(id=>{
    const fab=document.getElementById(`fab-${id}`);
    if(fab) fab.classList.remove('visible');
  });
  // FAB в навбаре — кнопка + меняет внешний вид по контексту
  updatePlusBtn(name);
  if(name==='stock'){renderStock();renderRemByMat();}
  if(name==='more'){renderHist();['mats','sizes','places'].forEach(k=>renderListEditor(k));}
}

function updatePlusBtn(name){
  const plusWrap = document.querySelector('#nbtn-plus .ni-wrap');
  if(!plusWrap) return;
  name = name || (document.getElementById('sec-income').classList.contains('active')?'income':
                  document.getElementById('sec-expense').classList.contains('active')?'expense':'stock');
  // Цвет circle в SVG плюса
  const circle = plusWrap.querySelector('path[fill="red"],path[fill="#22c55e"],path[fill="#EFCA46"],path[fill="#888"]');
  const isStockBalance = name==='stock' && stockTab==='balance';
  // Меняем все colored path в plus SVG
  const svg = plusWrap.querySelector('svg');
  if(!svg) return;
  const paths = svg.querySelectorAll('path');
  // path[1] = внешняя тень, path[2] = белый highlight, path[3] = цветной круг, path[4] polygon = крест
  // Ищем третий path (цветной)
  if(paths.length >= 3){
    const f=paths[2].style;
    if(name==='income')      f.fill='var(--plus-income)';
    else if(name==='expense') f.fill='var(--plus-expense)';
    else if(name==='stock' && stockTab==='rem') f.fill='var(--plus-rem)';
    else f.fill='var(--plus-off)';
  }
  plusWrap.style.opacity = isStockBalance ? '0.45' : '1';
  plusWrap.style.pointerEvents = isStockBalance ? 'none' : '';
}
function toggleCard(id){ document.getElementById(id).classList.toggle('open'); }
// ── Add panel toggle ──
function toggleAddPanel(id){
  const panel=document.getElementById(id);
  if(!panel) return;
  const isOpen=panel.classList.toggle('open');
  if(isOpen){
    if(id==='add-income'){
      // Подставить последний материал если поле пустое
      const matInp=document.getElementById('in-mat');
      if(matInp && !matInp.value && lastInMat){
        matInp.value=lastInMat;
        acUpdateClear('in-mat');
      }
      // Фокус на поле размера (select)
      setTimeout(()=>document.getElementById('in-pre')?.focus(),350);
    } else if(id==='add-expense'){
      // Подставить последний материал если поле пустое
      const matInp=document.getElementById('out-mat');
      if(matInp && !matInp.value && lastOutMat){
        matInp.value=lastOutMat;
        acUpdateClear('out-mat');
      }
      // Обновляем кнопку под текущее состояние
      parseDetSize();
      // Фокус на поле размера изделия
      setTimeout(()=>document.getElementById('out-det')?.focus(),350);
    } else if(id==='add-rem'){
      // Подставить последний материал если поле пустое
      const matInp=document.getElementById('rem-mat');
      if(matInp && !matInp.value && lastRemMat){
        matInp.value=lastRemMat;
        acUpdateClear('rem-mat');
      }
      // Фокус на поле размера
      setTimeout(()=>document.getElementById('rem-size')?.focus(),350);
    } else {
      const first=panel.querySelector('input[type=text],input[type=number]');
      if(first) setTimeout(()=>first.focus(),350);
    }
  }
}

// Свайп внутри склада: Листы ↔ Обрезки
(function(){
  const stockEl = document.getElementById('sec-stock');
  if(!stockEl) return;
  let sx=0, sy=0, st=0, sl=false;
  stockEl.addEventListener('touchstart', e=>{
    sx=e.touches[0].clientX; sy=e.touches[0].clientY; st=Date.now(); sl=false;
  },{passive:true});
  stockEl.addEventListener('touchmove', e=>{
    if(sl) return;
    const dx=e.touches[0].clientX-sx, dy=e.touches[0].clientY-sy;
    if(Math.abs(dy)>Math.abs(dx)*1.2) sl=true;
  },{passive:true});
  stockEl.addEventListener('touchend', e=>{
    if(sl) return;
    const dx=e.changedTouches[0].clientX-sx, dy=e.changedTouches[0].clientY-sy;
    const dt=Date.now()-st;
    if(dt>400||Math.abs(dx)<60||Math.abs(dy)>Math.abs(dx)*0.8) return;
    const tabs=document.querySelectorAll('#sec-stock .itab');
    const activeIdx=[...tabs].findIndex(b=>b.classList.contains('active'));
    if(dx<0 && activeIdx<tabs.length-1) tabs[activeIdx+1].click();
    else if(dx>0 && activeIdx>0) tabs[activeIdx-1].click();
  },{passive:true});
})();
