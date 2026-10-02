/* GuitarQuest: the Creator. Write your own songs in ABC notation, with helpers so you never have to
 * remember the syntax: song details as fields, note-length buttons, a fretboard you click (or your
 * guitar) to add notes, live tab and notation, Listen, and checks as you type. Songs are saved to
 * this browser and appear under Songs > My songs. */
(function (G) {
  'use strict';
  const GQ = G.GQ, h = GQ.h, store = GQ.store, A = GQ.audio, T = GQ.theory, R = GQ.render, UI = GQ.ui, ABC = GQ.abc;

  const MAX_SHOWN = 10;   // problems listed at once in the Creator
  const TEMPLATE = 'X:1\nT:My new song\nC:\nM:4/4\nL:1/8\nQ:1/4=90\nI:position 0\nK:C\n';
  UI.openInCreator = function (abc) { GQ.storage.set('creatorDraft', { id: null, abc, at: Date.now() }); UI.go('#/creator'); };

  // ---------- ABC writing helpers ----------
  const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const NAT = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const SHARP_SPELL = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const FLAT_SPELL = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
  function keyInfo(text) {
    const m = /(^|\n)K:([^\n%]*)/.exec(text);
    const kk = GQ.abc && m ? parseKeyLite(m[2]) : { acc: {}, flats: false };
    return kk;
  }
  function parseKeyLite(v) {
    // reuse the reader: parse a tiny tune in that key and look at which letters it alters
    const p = ABC.parse('X:1\nT:k\nL:1/4\nI:octave 0\nK:' + v + '\nC D E F G A B|');
    const acc = {};
    p.events.forEach((e, i) => { const n = e.notes[0]; if (!n) return; const midi = T.midiAt(n.string, n.fret); acc[LETTERS[i]] = midi - (60 + NAT[LETTERS[i]]); });
    return { acc, flats: Object.values(acc).some((a) => a < 0) };
  }
  // written midi -> ABC note name in the current key
  function abcPitch(midi, key) {
    const pc = ((midi % 12) + 12) % 12;
    // a letter that the key signature already turns into this pitch needs no accidental
    for (const L of LETTERS) if ((((NAT[L] + (key.acc[L] || 0)) % 12) + 12) % 12 === pc) return withOctave(L, '', midi - (key.acc[L] || 0));
    const [L, a] = (key.flats ? FLAT_SPELL : SHARP_SPELL)[pc];
    const prefix = a === (key.acc[L] || 0) ? '' : a === 1 ? '^' : a === -1 ? '_' : '=';
    return withOctave(L, prefix, midi - a);
  }
  function withOctave(L, prefix, naturalMidi) {
    const oct = Math.floor(naturalMidi / 12) - 1; // C4 = 60
    let s = prefix + (oct >= 5 ? L.toLowerCase() : L);
    if (oct > 5) s += "'".repeat(oct - 5);
    if (oct < 4) s += ','.repeat(4 - oct);
    return s;
  }
  // duration in quarter beats -> ABC length suffix for unit L
  function lenSuffix(quarters, unit) {
    const mult = quarters / (4 * unit);
    for (const den of [1, 2, 4, 8, 16]) {
      const num = mult * den;
      if (Math.abs(num - Math.round(num)) < 1e-6) {
        const n = Math.round(num);
        if (den === 1) return n === 1 ? '' : String(n);
        if (n === 1) return den === 2 ? '/' : den === 4 ? '//' : '/' + den;
        return n + '/' + den;
      }
    }
    return '';
  }
  // set or insert a header line (M:, L:, Q:, K:, T:, C:, I:position ...)
  function setHeader(text, field, value) {
    const lines = text.split('\n');
    const kIdx = lines.findIndex((l) => /^K:/.test(l));
    const headEnd = kIdx < 0 ? lines.length : kIdx;
    const re = field.startsWith('I:') ? new RegExp('^' + field.replace(':', ':\\s*') + '\\b') : new RegExp('^' + field[0] + ':');
    const idx = lines.findIndex((l, i) => i <= headEnd && re.test(l));
    const line = field.startsWith('I:') ? field + ' ' + value : field + value;
    if (value === null || value === '') { if (idx >= 0 && field !== 'K:' && field !== 'T:') lines.splice(idx, 1); else if (idx >= 0) lines[idx] = line; }
    else if (idx >= 0) lines[idx] = line;
    else if (field === 'K:') lines.splice(headEnd, 0, line);
    else lines.splice(Math.max(1, headEnd), 0, line);
    return lines.join('\n');
  }

  // set, add or remove a header line of a tab song ("Title: ...", "By:", "Tempo:", "Time:")
  function setTabHeader(text, key, value) {
    const lines = text.split('\n');
    const re = new RegExp('^\\s*(' + ({ Title: 'title', By: 'by|artist|composer', Tempo: 'tempo|bpm', Time: 'time|meter' }[key]) + ')\\s*:', 'i');
    const firstTab = lines.findIndex((l) => GQ.tab.looks(l + '\n' + l + '\n' + l + '\n' + l));
    const idx = lines.findIndex((l, i) => (firstTab < 0 || i < firstTab) && re.test(l));
    if (value === null || value === '') { if (idx >= 0 && key !== 'Title') lines.splice(idx, 1); else if (idx >= 0) lines[idx] = key + ': '; }
    else if (idx >= 0) lines[idx] = key + ': ' + value;
    else lines.splice(key === 'Title' ? 0 : Math.max(0, lines.findIndex((l) => /^\s*title\s*:/i.test(l)) + 1), 0, key + ': ' + value);
    return lines.join('\n');
  }
  const looksLikeTab = (t) => GQ.tab.looks(t) && !/(^|\n)K:/.test(t);

  // ---------- the screen ----------
  UI.screens.creator = function (main, args) {
    const editId = args[0] && args[0] !== 'new' ? args[0] : null;
    let song = editId ? GQ.custom.get(editId) : null;
    if (editId && !song) { main.append(h('div.card', null, 'That song is not in this browser any more. ', h('a', { href: '#/creator' }, 'Start a new one'))); return; }
    const draft = GQ.storage.get('creatorDraft', null);
    // each song is written either in ABC or as guitar tab
    let fmt = song ? GQ.custom.formatOf(song) : draft && !draft.id && draft.format === 'tab' ? 'tab' : 'abc';
    let text = song ? GQ.custom.textOf(song) : draft && !draft.id ? draft.abc : TEMPLATE;
    let savedText = song ? GQ.custom.textOf(song) : null;
    const templateOf = (f) => (f === 'tab' ? GQ.tab.TEMPLATE : TEMPLATE);
    const parse = (t) => GQ.custom.parse(t, fmt);
    let parsed = parse(text);
    let dur = 1, dotted = false, triplet = false, autoBars = true, record = false, pos = 0, lastTyped = 0;

    // ----- header fields -----
    const fTitle = h('input', { type: 'text', placeholder: 'Title', maxlength: 80 });
    const fBy = h('input', { type: 'text', placeholder: 'Composer or source (optional)', maxlength: 80 });
    const fMeter = h('select', null, ...['4/4', '3/4', '2/4', '6/8', '9/8', '12/8', '2/2', '5/4'].map((m) => h('option', { value: m }, m)));
    const fTempo = h('input', { type: 'number', min: 30, max: 260, step: 1 });
    const KEYS = ['C', 'G', 'D', 'A', 'E', 'B', 'F', 'Bb', 'Eb', 'Am', 'Em', 'Bm', 'F#m', 'Dm', 'Gm', 'Cm', 'D Dorian', 'A Dorian', 'E Dorian', 'G Mixolydian', 'D Mixolydian', 'A Mixolydian'];
    const fKey = h('select', null, ...KEYS.map((k) => h('option', { value: k }, k)));
    const fUnit = h('select', null, ...[['1/4', 'Quarter (1/4)'], ['1/8', 'Eighth (1/8)'], ['1/16', 'Sixteenth (1/16)']].map(([v, t]) => h('option', { value: v }, t)));
    const fPos = h('select', null, ...[0, 1, 2, 3, 5, 7, 9, 12].map((p) => h('option', { value: p }, p === 0 ? 'Open position' : 'Position ' + p)));
    const fOct = h('select', null, h('option', { value: '-1' }, 'Guitar (sounds an octave lower)'), h('option', { value: '0' }, 'As written'), h('option', { value: '-2' }, 'Two octaves lower'));
    const fPlay = h('select', null, h('option', { value: 'melody' }, 'Melody (notes)'), h('option', { value: 'chords' }, 'Strum the chord symbols'));
    const field = (label, el) => h('label.field', null, label, el);
    const TAB_KEYS = { 'T:': 'Title', 'C:': 'By', 'M:': 'Time', 'Q:': 'Tempo' };
    const bindHeader = (el, fieldName, map) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => {
      if (fmt === 'tab') { if (TAB_KEYS[fieldName]) setText(setTabHeader(ta.value, TAB_KEYS[fieldName], el.value), true); return; }
      const v = map ? map(el.value) : el.value;
      setText(setHeader(ta.value, fieldName, v), true);
    });
    bindHeader(fTitle, 'T:'); bindHeader(fBy, 'C:'); bindHeader(fMeter, 'M:'); bindHeader(fUnit, 'L:'); bindHeader(fKey, 'K:');
    bindHeader(fTempo, 'Q:', (v) => (v ? '1/4=' + v : ''));
    bindHeader(fPos, 'I:position'); bindHeader(fOct, 'I:octave', (v) => (v === '-1' ? '' : v)); bindHeader(fPlay, 'I:play', (v) => (v === 'melody' ? '' : v));

    // ----- editor -----
    const ta = h('textarea.abc', { spellcheck: false, autocapitalize: 'off', autocomplete: 'off', rows: 14, 'aria-label': 'ABC notation' });
    ta.value = text;
    ta.addEventListener('input', () => { lastTyped = performance.now(); setText(ta.value, false); });
    const problemsEl = h('ul.problems');
    const statsEl = h('div.small.muted');
    const saveState = h('span.small.muted');

    function setText(t, replaceEditor) {
      text = t;
      if (replaceEditor) { const at = ta.selectionStart; ta.value = t; ta.selectionStart = ta.selectionEnd = Math.min(at, t.length); }
      parsed = parse(text);
      GQ.storage.set('creatorDraft', { id: song ? song.id : null, abc: text, format: fmt, at: Date.now() });
      refresh();
    }
    function refresh() {
      const m = parsed.meta;
      const setIfIdle = (el, v) => { if (document.activeElement !== el) el.value = v; };
      setIfIdle(fTitle, m.title); setIfIdle(fBy, m.composer);
      setIfIdle(fMeter, m.meterText); setIfIdle(fTempo, (fmt === 'tab' ? /(^|\n)\s*(tempo|bpm)\s*:/i : /(^|\n)Q:/).test(text) ? m.bpm : '');
      if (fmt === 'abc') {
        if (![...fKey.options].some((o) => o.value === m.keyName)) fKey.append(h('option', { value: m.keyName }, m.keyName));
        setIfIdle(fKey, m.keyName);
        const u = m.unit === 0.25 ? '1/4' : m.unit === 1 / 16 ? '1/16' : '1/8'; setIfIdle(fUnit, u);
        setIfIdle(fPos, String(m.position)); setIfIdle(fOct, String(m.octave)); setIfIdle(fPlay, m.play);
      }
      problemsEl.innerHTML = '';
      const noNotes = parsed.errors.length === 1 && /no notes/.test(parsed.errors[0]);
      // errors first, then warnings; only the first MAX_SHOWN, with a count of the rest
      const all = parsed.problems.map((x) => ({ ...x, cls: 'err' })).concat(parsed.warnings.map((x) => ({ ...x, cls: 'warn' })));
      for (const x of all.slice(0, MAX_SHOWN)) problemsEl.append(h('li.' + x.cls, { onclick: () => gotoLine(x.line) }, (x.line ? 'Line ' + x.line + ': ' : '') + x.msg));
      if (all.length > MAX_SHOWN) {
        const ne = parsed.problems.length, nw = parsed.warnings.length;
        const what = ne && nw ? `problems (${ne} error${ne > 1 ? 's' : ''}, ${nw} warning${nw > 1 ? 's' : ''})` : ne ? 'errors' : 'warnings';
        problemsEl.append(h('li.more', null, `${MAX_SHOWN} out of ${all.length} ${what} shown. Fix these first: many of the others often go away with them.`));
      }
      if (!parsed.problems.length && !parsed.warnings.length) problemsEl.append(h('li.ok', null, 'No problems found.'));
      if (noNotes) { problemsEl.innerHTML = ''; problemsEl.append(h('li.info', null, fmt === 'tab' ? 'Add notes: write fret numbers on the string lines, or paste a tab.' : 'Add notes: click the fretboard, play them on your guitar, or type them after the K: line.')); }
      const notes = parsed.events.filter((e) => e.kind !== 'rest');
      const secs = parsed.totalBeats * 60 / (m.bpm || 100);
      const frets = notes.flatMap((e) => e.notes.map((n) => n.fret));
      statsEl.textContent = notes.length ? `${parsed.bars} bars · ${notes.length} notes · ${Math.floor(secs / 60)}:${String(Math.round(secs % 60)).padStart(2, '0')} at ${m.bpm} BPM · frets ${Math.min(...frets)}–${Math.max(...frets)}` + (m.chords.length ? ' · chords ' + m.chords.join(' ') : '') : '';
      const dirty = text !== savedText;
      saveBtn.disabled = parsed.problems.length > 0;
      practiceBtn.disabled = parsed.problems.length > 0;
      saveState.textContent = parsed.problems.length ? 'Fix the problems to save.' : dirty ? (song ? 'Changes not saved yet.' : 'Not saved yet.') : 'Saved.';
      scrub.max = Math.max(1, Math.ceil(parsed.totalBeats));
    }
    function gotoLine(n) {
      if (!n) return;
      const lines = ta.value.split('\n');
      const start = lines.slice(0, n - 1).reduce((a, l) => a + l.length + 1, 0);
      ta.focus(); ta.setSelectionRange(start, start + (lines[n - 1] || '').length);
    }

    // ----- inserting -----
    function insert(str, opts) {
      opts = opts || {};
      ta.focus();
      let at = ta.selectionStart;
      // notes go after the K: line
      const kEnd = (() => { const m = /(^|\n)K:[^\n]*\n?/.exec(ta.value); return m ? m.index + m[0].length : ta.value.length; })();
      if (at < kEnd) { at = ta.value.length; ta.setSelectionRange(at, at); if (!ta.value.endsWith('\n')) str = '\n' + str; }
      const before = ta.value.slice(0, at);
      if (before && !/[\s|]$/.test(before) && !opts.glue) str = ' ' + str;
      // execCommand keeps the browser's undo history
      if (!(document.execCommand && document.execCommand('insertText', false, str))) ta.setRangeText(str, at, ta.selectionEnd, 'end');
      setText(ta.value, false);
      if (autoBars && opts.note && ta.selectionStart === ta.value.length) autoBar();
    }
    function autoBar() {
      const p = parsed, bpb = p.beatsPerBar;
      const last = p.barMarks.length ? p.barMarks[p.barMarks.length - 1] : 0;
      if (p.totalBeats - last >= bpb - 1e-6 && !/\|\s*$/.test(ta.value)) {
        const lineBars = (ta.value.split('\n').pop().match(/\|/g) || []).length;
        insert(lineBars >= 3 ? '|\n' : '| ', { glue: false });
      }
    }
    const curQuarters = () => dur * (dotted ? 1.5 : 1);
    function insertNote(soundingMidi) {
      const m = parsed.meta;
      const written = soundingMidi - 12 * m.octave;
      const key = keyInfo(ta.value);
      let tok = abcPitch(written, key) + lenSuffix(curQuarters(), m.unit);
      if (triplet) { tok = '(3' + tok; }
      insert(tok, { note: true });
      if (!record) GQ.preview.note(soundingMidi);   // hear the note (not while recording from the guitar)
    }

    // ----- toolbar -----
    const durs = [[4, 'Whole'], [2, 'Half'], [1, 'Quarter'], [0.5, 'Eighth'], [0.25, 'Sixteenth']];
    const durSeg = h('div.seg', { role: 'group', 'aria-label': 'Note length' }, ...durs.map(([d, t]) => h('button', { class: d === dur ? 'on' : '', title: t + ' note', 'data-d': d, onclick: () => { dur = d; for (const b of durSeg.children) b.classList.toggle('on', +b.dataset.d === d); } }, t)));
    const dotBtn = h('button.btn.small', { title: 'Dotted: one and a half times as long', onclick: () => { dotted = !dotted; dotBtn.classList.toggle('on', dotted); } }, 'Dotted');
    const tripBtn = h('button.btn.small', { title: 'Put a triplet mark before the next note: three notes in the time of two', onclick: () => { triplet = !triplet; tripBtn.classList.toggle('on', triplet); } }, 'Triplet');
    const chordSel = h('select', { title: 'Chord symbol' }, ...['C', 'G', 'D', 'A', 'E', 'F', 'Am', 'Em', 'Dm', 'Bm', 'G7', 'D7', 'E7', 'A7', 'B7', 'C7', 'Cadd9', 'Dsus4', 'Asus2', 'Fmaj7'].map((c) => h('option', null, c)));
    const autoChk = h('input', { type: 'checkbox', checked: true, onchange: (e) => (autoBars = e.target.checked) });
    const recBtn = h('button.btn.small', { title: 'Play notes on the guitar and they are written down', onclick: () => {
      if (!A.ctx) { UI.toast('Connect the guitar first (Settings > Guitar input), then press Record again.'); return; }
      record = !record; recBtn.classList.toggle('on', record); recBtn.textContent = record ? '● Recording: play notes' : '● Record from guitar';
    } }, '● Record from guitar');
    const offNote = A.on('note', (m) => {
      if (!record || fmt !== 'abc' || m.legato || (m.conf || 0) < 0.85) return;
      insertNote(Math.round(T.freqToMidi(m.freq, store.settings().a4)));
    });
    const tools = h('div.toolbar.creator-tools', null,
      durSeg, dotBtn, tripBtn, h('span.sep'),
      h('button.btn.small', { onclick: () => insert('z' + lenSuffix(curQuarters(), parsed.meta.unit), { note: true }), title: 'Rest (silence)' }, 'Rest'),
      h('button.btn.small', { onclick: () => insert('|'), title: 'Bar line' }, '| Bar'),
      h('button.btn.small', { onclick: () => insert('|:'), title: 'Start of a repeated section' }, '|: Repeat'),
      h('button.btn.small', { onclick: () => insert(':|'), title: 'End of a repeated section' }, 'Repeat :|'),
      h('button.btn.small', { onclick: () => insert('-', { glue: true }), title: 'Tie: hold the previous note into the next one of the same pitch' }, 'Tie'),
      h('span.sep'), chordSel, h('button.btn.small', { onclick: () => insert('"' + chordSel.value + '"'), title: 'Chord symbol: sets the backing chord (or the strum, in "Strum the chord symbols" mode)' }, 'Add chord'),
      h('span.sep'), recBtn, h('label.inline.small', null, autoChk, 'Add bar lines automatically'));

    // ----- clickable fretboard -----
    const fb = h('canvas.creator-fb', { title: 'Click a string and fret to add that note' });
    let hover = null;
    const fbOpts = () => ({ lo: 0, hi: 15, lefty: store.settings().leftHanded, flip: store.settings().flipStrings, size: 1, names: T.stringNames() });
    fb.addEventListener('mousemove', (e) => { const r = fb.getBoundingClientRect(); hover = R.fretboardHit(fb, fbOpts(), e.clientX - r.left, e.clientY - r.top); });
    fb.addEventListener('mouseleave', () => (hover = null));
    fb.addEventListener('click', (e) => {
      const r = fb.getBoundingClientRect();
      const hit = R.fretboardHit(fb, fbOpts(), e.clientX - r.left, e.clientY - r.top);
      if (hit) insertNote(T.midiAt(hit.string, hit.fret));
    });

    // ----- preview -----
    const tab = h('canvas'), staff = h('canvas');
    const scrub = h('input', { type: 'range', min: 0, max: 1, step: 0.25, value: 0, oninput: (e) => (pos = +e.target.value), 'aria-label': 'Scroll through the song' });
    const listenBtn = h('button.btn', { onclick: () => {
      if (GQ.preview.playing(draftLevel())) { GQ.preview.stop(); return; }
      if (parsed.problems.length) { UI.toast('Fix the problems first.'); return; }
      GQ.preview.play(draftLevel(), { from: Math.floor(pos / parsed.beatsPerBar) * parsed.beatsPerBar });
    } }, '♪ Listen');
    const draftLevel = () => ({ id: 'creator-draft', title: parsed.meta.title, [fmt]: text, bpm: parsed.meta.bpm, backing: parsed.meta.chords.length ? 'folk' : 'none' });
    const pvOff = ['start', 'stop', 'end'].map((ev) => GQ.preview.on(ev, () => { const on = GQ.preview.playing(draftLevel()); listenBtn.textContent = on ? '■ Stop' : '♪ Listen'; listenBtn.classList.toggle('on', on); }));

    // ----- actions -----
    const saveBtn = h('button.btn.primary', { onclick: () => save() }, 'Save song');
    const practiceBtn = h('button.btn', { onclick: () => { const s = save(); if (s) UI.go('#/lesson/song-custom-' + s.id + '-full'); } }, 'Save and practise');
    const fileIn = h('input', { type: 'file', accept: '.abc,.tab,.txt,text/plain', hidden: true, onchange: async (e) => {
      const f = e.target.files[0]; if (!f) return;
      const raw = await f.text();
      e.target.value = '';
      if (looksLikeTab(raw)) { setFormat('tab', /(^|\n)\s*title\s*:/i.test(raw) ? raw : 'Title: ' + f.name.replace(/\.[^.]*$/, '') + '\n' + raw); return; }
      const tunes = ABC.splitTunes(raw);
      if (!tunes.length) { UI.toast('No tune found in that file: each tune needs an X: line and a K: line.'); return; }
      if (tunes.length > 1) UI.toast(`The file has ${tunes.length} tunes: the first is open here. Use Songs > Import .abc to add them all.`, 6000);
      setFormat('abc', tunes[0]);
    } });
    function save(asCopy) {
      if (parsed.problems.length) { UI.toast('Fix the problems first.'); return null; }
      try {
        const entry = GQ.custom.save({ id: song && !asCopy ? song.id : null, format: fmt, text });
        song = entry; savedText = text;
        GQ.storage.set('creatorDraft', null);
        if (location.hash !== '#/creator/' + entry.id) history.replaceState(null, '', '#/creator/' + entry.id);
        refresh(); drawActions();
        UI.toast(`Saved "${entry.title}". It is in Songs > My songs.`);
        return entry;
      } catch (e) { UI.toast(e.message, 6000); return null; }
    }
    const actions = h('div.row');
    function drawActions() {
      actions.innerHTML = '';
      actions.append(...[saveBtn, practiceBtn,
        song ? h('button.btn.ghost', { onclick: () => save(true), title: 'Keep the original and save this as a new song' }, 'Save as a copy') : null,
        h('button.btn.ghost', { onclick: () => UI.download(UI.fileName(parsed.meta.title, GQ.custom.ext(fmt)), text) }, 'Download ' + GQ.custom.ext(fmt)),
        h('button.btn.ghost', { onclick: () => fileIn.click(), title: 'Open an .abc or tab (.tab, .txt) file' }, 'Open file'), fileIn,
        h('button.btn.ghost', { onclick: () => { if (text !== savedText && text !== templateOf(fmt) && !confirm('Start a new song? Unsaved changes here will be lost.')) return; GQ.storage.set('creatorDraft', null); song = null; savedText = null; history.replaceState(null, '', '#/creator'); setText(templateOf(fmt), true); drawActions(); } }, 'New'),
        saveState].filter(Boolean));
    }
    drawActions();

    // ----- ABC or tab -----
    const tabHint = h('div.tab-hint', null,
      h('p.small.muted', null, 'Write or paste guitar tab: six lines, high e on top, bar lines with |. Paste a whole tab from a website and it is read as it is. ',
        'Marks: 5h7 hammer-on, 7p5 pull-off, 5/7 slide, 7b9 bend, 7~ vibrato, x dead note, x3 after a block repeats it, pm--- under the block palm-mutes. ',
        h('a', { href: '#/help', onclick: (e) => { e.preventDefault(); UI.go('#/help'); setTimeout(() => { const el = document.getElementById('h-tab'); if (el) el.scrollIntoView(); }, 50); } }, 'More about tab'), '.'),
      h('p.small.muted', null, 'Tab has no note lengths, so the rhythm is read from the spacing: space the notes the way they are played, and check it with Listen.'));
    const fmtSeg = h('div.seg', { role: 'group', 'aria-label': 'Written as' }, ...[['abc', 'ABC'], ['tab', 'Tab']].map(([f, t]) => h('button', { 'data-f': f, onclick: () => switchFormat(f) }, t)));
    const abcOnly = [field('Key', fKey), field('Default note length', fUnit), field('Neck position', fPos), field('Octave', fOct), field('Play', fPlay), tools, fb,
      h('p.small.muted', null, 'Pick a length, then click a string and fret. The note is written into the song below at the cursor. Type directly in the text too: it is checked as you go.')];
    function setFormat(f, newText) {
      fmt = f;
      for (const b of fmtSeg.children) b.classList.toggle('on', b.dataset.f === f);
      for (const el of abcOnly) el.style.display = f === 'abc' ? '' : 'none';
      tabHint.style.display = f === 'tab' ? '' : 'none';
      ta.setAttribute('aria-label', f === 'tab' ? 'Guitar tab' : 'ABC notation');
      if (f !== 'abc' && record) recBtn.click();
      setText(newText != null ? newText : ta.value, newText != null);
      drawActions();
    }
    function switchFormat(f) {
      if (f === fmt) return;
      const blank = !text.trim() || text === templateOf(fmt) || !parsed.events.some((e) => e.kind !== 'rest');
      if (looksLikeTab(text) === (f === 'tab')) setFormat(f);   // the text is already written that way
      else if (blank || confirm(`Start this song again as ${f === 'tab' ? 'tab' : 'ABC'}? Nothing is converted: the text here is replaced.`)) setFormat(f, templateOf(f));
    }
    // pasting tab into a new ABC song turns it into a tab song
    ta.addEventListener('paste', (e) => {
      const t = (e.clipboardData || G.clipboardData).getData('text');
      if (fmt !== 'abc' || !looksLikeTab(t)) return;
      if (!song && !parsed.events.some((x) => x.kind !== 'rest')) {
        e.preventDefault();
        const m = parsed.meta, title = m.title && m.title !== 'My new song' ? m.title : 'My new tab';
        // add only the header lines the tab doesn't have
        const has = (re) => new RegExp('(^|\\n)\\s*(' + re + ')\\s*:', 'i').test(t);
        const head = [has('title') ? '' : 'Title: ' + title, has('tempo|bpm') ? '' : 'Tempo: ' + (m.bpm || 90), has('time|meter') ? '' : 'Time: ' + m.meterText].filter(Boolean);
        setFormat('tab', head.length ? head.join('\n') + '\n\n' + t.replace(/^\n+/, '') : t);
        UI.toast('That is guitar tab, so this song is now written as tab.', 5000);
      } else UI.toast('That looks like guitar tab, but this song is written in ABC. Press New, choose Tab, and paste it there.', 7000);
    });

    main.append(
      h('div.hero', null,
        h('div', null, h('h2', null, song ? 'Creator: ' + song.title : 'Creator'),
          h('p.muted.small', null, 'Build a song, hear it, save it. Saved songs appear in Songs > My songs, and you can come back here with Edit. ',
            h('a', { href: '#/help' }, 'How the ABC format works'), '.')),
        h('div.row', null, h('a.btn.ghost', { href: '#/songs/mine' }, 'My songs'), h('a.btn.ghost', { href: '#/help' }, 'ABC help'))),
      h('div.creator', null,
        h('section.card.song-fields', null, h('h3', { style: { marginTop: 0 } }, 'Song'),
          h('label.field', null, 'Written as', fmtSeg),
          h('div.fields', null, field('Title', fTitle), field('By', fBy), field('Meter', fMeter), field('Tempo (quarter notes per minute)', fTempo), ...abcOnly.slice(0, 5))),
        h('section.card.write', null, h('h3', { style: { marginTop: 0 } }, 'Write'),
          ...abcOnly.slice(5), tabHint,
          ta, problemsEl),
        h('section.card.preview-card', null,
          h('div.row.spread', null, h('h3', { style: { margin: 0 } }, 'Preview'), h('div.row', null, listenBtn)),
          h('div.strip.tab', null, tab), h('div.strip.staff', null, staff), scrub, statsEl)),
      h('div.card', { style: { marginTop: '1rem' } }, actions));

    UI.draw = function () {
      const s = store.settings();
      const pv = GQ.preview.playing(draftLevel()) ? GQ.preview.pos() : null;
      if (pv != null) { pos = Math.max(0, pv); scrub.value = pos; }
      const opts = { events: parsed.events, pos: pv != null ? pv : pos, size: 1, beatsPerBar: parsed.beatsPerBar, totalBeats: parsed.totalBeats, setup: T.setup, flip: s.flipStrings };
      R.tab(tab, opts); R.staff(staff, opts);
      const markers = hover ? [{ string: hover.string, fret: hover.fret, finger: 0, label: T.pcName(T.midiAt(hover.string, hover.fret)), alpha: 0.9 }] : [];
      // show the last written notes on the neck
      const last = parsed.events.filter((e) => e.kind !== 'rest').slice(-1)[0];
      if (last) for (const n of last.notes) markers.push({ string: n.string, fret: n.fret, finger: n.finger, alpha: 0.45 });
      R.fretboard(fb, Object.assign(fbOpts(), { markers, lefty: s.leftHanded }));
    };
    setFormat(fmt);
    // keep the preview following the cursor when typing
    ta.addEventListener('click', () => {
      const lineNo = ta.value.slice(0, ta.selectionStart).split('\n').length;
      const ev = parsed.events.find((e) => e.line >= lineNo);
      if (ev) pos = ev.beat;
    });
    return {
      destroy() { offNote(); pvOff.forEach((f) => f()); GQ.preview.stop(); },
      onAction(a) { if (a === 'toggle') listenBtn.click(); },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
