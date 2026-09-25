/* GuitarQuest: app shell: router, top bar, input status, and the Learn, Songs and Progress screens. */
(function (G) {
  'use strict';
  const GQ = G.GQ, h = GQ.h, store = GQ.store, A = GQ.audio, CUR = GQ.curriculum;
  const UI = (GQ.ui = { screens: {}, current: null });

  // ---------- helpers ----------
  UI.stars = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  UI.toast = function (text, ms) {
    const t = h('div.toast', { role: 'status' }, text);
    document.body.append(t);
    setTimeout(() => t.remove(), ms || 3200);
  };
  UI.banner = function (kind, text, actions) {
    return h('div.banner.' + kind, null, h('span.grow', null, text), ...(actions || []));
  };
  UI.alerts = h('div#alerts');
  UI.applyDisplay = function () {
    const s = store.settings();
    document.documentElement.style.setProperty('--scale', s.displaySize || 1);
  };

  // Connect-the-guitar widget, used wherever input is needed (REQ-HW-1)
  UI.connectCard = function (onOpen) {
    const card = h('div.card.stack');
    const sel = h('select', { disabled: true }, h('option', null, 'Allow audio access first'));
    const badge = h('span.badge', null, 'No device');
    const status = h('div.small.muted');
    const allow = h('button.btn.primary', { onclick: allowFn }, 'Allow audio input');
    const open = h('button.btn.primary', { disabled: true, onclick: () => openFn(sel.value) }, 'Use this input');
    card.append(
      h('h2', null, 'Connect your guitar'),
      h('p.muted.small', null, 'Plug the guitar in by USB-C (or its output into an audio interface), switch it on, then allow audio access. Audio is analysed on this device and never uploaded.'),
      h('div.row', null, allow),
      h('label.field', null, 'Input device', sel),
      h('div.row', null, badge, open), status);
    const fill = () => {
      sel.innerHTML = '';
      const rank = { guitar: 0, direct: 1, unknown: 2, alias: 3, mic: 4 };
      const list = A.devices.map((d) => ({ d, c: A.classify(d) })).sort((a, b) => rank[a.c.kind] - rank[b.c.kind]);
      for (const { d } of list) sel.append(h('option', { value: d.deviceId }, d.label || 'Unnamed input'));
      const saved = store.settings().deviceId;
      if (saved && A.devices.some((d) => d.deviceId === saved)) sel.value = saved;
      sel.disabled = !A.devices.length; open.disabled = !A.devices.length;
      upd();
    };
    const upd = () => { const d = A.devices.find((x) => x.deviceId === sel.value); const c = d ? A.classify(d) : null; badge.className = 'badge ' + (c ? c.cls : ''); badge.textContent = c ? c.text : 'No device'; };
    sel.onchange = upd;
    async function allowFn() {
      if (!A.supported()) { status.textContent = 'This browser cannot capture audio here. Use a current Chrome, Edge or Safari on an https or localhost page.'; return; }
      try { await A.requestPermission(); } catch (e) { status.textContent = 'Audio access was refused (' + e.name + '). Allow it in the site settings and try again.'; return; }
      allow.textContent = 'Access allowed'; allow.disabled = true;
      fill();
      const saved = store.settings().deviceId;
      if (saved && A.devices.some((d) => d.deviceId === saved)) openFn(saved);
    }
    async function openFn(id) {
      status.textContent = 'Opening…';
      try { await A.open(id); status.textContent = ''; if (onOpen) onOpen(); }
      catch (e) { status.textContent = 'Could not open that input: ' + (e.message || e.name); }
    }
    if (A.permitted) { allow.textContent = 'Access allowed'; allow.disabled = true; fill(); }
    return card;
  };

  // ---------- top bar ----------
  const LOGO = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M16 2c7 0 12 3 12 8 0 7-7 16-12 20C11 26 4 17 4 10c0-5 5-8 12-8z" fill="#f0a53a"/><path d="M13 9v11.5a3 3 0 1 0 2 2.8V13l6-1.5v-3z" fill="#1b1203"/></svg>';
  function topbar() {
    const chip = h('button.inputchip', { onclick: () => (location.hash = '#/settings/input'), title: 'Guitar input' },
      h('span.dot'), h('span.label', null, 'No input'), h('span.mini', null, h('div')));
    UI.chip = chip;
    const nav = h('nav.nav', null,
      ...[['learn', 'Learn'], ['songs', 'Songs'], ['tuner', 'Tuner'], ['progress', 'Progress'], ['settings', 'Settings']]
        .map(([k, t]) => h('a', { href: '#/' + k, 'data-k': k }, t)));
    UI.nav = nav;
    return h('header.topbar', null, h('div.brand', { html: LOGO + '<span>GuitarQuest</span>' }), nav, chip);
  }
  function updateChip() {
    const chip = UI.chip; if (!chip) return;
    const d = A.current(), c = d && A.ctx ? A.classify(d) : null;
    chip.className = 'inputchip ' + (c ? c.cls : '');
    chip.querySelector('.label').textContent = A.ctx ? (A.deviceLabel + (c && !c.scored ? ' · not for scoring' : '')) : 'Connect guitar';
    const pct = A.ctx ? GQ.clamp((A.level.peakDb + 60) / 60, 0, 1) * 100 : 0;
    const mini = chip.querySelector('.mini');
    mini.firstChild.style.width = pct + '%';
    mini.classList.toggle('clip', A.level.clipUntil > performance.now());
  }

  // ---------- router ----------
  function route() {
    const parts = (location.hash || '#/learn').slice(2).split('/');
    const name = parts[0] || 'learn';
    if (UI.current && UI.current.destroy) UI.current.destroy();
    UI.current = null; UI.draw = null;
    const main = document.querySelector('main');
    main.innerHTML = '';
    main.append(UI.alerts);
    const screen = UI.screens[name] || UI.screens.learn;
    UI.current = screen(main, parts.slice(1)) || {};
    for (const a of UI.nav.querySelectorAll('a')) a.classList.toggle('on', a.dataset.k === name || (name === 'lesson' && a.dataset.k === 'learn'));
    window.scrollTo(0, 0);
  }
  UI.go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

  function loop() {
    updateChip();
    if (UI.draw) { try { UI.draw(performance.now()); } catch (e) { console.error(e); UI.draw = null; } }
    requestAnimationFrame(loop);
  }

  // ---------- Learn ----------
  UI.nextLevelId = function () {
    const p = store.profile();
    const lv = CUR.levels.find((l) => !(p.levels[l.id] && p.levels[l.id].stars > 0));
    return lv ? lv.id : CUR.levels[0].id;
  };
  UI.modeSeg = function (onChange) {
    const s = store.settings();
    const seg = h('div.seg', { role: 'group', 'aria-label': 'Mode' });
    for (const [k, t] of [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']]) {
      seg.append(h('button', { class: s.mode === k ? 'on' : '', onclick: () => {
        store.setSetting('mode', k);
        for (const b of seg.children) b.classList.toggle('on', b === seg.querySelector(`[data-k="${k}"]`));
        if (onChange) onChange(k);
      }, 'data-k': k, title: { beginner: 'The piece waits for each note', intermediate: 'In time, generous window, fretboard and tab', advanced: 'Full tempo, tight window, tab or notation only' }[k] }, t));
    }
    return seg;
  };
  UI.screens.learn = function (main) {
    const p = store.profile();
    const passed = CUR.levels.filter((l) => p.levels[l.id] && p.levels[l.id].stars > 0).length;
    const starsTotal = Object.values(p.levels).reduce((s, r) => s + (r.stars || 0), 0);
    const nextId = UI.nextLevelId(), next = CUR.byId(nextId);
    if (!A.ctx) main.append(h('div', { style: { marginBottom: '1rem' } }, UI.connectCard(() => route())));
    main.append(h('div.hero', null,
      h('div', null, h('h2', null, 'Hi ' + p.name), h('div.muted.small', null, `${CUR.levels.length} levels in ${CUR.units.length} units`)),
      h('div.stats', null,
        h('div.stat', null, h('b', null, passed), h('span', null, 'levels passed')),
        h('div.stat', null, h('b', null, starsTotal), h('span', null, 'stars')),
        h('div.stat', null, h('b', null, store.streak()), h('span', null, 'day streak')),
        h('div.stat', null, h('b', null, Math.round(p.minutes)), h('span', null, 'minutes'))),
      h('div.row', null, UI.modeSeg(), h('button.btn.primary.big', { onclick: () => UI.go('#/lesson/' + nextId) }, '▶ ' + (next ? next.title : 'Start')))));
    for (const u of CUR.units) {
      const done = u.levels.filter((l) => p.levels[l.id] && p.levels[l.id].stars > 0).length;
      const card = h('section.card.unit', null,
        h('div.unit-head', null, h('div', null, h('h2', null, u.id + '. ' + u.title), h('p', null, u.blurb)),
          h('div.row', null, h('span.small.muted', null, `${done}/${u.levels.length}`), h('div.progressbar', null, h('div', { style: { width: (100 * done / u.levels.length) + '%' } })))),
        h('div.levels', null, ...u.levels.map((l) => {
          const r = p.levels[l.id];
          return h('button', { class: 'lvl' + (r && r.stars ? ' passed' : '') + (l.id === nextId ? ' next' : ''), onclick: () => UI.go('#/lesson/' + l.id) },
            h('span.num', null, u.id + '.' + l.n + (r && r.best ? ' · ' + r.best + '%' : '')), h('span.t', null, l.title), h('span.stars', null, UI.stars(r ? r.stars : 0)));
        })));
      main.append(card);
    }
  };

  // ---------- Songs (REQ-FN-4) ----------
  UI.screens.songs = function (main) {
    const p = store.profile();
    let cat = 'all';
    const cats = ['all', 'folk', 'classical', 'blues', 'rock', 'original'];
    const seg = h('div.seg', null, ...cats.map((c) => h('button', { class: c === cat ? 'on' : '', onclick: (e) => { cat = c; for (const b of seg.children) b.classList.toggle('on', b === e.target); draw(); } }, c[0].toUpperCase() + c.slice(1))));
    const grid = h('div.songs');
    main.append(h('div.hero', null, h('div', null, h('h2', null, 'Song library'), h('p.muted.small', null, 'Traditional, public-domain and original pieces only. The origin of each one is on its card.')), seg), grid);
    function draw() {
      grid.innerHTML = '';
      for (const s of GQ.SONGS.filter((x) => cat === 'all' || x.category === cat).sort((a, b) => a.difficulty - b.difficulty)) {
        const best = Math.max(0, ...['riff', 'full'].map((k) => (p.levels['song-' + s.id + '-' + k] || {}).best || 0), (p.levels[(CUR.levels.find((l) => l.song === s.id && l.unit === 14) || {}).id] || {}).best || 0);
        grid.append(h('div.card.song', null,
          h('div.row.spread', null, h('span.badge.info', null, s.category), h('span.badge', null, 'Level ' + s.difficulty + ' · ' + '●'.repeat(s.difficulty) + '○'.repeat(3 - s.difficulty))),
          h('h4', { style: { marginTop: '.5rem' } }, s.title),
          h('div.origin', null, s.origin),
          h('div.row', { style: { marginTop: '.6rem' } },
            h('button.btn.small', { onclick: () => UI.go('#/lesson/song-' + s.id + '-riff') }, 'Riff only'),
            h('button.btn.small.primary', { onclick: () => UI.go('#/lesson/song-' + s.id + '-full') }, 'Full song'),
            best ? h('span.small.muted', null, 'Best ' + best + '%') : null)));
      }
    }
    draw();
  };

  // ---------- Progress (REQ-SC-3) ----------
  UI.screens.progress = function (main) {
    const p = store.profile();
    const hist = p.history.filter((x) => x.scored);
    const passed = CUR.levels.filter((l) => p.levels[l.id] && p.levels[l.id].stars > 0).length;
    const acc = hist.length ? Math.round(GQ.mean(hist.slice(-30).map((x) => x.acc))) : 0;
    const top = (obj, n) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
    const changes = Object.entries(p.changes).map(([k, v]) => [k, Math.round(v.totalMs / v.n), v.bestMs, v.n]).sort((a, b) => b[1] - a[1]);
    const chart = h('canvas.chart');
    main.append(
      h('div.hero', null, h('h2', null, 'Progress: ' + p.name),
        h('div.stats', null,
          h('div.stat', null, h('b', null, passed + '/' + CUR.levels.length), h('span', null, 'levels passed')),
          h('div.stat', null, h('b', null, Object.values(p.levels).reduce((s, r) => s + (r.stars || 0), 0)), h('span', null, 'stars')),
          h('div.stat', null, h('b', null, acc + '%'), h('span', null, 'accuracy, last 30 runs')),
          h('div.stat', null, h('b', null, Math.round(p.minutes)), h('span', null, 'practice minutes')),
          h('div.stat', null, h('b', null, store.streak()), h('span', null, 'day streak')))),
      h('div.card', { style: { marginBottom: '1rem' } }, h('h3', { style: { marginTop: 0 } }, 'Score history'), hist.length ? chart : h('p.muted', null, 'No scored runs yet.')),
      h('div.grid3', null,
        h('div.card', null, h('h3', { style: { marginTop: 0 } }, 'Notes most often missed'), list(top(p.misses, 8), (v) => v + '×')),
        h('div.card', null, h('h3', { style: { marginTop: 0 } }, 'Chords most often missed'), list(top(p.chordMisses, 8), (v) => v + '×')),
        h('div.card', null, h('h3', { style: { marginTop: 0 } }, 'Chord changes (slowest first)'),
          changes.length ? h('ul.list', null, ...changes.slice(0, 8).map(([k, avg, best]) => h('li', null, h('span', null, k), h('span', null, `${(avg / 1000).toFixed(2)} s · best ${(best / 1000).toFixed(2)} s`))))
            : h('p.muted.small', null, 'Play chord levels in Beginner mode to measure your change speed.'))),
      h('div.card', { style: { marginTop: '1rem' } }, h('h3', { style: { marginTop: 0 } }, 'Units'),
        h('ul.list', null, ...CUR.units.map((u) => {
          const d = u.levels.filter((l) => p.levels[l.id] && p.levels[l.id].stars > 0).length;
          return h('li', null, h('span', null, u.id + '. ' + u.title), h('span', null, `${d}/${u.levels.length} · ${u.levels.reduce((s, l) => s + ((p.levels[l.id] || {}).stars || 0), 0)}★`));
        }))));
    function list(entries, fmt) {
      return entries.length ? h('ul.list', null, ...entries.map(([k, v]) => h('li', null, h('span', null, k), h('span', null, fmt(v))))) : h('p.muted.small', null, 'Nothing yet.');
    }
    if (hist.length) requestAnimationFrame(() => {
      const { g, w, h: H } = GQ.fitCanvas(chart);
      const pts = hist.slice(-40);
      g.strokeStyle = '#2b3038';
      for (const y of [60, 80, 95]) { const yy = H - 10 - (y / 100) * (H - 20); g.beginPath(); g.moveTo(0, yy); g.lineTo(w, yy); g.stroke(); g.fillStyle = '#8b939e'; g.font = '11px ui-monospace'; g.fillText(y + '%', 4, yy - 3); }
      g.strokeStyle = '#f0a53a'; g.lineWidth = 2; g.beginPath();
      pts.forEach((r, i) => { const x = 40 + (i / Math.max(1, pts.length - 1)) * (w - 50), y = H - 10 - (r.score / 100) * (H - 20); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
      g.stroke();
      pts.forEach((r, i) => { const x = 40 + (i / Math.max(1, pts.length - 1)) * (w - 50), y = H - 10 - (r.score / 100) * (H - 20); g.fillStyle = r.stars ? '#3ecf8e' : '#f05a4f'; g.beginPath(); g.arc(x, y, 3.5, 0, 7); g.fill(); });
    });
  };

  // ---------- global audio notices ----------
  A.on('lost', ({ label }) => {
    UI.alerts.innerHTML = '';
    UI.alerts.append(UI.banner('bad', `Lost ${label}. Everything is paused and nothing was scored. Reconnect it, then choose it again.`,
      [h('button.btn.small.primary', { onclick: () => { UI.alerts.innerHTML = ''; UI.go('#/settings/input'); } }, 'Choose input')]));
  });
  A.on('resumed', () => UI.toast('Welcome back. Latency can change after the app was in the background: redo the calibration in Settings if timing feels off.', 5000));
  A.on('floor-start', () => UI.toast('Measuring noise for 2 seconds: keep the strings quiet.', 2200));
  A.on('floor', (m) => UI.toast(`Noise gate set to ${Math.round(m.gate)} dBFS.`, 2200));
  A.on('state', () => { if (A.ctx) UI.alerts.innerHTML = ''; });
  GQ.controls.on('action', (a) => { if (UI.current && UI.current.onAction) UI.current.onAction(a); });

  UI.start = function () {
    document.body.prepend(topbar());
    UI.applyDisplay();
    store.on('settings', (e) => { if (e.key === 'displaySize') UI.applyDisplay(); });
    window.addEventListener('hashchange', route);
    document.addEventListener('pointerdown', () => A.resume());
    route();
    requestAnimationFrame(loop);
    if (store.settings().voice) GQ.controls.setVoice(true);
    // quietly re-list devices if permission was granted before (labels visible) so the chip can offer the saved guitar
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices)
      navigator.mediaDevices.enumerateDevices().then((all) => { if (all.some((d) => d.kind === 'audioinput' && d.label)) { A.permitted = true; A.refreshDevices(); } }).catch(() => {});
  };
})(typeof window !== 'undefined' ? window : globalThis);
