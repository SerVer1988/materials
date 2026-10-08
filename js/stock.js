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
  const q=(document.getElementById('stk-s')?.value||'').toLowerCase();
  const by=calcStockDetailed(); const grid=document.getElementById('stk-grid');
  let keys=Object.keys(by).filter(m=>!q||m.toLowerCase().includes(q));
  if(filterFav) keys=keys.filter(m=>by[m].some(s=>favorites.has(`${m}||${s.size}`)));
  if(filterLow) keys=keys.filter(m=>by[m].some(s=>s.qty<=2));
  keys.sort();
  if(!keys.length){grid.innerHTML='<div class="empty"><div class="ei">🔍</div>Нет данных</div>';return;}
  grid.innerHTML=keys.map(mat=>{
    let sizes=by[mat];
    if(filterLow) sizes=sizes.filter(s=>s.qty<=2);
    if(filterFav) sizes=sizes.filter(s=>favorites.has(`${mat}||${s.size}`));
    if(!sizes.length) return '';
    const anyFav=sizes.some(s=>favorites.has(`${mat}||${s.size}`));
    const rows=sizes.map((s,i)=>{
      const favKey=`${mat}||${s.size}`;
      const isFavRow=favorites.has(favKey);
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
        <button class="star-btn" onclick="event.stopPropagation();toggleFav('${mat.replace(/'/g,"\\'")}','${s.size.replace(/'/g,"\\'")}')">${isFavRow?'⭐':'☆'}</button>
      </div>`;
    }).join('');
    return `<div class="stkcard ${anyFav?'fav':''}">${rows}</div>`;
  }).filter(Boolean).join('');
  if(!grid.innerHTML) grid.innerHTML='<div class="empty"><div class="ei">🔍</div>Нет данных</div>';
}
