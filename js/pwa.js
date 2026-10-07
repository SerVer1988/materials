// ▸ pwa.js — PWA: регистрация service worker и баннер установки
// ══════════════════════════════════════ PWA: SERVICE WORKER + INSTALL
(function(){
  // ── Регистрируем Service Worker (sw.js) ──
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(()=>{}); // тихо игнорируем ошибки (например file://)
  }

  // ── Баннер "Установить приложение" ──
  let deferredPrompt = null;

  // Создаём баннер
  const banner = document.createElement('div');
  banner.id = 'pwa-banner';
  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex:1">
      <div style="width:40px;height:40px;background:#F6C90E;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">📦</div>
      <div>
        <div style="font-weight:800;font-size:14px;color:#EEEEEE">Установить приложение</div>
        <div style="font-size:11px;color:#7A8C99;margin-top:1px">Добавить на главный экран</div>
      </div>
    </div>
    <button id="pwa-install-btn" style="background:#F6C90E;color:#111;border:none;border-radius:8px;padding:9px 16px;font-family:'Nunito',sans-serif;font-weight:800;font-size:13px;cursor:pointer;white-space:nowrap;flex-shrink:0">Установить</button>
    <button id="pwa-dismiss-btn" style="background:none;border:none;color:#7A8C99;font-size:20px;cursor:pointer;padding:4px;flex-shrink:0;line-height:1">✕</button>
  `;
  Object.assign(banner.style, {
    display: 'none',
    position: 'fixed',
    bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))',
    left: '12px', right: '12px',
    background: '#252C33',
    border: '1px solid #3A4750',
    borderRadius: '14px',
    padding: '12px 14px',
    boxShadow: '0 6px 28px rgba(0,0,0,.6)',
    zIndex: '150',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    animation: 'pwa-slide-up .3s ease'
  });

  // Добавляем анимацию
  const style = document.createElement('style');
  style.textContent = `@keyframes pwa-slide-up{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`;
  document.head.appendChild(style);
  document.body.appendChild(banner);

  // Ловим событие beforeinstallprompt (Chrome/Android)
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    // Показываем баннер только если не отклоняли раньше 
    if(!localStorage.getItem('pwa_dismissed')){
      banner.style.display = 'flex';
    }
  });

  document.getElementById('pwa-install-btn').addEventListener('click', () => {
    banner.style.display = 'none';
    if(deferredPrompt){
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(r => {
        if(r.outcome === 'accepted') localStorage.setItem('pwa_installed','1');
        deferredPrompt = null;
      });
    }
  });

  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    banner.style.display = 'none';
    localStorage.setItem('pwa_dismissed','1');
  });

  // При успешной установке скрываем баннер
  window.addEventListener('appinstalled', () => {
    banner.style.display = 'none';
    localStorage.setItem('pwa_installed','1');
  });
})();
