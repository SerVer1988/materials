// ▸ crud.js — Общая перерисовка и удаление записей
// ══════════════════════════════════════ RENDER ALL
// Перерисовывает всё — вызывать после любого изменения данных
function renderAll(){
  renderIn(); renderOut(); renderStock(); renderRemByMat(); renderHist();
}

// ══════════════════════════════════════ DELETE
function del(tbl,id){
  confirm2('Удалить эту запись?',()=>{
    if(tbl==='expense'){
      const exp=db.expense.find(r=>r.id===id);
      // Восстанавливаем обрезки использованные через applyScrapPlan
      if(exp && exp.consumedScraps && exp.consumedScraps.length){
        exp.consumedScraps.forEach(cs=>{
          // Ищем запись куда вернуть
          let rec=db.remainders.find(r=>r.id===cs.recId);
          if(rec){
            // Возвращаем qty к обрезку если он ещё есть
            const existing=rec.pieces.find(p=>p.w===cs.w&&p.l===cs.l&&p.mat===cs.mat);
            if(existing) existing.qty=(existing.qty||1)+cs.qty;
            else rec.pieces.push({mat:cs.mat,w:cs.w,l:cs.l,qty:cs.qty,type:'scrap_add',place:cs.place});
            rec.totalM2=+rec.pieces.reduce((s,p)=>s+p.w*p.l*(p.qty||1)/1e6,0).toFixed(4);
            rec.totalPcs=rec.pieces.reduce((s,p)=>s+(p.qty||1),0);
          } else {
            // Запись обрезка была удалена — создаём новую
            db.remainders.push({
              id:Date.now()+Math.random()*100|0, dt:now(),
              pieces:[{mat:cs.mat,w:cs.w,l:cs.l,qty:cs.qty,type:'scrap_add',place:cs.place}],
              totalM2:+(cs.w*cs.l*cs.qty/1e6).toFixed(4), totalPcs:cs.qty, place:cs.place
            });
          }
        });
      }
      // Удаляем автообрезки связанные с этим расходом
      // Удаляем автообрезки через softDelete
      db.remainders.filter(r=>r.expenseId===id || r.id===id+1 || r.id===id+2)
        .forEach(r=>{ deletedIds.add(r.id); });
      db.remainders=db.remainders.filter(r=>r.expenseId!==id && r.id!==id+1 && r.id!==id+2);
    }
    // softDelete чтобы запись не вернулась при синхронизации
    if(tbl==='income') db.income = softDelete(db.income, id);
    else if(tbl==='expense') db.expense = softDelete(db.expense, id);
    else db[tbl] = db[tbl].filter(r=>r.id!==id);
    save(); renderAll();
    toast('Запись удалена');
  });
}
