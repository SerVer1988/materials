// ▸ ui.js — UI-утилиты: toast, confirm, подсветка строк
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

// ══════════════════════════════════════ ЧИП МАТЕРИАЛА (цвет и иконка по типу материала)
const MAT_ICONS={
  cube:'<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9L12 3Z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  hex:'<path d="M12 3 4 7.5v9l8 4.5 8-4.5v-9L12 3Z"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
  sheet:'<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'
};
const MAT_FAMILIES=[ // [начало названия, css-класс, иконка]
  ['пвх','pvh','cube'],['акрил','acr','hex'],['акп','akp','layers'],['абс','abs','hex'],
  ['пэт','pet','hex'],['полик','pet','hex'],
  ['фанера','wood','layers'],['мдф','wood','layers'],['дсп','wood','layers'],
  ['алл','metal','sheet'],['алюм','metal','sheet'],['жесть','metal','sheet']
];
function matChip(name){
  const n=String(name==null?'':name);
  const low=n.trim().toLowerCase();
  const f=MAT_FAMILIES.find(x=>low.startsWith(x[0]))||[,'other','sheet'];
  const esc=n.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  return `<span class="mat-chip mat-${f[1]}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${MAT_ICONS[f[2]]}</svg>${esc}</span>`;
}
