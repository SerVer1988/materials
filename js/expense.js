window.__B=window.__B||{};__B['expense']='2026-10-13a';
// ▸ expense.js — Расход
// ══════════════════════════════════════ EXPENSE
function saveExpense(){
  const mat=normMaterial((document.getElementById('out-mat').value||'').trim()); const qty=parseInt(document.getElementById('out-qty').value);
  if(!mat||!qty||qty<1){toast('Заполните все поля','err');return;}
  const order=readOrderField('out-order'); if(order===null){toast('Введите заказ: номер_заказчик','err');return;}
  if(!MATS.includes(mat)){MATS.push(mat);releaseRename('mats',mat);save();}
  const detStr=document.getElementById('out-det').value.trim(); const det=parseSizeStr(detStr);
  const sheetSel=isSheetSelected(); let size='—',w=0,l=0,etype='partial';
  if(sheetSel){const sz=getSizeWL('out-pre');size=document.getElementById('out-pre').value;w=sz.w;l=sz.l;etype='full';}
  const cat=normCategory((document.getElementById('out-cat')?.value||'').trim());            // «табличка» → «Табличка(и)»
  const cut=parseFloat(String(document.getElementById('out-cut')?.value||'').replace(',','.'))||0;   // длина реза, мм
  const detLabel=(document.getElementById('out-dlabel')?.value||'').trim();                  // размер изделия из подписи (нужно), если в «вырезано» ушёл размер объекта
  ['out-cat','out-cut','out-dlabel'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  const brak=!!document.getElementById('out-brak')?.checked;      // «Списать в брак»: лист списан, но в «израсходовано» по заказу не засчитывается
  const rec={mat,size,w,l,qty,etype,order,det:detStr,note:document.getElementById('out-note').value.trim(),brak,cat,cut,detLabel};
  const brakBox=document.getElementById('out-brak'); if(brakBox) brakBox.checked=false;
  if(editMode.expense!==null){
    const idx=db.expense.findIndex(r=>r.id===editMode.expense);
    if(idx>=0){
      const oldRec = db.expense[idx];
      db.expense[idx]={...oldRec,...rec};
      syncBrakPlan(db.expense[idx]);                       // брак поставили/сняли — строка возврата детали в Плане
      if(order) ensureOrder(order);
      // ── Обрезки от этого листа ──
      // Пересчёт только если изменилась геометрия (размер листа/изделия, кол-во, тип). Правка заказа, примечания, брака обрезки не трогает,
      // а ручные правки в окне «Остатки после реза» не затираются.
      const expId = oldRec.id;
      const linkedScrap = db.remainders.find(r=>r.id===expId+1 || r.expenseId===expId);
      const newDet = parseSizeStr(rec.det), oldDet = parseSizeStr(oldRec.det);
      const geomChanged = oldRec.w!==rec.w || oldRec.l!==rec.l || oldRec.qty!==rec.qty || oldRec.etype!==rec.etype
        || !oldDet!==!newDet || (oldDet&&newDet&&(oldDet.w!==newDet.w||oldDet.l!==newDet.l));
      if(geomChanged){
        if(linkedScrap){
          // Обрезок уже пошёл в дело (есть списание кусков с такими размерами) — автоматически не пересчитываем, чтобы не сломать учёт
          const used = db.remainders.some(r=>r.id!==linkedScrap.id && (r.pieces||[]).some(p=>p.type==='scrap_sub' && p.mat===oldRec.mat && linkedScrap.pieces.some(o=>o.w===p.w && o.l===p.l)));
          if(used){
            setTimeout(()=>toast('⚠️ Обрезки от этого листа уже использованы — поправьте их вручную на вкладке «Обрезки»','err'),700);
          } else if(rec.etype==='full' && newDet){
            const cl = linkedScrap.calc ? !!linkedScrap.calc.cutLong : undefined;   // выбор «по длинной стороне» сохранён в записи обрезков
            if(linkedScrap.calc) linkedScrap.calc = {...linkedScrap.calc, shW:rec.w, shL:rec.l, dw:newDet.w, dl:newDet.l, qty:rec.qty, mat:rec.mat};
            const rawPieces = calcScraps(rec.w, rec.l, newDet.w, newDet.l, cl);
            if(rawPieces.length){
              const prev = linkedScrap.pieces;
              // место хранения сохраняем по каждому куску (раньше всем ставилось место первого)
              linkedScrap.pieces = rawPieces.map((p,i)=>({mat:rec.mat, w:p.w, l:p.l, qty:rec.qty, type:'scrap_add', place:(prev[i]?.place ?? prev[0]?.place ?? '')}));
              linkedScrap.totalM2 = +linkedScrap.pieces.reduce((s,p)=>s+p.w*p.l*p.qty/1e6,0).toFixed(4);
              linkedScrap.totalPcs = linkedScrap.pieces.length * rec.qty;
            } else {
              db.remainders = softDelete(db.remainders, linkedScrap.id);      // обрезков нет (деталь слишком большая)
            }
          } else {
            db.remainders = softDelete(db.remainders, linkedScrap.id);        // стал «из обрезка» или изделие убрали
          }
        } else if(rec.etype==='full' && newDet){
          // Обрезка не было, а теперь есть изделие: создаём — но только если раньше обрезков и не ожидалось
          // (если вы удалили обрезок вручную, он не воскресает)
          const oldHad = oldRec.etype==='full' && oldDet && calcScraps(oldRec.w, oldRec.l, oldDet.w, oldDet.l, false).length>0;
          if(!oldHad){
            const rawPieces = calcScraps(rec.w, rec.l, newDet.w, newDet.l, false);
            if(rawPieces.length){
              const pieces = rawPieces.map(p=>({mat:rec.mat, w:p.w, l:p.l, qty:rec.qty, type:'scrap_add', place:''}));
              const newId = Date.now();
              db.remainders.push({
                id:newId, dt:now(), pieces, expenseId:expId,
                calc:{shW:rec.w, shL:rec.l, dw:newDet.w, dl:newDet.l, qty:rec.qty, mat:rec.mat, cutLong:false},
                totalM2:+pieces.reduce((s,p)=>s+p.w*p.l*rec.qty/1e6,0).toFixed(4), totalPcs:pieces.length*rec.qty, place:''
              });
              setTimeout(()=>openScrapModal(newId),500);      // подтвердить размеры и место хранения
            }
          }
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
// Брак детали: материал списан как обычно, а сама деталь возвращается в заказ — в Плане появляется строка на повторную вырезку
// (точный размер детали; под него сначала ищется обрезок, иначе нужен лист). Если по заказу уже есть строка на эту деталь —
// она сама вернётся в работу (брак не считается вырезанной деталью), дубль не создаётся. Брак снят/запись удалена — строка исчезает.
function syncBrakPlan(rec){
  if(!db.plan) db.plan=[];
  const det=parseSizeStr(rec.det);
  const want=!!(rec.brak&&rec.order&&det);
  const auto=db.plan.find(x=>x.fromBrak===rec.id);
  if(!want){ if(auto) db.plan=softDelete(db.plan,auto.id); return; }
  const exists=db.plan.some(x=>x!==auto&&x.order===rec.order&&x.mat===rec.mat&&x.stripW>0&&sameDims({w:x.stripW,l:x.stripL},det));
  if(exists){ if(auto) db.plan=softDelete(db.plan,auto.id); return; }
  let w=rec.w, l=rec.l;
  if(!(w>0&&l>0)){                                           // расход «из обрезка» — лист подбираем по размеру детали
    const pb=placeBlock(rec.mat,det.w,det.l);
    if(pb){ w=pb.sh.w; l=pb.sh.l; } else { const s=SIZES.map(parseSizeStr).filter(Boolean)[0]||{w:1220,l:2440}; w=s.w; l=s.l; }
  }
  const fields={order:rec.order,mat:rec.mat,size:fmtSheet(w,l),w,l,qty:0,stripW:det.w,stripL:det.l};
  if(auto) Object.assign(auto,fields);
  else db.plan.push({id:Date.now()+1,...fields,blocks:null,frac:null,noFit:false,status:'buy',booked:0,created:now(),fromBrak:rec.id});
  ensureOrder(rec.order);
}
// Категория и длина реза (из подписи Corel или вручную)
function setExpenseExtra(cat,cut,detLabel){
  const c=document.getElementById('out-cat'), u=document.getElementById('out-cut'), d=document.getElementById('out-dlabel');
  if(c) c.value=(typeof normCategory==='function'?normCategory(cat||''):(cat||'')); if(u) u.value=cut||''; if(d) d.value=detLabel||'';
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
  setExpenseExtra(r.cat||'',r.cut||'',r.detLabel||'');
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
  if(sq) rows=rows.filter(r=>searchMatch(expHay(r),sq));        // материал, размер, изделие, заказ, заказчик, менеджер, категория, примечание, дата
  if(outPlaceFilter) rows=rows.filter(r=>expRowPlaces(r).has(outPlaceFilter));
  updatePlaceChips();
  const total=rows.length;
  rows=rows.slice(0,60);
  const cols=colsFor('out'); colsHead('out');
  if(!rows.length){tb.innerHTML=`<tr><td colspan="${cols.length+1}"><div class="empty"><div class="ei">📭</div>Нет записей</div></td></tr>`;return;}
  tb.innerHTML=rows.map((r,i)=>`<tr class="trow-edit ${editMode.expense===r.id?'is-editing':''}" onclick="editExpense(${r.id})">${cols.map(c=>outCell(c,r,i,total,cols)).join('')}<td><button class="dbtn" onclick="event.stopPropagation();del('expense',${r.id})">✕</button></td></tr>`).join('');
}

// Отмена редактирования расхода сбрасывает галочку «Списать в брак» (cancelEdit лежит в income.js)
(function(){
  const _cancelEdit=window.cancelEdit;
  window.cancelEdit=function(type){
    if(type==='expense'){ const b=document.getElementById('out-brak'); if(b) b.checked=false; setExpenseExtra('',''); }
    return _cancelEdit.apply(this,arguments);
  };
})();
