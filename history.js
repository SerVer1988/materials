// ▸ history.js — История операций
// ══════════════════════════════════════ HISTORY
function setTab(el,val){document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));el.classList.add('active');htab=val;renderHist();}
function renderHist(){
  const q=(document.getElementById('hs')?.value||'').toLowerCase();
  const fr=document.getElementById('hf')?.value||''; // YYYY-MM-DD
  const to=document.getElementById('ht')?.value||'';

  // Парсим дату из формата "dd.mm.yy HH:MM" или старого "dd.mm.yyyy HH:MM" в объект Date
  function parseDt(dt){
    if(!dt) return null;
    // Новый формат: "02.04.26 15:32"
    let m=dt.match(/^(\d{2})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/);
    if(m) return new Date(2000+parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1]),parseInt(m[4]),parseInt(m[5]));
    // Старый формат: "02.04.2026, 15:32" или "02.04.2026 15:32"
    m=dt.match(/^(\d{2})\.(\d{2})\.(\d{4})[,\s]+(\d{2}):(\d{2})/);
    if(m) return new Date(parseInt(m[3]),parseInt(m[2])-1,parseInt(m[1]),parseInt(m[4]),parseInt(m[5]));
    return null;
  }
  // YYYY-MM-DD → Date (начало/конец дня)
  const frDate = fr ? new Date(fr+'T00:00:00') : null;
  const toDate = to ? new Date(to+'T23:59:59') : null;

  let rows=[];
  db.income.forEach(r=>rows.push({...r,type:'income'}));
  db.expense.forEach(r=>rows.push({...r,type:'expense'}));
  db.remainders.forEach(r=>rows.push({...r,type:'remainder',mat:[...new Set(r.pieces.map(p=>p.mat))].join(', '),size:'—'}));
  // Сортировка по дате — новейшие сверху
  rows.sort((a,b)=>{
    const da=parseDt(a.dt), db2=parseDt(b.dt);
    if(da&&db2) return db2-da;
    return b.id-a.id;
  });
  if(htab) rows=rows.filter(r=>r.type===htab);
  if(q) rows=rows.filter(r=>r.mat&&r.mat.toLowerCase().includes(q));
  if(frDate) rows=rows.filter(r=>{ const d=parseDt(r.dt); return d&&d>=frDate; });
  if(toDate) rows=rows.filter(r=>{ const d=parseDt(r.dt); return d&&d<=toDate; });
  const tb=document.getElementById('hist-tbody');
  if(!rows.length){tb.innerHTML='<tr><td colspan="7"><div class="empty"><div class="ei">📋</div>Нет записей</div></td></tr>';return;}
  tb.innerHTML=rows.map(r=>{
    const badge=r.type==='income'?'<span class="badge bin">📥</span>':r.type==='expense'?'<span class="badge bout">📤</span>':'<span class="badge brem">✂️</span>';
    const qty=r.type!=='remainder'?`${r.qty} л.`:`${r.totalPcs} шт.`;
    const sz=r.type!=='remainder'?(r.size||'—'):'—';
    const det=r.type==='income'?(r.note||'—'):r.type==='expense'?r.det||'—':`${r.totalM2>0?'+':''}${r.totalM2} м²`;
    return `<tr><td>${badge}</td><td style="font-size:11px;color:var(--muted)">${r.dt}</td><td style="font-size:12px;font-weight:800;color:var(--accent)">${r.mat||'—'}</td><td style="font-size:12px">${sz}</td><td style="font-size:12px">${qty}</td><td><span class="place-badge">${r.place||'—'}</span></td><td style="font-size:11px;color:var(--muted)">${det}</td></tr>`;
  }).join('');
}
