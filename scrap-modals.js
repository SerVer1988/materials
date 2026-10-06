// ▸ scrap-modals.js — Модалки: куда поместить обрезки / подобрать обрезок под изделие
// ══════════════════════════════════════ MODAL 1: КУДА ПОМЕСТИТЬ ОБРЕЗКИ
// pendingScrapPieces = [{w,l,m2,place,save}] — данные каждого куска
let pendingScrapPieces = [];

function openScrapModal(recId){
  pendingScrapRecId = recId;
  const rec = db.remainders.find(r=>r.id===recId);
  if(!rec){ return; }

  // Заполняем pendingScrapPieces из кусков записи
  pendingScrapPieces = rec.pieces.map((p,i)=>({
    idx: i,
    mat: p.mat||'',
    w: p.w, l: p.l, qty: p.qty||1,
    m2: +(p.w*p.l*(p.qty||1)/1e6).toFixed(4),
    place: PLACES[0]||'',
    save: true
  }));

  // Рендерим список кусков
  const list = document.getElementById('scrap-pieces-list');
  list.innerHTML = pendingScrapPieces.map((p,i)=>{
    const placeOpts = PLACES.map(pl=>`<option value="${pl}">${pl}</option>`).join('');
    const m2 = +(p.w*p.l*(p.qty||1)/1e6).toFixed(4);
    return `
    <div class="scrap-piece-item" id="spi-${i}" style="margin-bottom:12px;padding:10px;background:var(--card2);border:1px solid var(--border);border-radius:var(--rs)">
      <div class="scrap-piece-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span class="scrap-piece-size" style="font-weight:800;font-size:13px;color:var(--accent)">Обрезок ${i+1}${p.qty>1?` · ${p.qty} шт.`:''}</span>
        <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);cursor:pointer">
          <input type="checkbox" id="spi-chk-${i}" ${p.save?'checked':''} onchange="toggleScrapPiece(${i})">
          сохранить
        </label>
      </div>
      <div class="frow c3" style="margin-bottom:8px" id="spi-fields-${i}">
        <div class="fg"><label>Ширина (мм)</label>
          <input type="number" id="spi-w-${i}" value="${p.w}" inputmode="numeric" min="1"
            oninput="pendingScrapPieces[${i}].w=parseInt(this.value)||p.w;document.getElementById('spi-m2-${i}').textContent=+(pendingScrapPieces[${i}].w*pendingScrapPieces[${i}].l*(pendingScrapPieces[${i}].qty||1)/1e6).toFixed(4)+' м²'">
        </div>
        <div class="fg"><label>Длина (мм)</label>
          <input type="number" id="spi-l-${i}" value="${p.l}" inputmode="numeric" min="1"
            oninput="pendingScrapPieces[${i}].l=parseInt(this.value)||p.l;document.getElementById('spi-m2-${i}').textContent=+(pendingScrapPieces[${i}].w*pendingScrapPieces[${i}].l*(pendingScrapPieces[${i}].qty||1)/1e6).toFixed(4)+' м²'">
        </div>
        <div class="fg"><label>Площадь</label>
          <div id="spi-m2-${i}" style="padding:9px 10px;font-size:13px;font-weight:800;color:var(--blue)">${m2} м²</div>
        </div>
      </div>
      <div class="fg" id="spi-place-wrap-${i}">
        <label>Место хранения</label>
        <select id="spi-place-${i}" onchange="pendingScrapPieces[${i}].place=this.value">
          ${placeOpts}
        </select>
      </div>
    </div>`;
  }).join('');

  document.getElementById('scrap-place-modal').classList.add('show');
}

function toggleScrapPiece(i){
  const chk = document.getElementById(`spi-chk-${i}`);
  const item = document.getElementById(`spi-${i}`);
  const wrap = document.getElementById(`spi-place-wrap-${i}`);
  pendingScrapPieces[i].save = chk.checked;
  item.classList.toggle('disabled', !chk.checked);
  wrap.style.display = chk.checked ? '' : 'none';
}

