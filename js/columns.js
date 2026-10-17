window.__B=window.__B||{};__B['columns']='2026-10-13a';
// ▸ columns.js — Колонки таблиц «Приход» и «Расход»: значок ⚙ в шапке таблицы, галочками выбираете, что показывать.
// Выбор запоминается на этом устройстве. Данные берутся из тех же записей, лишнего хранить не нужно.
const COLS={
  in:[ {id:'n',label:'№ записи'},{id:'dt',label:'Дата'},{id:'mat',label:'Материал'},{id:'sz',label:'Размер'},{id:'qty',label:'Кол-во'},
       {id:'pl',label:'Место'},{id:'ord',label:'Заказ'},{id:'note',label:'Примечание'} ],
  out:[{id:'n',label:'№ записи'},{id:'dt',label:'Дата'},{id:'mat',label:'Материал'},{id:'sz',label:'Размер листа'},{id:'qty',label:'Кол-во'},
       {id:'det',label:'Изделие'},{id:'ord',label:'Заказ (номер)'},{id:'cust',label:'Заказчик'},{id:'mgr',label:'Менеджер'},{id:'cat',label:'Категория'},{id:'cut',label:'Длина реза'},{id:'pct',label:'% от листа'},{id:'area',label:'Площадь изделия'},{id:'note',label:'Примечание'} ]
};
const COLS_DEF={ in:['n','dt','mat','sz','qty','pl'], out:['n','dt','mat','sz','qty','det'] };
const COLS_HEAD={n:'#',dt:'Дата',mat:'Материал',sz:'Размер',qty:'Кол-во',pl:'Место',det:'Изделие',ord:'Заказ',cust:'Заказчик',mgr:'Менеджер',cat:'Категория',cut:'Рез',pct:'% листа',area:'Площадь',note:'Примечание'};

function colsIds(kind){
  let v=null; try{ v=JSON.parse(localStorage.getItem('lm7_cols_'+kind)||'null'); }catch(e){}
  const ok=COLS[kind].map(c=>c.id);
  const ids=(Array.isArray(v)?v:COLS_DEF[kind]).filter(x=>ok.includes(x));
  return ids.length?ids:COLS_DEF[kind];
}
// выбранные колонки в порядке списка
function colsFor(kind){ const s=new Set(colsIds(kind)); return COLS[kind].map(c=>c.id).filter(id=>s.has(id)); }

function colsHead(kind){
  const th=document.getElementById(kind+'-thead'); if(!th) return;
  th.innerHTML='<tr>'+colsFor(kind).map(id=>`<th>${COLS_HEAD[id]}</th>`).join('')+`<th><span class="col-cfg" onclick="openColsMenu('${kind}')" title="Какие колонки показывать">⚙</span></th></tr>`;
}
function openColsMenu(kind){
  closeColsMenu();
  const cur=new Set(colsIds(kind));
  const d=document.createElement('div'); d.id='cols-pop'; d.className='cols-pop';
  d.innerHTML=`<div class="cols-card" onclick="event.stopPropagation()"><div class="ctitle">Колонки таблицы</div>`+
    COLS[kind].map(c=>`<label class="cols-opt"><input type="checkbox" data-c="${c.id}"${cur.has(c.id)?' checked':''}> ${c.label}</label>`).join('')+
    `<div class="brow" style="margin-top:10px"><button class="btn bghost bsm" onclick="colsReset('${kind}')">По умолчанию</button><button class="btn bprim bsm" onclick="colsApply('${kind}')">Готово</button></div></div>`;
  d.onclick=closeColsMenu; document.body.appendChild(d);
}
function closeColsMenu(){ document.getElementById('cols-pop')?.remove(); }
function colsSave(kind,ids){ try{ localStorage.setItem('lm7_cols_'+kind,JSON.stringify(ids)); }catch(e){} closeColsMenu(); kind==='in'?renderIn():renderOut(); }
function colsApply(kind){
  const ids=[...document.querySelectorAll('#cols-pop input[type=checkbox]:checked')].map(i=>i.dataset.c);
  if(!ids.includes('mat')) ids.push('mat');                 // материал нужен всегда
  colsSave(kind,ids);
}
function colsReset(kind){ colsSave(kind,COLS_DEF[kind].slice()); }

