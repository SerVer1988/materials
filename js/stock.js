// ▸ stock.js — Склад: вкладки Листы/Обрезки, фильтры, остатки
function setStockTab(btn,tab){
  document.querySelectorAll('.itab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); stockTab=tab;
  // Обновляем название вкладки и цвет плюса
  const tnEl=document.getElementById('sec-tab-name-stock');
  if(tnEl) tnEl.textContent=tab==='rem'?'ОБРЕЗКИ':'ЛИСТЫ';
  updatePlusBtn('stock');
  document.getElementById('panel-balance').style.display=tab==='balance'?'':'none';
  document.getElementById('panel-rem').style.display=tab==='rem'?'':'none';
  document.getElementById('panel-top-balance').style.display=tab==='balance'?'':'none';
  document.getElementById('panel-top-rem').style.display=tab==='rem'?'':'none';
  // FAB и панель обрезков
  const fab=document.getElementById('fab-rem');
  if(fab){ fab.classList.toggle('visible', tab==='rem'); }
  if(tab!=='rem'){
    const addRem=document.getElementById('add-rem');
    if(addRem) addRem.classList.remove('open');
  }
  if(tab==='balance'){ if(selMode) exitSelMode(); renderStock(); } else renderRemByMat();
}
// Звезда: одинаковый размер в обоих состояниях (избранное — жёлтая, обычная — серая контурная)
function starSvg(on){
  return `<svg class="star-ico ${on?'on':''}" viewBox="0 0 24 24" width="18" height="18"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8L12 2.8z" stroke-linejoin="round"/></svg>`;
}

function toggleFilter(type){
  if(type==='low'){filterLow=!filterLow;document.getElementById('fchip-low').classList.toggle('on',filterLow);}
  else{filterFav=!filterFav;document.getElementById('fchip-fav').classList.toggle('fav-on',filterFav);}
  renderStock();
}
function toggleFav(mat,size){
  const key=size?`${mat}||${size}`:mat;
  if(favorites.has(key)) favorites.delete(key); else favorites.add(key);
  save(); renderStock();
}

// ══════════════════════════════════════ STOCK
function calcStockDetailed(){
  const inc={},dec={};
  db.income.forEach(r=>{const k=`${r.mat}||${r.size}`;inc[k]=(inc[k]||0)+r.qty;});
  db.expense.forEach(r=>{if(r.etype==='full'||!r.etype){const k=`${r.mat}||${r.size}`;dec[k]=(dec[k]||0)+r.qty;}});
  const keys=new Set([...Object.keys(inc),...Object.keys(dec)]);
  const res={};
  keys.forEach(k=>{const[mat,size]=k.split('||');if(!res[mat])res[mat]=[];const i=inc[k]||0,d=dec[k]||0;res[mat].push({size,inc:i,dec:d,qty:i-d});});
  return res;
}
function renderStock(){
  updatePlaceChips();
  const q=(document.getElementById('stk-s')?.value||'').toLowerCase();
  const by=calcStockDetailed(); const grid=document.getElementById('stk-grid');
  const reserves=calcReserves(); // бронь под заказы
  // Фильтр по месту: позиции (материал+размер), которые поступали в выбранное место
  const placeKeys=stkPlaceFilter?new Set(db.income.filter(r=>(r.place||'')===stkPlaceFilter).map(r=>`${r.mat}||${r.size}`)):null;
  const inPlace=(m,sz)=>!placeKeys||placeKeys.has(`${m}||${sz}`);
  let keys=Object.keys(by).filter(m=>!q||m.toLowerCase().includes(q));
  if(placeKeys) keys=keys.filter(m=>by[m].some(s=>inPlace(m,s.size)));
  if(filterFav) keys=keys.filter(m=>by[m].some(s=>favorites.has(`${m}||${s.size}`)));
  if(filterLow) keys=keys.filter(m=>by[m].some(s=>s.qty<=2));
  keys.sort();
  if(!keys.length){grid.innerHTML='<div class="empty"><div class="ei">🔍</div>Нет данных</div>';return;}
  grid.innerHTML=keys.map(mat=>{
    let sizes=by[mat];
    if(placeKeys) sizes=sizes.filter(s=>inPlace(mat,s.size));
    if(filterLow) sizes=sizes.filter(s=>s.qty<=2);
    if(filterFav) sizes=sizes.filter(s=>favorites.has(`${mat}||${s.size}`));
    if(!sizes.length) return '';
    const anyFav=sizes.some(s=>favorites.has(`${mat}||${s.size}`));
    const rows=sizes.map((s,i)=>{
      const favKey=`${mat}||${s.size}`;
      const isFavRow=favorites.has(favKey);
      const rs=reserves[favKey]||[];
      const free=Math.max(0,s.qty-rs.reduce((t,x)=>t+x.left,0));
      const resRow=rs.length?`<div class="stkres">${rs.map(x=>`<span class="rchip" title="${escHtml(x.order)}">🔒 ${escHtml(x.order)} · ${x.left} шт</span>`).join('')}<span class="rfree">свободно ${free}</span></div>`:'';
      return `
      <div class="stkrow">
        ${i===0
          ? `<span class="stkmat-inline">${mat}</span>`
          : `<span class="stkmat-inline" style="color:var(--muted);font-weight:600;font-size:11px;opacity:.45">${mat}</span>`}
        <span class="stksz">${s.size}</span>
        <span class="stkmath">
          <span class="inc">${s.inc}</span><span class="sep">−</span><span class="dec">${s.dec}</span><span class="eq">=</span>
          <span class="res ${s.qty===0?'zero':s.qty<=2?'low':''}">${s.qty}шт</span>
        </span>
        <button class="star-btn" onclick="event.stopPropagation();toggleFav('${mat.replace(/'/g,"\\'")}','${s.size.replace(/'/g,"\\'")}')">${starSvg(isFavRow)}</button>
        ${resRow}
      </div>`;
    }).join('');
    return `<div class="stkcard ${anyFav?'fav':''}">${rows}</div>`;
  }).filter(Boolean).join('');
  if(!grid.innerHTML) grid.innerHTML='<div class="empty"><div class="ei">🔍</div>Нет данных</div>';
}