function saveScrapPlaces(){
  // toSave объявляем снаружи чтобы использовать после блока if
  const toSave = pendingScrapPieces.filter(p=>p.save);
  const rec = db.remainders.find(r=>r.id===pendingScrapRecId);
  if(rec){
    if(toSave.length === 0){
      // Удаляем всю запись
      db.remainders = softDelete(db.remainders, pendingScrapRecId);
    } else {
      rec.pieces = toSave.map(p=>{
        // Читаем актуальные значения из полей ввода
        const wEl=document.getElementById(`spi-w-${p.idx}`);
        const lEl=document.getElementById(`spi-l-${p.idx}`);
        const w = wEl ? (parseInt(wEl.value)||p.w) : p.w;
        const l = lEl ? (parseInt(lEl.value)||p.l) : p.l;
        return {
          mat: rec.pieces[p.idx]?.mat||p.mat||'',
          w, l, qty: p.qty||1,
          type: 'scrap_add',
          place: p.place
        };
      });
      rec.place = toSave[0].place;
      rec.totalM2 = +rec.pieces.reduce((s,p)=>s+p.w*p.l*(p.qty||1)/1e6,0).toFixed(4);
      rec.totalPcs = rec.pieces.reduce((s,p)=>s+(p.qty||1),0);
    }
  }
  const savedScrapPlace = toSave.length ? toSave[0].place : '';
  const savedScrapMat = toSave.length ? toSave[0].mat : '';
  save(); closeScrapModal();
  goToRemWithPlace(savedScrapMat, savedScrapPlace);
  if(savedScrapMat) setTimeout(()=>highlightLastPiece(savedScrapMat), 400);
  toast(`✂️ Обрезки сохранены`,'ok');
}

function closeScrapModal(){
  document.getElementById('scrap-place-modal').classList.remove('show');
  pendingScrapRecId = null;
  pendingScrapPieces = [];
}

// ══════════════════════════════════════ MODAL 2: ПОДОБРАТЬ ОБРЕЗОК ПОД ИЗДЕЛИЕ

// Сколько штук изделия detW×detL влезает в обрезок pw×pl (оптимальная раскладка — простая сетка)
function countFits(pw, pl, detW, detL){
  // Пробуем оба поворота изделия, берём максимум
  const a = Math.floor(pw/detW) * Math.floor(pl/detL);
  const b = Math.floor(pw/detL) * Math.floor(pl/detW);
  return Math.max(a, b);
}

// Ориентация при которой влезает больше
function bestOrientation(pw, pl, detW, detL){
  const a = Math.floor(pw/detW) * Math.floor(pl/detL);
  const b = Math.floor(pw/detL) * Math.floor(pl/detW);
  if(b > a) return {dW: detL, dL: detW};
  return {dW: detW, dL: detL};
}

// Собирает все обрезки нужного материала с количеством вмещаемых штук
function findMatchingScraps(mat, detW, detL, needQty){
  const results = [];
  db.remainders.forEach(rec=>{
    rec.pieces.forEach((p,pi)=>{
      if(p.mat !== mat) return;
      if(p.type === 'scrap_sub') return;
      const fits = countFits(p.w, p.l, detW, detL);
      if(fits <= 0) return;
      const place = p.place || rec.place || '—';
      const m2 = +(p.w*p.l/1e6).toFixed(4);
      const {dW, dL} = bestOrientation(p.w, p.l, detW, detL);
      // Для одной штуки считаем остатки (для отображения)
      const remaining = calcScraps(p.w, p.l, dW, dL);
      const waste = p.w*p.l - dW*dL;
      // qty в обрезке: сколько реально штук есть (piece.qty)
      const pieceQty = p.qty || 1;
      const totalFits = fits * pieceQty; // всего штук из всех единиц этого обрезка
      results.push({ recId: rec.id, pi, piece: p, remaining, place, m2, dW, dL, waste, fits, pieceQty, totalFits });
    });
  });
  // Сортировка: сначала наибольшее совпадение (наименьший остаток от одной штуки)
  results.sort((a,b) => a.waste - b.waste);
  return results;
}

