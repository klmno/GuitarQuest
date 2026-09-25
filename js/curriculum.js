/* GuitarQuest: the curriculum (REQ-FN-1). 14 units, each level a couple of minutes at most.
 * Exercises are written in the terse notation (notation.js) or generated from a fixed seed,
 * so every device gets the same lesson. */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory;
  const STD = { tuning: 'standard', capo: 0 };

  // ---------- helpers ----------
  const rep = (s, n) => Array(n).fill(s).join(' | ');
  const run = (notes) => notes.map((n) => n.string + ':' + n.fret).join(' ');
  function pent(box, dir) { // A minor pentatonic, box 1 at fret 5
    const lowMin = [5, 7, 9, 12, 2][box - 1];
    const notes = T.npsPattern(9, 'minorPent', box - 1, 2, lowMin, STD);
    return dir === 'down' ? notes.slice().reverse() : dir === 'updown' ? notes.concat(notes.slice(0, -1).reverse()) : notes;
  }
  function seq3(notes) { // groups of three: 1 2 3, 2 3 4, ...
    const out = [];
    for (let i = 0; i + 2 < notes.length; i++) out.push(notes[i], notes[i + 1], notes[i + 2]);
    return out;
  }
  function randomMelody(seed, pool, count, durs) {
    const r = GQ.rng(seed), out = [];
    let last = -1;
    for (let i = 0; i < count; i++) {
      let k; do { k = Math.floor(r() * pool.length); } while (k === last && pool.length > 1);
      last = k;
      if (durs) out.push(durs[Math.floor(r() * durs.length)]);
      out.push(pool[k]);
    }
    return out.join(' ');
  }
  // bar-by-bar random rhythms (always whole bars of 4/4)
  function rhythmMelody(seed, pool, bars) {
    const r = GQ.rng(seed), pats = [['q', 'q', 'q', 'q'], ['h', 'q', 'q'], ['q', 'q', 'h'], ['e', 'e', 'q', 'h'], ['q', 'e', 'e', 'q', 'q'], ['h', 'h']];
    const out = [];
    for (let b = 0; b < bars; b++) {
      const p = pats[Math.floor(r() * pats.length)];
      for (const d of p) out.push(d, pool[Math.floor(r() * pool.length)]);
      if (b < bars - 1) out.push('|');
    }
    return out.join(' ');
  }
  // pad a sequence of eighth-note tokens to whole bars of 4/4 by repeating its last note
  function barsOfEighths(tokens) {
    const t = tokens.slice();
    let k = tokens.length - 2;           // walk back down the run to fill the last bar
    while (t.length % 8) { t.push(tokens[Math.max(0, k)]); k--; }
    return t.join(' ');
  }

  const units = [];
  const U = (id, title, blurb) => { const u = { id, title, blurb, levels: [] }; units.push(u); return u; };
  const L = (u, o) => { o.unit = u.id; o.n = u.levels.length + 1; o.id = 'u' + u.id + '-' + o.n; o.meter = o.meter || [4, 4]; u.levels.push(o); return o; };

  // ===== 1. Getting started =====
  let u = U(1, 'Getting started', 'Tuning, holding the pick, and the six open strings one at a time.');
  L(u, { kind: 'tuner', title: 'Tune up', desc: 'Play each open string and turn its tuning peg until the needle sits in the green. All six must pass before scored lessons.' });
  const OPEN = [[6, 'low E', 'the thickest string, nearest your face'], [5, 'A', 'the next string down'], [4, 'D', 'the middle of the three thick strings'],
    [3, 'G', 'the first of the thin strings'], [2, 'B', 'the second thinnest string'], [1, 'high e', 'the thinnest string, nearest the floor']];
  for (const [s, name, where] of OPEN) {
    L(u, { title: `The ${name} string`, desc: `Pick the open ${name} string: ${where}. Hold the pick between thumb and the side of your first finger, with just the tip showing. Use downstrokes.`,
      text: rep(`h ${s}:0 ${s}:0 | q ${s}:0 ${s}:0 ${s}:0 ${s}:0`, 4), bpm: 70 });
  }
  L(u, { title: 'All six open strings', desc: 'Low E up to high e and back down. Keep your eyes on the screen and find each string by feel.',
    text: rep('q 6:0 5:0 4:0 3:0 | 2:0 1:0 2:0 3:0 | 4:0 5:0 h 6:0', 3), bpm: 70 });

  // ===== 2. First notes =====
  u = U(2, 'First notes', 'Frets 0 to 3 in first position: one finger per fret.');
  L(u, { title: 'Low E: E, F, G', desc: 'Open, fret 1 with finger 1, fret 3 with finger 3. Press just behind the fret wire.', text: rep('q 6:0 6:1 6:3 6:1 | 6:0 6:3 h 6:0', 4), bpm: 70, pos: 1 });
  L(u, { title: 'A string: A, B, C', desc: 'Open, fret 2 with finger 2, fret 3 with finger 3.', text: rep('q 5:0 5:2 5:3 5:2 | 5:0 5:3 h 5:0', 4), bpm: 70, pos: 1 });
  L(u, { title: 'D string: D, E, F', desc: 'Same fingers as the A string, one string higher.', text: rep('q 4:0 4:2 4:3 4:2 | 4:0 4:3 h 4:0', 4), bpm: 70, pos: 1 });
  L(u, { title: 'The low strings together', desc: 'E, A and D strings, frets 0 to 3.', text: randomMelody(201, ['6:0', '6:1', '6:3', '5:0', '5:2', '5:3', '4:0', '4:2', '4:3'], 32), bpm: 72, pos: 1 });
  L(u, { title: 'G string: G, A', desc: 'Open G, then fret 2 with finger 2.', text: rep('q 3:0 3:2 3:0 3:2 | 3:0 3:2 h 3:0', 4), bpm: 72, pos: 1 });
  L(u, { title: 'B string: B, C, D', desc: 'Open, fret 1 with finger 1, fret 3 with finger 3.', text: rep('q 2:0 2:1 2:3 2:1 | 2:0 2:3 h 2:0', 4), bpm: 72, pos: 1 });
  L(u, { title: 'High e: E, F, G', desc: 'Same shape as the low E string, two octaves up.', text: rep('q 1:0 1:1 1:3 1:1 | 1:0 1:3 h 1:0', 4), bpm: 72, pos: 1 });
  L(u, { title: 'The high strings together', desc: 'G, B and high e, frets 0 to 3.', text: randomMelody(208, ['3:0', '3:2', '2:0', '2:1', '2:3', '1:0', '1:1', '1:3'], 32), bpm: 76, pos: 1 });
  L(u, { title: 'C major scale, first position', desc: 'C on the A string up to C on the B string, then back. Say the note names as you play.',
    text: rep('q 5:3 4:0 4:2 4:3 | 3:0 3:2 2:0 2:1 | 2:0 3:2 3:0 4:3 | 4:2 4:0 h 5:3', 2), bpm: 76, pos: 1 });
  L(u, { title: 'Across all six strings', desc: 'Natural notes in first position, all over the neck.',
    text: randomMelody(210, ['6:0', '6:1', '6:3', '5:0', '5:2', '5:3', '4:0', '4:2', '4:3', '3:0', '3:2', '2:0', '2:1', '2:3', '1:0', '1:1', '1:3'], 40), bpm: 76, pos: 1 });
  const S = (id) => GQ.SONGS.find((s) => s.id === id);
  const songLevel = (unit, id, part, extra) => {
    const s = S(id);
    return L(unit, Object.assign({ title: s.title + (part === 'riff' ? ' (first phrase)' : ''), desc: 'Origin: ' + s.origin + '.', text: s[part], bpm: s.bpm, pos: s.pos,
      meter: s.meter, chords: s.chords, backing: s.backing, song: id, origin: s.origin }, extra || {}));
  };
  songLevel(u, 'au-clair', 'full');
  songLevel(u, 'ode-to-joy', 'riff');

  // ===== 3. Rhythm and picking =====
  u = U(3, 'Rhythm and picking', 'Downstrokes, alternate picking, rests and counting.');
  L(u, { title: 'Quarter-note downstrokes', desc: 'Count "1 2 3 4" and pick down on every count.', text: rep('q 6:0 6:0 6:0 6:0', 12), bpm: 80, backing: 'rock', chords: ['E5'] });
  L(u, { title: 'Eighth notes, alternate picking', desc: 'Down on the number, up on the "and": 1 & 2 & 3 & 4 &.', text: rep('e 5:0 5:0 5:0 5:0 5:0 5:0 5:0 5:0', 8), bpm: 70, backing: 'rock', chords: ['A5'] });
  L(u, { title: 'Rests', desc: 'A rest is silence you count. Stop the string with your fretting hand on each rest.', text: rep('q 6:0 r 6:0 r | 6:0 6:0 r 6:0 | h 5:0 r | q 5:0 5:0 5:0 r', 3), bpm: 76 });
  L(u, { title: 'Half and whole notes', desc: 'Let the long notes ring for their full value.', text: rep('w 4:0 | h 4:2 4:3 | w 4:2 | h 4:0 4:0', 3), bpm: 80 });
  L(u, { title: 'Quarters and eighths', desc: 'Keep your hand moving down-up even when you do not play.', text: rep('q 5:0 e 5:0 5:0 q 5:0 e 5:0 5:0 | q 5:3 5:2 h 5:0', 4), bpm: 76 });
  L(u, { title: 'The gallop', desc: 'Eighth and two sixteenths: "da-da-da da-da-da".', text: rep('e 6:0 s 6:0 6:0 e 6:0 s 6:0 6:0 e 6:0 s 6:0 6:0 q 6:3', 6), bpm: 72, backing: 'rock', chords: ['E5'] });
  L(u, { title: 'String crossing', desc: 'Alternate picking across three strings without looking.', text: rep('e 6:0 5:0 4:0 5:0 6:0 5:0 4:0 5:0', 8), bpm: 72 });
  L(u, { title: 'Dotted rhythms', desc: 'A dotted quarter lasts one and a half beats: "1 (2) & 3 4".', text: rep('q. 5:0 e 5:3 h 5:2 | q. 4:0 e 4:2 h 4:3', 4), bpm: 76 });
  L(u, { title: 'Sixteenth notes', desc: 'Four even notes per beat, strict down-up-down-up.', text: rep('s 4:0 4:0 4:0 4:0 4:0 4:0 4:0 4:0 4:0 4:0 4:0 4:0 q 4:2', 6), bpm: 60 });
  L(u, { title: 'Rhythm challenge', desc: 'Everything from this unit in one line.', text: rep('q 6:0 e 6:0 6:0 q. 5:0 e 5:2 | s 5:3 5:3 5:3 5:3 e 5:2 5:0 h 6:0 | q 4:0 r e 4:2 4:3 q 4:2 | w 5:0', 2), bpm: 72 });

  // ===== 4. Power chords =====
  u = U(4, 'Power chords', 'Two- and three-note shapes that move anywhere on the neck.');
  L(u, { title: 'E5 and A5', desc: 'Open-string power chords: one finger on fret 2 (E5 uses the E and A strings, A5 the A and D strings).', text: rep('h [E5] [E5] | [A5] [A5]', 6), bpm: 80, backing: 'rock' });
  L(u, { title: 'G5 on the low E string', desc: 'Finger 1 on fret 3 of the low E, fingers 3 and 4 two frets higher on the next strings.', text: rep('h [P6:3] [P6:3] | w [E5]', 6), bpm: 80, backing: 'rock' });
  L(u, { title: 'Root on the A string', desc: 'The same shape one string higher: C5 at fret 3, D5 at fret 5.', text: rep('h [P5:3] [P5:3] | [P5:5] [P5:5]', 6), bpm: 80, backing: 'rock' });
  L(u, { title: 'Moving the shape', desc: 'Slide the whole hand, keep the shape frozen.', text: rep('h [P6:1] [P6:3] | [P6:5] [P6:3]', 6), bpm: 80, backing: 'rock' });
  L(u, { title: 'Crossing between strings', desc: 'A5, D5, E5: root on the E string, then the A string.', text: rep('h [P6:5] [P6:5] | [P5:5] [P5:7]', 6), bpm: 84, backing: 'rock' });
  L(u, { title: 'Eighth-note chugs', desc: 'Keep downstrokes even and tight.', text: rep('e [P6:3] d d d d d d d | [P6:5] d d d d d d d', 4), bpm: 90, backing: 'rock' });
  L(u, { title: 'Palm muting', desc: 'Rest the edge of your picking hand on the strings right by the bridge. The note should thud, not ring.', text: rep('e 6:0pm 6:0pm 6:0pm 6:0pm 6:0pm 6:0pm 6:0pm 6:0pm', 8), bpm: 90, backing: 'rock', chords: ['E5'] });
  L(u, { title: 'Muted chugs and accents', desc: 'Palm-muted low E, then open the hand for the chords.', text: rep('e 6:0pm 6:0pm 6:0pm 6:0pm q [P6:3] [P6:5]', 8), bpm: 90, backing: 'rock' });
  L(u, { title: 'Three-chord punk', desc: 'G5, C5, D5: the classic three chords, all downstrokes.', text: rep('e [P6:3] d d d d d d d | [P5:3] d d d d d d d | [P5:5] d d d d d d d | [P6:3] d d d h d', 2), bpm: 110, backing: 'rock' });
  songLevel(u, 'morning-drive', 'full', { title: 'Riff: Morning Drive' });

  // ===== 5. Open chords =====
  u = U(5, 'Open chords', 'The eight essential open chords and changing between them.');
  const chordHold = (name, desc, bpm) => L(u, { title: name + ' chord', desc, text: rep(`w [${name}] | h [${name}] [${name}] | q [${name}] [${name}] [${name}] [${name}]`, 3), bpm: bpm || 70, backing: 'folk' });
  chordHold('Em', 'Fingers 2 and 3 on fret 2 of the A and D strings. Strum all six strings.');
  L(u, { title: 'E and Em', desc: 'Add finger 1 on fret 1 of the G string to turn Em into E.', text: rep('w [Em] | [E] | h [Em] [E] | [Em] [E]', 3), bpm: 70, backing: 'folk' });
  L(u, { title: 'A and Am', desc: 'A: three fingers in a row on fret 2. Am: move finger 1 to fret 1 of the B string. Skip the low E.', text: rep('w [A] | [Am] | h [A] [Am] | [A] [Am]', 3), bpm: 70, backing: 'folk' });
  chordHold('D', 'A small triangle on the top three strings. Strum only four strings, from the D string down.');
  L(u, { title: 'Dm and D', desc: 'Dm: finger 1 moves to fret 1 of the high e.', text: rep('w [D] | [Dm] | h [D] [Dm] | [D] [Dm]', 3), bpm: 70, backing: 'folk' });
  chordHold('G', 'Fingers 2 and 1 on the low strings, finger 3 on fret 3 of the high e. Let all six ring.');
  chordHold('C', 'Fingers 3, 2, 1 walking down from fret 3 of the A string. Skip the low E.');
  L(u, { title: 'Change: Em to G', desc: 'Move as a shape. Aim to arrive on beat 1.', text: rep('h [Em] [Em] | [G] [G]', 8), bpm: 72, backing: 'folk' });
  L(u, { title: 'Change: A to D', desc: 'Finger 3 can slide between the two shapes.', text: rep('h [A] [A] | [D] [D]', 8), bpm: 72, backing: 'folk' });
  L(u, { title: 'Change: C to G', desc: 'Finger 3 leads: it moves from the A string to the low E.', text: rep('h [C] [C] | [G] [G]', 8), bpm: 72, backing: 'folk' });
  L(u, { title: 'G, C, D', desc: 'The most common progression in folk and rock.', text: rep('h [G] [G] | [C] [C] | [D] [D] | [G] [G]', 4), bpm: 76, backing: 'folk' });
  L(u, { title: 'Am, Fmaj7, C, G', desc: 'Fmaj7 is an easy F: the C shape moved over one string, top string open.', text: rep('h [Am] [Am] | [Fmaj7] [Fmaj7] | [C] [C] | [G] [G]', 4), bpm: 76, backing: 'folk' });
  L(u, { title: 'E, A, D', desc: 'I, IV, V in A: the backbone of the blues.', text: rep('h [E] [E] | [A] [A] | [D] [D] | [A] [A]', 4), bpm: 80, backing: 'rock' });
  L(u, { title: 'One-minute changes', desc: 'Two chords, as many clean changes as you can. Chord-change speed is tracked on your progress page.', text: rep('q [Am] [C] [Am] [C] | [G] [D] [G] [D]', 6), bpm: 70, backing: 'folk' });

  // ===== 6. Strumming patterns =====
  u = U(6, 'Strumming patterns', 'From all-downs to syncopation. The arrows show down and up strokes.');
  L(u, { title: 'All downs', desc: 'One down-strum per beat.', text: rep('q [G]d d d d | [C]d d d d | [D]d d d d | [G]d d d d', 3), bpm: 80, backing: 'folk' });
  L(u, { title: 'Down eighths', desc: 'Two downs per beat, relaxed wrist.', text: rep('e [Em]d d d d d d d d | [C]d d d d d d d d', 4), bpm: 76, backing: 'folk' });
  L(u, { title: 'Down-up eighths', desc: 'Down on the beat, up on the "and". The hand never stops.', text: rep('e [G]d u d u d u d u | [D]d u d u d u d u', 4), bpm: 76, backing: 'folk' });
  L(u, { title: 'D, D-U', desc: 'Quarter down, then down-up: "1, 2 &".', text: rep('q [Am]d e d u q d e d u | q [C]d e d u q d e d u', 4), bpm: 80, backing: 'folk' });
  L(u, { title: 'The folk pattern', desc: 'D, D-U, (miss)-U, D-U. Keep swinging the hand on the missed stroke.', text: rep('q [G]d e d u r u d u | q [C]d e d u r u d u', 4), bpm: 80, backing: 'folk' });
  L(u, { title: 'Muted strums', desc: 'x = relax the fretting hand so the strings go dead, and strum: a percussive "chk".', text: rep('q [Am]d x d x | [Em]d x d x', 4), bpm: 84, backing: 'rock' });
  L(u, { title: 'Pattern through G, C, D', desc: 'The folk pattern with chord changes on beat 1.', text: rep('q [G]d e d u r u d u | q [C]d e d u r u d u | q [D]d e d u r u d u | q [G]d e d u r u d u', 2), bpm: 84, backing: 'folk' });
  L(u, { title: 'Syncopation', desc: 'Accent the offbeats: the up-strums carry the groove.', text: rep('e [D]d r d u r u d u | [A]d r d u r u d u', 4), bpm: 80, backing: 'rock' });
  L(u, { title: 'Sixteenth strumming', desc: 'Four strokes per beat, very light.', text: rep('s [Em]d u d u d u d u d u d u d u d u', 4), bpm: 60, backing: 'rock' });
  L(u, { title: 'Am, C, G, D with a pattern', desc: 'Put it all together.', text: rep('q [Am]d e d u r u d u | q [C]d e d u r u d u | q [G]d e d u r u d u | q [D]d e d u r u d u', 2), bpm: 88, backing: 'folk' });

  // ===== 7. Minor pentatonic =====
  u = U(7, 'The minor pentatonic', 'A minor pentatonic: the five boxes and how they join.');
  const pb = { backing: 'blues', chords: ['Am', 'Am', 'Dm', 'Am'] };
  L(u, Object.assign({ title: 'Box 1, ascending', desc: 'Fifth fret, two notes per string. Finger 1 on fret 5, finger 4 (or 3) on fret 8.', text: 'q ' + run(pent(1)) + ' | ' + run(pent(1)), bpm: 70, pos: 5 }, pb));
  L(u, Object.assign({ title: 'Box 1, up and down', desc: 'Alternate picking, eighth notes.', text: 'e ' + barsOfEighths(run(pent(1, 'updown')).split(' ')) + ' ' + barsOfEighths(run(pent(1, 'updown')).split(' ')), bpm: 72, pos: 5 }, pb));
  L(u, Object.assign({ title: 'Box 1 in threes', desc: 'A sequence: three notes up, step back, three notes up.', text: 'e ' + barsOfEighths(run(seq3(pent(1))).split(' ')), bpm: 70, pos: 5 }, pb));
  for (const b of [2, 3, 4, 5]) L(u, Object.assign({ title: `Box ${b}`, desc: `The pentatonic shape starting on the next note of the scale on the low E string.`, text: 'e ' + barsOfEighths(run(pent(b, 'updown')).split(' ')), bpm: 72, pos: pent(b)[0].fret }, pb));
  L(u, Object.assign({ title: 'Joining boxes 1 and 2', desc: 'Slide finger 3 to shift up into box 2.', text: 'e 6:5 6:8 5:5 5:7 4:5 4:7/9 3:7 3:9 | 2:8 2:10 1:8 1:10 1:8 2:10 2:8 3:9 | 3:7 4:9\\7 4:5 5:7 5:5 6:8 q 6:5', bpm: 70, pos: 5 }, pb));
  L(u, Object.assign({ title: 'First blues lick', desc: 'A bend on the G string, then home to the root.', text: rep('e 1:5 1:8 2:8 2:5 q 3:7b2 e 3:5 4:7 | h 4:5~ q 6:5 r', 4), bpm: 76, pos: 5 }, pb));
  L(u, Object.assign({ title: 'Across the neck', desc: 'A run from box 1 up through box 3.', text: 'e ' + barsOfEighths(run(pent(1).slice(0, 6).concat(pent(2).slice(6), pent(3).slice(10))).split(' ')), bpm: 70, pos: 5 }, pb));

  // ===== 8. Riffs =====
  u = U(8, 'Riffs', 'Original riffs in different styles, built from the shapes so far.');
  const riff = (title, desc, text, bpm, backing, chords) => L(u, { title: 'Riff: ' + title, desc: desc + ' Original, written for GuitarQuest.', origin: 'Original, written for GuitarQuest', text, bpm, backing, chords });
  riff('Engine Room', 'Low E pedal with a walk-up.', rep('e 6:0 6:0 6:3 6:0 6:5 6:0 6:3 6:0 | 6:0 6:0 6:3 6:0 6:5 6:6 q 6:7', 4), 96, 'rock', ['E5']);
  songLevel(u, 'shuffle-a', 'riff', { title: 'Riff: Boogie shuffle' });
  riff('Gallop', 'Palm-muted gallop with power-chord stabs.', rep('e 6:0pm s 6:0pm 6:0pm e 6:0pm s 6:0pm 6:0pm q [P6:3] [P6:5] | e 6:0pm s 6:0pm 6:0pm e 6:0pm s 6:0pm 6:0pm h [P6:7]', 3), 90, 'rock');
  riff('Low Groove', 'Funky single notes with dead notes in between.', rep('s 5:7 5:x 5:7 5:x e 5:10 5:7 s 4:9 4:x 4:9 4:x e 5:7 r', 4), 84, 'rock', ['Am']);
  riff('Surf Line', 'Fast alternate picking on one string.', rep('s 1:0 1:0 1:0 1:0 1:3 1:3 1:3 1:3 1:5 1:5 1:5 1:5 1:3 1:3 1:3 1:3', 4), 80, 'rock', ['E']);
  riff('Campfire', 'Picked arpeggios over C and G.', rep('e 5:3 4:2 3:0 2:1 3:0 4:2 5:3 4:2 | 6:3 5:2 4:0 3:0 2:0 3:0 4:0 5:2', 4), 80, 'folk');
  riff('Stomp', 'Pentatonic riff on the low strings.', rep('e 5:0 5:3 4:0 4:2 5:3 5:0 q 6:3 | e 5:0 5:3 4:0 4:2 4:0 5:3 q 5:0', 4), 92, 'rock', ['A5']);
  songLevel(u, 'desert-road', 'riff', { title: 'Riff: Desert Road' });

  // ===== 9. Barre chords =====
  u = U(9, 'Barre chords', 'One finger across all the strings: the E shape and the A shape.');
  L(u, { title: 'The F barre', desc: 'Finger 1 flat across fret 1, then the E shape with fingers 2, 3, 4. Check each string rings.', text: rep('w [F] | h [F] [F] | q [F] [F] [F] [F] | w [C]', 3), bpm: 66, backing: 'folk' });
  L(u, { title: 'E shape up the neck', desc: 'The F shape moved to fret 3 is G, to fret 5 is A.', text: rep('h [F] [F] | [G@E] [G@E] | [A@E] [A@E] | [G@E] [G@E]', 3), bpm: 70, backing: 'rock' });
  L(u, { title: 'E-shape minor', desc: 'Lift finger 2: F#m at fret 2, Gm at fret 3.', text: rep('h [F#m] [F#m] | [Gm] [Gm] | [Am@E] [Am@E] | [Gm] [Gm]', 3), bpm: 70, backing: 'rock' });
  L(u, { title: 'A-shape minor: Bm', desc: 'Barre fret 2 from the A string; the Am shape moved up two frets.', text: rep('w [Bm] | h [Bm] [Bm] | [Bm] [D] | w [Bm]', 3), bpm: 70, backing: 'folk' });
  L(u, { title: 'A-shape major', desc: 'B at fret 2, C at fret 3. Try a ring-finger barre for the three middle strings.', text: rep('h [B] [B] | [C@A] [C@A] | [D@A] [D@A] | [C@A] [C@A]', 3), bpm: 70, backing: 'rock' });
  L(u, { title: 'F, C, G', desc: 'Barre and open chords together.', text: rep('h [F] [F] | [C] [C] | [G] [G] | [C] [C]', 4), bpm: 72, backing: 'folk' });
  L(u, { title: 'Bm, G, D, A', desc: 'A common pop progression with one barre.', text: rep('h [Bm] [Bm] | [G] [G] | [D] [D] | [A] [A]', 4), bpm: 76, backing: 'rock' });
  L(u, { title: 'Moving barres: I vi IV V', desc: 'G, Em, C, D, all as barre chords.', text: rep('h [G@E] [G@E] | [Em@A] [Em@A] | [C@A] [C@A] | [D@A] [D@A]', 4), bpm: 76, backing: 'rock' });

  // ===== 10. Major scale and CAGED =====
  u = U(10, 'Major scale and CAGED', 'Scale shapes, then the five shapes of one chord.');
  L(u, { title: 'G major, open position', desc: 'Two octaves from the low G.', text: 'q G2 A2 B2 C3 | D3 E3 F#3 G3 | A3 B3 C4 D4 | E4 F#4 h G4 | q F#4 E4 D4 C4 | B3 A3 G3 F#3 | E3 D3 C3 B2 | A2 h. G2', bpm: 76, pos: 0 });
  L(u, { title: 'C major, three notes per string', desc: 'From C at fret 8 of the low E.', text: 'e ' + barsOfEighths(run(T.npsPattern(0, 'major', 0, 3, 8, STD)).split(' ')), bpm: 70 });
  L(u, { title: 'G major, three notes per string', desc: 'From G at fret 3. Keep your thumb behind the neck.', text: 'e ' + barsOfEighths(run(T.npsPattern(7, 'major', 0, 3, 3, STD)).split(' ')), bpm: 70 });
  L(u, { title: 'CAGED: the five C shapes', desc: 'C played as a C shape, A shape (fret 3), G shape (fret 5), E shape (fret 8) and D shape (fret 10).', text: rep('w [C@C] | [C@A] | [C@G] | [C@E] | [C@D]', 2), bpm: 60, backing: 'folk' });
  L(u, { title: 'C major in fifth position', desc: 'The scale inside frets 5 to 8, the same place as the A shape.', text: 'q C3 D3 E3 F3 | G3 A3 B3 C4 | D4 E4 F4 G4 | h A4 G4 | q F4 E4 D4 C4 | B3 A3 G3 F3 | E3 D3 h C3', bpm: 72, pos: 5 });
  L(u, { title: 'Through the changes', desc: 'Target the chord tones of C, Am, F and G.', text: 'q C4 E4 G4 E4 | A3 C4 E4 C4 | F3 A3 C4 A3 | G3 B3 D4 B3 | C4 E4 G4 E4 | A3 C4 E4 C4 | F3 A3 C4 D4 | w C4', bpm: 76, pos: 0, chords: ['C', 'Am', 'F', 'G'], backing: 'folk' });
  L(u, { title: 'Scale in thirds', desc: 'C D E: play C-E, D-F, E-G and so on.', text: 'e C3 E3 D3 F3 E3 G3 F3 A3 | G3 B3 A3 C4 B3 D4 C4 E4 | D4 F4 E4 G4 F4 D4 E4 C4 | D4 B3 C4 A3 q C4 r', bpm: 70, pos: 0 });
  L(u, { title: 'Scale in fours', desc: 'Groups of four notes stepping up the scale.', text: 'e C3 D3 E3 F3 D3 E3 F3 G3 | E3 F3 G3 A3 F3 G3 A3 B3 | G3 A3 B3 C4 A3 B3 C4 D4 | B3 C4 D4 E4 q C4 r', bpm: 70, pos: 0 });

  // ===== 11. Techniques =====
  u = U(11, 'Techniques', 'Hammer-ons, pull-offs, slides, bends and vibrato (continuous pitch tracking).');
  L(u, { title: 'Hammer-ons', desc: 'Pick fret 5, then hammer finger 3 onto fret 7 without picking again.', text: rep('q 3:5h7 3:5h7 4:5h7 4:5h7 | 2:5h7 2:5h7 h 3:7', 4), bpm: 66, pos: 5 });
  L(u, { title: 'Pull-offs', desc: 'Pick fret 7, then flick finger 3 off sideways to sound fret 5.', text: rep('q 3:7p5 3:7p5 4:7p5 4:7p5 | 2:8p5 2:8p5 h 3:5', 4), bpm: 66, pos: 5 });
  L(u, { title: 'Trills', desc: 'Hammer and pull in a row, one pick stroke per beat.', text: rep('q 3:5h7 3:7p5 3:5h7 3:7p5 | 2:5h8 2:8p5 2:5h8 2:8p5', 4), bpm: 70, pos: 5 });
  L(u, { title: 'Slides', desc: 'Keep pressure on the string as you slide: up two frets, back down.', text: rep('q 3:5/7 3:7\\5 4:5/7 4:7\\5 | 2:5/8 2:8\\5 h 3:7', 4), bpm: 66, pos: 5 });
  L(u, { title: 'Half-step bends', desc: 'Push the string up until the pitch rises one fret. The app shows how close you got.', text: rep('h 2:8b1 q 2:8 2:5 | h 3:7b1 q 3:7 3:5', 4), bpm: 66, pos: 5, backing: 'blues', chords: ['Am'] });
  L(u, { title: 'Whole-step bends', desc: 'Bend with three fingers together until it matches the note two frets up.', text: rep('h 3:7b2 q 3:9 3:7 | h 2:8b2 q 2:10 2:8', 4), bpm: 66, pos: 7, backing: 'blues', chords: ['Am'] });
  L(u, { title: 'Vibrato', desc: 'Small, even bends back and forth while the note rings.', text: rep('w 2:5~ | 3:7~ | 1:5~ | 2:8~', 3), bpm: 66, pos: 5, backing: 'blues', chords: ['Am'] });
  L(u, { title: 'String skipping', desc: 'Skip a string with the pick without touching the one in between.', text: rep('e 6:5 4:7 5:7 3:7 4:7 2:8 3:7 1:8', 6), bpm: 70, pos: 5 });
  L(u, { title: 'Legato pentatonic', desc: 'One pick stroke per string; hammer the second note.', text: 'q 6:5h8 5:5h7 4:5h7 3:5h7 | 2:5h8 1:5h8 1:5 1:8 | 1:8p5 2:8p5 3:7p5 4:7p5 | 5:7p5 6:8p5 h 6:5', bpm: 66, pos: 5 });
  L(u, { title: 'Technique mash-up', desc: 'Slide, bend, pull-off and vibrato in one phrase.', text: rep('e 3:5/7 3:7 h 2:8b2 e 2:8p5 3:7 | h 3:5~ q 5:7 r', 4), bpm: 70, pos: 5, backing: 'blues', chords: ['Am'] });

  // ===== 12. Speed and accuracy =====
  u = U(12, 'Speed and accuracy', 'Metronome ladders: the tempo rises each time a pass is clean.');
  const ladder = (title, desc, text, from, to) => L(u, { title, desc: desc + ` The loop starts at ${from} BPM and speeds up after every clean pass, up to ${to}.`, text, bpm: to, ladder: { from, to }, pos: 1 });
  ladder('Chromatic 1-2-3-4', 'One finger per fret on every string.', 'e 6:1 6:2 6:3 6:4 5:1 5:2 5:3 5:4 | 4:1 4:2 4:3 4:4 3:1 3:2 3:3 3:4 | 2:1 2:2 2:3 2:4 1:1 1:2 1:3 1:4', 60, 100);
  ladder('Spider walk', 'Fingers 1-3 then 2-4 across strings.', 'e 6:1 5:3 6:2 5:4 5:1 4:3 5:2 4:4 | 4:1 3:3 4:2 3:4 3:1 2:3 3:2 2:4', 56, 96);
  ladder('Pentatonic run', 'Box 1 up and down.', 'e ' + barsOfEighths(run(pent(1, 'updown')).split(' ')), 70, 120);
  ladder('Tremolo on one string', 'Alternate picking, four notes per fret.', 's 1:5 1:5 1:5 1:5 1:7 1:7 1:7 1:7 1:8 1:8 1:8 1:8 1:7 1:7 1:7 1:7', 60, 110);
  ladder('Arpeggio crossing', 'Picked Am arpeggio, alternate picking.', 'e 5:0 4:2 3:2 2:1 1:0 2:1 3:2 4:2', 70, 130);
  ladder('Scale bursts', 'C major in sixteenths, then rest.', 's 5:3 4:0 4:2 4:3 3:0 3:2 2:0 2:1 q 2:0 r', 50, 90);
  ladder('Chord change ladder', 'G to C to D, one strum each.', 'q [G] [C] [D] [G]', 60, 120);
  ladder('Picking accuracy', 'String crossing sixteenths.', 's 6:0 5:2 4:2 5:2 6:0 5:2 4:2 5:2 5:0 4:2 3:2 4:2 5:0 4:2 3:2 4:2', 50, 90);

  // ===== 13. Reading =====
  u = U(13, 'Reading', 'Tablature, then standard notation, then sight-reading new music.');
  L(u, { title: 'Reading tab', desc: 'Each line is a string (high e at the top), each number a fret. The fretboard is hidden: read the tab.', text: rep('q 1:0 1:1 1:3 1:1 | 2:0 2:1 2:3 2:1 | 3:0 3:2 2:0 2:1 | h 1:0 1:3', 2), bpm: 72, views: { fretboard: false, highway: false, tab: true, staff: false } });
  L(u, { title: 'Tab with rhythm', desc: 'The stems under the tab show the rhythm: no stem = whole, short = half, flags = eighths.', text: rep('q 5:3 e 4:0 4:2 h 4:3 | e 3:0 3:2 q 2:0 h 2:1', 3), bpm: 72, views: { fretboard: false, highway: false, tab: true, staff: false } });
  L(u, { title: 'Notation: E, F, G on top', desc: 'Guitar music is written an octave above how it sounds. The top space is E, the top line F.', text: rep('q E4 F4 G4 F4 | E4 G4 h E4', 4), bpm: 70, pos: 0, views: { fretboard: false, highway: false, tab: false, staff: true } });
  L(u, { title: 'Notation: B, C, D', desc: 'Middle line B (open B string), then C and D.', text: rep('q B3 C4 D4 C4 | B3 D4 h B3', 4), bpm: 70, pos: 0, views: { fretboard: false, highway: false, tab: false, staff: true } });
  L(u, { title: 'Notation: G and A', desc: 'G on the second line, A in the second space.', text: rep('q G3 A3 B3 A3 | G3 B3 h G3', 4), bpm: 70, pos: 0, views: { fretboard: false, highway: false, tab: false, staff: true } });
  L(u, { title: 'Notation: ledger lines', desc: 'The low strings sit below the staff on short ledger lines.', text: rep('q E2 F2 G2 A2 | B2 C3 D3 E3 | F3 E3 D3 C3 | B2 A2 h E2', 2), bpm: 70, pos: 0, views: { fretboard: false, highway: false, tab: false, staff: true } });
  const pool = ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4'];
  L(u, { title: 'Sight-reading 1', desc: 'New notes you have not practised. Notation only.', text: randomMelody(1301, pool, 24), bpm: 66, pos: 0, views: { fretboard: false, highway: false, tab: false, staff: true } });
  L(u, { title: 'Sight-reading 2', desc: 'New notes and rhythms. Notation only.', text: rhythmMelody(1302, pool, 8) + ' | w C3', bpm: 66, pos: 0, views: { fretboard: false, highway: false, tab: false, staff: true } });

  // ===== 14. Songs =====
  u = U(14, 'Songs', 'Traditional, public-domain and original pieces. Pick riff or full song in the library.');
  for (const s of GQ.SONGS.slice().sort((a, b) => a.difficulty - b.difficulty)) songLevel(u, s.id, 'full');

  // ---------- extra levels (curriculum-extra.js), appended so existing level ids never change ----------
  if (GQ.addExtraLevels) GQ.addExtraLevels({ units, L, rep, run, pent, seq3, randomMelody, rhythmMelody, barsOfEighths, T, STD });

  // ---------- index ----------
  const C = (GQ.curriculum = { units, levels: [] });
  for (const un of units) for (const lv of un.levels) C.levels.push(lv);
  C.byId = (id) => C.levels.find((l) => l.id === id);
  C.next = (id) => { const i = C.levels.findIndex((l) => l.id === id); return i >= 0 ? C.levels[i + 1] || null : null; };
  C.songLevel = function (songId, part) {
    const s = GQ.SONGS.find((x) => x.id === songId);
    if (!s) return null;
    return { id: 'song-' + songId + '-' + part, unit: 14, title: s.title + (part === 'riff' ? ' (riff)' : ''), desc: 'Origin: ' + s.origin + '.', text: s[part],
      bpm: s.bpm, pos: s.pos, meter: s.meter || [4, 4], chords: s.chords, backing: s.backing, song: s.id, origin: s.origin };
  };
})(typeof window !== 'undefined' ? window : globalThis);
