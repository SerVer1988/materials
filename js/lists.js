// ▸ lists.js — Редактор справочников: материалы, размеры, места
// ══════════════════════════════════════ LIST SORT
function listMoveUp(key,i){
  const list=key==='mats'?MATS:key==='sizes'?SIZES:PLACES;
  if(i===0) return;
  [list[i-1],list[i]]=[list[i],list[i-1]];
  save(); fillAllSelects(); renderListEditor(key);
}
function listMoveDown(key,i){
  const list=key==='mats'?MATS:key==='sizes'?SIZES:PLACES;
  if(i>=list.length-1) return;
  [list[i],list[i+1]]=[list[i+1],list[i]];
  save(); fillAllSelects(); renderListEditor(key);
}

// ══════════════════════════════════════ LIST EDITOR
function renderListEditor(key){
  const list=key==='mats'?MATS:key==='sizes'?SIZES:PLACES;
  const countEl=document.getElementById(`${key}-count`);
  if(countEl) countEl.textContent=`(${list.length})`;
  const container=document.getElementById(`list-${key}`);
  if(!container) return;
  container.innerHTML=list.map((v,i)=>`
    <div class="list-item" id="li-${key}-${i}">
      <span class="list-item-val" id="liv-${key}-${i}">${v}</span>
      <button class="list-item-up" onclick="listMoveUp('${key}',${i})" title="Выше" ${i===0?'style="opacity:.3;cursor:default"':''}>↑</button>
      <button class="list-item-dn" onclick="listMoveDown('${key}',${i})" title="Ниже" ${i===list.length-1?'style="opacity:.3;cursor:default"':''}>↓</button>
      <button class="list-item-edit" onclick="startListEdit('${key}',${i})">✏️</button>
      <button class="list-item-del" onclick="listDel('${key}',${i})">✕</button>
    </div>`).join('');
}
function startListEdit(key,i){
  const list=key==='mats'?MATS:key==='sizes'?SIZES:PLACES;
  const valEl=document.getElementById(`liv-${key}-${i}`);
  if(!valEl) return;
  const old=list[i];
  valEl.innerHTML=`<input class="list-item-input" id="lei-${key}-${i}" value="${old}">`;
  const inp=document.getElementById(`lei-${key}-${i}`);
  if(inp) inp.focus();
  const editBtn=valEl.parentElement.querySelector('.list-item-edit');
  if(editBtn){ editBtn.textContent='💾'; editBtn.onclick=()=>saveListEdit(key,i); }
}
// Удалить место хранения из всех обрезков и прихода в БД (ставим пустую строку)
function removePlaceFromDB(val){
  db.remainders.forEach(rec=>{
    if(rec.place===val) rec.place='';
    rec.pieces.forEach(p=>{ if(p.place===val) p.place=''; });
  });
  db.income.forEach(r=>{ if(r.place===val) r.place=''; });
}

function saveListEdit(key,i){
  const inp=document.getElementById(`lei-${key}-${i}`);
  if(!inp) return;
  const val=inp.value.trim();
  if(!val){toast('Значение не может быть пустым','err');return;}
  const list=key==='mats'?MATS:key==='sizes'?SIZES:PLACES;
  const old=list[i];
  if(old===val){ renderListEditor(key); return; }
  list[i]=val;
  addRename(key,old,val);                 // меняем во всех записях, избранном и справочнике (и запоминаем для синхронизации)
  if(key==='places') placeFilterRenamed(old,val);
  const uniq=[...new Set(list)]; list.length=0; list.push(...uniq);
  save(); fillAllSelects(); renderListEditor(key); renderAll();
  toast('✅ Сохранено','ok');
}
function listAdd(key){
  const inputId=key==='mats'?'new-mat':key==='sizes'?'new-size':'new-place';
  const inp=document.getElementById(inputId);
  if(!inp){toast('Поле не найдено','err');return;}
  const val=inp.value.trim();
  if(!val){toast('Введите значение','err');return;}
  const list=key==='mats'?MATS:key==='sizes'?SIZES:PLACES;
  if(list.includes(val)){toast('Уже есть в списке','err');return;}
  list.push(val);
  releaseRename(key,val);
  inp.value='';
  save(); fillAllSelects(); renderListEditor(key); renderRemByMat();
  toast(`✅ Добавлено: ${val}`,'ok');
}
function listDel(key,i){
  const list=key==='mats'?MATS:key==='sizes'?SIZES:PLACES;
  const delVal=list[i];
  confirm2(`Удалить «${delVal}» из списка?`,()=>{
    list.splice(i,1);
    if(key==='places'){
      removePlaceFromDB(delVal);           // убираем место из всех записей БД
      placeFilterDeleted(delVal); // сбрасываем активные фильтры по этому месту
    }
    save(); fillAllSelects(); renderListEditor(key); renderRemByMat(); renderIn(); renderOut(); renderStock();
    toast('Удалено');
  });
}
