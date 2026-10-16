window.__B=window.__B||{};__B['revision']='2026-10-13a';
// ▸ revision.js — Ревизия, как лист «Ревизия» в Excel: по табелю (в программе) / по факту / разница.
// Вписали факт по нужным позициям → «Применить»: расхождения записываются в Учёт (приход или расход «Ревизия», rev:true).
// Склад по-прежнему считается только из прихода и расхода — отдельных остатков никто не правит.
let revShowZero=false, revAddOpen=false;
const revFacts={};      // ключ «материал||размер» → введённое число (строка), пока не применили
const revExtra=[];      // позиции, добавленные вручную (которых ещё нет на складе)

function revPositions(){
  const by=calcStockDetailed(), out=[], seen=new Set();
  Object.keys(by).forEach(m=>by[m].forEach(s=>{ out.push({mat:m,size:s.size,qty:s.qty}); seen.add(m+'||'+s.size); }));
  revExtra.forEach(e=>{ const k=e.mat+'||'+e.size; if(!seen.has(k)){ out.push({mat:e.mat,size:e.size,qty:0,extra:true}); seen.add(k); } });
  const mi=m=>{ const i=MATS.indexOf(m); return i<0?9999:i; };
  const wOf=s=>{ const p=parseSizeStr(s); return p?p.w:0; };
  out.sort((a,b)=>mi(a.mat)-mi(b.mat)||a.mat.localeCompare(b.mat,'ru')||wOf(a.size)-wOf(b.size)||a.size.localeCompare(b.size));
  return out;
}
function revDiffHtml(diff){
  if(diff===null||isNaN(diff)) return '';
  if(diff===0) return '<span class="rv-ok">✓</span>';
  return diff>0?`+${diff}`:`${diff}`;
}
function revDiffCls(diff){ return (diff===null||isNaN(diff)||diff===0)?'':(diff>0?'pos':'neg'); }

function renderRevision(){
  const box=document.getElementById('rev-list'); if(!box) return;
  // списки для добавления позиции
  const ms=document.getElementById('rev-add-mat'), ss=document.getElementById('rev-add-size');
  if(ms&&!ms.options.length) MATS.forEach(m=>ms.appendChild(new Option(m,m)));
  if(ss&&!ss.options.length){ SIZES.forEach(s=>ss.appendChild(new Option(s,s))); revAddFilter(); }
  document.getElementById('rev-add')?.style&&(document.getElementById('rev-add').style.display=revAddOpen?'block':'none');
  document.getElementById('rvf-add')?.classList.toggle('on',revAddOpen);
  document.getElementById('rvf-zero')?.classList.toggle('on',revShowZero);

  const q=(document.getElementById('rev-s')?.value||'').trim().toLowerCase();
  let pos=revPositions().filter(p=>!q||p.mat.toLowerCase().includes(q));
  pos=pos.filter(p=>revShowZero||p.qty!==0||p.extra||revFacts[p.mat+'||'+p.size]!==undefined);
  if(!pos.length){ box.innerHTML='<div class="empty"><div class="ei">⚖️</div>Нет позиций. Нажмите «➕ Позиция» или «Нулевые».</div>'; revUpdateBtn(); return; }
  let html='', lastMat=null;
  pos.forEach(p=>{
    const k=p.mat+'||'+p.size, f=revFacts[k];
    const diff=(f===undefined||f==='')?null:(parseInt(f,10)-p.qty);
    const last=revLast(p.mat,p.size);
    if(p.mat!==lastMat){ html+=`<div class="rv-mat">${matChip(p.mat)}</div>`; lastMat=p.mat; }
    html+=`<div class="revrow">
      <div class="rv-sz">${escHtml(p.size)}${last?`<span class="rv-last">ревизия ${escHtml(String(last.dt).split(' ')[0])}</span>`:''}</div>
      <div class="rv-qty" title="В программе">${p.qty}</div>
      <input type="number" inputmode="numeric" min="0" step="1" data-k="${escHtml(k)}" value="${f===undefined?'':escHtml(f)}" placeholder="факт" oninput="revInput(this)">
      <div class="rv-diff ${revDiffCls(diff)}">${revDiffHtml(diff)}</div>
    </div>`;
  });
  box.innerHTML=`<div class="rv-head"><span>размер</span><span>в программе</span><span>по факту</span><span>разница</span></div>`+html;
  revUpdateBtn();
}

