// ▸ place-filter.js — раскрывающийся фильтр «Место» для всех разделов: приход, расход, листы, обрезки
// Каждый раздел задаётся ключом: in / out / stk / rem. Разметка: #fchip-place-<k>, #fchip-place-label-<k>, #place-menu-<k>
const PLACE_FILTERS={
  in :{get:()=>inPlaceFilter,  set:v=>{inPlaceFilter=v;},  render:()=>renderIn()},
  out:{get:()=>outPlaceFilter, set:v=>{outPlaceFilter=v;}, render:()=>renderOut()},
  stk:{get:()=>stkPlaceFilter, set:v=>{stkPlaceFilter=v;}, render:()=>renderStock()},
  rem:{get:()=>remPlaceFilter, set:v=>{remPlaceFilter=v;}, render:()=>{syncRemGroupsToFilter();renderRemByMat();}}
};

// Все места: из справочника + те, что встречаются в данных (приход, обрезки)
function placeOptions(){
  const used=[...db.income.map(r=>r.place||'')];
  db.remainders.forEach(rec=>rec.pieces.forEach(p=>used.push(p.place||rec.place||'')));
  return [...new Set([...PLACES,...used.filter(Boolean)])];
}

function closePlaceMenus(){
  document.querySelectorAll('.pmenu.show').forEach(m=>m.classList.remove('show'));
}
function togglePlaceMenu(ev,k){
  if(ev) ev.stopPropagation();
  const m=document.getElementById('place-menu-'+k);
  const wasOpen=m.classList.contains('show');
  closePlaceMenus();
  if(wasOpen) return;
  const cur=PLACE_FILTERS[k].get();
  const esc=p=>p.replace(/'/g,"\\'");
  m.innerHTML=`<div class="pmenu-item ${!cur?'on':''}" onclick="setSecPlace('${k}','')">Все места</div>`+
    placeOptions().map(p=>`<div class="pmenu-item ${cur===p?'on':''}" onclick="setSecPlace('${k}','${esc(p)}')">📍 ${p}</div>`).join('');
  m.classList.add('show');
}
function setSecPlace(k,p){
  PLACE_FILTERS[k].set(p||'');
  closePlaceMenus();
  updatePlaceChips();
  PLACE_FILTERS[k].render();
}
// Подпись и подсветка кнопки «Место» — вызывается при каждой перерисовке
function updatePlaceChips(){
  Object.keys(PLACE_FILTERS).forEach(k=>{
    const chip=document.getElementById('fchip-place-'+k), lab=document.getElementById('fchip-place-label-'+k);
    if(!chip||!lab) return;
    const v=PLACE_FILTERS[k].get();
    chip.classList.toggle('on',!!v);
    lab.textContent=v||'Место';
  });
}
document.addEventListener('click',e=>{ if(!e.target.closest('.fdd-wrap')) closePlaceMenus(); });

// Место переименовано / удалено в справочнике — обновляем активные фильтры
function placeFilterRenamed(oldV,newV){
  Object.values(PLACE_FILTERS).forEach(f=>{ if(f.get()===oldV) f.set(newV); });
}
function placeFilterDeleted(v){
  Object.values(PLACE_FILTERS).forEach(f=>{ if(f.get()===v) f.set(''); });
}

// Расход не хранит место: определяем по тому, куда этот материал (и размер) поступал, и по обрезкам этого материала
function expRowPlaces(r){
  const set=new Set();
  const full=(r.etype==='full'||!r.etype)&&r.size&&r.size!=='—';
  db.income.forEach(i=>{ if(i.place&&i.mat===r.mat&&(!full||i.size===r.size)) set.add(i.place); });
  if(!full){
    db.remainders.forEach(rec=>rec.pieces.forEach(p=>{
      const pl=p.place||rec.place;
      if(pl&&p.mat===r.mat) set.add(pl);
    }));
  }
  return set;
}
