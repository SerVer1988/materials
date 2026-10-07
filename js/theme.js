// ▸ theme.js — переключение светлой/тёмной темы (настройки). Хранится на устройстве, по умолчанию светлая.
const THEME_KEY='lm7_theme';
const THEME_COLORS={light:'#FFFFFF', dark:'#1A2027'};

function getTheme(){
  return document.documentElement.getAttribute('data-theme')==='dark' ? 'dark' : 'light';
}
function setTheme(t){
  t = t==='dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme',t);
  try{ localStorage.setItem(THEME_KEY,t); }catch(e){}
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content',THEME_COLORS[t]);
  updateThemeBtns();
}
function updateThemeBtns(){
  const t=getTheme();
  ['light','dark'].forEach(k=>{
    const b=document.getElementById('theme-btn-'+k);
    if(b) b.classList.toggle('active',k===t);
  });
}
// синхронизируем meta и кнопки с темой, выставленной в theme-init.js
(function(){
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content',THEME_COLORS[getTheme()]);
  updateThemeBtns();
})();
