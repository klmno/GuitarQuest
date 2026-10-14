/* GuitarQuest: ABC notation reader. Turns an ABC tune into the same events the lessons use.
 *
 * Supported: X T C O R S N Z M L Q K I V w header fields; keys with modes and extra accidentals;
 * notes with octave marks; ^ ^^ _ __ = accidentals (they last to the end of the bar);
 * lengths (2, /2, 3/2, /, //), broken rhythm > <, ties -, tuplets (3 (5 ...; rests z x Z;
 * chords [CEG]; chord symbols "Am"; bar lines, repeats |: :| :: and endings [1 [2 |1 :|2;
 * inline fields [K:..] [M:..] [L:..] [Q:..]. Decorations, slurs, grace notes, lyrics and extra
 * voices are read and ignored.
 *
 * GuitarQuest settings (I: lines or %% directives):
 *   I:position 5      play in fifth position (default 0 = open position)
 *   I:octave -1       sounding octave relative to the written notes (default -1: guitar music is
 *                     written an octave above how it sounds; use 0 to play the notes as written)
 *   I:play chords     strum the chord symbols; every note or x sets the strum rhythm, z is silence
 */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory;
  const ABC = (GQ.abc = {});

  const LETTER_MIDI = { C: 60, D: 62, E: 64, F: 65, G: 67, A: 69, B: 71 };
  const SHARP_ORDER = 'FCGDAEB', FLAT_ORDER = 'BEADGCF';
  const MAJOR_FIFTHS = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7,
    'G#': 8, 'D#': 9, 'A#': 10, 'E#': 11, 'B#': 12, Fb: -8 };
  const MODE_SHIFT = { '': 0, maj: 0, ion: 0, mix: -1, dor: -2, m: -3, min: -3, aeo: -3, phr: -4, loc: -5, lyd: 1 };

  // ---------- header helpers ----------
  function parseFraction(s) {
    const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(s);
    return m ? +m[1] / +m[2] : null;
  }
  function parseMeter(s) {
    s = (s || '').trim();
    if (!s || s === 'none') return { num: 4, den: 4, value: 1, free: true };
    if (s === 'C') return { num: 4, den: 4, value: 1 };
    if (s === 'C|') return { num: 2, den: 2, value: 1 };
    const m = /^(\d+(?:\+\d+)*)\s*\/\s*(\d+)/.exec(s);
    if (!m) return null;
    const num = m[1].split('+').reduce((a, b) => a + +b, 0);
    return { num, den: +m[2], value: num / +m[2] };
  }
  function parseTempo(s) {
    const all = [...String(s).matchAll(/(\d+)\s*\/\s*(\d+)\s*=\s*(\d+(?:\.\d+)?)/g)];
    if (all.length) { const m = all[all.length - 1]; return Math.round(+m[3] * (+m[1] / +m[2]) * 4); }
    const n = /(\d+(?:\.\d+)?)/.exec(s);
    return n ? Math.round(+n[1]) : null;
  }
  // key signature: {acc: {F:1,...}, name, error}
  function parseKey(s) {
    const out = { acc: {}, name: 'C' };
    let str = String(s || '').replace(/(clef|middle|transpose|octave|stafflines)\s*=\s*\S+/gi, '').trim();
    if (!str || /^none$/i.test(str) || /^HP$/i.test(str) || /^Hp$/.test(str)) return out;
    const m = /^([A-G])([#b]?)\s*([A-Za-z]*)/.exec(str);
    if (!m) { out.error = 'Cannot read the key "' + s + '"'; return out; }
    const tonic = m[1] + m[2];
    const modeWord = m[3].toLowerCase();
    const mode = modeWord.startsWith('maj') ? 'maj' : modeWord === 'm' || modeWord.startsWith('min') ? 'm' : modeWord.slice(0, 3);
    if (!(mode in MODE_SHIFT)) { out.error = 'Unknown mode "' + m[3] + '" in K:'; return out; }
    if (!(tonic in MAJOR_FIFTHS)) { out.error = 'Unknown key "' + tonic + '"'; return out; }
    const fifths = MAJOR_FIFTHS[tonic] + MODE_SHIFT[mode];
    if (fifths > 0) for (let i = 0; i < Math.min(7, fifths); i++) out.acc[SHARP_ORDER[i]] = 1;
    if (fifths < 0) for (let i = 0; i < Math.min(7, -fifths); i++) out.acc[FLAT_ORDER[i]] = -1;
    // explicit accidentals after the key, e.g. K:D ^g
    for (const e of str.slice(m[0].length).matchAll(/(\^\^|\^|__|_|=)([A-Ga-g])/g)) {
      out.acc[e[2].toUpperCase()] = { '^': 1, '^^': 2, _: -1, __: -2, '=': 0 }[e[1]];
    }
    const MODE_NAMES = { dor: 'Dorian', mix: 'Mixolydian', phr: 'Phrygian', lyd: 'Lydian', loc: 'Locrian', aeo: 'Aeolian', ion: 'Ionian' };
    out.name = tonic + (mode === 'm' ? 'm' : mode && mode !== 'maj' ? ' ' + (MODE_NAMES[mode] || mode) : '');
    out.flats = fifths < 0;
    return out;
  }

  // ---------- chord symbol -> chord shape ----------
  function chordShape(name) {
    const base = name.replace(/\/.*$/, '').replace(/^([A-G])♯/, '$1#').replace(/^([A-G])♭/, '$1b').replace(/min$/, 'm').replace(/^([A-G][#b]?)M7$/, '$1maj7');
    let c = GQ.chords.get(base);
    if (!c) {
      // spell flats as sharps for the library, e.g. Bbm -> A#m@A
      const info = T.parseChordName(base);
      if (info) {
        const sharpName = T.SHARPS[info.root] + base.slice(T.parseRoot(base).len);
        c = GQ.chords.get(sharpName) || GQ.chords.get(sharpName + '@E') || GQ.chords.get(sharpName + '@A') || GQ.chords.get(base + '@E') || GQ.chords.get(base + '@A');
        if (c && c.name !== base) c = Object.assign({}, c, { name: base });
      }
    }
    return c || null;
  }
  ABC.chordShape = chordShape;

  // An ABC pitch moved by k octaves: C -> c -> c' up, C -> C, -> C,, down (accidentals kept)
  ABC.shiftOctave = function (tok, k) {
    const m = /^([_^=]*)([A-Ga-g])([,']*)$/.exec(tok);
    if (!m) return tok;
    let o = (m[2] === m[2].toLowerCase() ? 1 : 0) + (m[3].match(/'/g) || []).length - (m[3].match(/,/g) || []).length + k;
    const L = m[2].toUpperCase();
    return m[1] + (o >= 1 ? L.toLowerCase() + "'".repeat(o - 1) : L + ','.repeat(-o));
  };
  // a note length multiplier as ABC writes it: 1 -> "", 2 -> "2", 1/2 -> "/2", 3/2 -> "3/2"
  ABC.lengthText = function (x) {
    for (const den of [1, 2, 4, 8, 16, 32, 3, 6, 12]) {
      const num = Math.round(x * den);
      if (num > 0 && Math.abs(num / den - x) < 1e-6) {
        const g = (a, b) => (b ? g(b, a % b) : a), d = g(num, den);
        const n = num / d, dd = den / d;
        return dd === 1 ? (n === 1 ? '' : String(n)) : (n === 1 ? '' : n) + '/' + dd;
      }
    }
    return '';
  };

  // Tidy up: remove what the app does not use (comments, lyrics and other unused header fields,
  // decorations, grace notes, slurs, annotations, spacers, blank lines, extra spaces), then any
  // character the reader cannot read. Returns {text, removed: {what: count}}.
  const KEEP_FIELDS = 'XTCMLQKIV';
  const DIRECTIVE = /^\s*(position|octave|play)\b/i;
  ABC.tidy = function (source) {
    const removed = {};
    const add = (what, n) => { if (n) removed[what] = (removed[what] || 0) + (n || 1); };
    const out = [];
    let inBody = false;
    for (const raw0 of String(source || '').replace(/\r\n?/g, '\n').split('\n')) {
      let raw = raw0.replace(/\t/g, ' ');
      if (/^%%/.test(raw)) { if (DIRECTIVE.test(raw.slice(2))) out.push('I:' + raw.slice(2).trim()); else add('comments', 1); continue; }
      const ci = raw.indexOf('%');
      if (ci >= 0) { add('comments', 1); raw = raw.slice(0, ci); }
      raw = raw.replace(/\s+$/, '');
      if (!raw.trim()) { if (raw0.trim() === '' && out.length) add('blank lines', 1); continue; }
      const f = /^([A-Za-z]):(.*)$/.exec(raw);
      if (f && (!inBody || 'KMLQVIwWTNPRHr'.includes(f[1]))) {
        if (!KEEP_FIELDS.includes(f[1]) || (f[1] === 'I' && !DIRECTIVE.test(f[2]))) { add(f[1] === 'w' || f[1] === 'W' ? 'lyrics lines' : 'unused header lines', 1); continue; }
        if (f[1] === 'K') inBody = true;
        out.push(f[1] + ':' + f[2].trim());
        continue;
      }
      // body line: walk it the way the reader does, keeping only what is played or shown
      let s = '', i = 0;
      while (i < raw.length) {
        const c = raw[i];
        if (c === '"') {
          const j = raw.indexOf('"', i + 1);
          if (j < 0) { add('stray characters', 1); i++; continue; }
          const txt = raw.slice(i + 1, j).trim();
          if (!txt || /^[\^_<>@]/.test(txt)) add('text annotations', 1); else s += raw.slice(i, j + 1);
          i = j + 1; continue;
        }
        if (c === '[' && /^\[[KMLQIV]:[^\]]*\]/.test(raw.slice(i))) { const m = /^\[[KMLQIV]:[^\]]*\]/.exec(raw.slice(i)); s += m[0]; i += m[0].length; continue; }
        if (c === '!' || c === '+') { const j = raw.indexOf(c, i + 1); add('decorations', 1); i = j < 0 ? raw.length : j + 1; continue; }
        if (c === '{') { const j = raw.indexOf('}', i + 1); add('grace notes', 1); i = j < 0 ? raw.length : j + 1; continue; }
        if ('.~HLMOPSTuv'.includes(c)) { add('decorations', 1); i++; continue; }
        if (c === '(' && !/^\(\d/.test(raw.slice(i))) { add('slurs', 1); i++; continue; }
        if (c === ')') { i++; continue; }
        if ('`y\\'.includes(c)) { add('spacers', 1); i++; continue; }
        s += c; i++;
      }
      s = s.replace(/ {2,}/g, ' ').trim();
      if (s) out.push(s);
    }
    let text = out.join('\n');
    // then anything the reader still cannot read
    for (let n = 0; n < 500; n++) {
      const p = ABC.parse(text);
      const x = p.problems.find((q) => q.fix && /^Unexpected/.test(q.msg));
      if (!x) break;
      text = ABC.applyFix(text, x.fix);
      add(x.fix.insert ? 'sharps rewritten as ^' : 'stray characters', 1);
    }
    text = text.split('\n').map((l) => l.replace(/ {2,}/g, ' ').replace(/\s+$/, '')).filter((l) => l.trim()).join('\n');
    return { text, removed };
  };
  // apply one suggested fix to the text
  ABC.applyFix = function (text, fix) {
    const lines = String(text).split('\n');
    const at = lines.slice(0, fix.line - 1).reduce((a, l) => a + l.length + 1, 0) + fix.col;
    return text.slice(0, at) + fix.insert + text.slice(at + fix.len);
  };

  // ---------- main parser ----------
  // opts: {setup, pos (override I:position)}
  ABC.parse = function (source, opts) {
    opts = opts || {};
    const setup = opts.setup || T.setup;
    const problems = [], warnings = [];
    // a problem can carry a suggested fix: an edit of one line {label, line, col, len, insert}
    const err = (line, msg, fix) => problems.push(fix ? { line, msg, fix } : { line, msg });
    const warn = (line, msg, fix) => { if (!warnings.some((w) => w.msg === msg)) warnings.push(fix ? { line, msg, fix } : { line, msg }); };
    const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    const remove = (line, col, len, what) => ({ label: 'Remove ' + what, line, col, len, insert: '' });
    const replaceLine = (line, insert, label) => ({ label, line, col: 0, len: (lines[line - 1] || '').length, insert });

    const meta = { title: '', composer: '', origin: '', rhythm: '', notes: '', bpm: null, meterText: '4/4', keyName: 'C', unit: null,
      position: 0, octave: -1, play: 'melody', chords: [] };
    let meter = parseMeter('4/4'), unit = null, key = parseKey('C');
    let inBody = false, voice = null, skipVoice = false;
    const bodyLines = []; // {text, line}

    const directive = (text, line) => {
      const m = /^\s*(position|octave|play)\s+(.+?)\s*$/i.exec(text);
      if (!m) return;
      const k = m[1].toLowerCase(), v = m[2].trim().toLowerCase();
      const set = (val) => { const raw = lines[line - 1] || ''; const re = new RegExp('(' + k + '\\s+)([^\\]\\s]+)', 'i'); return re.test(raw) ? replaceLine(line, raw.replace(re, '$1' + val), 'Use ' + k + ' ' + val) : null; };
      if (k === 'position') { const n = parseInt(v, 10); if (n >= 0 && n <= 19) meta.position = n; else err(line, 'I:position must be a fret from 0 to 19', set(isNaN(n) ? 0 : GQ.clamp(n, 0, 19))); }
      if (k === 'octave') { const n = parseInt(v, 10); if (n >= -3 && n <= 2) meta.octave = n; else err(line, 'I:octave must be between -3 and 2', set(isNaN(n) ? -1 : GQ.clamp(n, -3, 2))); }
      if (k === 'play') { if (v === 'chords' || v === 'melody') meta.play = v; else err(line, 'I:play must be "melody" or "chords"', set(/^ch/.test(v) ? 'chords' : 'melody')); }
    };

    lines.forEach((raw, idx) => {
      const ln = idx + 1;
      let text = raw;
      if (/^%%/.test(text)) { directive(text.slice(2), ln); return; }
      const ci = text.indexOf('%');
      if (ci >= 0 && !/\\%/.test(text)) text = text.slice(0, ci);
      if (!text.trim()) return;
      const f = /^([A-Za-z]):(.*)$/.exec(text);
      if (f && (!inBody || 'KMLQVIwWTNPRHr'.includes(f[1]))) {
        const k = f[1], v = f[2].trim();
        switch (k) {
          case 'X': break;
          case 'T': if (!meta.title) meta.title = v; break;
          case 'C': meta.composer = meta.composer ? meta.composer + ', ' + v : v; break;
          case 'O': meta.origin = v; break;
          case 'R': meta.rhythm = v; break;
          case 'N': meta.notes = v; break;
          case 'M': { const m = parseMeter(v); if (!m) err(ln, 'Cannot read the meter "' + v + '" (try 4/4, 3/4 or 6/8)', replaceLine(ln, 'M:4/4', 'Use M:4/4')); else { if (inBody) bodyLines.push({ field: 'M', value: m, line: ln }); else { meter = m; meta.meterText = v; } } break; }
          case 'L': { const u = parseFraction(v); if (!u) err(ln, 'L: needs a fraction such as 1/8', replaceLine(ln, 'L:1/8', 'Use L:1/8')); else if (inBody) bodyLines.push({ field: 'L', value: u, line: ln }); else unit = u; break; }
          case 'Q': { const b = parseTempo(v); if (b) { if (inBody) bodyLines.push({ field: 'Q', value: b, line: ln }); else meta.bpm = b; } else { const n = parseInt(v.replace(/^.*=/, ''), 10), q = n >= 20 && n <= 400 ? n : 100; err(ln, 'Cannot read the tempo "' + v + '" (try Q:1/4=100)', replaceLine(ln, 'Q:1/4=' + q, 'Use Q:1/4=' + q)); } break; }
          case 'K': { const kk = parseKey(v); if (kk.error) err(ln, kk.error, replaceLine(ln, 'K:C', 'Use K:C')); if (inBody) bodyLines.push({ field: 'K', value: kk, line: ln }); else { key = kk; meta.keyName = kk.name; inBody = true; } break; }
          case 'I': directive(v, ln); break;
          case 'V': { const id = v.split(/\s+/)[0]; if (voice === null) voice = bodyLines.some((b) => b.text) ? '(first)' : id; skipVoice = id !== voice; if (skipVoice) warn(ln, 'Only the first voice is played'); break; }
          case 'w': case 'W': break; // lyrics
          default: break;
        }
        return;
      }
      if (!inBody) { err(ln, 'Notes start before the K: line. The header must end with K: (for example K:C).', { label: 'Add K:C above this line', line: ln, col: 0, len: 0, insert: 'K:C\n' }); inBody = true; }
      if (!skipVoice) bodyLines.push({ text, line: ln });
    });
    if (!inBody) {
      let last = lines.length; while (last > 1 && !lines[last - 1].trim()) last--;
      err(1, 'No K: line found: the header must end with a key, for example K:C', { label: 'Add K:C at the end of the header', line: last, col: (lines[last - 1] || '').length, len: 0, insert: (lines[last - 1] || '').trim() ? '\nK:C' : 'K:C' });
    }
    if (!unit) unit = meter.value < 0.75 ? 1 / 16 : 1 / 8;
    meta.unit = unit;

    // ---------- body tokens -> elements ----------
    const els = [];        // {kind:'note'|'rest'|'bar'|'ending', ...}
    let barAcc = {}, chordSym = null, chordAt = null, tuplet = null, broken = null, curUnit = unit, curKey = key;
    const pushSound = (el) => {
      if (chordSym) { el.chordSym = chordSym; el.chordAt = chordAt; chordSym = null; }
      if (tuplet) { el.dur *= tuplet.q / tuplet.p; tuplet.left--; if (tuplet.left <= 0) tuplet = null; }
      if (broken) { el.dur *= broken; broken = null; }
      els.push(el);
    };
    const readLength = (s, i) => {
      const m = /^(\d*)(\/*)(\d*)/.exec(s.slice(i));
      let num = m[1] ? +m[1] : 1, den = 1;
      if (m[2]) den = m[3] ? +m[3] * Math.pow(2, m[2].length - 1) : Math.pow(2, m[2].length);
      return { mult: num / den, len: m[0].length };
    };
    const pitchAt = (s, i, line) => {
      // accidental, letter, octave marks
      const m = /^(\^\^|\^|__|_|=)?([A-Ga-g])([,']*)/.exec(s.slice(i));
      if (!m) return null;
      const letter = m[2].toUpperCase();
      let midi = LETTER_MIDI[letter] + (m[2] === letter ? 0 : 12);
      for (const ch of m[3]) midi += ch === ',' ? -12 : 12;
      const slot = letter + midi;
      let acc;
      if (m[1]) { acc = { '^': 1, '^^': 2, _: -1, __: -2, '=': 0 }[m[1]]; barAcc[slot] = acc; }
      else if (slot in barAcc) acc = barAcc[slot];
      else acc = curKey.acc[letter] || 0;
      return { midi: midi + acc, len: m[0].length };
    };

    for (const bl of bodyLines) {
      if (bl.field) { // inline field lines inside the body
        if (bl.field === 'M') { els.push({ kind: 'meter', meter: bl.value }); }
        if (bl.field === 'L') curUnit = bl.value;
        if (bl.field === 'Q') els.push({ kind: 'tempo', bpm: bl.value });
        if (bl.field === 'K') curKey = bl.value;
        continue;
      }
      const s = bl.text, line = bl.line;
      let i = 0;
      while (i < s.length) {
        const c = s[i];
        if (' \t`y\\'.includes(c)) { i++; continue; }
        if (c === '"') {
          const j = s.indexOf('"', i + 1);
          if (j < 0) {
            const nm = /^"([A-G][#b]?[a-z0-9+#]*(?:\/[A-G][#b]?)?)(?=\s|$)/.exec(s.slice(i));
            err(line, 'A chord symbol is missing its closing "', nm ? { label: 'Close it: "' + nm[1] + '"', line, col: i + nm[0].length, len: 0, insert: '"' } : remove(line, i, 1, 'the unmatched "'));
            break;
          }
          const txt = s.slice(i + 1, j).trim();
          if (txt && !/^[\^_<>@]/.test(txt)) { chordSym = txt; chordAt = { line, col: i, len: j + 1 - i }; }
          i = j + 1; continue;
        }
        if (c === '!' || c === '+') { const j = s.indexOf(c, i + 1); i = j < 0 ? s.length : j + 1; continue; }
        if ('.~HLMOPSTuv'.includes(c)) { i++; continue; }
        if (c === '{') { const j = s.indexOf('}', i + 1); i = j < 0 ? s.length : j + 1; continue; } // grace notes
        if (c === ')') { i++; continue; }
        if (c === '(') {
          const m = /^\((\d)(?::(\d*))?(?::(\d*))?/.exec(s.slice(i));
          if (m) {
            const p = +m[1];
            const q = m[2] ? +m[2] : ({ 2: 3, 3: 2, 4: 3, 6: 2, 8: 3 }[p] || (meter.num % 3 === 0 && meter.num > 3 ? 3 : 2));
            tuplet = { p, q, left: m[3] ? +m[3] : p };
            i += m[0].length;
          } else i++; // slur
          continue;
        }
        if (c === '>' || c === '<') {
          let n = 1; while (s[i + n] === c) n++;
          const factor = 1 - Math.pow(0.5, n); // > : x1.5 / x0.5, >> : x1.75 / x0.25
          const prev = [...els].reverse().find((e) => e.kind === 'note' || e.kind === 'rest');
          if (!prev) err(line, 'A broken rhythm ' + c + ' needs a note before it', remove(line, i, n, '"' + c.repeat(n) + '"'));
          else if (c === '>') { prev.dur *= 1 + factor; broken = 1 - factor; }
          else { prev.dur *= 1 - factor; broken = 1 + factor; }
          i += n; continue;
        }
        if (c === '-') { const prev = els[els.length - 1]; if (prev && prev.kind === 'note') prev.tie = true; i++; continue; }
        if (c === '|' || c === ':' || (c === '[' && s[i + 1] === '|')) {
          const rest = s.slice(i);
          let len, start, end, ending = null;
          if (rest.startsWith('::')) { len = 2; start = end = true; }
          else {
            const m = /^(:*)(\[\||\|\]|\|\||\|)(:*)([1-9])?/.exec(rest);
            if (!m) { err(line, 'Cannot read the bar line at "' + rest.slice(0, 4) + '"', remove(line, i, 1, '"' + c + '"')); i++; continue; }
            len = m[0].length; end = m[1].length > 0; start = m[3].length > 0; ending = m[4] ? +m[4] : null;
          }
          els.push({ kind: 'bar', line, col: i, start, end, unit: curUnit });
          barAcc = {};
          if (ending) els.push({ kind: 'ending', n: ending, line });
          i += len; continue;
        }
        if (c === '[') {
          const inl = /^\[([KMLQIV]):([^\]]*)\]/.exec(s.slice(i));
          if (inl) {
            const k = inl[1], v = inl[2].trim();
            if (k === 'K') { const kk = parseKey(v); if (kk.error) err(line, kk.error); else curKey = kk; }
            if (k === 'M') { const mm = parseMeter(v); if (mm) els.push({ kind: 'meter', meter: mm }); else err(line, 'Cannot read the meter ' + v); }
            if (k === 'L') { const u = parseFraction(v); if (u) curUnit = u; else err(line, 'L: needs a fraction such as 1/8'); }
            if (k === 'Q') { const b = parseTempo(v); if (b) els.push({ kind: 'tempo', bpm: b }); }
            if (k === 'I') directive(v, line);
            i += inl[0].length; continue;
          }
          const end = /^\[([1-9])/.exec(s.slice(i));
          if (end) { els.push({ kind: 'ending', n: +end[1], line }); i += end[0].length; continue; }
          // chord of notes
          const j = s.indexOf(']', i + 1);
          if (j < 0) { const e = i + 1 + /^[^\s|]*/.exec(s.slice(i + 1))[0].length; err(line, 'A chord [ ... ] is missing its closing ]', { label: 'Close the chord with ]', line, col: e, len: 0, insert: ']' }); break; }
          const inner = s.slice(i + 1, j);
          const midis = [];
          let k = 0, innerMult = 1;
          while (k < inner.length) {
            if (inner[k] === ' ' || inner[k] === '-') { k++; continue; }
            const p = pitchAt(inner, k, line);
            if (!p) { err(line, 'Cannot read "' + inner[k] + '" inside the chord [' + inner + ']', remove(line, i + 1 + k, 1, '"' + inner[k] + '"')); break; }
            k += p.len;
            const L = readLength(inner, k); k += L.len;
            if (!midis.length) innerMult = L.mult;
            midis.push(p.midi);
          }
          i = j + 1;
          const L = readLength(s, i); i += L.len;
          let tie = false; if (s[i] === '-') { tie = true; i++; }
          if (midis.length) pushSound({ kind: 'note', midis, dur: 4 * curUnit * innerMult * L.mult, line, tie });
          continue;
        }
        if (c === 'z' || c === 'x') {
          i++; const L = readLength(s, i); i += L.len;
          pushSound({ kind: 'rest', invisible: c === 'x', dur: 4 * curUnit * L.mult, line });
          continue;
        }
        if (c === 'Z' || c === 'X') {
          i++; const m = /^\d*/.exec(s.slice(i)); i += m[0].length;
          const bars = m[0] ? +m[0] : 1;
          for (let b = 0; b < bars; b++) { pushSound({ kind: 'rest', dur: meter.value * 4, line }); if (b < bars - 1) els.push({ kind: 'bar', line }); }
          continue;
        }
        const p = pitchAt(s, i, line);
        if (p) {
          i += p.len;
          const L = readLength(s, i); i += L.len;
          let tie = false; if (s[i] === '-') { tie = true; i++; }
          pushSound({ kind: 'note', midis: [p.midi], dur: 4 * curUnit * L.mult, line, tie, col: i - p.len - L.len - (tie ? 1 : 0), plen: p.len });
          continue;
        }
        if (c === '&') { warn(line, 'Voice overlay (&) is not supported: only the first part is played'); break; }
        // "C#" / "Bb" written the usual way: suggest ABC's ^C / _B
        const prevNote = /([_^=]*)([A-Ga-g])([,']*)$/.exec(s.slice(0, i));
        if (c === '#' && prevNote && !prevNote[1]) { const at = i - prevNote[0].length; err(line, 'Unexpected "#" (column ' + (i + 1) + '): ABC writes a sharp before the note', { label: 'Write ^' + prevNote[2] + prevNote[3], line, col: at, len: prevNote[0].length + 1, insert: '^' + prevNote[2] + prevNote[3] }); }
        else err(line, 'Unexpected "' + c + '" (column ' + (i + 1) + ')', remove(line, i, 1, '"' + c + '"'));
        i++;
      }
    }
    if (chordSym) { els.push({ kind: 'rest', invisible: true, dur: 0, chordSym, line: 0 }); }

    // ---------- repeats and endings ----------
    const played = [];
    let startIdx = 0;
    for (let i = 0; i < els.length; i++) {
      const e = els[i];
      played.push(e);
      if (e.kind === 'bar' && e.end) {
        // play again from the last |: (or the start), leaving out the first ending
        let stop = i;
        for (let k = startIdx; k < i; k++) if (els[k].kind === 'ending' && els[k].n === 1) { stop = k; break; }
        for (let k = startIdx; k < stop; k++) if (els[k].kind !== 'ending') played.push(els[k]);
        played.push({ kind: 'bar', line: e.line });
        if (e.start) startIdx = i + 1;
        else startIdx = i + 1;
        // skip a following "[2" marker; its notes simply continue
        continue;
      }
      if (e.kind === 'bar' && e.start) startIdx = i + 1;
    }

    // ---------- ties ----------
    const seq = [];
    for (const e of played) {
      const last = seq[seq.length - 1];
      if (e.kind === 'note' && last && last.kind === 'note' && last.tie && last.midis.join() === e.midis.join()) {
        last.dur += e.dur; last.tie = e.tie; continue;
      }
      seq.push(e.kind === 'note' || e.kind === 'rest' ? Object.assign({}, e) : e);
    }

    // ---------- events on the neck ----------
    const shift = 12 * meta.octave;
    const pos = opts.pos != null ? opts.pos : meta.position;
    const events = [];
    let beat = 0, hand = pos > 0 ? pos : 1, prevPlace = null, curMeter = meter, bpbBeats = meter.value * 4, barStartBeat = 0, barIndex = 0;
    let currentChord = null, lastSym = null;
    const barMarks = [], barSrc = [];
    const fingerOf = (fret) => {
      if (fret <= 0) return 0;
      if (fret < hand) hand = fret; else if (fret > hand + 3) hand = fret - 3;
      return fret - hand + 1;
    };
    const place = (midi, line, e) => {
      const pl = T.placePitch(midi, pos, prevPlace, setup);
      if (!pl) {
        const low = T.openMidi(6, setup), high = T.openMidi(1, setup) + T.FRETS;
        const k = midi < low ? Math.ceil((low - midi) / 12) : -Math.ceil((midi - high) / 12);
        const tok = e && e.col != null ? (lines[e.line - 1] || '').substr(e.col, e.plen) : null;
        const fix = tok && /^[_^=]*[A-Ga-g][,']*$/.test(tok) ? { label: `Write ${ABC.shiftOctave(tok, k)} (${Math.abs(k)} octave${Math.abs(k) > 1 ? 's' : ''} ${k > 0 ? 'up' : 'down'})`, line: e.line, col: e.col, len: e.plen, insert: ABC.shiftOctave(tok, k) } : null;
        err(line, `${T.midiName(midi)} is ${midi < low ? 'below' : 'above'} the guitar's range. Move it an octave (, or ') or use I:octave.`, fix);
        return null;
      }
      prevPlace = pl;
      return { string: pl.string, fret: pl.fret, finger: fingerOf(pl.fret) };
    };
    const placeChord = (midis, line) => {
      const out = [], used = new Set();
      for (const m of [...midis].sort((a, b) => a - b)) {
        const cands = T.positionsFor(m, setup).filter((p) => !used.has(p.string) && !out.some((o) => o.string <= p.string));
        if (!cands.length) { err(line, `Cannot fit the chord note ${T.midiName(m)} on a separate string`); continue; }
        cands.sort((a, b) => Math.abs(a.fret - Math.max(pos, 1)) - Math.abs(b.fret - Math.max(pos, 1)) || a.fret - b.fret);
        const c = pos === 0 && cands.find((p) => p.fret <= 4) || cands[0];
        used.add(c.string); out.push({ string: c.string, fret: c.fret, finger: fingerOf(c.fret) });
      }
      return out;
    };
    let curLine = 0;
    const push = (ev) => { ev.i = events.length; ev.beat = beat; ev.bar = barIndex; ev.tech = ev.tech || {}; ev.line = curLine; events.push(ev); };
    for (const e of seq) {
      curLine = e.line || curLine;
      if (e.kind === 'meter') { curMeter = e.meter; bpbBeats = e.meter.value * 4; continue; }
      if (e.kind === 'tempo') { if (!meta.bpm) meta.bpm = e.bpm; continue; }
      if (e.kind === 'ending') continue;
      if (e.kind === 'bar') {
        if (beat > 0 && Math.abs(beat - (barMarks.length ? barMarks[barMarks.length - 1] : 0)) > 1e-6) { barMarks.push(beat); barSrc.push(e); }
        barIndex++; barStartBeat = beat; continue;
      }
      if (e.chordSym) {
        const shape = chordShape(e.chordSym);
        if (!shape) { if (e.chordSym !== lastSym) warn(e.line, `No guitar shape for the chord "${e.chordSym}": it is shown but not played`, e.chordAt ? remove(e.chordAt.line, e.chordAt.col, e.chordAt.len, 'the chord symbol') : null); }
        else { currentChord = shape; if (!meta.chords.includes(shape.name)) meta.chords.push(shape.name); }
        lastSym = e.chordSym;
      }
      if (e.dur <= 0) continue;
      if (meta.play === 'chords') {
        if (e.kind === 'rest' && !e.invisible) { push({ kind: 'rest', notes: [], dur: e.dur }); beat += e.dur; continue; }
        if (!currentChord) { push({ kind: 'rest', notes: [], dur: e.dur }); beat += e.dur; continue; }
        const off = Math.abs((beat - barStartBeat) % 1) > 1e-6;
        push({ kind: 'chord', chord: currentChord, chordName: currentChord.name, notes: currentChord.notes.map((n) => ({ ...n })), strum: off ? 'u' : 'd', dur: e.dur, repeat: !e.chordSym });
        beat += e.dur; continue;
      }
      if (e.kind === 'rest') { push({ kind: 'rest', notes: [], dur: e.dur, backChord: currentChord }); beat += e.dur; continue; }
      const sounding = e.midis.map((m) => m + shift);
      if (sounding.length === 1) {
        const n = place(sounding[0], e.line, e);
        if (n) push({ kind: 'note', notes: [n], dur: e.dur, backChord: currentChord });
        else push({ kind: 'rest', notes: [], dur: e.dur });
      } else {
        const notes = placeChord(sounding, e.line);
        if (notes.length) push({ kind: notes.length > 1 ? 'chord' : 'note', notes, dur: e.dur, backChord: currentChord });
        else push({ kind: 'rest', notes: [], dur: e.dur });
      }
      beat += e.dur;
    }
    if (!events.some((e) => e.kind !== 'rest') && !problems.length) err(0, 'There are no notes to play yet.');
    // bar lines that do not land on the meter. A short bar is fine when it pairs with its neighbour
    // to make one full bar (a pickup, or the split bar around a repeat).
    const bpb = bpbBeats;
    const edges = [0, ...barMarks, beat];
    const lens = edges.slice(1).map((b, k) => b - edges[k]).filter((x, k, arr) => x > 1e-6 || k < arr.length - 1);
    const full = (x) => Math.abs(x - bpb) < 1e-3;
    lens.forEach((len, k) => {
      if (curMeter.free || full(len) || k === 0 || k === lens.length - 1) return;
      if ((k > 0 && full(lens[k - 1] + len)) || (k + 1 < lens.length && full(len + lens[k + 1]))) return;
      // a short bar can be filled with a rest just before its bar line
      const src = barSrc[k], missing = bpb - len;
      const fix = src && src.col != null && missing > 1e-6 ? { label: 'Fill it with a rest (z' + ABC.lengthText(missing / (4 * src.unit)) + ')', line: src.line, col: src.col, len: 0, insert: 'z' + ABC.lengthText(missing / (4 * src.unit)) + ' ' } : null;
      warn(src ? src.line : 0, `Bar ${k + 1} lasts ${+len.toFixed(3)} beats but the meter asks for ${bpb}. Check the note lengths in that bar.`, fix);
    });
    const bpm = meta.bpm || 100;
    return {
      events, totalBeats: beat, beatsPerBar: bpb, bars: Math.ceil(beat / bpb - 1e-6), barMarks, pos,
      errors: problems.map((p) => (p.line ? 'Line ' + p.line + ': ' : '') + p.msg), problems, warnings,
      meta: Object.assign(meta, { bpm, meter: [meter.num, meter.den] }),
    };
  };

  // Split a file with several tunes (each starts with X:) into separate ABC texts
  ABC.splitTunes = function (text) {
    const parts = String(text).replace(/\r\n?/g, '\n').split(/\n(?=X:)/);
    return parts.map((p) => p.trim()).filter((p) => /(^|\n)K:/.test(p));
  };

  // Example tunes for the help page (checked by tests/abc.test.js)
  ABC.EXAMPLES = {
    first: `X:1
T:My first tune
M:4/4
L:1/4
Q:1/4=90
K:C
C D E F | G2 G2 | A A A A | G4 |
F F F F | E2 E2 | D D D D | C4 |]`,
    chords: `X:1
T:Evening Walk
C:Me
M:3/4
L:1/4
Q:1/4=100
K:G
"G"B2 d | "C"e2 d | "G"B A G | "D"A3 |
"G"B2 d | "C"e2 g | "D"f e d | "G"g3 |]`,
    strum: `X:1
T:Strumming in G
M:4/4
L:1/8
Q:1/4=80
I:play chords
K:G
|: "G"x2 x2 x x x x | "Em"x2 x2 x x x x | "C"x2 x2 x x x x | "D"x2 x2 z2 x2 :|`,
    riff: `X:1
T:Fifth-position riff
M:4/4
L:1/8
Q:1/4=96
I:position 5
K:Am
A,2 C D E G E D | C2 A, C D2 z2 |
A,2 C D E G A G | E2 D C A,4 |]`,
    jig: `X:1
T:Irish Washerwoman
R:jig
O:Traditional
M:6/8
L:1/8
Q:3/8=100
K:G
|:dc|BGG DGG|BGB dcB|cAA EAA|cAc edc|
BGG DGG|BGB dcB|cBc Adc|BGG G:|`,
  };
})(typeof window !== 'undefined' ? window : globalThis);