// Автоматически строит план раскладки для needQty штук по доступным обрезкам
function buildAllocationPlan(matches, needQty){
  // plan: [{matchIdx, useQty (штук из piece.qty), fitsPerPiece}]
  const plan = [];
  let remaining = needQty;
  // Работаем с копией qty чтобы не портить оригинал
  const usedQty = matches.map(()=>0);
  for(let i=0; i<matches.length && remaining>0; i++){
    const m = matches[i];
    const canGetFromThis = m.totalFits; // максимум штук из этого обрезка
    if(canGetFromThis <= 0) continue;
    const take = Math.min(remaining, canGetFromThis);
    // Сколько единиц обрезка нужно израсходовать
    const piecesNeeded = Math.ceil(take / m.fits);
    usedQty[i] = Math.min(piecesNeeded, m.pieceQty);
    plan.push({ matchIdx: i, useQty: usedQty[i], fitsPerPiece: m.fits, takeTotal: Math.min(take, usedQty[i]*m.fits) });
    remaining -= usedQty[i] * m.fits;
  }
  return { plan, shortage: Math.max(0, remaining) };
}

let pendingScrapFind = null;
// Множество выбранных индексов в модале
let scrapFindSelected = new Set();

function openScrapFindModal(mat, detW, detL, needQty, pendingExpRec){
  needQty = needQty || 1;
  scrapFindSelected = new Set();

  // Все обрезки нужного материала
  const allScraps = [];
  db.remainders.forEach(rec=>{
    rec.pieces.forEach((p,pi)=>{
      if(p.mat !== mat) return;
      if(p.type === 'scrap_sub') return;
      const fits = detW&&detL ? countFits(p.w, p.l, detW, detL) : 0;
      const place = p.place || rec.place || '—';
      const m2 = +(p.w*p.l/1e6).toFixed(4);
      const {dW, dL} = detW&&detL ? bestOrientation(p.w, p.l, detW, detL) : {dW:0,dL:0};
      const remaining = detW&&detL ? calcScraps(p.w, p.l, dW, dL) : [];
      const pieceQty = p.qty || 1;
      const totalFits = fits * pieceQty;
      allScraps.push({ recId: rec.id, pi, piece: p, remaining, place, m2, dW, dL, fits, pieceQty, totalFits, fits });
    });
  });

  // Сортировка: сначала подходящие (fits>0) по наименьшему остатку, потом остальные по м²
  const fitting = allScraps.filter(m=>m.fits>0).sort((a,b)=>(a.piece.w*a.piece.l)-(b.piece.w*b.piece.l));
  const notFitting = allScraps.filter(m=>m.fits===0).sort((a,b)=>b.m2-a.m2);
  const matches = [...fitting, ...notFitting];

  // Предвыбираем подходящие по плану
  if(fitting.length){
    const {plan} = buildAllocationPlan(fitting, needQty);
    plan.forEach(p=>scrapFindSelected.add(p.matchIdx));
  }

  const desc = document.getElementById('scrap-find-desc');
  const list = document.getElementById('scrap-find-list');
  desc.innerHTML = `<b>${mat}</b>${detW&&detL?` · Изделие: <b>${detW}×${detL} мм</b> · Нужно: <b>${needQty} шт.</b>`:''}`;

  if(!matches.length){
    list.innerHTML = `<div class="empty"><div class="ei">✂️</div>Обрезков этого материала нет</div>`;
    // Нет обрезков — если есть pendingExpRec записываем расход напрямую
    if(pendingExpRec){
      _commitExpense(pendingExpRec);
      toast('📤 Расход записан (обрезков нет)','ok');
    }
    return;
  }

  list.innerHTML = _renderScrapFindItems(matches, detW, detL);

  pendingScrapFind = { mat, detW, detL, needQty, matches, fitting, pendingExpRec };
  const cutBtn = document.getElementById('scrap-cut-btn');
  if(cutBtn) cutBtn.style.display = scrapFindSelected.size > 0 ? '' : 'none';
  document.getElementById('scrap-find-modal').classList.add('show');
}

