window.__B=window.__B||{};__B['income']='2026-10-13a';
// ▸ income.js — Приход
function saveIncome(){
  const mat=normMaterial((document.getElementById('in-mat').value||'').trim());      // «акрил 3мм» → «Акрил 3 мм (мол.)»
  document.getElementById('in-mat').value=mat;
  const size=document.getElementById('in-pre').value;
  const placeVal=document.getElementById('in-place').value; const qty=parseInt(document.getElementById('in-qty').value);
  if(!mat||!size||size===CUSTOM_VAL||!qty||qty<1){toast('Заполните все поля','err');return;}
  const order=readOrderField('in-order'); if(order===null){toast('Введите заказ: номер_заказчик','err');return;}
  const place=placeVal===CUSTOM_VAL?'':placeVal;
  if(!MATS.includes(mat)){MATS.push(mat);releaseRename('mats',mat);save();}
  if(order) ensureOrder(order);
  const sz=getSizeWL('in-pre');
  const rec={mat,size,w:sz.w,l:sz.l,qty,place,order,note:document.getElementById('in-note').value.trim()};
  if(editMode.income!==null){
    const idx=db.income.findIndex(r=>r.id===editMode.income);
    if(idx>=0) db.income[idx]={...db.income[idx],...rec};
    cancelEdit('income'); toast('✏️ Приход обновлён','ok');
  } else {
    rec.id=Date.now(); rec.dt=now(); db.income.push(rec);
    lastInMat=mat;
    document.getElementById('in-mat').value='';
    document.getElementById('in-qty').value='1';
    document.getElementById('in-note').value='';
    setOrderSelect('in-order',''); fillOrderSelects();
    document.getElementById('add-income')?.classList.remove('open');
    toast('✅ Приход записан','ok');
    save(); renderAll();
    highlightLastRow('in-tbody'); return;
  }
  save(); renderAll();
}
function editIncome(id){
  const r=db.income.find(x=>x.id===id); if(!r) return;
  editMode.income=id;
  document.getElementById('add-income').classList.add('open');
  document.getElementById('in-edit-banner').style.display='flex';
  document.getElementById('in-save-btn').textContent='💾 Сохранить изменения';
  document.getElementById('in-save-btn').className='btn bedit bbig';
  document.getElementById('in-mat').value=r.mat; acUpdateClear('in-mat');
  document.getElementById('in-pre').value=r.size;
  document.getElementById('in-qty').value=r.qty;
  document.getElementById('in-note').value=r.note||'';
  setOrderSelect('in-order',r.order||'');
  const sel=document.getElementById('in-place');
  if(r.place&&[...sel.options].some(o=>o.value===r.place)) sel.value=r.place;
  else if(!r.place&&sel.options.length>0) sel.selectedIndex=0;
  onSelectChange('in-place','in-place-custom');
  renderIn(); document.querySelector('#sec-income .sec-body').scrollTop=0;
}
function cancelEdit(type){
  if(type==='income'){
    editMode.income=null;
    setOrderSelect('in-order','');
    document.getElementById('add-income').classList.remove('open');
    document.getElementById('in-edit-banner').style.display='none';
    document.getElementById('in-save-btn').textContent='✅ Записать приход';
    document.getElementById('in-save-btn').className='btn bprim bbig';
    renderIn();
  } else {
    editMode.expense=null;
    document.getElementById('add-expense').classList.remove('open');
    document.getElementById('out-edit-banner').style.display='none';
    document.getElementById('out-save-btn').textContent='📤 Записать расход';
    document.getElementById('out-save-btn').className='btn bdng bbig';
    document.getElementById('out-mat').value='';
    setOrderSelect('out-order','');
    document.getElementById('scrap-preview').style.display='none';
    document.getElementById('scrap-neg-preview').style.display='none';
    renderOut();
  }
}
function renderIn(){
  updatePlaceChips();
  const tb=document.getElementById('in-tbody');
  let rows=[...db.income].reverse();
  const sq=(document.getElementById('in-s')?.value||'').toLowerCase();
  if(inPlaceFilter) rows=rows.filter(r=>(r.place||'')=== inPlaceFilter);
  if(sq) rows=rows.filter(r=>searchMatch(incHay(r),sq));        // ищем по материалу, размеру, месту, заказу, примечанию, дате
  rows=rows.slice(0,60);
  const cols=colsFor('in'); colsHead('in');
  if(!rows.length){tb.innerHTML=`<tr><td colspan="${cols.length+1}"><div class="empty"><div class="ei">📭</div>Нет записей</div></td></tr>`;return;}
  const total=db.income.filter(r=>!inPlaceFilter||(r.place||'')=== inPlaceFilter).length;
  tb.innerHTML=rows.map((r,i)=>`<tr class="trow-edit ${editMode.income===r.id?'is-editing':''}" onclick="editIncome(${r.id})">${cols.map(c=>incCell(c,r,i,total,cols)).join('')}<td><button class="dbtn" onclick="event.stopPropagation();del('income',${r.id})">✕</button></td></tr>`).join('');
}
