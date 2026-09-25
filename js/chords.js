/* GuitarQuest: chord shapes. Frets are written low E (string 6) to high e (string 1);
 * x = muted. Finger 0 = open, T = thumb (not used here). */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory;
  const C = (GQ.chords = {});

  // name: [frets, fingers, barre?]  barre = [fret, lowString, highString]
  const LIB = {
    E: ['022100', '023100'], Em: ['022000', '023000'], E7: ['020100', '020100'], Em7: ['022030', '012030'],
    A: ['x02220', 'x01230'], Am: ['x02210', 'x02310'], A7: ['x02020', 'x02030'], Am7: ['x02010', 'x02010'],
    Asus2: ['x02200', 'x01200'], Asus4: ['x02230', 'x01240'],
    D: ['xx0232', 'xx0132'], Dm: ['xx0231', 'xx0231'], D7: ['xx0212', 'xx0213'], Dmaj7: ['xx0222', 'xx0123'],
    Dsus2: ['xx0230', 'xx0130'], Dsus4: ['xx0233', 'xx0134'],
    G: ['320003', '210003'], G7: ['320001', '320001'],
    C: ['x32010', 'x32010'], C7: ['x32310', 'x32410'], Cmaj7: ['x32000', 'x32000'], Cadd9: ['x32030', 'x21030'],
    Fmaj7: ['xx3210', 'xx3210'], B7: ['x21202', 'x21304'],
    F: ['133211', '134211', [1, 6, 1]], Bm: ['x24432', 'x13421', [2, 5, 1]], 'F#m': ['244222', '134111', [2, 6, 1]],
    Gm: ['355333', '134111', [3, 6, 1]], Bb: ['x13331', 'x12341', [1, 5, 1]], B: ['x24442', 'x12341', [2, 5, 1]],
    Cm: ['x35543', 'x13421', [3, 5, 1]], 'C#m': ['x46654', 'x13421', [4, 5, 1]], Fm: ['133111', '134111', [1, 6, 1]],
    E5: ['022xxx', '013xxx'], A5: ['x022xx', 'x013xx'], D5: ['xx023x', 'xx013x'], G5: ['355xxx', '134xxx'],
    C5: ['x355xx', 'x134xx'], F5: ['133xxx', '134xxx'], B5: ['x244xx', 'x134xx'],
    // CAGED shapes of C major
    'C@C': ['x32010', 'x32010'], 'C@A': ['x35553', 'x12341', [3, 5, 1]], 'C@G': ['875558', '431114', [5, 4, 2]],
    'C@E': ['8aa988', '134211', [8, 6, 1]], 'C@D': ['xxacdc', 'xx1243'],
  };
  const fretChar = (ch) => (ch === 'x' ? -1 : parseInt(ch, 36)); // a=10, b=11, c=12, d=13

  function build(name, frets, fingers, barre) {
    const notes = [];
    for (let i = 0; i < 6; i++) {
      const s = 6 - i;
      if (frets[i] >= 0) notes.push({ string: s, fret: frets[i], finger: fingers[i] > 0 ? fingers[i] : 0 });
    }
    const played = frets.filter((f) => f > 0);
    return {
      name, frets, fingers, notes,
      barre: barre ? { fret: barre[0], from: barre[1], to: barre[2] } : null,
      minFret: played.length ? Math.min(...played) : 0, maxFret: played.length ? Math.max(...played) : 0,
    };
  }

  // Movable shapes: "F#m@E" (E-shape, root on string 6), "Bm@A" (A-shape, root on string 5),
  // power chords "P6:5" / "P5:3" (root string : fret)
  function movable(name) {
    let m = /^P([56]):(\d+)$/.exec(name);
    if (m) {
      const s = +m[1], f = +m[2];
      const frets = s === 6 ? [f, f + 2, f + 2, -1, -1, -1] : [-1, f, f + 2, f + 2, -1, -1];
      const fingers = s === 6 ? [1, 3, 4, 0, 0, 0] : [0, 1, 3, 4, 0, 0];
      const root = T.pcName(T.midiAt(s, f, { tuning: 'standard', capo: 0 }));
      return build(root + '5', frets, fingers, null);
    }
    m = /^(.+)@([EA])$/.exec(name);
    if (!m) return null;
    const info = T.parseChordName(m[1]);
    if (!info || !['', 'm', '7', 'm7'].includes(info.quality)) return null;
    const s = m[2] === 'E' ? 6 : 5;
    let f = ((info.root - T.openMidi(s, { tuning: 'standard', capo: 0 })) % 12 + 12) % 12;
    if (f === 0) f = 12;
    const q = info.quality;
    let frets, fingers;
    if (s === 6) {
      frets = { '': [f, f + 2, f + 2, f + 1, f, f], m: [f, f + 2, f + 2, f, f, f], 7: [f, f + 2, f, f + 1, f, f], m7: [f, f + 2, f, f, f, f] }[q];
      fingers = { '': [1, 3, 4, 2, 1, 1], m: [1, 3, 4, 1, 1, 1], 7: [1, 3, 1, 2, 1, 1], m7: [1, 3, 1, 1, 1, 1] }[q];
    } else {
      frets = { '': [-1, f, f + 2, f + 2, f + 2, f], m: [-1, f, f + 2, f + 2, f + 1, f], 7: [-1, f, f + 2, f, f + 2, f], m7: [-1, f, f + 2, f, f + 1, f] }[q];
      fingers = { '': [0, 1, 2, 3, 4, 1], m: [0, 1, 3, 4, 2, 1], 7: [0, 1, 3, 1, 4, 1], m7: [0, 1, 3, 1, 2, 1] }[q];
    }
    return build(m[1], frets, fingers, [f, s, 1]);
  }

  const cache = {};
  C.get = function (name) {
    if (cache[name]) return cache[name];
    let c = null;
    if (LIB[name]) {
      const [fr, fi, b] = LIB[name];
      c = build(name.replace(/@.*/, ''), [...fr].map(fretChar), [...fi].map((ch) => (ch === 'x' ? 0 : +ch)), b);
      if (name.includes('@')) c.shape = name.split('@')[1] + ' shape';
    } else c = movable(name);
    if (c) cache[name] = c;
    return c;
  };
  C.names = () => Object.keys(LIB);

  // Pitches the shape actually sounds with the current tuning and capo
  C.midis = (chord, setup) => chord.notes.map((n) => T.midiAt(n.string, n.fret, setup));
  C.pitchClasses = function (chord, setup) {
    const set = new Set(C.midis(chord, setup).map((m) => ((m % 12) + 12) % 12));
    return [...set];
  };
  // The name a listener would hear (capo / half-step down shift the whole shape)
  C.soundingName = function (chord, setup) {
    const s = setup || T.setup;
    const tun = T.TUNINGS[s.tuning].midi, std = T.TUNINGS.standard.midi;
    const shift = tun[0] - std[0];
    const uniform = tun.every((m, i) => m - std[i] === shift);
    if (!uniform) return null; // open tunings: the shape no longer spells the named chord
    const total = shift + (s.capo || 0);
    return total ? T.transposeName(chord.name, total) : chord.name;
  };

  // Chroma template for matching: every sounding string with its first harmonics
  // (octave, fifth, octave, major third), so overtones count for the chord instead of against it.
  const HARM = [[0, 1], [12, 0.6], [19, 0.4], [24, 0.3], [28, 0.25]];
  C.template = function (chord, setup) {
    const t = new Array(12).fill(0);
    for (const m of C.midis(chord, setup)) for (const [iv, w] of HARM) t[(((m + iv) % 12) + 12) % 12] += w;
    return t;
  };
  C.cosine = function (a, b) {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < 12; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return na && nb ? d / Math.sqrt(na * nb) : 0;
  };
  // Compare a heard chroma against the expected chord and against common alternatives
  const ALTS = ['E', 'Em', 'A', 'Am', 'D', 'Dm', 'G', 'C', 'F', 'Bm', 'E7', 'A7', 'D7', 'G7', 'B7', 'C7'];
  // Verdict for scoring (REQ-DET-5, REQ-DET-6): match / wrong / unclear, never a hard guess.
  C.judge = function (chroma, expected, setup) {
    const r = C.match(chroma, expected, setup);
    const exp = T.parseChordName(expected.name), alt = T.parseChordName(r.best.name);
    const sameRoot = exp && alt && exp.root === alt.root;
    if (r.score >= 0.78 && (r.best.score - r.score < 0.06 || sameRoot)) return { verdict: 'match', confidence: r.score, heard: expected.name };
    if (r.best.score >= 0.85 && r.best.score - r.score >= 0.08 && !sameRoot) return { verdict: 'wrong', confidence: r.best.score, heard: r.best.name };
    return { verdict: 'unclear', confidence: r.score, heard: r.best.name };
  };
  C.match = function (chroma, expected, setup) {
    const exp = C.cosine(chroma, C.template(expected, setup));
    let best = { name: expected.name, score: exp };
    for (const n of ALTS) {
      const c = C.get(n);
      if (!c || n === expected.name) continue;
      const sc = C.cosine(chroma, C.template(c, setup));
      if (sc > best.score) best = { name: n, score: sc };
    }
    return { score: exp, best };
  };
})(typeof window !== 'undefined' ? window : globalThis);
