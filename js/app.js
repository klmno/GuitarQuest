/* GuitarQuest: start-up. */
(function (G) {
  'use strict';
  const GQ = G.GQ, store = GQ.store, T = GQ.theory;
  const syncSetup = () => { const s = store.settings(); T.setup = { tuning: s.tuning, capo: +s.capo || 0 }; };
  syncSetup();
  store.on('settings', (e) => { if (e.key === 'tuning' || e.key === 'capo') syncSetup(); });
  store.on('profile', syncSetup);
  GQ.ui.start();
  // songs folder: after a reload the browser may want the user's OK again before the app writes to it
  GQ.folder.init().then(() => {
    if (GQ.folder.state !== 'ask') return;
    for (const old of document.querySelectorAll('.toast')) old.remove();
    const t = GQ.h('div.toast', { role: 'status' }, `Your songs folder "${GQ.folder.name()}" needs your OK before new songs are saved there. `,
      GQ.h('button.btn.small.primary', { onclick: () => { t.remove(); GQ.folder.allow().then((r) => r && GQ.ui.toast(GQ.folder.summary(r), 5000)).catch((e) => GQ.ui.toast('Could not use the folder: ' + e.message, 6000)); } }, 'Allow'));
    document.body.append(t);
    setTimeout(() => t.remove(), 15000);
  }).catch((e) => console.warn('Songs folder:', e));
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
