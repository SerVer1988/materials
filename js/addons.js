window.__B=window.__B||{};__B['addons']='2026-10-13a';
// ▸ addons.js — «Дополнения для CorelDRAW и Windows» в настройках.
//   Макрос AppSend.bas собирается на лету из шаблона addons/AppSend.bas: в него подставляются ваш код доступа и данные облака,
//   файл отдаётся в кодировке Windows-1251 (так его читает редактор макросов CorelDRAW).
//   Установщик для Windows (кнопка 📂 «открыть файл заказа») — готовый архив addons/CorelOpen.zip.
let _cp1251=null;
function cp1251Decode(buf){ return new TextDecoder('windows-1251').decode(buf); }
function cp1251Encode(str){
  if(!_cp1251){ _cp1251=new Map(); const d=new TextDecoder('windows-1251'); for(let b=0x80;b<=0xFF;b++) _cp1251.set(d.decode(new Uint8Array([b])),b); }
  const out=[]; let bad=0;
  for(const ch of str){
    const c=ch.codePointAt(0);
    if(c<0x80) out.push(c);
    else if(_cp1251.has(ch)) out.push(_cp1251.get(ch));
    else { out.push(63); bad++; }                              // такого символа в Windows-1251 нет — «?»
  }
  return {bytes:new Uint8Array(out),bad};
}
function basSetConst(txt,name,val){
  const re=new RegExp('(Private Const '+name+' As String = ")[^"]*(")');
  if(!re.test(txt)) throw new Error('в шаблоне нет '+name);
  return txt.replace(re,(m,a,b)=>a+String(val).replace(/"/g,'""')+b);
}
function saveBlob(bytes,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
  a.download=name; a.style.display='none'; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1500);
}
async function downloadMacro(){
  if(!ACCESS_CODE){ toast('Сначала введите код доступа к приложению','err'); return; }
  try{
    const r=await fetch('addons/AppSend.bas?t='+Date.now(),{cache:'no-store'});
    if(!r.ok) throw new Error('файл addons/AppSend.bas не найден (HTTP '+r.status+')');
    let txt=cp1251Decode(await r.arrayBuffer());
    txt=basSetConst(txt,'ACCESS_CODE',ACCESS_CODE);
    txt=basSetConst(txt,'SB_URL',SB_URL);
    txt=basSetConst(txt,'SB_KEY',SB_KEY);
    const enc=cp1251Encode(txt);
    saveBlob(enc.bytes,'AppSend.bas');
    toast('⬇️ AppSend.bas скачан — ваш код доступа уже внутри','ok');
  }catch(e){ toast('Не удалось скачать макросы: '+e.message,'err'); }
}
