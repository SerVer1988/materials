// ▸ remainders.js — Обрезки: добавление, правка, список по материалам, фильтры
// ══════════════════════════════════════ REMAINDERS — ADD PENDING
function addPiece(){
  const mat=(document.getElementById('rem-mat').value||'').trim();
  const sizeStr=(document.getElementById('rem-size').value||'').trim();
  const parsed=parseSizeStr(sizeStr);
  const qty=parseInt(document.getElementById('rem-qty').value)||1;
  const placeVal=document.getElementById('rem-place').value;
  const place=placeVal===CUSTOM_VAL?'':placeVal;
  if(!mat){toast('Введите материал','err');return;}
  if(!parsed){toast('Введите размер в формате 234×2132','err');return;}
  const {w,l}=parsed;
  if(!MATS.includes(mat)){MATS.push(mat);releaseRename('mats',mat);save();}

  // Сразу сохраняем в базу — без промежуточного буфера
  const piece={mat,w,l,qty,type:'scrap_add',place};
  const m2=+(w*l*qty/1e6).toFixed(4);
  db.remainders.push({
    id:Date.now(), dt:now(),
    pieces:[piece],
    totalM2:m2, totalPcs:qty, place
  });
  // Сброс полей — материал оставляем, запоминаем для следующего раза
  lastRemMat=mat;
  document.getElementById('rem-size').value='';
  document.getElementById('rem-qty').value='1';
  document.getElementById('add-rem')?.classList.remove('open');
  save();
  goToRemWithPlace(mat, place);
  toast(`✅ ${mat} ${w}×${l} добавлен`,'ok');
  highlightLastPiece(mat);
}
function renderPending(){
  const card=document.getElementById('pcard'); if(!pending.length){card.style.display='none';return;}
  card.style.display='block';
  const tot=pending.reduce((s,p)=>s+p.w*p.l*p.qty/1e6,0);
  const pcs=pending.reduce((s,p)=>s+p.qty,0);
  document.getElementById('pcnt').textContent=`(${pending.length} поз.)`;
  document.getElementById('plist').innerHTML=pending.map((p,i)=>`<div class="pitem">
    <span class="pmat">${p.mat}</span>
    <span class="psz">${p.w}х${p.l} ×${p.qty}</span>
    ${p.place?`<span class="piece-place">${p.place}</span>`:''}
    <span class="parea">${(p.w*p.l*p.qty/1e6).toFixed(3)}м²</span>
    <button class="pdel" onclick="rmPiece(${i})">✕</button>
  </div>`).join('');
  document.getElementById('rres').innerHTML=`<div class="rres"><div style="font-size:10px;font-weight:800;color:var(--muted);letter-spacing:.07em;margin-bottom:3px">ИТОГО</div><div class="rbig">${tot.toFixed(4)} м²</div><div class="rsub">${pcs} шт. · ${pending.length} позиций</div></div>`;
}
function rmPiece(i){pending.splice(i,1);renderPending();}
function clrPieces(){pending=[];renderPending();}
function saveRem(){
  if(!pending.length){toast('Нет обрезков','err');return;}
  const place=document.getElementById('rem-place').value;
  const totalM2=+pending.reduce((s,p)=>s+p.w*p.l*p.qty/1e6,0).toFixed(4);
  const totalPcs=pending.reduce((s,p)=>s+p.qty,0);
  const savedPlace = place===CUSTOM_VAL?'':place;
  db.remainders.push({id:Date.now(),dt:now(),pieces:[...pending],totalM2,totalPcs,place:savedPlace});
  save(); pending=[]; renderPending();
  // Активируем фильтр места если место указано
  if(savedPlace){
    remPlaceFilter = savedPlace;
    syncRemGroupsToFilter();
  }
  renderRemByMat();
  toast('💾 Обрезки сохранены','ok');
  document.getElementById('cc-rem')?.classList.remove('open');
}

