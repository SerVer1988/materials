window.__B=window.__B||{};__B['expense']='2026-10-13a';
// ▸ expense.js — Расход
// ══════════════════════════════════════ EXPENSE
function saveExpense(){
  const mat=(document.getElementById('out-mat').value||'').trim(); const qty=parseInt(document.getElementById('out-qty').value);
  if(!mat||!qty||qty<1){toast('Заполните все поля','err');return;}
  const order=readOrderField('out-order'); if(order===null){toast('Введите заказ: номер_заказчик','err');return;}
  if(!MATS.includes(mat)){MATS.push(mat);releaseRename('mats',mat);save();}
  const detStr=document.getElementById('out-det').value.trim(); const det=parseSizeStr(detStr);
  const sheetSel=isSheetSelected(); let size='—',w=0,l=0,etype='partial';
  if(sheetSel){const sz=getSizeWL('out-pre');size=document.getElementById('out-pre').value;w=sz.w;l=sz.l;etype='full';}
  const brak=!!document.getElementById('out-brak')?.checked;      // «Списать в брак»: лист списан, но в «израсходовано» по заказу не засчитывается
  const rec={mat,size,w,l,qty,etype,order,det:detStr,note:document.getElementById('out-note').value.trim(),brak};
  const brakBox=document.getElementById('out-brak'); if(brakBox) brakBox.checked=false;
  if(editMode.expense!==null){
    const idx=db.expense.findIndex(r=>r.id===editMode.expense);
    if(idx>=0){
      const oldRec = db.expense[idx];
      db.expense[idx]={...oldRec,...rec};
      if(order) ensureOrder(order);
      // Пересчитываем связанный обрезок (если есть)
      const expId = oldRec.id;
      const linkedScrap = db.remainders.find(r=>r.id===expId+1 || r.expenseId===expId);
      if(linkedScrap){
        const newDet = parseSizeStr(rec.det);
        if(rec.etype==='full' && newDet){
          // Пересчитываем обрезки из нового размера и нового qty
          const cl = linkedScrap.calc ? !!linkedScrap.calc.cutLong : undefined;   // выбор «по длинной стороне» сохранён в записи обрезков
          if(linkedScrap.calc) linkedScrap.calc = {...linkedScrap.calc, shW:rec.w, shL:rec.l, dw:newDet.w, dl:newDet.l, qty:rec.qty, mat:rec.mat};
          const rawPieces = calcScraps(rec.w, rec.l, newDet.w, newDet.l, cl);
          if(rawPieces.length){
            linkedScrap.pieces = rawPieces.map(p=>({mat:rec.mat, w:p.w, l:p.l, qty:rec.qty, type:'scrap_add', place: linkedScrap.pieces[0]?.place||''}));
            linkedScrap.totalM2 = +linkedScrap.pieces.reduce((s,p)=>s+p.w*p.l*p.qty/1e6,0).toFixed(4);
            linkedScrap.totalPcs = linkedScrap.pieces.length * rec.qty;
          } else {
            // Обрезков нет (деталь слишком большая) — удаляем
            db.remainders = softDelete(db.remainders, linkedScrap.id);
          }
        } else {
          // Тип изменился на partial или нет изделия — удаляем автообрезок
          db.remainders = softDelete(db.remainders, linkedScrap.id);
        }
      }
    }
    cancelEdit('expense'); toast('✏️ Расход обновлён','ok');
    save(); renderAll(); return;
  }
  rec.id=Date.now(); rec.dt=now();
  let newScrapRecId=null;
  if(etype==='full'&&det){
    const rawPieces = calcScraps(w, l, det.w, det.l, false);   // по умолчанию разрез по короткой стороне; в окне остатков можно включить «по длинной"
    if(rawPieces.length){
      // qty обрезков = qty листов
      const pieces = rawPieces.map(p=>({mat, w:p.w, l:p.l, qty, type:'scrap_add', place:''}));
      newScrapRecId = rec.id+1;
      db.remainders.push({
        id: newScrapRecId, dt: now(), pieces,
        expenseId: rec.id, // связь с записью расхода
        calc: {shW:w, shL:l, dw:det.w, dl:det.l, qty, mat, cutLong:false},   // исходные данные реза — для пересчёта в окне остатков
        totalM2: +pieces.reduce((s,p)=>s+p.w*p.l*qty/1e6,0).toFixed(4),
        totalPcs: pieces.length * qty, place:''
      });
    }
  } else if(etype==='partial'&&det){
    // Открываем модал выбора обрезка — расход пока НЕ записываем
    openScrapFindModal(mat, det.w, det.l, qty, rec);
    return;
  } else if(etype==='partial'&&!det){
    // Без листа, без размера изделия — просто записываем расход
  }
  _commitExpense(rec);
  toast('📤 Расход записан','ok');
  if(newScrapRecId) setTimeout(()=>openScrapModal(newScrapRecId),400);
}
function editExpense(id){
  const r=db.expense.find(x=>x.id===id); if(!r) return;
  editMode.expense=id;
  document.getElementById('add-expense').classList.add('open');
  document.getElementById('out-edit-banner').style.display='flex';
  document.getElementById('out-save-btn').textContent='💾 Сохранить изменения';
  document.getElementById('out-save-btn').className='btn bedit bbig';
  document.getElementById('out-mat').value=r.mat; acUpdateClear('out-mat');
  document.getElementById('out-pre').value=r.size==='—'?'':r.size;
  document.getElementById('out-qty').value=r.qty;
  document.getElementById('out-det').value=r.det||'';
  document.getElementById('out-note').value=r.note||'';
  const bb=document.getElementById('out-brak'); if(bb) bb.checked=!!r.brak;
  setOrderSelect('out-order',r.order||'');
  parseDetSize(); renderOut(); window.scrollTo(0,0);
}
function setOutFilter(f){
  outFilter = (outFilter===f) ? '' : f; // повторное нажатие снимает фильтр
  ['full','partial'].forEach(k=>{
    const el=document.getElementById(`out-fchip-${k}`);
    if(el) el.classList.toggle('on', outFilter===k);
  });
  renderOut();
}
function renderOut(){
  ['full','partial'].forEach(k=>{
    const el=document.getElementById(`out-fchip-${k}`);
    if(el) el.classList.toggle('on', outFilter===k);
  });
  const tb=document.getElementById('out-tbody');
  let rows=[...db.expense].reverse();
  const sq=(document.getElementById('out-s')?.value||'').toLowerCase();
  if(outFilter==='full')    rows=rows.filter(r=>r.etype==='full');
  if(outFilter==='partial') rows=rows.filter(r=>r.etype==='partial');
  if(sq) rows=rows.filter(r=>r.mat&&r.mat.toLowerCase().includes(sq));
  if(outPlaceFilter) rows=rows.filter(r=>expRowPlaces(r).has(outPlaceFilter));
  updatePlaceChips();
  const total=rows.length;
  rows=rows.slice(0,60);
  if(!rows.length){tb.innerHTML='<tr><td colspan="7"><div class="empty"><div class="ei">📭</div>Нет записей</div></td></tr>';return;}
  tb.innerHTML=rows.map((r,i)=>{
    let sizeCell;
    if(r.etype==='full'&&r.size&&r.size!=='—'){
      sizeCell=sizeStack(r.size);
    } else if(r.sourceScrap){
      sizeCell=`<span style="color:var(--blue)">${sizeStack(r.sourceScrap)}</span>`;
    } else if(r.det){
      sizeCell=`<span style="font-size:11px;color:var(--muted)">обрезок</span>`;
    } else {
      sizeCell=`<span style="font-size:12px;color:var(--muted)">—</span>`;
    }
    return `<tr class="trow-edit ${editMode.expense===r.id?'is-editing':''}" onclick="editExpense(${r.id})">
      <td style="color:var(--muted);font-size:11px">${total-i}</td>
      <td class="c-dt">${dtCell(r.dt)}</td>
      <td>${matChip(r.mat)}${ordTag(r.order)}${r.brak?'<div class="ord-tag" title="Списано в брак">🗑 брак</div>':''}</td>
      <td class="c-sz">${sizeCell}</td>
      <td><span class="badge bout">${r.qty} л.</span></td>
      <td class="c-sz c-det">${sizeStack(normSizeStr(r.det))}</td>
      <td><button class="dbtn" onclick="event.stopPropagation();del('expense',${r.id})">✕</button></td>
    </tr>`;
  }).join('');
}

// Отмена редактирования расхода сбрасывает галочку «Списать в брак» (cancelEdit лежит в income.js)
(function(){
  const _cancelEdit=window.cancelEdit;
  window.cancelEdit=function(type){
    if(type==='expense'){ const b=document.getElementById('out-brak'); if(b) b.checked=false; }
    return _cancelEdit.apply(this,arguments);
  };
})();
