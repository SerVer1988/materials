// ▸ theme-init.js — применяет сохранённую тему до отрисовки (подключается в <head>). По умолчанию светлая.
(function(){
  var t='light';
  try{ if(localStorage.getItem('lm7_theme')==='dark') t='dark'; }catch(e){}
  document.documentElement.setAttribute('data-theme',t);
})();