// ══════════════════════════════════════ PIECE EDIT (inline rendered)
// pieceEditState = {recId, pi} or null
function openPieceEdit(recId, pi){
  // If clicking the same row — close it
  if(pieceEditState && pieceEditState.recId===recId && pieceEditState.pi===pi){
    cancelPieceEdit(); return;
  }
  pieceEditState={recId,pi};
  renderRemByMat(); // re-render with form open
  // Scroll form into view
  const formEl=document.getElementById(`pef-form-${recId}-${pi}`);
  if(formEl) formEl.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function savePieceEdit(){
  if(!pieceEditState) return;
  const{recId,pi}=pieceEditState;
  const rec=db.remainders.find(r=>r.id===recId); if(!rec) return;
  const ri=realPieceIdx(rec,pi);
  const p=rec.pieces[ri]; if(!p) return;
  const matEl=document.getElementById(`pef-mat-${recId}-${pi}`);
  const mat=(matEl?matEl.value.trim():p.mat)||p.mat;
  const w=parseInt(document.getElementById(`pef-w-${recId}-${pi}`).value);
  const l=parseInt(document.getElementById(`pef-l-${recId}-${pi}`).value);
  const qty=parseInt(document.getElementById(`pef-qty-${recId}-${pi}`).value)||1;
  const placeVal=document.getElementById(`pef-place-${recId}-${pi}`).value;
  if(!mat){toast('Введите материал','err');return;}
  if(!w||!l){toast('Введите размеры','err');return;}
  if(!MATS.includes(mat)) MATS.push(mat);
  p.mat=mat; p.w=w; p.l=l; p.qty=qty;
  p.place=placeVal===CUSTOM_VAL?'':placeVal;
  rec.totalM2=+rec.pieces.filter(x=>x.type!=='scrap_sub').reduce((s,x)=>s+x.w*x.l*x.qty/1e6,0).toFixed(4)
             -+rec.pieces.filter(x=>x.type==='scrap_sub').reduce((s,x)=>s+x.w*x.l*x.qty/1e6,0).toFixed(4);
  pieceEditState=null;
  save(); renderRemByMat(); toast('✏️ Обрезок обновлён','ok');
}
function cancelPieceEdit(){
  pieceEditState=null;
  renderRemByMat();
}
function deletePiece(recId,pi){
  // recId и pi — реальные значения из рендера
  confirm2('Удалить этот обрезок?',()=>{
    const rec=db.remainders.find(r=>r.id===recId);
    if(!rec){ toast('Запись не найдена','err'); return; }
    // Ищем кусок: сначала по прямому индексу, потом по реальному через realPieceIdx
    let realPi = (pi>=0 && pi<rec.pieces.length) ? pi : realPieceIdx(rec, pi);
    if(realPi<0||realPi>=rec.pieces.length){ toast('Обрезок не найден','err'); return; }
    const piece=rec.pieces[realPi];
    if(piece) deletedPieces.add(makePieceKey(recId, piece));
    rec.pieces.splice(realPi,1);
    if(!rec.pieces.length) db.remainders=softDelete(db.remainders, recId);
    if(pieceEditState&&pieceEditState.recId===recId&&pieceEditState.pi===pi) pieceEditState=null;
    save();
    localStorage.setItem('lm7_deleted_pieces',JSON.stringify([...deletedPieces]));
    renderRemByMat();
    toast('✅ Обрезок удалён','ok');
  });
}

// ══════════════════════════════════════ REM BY MATERIAL
let remVisibleMats=[]; // материалы, показанные сейчас (для «Свернуть/Развернуть все»)

// Короткая дата для строки обрезка: 01.04.26 16:56 (понимает и 01.04.2026, и 01.04.26)
function shortDt(dt){
  const m=String(dt||'').match(/(\d{2})\.(\d{2})\.(\d{2,4})[,\s]+(\d{2}):(\d{2})/);
  return m?`${m[1]}.${m[2]}.${m[3].slice(-2)} ${m[4]}:${m[5]}`:String(dt||'');
}

// Свернуть / развернуть все списки материалов
function toggleAllRemGroups(){
  if(selMode) return;
  const allOpen=remVisibleMats.length>0&&remVisibleMats.every(m=>remOpenGroups.has(m));
  if(allOpen) remVisibleMats.forEach(m=>remOpenGroups.delete(m));
  else remVisibleMats.forEach(m=>remOpenGroups.add(m));
  renderRemByMat();
}
function updateRemToggle(){
  const el=document.getElementById('fchip-rem-toggle'); if(!el) return;
  const allOpen=remVisibleMats.length>0&&remVisibleMats.every(m=>remOpenGroups.has(m));
  el.innerHTML=allOpen?'▲ Свернуть':'▼ Развернуть';
}

function renderRemByMat(){
  remVisibleMats=[];
  updatePlaceChips();

  const container=document.getElementById('rem-by-mat');
  const stkQ=(document.getElementById('stk-s')?.value||'').toLowerCase();

  // Add dt to allPieces lookup
  const allPieces=[];
  db.remainders.forEach(rec=>{
    rec.pieces.forEach((p,pi)=>{
      const piecePlace=p.place||rec.place||'';
      if(remPlaceFilter&&piecePlace!==remPlaceFilter) return;
      if(stkQ&&!p.mat.toLowerCase().includes(stkQ)) return;
      allPieces.push({recId:rec.id,pi,mat:p.mat,w:p.w,l:p.l,qty:p.qty,type:p.type,place:piecePlace,m2:p.w*p.l*p.qty/1e6, dt:rec.dt||''});
    });
  });

  if(!allPieces.length){container.innerHTML='<div class="empty"><div class="ei">✂️</div>Нет данных об обрезках</div>';return;}

  // Apply ≥0.5м² or ≤0.5м² filter per individual piece BEFORE grouping
  const visiblePieces = remBigFilter
    ? allPieces.filter(p => p.m2 >= 0.5)
    : remSmallFilter
      ? allPieces.filter(p => p.m2 <= 0.5)
      : allPieces;

  if(!visiblePieces.length){container.innerHTML=`<div class="empty"><div class="ei">📐</div>${remBigFilter?'Нет обрезков ≥ 0,5 м²':'Нет обрезков ≤ 0,5 м²'}</div>`;return;}

  // Group by material
  const byMat={};
  visiblePieces.forEach(p=>{if(!byMat[p.mat]) byMat[p.mat]=[];byMat[p.mat].push(p);});
  const mats=Object.keys(byMat).sort();
  remVisibleMats=mats;

  container.innerHTML=mats.map((mat,mi)=>{
    const pieces=byMat[mat];
    const totalAdd=pieces.filter(p=>p.type!=='scrap_sub').reduce((s,p)=>s+p.m2,0);
    const totalSub=pieces.filter(p=>p.type==='scrap_sub').reduce((s,p)=>s+p.m2,0);
    const netM2=totalAdd-totalSub;
    const totalQty=pieces.filter(p=>p.type!=='scrap_sub').reduce((s,p)=>s+(p.qty||1),0);
    const netTag=`<span class="remarea-badge rem-net" style="display:inline-flex;align-items:center;gap:5px"><span style="color:var(--text);font-weight:800">${totalQty} шт.</span><span style="opacity:.5">·</span>${netM2.toFixed(3)} м²</span>`;

    const groupKeys=pieces.map(p=>`${p.recId}-${p.pi}`);
    const groupAllSel=selMode&&groupKeys.length>0&&groupKeys.every(k=>selSet.has(k));
    const groupSomeSel=selMode&&groupKeys.some(k=>selSet.has(k));
    const groupSelCls=groupAllSel?'sel-all':groupSomeSel?'sel-some':'';
    const groupSelIcon=groupAllSel?'✓':groupSomeSel?'−':'';
    // collapsed state stored in a Set
    const isOpen=remOpenGroups.has(mat);

    const pieceRows=pieces.map(p=>{
      const isSub=p.type==='scrap_sub';
      const isEd=!selMode&&pieceEditState&&pieceEditState.recId===p.recId&&pieceEditState.pi===p.pi;
      const pieceKey=`${p.recId}-${p.pi}`;
      const isSel=selSet.has(pieceKey);
      const m2Html=`<span class="piece-m2 pm2-pos">${p.m2.toFixed(3)} м²</span>`;
      const placeTag=`<span class="piece-place">${p.place||''}</span>`;
      const dateTag=p.dt?`<span class="piece-dt">${shortDt(p.dt)}</span>`:'';
      const typeTag=`<span class="piece-type-ico"${p.type==='scrap_add'?' title="Добавлен вручную">✍':'>'}</span>`;

      const placeOpts=PLACES.map(pl=>`<option value="${pl}"${p.place===pl?' selected':''}>${pl}</option>`).join('')+`<option value="${CUSTOM_VAL}">✏️ Свой вариант...</option>`;
      const matOptsAc=`<div class="ac-wrap"><input type="text" id="pef-mat-${p.recId}-${p.pi}" value="${p.mat.replace(/"/g,'&quot;')}" autocomplete="off" oninput="acInputEl(this,'pef-mat-${p.recId}-${p.pi}')" onfocus="acInputEl(this,'pef-mat-${p.recId}-${p.pi}')" onblur="acBlur('pef-mat-${p.recId}-${p.pi}')" onkeydown="acKey(event,'pef-mat-${p.recId}-${p.pi}')"><div class="ac-dropdown" id="ac-pef-mat-${p.recId}-${p.pi}"></div></div>`;
      const editForm=isEd?`
        <div class="piece-edit-form show" id="pef-form-${p.recId}-${p.pi}">
          <div class="edit-banner" style="margin-bottom:8px">✏️ Редактировать обрезок<button class="edit-cancel" onclick="cancelPieceEdit()">✕ Отмена</button></div>
          <div class="fg" style="margin-bottom:7px"><label>Материал</label>${matOptsAc}</div>
          <div class="frow c3">
            <div class="fg"><label>Ширина</label><input type="number" id="pef-w-${p.recId}-${p.pi}" value="${p.w}" inputmode="numeric"></div>
            <div class="fg"><label>Длина</label><input type="number" id="pef-l-${p.recId}-${p.pi}" value="${p.l}" inputmode="numeric"></div>
            <div class="fg"><label>Кол-во</label><input type="number" id="pef-qty-${p.recId}-${p.pi}" value="${p.qty}" inputmode="numeric" min="1"></div>
          </div>
          <div class="fg"><label>Место хранения</label><select id="pef-place-${p.recId}-${p.pi}">${placeOpts}</select></div>
          <button class="btn bprim bfull" onclick="savePieceEdit()">💾 Сохранить изменения</button>
        </div>`:''

      return `<div class="piece-row${isEd?' is-editing':''}${isSel?' sel-selected':''}"
          id="pr-${p.recId}-${p.pi}"
          data-recid="${p.recId}" data-pi="${p.pi}">
        <span class="sel-check">${isSel?'✓':''}</span>
        <span class="piece-left"><span class="piece-sz">${p.w}х${p.l}</span>${dateTag}</span>
        <span class="piece-right">
          ${placeTag}
          ${typeTag}
          <span class="piece-pcs">${p.qty} шт.</span>
          ${m2Html}
          <button class="piece-del-btn" onclick="event.stopPropagation();deletePiece(${p.recId},${p.pi})">✕</button>
        </span>
      </div>${editForm}`;
    }).join('');

    const matEsc=mat.replace(/'/g,"\\'");
    return `<div class="remcard${selMode?' sel-mode':''}" data-mat="${mat.replace(/"/g,'&quot;')}" data-mat-idx="${mi}" id="remcard-${mi}">
      <div class="remmat-name" style="display:flex;align-items:center;gap:8px;cursor:pointer" id="remmat-hd-${mi}"
           onclick="toggleRemGroup('${matEsc}')">
        <span class="remmat-sel ${groupSelCls}" id="remmat-chk-${mi}">${groupSelIcon}</span>
        <span style="flex:1">${mat}</span>
        <span style="display:flex;align-items:center;gap:6px">
          ${netTag}
          <span style="font-size:12px;color:var(--muted);transition:transform .2s;${isOpen?'transform:rotate(180deg)':''}">▼</span>
        </span>
      </div>
      <div style="display:${isOpen?'block':'none'}" id="remgroup-body-${mi}">
        ${pieceRows}
      </div>
    </div>`;
  }).join('');

  // ── Attach event handlers after DOM is ready ──
  mats.forEach((mat,mi)=>{
    const pieces=byMat[mat];
    const card=document.getElementById(`remcard-${mi}`);
    if(!card) return;

    // Long-press on individual piece row → enter sel mode + select that piece
    pieces.forEach(p=>{
      const row=document.getElementById(`pr-${p.recId}-${p.pi}`);
      if(!row) return;

      let lpTimer=null, lpStartX=0, lpStartY=0;
      row.addEventListener('pointerdown', e=>{
        if(e.target.closest('button')||e.target.closest('.piece-edit-form')) return;
        lpStartX=e.clientX; lpStartY=e.clientY;
        lpTimer=setTimeout(()=>{
          lpTimer=null;
          if(!selMode) enterSelMode();
          selSet.add(`${p.recId}-${p.pi}`);
          updateSelCount(); renderRemByMat();
          if(navigator.vibrate) navigator.vibrate(40);
        }, 500);
      });
      const cancelLP=(e)=>{
        if(!lpTimer) return;
        // Отменяем только при движении > 8px
        if(e.type==='pointermove'){
          const dx=e.clientX-lpStartX, dy=e.clientY-lpStartY;
          if(Math.sqrt(dx*dx+dy*dy)<8) return;
        }
        clearTimeout(lpTimer); lpTimer=null;
      };
      row.addEventListener('pointerup', cancelLP);
      row.addEventListener('pointercancel', cancelLP);
      row.addEventListener('pointermove', cancelLP);

      row.addEventListener('click', e=>{
        if(e.target.closest('button')||e.target.closest('.piece-edit-form')) return;
        if(selMode){ e.stopPropagation(); togglePieceSel(`${p.recId}-${p.pi}`); }
        else { openPieceEdit(p.recId,p.pi); }
      });
    });

    // Group header click — in sel mode toggle all; collapse handled by onclick in HTML
    const hdr=document.getElementById(`remmat-hd-${mi}`);
    if(hdr) hdr.addEventListener('click', e=>{
      if(!selMode) return; // collapse handled by toggleRemGroup in onclick
      if(e.target.closest('button')) return;
      e.stopPropagation();
      const keys=pieces.map(p=>`${p.recId}-${p.pi}`);
      const allSel=keys.every(k=>selSet.has(k));
      if(allSel) keys.forEach(k=>selSet.delete(k));
      else keys.forEach(k=>selSet.add(k));
      updateSelCount(); renderRemByMat();
    });
  });
  updateRemToggle();
}

// ══════════════════════════════════════ REM BIG FILTER
function toggleRemBig(){
  remBigFilter=!remBigFilter;
  if(remBigFilter) remSmallFilter=false;
  document.getElementById('fchip-rem-big').classList.toggle('on',remBigFilter);
  document.getElementById('fchip-rem-small').classList.toggle('on',false);
  syncRemGroupsToFilter();
  renderRemByMat();
}
function toggleRemSmall(){
  remSmallFilter=!remSmallFilter;
  if(remSmallFilter) remBigFilter=false;
  document.getElementById('fchip-rem-small').classList.toggle('on',remSmallFilter);
  document.getElementById('fchip-rem-big').classList.toggle('on',false);
  syncRemGroupsToFilter();
  renderRemByMat();
}
// Открывает все группы при любом активном фильтре, закрывает все если фильтров нет
// Переключает на вкладку Обрезки, открывает нужный материал, ставит фильтр места
function goToRemWithPlace(mat, place){
  // 1. Сворачиваем все группы, открываем только нужный материал
  remOpenGroups.clear();
  if(mat) remOpenGroups.add(mat);
  // 2. Ставим фильтр места если есть
  if(place) remPlaceFilter = place;
  // 3. Переключаем вкладку на Обрезки
  stockTab = 'rem';
  document.querySelectorAll('.itab').forEach(b=>b.classList.remove('active'));
  const remTabBtn = document.querySelector('.itab[onclick*=\'rem\']');
  if(remTabBtn) remTabBtn.classList.add('active');
  document.getElementById('panel-balance').style.display='none';
  document.getElementById('panel-rem').style.display='';
  document.getElementById('panel-top-balance').style.display='none';
  document.getElementById('panel-top-rem').style.display='';
  document.getElementById('fab-rem')?.classList.add('visible');
  // 4. Переключаем раздел Склад если не там
  const stockNavBtn = document.querySelector('.nbtn[onclick*=\'stock\']');
  if(stockNavBtn && !stockNavBtn.classList.contains('active')){
    go('stock', stockNavBtn);
  } else {
    renderRemByMat();
  }
}

function syncRemGroupsToFilter(){
  const anyFilter = remBigFilter || remSmallFilter || !!remPlaceFilter;
  if(anyFilter){
    const stkQ=(document.getElementById('stk-s')?.value||'').toLowerCase();
    db.remainders.forEach(rec=>{
      rec.pieces.forEach(p=>{
        const piecePlace=p.place||rec.place||'';
        if(stkQ&&!p.mat.toLowerCase().includes(stkQ)) return;
        if(remPlaceFilter&&piecePlace!==remPlaceFilter) return;
        const m2=p.w*p.l*(p.qty||1)/1e6;
        // Для фильтров размера — открываем только подходящие материалы
        if(remBigFilter&&m2>=0.5){ remOpenGroups.add(p.mat); return; }
        if(remSmallFilter&&m2<=0.5){ remOpenGroups.add(p.mat); return; }
        // Для фильтра места — открываем все материалы с совпадающим местом
        if(remPlaceFilter&&!remBigFilter&&!remSmallFilter) remOpenGroups.add(p.mat);
      });
    });
  } else {
    // Все фильтры выключены — свернуть все группы
    remOpenGroups.clear();
  }
}

function toggleRemGroup(mat){
  if(selMode) return; // в режиме выделения — не сворачиваем
  if(remOpenGroups.has(mat)) remOpenGroups.delete(mat);
  else remOpenGroups.add(mat);
  renderRemByMat();
}
