// ▸ navigation.js — Навигация: свайпы между страницами, вкладки, плюс-кнопка, панели
// ══════════════════════════════════════ SWIPE NAVIGATION
// Порядок страниц: Приход → Расход → Листы → Обрезки → Заказы → Настройки (свайп в другую сторону — в обратном порядке)
(function(){
  function pageIdx(){
    const active=document.querySelector('.sec.active');
    if(!active) return 0;
    const id=active.id.replace('sec-','');
    if(id==='income') return 0;
    if(id==='expense') return 1;
    if(id==='stock') return (typeof stockTab!=='undefined' && stockTab==='rem') ? 3 : 2;
    if(id==='orders') return 4;
    if(id==='more') return 5;
    return 0;
  }
  function goPage(i){
    if(i<0||i>5||i===pageIdx()) return;
    const uchetBtn=document.getElementById('nbtn-uchet');
    const stockBtn=document.getElementById('nbtn-stock');
    if(i===0) go('income',uchetBtn);
    else if(i===1) go('expense',uchetBtn);
    else if(i===2||i===3){
      const inStock=document.getElementById('sec-stock').classList.contains('active');
      if(!inStock) go('stock',stockBtn);
      const tabs=document.querySelectorAll('#sec-stock .itab');
      setStockTab(tabs[i===2?0:1], i===2?'balance':'rem');
    }
    else if(i===4) go('orders',document.getElementById('nbtn-orders'));
    else if(i===5) goMore(document.getElementById('hdr-more-btn'));
  }
  // касание внутри горизонтально прокручиваемого блока — это его скролл, а не смена страницы
  function inHScroll(el){
    for(; el && el!==document.body; el=el.parentElement){
      if(el.scrollWidth>el.clientWidth+2){
        const ox=getComputedStyle(el).overflowX;
        if(ox==='auto'||ox==='scroll') return true;
      }
    }
    return false;
  }
  let tX=0,tY=0,tT=0,swipeLocked=false;
  document.addEventListener('touchstart',e=>{
    const t=e.touches[0];
    tX=t.clientX; tY=t.clientY; tT=Date.now();
    swipeLocked=inHScroll(e.target);
  },{passive:true});
  document.addEventListener('touchmove',e=>{
    if(swipeLocked) return;
    const t=e.touches[0];
    const dx=t.clientX-tX, dy=t.clientY-tY;
    if(Math.abs(dy)>Math.abs(dx)*1.2) swipeLocked=true; // вертикальный скролл
  },{passive:true});
  document.addEventListener('touchend',e=>{
    if(swipeLocked) return;
    if(document.querySelector('.overlay.show')) return; // не листаем под открытой модалкой
    const t=e.changedTouches[0];
    const dx=t.clientX-tX, dy=t.clientY-tY;
    if(Date.now()-tT>400||Math.abs(dx)<60||Math.abs(dy)>Math.abs(dx)*0.8) return;
    const idx=pageIdx();
    goPage(dx<0 ? idx+1 : idx-1); // влево → следующая, вправо → предыдущая
  },{passive:true});
})();


// ── НОВАЯ НАВИГАЦИЯ ──
const TAB_NAMES = {income:'ПРИХОД', expense:'РАСХОД', stock:'ЛИСТЫ', more:'НАСТРОЙКИ'};