// ── Ячейки ──
const colMuted='color:var(--muted);font-size:11px';
const colNote=r=>`<td class="c-note">${escHtml(r.note||'')}</td>`;
function colOrdNo(order){ if(!order) return '—'; return escHtml(splitOrder(order).no); }

function incCell(id,r,i,total,cols){
  switch(id){
    case 'n':   return `<td style="${colMuted}">${total-i}</td>`;
    case 'dt':  return `<td class="c-dt">${dtCell(r.dt)}</td>`;
    case 'mat': return `<td>${matChip(r.mat)}${cols.includes('ord')?'':ordTag(r.order)}${r.rev?'<div class="ord-tag" title="Запись ревизии">⚖️ ревизия</div>':''}</td>`;
    case 'sz':  return `<td class="c-sz">${sizeStack(r.size)}</td>`;
    case 'qty': return `<td><span class="badge bin">${r.qty} л.</span></td>`;
    case 'pl':  return `<td><span class="place-badge">${escHtml(r.place||'—')}</span></td>`;
    case 'ord': return `<td>${colOrdNo(r.order)}</td>`;
    case 'note':return colNote(r);
  }
  return '<td></td>';
}
function outCell(id,r,i,total,cols){
  const inf=(typeof statOrderInfo==='function')?statOrderInfo(r):{no:'',cust:'',cat:'',mgr:''};
  switch(id){
    case 'n':   return `<td style="${colMuted}">${total-i}</td>`;
    case 'dt':  return `<td class="c-dt">${dtCell(r.dt)}</td>`;
    case 'mat': return `<td>${matChip(r.mat)}${cols.includes('ord')?'':ordTag(r.order)}${r.brak?'<div class="ord-tag" title="Списано в брак">🗑 брак</div>':''}${r.rev?'<div class="ord-tag" title="Запись ревизии">⚖️ ревизия</div>':''}</td>`;
    case 'sz': {
      let c;
      if(r.etype==='full'&&r.size&&r.size!=='—') c=sizeStack(r.size);
      else if(r.sourceScrap) c=`<span style="color:var(--blue)">${sizeStack(r.sourceScrap)}</span>`;
      else if(r.det) c=`<span style="font-size:11px;color:var(--muted)">обрезок</span>`;
      else c=`<span style="font-size:12px;color:var(--muted)">—</span>`;
      return `<td class="c-sz">${c}</td>`;
    }
    case 'qty': return `<td><span class="badge bout">${r.qty} л.</span></td>`;
    case 'det': return `<td class="c-sz c-det">${sizeStack(normSizeStr(r.det))}</td>`;
    case 'ord': return `<td>${inf.no?escHtml(inf.no):colOrdNo(r.order)}</td>`;
    case 'cust':return `<td>${escHtml(inf.cust||'—')}</td>`;
    case 'mgr': return `<td>${escHtml(typeof managerLabel==='function'?managerLabel(inf.mgr):(inf.mgr||'—'))}</td>`;
    case 'cat': return `<td>${escHtml(normCategory(r.cat||inf.cat)||'—')}</td>`;
    case 'cut': return `<td>${r.cut>0?f2(r.cut/1000)+' м':'—'}</td>`;
    case 'area': { const d=parseSizeStr(r.det||''); return `<td>${d?f2(d.w*d.l*(r.qty||1)/1e6)+' м²':'—'}</td>`; }
    case 'pct': {
      const d=parseSizeStr(r.det||''); let sh=null;
      if(r.etype==='full'||!r.etype) sh=(r.w>0&&r.l>0)?{w:r.w,l:r.l}:parseSizeStr(r.size||'');
      else if(r.sourceScrap) sh=parseSizeStr(String(r.sourceScrap).split(',')[0]);
      const v=(d&&sh)?d.w*d.l/(sh.w*sh.l)*100:null;
      return `<td>${v===null?'—':(Math.round(v*10)/10)+'%'}</td>`;
    }
    case 'note':return colNote(r);
  }
  return '<td></td>';
}
