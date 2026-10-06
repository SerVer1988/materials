// ▸ search.js — Поиск в приходе/расходе/складе, выпадающий список материалов
// ── Income search ──
function inClearBtn(){
  const inp=document.getElementById('in-s');
  const btn=document.getElementById('in-s-clear');
  if(btn) btn.classList.toggle('show',!!(inp&&inp.value.length>0));
}
function inAcInput(){
  const inp=document.getElementById('in-s');
  const drop=document.getElementById('ac-in-s');
  if(!inp||!drop) return;
  const q=inp.value.trim().toLowerCase();
  const matches=q?MATS.filter(m=>m.toLowerCase().includes(q)):MATS;
  if(!matches.length){drop.classList.remove('show');return;}
  drop.innerHTML=matches.map(m=>`<div class="ac-item" data-val="${m}" onmousedown="document.getElementById('in-s').value='${m.replace(/'/g,"\\'")}';inClearBtn();renderIn();document.getElementById('ac-in-s').classList.remove('show')">${acHighlight(m,q)}</div>`).join('');
  drop.classList.add('show');
}
function inAcKey(e){
  const drop=document.getElementById('ac-in-s');
  if(!drop||!drop.classList.contains('show')) return;
  const items=drop.querySelectorAll('.ac-item');
  let idx=acFocusIdx['in-s']??-1;
  if(e.key==='ArrowDown'){e.preventDefault();idx=Math.min(idx+1,items.length-1);}
  else if(e.key==='ArrowUp'){e.preventDefault();idx=Math.max(idx-1,-1);}
  else if(e.key==='Enter'&&idx>=0){e.preventDefault();document.getElementById('in-s').value=items[idx].dataset.val;inClearBtn();renderIn();drop.classList.remove('show');return;}
  else if(e.key==='Escape'){drop.classList.remove('show');return;}
  else return;
  acFocusIdx['in-s']=idx;
  items.forEach((it,i)=>it.classList.toggle('focused',i===idx));
  if(idx>=0) items[idx].scrollIntoView({block:'nearest'});
}

// ── Expense search ──
function outClearBtn(){
  const inp=document.getElementById('out-s');
  const btn=document.getElementById('out-s-clear');
  if(btn) btn.classList.toggle('show',!!(inp&&inp.value.length>0));
}
function outAcInput(){
  const inp=document.getElementById('out-s');
  const drop=document.getElementById('ac-out-s');
  if(!inp||!drop) return;
  const q=inp.value.trim().toLowerCase();
  const matches=q?MATS.filter(m=>m.toLowerCase().includes(q)):MATS;
  if(!matches.length){drop.classList.remove('show');return;}
  drop.innerHTML=matches.map(m=>`<div class="ac-item" data-val="${m}" onmousedown="document.getElementById('out-s').value='${m.replace(/'/g,"\\'")}';outClearBtn();renderOut();document.getElementById('ac-out-s').classList.remove('show')">${acHighlight(m,q)}</div>`).join('');
  drop.classList.add('show');
}
function outAcKey(e){
  const drop=document.getElementById('ac-out-s');
  if(!drop||!drop.classList.contains('show')) return;
  const items=drop.querySelectorAll('.ac-item');
  let idx=acFocusIdx['out-s']??-1;
  if(e.key==='ArrowDown'){e.preventDefault();idx=Math.min(idx+1,items.length-1);}
  else if(e.key==='ArrowUp'){e.preventDefault();idx=Math.max(idx-1,-1);}
  else if(e.key==='Enter'&&idx>=0){e.preventDefault();document.getElementById('out-s').value=items[idx].dataset.val;outClearBtn();renderOut();drop.classList.remove('show');return;}
  else if(e.key==='Escape'){drop.classList.remove('show');return;}
  else return;
  acFocusIdx['out-s']=idx;
  items.forEach((it,i)=>it.classList.toggle('focused',i===idx));
  if(idx>=0) items[idx].scrollIntoView({block:'nearest'});
}

function toggleSearchDropdown(dropId, inputId){
  const drop = document.getElementById(dropId);
  const inp = document.getElementById(inputId);
  if(!drop) return;
  if(drop.classList.contains('show')){
    drop.classList.remove('show');
    return;
  }
  const q = inp ? inp.value.trim().toLowerCase() : '';
  const mats = q ? MATS.filter(m=>m.toLowerCase().includes(q)) : MATS;
  if(!mats.length){ return; }
  const renderMap = {'in-s':'renderIn','out-s':'renderOut','stk-s':'renderStock'};
  const clearMap  = {'in-s':'inClearBtn','out-s':'outClearBtn','stk-s':'stkClearBtn'};
  const renderFn  = renderMap[inputId]||'';
  const clearFn   = clearMap[inputId]||'';
  drop.innerHTML = mats.map(m=>{
    const safe = m.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
    return `<div class="ac-item" onmousedown="event.preventDefault();document.getElementById('${inputId}').value='${safe}';document.getElementById('${dropId}').classList.remove('show');${renderFn?renderFn+'();':''}${clearFn?clearFn+'();':''}">${m}</div>`;
  }).join('');
  drop.classList.add('show');
}
