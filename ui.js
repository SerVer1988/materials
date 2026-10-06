// ▸ ui.js — UI-утилиты: toast, confirm, подсветка строк, заглушки темы
// ══════════════════════════════════════ THEME (только тёмная)
function toggleTheme(){}
function updateThemeBtns(){}
function updateThemeUI(){}

// ══════════════════════════════════════ MODAL / TOAST / UTILS
function confirm2(txt,cb){document.getElementById('ov-txt').textContent=txt;document.getElementById('ov-yes').onclick=()=>{cb();closeOv();};document.getElementById('ov').classList.add('show');}
function closeOv(){document.getElementById('ov').classList.remove('show');}
function toast(msg,type=''){const el=document.getElementById('tst');el.textContent=msg;el.className='toast show'+(type?' '+type:'');clearTimeout(window._tt);window._tt=setTimeout(()=>el.className='toast',2800);}
function now(){const d=new Date();const dd=String(d.getDate()).padStart(2,'0');const mm=String(d.getMonth()+1).padStart(2,'0');const yy=String(d.getFullYear()).slice(2);const hh=String(d.getHours()).padStart(2,'0');const min=String(d.getMinutes()).padStart(2,'0');return`${dd}.${mm}.${yy} ${hh}:${min}`;}

// Подсветить последнюю добавленную строку в таблице/списке
function highlightLastRow(tbodyId){
  requestAnimationFrame(()=>{
    const tb=document.getElementById(tbodyId);
    if(!tb) return;
    const row=tb.querySelector('tr:first-child');
    if(!row) return;
    row.style.transition='none';
    row.style.background='rgba(246,201,14,.28)';
    requestAnimationFrame(()=>{
      row.style.transition='background 1.4s ease';
      row.style.background='';
    });
    row.scrollIntoView({behavior:'smooth',block:'nearest'});
  });
}

function highlightLastPiece(mat){
  requestAnimationFrame(()=>{
    // Найдём карточку по data-mat
    const card=document.querySelector(`.remcard[data-mat="${mat.replace(/"/g,'&quot;')}"]`);
    if(!card) return;
    // Раскроем группу
    const idx=card.getAttribute('data-mat-idx');
    if(idx) remOpenGroups.add(mat);
    renderRemByMat();
    // После рендера подсветим последнюю строку
    requestAnimationFrame(()=>{
      const freshCard=document.querySelector(`.remcard[data-mat="${mat.replace(/"/g,'&quot;')}"]`);
      if(!freshCard) return;
      const rows=freshCard.querySelectorAll('.piece-row');
      const last=rows[rows.length-1];
      if(!last) return;
      last.style.transition='none';
      last.style.background='rgba(246,201,14,.28)';
      requestAnimationFrame(()=>{
        last.style.transition='background 1.4s ease';
        last.style.background='';
      });
      last.scrollIntoView({behavior:'smooth',block:'center'});
    });
  });
}
