// ▸ lists.js — Редактор справочников: материалы, размеры, места
// ══════════════════════════════════════ LIST SORT — перетаскивание
const listOf=key=>key==='mats'?MATS:key==='sizes'?SIZES:PLACES;

// Тянем строку за ручку ⠿: порядок меняется прямо в списке, при отпускании сохраняется (мышь и палец)
function startListDrag(container,key,row,e){
  const items=()=>[...container.querySelectorAll('.list-item')];
  row.classList.add('dragging');
  document.body.classList.add('list-dragging');

  // ближайший прокручиваемый родитель (для автопрокрутки у краёв экрана)
  let scroller=container.parentElement;
  while(scroller && scroller!==document.body){
    const oy=getComputedStyle(scroller).overflowY;
    if((oy==='auto'||oy==='scroll') && scroller.scrollHeight>scroller.clientHeight) break;
    scroller=scroller.parentElement;
  }
  if(!scroller || scroller===document.body) scroller=document.scrollingElement;

  let lastY=e.clientY, raf=0;
  function reposition(){
    let before=null;
    for(const r of items()){
      if(r===row) continue;
      const b=r.getBoundingClientRect();
      if(lastY<b.top+b.height/2){ before=r; break; }
    }
    if(before){ if(row.nextElementSibling!==before) container.insertBefore(row,before); }
    else if(container.lastElementChild!==row) container.appendChild(row);
  }
  function tick(){
    const rect=scroller===document.scrollingElement?{top:0,bottom:window.innerHeight}:scroller.getBoundingClientRect();
    const zone=56;
    if(lastY<rect.top+zone) scroller.scrollTop-=Math.max(4,(rect.top+zone-lastY)/3);
    else if(lastY>rect.bottom-zone) scroller.scrollTop+=Math.max(4,(lastY-(rect.bottom-zone))/3);
    reposition();
    raf=requestAnimationFrame(tick);
  }
  raf=requestAnimationFrame(tick);

  const onMove=ev=>{ lastY=ev.clientY; };
  const finish=()=>{
    cancelAnimationFrame(raf);
    document.removeEventListener('pointermove',onMove);
    document.removeEventListener('pointerup',finish);
    document.removeEventListener('pointercancel',finish);
    row.classList.remove('dragging');
    document.body.classList.remove('list-dragging');
    const order=items().map(r=>Number(r.dataset.i));
    const list=listOf(key), snap=[...list];
    const changed=order.some((v,i)=>v!==i);
    if(changed){
      list.splice(0,list.length,...order.map(i=>snap[i]));
      listTs[key]=Date.now();        // свежий порядок побеждает при синхронизации
      save(); fillAllSelects();
      toast('✅ Порядок сохранён','ok');
    }
    renderListEditor(key);
  };
  // слушаем весь документ: при перестановке строки браузер сбрасывает «захват» указателя на самой ручке
  document.addEventListener('pointermove',onMove);
  document.addEventListener('pointerup',finish);
  document.addEventListener('pointercancel',finish);
}

// ══════════════════════════════════════ LIST EDITOR
function renderListEditor(key){
  const list=key==='mats'?MATS:key==='sizes'?SIZES:PLACES;
  const countEl=document.getElementById(`${key}-count`);
  if(countEl) countEl.textContent=`(${list.length})`;
  const container=document.getElementById(`list-${key}`);
  if(!container) return;
  container.innerHTML=list.map((v,i)=>`
    <div class="list-item" id="li-${key}-${i}" data-i="${i}">
      <span class="list-handle" title="Перетащите, чтобы изменить порядок">⠿</span>
      <span class="list-item-val" id="liv-${key}-${i}">${v}</span>
      <button class="list-item-edit" onclick="startListEdit('${key}',${i})">✏️</button>
      <button class="list-item-del" onclick="listDel('${key}',${i})">✕</button>
    </div>`).join('');
  if(!container.dataset.dragInit){
    container.dataset.dragInit='1';
    container.addEventListener('pointerdown',ev=>{
      const h=ev.target.closest('.list-handle'); if(!h) return;
      ev.preventDefault();
      startListDrag(container,key,h.closest('.list-item'),ev);
    });
  }
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
