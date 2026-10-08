// ▸ income.js — Приход
function saveIncome(){
  const mat=(document.getElementById('in-mat').value||'').trim();
  const size=document.getElementById('in-pre').value;
  const placeVal=document.getElementById('in-place').value; const qty=parseInt(document.getElementById('in-qty').value);
  if(!mat||!size||size===CUSTOM_VAL||!qty||qty<1){toast('Заполните все поля','err');return;}
  const place=placeVal===CUSTOM_VAL?'':placeVal;
  if(!MATS.includes(mat)){MATS.push(mat);save();}
  const sz=getSizeWL('in-pre');
  const rec={mat,size,w:sz.w,l:sz.l,qty,place,note:document.getElementById('in-note').value.trim()};
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
  const sel=document.getElementById('in-place');
  if(r.place&&[...sel.options].some(o=>o.value===r.place)) sel.value=r.place;
  else if(!r.place&&sel.options.length>0) sel.selectedIndex=0;
  onSelectChange('in-place','in-place-custom');
  renderIn(); document.querySelector('#sec-income .sec-body').scrollTop=0;
}
function cancelEdit(type){
  if(type==='income'){
    editMode.income=null;
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
    document.getElementById('scrap-preview').style.display='none';
    document.getElementById('scrap-neg-preview').style.display='none';
    renderOut();
  }
}
function renderIn(){
  // ── Place filter chips ──
  const filterRow=document.getElementById('in-place-filter');
  if(filterRow){
    const usedPlaces=[...new Set(db.income.map(r=>r.place||'').filter(Boolean))].sort();
    if(usedPlaces.length>1){
      filterRow.style.display='flex';
      filterRow.innerHTML=usedPlaces.map(p=>`<span class="place-chip ${inPlaceFilter===p?'on':''}" onclick="setInPlace('${p.replace(/'/g,"\\'")}')">${p}</span>`).join('');
    } else { filterRow.style.display='none'; filterRow.innerHTML=''; }
  }
  const tb=document.getElementById('in-tbody');
  let rows=[...db.income].reverse();
  const sq=(document.getElementById('in-s')?.value||'').toLowerCase();
  if(inPlaceFilter) rows=rows.filter(r=>(r.place||'')=== inPlaceFilter);
  if(sq) rows=rows.filter(r=>r.mat&&r.mat.toLowerCase().includes(sq));
  rows=rows.slice(0,60);
  if(!rows.length){tb.innerHTML='<tr><td colspan="7"><div class="empty"><div class="ei">📭</div>Нет записей</div></td></tr>';return;}
  const total=db.income.filter(r=>!inPlaceFilter||(r.place||'')=== inPlaceFilter).length;
  tb.innerHTML=rows.map((r,i)=>`<tr class="trow-edit ${editMode.income===r.id?'is-editing':''}" onclick="editIncome(${r.id})">
    <td style="color:var(--muted);font-size:11px">${total-i}</td>
    <td style="font-size:11px;color:var(--muted)">${r.dt}</td>
    <td>${matChip(r.mat)}</td>
    <td style="font-size:12px">${r.size}</td>
    <td><span class="badge bin">${r.qty} л.</span></td>
    <td><span class="place-badge">${r.place||'—'}</span></td>
    <td><button class="dbtn" onclick="event.stopPropagation();del('income',${r.id})">✕</button></td>
  </tr>`).join('');
}
function setInPlace(p){inPlaceFilter=(inPlaceFilter===p?'':p);renderIn();}
