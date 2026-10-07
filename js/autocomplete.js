// ▸ autocomplete.js — Автокомплит материалов и «свой вариант» в селектах
// ══════════════════════════════════════ AUTOCOMPLETE
let acFocusIdx={};
function acHighlight(s,q){
  if(!q) return s;
  const re=new RegExp('('+q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi');
  return s.replace(re,'<mark>$1</mark>');
}
function acInput(id){
  const inp=document.getElementById(id);
  const drop=document.getElementById('ac-'+id);
  if(!inp||!drop) return;
  const q=inp.value.trim().toLowerCase();
  const matches=q
    ? MATS.filter(m=>m.toLowerCase().includes(q))
    : MATS;
  acFocusIdx[id]=-1;
  if(!matches.length){drop.classList.remove('show');return;}
  drop.innerHTML=matches.map((m,i)=>`<div class="ac-item" data-val="${m}" onmousedown="acSelect('${id}','${m.replace(/'/g,"\\'")}')"><span>${acHighlight(m,q)}</span></div>`).join('');
  drop.classList.add('show');
}
// Алиас — принимает elem и id отдельно (для динамических id в шаблонах)
function acInputEl(elem, id){
  const drop=document.getElementById('ac-'+id);
  if(!elem||!drop) return;
  const q=elem.value.trim().toLowerCase();
  const matches=q ? MATS.filter(m=>m.toLowerCase().includes(q)) : MATS;
  acFocusIdx[id]=-1;
  if(!matches.length){drop.classList.remove('show');return;}
  drop.innerHTML=matches.map(m=>`<div class="ac-item" data-val="${m}" onmousedown="acSelect('${id}','${m.replace(/'/g,"\\'")}')"><span>${acHighlight(m,q)}</span></div>`).join('');
  drop.classList.add('show');
}
function acSelect(id,val){
  const inp=document.getElementById(id);
  if(inp) inp.value=val;
  const drop=document.getElementById('ac-'+id);
  if(drop) drop.classList.remove('show');
  acFocusIdx[id]=-1;
}
function acBlur(id){
  setTimeout(()=>{
    const drop=document.getElementById('ac-'+id);
    if(drop) drop.classList.remove('show');
  },150);
}
function acKey(e,id){
  const drop=document.getElementById('ac-'+id);
  if(!drop||!drop.classList.contains('show')) return;
  const items=drop.querySelectorAll('.ac-item');
  if(!items.length) return;
  let idx=acFocusIdx[id]??-1;
  if(e.key==='ArrowDown'){e.preventDefault();idx=Math.min(idx+1,items.length-1);}
  else if(e.key==='ArrowUp'){e.preventDefault();idx=Math.max(idx-1,-1);}
  else if(e.key==='Enter'&&idx>=0){e.preventDefault();acSelect(id,items[idx].dataset.val);return;}
  else if(e.key==='Escape'){drop.classList.remove('show');acFocusIdx[id]=-1;return;}
  else return;
  acFocusIdx[id]=idx;
  items.forEach((it,i)=>it.classList.toggle('focused',i===idx));
  if(idx>=0) items[idx].scrollIntoView({block:'nearest'});
}

function onSelectChange(selId,wrapId){
  const wrap=document.getElementById(wrapId); if(!wrap) return;
  const sel=document.getElementById(selId); if(!sel) return;
  wrap.classList.toggle('show', sel.value===CUSTOM_VAL);
}
function addCustomOption(selId,wrapId,listKey){
  const wrap=document.getElementById(wrapId); if(!wrap) return;
  const inp=wrap.querySelector('input'); if(!inp) return;
  const val=inp.value.trim();
  if(!val){toast('Введите значение','err');return;}
  const list=listKey==='mats'?MATS:listKey==='sizes'?SIZES:PLACES;
  if(!list.includes(val)) list.push(val);
  if(listKey==='sizes'){fillSelect('in-pre',SIZES,false,DEFAULT_SIZE);fillSelect('out-pre',SIZES,true,null,'— без листа —');}
  if(listKey==='places'){fillSelect('in-place',PLACES,true);fillSelect('rem-place',PLACES,true);}
  const selEl=document.getElementById(selId);
  if(selEl) selEl.value=val;
  wrap.classList.remove('show'); inp.value='';
  save(); renderRemByMat();
  toast(`✅ Добавлено: ${val}`,'ok');
}

// ── Autocomplete clear button ──
function acUpdateClear(id){
  const inp=document.getElementById(id);
  const wrap=inp?inp.closest('.ac-wrap'):null;
  if(wrap) wrap.classList.toggle('has-value', !!(inp&&inp.value.length>0));
}
function acClear(id){
  const inp=document.getElementById(id);
  if(inp){inp.value='';inp.focus();}
  const drop=document.getElementById('ac-'+id);
  if(drop) drop.classList.remove('show');
  const wrap=inp?inp.closest('.ac-wrap'):null;
  if(wrap) wrap.classList.remove('has-value');
}
function stkAcInput(){
  const inp=document.getElementById('stk-s');
  const drop=document.getElementById('ac-stk-s');
  if(!inp||!drop) return;
  const q=inp.value.trim().toLowerCase();
  const matches=q ? MATS.filter(m=>m.toLowerCase().includes(q)) : MATS;
  if(!matches.length){drop.classList.remove('show');return;}
  drop.innerHTML=matches.map(m=>`<div class="ac-item" data-val="${m}" onmousedown="document.getElementById('stk-s').value='${m.replace(/'/,"\\'")}';renderStock();renderRemByMat();stkClearBtn();document.getElementById('ac-stk-s').classList.remove('show')">${acHighlight(m,q)}</div>`).join('');
  drop.classList.add('show');
}
function stkAcKey(e){
  const drop=document.getElementById('ac-stk-s');
  if(!drop||!drop.classList.contains('show')) return;
  const items=drop.querySelectorAll('.ac-item');
  if(!items.length) return;
  let idx=acFocusIdx['stk-s']??-1;
  if(e.key==='ArrowDown'){e.preventDefault();idx=Math.min(idx+1,items.length-1);}
  else if(e.key==='ArrowUp'){e.preventDefault();idx=Math.max(idx-1,-1);}
  else if(e.key==='Enter'&&idx>=0){
    e.preventDefault();
    document.getElementById('stk-s').value=items[idx].dataset.val;
    renderStock();renderRemByMat();stkClearBtn();
    drop.classList.remove('show');return;
  } else if(e.key==='Escape'){drop.classList.remove('show');return;}
  else return;
  acFocusIdx['stk-s']=idx;
  items.forEach((it,i)=>it.classList.toggle('focused',i===idx));
  if(idx>=0) items[idx].scrollIntoView({block:'nearest'});
}

function stkClearBtn(){
  const inp=document.getElementById('stk-s');
  const btn=document.getElementById('stk-s-clear');
  if(btn) btn.classList.toggle('show', !!(inp&&inp.value.length>0));
}