function revChanges(){
  const cur={}; revPositions().forEach(p=>{ cur[p.mat+'||'+p.size]=p; });
  const out=[];
  Object.keys(revFacts).forEach(k=>{
    const p=cur[k], fact=parseInt(revFacts[k],10);
    if(!p||isNaN(fact)||fact<0) return;
    const diff=fact-p.qty;
    if(diff!==0) out.push({mat:p.mat,size:p.size,qty:p.qty,fact,diff});
  });
  return out;
}
function revUpdateBtn(){
  const b=document.getElementById('rev-apply-btn'); if(!b) return;
  const n=revChanges().length;
  b.textContent=n?`⚖️ Применить (${n})`:'⚖️ Применить';
  b.disabled=!n; b.style.opacity=n?'1':'.45';
}
function revInput(el){
  const k=el.dataset.k, v=el.value;
  if(v==='') delete revFacts[k]; else revFacts[k]=v;
  const row=el.closest('.revrow'), qty=parseInt(row.querySelector('.rv-qty').textContent,10);
  const d=row.querySelector('.rv-diff'), diff=(v==='')?null:(parseInt(v,10)-qty);
  d.className='rv-diff '+revDiffCls(diff); d.innerHTML=revDiffHtml(diff);
  revUpdateBtn();
}
function revToggleZero(){ revShowZero=!revShowZero; renderRevision(); }
function revToggleAdd(){ revAddOpen=!revAddOpen; renderRevision(); }
function revReset(){ Object.keys(revFacts).forEach(k=>delete revFacts[k]); renderRevision(); }
function revAddFilter(){ if(typeof msFillSelect==='function') msFillSelect(document.getElementById('rev-add-size'),document.getElementById('rev-add-mat').value,false); }
function revAddPos(){
  const m=document.getElementById('rev-add-mat').value, s=document.getElementById('rev-add-size').value;
  if(!m||!s) return;
  if(!revExtra.some(e=>e.mat===m&&e.size===s)) revExtra.push({mat:m,size:s});
  revAddOpen=false; renderRevision();
  toast(`Позиция добавлена: ${m} ${s}`,'ok');
}

function revApplyAll(){
  const ch=revChanges();
  if(!ch.length){ toast('Нечего применять: впишите факт хотя бы по одной позиции','info'); return; }
  const lines=ch.slice(0,12).map(c=>`${c.mat} · ${c.size}: ${c.qty} → ${c.fact} (${c.diff>0?'+':''}${c.diff})`);
  if(ch.length>12) lines.push(`… и ещё ${ch.length-12}`);
  askDialog(`Ревизия: позиций ${ch.length}\n`+lines.join('\n')+'\n\nРасхождения запишутся в Учёт: плюс — приход, минус — расход («Ревизия»).','Применить','Отмена','bprim',()=>revCommitAll(ch),null);
}
function revCommitAll(ch){
  const base=Date.now();
  ch.forEach((c,i)=>{
    const sz=parseSizeStr(c.size)||{w:0,l:0};
    const rec={id:base+i,dt:now(),mat:c.mat,size:c.size,w:sz.w,l:sz.l,qty:Math.abs(c.diff),order:'',rev:true,note:`Ревизия: ${c.fact} листов`};
    if(c.diff>0){
      const lastIn=[...db.income].reverse().find(r=>r.mat===c.mat&&r.size===c.size&&r.place);   // место — как у последнего прихода
      db.income.push({...rec,place:lastIn?lastIn.place:(PLACES[0]||'')});
    } else db.expense.push({...rec,etype:'full',det:''});
    if(!MATS.includes(c.mat)) MATS.push(c.mat);
  });
  Object.keys(revFacts).forEach(k=>delete revFacts[k]);
  revExtra.length=0;
  save(); renderAll(); renderRevision();
  toast(`⚖️ Ревизия записана: ${ch.length} поз.`,'ok');
}