function _renderScrapFindItems(matches, detW, detL){
  const detArea = detW*detL;
  return matches.map((m,i)=>{
    const isFitting = m.fits > 0;
    const isChecked = scrapFindSelected.has(i);
    const matchPct = detArea ? Math.round(detArea/(m.piece.w*m.piece.l)*100) : 0;
    const fitsInfo = isFitting
      ? (m.pieceQty>1 ? `${m.fits} шт/обр. · ${m.pieceQty} шт. = ${m.totalFits} шт.` : `${m.fits} шт. из этого обрезка`)
      : `<span style="color:var(--red)">не подходит по размеру</span>`;
    const remText = m.remaining.length
      ? m.remaining.map(r=>`${r.w}×${r.l} (${+(r.w*r.l/1e6).toFixed(3)} м²)`).join(', ')
      : (isFitting ? '🗑️ отход' : '');
    const bestLabel = i===0&&isFitting ? `<span style="background:var(--glt);color:var(--green);font-size:10px;font-weight:800;padding:2px 7px;border-radius:10px;margin-left:6px">★ лучший</span>` : '';
    const sepLabel = !isFitting && (i===0||matches[i-1].fits>0)
      ? `<div style="font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.07em;padding:10px 0 6px">ДРУГИЕ ОБРЕЗКИ ЭТОГО МАТЕРИАЛА</div>` : '';
    return `${sepLabel}<div class="scrap-find-item${isChecked?' selected':''}" id="sfi-${i}" onclick="toggleScrapFindItem(${i})" style="${!isFitting?'opacity:.65':''}">
      <div class="sfi-head">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1">
          <input type="checkbox" id="sfi-chk-${i}" ${isChecked?'checked':''} onchange="onScrapFindChk(${i},this.checked)" onclick="event.stopPropagation()" style="min-width:18px">
          <span class="sfi-size">${m.piece.w}×${m.piece.l} мм${bestLabel}</span>
        </label>
        <span style="display:flex;align-items:center;gap:6px">
          ${detArea?`<span style="font-size:11px;font-weight:800;color:${matchPct>=80?'var(--green)':matchPct>=50?'var(--accent)':'var(--muted)'}">${matchPct}%</span>`:''}
          <span class="sfi-m2">${m.m2} м²</span>
        </span>
      </div>
      <div style="font-size:11px;color:var(--blue);font-weight:700;margin:2px 0 4px">${fitsInfo}</div>
      <div class="sfi-place">📍 ${m.place}</div>
      ${remText?`<div class="sfi-result ${m.remaining.length?'keep':'del'} show">${m.remaining.length?'✂️ Остаток: ':''}${remText}</div>`:''}
    </div>`;
  }).join('');
}

function toggleScrapFindItem(i){
  // Клик по карточке — переключаем чекбокс
  const chk = document.getElementById(`sfi-chk-${i}`);
  if(chk){ chk.checked = !chk.checked; onScrapFindChk(i, chk.checked); }
}

function onScrapFindChk(i, checked){
  if(checked) scrapFindSelected.add(i);
  else scrapFindSelected.delete(i);
  // Обновляем подсветку карточки
  const item = document.getElementById(`sfi-${i}`);
  if(item) item.classList.toggle('selected', checked);
  // Показываем/скрываем кнопку Вырезать
  const cutBtn = document.getElementById('scrap-cut-btn');
  if(cutBtn) cutBtn.style.display = scrapFindSelected.size>0 ? '' : 'none';
}


