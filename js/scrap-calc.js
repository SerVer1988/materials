// ▸ scrap-calc.js — Расчёт обрезков и превью при расходе
// ══════════════════════════════════════ SCRAP CALCULATION
// Логика:
// 1. Один прямолинейный рез — горизонтальный ИЛИ вертикальный
// 2. Каждый вариант даёт 2 остатка (рядом с деталью + полосу через весь лист)
// 3. Выбираем вариант, где остатки наиболее «квадратные» (соотношение сторон ближе к 1:1)
// 4. Если любая сторона остатка < 300 мм — отход, не учитываем
// Возвращает [{w,l}]

const SCRAP_THRESHOLD = 300; // мм — минимальная сторона

function squareness(w, l){
  // Чем ближе к 1 — тем более квадратный. 0 = вырожденный.
  if(w <= 0 || l <= 0) return 0;
  return Math.min(w, l) / Math.max(w, l);
}

const KERF=10; // мм — ширина пропила (вычитается из остатка)

function calcScraps(shW, shL, detW, detL){
  // Уменьшаем лист на пропил перед расчётом обрезков
  const effW = detW + KERF; // эффективно занятая ширина (деталь + пропил)
  const effL = detL + KERF; // эффективно занятая высота (деталь + пропил)

  const rW = shW - effW;  // остаток справа
  const rL = shL - effL;  // остаток снизу

  if(rW <= 0 && rL <= 0) return [];

  // ── Вариант A: горизонтальный рез (рез по высоте effL) ──
  // Кусок 1: справа от детали (за вычетом пропила): rW × detL
  // Кусок 2: полоса снизу через весь лист: shW × rL
  const A1 = { w: rW, l: detL };
  const A2 = { w: shW, l: rL };

  // ── Вариант B: вертикальный рез (рез по ширине effW) ──
  // Кусок 1: снизу от детали: detW × rL
  // Кусок 2: полоса справа через весь лист: rW × shL
  const B1 = { w: detW, l: rL };
  const B2 = { w: rW,   l: shL };

  // Считаем «квадратность» каждого варианта — среднее по живым кускам (с учётом только тех что ≥300мм)
  function validPieces(p1, p2){
    const res = [];
    if(p1.w >= SCRAP_THRESHOLD && p1.l >= SCRAP_THRESHOLD) res.push(p1);
    if(p2.w >= SCRAP_THRESHOLD && p2.l >= SCRAP_THRESHOLD) res.push(p2);
    return res;
  }
  function avgSquareness(pieces){
    if(!pieces.length) return -1;
    return pieces.reduce((s,p) => s + squareness(p.w, p.l), 0) / pieces.length;
  }

  const validA = validPieces(A1, A2);
  const validB = validPieces(B1, B2);

  const sqA = avgSquareness(validA);
  const sqB = avgSquareness(validB);

  // Выбираем вариант с лучшей квадратностью
  // Если оба пустые — нет обрезков
  if(sqA < 0 && sqB < 0) return [];

  return sqA >= sqB ? validA : validB;
}

// ══════════════════════════════════════ SCRAP PREVIEW
function isSheetSelected(){ const v=document.getElementById('out-pre').value; return v&&v!==''&&v!==CUSTOM_VAL; }
function getSizeWL(selectId){ const v=document.getElementById(selectId).value; const m=v.replace(/[хxX×]/,'|').split('|').map(n=>parseInt(n)); return(m.length===2&&m[0]>0&&m[1]>0)?{w:m[0],l:m[1]}:{w:1220,l:2440}; }
function parseSizeStr(s){ if(!s) return null; const m=s.replace(/[хxX×*]/,'|').split('|').map(v=>parseInt(v.trim())); return(m.length===2&&m[0]>0&&m[1]>0)?{w:m[0],l:m[1]}:null; }
function normSizeStr(s){ if(!s) return s; const p=parseSizeStr(s); return p?`${p.w}×${p.l}`:s; }

function parseDetSize(){
  const detStr=document.getElementById('out-det').value; const det=parseSizeStr(detStr);
  document.getElementById('scrap-preview').style.display='none';
  document.getElementById('scrap-neg-preview').style.display='none';
  const btn=document.getElementById('out-save-btn');
  if(!isSheetSelected()){
    btn.textContent='✂️ Выбрать обрезок';
    btn.className='btn bblue bbig';
  } else {
    btn.textContent='📤 Записать расход';
    btn.className='btn bdng bbig';
  }
  if(!det) return;
  const qty=parseInt(document.getElementById('out-qty').value)||1;
  if(isSheetSelected()){
    const sh=getSizeWL('out-pre');
    const pieces=calcScraps(sh.w, sh.l, det.w, det.l);
    if(pieces.length){
      const totalM2PerSheet=pieces.reduce((s,p)=>s+p.w*p.l/1e6,0);
      const totalM2=totalM2PerSheet*qty;
      const piecesText=pieces.map(p=>`${p.w}×${p.l}`).join(' + ');
      document.getElementById('scrap-preview-text').textContent=
        qty>1
          ? `${piecesText} × ${qty} л. = ${totalM2.toFixed(4)} м²`
          : `${piecesText} (${totalM2.toFixed(4)} м²)`;
      document.getElementById('scrap-preview').style.display='block';
    } else {
      document.getElementById('scrap-preview-text').textContent='все остатки < 300 мм — отход, не записываются';
      document.getElementById('scrap-preview').style.display='block';
    }
  } else {
    document.getElementById('scrap-neg-text').textContent=`${normSizeStr(detStr)} → −${(det.w*det.l*qty/1e6).toFixed(4)} м²`;
    document.getElementById('scrap-neg-preview').style.display='block';
  }
}
