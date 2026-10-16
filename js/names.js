window.__B=window.__B||{};__B['names']='2026-10-13a';
// ▸ names.js — «Умные» названия, как макрос в Excel: что бы вы ни набрали, подставляется правильное название.
//   normMaterial("акрил 3мм") → "Акрил 3 мм (мол.)";  normCategory("табличка") → "Табличка(и)"
// Материалы сверяются со справочником MATS (его вы ведёте в настройках), категории — с эталонным списком ниже.

const CATEGORY_WORDS=["Антикражка(и)","Бейдж(и)","Борт(а)","Буква(ы)","Вывеска(и)","Деталь(и)","Жидкий акрил","Задник(и)","Знак(и)","Карман(ы)",
  "Карта(ы)","Кассета(ы)","Короб(а)","Коробка(и)","Кронштейн","Куб(ы)","Лицо(а)","Логотип(ы)","Медаль(и)","Менюхолдер(ы)",
  "Неон","Номер(а)","Органайзер(ы)","Плакат(ы)","Плашка(и)","Плоскость(и)","Подложка(и)","Подставка(и)","Полоска(и)",
  "Режимник(и)","Ростомер(ы)","Статуэтка(и)","Стелла(ы)","Стенд(ы)","Стойка(и)","Табличка(и)","Трафарет(ы)",
  "Указатель(и)","Фишка(и)","Фотозона(ы)","Фриз(ы)","Холдер(ы)","Цифра(ы)","Штендер(ы)","Экран(ы)","Экстендер(ы)","Ящик(и)"];

const nmClean=s=>String(s==null?'':s).toLowerCase().replace(/ё/g,'е');
const nmLcp=(a,b)=>{ let i=0; while(i<a.length&&i<b.length&&a[i]===b[i]) i++; return i; };
function nmLev(a,b){
  const d=[]; for(let i=0;i<=a.length;i++){ d[i]=[i]; } for(let j=0;j<=b.length;j++) d[0][j]=j;
  for(let i=1;i<=a.length;i++) for(let j=1;j<=b.length;j++)
    d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));
  return d[a.length][b.length];
}

// ── Категория: первое слово подписи → эталонное слово («табличка», «таблички», «табл» → «Табличка(и)») ──
function normCategory(text){
  const raw=String(text==null?'':text).trim(); if(!raw) return raw;
  const m=raw.match(/^[^\s_]+/); const first=nmClean(m?m[0]:raw), rest=raw.slice(m?m[0].length:raw.length);
  let best=null,bestScore=-1;
  CATEGORY_WORDS.forEach(w=>{
    const base=nmClean(w.replace(/\(.*?\)/g,'').replace(/\s.*/,'')); // «Жидкий акрил» → «жидкий»
    const full=nmClean(w.replace(/\(.*?\)/g,''));
    if(first===base||first===full){ if(1000>bestScore){ best=w; bestScore=1000; } return; }
    const lcp=nmLcp(first,base), minLen=Math.min(first.length,base.length);
    let score=-1;
    if(lcp>=3&&lcp>=minLen*0.7) score=lcp*10-Math.abs(first.length-base.length);          // «табл», «таблички»
    else if(first.length>=5&&nmLev(first,base)<=2) score=50-nmLev(first,base)*10;           // опечатка: «таблчика»
    if(score>bestScore){ best=w; bestScore=score; }
  });
  if(!best||bestScore<0) return raw;
  return rest?(best+rest):best;
}

// ── Материал: «акрил 3мм» → «Акрил 3 мм (мол.)» ──
function nmParse(s){
  let t=nmClean(s).replace(/,/g,'.').replace(/\s+/g,' ').trim();
  const num=t.match(/\d+(?:\.\d+)?/);
  const before=num?t.slice(0,num.index):t;
  const after=num?t.slice(num.index+num[0].length):'';
  const fam=before.replace(/[^a-zа-я]/g,'');
  const colorStr=after.replace(/мм|mm/g,' ').replace(/[()]/g,' ');
  const colors=colorStr.split(/[^a-zа-я]+/).filter(Boolean);
  return {fam,th:num?parseFloat(num[0]):null,colors};
}
function normMaterial(text){
  const raw=String(text==null?'':text).trim().replace(/\s+/g,' '); if(!raw) return raw;
  const list=(typeof MATS!=='undefined'&&Array.isArray(MATS))?MATS:[];
  const exact=list.find(m=>nmClean(m)===nmClean(raw)); if(exact) return exact;
  const q=nmParse(raw); if(q.fam.length<3) return raw;
  // кандидаты: то же семейство и толщина
  const cands=list.map(m=>({m,p:nmParse(m)})).filter(c=>{
    const f=c.p.fam; if(!f) return false;
    const famOk=(f.startsWith(q.fam)||q.fam.startsWith(f))&&Math.min(f.length,q.fam.length)>=3;
    return famOk&&((q.th===null&&c.p.th===null)||(q.th!==null&&c.p.th===q.th));
  });
  if(!cands.length) return raw;
  const abbr=c=>{ const mm=c.m.match(/\(([^)]*)\)\s*$/); return mm?nmClean(mm[1]).replace(/[^a-zа-я]/g,''):''; };
  if(q.colors.length){
    // цвет: сравниваем начало слова с сокращением (чёрный → чёр., молочный → мол.)
    let best=null,bs=0;
    cands.forEach(c=>{
      const a=abbr(c); if(!a) return;
      q.colors.forEach(tok=>{ const l=nmLcp(tok.replace(/[^a-zа-я]/g,''),a); if(l>=3){ const sc=l*10-Math.abs(tok.length-a.length); if(sc>bs){ bs=sc; best=c; } } });
    });
    return best?best.m:raw;
  }
  // цвет не указан: материал без цвета; для акрила — молочный
  const plain=cands.filter(c=>!abbr(c)); if(plain.length) return plain[0].m;
  const mol=cands.find(c=>abbr(c)==='мол'); if(mol) return mol.m;
  return cands.length===1?cands[0].m:raw;
}

// При уходе из поля материала — подставляем правильное название (поля прихода, расхода и обрезков)
document.addEventListener('focusout',e=>{
  const el=e.target; if(!el||!/^(in-mat|out-mat|rem-mat)$/.test(el.id||'')) return;
  const v=el.value, n=normMaterial(v);
  if(n&&n!==v.trim()){ el.value=n; if(typeof acUpdateClear==='function') acUpdateClear(el.id); }
});
