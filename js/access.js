// ▸ access.js — Код доступа: ввод, список недавних, смена кода
// ── КОД ДОСТУПА ──
let ACCESS_CODE = '';
let codeVisible = false;

function getAccessCode(){ return localStorage.getItem('lm7_access_code')||''; }

// Сохраняем код в список недавних (макс 5)
function saveRecentCode(code){
  let recent = JSON.parse(localStorage.getItem('lm7_recent_codes')||'[]');
  recent = recent.filter(c=>c!==code); // убираем если уже есть
  recent.unshift(code);
  if(recent.length>5) recent=recent.slice(0,5);
  localStorage.setItem('lm7_recent_codes', JSON.stringify(recent));
}

function getRecentCodes(){
  return JSON.parse(localStorage.getItem('lm7_recent_codes')||'[]');
}

function renderRecentCodes(){
  const wrap=document.getElementById('recent-codes-wrap');
  const list=document.getElementById('recent-codes-list');
  if(!wrap||!list) return;
  const codes=getRecentCodes();
  if(!codes.length){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  list.innerHTML=codes.map(c=>`
    <button onclick="quickLogin('${c}')" style="
      display:flex;align-items:center;justify-content:space-between;
      width:100%;padding:10px 14px;
      background:var(--card2);border:1px solid var(--border);border-radius:var(--rs);
      font-family:'Nunito',sans-serif;font-size:13px;font-weight:800;
      color:var(--text);cursor:pointer;text-align:left;
      transition:border-color .15s,background .15s
    " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
      <span style="letter-spacing:.06em;color:var(--accent)">🔑 ${c}</span>
      <span style="color:var(--muted);font-size:11px">войти →</span>
    </button>`).join('');
}

function quickLogin(code){
  if(!ALLOWED_CODES.includes(code)){
    let recent = JSON.parse(localStorage.getItem('lm7_recent_codes')||'[]');
    recent = recent.filter(c=>c!==code);
    localStorage.setItem('lm7_recent_codes', JSON.stringify(recent));
    renderRecentCodes();
    return;
  }
  document.getElementById('access-code-input').value=code;
  applyAccessCode();
}

// ── СПИСОК РАЗРЕШЁННЫХ КОДОВ ДОСТУПА ──
const ALLOWED_CODES = ['BOTSAD27', 'BOTSAD1'];

function applyAccessCode(){
  const inp = document.getElementById('access-code-input');
  const val = (inp.value||'').trim().toUpperCase();
  const errEl = document.getElementById('access-error');
  if(val.length < 3){
    errEl.textContent = 'Введите код (минимум 3 символа)';
    errEl.style.display='block';
    return;
  }
  if(!ALLOWED_CODES.includes(val)){
    errEl.textContent = 'Неверный код доступа. Обратитесь к администратору.';
    errEl.style.display='block';
    inp.value='';
    inp.focus();
    return;
  }
  errEl.style.display='none';
  saveRecentCode(val);
  localStorage.setItem('lm7_access_code', val);
  ACCESS_CODE = val;
  document.getElementById('access-screen').style.display='none';
  updateCodeBadge();
  updateMoreCodeDisplay();
  init();
}

function updateCodeBadge(){
  const badge=document.getElementById('access-code-badge');
  if(badge&&ACCESS_CODE) badge.textContent=`🔑 ${ACCESS_CODE}`;
}

function updateMoreCodeDisplay(){
  const el=document.getElementById('more-code-display');
  if(!el) return;
  if(codeVisible){
    el.textContent=ACCESS_CODE||'—';
    el.style.filter='none';
  } else {
    el.textContent='•'.repeat(Math.max(6,ACCESS_CODE.length));
    el.style.filter='blur(5px)';
  }
}

function toggleCodeVisibility(){
  codeVisible=!codeVisible;
  updateMoreCodeDisplay();
  const btn=document.getElementById('more-code-toggle-btn');
  if(btn) btn.textContent=codeVisible?'🙈 Скрыть':'👁 Показать';
}

function copyAccessCode(){
  if(!ACCESS_CODE) return;
  navigator.clipboard.writeText(ACCESS_CODE).then(()=>{
    toast('📋 Код скопирован','ok');
  }).catch(()=>{
    // fallback
    const el=document.createElement('textarea');
    el.value=ACCESS_CODE; el.style.position='fixed'; el.style.opacity='0';
    document.body.appendChild(el); el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    toast('📋 Код скопирован','ok');
  });
}

function showChangeCode(){
  confirm2(`Сменить код доступа?\nТекущий: ${ACCESS_CODE}\n\nПосле смены откроются данные другого кода.`, ()=>{
    localStorage.removeItem('lm7_access_code');
    localStorage.removeItem('lm7');
    localStorage.removeItem('lm7_fav');
    localStorage.removeItem('lm7_mats');
    localStorage.removeItem('lm7_sizes');
    localStorage.removeItem('lm7_places');
    ACCESS_CODE=''; codeVisible=false;
    // Показываем экран входа с недавними кодами
    document.getElementById('access-screen').style.display='flex';
    document.getElementById('access-code-input').value='';
    document.getElementById('access-error').style.display='none';
    document.getElementById('access-code-badge').textContent='';
    renderRecentCodes();
  });
}
