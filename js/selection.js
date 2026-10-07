// ▸ selection.js — Режим выделения обрезков и перемещение
// ══════════════════════════════════════ SELECTION MODE
function enterSelMode(){
  selMode=true; selSet.clear();
  document.getElementById('rem-by-mat').classList.add('sel-mode-on');
  document.getElementById('rem-sel-bar').style.display='flex';
  // disable piece edit while in selection
  if(pieceEditState){ cancelPieceEdit(); }
  renderRemByMat();
}
function exitSelMode(){
  selMode=false; selSet.clear();
  document.getElementById('rem-by-mat').classList.remove('sel-mode-on');
  document.getElementById('rem-sel-bar').style.display='none';
  renderRemByMat();
}

function deleteSelected(){
  if(!selSet.size){ toast('Ничего не выбрано','err'); return; }
  const count=selSet.size;
  confirm2(`Удалить ${count} обрезок(ов)?`, ()=>{
    // Группируем по recId чтобы удалять правильно
    const byRec={};
    selSet.forEach(key=>{
      const [recId,pi]=key.split('-').map(Number);
      if(!byRec[recId]) byRec[recId]=[];
      byRec[recId].push(pi);
    });
    Object.entries(byRec).forEach(([recId,pis])=>{
      const rec=db.remainders.find(r=>r.id===Number(recId));
      if(!rec) return;
      // Удаляем в обратном порядке индексов чтобы не сдвигались
      pis.sort((a,b)=>b-a).forEach(pi=>{
        const piece=rec.pieces[pi];
        if(piece) deletedPieces.add(makePieceKey(Number(recId), piece));
        rec.pieces.splice(pi,1);
      });
      if(!rec.pieces.length){
        db.remainders=softDelete(db.remainders, rec.id);
      } else {
        rec.totalM2=+rec.pieces.filter(x=>x.type!=='scrap_sub').reduce((s,x)=>s+x.w*x.l*(x.qty||1)/1e6,0).toFixed(4);
        rec.totalPcs=rec.pieces.reduce((s,x)=>s+(x.qty||1),0);
      }
    });
    localStorage.setItem('lm7_deleted_pieces',JSON.stringify([...deletedPieces]));
    save(); exitSelMode();
    toast(`🗑️ Удалено ${count} обрезков`,'ok');
  });
}
function updateSelCount(){
  document.getElementById('rem-sel-count').textContent=`${selSet.size} выбрано`;
}
function togglePieceSel(key){
  if(selSet.has(key)) selSet.delete(key); else selSet.add(key);
  updateSelCount();
  renderRemByMat();
}
function toggleGroupSel(mat, pieces){
  // Все ключи этой группы
  const keys=pieces.map(p=>`${p.recId}-${p.pi}`);
  const allSel=keys.every(k=>selSet.has(k));
  if(allSel){ keys.forEach(k=>selSet.delete(k)); }
  else { keys.forEach(k=>selSet.add(k)); }
  updateSelCount();
  renderRemByMat();
}

// Long-press handlers — attach to remcard header
function onRemcardPressStart(mat, pieces){
  selLongPressTimer=setTimeout(()=>{
    if(!selMode) enterSelMode();
    // Auto-select this group on long press
    const keys=pieces.map(p=>`${p.recId}-${p.pi}`);
    keys.forEach(k=>selSet.add(k));
    updateSelCount();
    renderRemByMat();
    if(navigator.vibrate) navigator.vibrate(40);
  }, 500);
}
function onRemcardPressEnd(){
  clearTimeout(selLongPressTimer);
}

// ══════════════════════════════════════ MOVE MODAL
function openMoveModal(){
  if(!selSet.size){ toast('Выберите хотя бы один обрезок','err'); return; }
  const sel=document.getElementById('move-place-sel');
  sel.innerHTML='';
  PLACES.forEach(p=>sel.appendChild(new Option(p,p)));
  document.getElementById('move-place-desc').textContent=`Выбрано: ${selSet.size} обрезков`;
  document.getElementById('move-place-modal').classList.add('show');
}

// Кнопка 📍 в заголовке группы — перемещает выбранные обрезки этой группы (или все если ничего не выбрано)
function openGroupMoveModal(mat, mi){
  const card=document.getElementById(`remcard-${mi}`);
  if(!card){ toast('Группа не найдена','err'); return; }

  // Собираем все ключи строк этой группы
  const allRows=card.querySelectorAll('.piece-row[id^="pr-"]');
  const allKeys=[...allRows].map(r=>r.id.replace('pr-',''));

  // Если режим выделения и есть выбранные в этой группе — берём только их
  const groupSelectedKeys=allKeys.filter(k=>selSet.has(k));
  const keysToMove=selMode && groupSelectedKeys.length>0 ? groupSelectedKeys : allKeys;

  if(!keysToMove.length){ toast('Нет обрезков для перемещения','err'); return; }

  // Временно помещаем в selSet только эти ключи
  const prevSelSet=new Set(selSet);
  const prevSelMode=selMode;
  selMode=true;
  selSet.clear();
  keysToMove.forEach(k=>selSet.add(k));
  updateSelCount();

  const label=groupSelectedKeys.length>0 && prevSelMode
    ? `${mat}: ${keysToMove.length} выбрано`
    : `${mat}: все ${keysToMove.length} обрезков`;

  const sel=document.getElementById('move-place-sel');
  sel.innerHTML='';
  PLACES.forEach(p=>sel.appendChild(new Option(p,p)));
  document.getElementById('move-place-desc').textContent=label;

  const modal=document.getElementById('move-place-modal');
  modal._prevSelSet=prevSelSet;
  modal._prevSelMode=prevSelMode;
  modal.classList.add('show');
}

function closeMoveModal(){
  const modal=document.getElementById('move-place-modal');
  const prevSelMode=modal._prevSelMode;
  const prevSelSet=modal._prevSelSet;
  modal.classList.remove('show');
  modal._prevSelMode=undefined;
  modal._prevSelSet=undefined;
  // Восстанавливаем предыдущее состояние выделения
  if(prevSelMode===false){
    exitSelMode();
  } else if(prevSelSet){
    selSet.clear();
    prevSelSet.forEach(k=>selSet.add(k));
    updateSelCount();
    renderRemByMat();
  }
}

function applyMove(){
  const newPlace=document.getElementById('move-place-sel').value;
  selSet.forEach(key=>{
    const parts=key.split('-');
    const recId=Number(parts[0]), pi=Number(parts[1]);
    const rec=db.remainders.find(r=>r.id===recId); if(!rec) return;
    const p=rec.pieces[pi]; if(!p) return;
    p.place=newPlace;
    if(rec.pieces.every(pp=>pp.place===newPlace)) rec.place=newPlace;
  });
  save();
  const modal=document.getElementById('move-place-modal');
  const prevSelMode=modal._prevSelMode;
  modal.classList.remove('show');
  modal._prevSelMode=undefined;
  modal._prevSelSet=undefined;
  // После перемещения выходим из режима выделения
  exitSelMode();
  renderRemByMat();
  toast(`📍 Перемещено → ${newPlace}`,'ok');
}
