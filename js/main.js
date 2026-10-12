window.__B=window.__B||{};__B['main']='2026-10-13a';
// ▸ main.js — Точка входа (подключается последней)
// ══════════════════════════════════════ ENTRY POINT
ACCESS_CODE = getAccessCode();
if(!ACCESS_CODE){
  document.getElementById('access-screen').style.display='flex';
  renderRecentCodes();
  setTimeout(()=>document.getElementById('access-code-input')?.focus(), 200);
} else {
  document.getElementById('access-screen').style.display='none';
  updateCodeBadge();
  updateMoreCodeDisplay();
  init();
}
