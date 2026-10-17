window.__B=window.__B||{};__B['stock']='2026-10-13a';
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
  setFavorite(key,!favorites.has(key));     // с отметкой времени — чтобы синхронизация не откатывала звезду
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
  const _revKeep=document.getElementById('rev-inp')?.value;      // не терять введённое число при перерисовке
  updatePlaceChips();
  const q=(document.getElementById('stk-s')?.value||'').toLowerCase();
  const by=calcStockDetailed(); const grid=document.getElementById('stk-grid');
  const reserves=calcReserves(); // бронь под заказы
  // Фильтр по месту: позиции (материал+размер), которые поступали в выбранное место
  const placeKeys=stkPlaceFilter?new Set(db.income.filter(r=>(r.place||'')===stkPlaceFilter).map(r=>`${r.mat}||${r.size}`)):null;
  const inPlace=(m,sz)=>!placeKeys||placeKeys.has(`${m}||${sz}`);
  let keys=Object.keys(by).filter(m=>!q||searchMatch(m+' '+by[m].map(s=>s.size).join(' '),q));
  if(placeKeys) keys=keys.filter(m=>by[m].some(s=>inPlace(m,s.size)));
  if(filterFav) keys=keys.filter(m=>by[m].some(s=>favorites.has(`${m}||${s.size}`)));
  if(filterLow) keys=keys.filter(m=>by[m].some(s=>s.qty<=2));
  keys.sort();
  if(!keys.length){grid.innerHTML='<div class="empty"><div class="ei">🔍</div>Нет данных</div>';return;}
  grid.innerHTML=keys.map(mat=>{
    let sizes=by[mat];
    if(q&&!searchMatch(mat,q)) sizes=sizes.filter(s=>searchMatch(mat+' '+s.size,q));      // поиск по размеру: показываем только подходящие
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
      const revOpen=(revKey===favKey);
      const revPanel=revOpen?revPanelHtml(mat,s):'';
      return `
      <div class="stkrow rev-able${revOpen?' rev-open':''}" data-k="${escHtml(favKey)}" onclick="toggleRev(this.dataset.k)">
        ${i===0
          ? `<span class="stkmat-inline">${mat}</span>`
          : `<span class="stkmat-inline" style="color:var(--muted);font-weight:600;font-size:11px;opacity:.45">${mat}</span>`}
        <span class="stksz">${s.size}</span>
        <span class="stkmath">
          <span class="inc">${s.inc}</span><span class="sep">−</span><span class="dec">${s.dec}</span><span class="eq">=</span>
          <span class="res ${s.qty===0?'zero':s.qty<=2?'low':''}">${s.qty}шт</span>
        </span>
        <button class="star-btn" onclick="event.stopPropagation();toggleFav('${mat.replace(/'/g,"\\'")}','${s.size.replace(/'/g,"\\'")}')">${starSvg(isFavRow)}</button>
        ${resRow}${revPanel}
      </div>`;
    }).join('');
    return `<div class="stkcard ${anyFav?'fav':''}">${rows}</div>`;
  }).filter(Boolean).join('');
  if(!grid.innerHTML) grid.innerHTML='<div class="empty"><div class="ei">🔍</div>Нет данных</div>';
  const _ri=document.getElementById('rev-inp');
  if(_ri){ if(_revKeep!==undefined&&_revKeep!=='') _ri.value=_revKeep; if(revJustOpened){ revJustOpened=false; _ri.focus(); _ri.select(); } }
}

// ══════════════════════════════════════ РЕВИЗИЯ
// Тап по строке «материал + размер» открывает панель: ввести фактическое количество → «Применить».
// Расхождение записывается в Учёт: больше факта в программе — расход «Ревизия», меньше — приход «Ревизия» (rev:true).
// Склад по-прежнему считается только из прихода и расхода.
let revKey=null, revJustOpened=false;
function toggleRev(key){
  revKey=(revKey===key)?null:key; revJustOpened=!!revKey;
  renderStock();
}
function revLast(mat,size){
  let best=null;
  [...db.income,...db.expense].forEach(r=>{ if(r.rev&&r.mat===mat&&r.size===size&&(!best||r.id>best.id)) best=r; });
  return best;
}
function revPanelHtml(mat,s){
  const key=`${mat}||${s.size}`;
  const rs=(calcReserves()[key]||[]).reduce((t,x)=>t+x.left,0);
  const last=revLast(mat,s.size);
  return `<div class="revpanel" onclick="event.stopPropagation()">
    <div class="rev-info">В программе: <b>${s.qty} шт</b>${rs?` · в брони под заказы: <b>${rs}</b>`:''}${last?` · последняя ревизия: ${escHtml(String(last.dt).split(' ')[0])}`:''}</div>
    <div class="rev-row">
      <button class="btn bdng bsm" onclick="revZero()">Обнулить</button>
      <input type="number" id="rev-inp" inputmode="numeric" min="0" step="1" value="${s.qty}" placeholder="Факт, шт">
      <button class="btn bprim bsm" onclick="revApply()">Применить</button>
    </div>
  </div>`;
}
function revZero(){ const i=document.getElementById('rev-inp'); if(i){ i.value=0; revApply(); } }
function revApply(){
  if(!revKey) return;
  const [mat,size]=revKey.split('||');
  const fact=parseInt(document.getElementById('rev-inp')?.value,10);
  if(isNaN(fact)||fact<0){ toast('Введите количество: 0 или больше','err'); return; }
  const row=(calcStockDetailed()[mat]||[]).find(x=>x.size===size);
  const cur=row?row.qty:0, diff=fact-cur;
  if(diff===0){ toast('Количество совпадает — менять нечего','info'); revKey=null; renderStock(); return; }
  const rs=(calcReserves()[revKey]||[]).reduce((t,x)=>t+x.left,0);
  let txt=`${mat} · ${size}\nВ программе: ${cur} шт → по факту: ${fact} шт\n`+(diff>0?`В Учёт запишется приход +${diff} («Ревизия»).`:`В Учёт запишется расход −${-diff} («Ревизия»).`);
  if(fact<rs) txt+=`\n⚠️ В брони под заказы ${rs} шт — больше, чем по факту.`;
  askDialog(txt,'Применить','Отмена','bprim',()=>revCommit(mat,size,diff,fact),null);
}
function revCommit(mat,size,diff,fact){
  const sz=parseSizeStr(size)||{w:0,l:0};
  const rec={id:Date.now(),dt:now(),mat,size,w:sz.w,l:sz.l,qty:Math.abs(diff),order:'',rev:true,note:`Ревизия: ${fact} листов`};
  if(diff>0){
    // место — как у последнего прихода этого материала и размера, иначе первое из списка
    const lastIn=[...db.income].reverse().find(r=>r.mat===mat&&r.size===size&&r.place);
    db.income.push({...rec,place:lastIn?lastIn.place:(PLACES[0]||'')});
  } else {
    db.expense.push({...rec,etype:'full',det:''});
  }
  revKey=null; save(); renderAll();
  toast(`⚖️ Ревизия записана: ${mat} ${size} — ${fact} шт`,'ok');
}
