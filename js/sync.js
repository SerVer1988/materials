// ▸ sync.js — Supabase: конфиг, merge данных, push/pull, статус синхронизации
// ══════════════════════════════════════ SUPABASE CONFIG
const SB_URL  = 'https://yqchdjnlblgmeugqpamu.supabase.co';
const SB_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlxY2hkam5sYmxnbWV1Z3FwYW11Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2ODY1NTEsImV4cCI6MjA5MTI2MjU1MX0._wdyti574OjkiJEhciruc1bneaifuzDT9OQwAuUQaM0';
const SB_HDR  = {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY};
let   syncTimer = null;
let   syncing   = false;
let   lastSyncError = null; // причина последней ошибки синхронизации (null = всё ок)

function sbErrText(e){
  const m=String((e&&e.message)||e);
  if(/Failed to fetch|NetworkError|Load failed|network/i.test(m)) return 'сервер недоступен (сеть, блокировка или проект Supabase приостановлен)';
  if(/^40[13]/.test(m)) return 'нет доступа (ключ или политики RLS): '+m.slice(0,100);
  if(/^404/.test(m))    return 'таблица material_data не найдена: '+m.slice(0,100);
  return m.slice(0,120);
}

function sbRowId(){ return ACCESS_CODE || 'main'; }

function sbPayload(){
  return { db, MATS, SIZES, PLACES, fav:[...favorites], deletedIds:[...deletedIds], deletedPieces:[...deletedPieces] };
}

// ── MERGE: объединяет два массива по id, без потерь ──
// Локальная запись приоритетнее облачной (если id совпал)
// Записи из deletedIds никогда не возвращаются
function mergeById(local=[], cloud=[]){
  const map = new Map();
  cloud.forEach(r => { if(!deletedIds.has(r.id)) map.set(r.id, r); });
  local.forEach(r => { if(!deletedIds.has(r.id)) map.set(r.id, r); });
  return [...map.values()].sort((a,b)=>(a.id||0)-(b.id||0));
}

// ── MERGE: объединяет строковые справочники (MATS, SIZES, PLACES) ──
function mergeList(local=[], cloud=[]){
  const s = new Set([...cloud, ...local]);
  return [...s];
}

// ── Применяет облачный payload с объединением (не заменой) ──
function mergePayload(p){
  if(!p) return;
  // Сначала принимаем удалённые id из облака
  if(p.deletedIds) p.deletedIds.forEach(id=>deletedIds.add(id));
  if(p.deletedPieces) p.deletedPieces.forEach(k=>deletedPieces.add(k));
  if(p.db){
    db.income    = mergeById(db.income,    p.db.income    || []);
    db.expense   = mergeById(db.expense,   p.db.expense   || []);
    db.remainders= mergeById(db.remainders,p.db.remainders|| []);
    // Убираем удалённые pieces из записей обрезков
    db.remainders.forEach(rec=>{
      rec.pieces = rec.pieces.filter(piece=>!deletedPieces.has(makePieceKey(rec.id, piece)));
      if(!rec.pieces.length) deletedIds.add(rec.id);
    });
    db.remainders = db.remainders.filter(r=>!deletedIds.has(r.id));
  }
  if(p.MATS  && p.MATS.length)   MATS   = mergeList(MATS,   p.MATS);
  if(p.SIZES && p.SIZES.length)  SIZES  = mergeList(SIZES,  p.SIZES);
  if(p.PLACES&& p.PLACES.length) PLACES = mergeList(PLACES, p.PLACES);
  if(p.fav)  p.fav.forEach(f=>favorites.add(f));
}

async function sbPush(){
  if(!ACCESS_CODE) return;
  try{
    // 1. Сначала забираем актуальное из облака
    const fresh = await sbPull();
    // 2. Объединяем облачное с локальным (данные только прибавляются)
    if(fresh) mergePayload(fresh);
    // 3. Пушим уже объединённый payload
    const r=await fetch(`${SB_URL}/rest/v1/material_data`,{
      method:'POST',
      headers:{...SB_HDR,'Prefer':'resolution=merge-duplicates,return=minimal'},
      body:JSON.stringify({id:sbRowId(), payload:sbPayload(), updated_at:new Date().toISOString()})
    });
    if(!r.ok){ const txt=await r.text(); throw new Error(`${r.status}: ${txt}`); }
    saveLocal();
    setSyncStatus('ok');
  }catch(e){
    lastSyncError=sbErrText(e);
    setSyncStatus('err');
    console.warn('Supabase push error',e);
  }
}

async function sbPull(){
  if(!ACCESS_CODE) return null;
  try{
    const r=await fetch(`${SB_URL}/rest/v1/material_data?id=eq.${encodeURIComponent(sbRowId())}&select=payload,updated_at`,{headers:SB_HDR});
    if(!r.ok){ const txt=await r.text().catch(()=>''); throw new Error(`${r.status}: ${txt}`); }
    const rows=await r.json();
    lastSyncError=null;               // запрос прошёл успешно
    if(!rows.length) return null;     // строки для этого кода в облаке ещё нет — это не ошибка
    return rows[0].payload;
  }catch(e){
    lastSyncError=sbErrText(e);
    console.warn('Supabase pull error',e);
    return null;
  }
}

async function manualSync(){
  setSyncStatus('load');
  toast('🔄 Синхронизация...','info');
  const fresh=await sbPull();
  if(lastSyncError){
    setSyncStatus('err');
    toast('⚠️ Нет связи с облаком: '+lastSyncError,'err');
    return;
  }
  if(fresh){
    // Объединяем — не заменяем
    mergePayload(fresh);
    saveLocal();
    fillAllSelects();
    renderAll();
    setSyncStatus('ok');
    toast('✅ Данные обновлены','ok');
  } else {
    // Связь есть, но для этого кода в облаке ещё нет данных — отправляем локальные
    await sbPush();
    if(lastSyncError) toast('⚠️ Нет связи с облаком: '+lastSyncError,'err');
    else toast('☁️ В облаке было пусто — данные отправлены','ok');
  }
}

function setSyncStatus(state){
  const el=document.getElementById('sync-status');
  if(!el) return;
  if(state==='ok'){
    const t=now();
    el.innerHTML=`☁️ ${t}`;
    el.style.color='var(--green)';
    localStorage.setItem('lm7_last_sync',t);
  }
  if(state==='err')  { el.textContent='⚠️ Нет связи'; el.style.color='var(--warn)'; }
  if(state==='sync') { el.textContent='🔄 Сохранение...'; el.style.color='var(--muted)'; }
  if(state==='load') {
    const last=localStorage.getItem('lm7_last_sync');
    el.textContent=last?`☁️ ${last}`:'🔄 Загрузка...';
    el.style.color='var(--muted)';
  }
}
