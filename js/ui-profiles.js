/* GuitarQuest: profiles (REQ-SC-4). Each player has their own progress, settings, streak and history. */
(function (G) {
  'use strict';
  const GQ = G.GQ, h = GQ.h, store = GQ.store, UI = GQ.ui, CUR = GQ.curriculum;

  UI.avatar = (name, color, big) => h('span.avatar' + (big ? '.big' : ''), { style: { background: color || 'var(--accent)' }, 'aria-hidden': 'true' }, (name || '?').trim().charAt(0).toUpperCase() || '?');
  const ago = (iso) => {
    if (!iso) return 'not played yet';
    const d = (Date.now() - new Date(iso).getTime()) / 86400e3;
    return d < 1 ? 'played today' : d < 2 ? 'played yesterday' : 'played ' + Math.floor(d) + ' days ago';
  };
  const cleanName = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 40);

  // #/profiles        manage
  // #/profiles/pick   "Who's playing?" at start-up
  UI.screens.profiles = function (main, args) {
    const picking = args[0] === 'pick';
    const grid = h('div.profiles');
    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const p = store.importData(await f.text()); UI.toast(`Imported ${p.name}.`); draw(); } catch (err) { UI.toast(err.message); }
      e.target.value = '';
    } });
    main.append(
      h('div.hero', null,
        h('div', null, h('h2', null, picking ? "Who's playing?" : 'Profiles'),
          h('p.muted.small', null, 'Each profile keeps its own levels, stars, streak, practice time, history and settings. Everything stays in this browser.')),
        picking ? null : h('div.row', null, h('button.btn', { onclick: () => fileIn.click() }, 'Import a profile'), fileIn)),
      grid);

    function draw() {
      grid.innerHTML = '';
      const active = store.profile().id;
      for (const { id } of store.profiles()) grid.append(card(store.summary(id), id === active));
      grid.append(addCard());
    }

    function card(s, isActive) {
      const body = h('div.stack');
      const c = h('div.card.profile' + (isActive ? '.active' : ''), null,
        h('div.row', null, UI.avatar(s.name, s.color, true),
          h('div', { style: { minWidth: 0, flex: 1 } }, h('h3.pname', null, s.name), h('div.small.muted', null, ago(s.last))),
          isActive && !picking ? h('span.badge.good', null, 'Playing now') : null),
        h('div.pstats', null,
          stat(s.passed + '/' + CUR.levels.length, 'levels'), stat(s.stars, 'stars'), stat(s.streak, 'day streak'), stat(s.minutes, 'minutes')),
        h('div.progressbar', { title: `${s.passed} of ${CUR.levels.length} levels passed` }, h('div', { style: { width: (100 * s.passed / CUR.levels.length) + '%' } })),
        body);
      const actions = h('div.row');
      body.append(actions);
      if (picking || !isActive) actions.append(h('button.btn.primary', { onclick: () => play(s.id) }, picking ? 'Play as ' + s.name : 'Switch to ' + s.name));
      if (!picking) {
        actions.append(
          h('button.btn.small', { onclick: () => rename(s, body, actions) }, 'Rename'),
          h('button.btn.small', { onclick: () => exportProfile(s) }, 'Export'));
        if (store.profiles().length > 1) actions.append(h('button.btn.small.ghost', { onclick: (e) => {
          if (e.target.dataset.sure) { store.deleteProfile(s.id); UI.toast(`Deleted ${s.name}.`); refresh(); return; }
          e.target.dataset.sure = '1'; e.target.textContent = 'Delete ' + s.name + ' and all progress?'; e.target.classList.add('danger');
          setTimeout(() => { if (e.target.isConnected) { delete e.target.dataset.sure; e.target.textContent = 'Delete'; e.target.classList.remove('danger'); } }, 4000);
        } }, 'Delete'));
      }
      return c;
    }
    const stat = (v, l) => h('div.stat', null, h('b', null, v), h('span', null, l));

    function rename(s, body, actions) {
      const input = h('input', { type: 'text', value: s.name, maxlength: 40, 'aria-label': 'New name' });
      const save = () => { const n = cleanName(input.value); if (n) { store.renameProfile(n, s.id); refresh(); } };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') draw(); });
      actions.replaceWith(h('div.row', null, input, h('button.btn.small.primary', { onclick: save }, 'Save'), h('button.btn.small.ghost', { onclick: draw }, 'Cancel')));
      input.focus(); input.select();
    }

    function addCard() {
      let color = store.COLORS[store.profiles().length % store.COLORS.length];
      const input = h('input', { type: 'text', placeholder: 'Name', maxlength: 40, 'aria-label': 'Name for the new profile' });
      const swatches = h('div.row', null, ...store.COLORS.map((c) => h('button.swatch', { style: { background: c }, 'aria-label': 'Colour', class: c === color ? 'on' : '',
        onclick: (e) => { color = c; for (const b of swatches.children) b.classList.toggle('on', b === e.target); } })));
      const add = () => {
        const n = cleanName(input.value);
        if (!n) { input.focus(); return; }
        if (store.profiles().some((p) => p.name.toLowerCase() === n.toLowerCase())) { UI.toast('There is already a profile called ' + n + '.'); return; }
        store.createProfile(n, color);
        UI.toast(`Profile ${n} created. You're now playing as ${n}.`);
        doneSwitch();
      };
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
      return h('div.card.profile.add', null, h('h3.pname', null, 'New player'), input, swatches, h('button.btn', { onclick: add }, '+ Add profile'));
    }

    function exportProfile(s) {
      const blob = new Blob([store.exportData(s.id)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'guitarquest-' + s.name.replace(/\W+/g, '-') + '.json' });
      document.body.append(a); a.click(); a.remove();
    }
    function play(id) { store.load(id); doneSwitch(); }
    function doneSwitch() { UI.markPicked(); UI.refreshProfileChip(); UI.applyDisplay(); UI.go('#/learn'); }
    function refresh() { UI.refreshProfileChip(); draw(); }

    draw();
  };

  // start-up picker: once per browser session when there is more than one player
  UI.markPicked = () => { try { sessionStorage.setItem('gq.picked', '1'); } catch { /* ignore */ } };
  UI.needsPick = function () {
    if (store.profiles().length < 2) return false;
    try { return !sessionStorage.getItem('gq.picked'); } catch { return false; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
