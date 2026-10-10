// ▸ init.js — Инициализация: миграции, заполнение селектов
// ══════════════════════════════════════ INIT
// Миграция: исправляет старые обрезки где qty=1 но должно быть qty=expenseQty
function migrateScrapQty(){
  let changed=false;
  db.expense.forEach(exp=>{
    if(exp.etype!=='full'||!exp.det||exp.qty<=1) return;
    // Ищем связанный обрезок по expenseId или по id+1
    const scrap=db.remainders.find(r=>r.expenseId===exp.id || r.id===exp.id+1);
    if(!scrap) return;
    // Если все pieces имеют qty=1 — исправляем
    const needsFix=scrap.pieces.every(p=>(p.qty||1)===1);
    if(!needsFix) return;
    scrap.pieces.forEach(p=>{ p.qty=exp.qty; });
    scrap.totalM2=+scrap.pieces.reduce((s,p)=>s+p.w*p.l*(p.qty||1)/1e6,0).toFixed(4);
    scrap.totalPcs=scrap.pieces.reduce((s,p)=>s+(p.qty||1),0);
    if(!scrap.expenseId) scrap.expenseId=exp.id; // добавляем связь если не было
    changed=true;
  });
  if(changed){ save(); }
}

async function init(){
  load(); fillAllSelects();
  migrateScrapQty(); // исправляем старые записи
  renderAll();
  updateThemeBtns();
  applyPendingDeepLink(); // данные из макроса CorelDRAW (если открыли по ссылке)

  // Тянем свежие данные из облака
  setSyncStatus('load');
  const cloud=await sbPull();
  if(cloud){
    mergePayload(cloud);   // объединяем, не заменяем
    saveLocal();
    fillAllSelects();
    migrateScrapQty();
    renderAll();
    setSyncStatus('ok');
  } else {
    setSyncStatus('err');
  }

  // Если вкладка становится видимой — обновляем (переключились с другого устройства)
  document.addEventListener('visibilitychange',async()=>{
    if(document.visibilityState==='visible'){
      setSyncStatus('load');
      const fresh=await sbPull();
      if(fresh){
        mergePayload(fresh);
        saveLocal();
        fillAllSelects();
        renderAll();
        setSyncStatus('ok');
      }
    }
  });

  // Периодическая синхронизация каждые 5 минут
  setInterval(async()=>{
    if(document.visibilityState!=='visible') return;
    const fresh=await sbPull();
    if(fresh){
      mergePayload(fresh);
      saveLocal();
      fillAllSelects();
      renderAll();
      setSyncStatus('ok');
    }
  }, 5*60*1000);
}
function fillAllSelects(){
  fillSelect('in-pre',SIZES,false,DEFAULT_SIZE);
  fillSelect('out-pre',SIZES,true,null,'— без листа —');
  fillSelect('in-place',PLACES,true); fillSelect('rem-place',PLACES,true);
  fillOrderSelects();
  const op=document.getElementById('out-pre');
  if(op){
    op.removeEventListener('change',parseDetSize);
    op.addEventListener('change',parseDetSize);
  }
}
function fillSelect(id,list,withCustom,defaultVal,noSheetLabel){
  const el=document.getElementById(id); if(!el) return;
  const prev=el.value;
  el.innerHTML='';
  if(noSheetLabel) el.appendChild(new Option(noSheetLabel,''));
  list.forEach(v=>el.appendChild(new Option(v,v)));
  if(withCustom) el.appendChild(new Option('✏️ Свой вариант...',CUSTOM_VAL));
  if(prev&&prev!==CUSTOM_VAL&&[...el.options].some(o=>o.value===prev)) el.value=prev;
  else if(defaultVal) el.value=defaultVal;
}
