// ▸ export.js — Экспорт Excel/JSON, импорт, очистка
// ══════════════════════════════════════ EXPORT
function expExcel(){
  const wb=XLSX.utils.book_new();
  if(document.getElementById('ex-in').checked&&db.income.length){
    const d=[['#','Дата','Материал','Размер','Ш','Д','Кол-во','Место','Примечание']];
    db.income.forEach((r,i)=>d.push([i+1,r.dt,r.mat,r.size,r.w,r.l,r.qty,r.place||'',r.note||'']));
    XLSX.utils.book_append_sheet(wb,mks(d),'Приход');
  }
  if(document.getElementById('ex-out').checked&&db.expense.length){
    const d=[['#','Дата','Тип','Материал','Размер','Кол-во','Изделие','Примечание']];
    db.expense.forEach((r,i)=>d.push([i+1,r.dt,r.etype==='partial'?'Изделие':'Лист',r.mat,r.size,r.qty,r.det||'',r.note||'']));
    XLSX.utils.book_append_sheet(wb,mks(d),'Расход');
  }
  if(document.getElementById('ex-rem').checked&&db.remainders.length){
    const d=[['#','Дата','Тип','Материал','Ш','Д','Кол-во','Площадь м²','Место']];
    db.remainders.forEach((rec,i)=>rec.pieces.forEach(p=>{
      const m2=+(p.w*p.l*p.qty/1e6).toFixed(4);
      d.push([i+1,rec.dt,p.type==='scrap_sub'?'−Списание':'+Обрезок',p.mat,p.w,p.l,p.qty,p.type==='scrap_sub'?-m2:m2,p.place||rec.place||'']);
    }));
    XLSX.utils.book_append_sheet(wb,mks(d),'Обрезки');
  }
  if(document.getElementById('ex-stk').checked){
    const by=calcStockDetailed();
    const d=[['Материал','Размер','Приход','Расход','Остаток']];
    Object.keys(by).sort().forEach(mat=>by[mat].forEach(s=>d.push([mat,s.size,s.inc,s.dec,s.qty])));
    XLSX.utils.book_append_sheet(wb,mks(d),'Остатки');
  }
  if(!wb.SheetNames.length){toast('Нет данных','err');return;}
  XLSX.writeFile(wb,`материалы_${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('📊 Excel скачан','ok');
}
function mks(data){const ws=XLSX.utils.aoa_to_sheet(data);ws['!cols']=data[0].map((_,i)=>({wch:i===0?5:i===1?18:i===2?30:14}));return ws;}
function expJSON(){const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(new Blob([JSON.stringify({db,MATS,SIZES,PLACES},null,2)],{type:'application/json'})),download:`backup_${new Date().toISOString().slice(0,10)}.json`});a.click();toast('💾 Копия сохранена','ok');}
function trigImp(){document.getElementById('imp-f').click();}
function doImport(e){
  const f=e.target.files[0];if(!f)return;
  const r=new FileReader();
  r.onload=ev=>{
    try{
      const d=JSON.parse(ev.target.result);const data=d.db||d;
      if(!data.income||!data.expense) throw 0;
      confirm2('Заменить все текущие данные?',()=>{
        db=data;if(!db.remainders)db.remainders=[];
        if(d.MATS)MATS=d.MATS;if(d.SIZES)SIZES=d.SIZES;if(d.PLACES)PLACES=d.PLACES;
        save();fillAllSelects();renderIn();renderOut();renderStock();renderRemByMat();renderHist();
        toast('✅ Данные восстановлены','ok');
      });
    }catch{toast('Неверный формат','err');}
  };
  r.readAsText(f);e.target.value='';
}
function clrAll(){
  confirm2('Удалить ВСЕ данные?',()=>{
    db={income:[],expense:[],remainders:[]};
    save();renderIn();renderOut();renderStock();renderRemByMat();renderHist();
    toast('Все данные удалены');
  });
}
