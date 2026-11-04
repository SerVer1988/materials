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
// ══════════════════════════════════════ ЛИСТЫ ПОШТУЧНО
// Раздел «Листы» устроен как «Обрезки»: группа «материал + размер» (шт. и общая площадь), внутри — каждый лист отдельной строкой:
// заказ, к которому он относится (бронь), размер, дата и время прихода, место, м².
// Листы берутся из прихода (запись на N листов = N строк). Расход списывает самые старые: сначала листы своего заказа, потом свободные.
// Бронь из Плана («забронировано из наличия») закрепляет за заказом самые старые свободные листы. Закрытый заказ листы не держит.
const stkOpenGroups=new Set();     // раскрытые группы «материал||размер»
let stkVisibleKeys=[];             // группы, показанные сейчас (для «Свернуть/Развернуть все»)
function stkParseDt(dt){
  const m=String(dt||'').match(/(\d{2})\.(\d{2})\.(\d{2,4})[,\s]+(\d{2}):(\d{2})/); if(!m) return 0;
  let y=+m[3]; if(y<100) y+=2000; return new Date(y,+m[2]-1,+m[1],+m[4],+m[5]).getTime();
}
const stkT=r=>stkParseDt(r.dt)||r.id||0;
function calcSheetUnits(){
  const units={}, closed=new Set(ordersList().filter(o=>o.status==='closed').map(o=>o.key));
  [...db.income].sort((a,b)=>stkT(a)-stkT(b)||(a.id||0)-(b.id||0)).forEach(r=>{
    const k=`${r.mat}||${r.size}`, arr=units[k]||(units[k]=[]);
    for(let i=0;i<(r.qty||0);i++) arr.push({dt:r.dt||'',place:r.place||'',order:r.order||'',rev:!!r.rev});
  });
  planAll().forEach(l=>{                                    // бронь из наличия (План) — за заказом закрепляются самые старые свободные листы
    if(!(l.booked>0)||closed.has(l.order)) return;
    let n=l.booked; (units[`${l.mat}||${l.size}`]||[]).forEach(u=>{ if(n>0&&!u.order){ u.order=l.order; n--; } });
  });
  [...db.expense].filter(r=>r.etype==='full'||!r.etype).sort((a,b)=>stkT(a)-stkT(b)||(a.id||0)-(b.id||0)).forEach(r=>{
    const arr=units[`${r.mat}||${r.size}`]; if(!arr||!arr.length) return;
    let n=r.qty||0;
    const take=pred=>{ for(let i=0;i<arr.length&&n>0;){ if(pred(arr[i])){ arr.splice(i,1); n--; } else i++; } };
    if(r.order) take(u=>u.order===r.order);               // свои листы заказа
    take(u=>!u.order);                                      // затем свободные, старые первыми
    take(()=>true);
  });
  Object.values(units).forEach(a=>a.forEach(u=>{ if(u.order&&closed.has(u.order)) u.order=''; }));   // закрытый заказ листы не держит
  return units;
}
function toggleStkGroup(key){ if(stkOpenGroups.has(key)) stkOpenGroups.delete(key); else stkOpenGroups.add(key); renderStock(); }
function toggleAllStkGroups(){
  const allOpen=stkVisibleKeys.length>0&&stkVisibleKeys.every(k=>stkOpenGroups.has(k));
  if(allOpen) stkVisibleKeys.forEach(k=>stkOpenGroups.delete(k)); else stkVisibleKeys.forEach(k=>stkOpenGroups.add(k));
  renderStock();
}
function updateStkToggle(){
  const el=document.getElementById('fchip-stk-toggle'); if(!el) return;
  el.innerHTML=(stkVisibleKeys.length>0&&stkVisibleKeys.every(k=>stkOpenGroups.has(k)))?'▲ Свернуть':'▼ Развернуть';
}
function toggleFavEl(btn){ const c=btn.closest('[data-mat]'); if(c) toggleFav(c.dataset.mat,c.dataset.size); }
function renderStock(){
  const _revKeep=document.getElementById('rev-inp')?.value;      // не терять введённое число при перерисовке
  updatePlaceChips();
  const grid=document.getElementById('stk-grid'); if(!grid) return;
  const q=(document.getElementById('stk-s')?.value||'').toLowerCase();
  const by=calcStockDetailed(), units=calcSheetUnits(), reserves=calcReserves();
  let groups=[];
  Object.keys(by).forEach(mat=>by[mat].forEach(s=>groups.push({mat,size:s.size,s,key:`${mat}||${s.size}`})));
  groups=groups.map(g=>{
    const all=units[g.key]||[];
    return {...g,list:stkPlaceFilter?all.filter(u=>u.place===stkPlaceFilter):all};
  }).filter(g=>{
    if(stkPlaceFilter&&!g.list.length) return false;
    if(filterLow&&!(g.s.qty<=2)) return false;
    if(filterFav&&!favorites.has(g.key)) return false;
    if(q){ const hay=g.mat+' '+g.size+' '+g.list.map(u=>u.place+' '+u.order).join(' '); if(!searchMatch(hay,q)) return false; }
    return true;
  }).sort((a,b)=>a.mat.localeCompare(b.mat,'ru')||a.size.localeCompare(b.size,'ru',{numeric:true}));
  stkVisibleKeys=groups.map(g=>g.key);
  if(!groups.length){ grid.innerHTML='<div class="empty"><div class="ei">🔍</div>Нет данных</div>'; updateStkToggle(); return; }
  grid.innerHTML=groups.map(g=>{
    const sz=parseSizeStr(g.size)||{w:0,l:0}, m2=sz.w*sz.l/1e6;
    const cnt=stkPlaceFilter?g.list.length:g.s.qty;
    const area=Math.max(0,cnt)*m2;
    const isFav=favorites.has(g.key), isOpen=stkOpenGroups.has(g.key), revOpen=(revKey===g.key);
    const rs=(reserves[g.key]||[]).reduce((t,x)=>t+x.left,0), free=Math.max(0,g.s.qty-rs);
    const rows=g.list.map(u=>{
      const tag=u.order
        ?`<span class="piece-book"><span class="rchip" title="В брони под заказ ${escHtml(u.order)}">🔒 ${typeof planOrderShort==='function'?planOrderShort(u.order):escHtml(splitOrder(u.order).no)}</span></span>`
        :`<span class="piece-free">в запас</span>`;
      return `<div class="piece-row stk-unit">
        <span class="piece-left"><span class="piece-sz">${sz.w}х${sz.l}</span>${u.dt?`<span class="piece-dt">${shortDt(u.dt)}</span>`:''}${tag}</span>
        <span class="piece-right"><span class="piece-place">${escHtml(u.place)}</span><span class="piece-type-ico"${u.rev?' title="Запись ревизии">⚖️':'>'}</span><span class="piece-pcs">1 шт.</span><span class="piece-m2 pm2-pos">${m2.toFixed(3)} м²</span></span>
      </div>`;
    }).join('');
    const body=`<div class="stk-tools"><span>${rs?`в брони <b>${rs}</b> · `:''}свободно <b>${free}</b></span><button class="btn bghost bsm" onclick="toggleRev(this.closest('.remcard').dataset.k)">⚖️ Ревизия</button></div>`+
      (revOpen?revPanelHtml(g.mat,g.s):'')+(rows||'<div class="stk-empty">Листов нет</div>');
    return `<div class="remcard stk-card${isFav?' fav':''}" data-k="${escHtml(g.key)}" data-mat="${escHtml(g.mat)}" data-size="${escHtml(g.size)}">
      <div class="remmat-name stk-hd" onclick="toggleStkGroup(this.parentNode.dataset.k)">
        <span class="stk-hd-name"><span>${escHtml(g.mat)}</span><span class="stk-hd-sz">${escHtml(g.size)}</span></span>
        <span class="stk-hd-right">
          <span class="remarea-badge rem-net" style="display:inline-flex;align-items:center;gap:5px"><span class="stk-cnt ${cnt<=0?'zero':cnt<=2?'low':''}">${cnt} шт.</span><span style="opacity:.5">·</span>${area.toFixed(3)} м²</span>
          <button class="star-btn" onclick="event.stopPropagation();toggleFavEl(this)">${starSvg(isFav)}</button>
          <span class="stk-chev" style="${isOpen?'transform:rotate(180deg)':''}">▼</span>
        </span>
      </div>
      <div style="display:${isOpen||revOpen?'block':'none'}">${body}</div>
    </div>`;
  }).join('');
  updateStkToggle();
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
  if(revKey) stkOpenGroups.add(revKey);
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
