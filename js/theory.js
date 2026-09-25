/* GuitarQuest: music theory. Strings are numbered 1 (high e) to 6 (low E). */
(function (G) {
  'use strict';
  const GQ = G.GQ;
  const T = (GQ.theory = {});

  T.SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  T.FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // Tunings, low string (6) to high string (1)
  T.TUNINGS = {
    standard: { name: 'Standard (EADGBE)', midi: [40, 45, 50, 55, 59, 64] },
    dropD: { name: 'Drop D (DADGBE)', midi: [38, 45, 50, 55, 59, 64] },
    halfDown: { name: 'Half-step down (Eb)', midi: [39, 44, 49, 54, 58, 63] },
    openG: { name: 'Open G (DGDGBD)', midi: [38, 43, 50, 55, 59, 62] },
    dadgad: { name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
  };
  T.STRING_LABEL = { 1: 'e', 2: 'B', 3: 'G', 4: 'D', 5: 'A', 6: 'E' };
  T.FRETS = 24;

  // Current instrument setup (tuning + capo); set by settings
  T.setup = { tuning: 'standard', capo: 0 };
  T.openMidi = function (string, setup) {
    const s = setup || T.setup;
    return T.TUNINGS[s.tuning].midi[6 - string] + (s.capo || 0);
  };
  T.midiAt = (string, fret, setup) => T.openMidi(string, setup) + fret;
  T.stringNames = function (setup) {
    const r = {};
    for (let s = 1; s <= 6; s++) r[s] = T.pcName(T.openMidi(s, setup));
    return r;
  };

  T.pcName = (m, flats) => (flats ? T.FLATS : T.SHARPS)[((Math.round(m) % 12) + 12) % 12];
  T.midiName = (m, flats) => T.pcName(m, flats) + (Math.floor(Math.round(m) / 12) - 1);
  T.freqToMidi = (f, a4) => 69 + 12 * Math.log2(f / (a4 || 440));
  T.midiToFreq = (m, a4) => (a4 || 440) * Math.pow(2, (m - 69) / 12);

  // "F#3" / "Bb4" / "E2" -> midi
  T.parsePitch = function (s) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
    if (!m) return null;
    let pc = PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return (parseInt(m[3], 10) + 1) * 12 + pc;
  };
  T.parseRoot = function (s) {
    const m = /^([A-G])([#b]?)/.exec(s);
    if (!m) return null;
    return { pc: (PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12, len: m[0].length };
  };

  // Chord qualities -> intervals
  T.QUALITIES = {
    '': [0, 4, 7], m: [0, 3, 7], 5: [0, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11],
    dim: [0, 3, 6], aug: [0, 4, 8], sus2: [0, 2, 7], sus4: [0, 5, 7], 6: [0, 4, 7, 9], m6: [0, 3, 7, 9],
    add9: [0, 2, 4, 7], 9: [0, 2, 4, 7, 10], '7sus4': [0, 5, 7, 10], m7b5: [0, 3, 6, 10],
  };
  // "Am7" -> {root pc, quality, pcs[]}
  T.parseChordName = function (name) {
    const r = T.parseRoot(name);
    if (!r) return null;
    let q = name.slice(r.len).replace(/\/.*$/, '');
    if (!(q in T.QUALITIES)) return null;
    const pcs = T.QUALITIES[q].map((i) => (r.pc + i) % 12);
    return { root: r.pc, quality: q, pcs };
  };
  T.transposeName = function (name, semis) {
    const r = T.parseRoot(name); if (!r || !semis) return name;
    return T.SHARPS[(r.pc + semis + 120) % 12] + name.slice(r.len);
  };

  // Scales
  T.SCALES = {
    minorPent: [0, 3, 5, 7, 10], majorPent: [0, 2, 4, 7, 9], blues: [0, 3, 5, 6, 7, 10],
    major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
  };
  T.inScale = (midi, rootPc, scale) => T.SCALES[scale].includes(((midi - rootPc) % 12 + 12) % 12);

  // All places a pitch can be played
  T.positionsFor = function (midi, setup) {
    const out = [];
    for (let s = 6; s >= 1; s--) {
      const f = midi - T.openMidi(s, setup);
      if (f >= 0 && f <= T.FRETS) out.push({ string: s, fret: f });
    }
    return out;
  };

  // Choose a string/fret for a pitch inside a position window [lo, lo+3] (one finger per fret, +1 stretch).
  // Prefers the lowest fret inside the window (open strings in open position), then the closest string to prev.
  T.placePitch = function (midi, lo, prev, setup) {
    const all = T.positionsFor(midi, setup);
    if (!all.length) return null;
    const hi = lo === 0 ? 4 : lo + 4;
    let cands = all.filter((p) => (p.fret === 0 && lo <= 1) || (p.fret >= lo && p.fret <= hi));
    if (!cands.length) cands = all;
    cands.sort((a, b) => {
      const da = a.fret < lo ? lo - a.fret : a.fret > hi ? a.fret - hi : 0;
      const db = b.fret < lo ? lo - b.fret : b.fret > hi ? b.fret - hi : 0;
      if (da !== db) return da - db;
      if (lo === 0 && a.fret !== b.fret) return a.fret - b.fret;
      if (prev) return Math.abs(a.string - prev.string) - Math.abs(b.string - prev.string) || a.fret - b.fret;
      return a.fret - b.fret;
    });
    return cands[0];
  };

  // One-finger-per-fret suggestion
  T.fingerFor = function (fret, pos) {
    if (fret === 0) return 0;
    const base = pos && pos > 0 ? pos : Math.max(1, fret - 3);
    return GQ.clamp(fret - base + 1, 1, 4);
  };

  // Scale runs "N notes per string": gives the standard pentatonic boxes (2 nps) and 3nps major patterns
  T.npsPattern = function (rootPc, scale, startDegree, nps, lowFretMin, setup) {
    const intervals = T.SCALES[scale];
    const pcs = intervals.map((i) => (rootPc + i) % 12);
    // first pitch: scale degree `startDegree` on string 6, at or above lowFretMin
    const open6 = T.openMidi(6, setup);
    let first = null;
    for (let f = lowFretMin; f <= lowFretMin + 12; f++) {
      const m = open6 + f;
      if (((m % 12) + 12) % 12 === pcs[startDegree % pcs.length]) { first = m; break; }
    }
    const notes = [];
    let m = first;
    const nextScale = (x) => { for (let k = x + 1; k < x + 13; k++) if (pcs.includes(((k % 12) + 12) % 12)) return k; return x + 1; };
    for (let s = 6; s >= 1; s--) {
      for (let k = 0; k < nps; k++) {
        notes.push({ string: s, fret: m - T.openMidi(s, setup), midi: m });
        m = nextScale(m);
      }
    }
    return notes;
  };
})(typeof window !== 'undefined' ? window : globalThis);
