/* GuitarQuest: the Practice room. Well-known exercises and drills under the names guitar teachers use
 * (pentatonic boxes, the spider, 1-2-3-4, the 12-bar shuffle, Travis picking...), for daily practice
 * once the lessons are done. All of it is generic study material: scales, arpeggios, chord changes and
 * technique drills, not copied from any song (REQ-FN-4, REQ-NF-6).
 * Every exercise is a normal level with the id 'px-<name>', so Listen, note steps, loop and scoring all work. */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory, CUR = GQ.curriculum;
  const STD = { tuning: 'standard', capo: 0 };

  // extra scales for the modes
  Object.assign(T.SCALES, {
    dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10], lydian: [0, 2, 4, 6, 7, 9, 11],
    mixolydian: [0, 2, 4, 5, 7, 9, 10], locrian: [0, 1, 3, 5, 6, 8, 10], harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  });
  const PC = { C: 0, 'C#': 1, D: 2, Eb: 3, E: 4, F: 5, 'F#': 6, G: 7, Ab: 8, A: 9, Bb: 10, B: 11 };

  // ---------- helpers ----------
  const tok = (n) => n.string + ':' + n.fret;
  const rep = (s, n) => Array(n).fill(s).join(' | ');
  // every note of a scale (or chord) between two frets, low string to high, always rising in pitch
  function box(root, intervals, lo, hi) {
    const pcs = intervals.map((i) => (PC[root] + i) % 12), out = [];
    let last = -1;
    for (let s = 6; s >= 1; s--) for (let f = lo; f <= hi; f++) {
      const m = T.midiAt(s, f, STD);
      if (m > last && pcs.includes(m % 12)) { out.push({ string: s, fret: f, midi: m }); last = m; }
    }
    return out;
  }
  const fromRoot = (ns, root) => ns.slice(Math.max(0, ns.findIndex((n) => T.midiAt(n.string, n.fret, STD) % 12 === PC[root])));
  const nps = (root, scale, nPer, lowFret) => T.npsPattern(PC[root], scale, 0, nPer, lowFret, STD);
  const updown = (ns) => ns.concat(ns.slice(0, -1).reverse());
  const down = (ns) => ns.slice().reverse();
  function seqN(ns, k) { const out = []; for (let i = 0; i + k <= ns.length; i++) out.push(...ns.slice(i, i + k)); return out; }
  function thirds(ns) { const out = []; for (let i = 0; i + 2 < ns.length; i++) out.push(ns[i], ns[i + 2]); return out; }
  // equal notes of one duration, bar lines added, the last bar filled with rests
  function bars(dur, list, perBar) {
    const t = list.map((x) => (typeof x === 'string' ? x : tok(x)));
    while (t.length % perBar) t.push('r');
    const out = [];
    for (let i = 0; i < t.length; i += perBar) out.push(t.slice(i, i + perBar).join(' '));
    return dur + ' ' + out.join(' | ');
  }
  const eighths = (list) => bars('e', list, 8);
  const sixteenths = (list) => bars('s', list, 16);
  const twice = (text) => text + ' | ' + text;

  const CATS = [
    ['warmup', 'Warm-ups', 'Chromatic finger drills to start every session. Slow and even beats fast and messy.'],
    ['pentatonic', 'Pentatonic & blues', 'The five pentatonic boxes, the blues scale and the classic ways to run them.'],
    ['scales', 'Scales & modes', 'Major and minor scales in position and three notes per string, and the modes.'],
    ['arpeggios', 'Arpeggios', 'Chord tones one at a time: open-chord picking, triads, seventh arpeggios and sweeps.'],
    ['rhythm', 'Rhythm & chords', 'Shuffles, strumming patterns, famous progressions, one-minute changes and fingerpicking.'],
    ['technique', 'Bends, legato & licks', 'Bending to pitch, vibrato, hammer-ons, slides and the blues vocabulary.'],
    ['speed', 'Speed builders', 'Loops that speed up after every clean pass. Stop at the tempo where it gets untidy.'],
  ];
  const items = [];
  const X = (cat, id, title, aka, desc, text, o) => items.push(Object.assign({ cat, id: 'px-' + id, title, aka, desc, text, bpm: 80, meter: [4, 4], practice: true }, o || {}));

  // ===== Warm-ups =====
  const chrom = (lo) => { const a = []; for (let s = 6; s >= 1; s--) for (let k = 0; k < 4; k++) a.push({ string: s, fret: lo + k }); return a; };
  const chromDown = (lo) => { const a = []; for (let s = 1; s <= 6; s++) for (let k = 3; k >= 0; k--) a.push({ string: s, fret: lo + k }); return a; };
  X('warmup', 'chromatic-1234', 'Chromatic 1-2-3-4', 'the "1234" exercise', 'One finger per fret at fret 5: fingers 1, 2, 3, 4 on every string up to the high e, then 4, 3, 2, 1 back down. Keep each finger down until the next one lands.',
    twice(eighths(chrom(5).concat(chromDown(5)))), { bpm: 70, pos: 5 });
  X('warmup', 'chromatic-4321', 'Chromatic 4-3-2-1', 'reverse chromatic', 'Start with the little finger: 4, 3, 2, 1 on every string, low to high, then back. Put all four fingers down first and lift them one at a time.',
    twice(eighths((() => { const a = []; for (let s = 6; s >= 1; s--) for (let k = 3; k >= 0; k--) a.push({ string: s, fret: 5 + k }); return a.concat(chrom(5).reverse()); })())), { bpm: 70, pos: 5 });
  const perm = (order) => { const a = []; for (let s = 6; s >= 1; s--) for (const k of order) a.push({ string: s, fret: 4 + k }); for (let s = 1; s <= 6; s++) for (const k of order.slice().reverse()) a.push({ string: s, fret: 4 + k }); return a; };
  X('warmup', 'perm-1324', 'Finger permutation 1-3-2-4', 'chromatic permutations', 'Fingers 1, 3, 2, 4 on every string, then 4, 2, 3, 1 back down. The odd order breaks the habit of moving fingers as a group.', eighths(perm([1, 3, 2, 4])), { bpm: 66, pos: 5 });
  X('warmup', 'perm-1243', 'Finger permutation 1-2-4-3', 'chromatic permutations', 'Fingers 1, 2, 4, 3: the weak third and fourth fingers swap. Slow down until every note rings clean.', eighths(perm([1, 2, 4, 3])), { bpm: 66, pos: 5 });
  const spider = []; for (let s = 6; s >= 3; s--) spider.push({ string: s, fret: 5 }, { string: s - 1, fret: 6 }, { string: s, fret: 7 }, { string: s - 1, fret: 8 });
  for (let s = 1; s <= 4; s++) spider.push({ string: s, fret: 8 }, { string: s + 1, fret: 7 }, { string: s, fret: 6 }, { string: s + 1, fret: 5 });
  X('warmup', 'spider', 'The spider', 'spider walk', 'Fingers walk across two strings at a time like legs: 1 on the lower string, 2 on the next, 3 back on the lower, 4 on the next, then move up one string. Only lift each finger when it has to move.',
    twice(eighths(spider)), { bpm: 60, pos: 5 });
  const stair = []; for (let s = 6; s >= 1; s--) for (let k = 0; k < 4; k++) stair.push({ string: s, fret: 1 + (6 - s) + k });
  X('warmup', 'chromatic-staircase', 'Chromatic staircase', 'diagonal chromatic', 'Fingers 1-2-3-4, moving one fret higher on every string: frets 1 to 4 on the low E, 2 to 5 on the A, up to 6 to 9 on the high e. Then down the same way.',
    twice(eighths(stair.concat(stair.slice().reverse()))), { bpm: 66, pos: 1 });
  X('warmup', 'finger-independence', 'Finger independence trills', '1-2, 1-3, 1-4 trills', 'Keep finger 1 down on fret 5 of the G string and hammer and pull with finger 2, then 3, then 4. Each finger does one bar.',
    'q 3:5h6 3:6p5 3:5h6 3:6p5 | 3:5h7 3:7p5 3:5h7 3:7p5 | 3:5h8 3:8p5 3:5h8 3:8p5 | 3:6h7 3:7p6 3:7h8 3:8p7', { bpm: 70, pos: 5 });

  // ===== Pentatonic & blues (A minor) =====
  const PB = [[1, 5, 8], [2, 7, 10], [3, 9, 13], [4, 12, 15], [5, 14, 17]];
  const BOXNAME = { 1: 'the "home" box, root on fret 5', 2: 'the box above box 1', 3: 'the middle box, around fret 10', 4: 'the octave box, root on fret 12', 5: 'the box that joins back to box 1 an octave up' };
  for (const [b, lo, hi] of PB) {
    const ns = box('A', T.SCALES.minorPent, lo, hi);
    X('pentatonic', 'pent-box' + b, 'Minor pentatonic box ' + b, 'A minor pentatonic, position ' + b + ', ' + BOXNAME[b],
      `Two notes on every string, frets ${lo} to ${hi}: up to the high e and back down. The root (A) is the note to aim for.`, twice(eighths(updown(ns))), { bpm: 76, pos: lo, chords: ['Am'], backing: 'rock' });
  }
  const box1 = box('A', T.SCALES.minorPent, 5, 8);
  X('pentatonic', 'pent-connect-1-2', 'Connecting boxes 1 and 2', 'pentatonic shift', 'Up box 1 on the low strings, slide your hand up into box 2 on the G string, then down box 2 and slide back. Joining the boxes is how you stop feeling stuck in one place.',
    twice(eighths(box1.slice(0, 6).concat(box('A', T.SCALES.minorPent, 7, 10).slice(6)).concat(down(box('A', T.SCALES.minorPent, 7, 10)).slice(0, 6), down(box1).slice(6)))), { bpm: 70, pos: 5, chords: ['Am'], backing: 'rock' });
  X('pentatonic', 'pent-3nps', 'Pentatonic three notes per string', 'the diagonal pentatonic', 'E minor pentatonic with three notes on every string, climbing the neck from the open low E to fret 17. Good for fast runs across positions.',
    eighths(updown(nps('E', 'minorPent', 3, 0)).concat(['r'])), { bpm: 70, pos: 0, chords: ['Em'], backing: 'rock' });
  X('pentatonic', 'pent-threes', 'Pentatonic in threes', 'sequence in 3s', 'Box 1 in groups of three: 1 2 3, 2 3 4, 3 4 5... up, then the same coming down. The most common way to make a scale sound like a lick.',
    eighths(seqN(box1, 3).concat(seqN(down(box1), 3))), { bpm: 72, pos: 5, chords: ['Am'], backing: 'rock' });
  X('pentatonic', 'pent-fours', 'Pentatonic in fours', 'sequence in 4s', 'Box 1 in groups of four: 1 2 3 4, 2 3 4 5... Up and down. Accent the first note of each group.',
    sixteenths(seqN(box1, 4).concat(seqN(down(box1), 4))), { bpm: 60, pos: 5, chords: ['Am'], backing: 'rock' });
  X('pentatonic', 'pent-skips', 'Pentatonic in thirds', 'skipping sequence', 'Box 1 skipping a note: 1 3, 2 4, 3 5... A wider sound than straight runs, and it trains string crossing.',
    eighths(thirds(box1).concat(thirds(down(box1)))), { bpm: 70, pos: 5, chords: ['Am'], backing: 'rock' });
  const leg = [], legD = [];
  for (let i = 0; i < box1.length; i += 2) leg.push(`${tok(box1[i])}h${box1[i + 1].fret}`);
  for (let i = box1.length - 1; i > 0; i -= 2) legD.push(`${tok(box1[i])}p${box1[i - 1].fret}`);
  X('pentatonic', 'pent-legato', 'Legato pentatonic', 'hammer-on / pull-off box 1', 'Pick only the first note on every string: hammer on to the second going up, pull off to it coming down.',
    twice('q ' + leg.slice(0, 4).join(' ') + ' | ' + leg.slice(4).concat(legD.slice(0, 2)).join(' ') + ' | ' + legD.slice(2).join(' ')), { bpm: 66, pos: 5, chords: ['Am'], backing: 'rock' });
  X('pentatonic', 'blues-scale', 'Blues scale', 'A blues, box 1 with the "blue note"', 'The minor pentatonic plus one extra note, the flat fifth (E flat), on the A and G strings. Pass through it; don\'t sit on it.',
    twice(eighths(updown(fromRoot(box('A', T.SCALES.blues, 5, 8), 'A')))), { bpm: 72, pos: 5, chords: ['A7', 'A7', 'D7', 'A7'], backing: 'blues' });
  X('pentatonic', 'major-pent', 'Major pentatonic', 'G major pentatonic, the "country box"', 'G major pentatonic at fret 2: the same box shape as the minor pentatonic, moved down three frets. Happy and open where the minor one is bluesy.',
    twice(eighths(updown(box('G', T.SCALES.majorPent, 2, 5)))), { bpm: 76, pos: 2, chords: ['G', 'C', 'G', 'D'], backing: 'folk' });
  X('pentatonic', 'bb-box', 'B.B. King box', 'the blues box at fret 10', 'A small shape on the B and high e strings around fret 10, loved by blues players: the root on the B string, a bend on the e string. Let the long notes sing with vibrato.',
    rep('q 1:10 2:13 2:10 e 2:12 2:13 | q 1:10b2 1:12 h 2:10~', 4), { bpm: 70, pos: 10, chords: ['A7', 'D7'], backing: 'blues' });

  // ===== Scales & modes =====
  X('scales', 'major-position', 'Major scale in position', 'G major, second position', 'G major with one finger per fret, frets 2 to 5, no shifts. Say "do re mi" in your head so you hear where the root falls.',
    twice(eighths(updown(fromRoot(box('G', T.SCALES.major, 2, 5), 'G')))), { bpm: 72, pos: 2, chords: ['G', 'C', 'D', 'G'], backing: 'folk' });
  X('scales', 'major-3nps', 'Major scale three notes per string', 'G major 3nps', 'Three notes on every string, starting on G at fret 3. The standard fingering for speed: 1-2-4 or 1-3-4 on each string.',
    eighths(updown(nps('G', 'major', 3, 3)).concat(['r'])), { bpm: 72, pos: 2, chords: ['G', 'C', 'D', 'G'], backing: 'folk' });
  X('scales', 'major-thirds', 'Major scale in thirds', 'diatonic thirds', 'G major in position, skipping every other note: G B, A C, B D... then down. It is the sound of a lot of melodies.',
    eighths(thirds(fromRoot(box('G', T.SCALES.major, 2, 5), 'G')).concat(thirds(down(fromRoot(box('G', T.SCALES.major, 2, 5), 'G'))))), { bpm: 70, pos: 2, chords: ['G', 'C', 'D', 'G'], backing: 'folk' });
  X('scales', 'natural-minor', 'Natural minor scale', 'A minor, Aeolian', 'A natural minor in fifth position: the pentatonic box 1 plus B and F. Sad and serious.',
    twice(eighths(updown(fromRoot(box('A', T.SCALES.minor, 4, 8), 'A')))), { bpm: 72, pos: 5, chords: ['Am', 'F', 'G', 'Am'], backing: 'rock' });
  X('scales', 'harmonic-minor', 'Harmonic minor scale', 'A harmonic minor', 'Natural minor with a raised seventh (G sharp). The gap between F and G sharp gives it the classical, "Spanish" sound.',
    twice(eighths(updown(fromRoot(box('A', T.SCALES.harmonicMinor, 4, 8), 'A')))), { bpm: 70, pos: 5, chords: ['Am', 'Dm', 'E', 'Am'], backing: 'folk' });
  const MODES = [['dorian', 'Dorian mode', 'A Dorian', 'Minor with a bright sixth (F sharp). The mode of funk and jazzy minor grooves.', 'A', 5, ['Am', 'D']],
    ['mixolydian', 'Mixolydian mode', 'G Mixolydian', 'Major with a flat seventh (F). Rock, blues and folk tunes live here.', 'G', 3, ['G', 'F']],
    ['phrygian', 'Phrygian mode', 'E Phrygian', 'Minor with a flat second (F): the dark, flamenco and metal sound.', 'E', 0, ['Em', 'F']],
    ['lydian', 'Lydian mode', 'F Lydian', 'Major with a raised fourth (B natural in F): dreamy and floating.', 'F', 1, ['F', 'G']],
    ['locrian', 'Locrian mode', 'B Locrian', 'The darkest mode, with a flat second and flat fifth. Worth knowing to complete the set.', 'B', 7, ['C', 'Bm']]];
  for (const [sc, title, aka, desc, root, lf, ch] of MODES) {
    const ns = nps(root, sc, 3, lf);
    X('scales', sc, title, aka + ', three notes per string', desc + ' Three notes per string from the root on the low E.', eighths(updown(ns).concat(['r'])),
      { bpm: 70, pos: Math.max(1, Math.min(...ns.map((n) => n.fret)) || 1), chords: ch, backing: 'rock' });
  }
  X('scales', 'chromatic-scale', 'Chromatic scale', 'all twelve notes', 'Every note from the open low E to fret 4 of the high e, four frets per string and the open string first. Name each note as you pass it.',
    eighths(updown((() => { const a = []; for (let s = 6; s >= 1; s--) for (let f = 0; f <= (s === 3 ? 3 : 4); f++) a.push({ string: s, fret: f }); return a; })())), { bpm: 76, pos: 0 });

  // ===== Arpeggios =====
  X('arpeggios', 'open-arpeggios', 'Open-chord arpeggios', 'broken chords, C-Am-F-G', 'Hold each chord and pick its strings one at a time, bass to treble and back. Let every note ring into the next.',
    rep('e 5:3 4:2 3:0 2:1 1:0 2:1 3:0 4:2 | 5:0 4:2 3:2 2:1 1:0 2:1 3:2 4:2 | 4:3 3:2 2:1 1:0 2:1 3:2 4:3 3:2 | 6:3 5:2 4:0 3:0 2:0 1:3 2:0 3:0', 3), { bpm: 76, pos: 0, chords: ['C', 'Am', 'Fmaj7', 'G'], backing: 'folk' });
  X('arpeggios', 'major-triads', 'Major triad inversions', 'C triads on the top three strings', 'The three shapes of C major on the G, B and e strings, climbing the neck: root position at fret 5, first inversion at 8, second inversion at 12.',
    twice('e 3:5 2:5 1:3 2:5 3:5 2:5 1:3 2:5 | 3:9 2:8 1:8 2:8 3:9 2:8 1:8 2:8 | 3:12 2:13 1:12 2:13 3:12 2:13 1:12 2:13 | 3:9 2:8 1:8 2:8 h 3:5+2:5+1:3'), { bpm: 70, pos: 5, chords: ['C'], backing: 'folk' });
  X('arpeggios', 'minor-triads', 'Minor triad inversions', 'A minor triads on the top three strings', 'A minor on the G, B and e strings in three shapes: open, fret 5, fret 8, and the octave at fret 12.',
    twice('e 3:2 2:1 1:0 2:1 3:2 2:1 1:0 2:1 | 3:5 2:5 1:5 2:5 3:5 2:5 1:5 2:5 | 3:9 2:10 1:8 2:10 3:9 2:10 1:8 2:10 | 3:14 2:13 1:12 2:13 h 3:14+2:13+1:12'), { bpm: 70, pos: 5, chords: ['Am'], backing: 'folk' });
  const SEV = [['m7', 'Minor 7th arpeggio', 'Am7', 'A', [0, 3, 7, 10], 5, 8, ['Am7']], ['maj7', 'Major 7th arpeggio', 'Cmaj7', 'C', [0, 4, 7, 11], 7, 10, ['Cmaj7']], ['dom7', 'Dominant 7th arpeggio', 'G7', 'G', [0, 4, 7, 10], 2, 6, ['G7']]];
  for (const [id, title, name, root, iv, lo, hi, ch] of SEV) {
    let ns = box(root, iv, lo, hi);
    const r = ns.findIndex((n) => n.midi % 12 === PC[root]); ns = ns.slice(r); // start on the root
    X('arpeggios', 'arp-' + id, title, name + ', two octaves', `The four notes of ${name} (root, third, fifth, seventh) across the neck in one position, up and down. The root is the first note.`,
      twice(eighths(updown(ns))), { bpm: 70, pos: lo, chords: ch, backing: 'folk' });
  }
  X('arpeggios', 'sweep-triads', 'Three-string sweep', 'sweep picking, Am-G-F-E', 'One pick stroke drags across the three top strings, then back. Mute each note as the next one sounds. Chords: the Andalusian cadence.',
    twice('s 3:14 2:13 1:12 2:13 3:14 2:13 1:12 2:13 3:14 2:13 1:12 2:13 q 1:12 | s 3:12 2:12 1:10 2:12 3:12 2:12 1:10 2:12 3:12 2:12 1:10 2:12 q 1:10 | s 3:10 2:10 1:8 2:10 3:10 2:10 1:8 2:10 3:10 2:10 1:8 2:10 q 1:8 | s 3:9 2:9 1:7 2:9 3:9 2:9 1:7 2:9 3:9 2:9 1:7 2:9 q 1:7'),
    { bpm: 60, pos: 7, chords: ['Am', 'G', 'F', 'E'], backing: 'rock' });

  // ===== Rhythm & chords =====
  const shufA = { A: '5:0+4:2 5:0+4:2 5:0+4:4 5:0+4:4 5:0+4:2 5:0+4:2 5:0+4:4 5:0+4:4', D: '4:0+3:2 4:0+3:2 4:0+3:4 4:0+3:4 4:0+3:2 4:0+3:2 4:0+3:4 4:0+3:4', E: '6:0+5:2 6:0+5:2 6:0+5:4 6:0+5:4 6:0+5:2 6:0+5:2 6:0+5:4 6:0+5:4' };
  const TWELVE = ['I', 'I', 'I', 'I', 'IV', 'IV', 'I', 'I', 'V', 'IV', 'I', 'V'];
  X('rhythm', '12bar-a', '12-bar blues shuffle in A', 'the boogie shuffle', 'The rhythm under a thousand blues and rock\'n\'roll songs: two strings, the fret-2 note then the fret-4 stretch. Swing the eighths: long-short, long-short. Bars: A A A A, D D A A, E D A E.',
    'e ' + TWELVE.map((d) => shufA[{ I: 'A', IV: 'D', V: 'E' }[d]]).join(' | '), { bpm: 96, pos: 0, chords: TWELVE.map((d) => ({ I: 'A7', IV: 'D7', V: 'E7' })[d]), backing: 'blues' });
  const shufE = { E: shufA.E, A: shufA.A, B: '5:2+4:4 5:2+4:4 5:2+4:6 5:2+4:6 5:2+4:4 5:2+4:4 5:2+4:6 5:2+4:6' };
  X('rhythm', '12bar-e', '12-bar blues shuffle in E', 'the boogie shuffle in E', 'The same shuffle in E, the key of Texas blues. The B bars are the same shape moved up two frets on the A string.',
    'e ' + TWELVE.map((d) => shufE[{ I: 'E', IV: 'A', V: 'B' }[d]]).join(' | '), { bpm: 100, pos: 0, chords: TWELVE.map((d) => ({ I: 'E7', IV: 'A7', V: 'B7' })[d]), backing: 'blues' });
  X('rhythm', 'turnaround-a', 'Blues turnaround in A', 'the classic turnaround', 'The walk-down that ends a 12-bar chorus: the high e rings on fret 5 while the B string walks down from fret 8. Then hit E7 to set up the next chorus.',
    rep('e 1:5 2:8 1:5 2:7 1:5 2:6 1:5 2:5 | q 5:0 r h [E7]', 4), { bpm: 80, pos: 5, chords: ['A7', 'E7'], backing: 'blues' });
  const oneMin = (a, b) => 'h ' + Array(12).fill(`[${a}] [${b}]`).join(' | ');
  X('rhythm', 'one-min-g-c', 'One-minute changes: G and C', 'one-minute changes', 'Switch between G and C on every half note. Move all fingers together and land them at once. Count your clean changes, and try to beat it tomorrow.', oneMin('G', 'C'), { bpm: 70, pos: 0 });
  X('rhythm', 'one-min-am-e', 'One-minute changes: Am and E', 'one-minute changes', 'Am and E use the same shape on different strings: keep it and move it across.', oneMin('Am', 'E'), { bpm: 70, pos: 0 });
  X('rhythm', 'one-min-d-a', 'One-minute changes: D and A', 'one-minute changes', 'D to A and back. Leave finger 3 near the B string as a guide.', oneMin('D', 'A'), { bpm: 70, pos: 0 });
  X('rhythm', 'one-min-c-f', 'One-minute changes: C and F', 'one-minute changes, the barre', 'The first barre chord change. Roll the first finger flat for F and keep fingers 2 and 3 close to their C places.', oneMin('C', 'F'), { bpm: 60, pos: 0 });
  const prog = (chs, strum) => Array(3).fill(chs.map((c) => `[${c}]d ${strum}`).join(' | ')).join(' | ');
  X('rhythm', 'four-chord', 'The four-chord progression', 'I-V-vi-IV (C G Am F)', 'The most used progression in pop: C, G, Am, F, one bar each, strummed down on the beat and up in between.',
    'e ' + prog(['C', 'G', 'Am', 'F'], 'u d u d u d u'), { bpm: 84, pos: 0, backing: 'folk', chords: ['C', 'G', 'Am', 'F'] });
  X('rhythm', 'fifties', "The '50s progression", 'I-vi-IV-V, doo-wop changes (C Am F G)', 'C, Am, F, G: the doo-wop progression. Same four chords as the pop one in a different order, and a very different feel.',
    'e ' + prog(['C', 'Am', 'F', 'G'], 'u d u d u d u'), { bpm: 84, pos: 0, backing: 'folk', chords: ['C', 'Am', 'F', 'G'] });
  X('rhythm', 'andalusian', 'Andalusian cadence', 'Am-G-F-E, the flamenco walk-down', 'Four chords walking down to E. Spanish, dramatic, and in countless rock songs.',
    'e ' + prog(['Am', 'G', 'F', 'E'], 'u d u d u d u'), { bpm: 84, pos: 0, backing: 'rock', chords: ['Am', 'G', 'F', 'E'] });
  X('rhythm', 'two-five-one', 'ii-V-I in C', 'the jazz cadence (Dm G7 Cmaj7)', 'The progression at the heart of jazz: Dm, G7, Cmaj7. Two bars of C to let it resolve.',
    'h ' + Array(3).fill('[Dm] [Dm] | [G7] [G7] | [Cmaj7] [Cmaj7] | [Cmaj7] [Cmaj7]').join(' | '), { bpm: 80, pos: 0, backing: 'folk', chords: ['Dm', 'G7', 'Cmaj7', 'Cmaj7'] });
  X('rhythm', 'universal-strum', 'The universal strum', 'D - D U - U D U', 'The strum that fits almost any song: down, down-up, (miss), up, down-up. Keep the hand moving down and up all the time and just miss the strings on the rest.',
    'e ' + Array(3).fill('[G]d r d u r u d u | [C]d r d u r u d u | [D]d r d u r u d u | [G]d r d u r u d u').join(' | '), { bpm: 84, pos: 0, backing: 'folk', chords: ['G', 'C', 'D', 'G'] });
  X('rhythm', 'offbeat-skank', 'Offbeat upstrokes', 'reggae and ska skank', 'Short up-strums only on the "and" of each beat, then relax the fretting hand at once so the chord stops. The gaps are the groove.',
    'e ' + Array(6).fill('r [Am]u r u r u r u | r [D]u r u r u r u').join(' | '), { bpm: 90, pos: 0, backing: 'rock', chords: ['Am', 'D'] });
  X('rhythm', 'funk-16ths', 'Funk sixteenth strumming', 'scratch rhythm, "chicken scratch"', 'Sixteenths all the time, the hand never stops. Most strokes are muted scratches (release the chord); only the accents ring.',
    's ' + Array(6).fill('[Em7]d x x u x x d x x u x x d u x x').join(' | '), { bpm: 76, pos: 0, backing: 'rock', chords: ['Em7'] });
  X('rhythm', 'power-drill', 'Power chord drill', 'root on the E and A strings', 'Two-finger power chords moving between the low E and A strings: G5, A5, C5, D5. Mute the unused strings with the fretting hand.',
    'q ' + Array(4).fill('[P6:3] [P6:3] [P6:5] [P6:5] | [P5:3] [P5:3] [P5:5] [P5:5]').join(' | '), { bpm: 90, backing: 'rock', chords: ['G5', 'C5'] });
  X('rhythm', 'palm-mute-chug', 'Palm-muted chug', 'chugging eighths', 'Rest the edge of the picking hand on the strings by the bridge and pick steady downstroke eighths. Lift the hand for the accented power chord.',
    'e ' + Array(6).fill('6:0pm 6:0pm 6:0pm 6:0pm 6:0pm 6:0pm [P6:3] [P6:5]').join(' | '), { bpm: 100, backing: 'rock', chords: ['E5'] });
  X('rhythm', 'gallop', 'The gallop', 'metal gallop, eighth-two-sixteenths', 'One eighth and two sixteenths, over and over: "da-da-da da-da-da". Palm muted, downstrokes if you can.',
    'e ' + Array(6).fill('6:0pm s 6:0pm 6:0pm e 6:0pm s 6:0pm 6:0pm e 6:0pm s 6:0pm 6:0pm e [P6:3] [P6:5]').join(' | '), { bpm: 90, backing: 'rock', chords: ['E5'] });
  X('rhythm', 'travis', 'Travis picking', 'alternating-thumb fingerpicking', 'The thumb alternates between two bass strings on every beat while the fingers pick the treble strings in between. C, G, Am, then back to C.',
    Array(3).fill('e 5:3 2:1 4:2 1:0 5:3 2:1 4:2 3:0 | 6:3 2:0 4:0 1:3 6:3 2:0 4:0 3:0 | 5:0 2:1 4:2 1:0 5:0 2:1 4:2 3:2 | 5:3 2:1 4:2 1:0 h 5:3+1:0').join(' | '), { bpm: 70, pos: 0, chords: ['C', 'G', 'Am', 'C'], backing: 'folk' });

  // ===== Bends, legato & licks =====
  X('technique', 'bend-whole', 'Whole-step bends to pitch', 'bend and check', 'Play the target note first, then bend the lower note up two frets to match it. Push with three fingers together.',
    rep('h 3:9 3:7b2 | 2:10 2:8b2 | 1:10 1:8b2 | 3:9 3:7b2', 3), { bpm: 66, pos: 5, chords: ['Am'], backing: 'rock' });
  X('technique', 'bend-half', 'Half-step bends', 'the blues curl', 'Bend one fret up: the small bend that turns the minor third into something between minor and major. Match it to the reference note first.',
    rep('h 2:9 2:8b1 | 3:8 3:7b1 | 1:6 1:5b1 | h 2:6 2:5b1', 3), { bpm: 66, pos: 5, chords: ['A7'], backing: 'blues' });
  X('technique', 'vibrato', 'Vibrato', 'finger vibrato', 'Hold each note and shake it slightly sharp and back, evenly, in time with the beat. Wrist does the work, not the finger.',
    rep('w 2:10~ | 1:8~ | 3:7~ | 2:8~', 3), { bpm: 70, pos: 5, chords: ['Am', 'Am', 'Am', 'C'], backing: 'rock' });
  X('technique', 'hammer-pull', 'Hammer-ons and pull-offs', 'legato basics', 'Pick once, then hammer the next note on, pick again and pull off. Hammer from just above the fret; pull off with a small sideways flick.',
    rep('q 3:5h7 3:7p5 2:5h8 2:8p5 | 1:5h8 1:8p5 2:5h8 2:8p5', 4), { bpm: 70, pos: 5, chords: ['Am'], backing: 'rock' });
  X('technique', 'slides', 'Slides between positions', 'position shifting', 'Slide up and down between notes on one string without releasing the pressure. Aim for the new fret with your eyes before the hand moves.',
    rep('h 3:5/7 3:7\\5 | 2:5/8 2:8\\5 | 3:7/9 3:9\\7 | 1:5/8 1:8\\5', 3), { bpm: 70, pos: 5, chords: ['Am'], backing: 'rock' });
  X('technique', 'double-stops', 'Rock\'n\'roll double stops', 'two-string licks in A', 'Two strings with one finger across them, the sound of early rock\'n\'roll lead guitar. Keep the strokes short and punchy.',
    'e ' + Array(8).fill('2:5+1:5 2:5+1:5 2:5+1:5 2:5+1:5 3:7+2:8 3:7+2:8 3:5+2:5 3:5+2:5').join(' | '), { bpm: 100, pos: 5, chords: ['A7', 'A7', 'D7', 'A7'], backing: 'blues' });
  X('technique', 'octaves', 'Octaves', 'string-skip octave shapes', 'Two notes an octave apart, skipping a string. Mute the string in between with the underside of finger 1.',
    rep('q 6:5+4:7 6:5+4:7 6:7+4:9 6:7+4:9 | 5:5+3:7 5:5+3:7 h 5:3+3:5', 4), { bpm: 80, pos: 3, backing: 'rock', chords: ['A5', 'B5', 'D5', 'C5'] });
  X('technique', 'string-skipping', 'String skipping', 'skip one string', 'Alternate between non-neighbouring strings on the pentatonic box 1. Watch the picking hand the first few times.',
    rep('e 6:5 4:5 5:5 3:5 4:7 2:5 3:7 1:5 | 1:8 3:7 2:8 4:7 3:5 5:7 4:5 6:8', 4), { bpm: 72, pos: 5, chords: ['Am'], backing: 'rock' });
  X('technique', 'alternate-16ths', 'Alternate picking sixteenths', 'down-up tremolo', 'Down-up-down-up on one note, four per beat, then move the note. Keep the motion small and from the wrist.',
    rep(sixteenths(['1:5', '1:8', '2:5', '2:8', '3:5', '3:7', '2:8', '1:5'].flatMap((n) => [n, n, n, n])), 3), { bpm: 70, pos: 5, chords: ['Am'], backing: 'rock' });
  X('technique', 'string-crossing', 'Inside and outside picking', 'string crossing', 'Two strings, alternate picking: the pick crosses between them from inside, then from outside. Hardest part of fast picking, so go slowly.',
    rep('s 2:5 1:5 2:8 1:5 2:5 1:5 2:8 1:5 2:5 1:8 2:8 1:8 2:5 1:8 2:8 1:8', 6), { bpm: 60, pos: 5, chords: ['Am'], backing: 'rock' });

  // ===== Speed builders (loops that speed up) =====
  const L = (id, title, aka, desc, text, from, to, o) => X('speed', id, title, aka, desc + ` Loop it: the tempo starts at ${from} BPM and goes up after every clean pass, to ${to}.`, text, Object.assign({ bpm: to, ladder: { from, to } }, o || {}));
  L('speed-chromatic', 'Speed ladder: 1-2-3-4', 'chromatic speed drill', 'The chromatic warm-up on the low strings, in sixteenths.', 's 6:5 6:6 6:7 6:8 5:5 5:6 5:7 5:8 4:5 4:6 4:7 4:8 3:5 3:6 3:7 3:8', 50, 110, { pos: 5 });
  L('speed-pent', 'Speed ladder: pentatonic box 1', 'pentatonic speed run', 'Box 1 up and down in sixteenths.', sixteenths(updown(box1).slice(0, 16)) + ' | ' + sixteenths(updown(box1).slice(11).concat(box1.slice(1, 5))), 50, 110, { pos: 5 });
  L('speed-3nps', 'Speed ladder: major 3nps', 'three-notes-per-string runs', 'G major three notes per string in sextuplet-style groups of three, played as sixteenths.', sixteenths(nps('G', 'major', 3, 3).slice(0, 16)), 50, 110, { pos: 2 });
  L('speed-tremolo', 'Speed ladder: tremolo picking', 'tremolo', 'Fast alternate picking on single notes of the A minor scale.', 's ' + ['1:5', '1:7', '1:8', '1:7'].map((n) => Array(4).fill(n).join(' ')).join(' '), 60, 140, { pos: 5 });
  L('speed-changes', 'Speed ladder: chord changes', 'change speed drill', 'G, C, D, Em, one strum each.', 'q [G] [C] [D] [Em]', 50, 120, { pos: 0 });

  // ---------- index ----------
  const P = (GQ.practice = { cats: CATS, items });
  P.catOf = (id) => CATS.find((c) => c[0] === id);
  P.byId = (id) => items.find((x) => x.id === id) || null;
  P.inCat = (cat) => items.filter((x) => x.cat === cat);
  P.next = (id) => { const x = P.byId(id); if (!x) return null; const l = P.inCat(x.cat); return l[l.indexOf(x) + 1] || null; };
  // practice levels open through the same level lookup as the curriculum
  if (CUR) {
    const byId = CUR.byId, next = CUR.next;
    CUR.byId = (id) => byId(id) || (/^px-/.test(id) ? P.byId(id) : undefined);
    CUR.next = (id) => (/^px-/.test(id) ? P.next(id) : next(id));
  }
})(typeof window !== 'undefined' ? window : globalThis);
