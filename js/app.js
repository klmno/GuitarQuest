/* GuitarQuest: start-up. */
(function (G) {
  'use strict';
  const GQ = G.GQ, store = GQ.store, T = GQ.theory;
  const syncSetup = () => { const s = store.settings(); T.setup = { tuning: s.tuning, capo: +s.capo || 0 }; };
  syncSetup();
  store.on('settings', (e) => { if (e.key === 'tuning' || e.key === 'capo') syncSetup(); });
  store.on('profile', syncSetup);
  GQ.ui.start();

  // Offline install (REQ-PF-1). Service workers need http(s); from file:// the app still runs, just not offline-installed.
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker not registered:', e));
  }
})(window);