const PILL_ICONS = {
  orders:'<svg class="pi pi-orders" viewBox="0 0 7 7"><circle class="b" cx="3.5" cy="3.5" r="3.4"/><g class="g2" fill="none" stroke-width=".36" stroke-linecap="round" stroke-linejoin="round"><rect x="1.95" y="1.5" width="3.1" height="4" rx=".45"/><path d="M2.85 1.5V1.2h1.3v.3M2.8 3h1.4M2.8 3.9h1.4M2.8 4.7h.9"/></g></svg>',
  uchet:'<svg class="pi pi-uchet" viewBox="0 0 7.11 7.12" style="fill-rule:evenodd"><circle class="g" cx="3.555" cy="3.56" r="3.05"/><path class="b" d="M3.46 0c-0.68,0 -1.46,0.26 -2,0.67 -0.34,0.25 -0.61,0.52 -0.85,0.88 -0.62,0.93 -0.79,2.06 -0.42,3.13 0.16,0.47 0.51,1.04 0.88,1.37 0.04,0.03 0.08,0.06 0.11,0.09 0.04,0.04 0.08,0.08 0.14,0.12 0.69,0.53 1.38,0.79 2.26,0.79 0.49,0 0.94,-0.13 1.4,-0.32 0.37,-0.15 0.76,-0.45 1.04,-0.72 1.21,-1.21 1.35,-3.1 0.38,-4.5 -0.68,-0.97 -1.75,-1.5 -2.93,-1.5zm1.4 1.59l-2.7 0c-0.21,0 -0.39,0.17 -0.39,0.39l0 3.08c0,0.21 0.17,0.39 0.39,0.39l2.7 0c0.21,0 0.39,-0.17 0.39,-0.39l0 -3.08c0,-0.21 -0.17,-0.39 -0.39,-0.39zm-2.31 3.47l-0.39 0 0 -0.39 0.39 0 0 0.39zm0 -0.77l-0.39 0 0 -0.39 0.39 0 0 0.39zm0 -0.77l-0.39 0 0 -0.39 0.39 0 0 0.39zm0.77 1.54l-0.39 0 0 -0.39 0.39 0 0 0.39zm0 -0.77l-0.39 0 0 -0.39 0.39 0 0 0.39zm0 -0.77l-0.39 0 0 -0.39 0.39 0 0 0.39zm0.77 1.54l-0.39 0 0 -0.39 0.39 0 0 0.39zm0 -0.77l-0.39 0 0 -0.39 0.39 0 0 0.39zm0 -0.77l-0.39 0 0 -0.39 0.39 0 0 0.39zm0.77 1.54l-0.39 0 0 -1.16 0.39 0 0 1.16zm0 -1.54l-0.39 0 0 -0.39 0.39 0 0 0.39zm0 -0.77l-2.7 0 0 -0.77 2.7 0 0 0.77z"/></svg>',
  stock:'<svg class="pi pi-stock" viewBox="0 0 6.9 6.9" style="fill-rule:evenodd"><circle class="g" cx="3.45" cy="3.45" r="2.95"/><path class="b" d="M3.5 0c0.67,0 1.43,0.25 1.96,0.65 0.33,0.25 0.6,0.51 0.83,0.86 0.61,0.92 0.77,2.02 0.41,3.07 -0.16,0.46 -0.5,1.02 -0.86,1.35 -0.04,0.03 -0.07,0.06 -0.1,0.08 -0.04,0.04 -0.08,0.08 -0.13,0.12 -0.67,0.52 -1.36,0.77 -2.21,0.77 -0.48,0 -0.93,-0.13 -1.37,-0.31 -0.36,-0.15 -0.75,-0.44 -1.02,-0.71 -1.19,-1.19 -1.33,-3.04 -0.37,-4.41 0.66,-0.96 1.72,-1.47 2.87,-1.47zm-1.22 5.3l2.33 0 0 -1.75 -2.33 0 0 1.75zm-0.87 -2.64l0 2.51c0,0.06 0.07,0.13 0.13,0.13l0.46 0 0 -1.87c0,-0.05 0.02,-0.1 0.04,-0.13 0.03,-0.03 0.07,-0.04 0.13,-0.04l2.57 0c0.11,0 0.17,0.06 0.17,0.17l0 1.87 0.45 0c0.06,0 0.13,-0.07 0.13,-0.13l0 -2.51c0,-0.09 -0.24,-0.23 -0.35,-0.3l-1.15 -0.8c-0.07,-0.05 -0.47,-0.34 -0.52,-0.34 -0.08,0 -0.09,0.02 -0.17,0.07 -0.04,0.03 -0.09,0.06 -0.13,0.09 -0.08,0.06 -0.17,0.12 -0.26,0.18l-1.4 0.97c-0.04,0.03 -0.09,0.07 -0.09,0.12zm1.89 -0.29c0,0.22 0.29,0.22 0.29,0 0,-0.07 -0.06,-0.13 -0.16,-0.13 -0.06,0 -0.13,0.07 -0.13,0.13zm-0.29 0.02c0,-0.44 0.61,-0.63 0.83,-0.18 0.05,0.11 0.05,0.24 0,0.35 -0.22,0.44 -0.83,0.26 -0.83,-0.18zm-0.26 2.18l1.4 0c0.23,0 0.23,0.29 0,0.29l-1.42 0c-0.19,0 -0.22,-0.29 0.02,-0.29zm0 -0.58l1.4 0c0.23,0 0.23,0.29 0,0.29l-1.42 0c-0.19,0 -0.22,-0.29 0.02,-0.29z"/></svg>',
  more:'<svg class="pi pi-gear" viewBox="0 0 7 7.01" style="fill-rule:evenodd"><circle class="g" cx="3.5" cy="3.505" r="3.1"/><path class="b" d="M3.55 0c0.68,0 1.45,0.26 1.99,0.66 0.33,0.25 0.61,0.52 0.84,0.87 0.62,0.93 0.78,2.05 0.42,3.11 -0.16,0.47 -0.51,1.03 -0.87,1.37 -0.04,0.03 -0.08,0.06 -0.11,0.08 -0.04,0.04 -0.08,0.08 -0.14,0.12 -0.68,0.53 -1.38,0.78 -2.25,0.78 -0.49,0 -0.94,-0.13 -1.39,-0.32 -0.36,-0.15 -0.76,-0.44 -1.04,-0.72 -1.21,-1.2 -1.35,-3.09 -0.38,-4.48 0.67,-0.97 1.74,-1.49 2.92,-1.49zm-0.55 1.99c-0.06,0.01 -0.2,0.09 -0.23,0.09 -0.03,0 -0.32,-0.26 -0.38,-0.28l-0.61 0.61c0.01,0.05 0.04,0.07 0.07,0.1l0.21 0.27c0,0.05 -0.08,0.15 -0.09,0.24l-0.47 0.05 0 0.88 0.47 0.05c0.01,0.08 0.09,0.19 0.09,0.23 0,0.02 -0.05,0.08 -0.07,0.09 -0.04,0.05 -0.2,0.24 -0.21,0.28l0.61 0.61c0.05,-0.02 0.36,-0.28 0.37,-0.28 0.05,0 0.15,0.08 0.24,0.09 0,0.09 0.04,0.35 0.05,0.47l0.88 0c0.01,-0.12 0.05,-0.38 0.05,-0.47 0.08,-0.01 0.19,-0.09 0.23,-0.09 0.03,0 0.32,0.26 0.38,0.28l0.61 -0.61c-0.02,-0.07 -0.28,-0.35 -0.28,-0.37 0,-0.05 0.08,-0.15 0.09,-0.24l0.47 -0.05 0 -0.88 -0.47 -0.05c-0.01,-0.08 -0.09,-0.19 -0.09,-0.23 0,-0.02 0.18,-0.24 0.21,-0.27 0.03,-0.04 0.06,-0.06 0.07,-0.1l-0.61 -0.61c-0.05,0.02 -0.36,0.28 -0.37,0.28 -0.05,0 -0.16,-0.08 -0.24,-0.09 0,-0.06 -0.02,-0.16 -0.02,-0.23 -0.01,-0.07 -0.02,-0.17 -0.03,-0.24l-0.88 0c-0.01,0.07 -0.02,0.16 -0.03,0.23 -0.01,0.07 -0.03,0.18 -0.03,0.24zm-0.44 1.49c0,-0.77 1,-1.23 1.59,-0.64 0.07,0.07 0.15,0.18 0.19,0.27 0.15,0.36 0.1,0.76 -0.18,1.04 -0.37,0.37 -0.95,0.37 -1.32,0.01 -0.18,-0.18 -0.28,-0.4 -0.28,-0.68z"/></svg>'
};
function setHdrTabName(name){
  // Учёт = приход+расход (иконка калькулятора), Склад = листы+обрезки (иконка склада)
  const PILL_NAMES = {income:'УЧЁТ', expense:'УЧЁТ', stock:'СКЛАД', orders:'ЗАКАЗЫ', more:'НАСТРОЙКИ'};
  const PILL_ICON_KEY = {income:'uchet', expense:'uchet', stock:'stock', orders:'orders', more:'more'};
  const el = document.getElementById('hdr-pill-text');
  if(el) el.textContent = PILL_NAMES[name] || name.toUpperCase();
  const ic = document.getElementById('hdr-pill-icon');
  if(ic) ic.innerHTML = PILL_ICONS[PILL_ICON_KEY[name] || 'stock'];
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
  if(name==='orders'){renderOrders();}
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
  const plusOff = isStockBalance || name==='orders';
  plusWrap.style.opacity = plusOff ? '0.45' : '1';
  plusWrap.style.pointerEvents = plusOff ? 'none' : '';
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
