window.__B=window.__B||{};__B['stats']='2026-10-13a';
// ▸ stats.js — Итоги: как лист «Аналитика» в Excel. Показатели по месяцам и топ-5 заказчиков, категорий, менеджеров, материалов.
// Считается только из записей расхода (записи ревизии не учитываются). Стоимость не используется.
// Заказ = «Номер_Заказчик_Что именно»; менеджер = первая цифра номера (9-10-53 → менеджер 9).
// Старые записи, импортированные из Excel, хранят заказ в примечании («№ · Заказчик · Категория») — читаются тоже.
const MONTHS_RU=['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
let statsMonth=null;

function statMonthKey(dt){
  const m=String(dt||'').match(/(\d{2})\.(\d{2})\.(\d{2,4})/); if(!m) return null;
  const y=m[3].length===2?'20'+m[3]:m[3]; return y+'-'+m[2];
}
function statMonthName(k,short){ const [y,m]=k.split('-'); const n=MONTHS_RU[+m-1]||k; return short?n.slice(0,3)+' '+y.slice(2):n+' '+y; }
function statOrderInfo(r){
  let no='',cust='',cat='';
  if(r.order){ const p=String(r.order).split('_'); no=(p[0]||'').trim(); cust=(p[1]||'').trim(); cat=p.slice(2).join('_').trim(); }
  else if(r.note){
    const m=String(r.note).match(/^(\d{1,2}-\d{2}-\d{1,4})\s*·\s*([^·]+?)\s*(?:·\s*(.+))?$/);
    if(m){ no=m[1]; cust=m[2].trim(); cat=(m[3]||'').trim(); }
  }
  const g=(no.match(/^(\d+)-/)||[])[1];
  const mgr=g?String(parseInt(g,10)):'';
  return {no,cust,cat:(typeof normCategory==='function'?normCategory(cat):cat),mgr};
}
const statCap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;

function calcStats(){
  const months=new Map();
  const get=k=>{ if(!months.has(k)) months.set(k,{skipped:0,rows:0,orders:new Set(),sheets:0,sheetM2:0,detM2:0,scrapM2:0,brakQty:0,brakM2:0,
    cust:new Map(),cat:new Map(),mgr:new Map(),mat:new Map()}); return months.get(k); };
  const bump=(map,key,disp,m2,order,sheets)=>{
    const k=String(key||'—').toLowerCase();
    if(!map.has(k)) map.set(k,{name:disp||'—',m2:0,orders:new Set(),sheets:0});
    const e=map.get(k); e.m2+=m2; if(order) e.orders.add(order); e.sheets+=sheets||0;
  };
  db.expense.forEach(r=>{
    if(r.rev) return;                                    // ревизия — не расход
    const k=statMonthKey(r.dt); if(!k) return;
    const m=get(k), q=r.qty||0, full=(r.etype==='full'||!r.etype);
    const det=parseSizeStr(r.det||''), dA=det?det.w*det.l*q/1e6:0;
    if(det && det.w*det.l/1e6>8){ m.skipped++; return; }  // изделие больше 8 м² листового материала не бывает — опечатка в размере
    const sp=parseSizeStr(r.size||''), sA=(full&&sp)?sp.w*sp.l*q/1e6:0;
    const inf=statOrderInfo(r);
    m.rows++; if(inf.no) m.orders.add(inf.no);
    if(full){ m.sheets+=q; m.sheetM2+=sA; }
    if(r.brak){ m.brakQty+=q; m.brakM2+=dA; return; }    // брак — отдельно, в топы не входит
    m.detM2+=dA; if(!full) m.scrapM2+=dA;
    bump(m.cust,inf.cust,inf.cust,dA,inf.no);
    bump(m.cat,inf.cat,statCap(inf.cat),dA,inf.no);
    bump(m.mgr,inf.mgr,(typeof managerLabel==='function'?managerLabel(inf.mgr):inf.mgr),dA,inf.no);
    bump(m.mat,r.mat,r.mat,dA,inf.no,full?q:0);
  });
  return months;
}
// Экономия и перерасход, м²: по ЗАКРЫТЫМ заказам, по каждому материалу: нужно (план) − потрачено (расход).
// Плюс — экономия, минус — перерасход (сверх плана, в т.ч. брак). Месяц — месяц закрытия заказа.
// Компенсация: внутри месяца экономия по заказу покрывает перерасход любого другого заказа ТОГО ЖЕ материала.
// Итого по материалу = экономия − перерасход (может быть ±). Между разными материалами не компенсируется.
function statEconomy(){
  const out=new Map(), bal=calcOrderBalance();
  const ords=new Map(); (db.orders||[]).forEach(o=>{ const p=ords.get(o.key); if(!p||(o.ts||o.id||0)>=(p.ts||p.id||0)) ords.set(o.key,o); });
  bal.forEach((mats,key)=>{
    const o=ords.get(key); if(!o||o.status!=='closed') return;
    let k=statMonthKey(o.closedAt);
    if(!k){ let last=null; const pk=[...bal.keys()]; db.expense.forEach(r=>{ if(r.order&&planOrderFor(r.order,pk)===key) last=r.dt; }); k=statMonthKey(last); }
    if(!k) return;
    if(!out.has(k)) out.set(k,{eco:0,over:0,net:0,mats:new Map()});
    const m=out.get(k);
    mats.forEach(e=>{
      const d=e.need-e.spent; if(Math.abs(d)<=0.005) return;
      if(!m.mats.has(e.mat)) m.mats.set(e.mat,{mat:e.mat,eco:0,over:0});
      const pm=m.mats.get(e.mat);
      if(d>0){ m.eco+=d; pm.eco+=d; } else { m.over+=-d; pm.over+=-d; }
    });
    m.net=0; m.mats.forEach(pm=>{ m.net+=pm.eco-pm.over; });
  });
  return out;
}

// Остатки на сегодня: листы (из прихода и расхода) и обрезки
function statStockNow(){
  let sQty=0,sM2=0;
  const by=calcStockDetailed();
  Object.keys(by).forEach(m=>by[m].forEach(s=>{ const p=parseSizeStr(s.size); sQty+=s.qty; if(p) sM2+=s.qty*p.w*p.l/1e6; }));
  let rQty=0,rM2=0;
  db.remainders.forEach(rec=>(rec.pieces||[]).forEach(p=>{
    if(deletedPieces.has(makePieceKey(rec.id,p))) return;
    const sg=p.type==='scrap_sub'?-1:1; rQty+=sg*(p.qty||0); rM2+=sg*(p.w*p.l*(p.qty||0)/1e6);
  }));
  return {sQty,sM2,rQty,rM2};
}

const f2=v=>(Math.round(v*100)/100).toFixed(2);
const pct=(a,b)=>b>0?Math.round(a/b*1000)/10+'%':'—';

function statTop(map,third){
  const arr=[...map.values()].sort((a,b)=>b.m2-a.m2).slice(0,5);
  if(!arr.length) return '<div class="st-empty">нет данных</div>';
  return `<table class="st-tbl"><tr><th>#</th><th>${third.nameHdr}</th><th>м²</th><th>${third.cntHdr}</th></tr>`+
    arr.map((e,i)=>`<tr><td>${i+1}</td><td class="st-n">${escHtml(e.name)}</td><td>${f2(e.m2)}</td><td>${third.sheets?e.sheets:e.orders.size}</td></tr>`).join('')+`</table>`;
}

function get_(months,k){ months.set(k,{skipped:0,rows:0,orders:new Set(),sheets:0,sheetM2:0,detM2:0,scrapM2:0,brakQty:0,brakM2:0,cust:new Map(),cat:new Map(),mgr:new Map(),mat:new Map()}); }
// Экономия и перерасход по материалам за выбранный месяц, с компенсацией внутри материала
function statEcoCard(e){
  const title=`Экономия и перерасход по материалам · ${statMonthName(statsMonth)}`;
  if(!e||!e.mats.size) return `<div class="card"><div class="ctitle">${title}</div><div class="st-empty">Нет закрытых заказов за этот месяц. Закройте заказ в «План → По заказам».</div></div>`;
  const arr=[...e.mats.values()].map(p=>({...p,net:p.eco-p.over,comp:Math.min(p.eco,p.over)})).sort((a,b)=>Math.abs(b.net)-Math.abs(a.net));
  const fmt=v=>Math.abs(v)<0.005?'0.00':(v>0?'+':'−')+f2(Math.abs(v));
  return `<div class="card"><div class="ctitle">${title}</div><div class="st-wrap"><table class="st-tbl">
    <tr><th>Материал</th><th>Экономия</th><th>Перерасход</th><th>Итого</th></tr>`+
    arr.map(p=>`<tr><td class="st-n">${escHtml(p.mat)}</td><td>${f2(p.eco)}</td><td>${f2(p.over)}</td><td class="${p.net>0.005?'st-pos':p.net<-0.005?'st-neg':''}">${fmt(p.net)}</td></tr>`).join('')+
    `</table></div><div class="st-note">Итого = экономия − перерасход по материалу за месяц: экономия по одному заказу покрывает перерасход (в том числе брак) по другому заказу того же материала. Между разными материалами не компенсируется. Считаются только закрытые заказы, м².</div></div>`;
}
function setStatsMonth(k){ statsMonth=k; renderStats(); }
function renderStats(){
  const box=document.getElementById('stats-list'); if(!box) return;
  const months=calcStats();
  const eco=statEconomy();
  [...eco.keys()].forEach(k=>{ if(!months.has(k)) get_(months,k); });
  const keys=[...months.keys()].sort();
  if(!keys.length){ box.innerHTML='<div class="empty"><div class="ei">📊</div>Пока нет расходов — итоги появятся, когда будут записи в «Расходе».</div>'; document.getElementById('stats-months').innerHTML=''; return; }
  if(!statsMonth||!months.has(statsMonth)) statsMonth=keys[keys.length-1];
  // выбор месяца
  document.getElementById('stats-months').innerHTML=keys.slice(-12).reverse().map(k=>`<div class="fchip${k===statsMonth?' on':''}" onclick="setStatsMonth('${k}')">${statMonthName(k,true)}</div>`).join('');

  // таблица «ключевые показатели» — последние 6 месяцев
  const last=keys.slice(-6);
  const row=(label,fn)=>`<tr><td class="st-n">${label}</td>${last.map(k=>`<td${k===statsMonth?' class="st-cur"':''}>${fn(months.get(k))}</td>`).join('')}</tr>`;
  const erow=(label,fn,signed)=>`<tr><td class="st-n">${label}</td>${last.map(k=>{ const v=fn(eco.get(k)||{eco:0,over:0,net:0}); const t=signed?(Math.abs(v)<0.005?'0.00':(v>0?'+':'−')+f2(Math.abs(v))):f2(v); const cls=(k===statsMonth?'st-cur ':'')+(signed&&Math.abs(v)>=0.005?(v>0?'st-pos':'st-neg'):''); return `<td${cls?` class="${cls.trim()}"`:''}>${t}</td>`; }).join('')}</tr>`;
  const key=`<div class="st-wrap"><table class="st-tbl st-key">
    <tr><th></th>${last.map(k=>`<th${k===statsMonth?' class="st-cur"':''}>${statMonthName(k,true)}</th>`).join('')}</tr>
    ${row('Заказов',m=>m.orders.size)}
    ${row('Резов (строк расхода)',m=>m.rows)}
    ${row('Листов израсходовано',m=>m.sheets)}
    ${row('Листов, м²',m=>f2(m.sheetM2))}
    ${row('Изделий, м²',m=>f2(m.detM2))}
    ${row('из них из обрезков, м²',m=>f2(m.scrapM2))}
    ${row('% из обрезков',m=>pct(m.scrapM2,m.detM2))}
    ${row('Брак, шт',m=>m.brakQty)}
    ${row('Брак, м²',m=>f2(m.brakM2))}
    ${row('% брака',m=>pct(m.brakM2,m.detM2+m.brakM2))}
    ${erow('Экономия, м² (закрытые заказы)',e=>e.eco)}
    ${erow('Перерасход, м² (сверх плана)',e=>e.over)}
    ${erow('Итого по материалам, м²',e=>e.net,true)}
  </table></div>`;

  const st=statStockNow(), cur=months.get(statsMonth);
  box.innerHTML=`
    <div class="card"><div class="ctitle">Ключевые показатели по месяцам</div>${key}</div>
    ${statEcoCard(eco.get(statsMonth))}
    <div class="card"><div class="ctitle">Остатки сейчас</div>
      <div class="st-now"><div><b>${st.sQty}</b> листов<span>${f2(st.sM2)} м²</span></div><div><b>${st.rQty}</b> обрезков<span>${f2(st.rM2)} м²</span></div></div></div>
    <div class="card"><div class="ctitle">Топ-5 заказчиков · ${statMonthName(statsMonth)}</div>${statTop(cur.cust,{nameHdr:'Заказчик',cntHdr:'Заказов'})}</div>
    <div class="card"><div class="ctitle">Топ-5 категорий · ${statMonthName(statsMonth)}</div>${statTop(cur.cat,{nameHdr:'Категория',cntHdr:'Заказов'})}</div>
    <div class="card"><div class="ctitle">Топ-5 менеджеров · ${statMonthName(statsMonth)}</div>${statTop(cur.mgr,{nameHdr:'Менеджер',cntHdr:'Заказов'})}</div>
    <div class="card"><div class="ctitle">Топ-5 материалов · ${statMonthName(statsMonth)}</div>${statTop(cur.mat,{nameHdr:'Материал',cntHdr:'Листов',sheets:true})}</div>
    <div class="st-note">Площадь — по размерам изделий из расхода. Ревизия и брак в топы не входят.${cur.skipped?`<br>⚠️ Не учтено строк с размером изделия больше 8 м² (похоже на опечатку): <b>${cur.skipped}</b> — проверьте в «Расходе».`:''}</div>`;
}
