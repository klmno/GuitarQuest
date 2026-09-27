/* GuitarQuest: start-up. */
(function (G) {
  'use strict';
  const GQ = G.GQ, store = GQ.store, T = GQ.theory;
  const syncSetup = () => { const s = store.settings(); T.setup = { tuning: s.tuning, capo: +s.capo || 0 }; };
  syncSetup();
  store.on('settings', (e) => { if (e.key === 'tuning' || e.key === 'capo') syncSetup(); });
  store.on('profile', syncSetup);
  GQ.ui.start();
  const fv = document.getElementById('foot-version'); if (fv) fv.textContent = 'v' + G.GQ_VERSION;
  try { const seen = GQ.storage.get('seenVersion', null); if (seen && seen !== G.GQ_VERSION) GQ.ui.toast('Updated to version ' + G.GQ_VERSION + '. See Settings > About for what changed.', 6000); GQ.storage.set('seenVersion', G.GQ_VERSION); } catch { /* ignore */ }

  // Offline install (REQ-PF-1). Service workers need http(s); from file:// the app still runs, just not offline-installed.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker not registered:', e));
    // a newer version finished installing while the app was open: offer a reload
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController) return;
      const b = GQ.h('div.toast', { role: 'status' }, 'A new version of GuitarQuest is ready. ', GQ.h('button.btn.small.primary', { onclick: () => location.reload() }, 'Reload'));
      document.body.append(b);
    });
  }
})(window);
