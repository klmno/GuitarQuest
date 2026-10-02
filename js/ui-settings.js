/* GuitarQuest: Tuner and Settings screens. */
(function (G) {
  'use strict';
  const GQ = G.GQ, h = GQ.h, store = GQ.store, A = GQ.audio, T = GQ.theory, UI = GQ.ui, TU = GQ.tuner, CT = GQ.controls;

  // ---------- Tuner (REQ-DET-9) ----------
  UI.screens.tuner = function (main, args) {
    const fromLevel = args[0] === 'level';
    const backTo = args[0] === 'back' && args[1] ? args.slice(1).join('/') : null;
    const creditLevel = TU.creditLevel;
    const s = store.settings();
    TU.reset();
    if (!A.ctx) main.append(h('div', { style: { marginBottom: '1rem' } }, UI.connectCard(() => UI.go(location.hash))));
    const note = h('div.note', null, '–'), cents = h('div.cents', null, 'Play an open string');
    const needle = h('div.needle');
    const status = h('p.msg');
    const tuningSel = h('select', { onchange: (e) => { store.setSetting('tuning', e.target.value); TU.reset(); drawStrings(); } },
      ...Object.entries(T.TUNINGS).map(([k, v]) => h('option', { value: k, selected: s.tuning === k }, v.name)));
    const a4 = h('input', { type: 'number', min: 415, max: 466, step: 0.5, value: s.a4, onchange: (e) => store.setSetting('a4', GQ.clamp(+e.target.value || 440, 415, 466)) });
    const strings = h('div.tstrings');
    function drawStrings() {
      strings.innerHTML = '';
      for (const t of TU.targets()) {
        strings.append(h('button', { class: 'tstring' + (TU.ok[t.string] ? ' ok' : ''), 'data-s': t.string, title: 'Play a reference tone',
          onclick: () => { if (A.ctx) GQ.sound.tone(A.ctx.currentTime + 0.02, t.midi, 1.8); } },
          h('b', null, T.midiName(t.midi)), h('span.small', null, 'string ' + t.string + (TU.ok[t.string] ? ' ✓' : ''))));
      }
    }
    drawStrings();
    main.append(h('div.card.tuner', null,
      h('div.row.spread', null, h('h2', null, 'Tuner'), h('div.row', null, h('label.inline', null, 'Tuning ', tuningSel), h('label.inline', null, 'A4 = ', a4, ' Hz'))),
      note, cents, h('div.cmeter', null, h('div.zone', { style: { left: '45%', width: '10%' } }), h('div.mid'), needle), strings, status,
      h('p.small.muted', null, 'Every string must hold within ±5 cents for half a second. Tap a string to hear its reference pitch. Scored lessons need a passed check with this input and tuning.'),
      h('div.row', { style: { justifyContent: 'center' } },
        h('button.btn', { onclick: () => { TU.reset(); drawStrings(); } }, 'Start again'),
        fromLevel ? h('button.btn.primary', { onclick: () => UI.go('#/lesson/' + GQ.curriculum.levels[1].id) }, 'Continue to the next level →') : null,
        backTo ? h('button.btn.primary', { onclick: () => UI.go('#/lesson/' + backTo) }, '← Back to the lesson') : null)));
    const offS = TU.on('string', () => drawStrings());
    const offP = TU.on('passed', () => {
      status.textContent = 'All six strings are in tune. Scored lessons are unlocked.'; status.className = 'msg good';
    });
    if (TU.isTuned()) { status.textContent = 'Tuning already checked. Re-check any time.'; status.className = 'msg good'; creditLevel(); }
    if (!A.canScore() && A.ctx) status.textContent = 'Note: this input is not confirmed as your guitar yet (Settings > Guitar input).';
    UI.draw = function () {
      const r = TU.update(A.pitch);
      if (!r) { note.style.opacity = 0.4; return; }
      note.style.opacity = 1;
      const nm = T.midiName(Math.round(r.midi));
      note.innerHTML = nm.replace(/(-?\d)$/, '<sub>$1</sub>');
      const c = r.string ? r.stringCents : r.cents;
      cents.textContent = r.string ? `string ${r.string}: ${c > 0 ? '+' : ''}${c} cents${Math.abs(c) <= 5 ? ' ✓' : c > 0 ? ' (tune down)' : ' (tune up)'}` : `${c > 0 ? '+' : ''}${c} cents`;
      needle.style.left = (50 + GQ.clamp(c, -50, 50)) + '%';
      needle.style.background = Math.abs(c) <= 5 ? 'var(--good)' : Math.abs(c) <= 15 ? 'var(--warn)' : 'var(--bad)';
      for (const b of strings.children) b.classList.toggle('active', +b.dataset.s === r.string);
    };
    return { destroy() { offS(); offP(); } };
  };

  // ---------- Settings ----------
  UI.screens.settings = function (main, args) {
    const s = store.settings();
    const set = (k) => (e) => store.setSetting(k, e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'range' || e.target.type === 'number' ? +e.target.value : e.target.value);
    const sections = [];

    // --- input ---
    const inputCard = h('section.card#input');
    function drawInput() {
      inputCard.innerHTML = '';
      inputCard.append(h('h2', null, 'Guitar input'));
      if (!A.ctx) { inputCard.append(UI.connectCard(drawInput)); return; }
      const d = A.current(), c = A.classify(d);
      const set0 = A.settings || {};
      const chk = (name, v, want) => h('li', null, h('span', null, name), h('span', { style: { color: v === undefined ? 'var(--muted)' : v === want ? 'var(--good)' : 'var(--bad)' } }, v === undefined ? 'not reported' : String(v)));
      const mask = h('div.mask'), gateMark = h('div.gate');
      const gate = h('input', { type: 'range', min: -80, max: -20, value: A.gateDb, oninput: (e) => { A.setGate(+e.target.value); gv.textContent = A.gateDb + ' dBFS'; gateMark.style.left = ((A.gateDb + 60) / 60 * 100) + '%'; } });
      const gv = h('span.mono', null, A.gateDb + ' dBFS');
      gateMark.style.left = GQ.clamp((A.gateDb + 60) / 60, 0, 1) * 100 + '%';
      const devSel = h('select', null, ...A.devices.map((x) => h('option', { value: x.deviceId, selected: x.deviceId === A.deviceId }, x.label || 'Unnamed input')));
      const cal = store.device(A.key()).calib;
      const calMsg = h('p.msg', null, cal ? `Calibrated: ${cal.offsetMs} ms ±${cal.spreadMs} ms (${new Date(cal.date).toLocaleDateString()})` : 'Not calibrated for this input yet.');
      calMsg.className = 'msg ' + (cal ? 'good' : 'warn');
      const beats = h('div.row');
      inputCard.append(
        h('div.row', null, h('strong', null, A.deviceLabel), h('span.badge.' + c.cls, null, c.text)),
        h('div.row', null, devSel, h('button.btn', { onclick: async () => { try { await A.open(devSel.value); drawInput(); } catch (e) { UI.toast('Could not open: ' + e.message); } } }, 'Switch input'),
          h('button.btn.ghost', { onclick: () => A.refreshDevices().then(drawInput) }, 'Refresh list')),
        h('div.row', null,
          c.scored ? h('button.btn.small', { onclick: () => { A.markGuitar(false); drawInput(); } }, 'This is a microphone')
            : h('button.btn.small.good', { onclick: () => { A.markGuitar(true); drawInput(); } }, 'This is my guitar (direct input)'),
          h('span.small.muted', null, 'The app guesses from the device name. Confirm it here if the guess is wrong: scored lessons only run on a direct input.')),
        h('label.inline', null, 'Channel ', h('select', { onchange: (e) => A.setChannel(e.target.value) },
          ...[['mix', 'Mix both'], ['left', 'Left / 1'], ['right', 'Right / 2']].map(([v, t]) => h('option', { value: v, selected: (store.device(A.key()).channel || 'mix') === v }, t)))),
        h('h3', null, 'Level and noise gate'),
        h('div.levelmeter', null, mask, gateMark),
        h('div.row', { style: { marginTop: '.5rem' } }, h('label.inline', null, 'Gate ', gate, gv), h('button.btn.small', { onclick: () => A.measureFloor() }, 'Measure noise floor (2 s)')),
        h('h3', null, 'Capture settings (REQ-HW-3)'),
        h('ul.list', null, chk('echoCancellation', set0.echoCancellation, false), chk('noiseSuppression', set0.noiseSuppression, false), chk('autoGainControl', set0.autoGainControl, false),
          h('li', null, h('span', null, 'sample rate'), h('span', null, (set0.sampleRate || A.ctx.sampleRate) + ' Hz')),
          h('li', null, h('span', null, 'input latency (browser)'), h('span', null, Number.isFinite(A.inputLatencyMs) ? A.inputLatencyMs.toFixed(1) + ' ms' : 'not reported')),
          h('li', null, h('span', null, 'output latency'), h('span', null, (A.outputLatency() * 1000).toFixed(1) + ' ms'))),
        h('h3', null, 'Latency calibration (REQ-DET-4)'),
        h('p.small.muted', null, 'Four count-in clicks, then pick any note on each of 16 clicks. The median offset is subtracted before timing is scored. Redo it when you change input or headphones.'),
        h('div.row', null, h('button.btn.primary', { onclick: async (e) => {
          e.target.disabled = true; calMsg.textContent = 'Listen… then play on every click.'; calMsg.className = 'msg info';
          const r = await A.calibrate({ bpm: 90, clicks: 16, onTick: (i, n, count) => { beats.innerHTML = ''; for (let k = 0; k < n; k++) beats.append(h('span', { style: { width: '.8rem', height: '.8rem', borderRadius: '50%', display: 'inline-block', background: k === i ? 'var(--accent)' : k < count ? 'var(--line)' : 'var(--panel2)', border: '1px solid var(--line)' } })); } });
          e.target.disabled = false;
          if (!r.ok) { calMsg.textContent = `Only ${r.found} of ${r.n} clicks had a note near them. Check the level meter moves, then try again.`; calMsg.className = 'msg bad'; }
          else { calMsg.textContent = `Offset ${r.offsetMs} ms, spread ±${r.spreadMs} ms (${r.found}/${r.n}).` + (r.spreadMs > 25 ? ' Wide spread: try again with short, clean picks.' : ''); calMsg.className = 'msg ' + (r.spreadMs > 25 ? 'warn' : 'good'); }
        } }, 'Calibrate'), beats), calMsg,
        h('p.small.muted', null, 'Need the detailed latency breakdown? The Phase 0 input test is in ', h('a', { href: 'phase0/index.html' }, 'phase0/'), '.'));
      UI.draw = () => { mask.style.width = (100 - GQ.clamp((A.level.peakDb + 60) / 60, 0, 1) * 100) + '%'; };
    }
    drawInput();
    const offState = A.on('state', drawInput);
    sections.push(inputCard);

    // --- profile ---
    const pr = store.summary(store.profile().id);
    sections.push(h('section.card', null, h('h2', null, 'Profile'),
      h('div.row', { style: { marginTop: '.6rem' } }, UI.avatar(pr.name, pr.color, true),
        h('div', null, h('strong', null, pr.name), h('div.small.muted', null, `${pr.passed} levels passed · ${pr.stars} stars · ${pr.minutes} minutes`))),
      h('p.small.muted', null, 'These settings belong to this profile. Each player has their own progress, history and settings; all data stays in this browser.'),
      h('div.row', null, h('button.btn', { onclick: () => UI.go('#/profiles') }, 'Switch, add or export profiles'))));

    // --- songs folder (js/folder.js) ---
    const FO = GQ.folder, folderCard = h('section.card#folder');
    function drawFolder() {
      folderCard.innerHTML = '';
      const n = GQ.custom.list().length;
      const act = (fn, done) => async (e) => {
        e.target.disabled = true;
        try { const r = await fn(); if (done) done(r); } catch (err) { UI.toast('Could not use the folder: ' + err.message, 6000); }
        drawFolder();
      };
      const told = (r) => { if (r) UI.toast(FO.summary(r), 5000); };
      folderCard.append(h('h2', null, 'Songs folder'),
        h('p.small.muted', null, 'Keep every song from My songs in a folder on this computer, one .abc file each. Saving, renaming or deleting a song updates its file, and .abc files you put in the folder or edit there show up in My songs. If this browser’s data is ever lost, choose the same folder again and your songs come back.'));
      if (FO.state === 'unsupported') {
        folderCard.append(h('p.msg.warn', null, 'This browser cannot save to a folder: Chrome and Edge on a computer can. Here, use "Download all my songs" and keep the file somewhere safe.'));
      } else if (FO.state === 'none') {
        folderCard.append(h('div.row', null, h('button.btn.primary', { onclick: act(FO.choose, told) }, 'Choose a folder…')));
      } else {
        const badge = { ready: ['good', 'saving here'], ask: ['warn', 'waiting for your OK'], error: ['bad', 'not reachable'] }[FO.state] || ['', FO.state];
        folderCard.append(h('div.row', null, h('span', null, '📁 ', h('strong', null, FO.name())), h('span.badge.' + badge[0], null, badge[1])));
        if (FO.state === 'ask') folderCard.append(h('p.msg.warn', null, 'The browser needs your OK again before the app can write to this folder. Until then, songs are saved in the browser only.'));
        if (FO.state === 'error') folderCard.append(h('p.msg.bad', null, FO.error));
        const L = FO.last;
        if (FO.state === 'ready' && L) {
          folderCard.append(h('p.small.muted', null, `Last checked ${new Date(L.date).toLocaleString()}: ${L.songs} song${L.songs === 1 ? '' : 's'}. ${FO.summary(L).replace(/^Songs folder: /, '').replace(/^Songs folder is up to date\./, 'Nothing needed changing.')}`));
          if (L.skipped.length) folderCard.append(h('ul.small.muted', null, ...L.skipped.slice(0, 10).map((t) => h('li', null, t))));
        }
        folderCard.append(h('div.row', null,
          FO.state === 'ask' ? h('button.btn.primary', { onclick: act(FO.allow, told) }, 'Allow access') : null,
          FO.state === 'ready' ? h('button.btn', { onclick: act(FO.sync, told) }, 'Sync now') : null,
          h('button.btn', { onclick: act(FO.choose, told) }, FO.state === 'error' ? 'Choose the folder again…' : 'Choose another folder…'),
          h('button.btn.ghost', { onclick: act(FO.forget, () => UI.toast('Stopped saving to the folder. Its files are still there.', 5000)) }, 'Stop using this folder')));
      }
      folderCard.append(h('div.row', { style: { marginTop: '.6rem' } },
        h('button.btn.small', { disabled: !n, onclick: () => UI.download('my-songs.abc', GQ.custom.exportAll()) }, 'Download all my songs (.abc)'),
        h('span.small.muted', null, n ? `${n} song${n === 1 ? '' : 's'} in one file; Songs > Import .abc reads it back.` : 'No songs of your own yet.')));
    }
    drawFolder();
    const offFolder = [FO.on('state', drawFolder), FO.on('synced', drawFolder)];
    sections.push(folderCard);

    // --- instrument ---
    sections.push(h('section.card', null, h('h2', null, 'Instrument'),
      h('div.grid2', { style: { marginTop: '.6rem' } },
        h('label.field', null, 'Tuning', h('select', { onchange: set('tuning') }, ...Object.entries(T.TUNINGS).map(([k, v]) => h('option', { value: k, selected: s.tuning === k }, v.name)))),
        h('label.field', null, 'Capo', h('select', { onchange: set('capo') }, ...Array.from({ length: 10 }, (_, i) => h('option', { value: i, selected: s.capo === i }, i ? 'Fret ' + i : 'No capo')))),
        h('label.field', null, 'Reference pitch A4 (Hz)', h('input', { type: 'number', min: 415, max: 466, step: 0.5, value: s.a4, onchange: set('a4') })),
        h('label.inline', null, h('input', { type: 'checkbox', checked: s.leftHanded, onchange: set('leftHanded') }), 'Left-handed (mirror the neck and chord boxes)'),
        h('label.inline', null, h('input', { type: 'checkbox', checked: !!s.flipStrings, onchange: set('flipStrings') }), 'Flip the fretboard and tab (low E string on top, as you see the neck when you look down)')),
      h('p.small.muted', null, 'Lessons keep the same shapes; the pitches the app expects follow your tuning and capo.')));

    // --- display & practice ---
    sections.push(h('section.card', null, h('h2', null, 'Display and practice'),
      h('label.field', { style: { marginTop: '.6rem' } }, 'Display size (read it from where you play)',
        h('input', { type: 'range', min: 0.8, max: 1.6, step: 0.05, value: s.displaySize, oninput: set('displaySize') })),
      h('div.row', null, ...['fretboard', 'highway', 'tab', 'staff'].map((k) => h('label.inline', null,
        h('input', { type: 'checkbox', checked: s.views[k], onchange: (e) => store.setSetting('views.' + k, e.target.checked) }), { fretboard: 'Fretboard', highway: 'Falling notes', tab: 'Tab', staff: 'Notation' }[k]))),
      h('div.row', null,
        h('label.inline', null, h('input', { type: 'checkbox', checked: s.countIn, onchange: set('countIn') }), 'Count-in bar'),
        h('label.inline', null, h('input', { type: 'checkbox', checked: s.practiceLock, onchange: set('practiceLock') }), 'Practice lock by default'),
        h('label.inline', null, h('input', { type: 'checkbox', checked: s.autoAdvance, onchange: set('autoAdvance') }), 'Auto-advance after a pass'))));

    // --- sound ---
    const vol = (k) => h('input', { type: 'range', min: 0, max: 1, step: 0.01, value: s[k], oninput: set(k) });
    sections.push(h('section.card', null, h('h2', null, 'Sound'),
      h('div.grid2', { style: { marginTop: '.6rem' } },
        h('div', null, h('label.inline', null, h('input', { type: 'checkbox', checked: s.metronome, onchange: set('metronome') }), 'Metronome'), vol('metronomeVol')),
        h('div', null, h('label.inline', null, h('input', { type: 'checkbox', checked: s.backing, onchange: set('backing') }), 'Backing tracks'), vol('backingVol')),
        h('div', null, h('label.inline', null, h('input', { type: 'checkbox', checked: s.monitor, onchange: set('monitor') }), 'Hear the guitar through this device'), vol('monitorVol')),
        h('label.field', null, 'Listen button sound', h('select', { onchange: (e) => { store.setSetting('previewTone', e.target.value); GQ.preview.stop(); } },
          ...[['clean', 'Electric guitar, clean'], ['crunch', 'Electric guitar, crunch'], ['acoustic', 'Plain plucked string']].map(([v, t]) => h('option', { value: v, selected: (s.previewTone || 'clean') === v }, t)))),
        h('label.field', null, 'Monitor tone', h('select', { onchange: set('ampTone') }, ...[['clean', 'Clean (lowest latency)'], ['warm', 'Warm'], ['crunch', 'Crunch']].map(([v, t]) => h('option', { value: v, selected: s.ampTone === v }, t))))),
      h('p.small.muted', null, 'Use headphones for monitoring, or leave it off and listen to the guitar’s own speaker. The direct input never hears the metronome or backing, so both can play out loud.')));

    // --- hands-free ---
    const keysTable = h('table.keys');
    function drawKeys() {
      keysTable.innerHTML = '';
      const ks = store.settings().keys;
      for (const [a, label] of Object.entries(CT.ACTIONS)) {
        keysTable.append(h('tr', null, h('td', null, label), h('td', null, ...(ks[a] || []).map((k) => h('kbd', null, k))),
          h('td', null, h('button.btn.small', { onclick: (e) => { e.target.textContent = 'Press a key or pedal…'; CT.learn(a); } }, 'Learn'))));
      }
    }
    drawKeys();
    const offLearn = CT.on('learned', drawKeys);
    sections.push(h('section.card', null, h('h2', null, 'Hands-free'),
      h('p.small.muted', null, 'Most USB footswitches send key presses. Press "Learn", then press the pedal.'), keysTable,
      h('div.row', { style: { marginTop: '.6rem' } }, h('label.inline', null, h('input', { type: 'checkbox', checked: s.voice, disabled: !CT.voiceSupported, onchange: (e) => { store.setSetting('voice', e.target.checked); CT.setVoice(e.target.checked); } }),
        'Voice commands: "start", "stop", "again", "next", "slower", "faster", "lock"' + (CT.voiceSupported ? '' : ' (not supported in this browser)')))));

    const upd = h('span.small.muted');
    sections.unshift(h('section.card#about', null,
      h('div.row.spread', null, h('h2', null, 'About'), h('span.badge.info', { title: 'Released ' + G.GQ_RELEASED }, 'Version ' + G.GQ_VERSION)),
      h('p.small.muted', null, 'Released ' + G.GQ_RELEASED + '. The version number changes with every update, so you can tell when a new one has arrived.'),
      h('ul.list', null, ...G.GQ_CHANGES.slice(0, 5).map(([v, d, t]) => h('li', null, h('span', null, t), h('span', null, 'v' + v)))),
      'serviceWorker' in navigator && /^https?:$/.test(location.protocol)
        ? h('div.row', { style: { marginTop: '.6rem' } }, h('button.btn.small', { onclick: async () => {
            upd.textContent = 'Checking…';
            try {
              const reg = await navigator.serviceWorker.getRegistration();
              if (reg) await reg.update();
              upd.textContent = reg && (reg.installing || reg.waiting) ? 'An update is being installed. It will be ready in a moment.' : 'You have the latest version the server is offering.';
            } catch { upd.textContent = 'Could not check right now (offline?).'; }
          } }, 'Check for updates'), upd)
        : h('p.small.muted', null, 'Opened from a file: reload the page to pick up changes in the folder.')));
    sections.push(h('section.card', null, h('h2', null, 'Privacy'), h('p', null, 'Audio is analysed on this device and never uploaded. There are no accounts, no analytics and no network requests after the app has loaded.')));

    main.append(h('div.grid2', null, ...sections));
    if (args[0] === 'input') inputCard.scrollIntoView();
    if (args[0] === 'folder') folderCard.scrollIntoView();
    return { destroy() { offState(); offLearn(); offFolder.forEach((f) => f()); } };
  };
})(typeof window !== 'undefined' ? window : globalThis);