function _commitExpense(rec){
  rec.id = Date.now(); rec.dt = now();
  db.expense.push(rec);
  lastOutMat = rec.mat;
  save(); renderAll();
  document.getElementById('out-mat').value='';
  ['out-det','out-note'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('out-qty').value='1';
  document.getElementById('out-pre').value='';
  document.getElementById('scrap-preview').style.display='none';
  document.getElementById('scrap-neg-preview').style.display='none';
  document.getElementById('add-expense')?.classList.remove('open');
  // Сбрасываем кнопку
  const btn=document.getElementById('out-save-btn');
  if(btn){btn.textContent='📤 Записать расход';btn.className='btn bdng bbig';}
  renderStock();
  highlightLastRow('out-tbody');
}

// Применяет вырезку выбранных обрезков + записывает расход
function applyScrapCut(){
  if(!pendingScrapFind || scrapFindSelected.size===0){
    toast('Выберите хотя бы один обрезок','err'); return;
  }
  const {mat, detW, detL, needQty, matches, pendingExpRec} = pendingScrapFind;
  const selectedMatches = [...scrapFindSelected].sort((a,b)=>a-b).map(i=>matches[i]);
  const consumed = [];
  const newScrapPieces = []; // остатки для модала

  selectedMatches.forEach(m=>{
    const rec = db.remainders.find(r=>r.id===m.recId);
    if(!rec) return;
    const p = rec.pieces[m.pi];
    if(!p) return;

    const useQty = 1; // берём 1 единицу обрезка
    consumed.push({recId:m.recId, pi:m.pi, w:p.w, l:p.l, qty:useQty, place:p.place||rec.place||'', mat:p.mat});

    // Остатки после реза
    if(m.remaining.length){
      const remM2 = m.remaining.reduce((s,r)=>s+r.w*r.l/1e6, 0);
      if(remM2 > 0.05){
        // Добавляем в очередь для модала остатков
        m.remaining.forEach(r=>{
          newScrapPieces.push({
            mat:p.mat, w:r.w, l:r.l, qty:useQty,
            place:p.place||rec.place||''
          });
        });
      }
    }

    // Уменьшаем/удаляем обрезок
    if(p.qty > 1){
      p.qty -= useQty;
      // Если остаток > 0.05 м² — вставим через модал, иначе просто уменьшили
    } else {
      rec.pieces.splice(m.pi, 1);
    }
    if(rec.pieces.length === 0){
      db.remainders = softDelete(db.remainders, rec.id);
    } else {
      rec.totalM2 = +rec.pieces.filter(x=>x.type!=='scrap_sub').reduce((s,x)=>s+x.w*x.l*(x.qty||1)/1e6,0).toFixed(4);
      rec.totalPcs = rec.pieces.reduce((s,x)=>s+(x.qty||1),0);
    }
  });

  // Записываем расход
  if(pendingExpRec){
    pendingExpRec.etype = 'partial';
    pendingExpRec.sourceScrap = selectedMatches.map(m=>`${m.piece.w}×${m.piece.l}`).join(', ');
    pendingExpRec.consumedScraps = consumed;
    _commitExpense(pendingExpRec);
  }

  closeScrapFindModal();

  // Если есть остатки > 0.05 м² — показываем модал
  if(newScrapPieces.length){
    const newRecId = Date.now()+1;
    db.remainders.push({
      id: newRecId, dt: now(),
      pieces: newScrapPieces.map(p=>({...p, type:'scrap_add'})),
      totalM2: +newScrapPieces.reduce((s,p)=>s+p.w*p.l*(p.qty||1)/1e6,0).toFixed(4),
      totalPcs: newScrapPieces.reduce((s,p)=>s+(p.qty||1),0),
      place: newScrapPieces[0]?.place||''
    });
    save();
    setTimeout(()=>openScrapModal(newRecId), 400);
  } else {
    save();
    const firstMat = selectedMatches[0]?.piece.mat||'';
    const firstPlace = selectedMatches[0]?.place||'';
    goToRemWithPlace(firstMat, firstPlace);
    if(firstMat) setTimeout(()=>highlightLastPiece(firstMat), 400);
  }
  toast('✂️ Вырезано из обрезков','ok');
}

function closeScrapFindModal(){
  document.getElementById('scrap-find-modal').classList.remove('show');
  pendingScrapFind = null;
  scrapFindSelected = new Set();
}
