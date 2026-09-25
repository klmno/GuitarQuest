/* GuitarQuest: 10 more levels for each of units 3 to 13. They are appended after the original
 * levels, so saved progress (keyed by level id) is unaffected. All riffs and licks are original. */
(function (G) {
  'use strict';
  const GQ = G.GQ;

  GQ.addExtraLevels = function (H) {
    const { units, L, rep, run, pent, seq3, randomMelody, barsOfEighths, T, STD } = H;
    const U = (id) => units.find((u) => u.id === id);
    const add = (id, list) => { const u = U(id); for (const o of list) L(u, o); };
    const eighths = (notes) => 'e ' + barsOfEighths(notes.split(' '));
    const box = (n, dir) => run(pent(n, dir));
    const blues = { backing: 'blues', chords: ['Am', 'Am', 'Dm', 'Am'] };
    const reading = { views: { fretboard: false, highway: false, tab: false, staff: true } };

    // ===== 3. Rhythm and picking =====
    add(3, [
      { title: 'Shuffle feel', desc: 'Long-short, long-short: a dotted eighth and a sixteenth. The heart of blues and rock and roll.', text: rep('e. 5:0 s 5:0 e. 5:0 s 5:0 e. 5:2 s 5:2 e. 5:0 s 5:0', 8), bpm: 72, backing: 'blues', chords: ['A'] },
      { title: 'Offbeat eighths', desc: 'Play only on the "and": 1 AND 2 AND. Keep your hand moving down-up so the notes land on upstrokes.', text: rep('e r 5:0 r 5:0 r 5:0 r 5:0', 8), bpm: 72, backing: 'rock', chords: ['A5'] },
      { title: 'Two-string rock pattern', desc: 'Low E and A strings, a driving eighth-note pattern.', text: rep('e 6:0 6:0 5:0 5:0 6:0 6:0 5:2 5:0', 8), bpm: 88, backing: 'rock', chords: ['E5'] },
      { title: 'Palm-muted eighths on A', desc: 'Keep the palm mute even while you cross to the D string.', text: rep('e 5:0pm 5:0pm 5:0pm 5:0pm 4:0pm 4:0pm 5:0pm 5:0pm', 8), bpm: 92, backing: 'rock', chords: ['A5'] },
      { title: 'Sixteenth bursts', desc: 'A quarter note, then a quick burst of four. Relax between bursts.', text: rep('q 6:0 s 6:0 6:0 6:0 6:0 q 5:0 s 5:0 5:0 5:0 5:0', 6), bpm: 66, backing: 'rock', chords: ['E5'] },
      { title: 'Syncopated riff', desc: 'Notes that fall between the beats. Count out loud.', text: rep('e 6:0 r 6:0 6:3 r 6:0 q 6:5 | e 6:0 r 6:0 6:3 r 6:5 q 6:3', 4), bpm: 84, backing: 'rock', chords: ['E5'] },
      { title: 'Rest counting challenge', desc: 'Rests on different beats every bar. Silence the string on each rest.', text: rep('q 5:0 r 5:0 5:0 | r 5:0 r 5:0 | 5:0 5:0 r r | e 5:0 5:0 q r 5:0 r', 3), bpm: 80 },
      { title: 'Dotted-quarter groove', desc: 'Dotted quarter plus eighth, across three strings.', text: rep('q. 6:0 e 5:0 q. 4:0 e 5:0 | q. 6:3 e 5:2 h 4:0', 4), bpm: 80, backing: 'folk', chords: ['E', 'G'] },
      { title: 'Galloping strings', desc: 'The gallop rhythm moving across the low strings.', text: rep('e 6:0 s 6:0 6:0 e 5:0 s 5:0 5:0 e 4:0 s 4:0 4:0 e 5:0 s 5:0 5:0', 6), bpm: 76, backing: 'rock', chords: ['E5'] },
      { title: 'Rhythm workout', desc: 'Quarters, eighths, sixteenths, dots and rests in one line at a brisk tempo.', text: rep('q 6:0 e 6:0 6:0 s 5:0 5:0 5:0 5:0 q 5:2 | q. 4:0 e 4:2 e 5:0 r q 6:0', 4), bpm: 96, backing: 'rock', chords: ['E5'] },
    ]);

    // ===== 4. Power chords =====
    add(4, [
      { title: 'Power ballad', desc: 'Long, ringing power chords: let each one sustain for the full two beats.', text: rep('h [P6:5] [P6:3] | [P5:3] [P5:5]', 6), bpm: 70, backing: 'rock' },
      { title: 'Chromatic climb', desc: 'Up one fret at a time, keeping the shape locked.', text: rep('q [P6:1] [P6:2] [P6:3] [P6:4] | [P6:5] [P6:4] [P6:3] [P6:2]', 4), bpm: 80, backing: 'rock' },
      { title: 'I, bVII, IV', desc: 'A5, G5, D5: a classic rock move.', text: rep('e [P6:5] d d d d d d d | [P6:3] d d d [P5:5] d d d', 4), bpm: 100, backing: 'rock' },
      { title: 'Octave shapes', desc: 'Two notes an octave apart, skipping a string. Mute the string in between with your first finger.', text: rep('q 6:5+4:7 6:5+4:7 6:3+4:5 6:3+4:5 | 6:7+4:9 6:7+4:9 h 6:5+4:7', 4), bpm: 80, backing: 'rock', chords: ['A5', 'G5', 'B5', 'A5'] },
      { title: 'Minor punk', desc: 'E5, G5, A5, C5 with fast downstrokes.', text: rep('e [E5] d d d [P6:3] d d d | [P6:5] d d d [P5:3] d d d', 4), bpm: 120, backing: 'rock' },
      { title: 'Stop time', desc: 'Hit the chord, then silence. Lift the fretting hand slightly to stop the ring.', text: rep('q [P6:5] r r r | [P6:3] r [P6:5] r', 6), bpm: 96, backing: 'rock' },
      { title: 'Accented chugs', desc: 'Palm-muted chugs, open accents on the chord hits.', text: rep('e 6:0pm 6:0pm [P6:3] 6:0pm 6:0pm [P6:5] 6:0pm 6:0pm', 8), bpm: 100, backing: 'rock' },
      { title: 'Power chords in 3/4', desc: 'A heavy waltz: one strum per beat, accent beat 1.', text: rep('q [P6:5] d d | [P6:3] d d | [P5:5] d d | [P6:5] d d', 4), bpm: 96, meter: [3, 4], backing: 'rock' },
      { title: 'Open and moving', desc: 'Mix the open E5 with moving shapes.', text: rep('e [E5] d [P6:3] d [E5] d [P6:5] d | [E5] d [P6:7] d [P6:5] d [P6:3] d', 4), bpm: 104, backing: 'rock' },
      { title: 'Riff: Iron Gate', desc: 'A galloping metal riff. Original, written for GuitarQuest.', text: rep('e 6:0pm s 6:0pm 6:0pm e 6:0pm s 6:0pm 6:0pm q [P6:3] [P6:5] | e 6:0pm s 6:0pm 6:0pm e 6:0pm s 6:0pm 6:0pm q [P6:6] [P6:5]', 3), bpm: 96, backing: 'rock' },
    ]);

    // ===== 5. Open chords =====
    add(5, [
      { title: 'Asus2 and Asus4', desc: 'Decorate an A chord by lifting or adding one finger.', text: rep('q [A] [Asus2] [A] [Asus4] | h [A] [A]', 4), bpm: 72, backing: 'folk' },
      { title: 'Dsus2 and Dsus4', desc: 'The same trick on D: lift finger 2, or add finger 4.', text: rep('q [D] [Dsus2] [D] [Dsus4] | h [D] [D]', 4), bpm: 72, backing: 'folk' },
      { title: 'Cadd9 and Em7', desc: 'Two open-sounding chords that share fingers 3 and 4.', text: rep('h [Cadd9] [Cadd9] | [Em7] [Em7]', 6), bpm: 72, backing: 'folk' },
      { title: 'The pop progression', desc: 'G, D, Em, C: thousands of songs use these four chords.', text: rep('h [G] [G] | [D] [D] | [Em] [Em] | [C] [C]', 4), bpm: 80, backing: 'rock' },
      { title: 'C, Am, Fmaj7, G', desc: 'A gentle 50s-style progression.', text: rep('h [C] [C] | [Am] [Am] | [Fmaj7] [Fmaj7] | [G] [G]', 4), bpm: 80, backing: 'folk' },
      { title: 'Seventh chords: A7, D7, E7', desc: 'Bluesy dominant sevenths. Each is a small change from a chord you know.', text: rep('h [A7] [A7] | [D7] [D7] | [A7] [A7] | [E7] [E7]', 4), bpm: 80, backing: 'blues' },
      { title: 'E and B7', desc: 'The classic folk and blues change. B7 uses all four fingers.', text: rep('h [E] [E] | [B7] [B7]', 8), bpm: 72, backing: 'folk' },
      { title: 'Minor mood: Am, Dm, E', desc: 'A minor-key progression with a strong pull back to Am.', text: rep('h [Am] [Am] | [Dm] [Dm] | [E] [E] | [Am] [Am]', 4), bpm: 76, backing: 'folk' },
      { title: 'Folk rock: G, Cadd9, Dsus4', desc: 'Keep fingers 3 and 4 anchored on the top strings for all three chords.', text: rep('h [G] [G] | [Cadd9] [Cadd9] | [Dsus4] [D] | [G] [G]', 4), bpm: 84, backing: 'folk' },
      { title: 'Chord marathon', desc: 'Every open chord from this unit, one bar each.', text: rep('h [E] [Em] | [A] [Am] | [D] [Dm] | [G] [C]', 3), bpm: 72, backing: 'folk' },
    ]);

    // ===== 6. Strumming patterns =====
    add(6, [
      { title: 'Island strum', desc: 'D, D-U, U-D-U: bright and bouncy.', text: rep('q [C]d e d u r u d u | q [G]d e d u r u d u', 4), bpm: 88, backing: 'folk' },
      { title: 'Waltz strum', desc: 'Three beats per bar: strong bass-strum, then two lighter strums.', text: rep('q [G]d d d | [C]d d d | [D]d d d | [G]d d d', 4), bpm: 96, meter: [3, 4], backing: 'folk' },
      { title: '6/8 strum', desc: 'Two groups of three eighths: DOWN up down, DOWN up down.', text: rep('e [Am]d u d d u d | [F]d u d d u d', 4).replace(/\[F\]/g, '[Fmaj7]'), bpm: 64, meter: [6, 8], backing: 'none' },
      { title: 'Backbeat mutes', desc: 'Strum on 1 and 3, a muted "chk" on 2 and 4.', text: rep('q [G]d x d x | [C]d x d x | [D]d x d x | [G]d x d x', 3), bpm: 90, backing: 'rock' },
      { title: 'Pop strum: G, D, Em, C', desc: 'The folk pattern over the pop progression.', text: rep('q [G]d e d u r u d u | q [D]d e d u r u d u | q [Em]d e d u r u d u | q [C]d e d u r u d u', 2), bpm: 92, backing: 'rock' },
      { title: 'Changing on the "and"', desc: 'The next chord arrives half a beat early: move your hand during the up-strum.', text: rep('e [G]d u d u d u d [C]u | e d u d u d u d [G]u', 4), bpm: 76, backing: 'folk' },
      { title: 'The push', desc: 'Anticipate beat 1 with an up-strum on the "and" of 4, and let it ring.', text: rep('q [D]d d d e d [A]u | h d q d d', 4), bpm: 84, backing: 'rock' },
      { title: 'Funky sixteenths with mutes', desc: 'Sixteenth strumming with muted strums on the offbeats.', text: rep('s [Em7]d x x u x u d x d x x u x u d x', 4), bpm: 70, backing: 'rock' },
      { title: 'Sus chords in the pattern', desc: 'Hammer the sus finger on and off while you strum.', text: rep('q [D]d e d u r [Dsus4]u [D]d u | q [A]d e d u r [Asus4]u [A]d u', 4), bpm: 84, backing: 'folk' },
      { title: 'Strumming ladder', desc: 'Down-up eighths through G, C, D. The loop speeds up after each clean pass.', text: 'e [G]d u d u d u d u | [C]d u d u d u d u | [D]d u d u d u d u | [G]d u d u d u d u', bpm: 130, ladder: { from: 80, to: 130 } },
    ]);

    // ===== 7. Minor pentatonic =====
    const eMinorOpen = '6:0 6:3 5:0 5:2 4:0 4:2 3:0 3:2 2:0 2:3 1:0 1:3';
    const aBlues = '6:5 6:8 5:5 5:6 5:7 4:5 4:7 3:5 3:7 3:8 2:5 2:8 1:5 1:8';
    add(7, [
      { title: 'E minor pentatonic, open position', desc: 'The same shape as box 1, using open strings. Great for low, heavy licks.', text: eighths(eMinorOpen + ' ' + eMinorOpen.split(' ').reverse().slice(1).join(' ')), bpm: 76, pos: 0, backing: 'blues', chords: ['Em'] },
      { title: 'The A blues scale', desc: 'Box 1 plus one "blue" note: fret 6 on the A string, fret 8 on the G string.', text: eighths(aBlues + ' ' + aBlues.split(' ').reverse().slice(1).join(' ')), bpm: 70, pos: 5, ...blues },
      { title: 'Box 1 in fours', desc: 'Four notes up, step back three, four notes up: a classic speed-builder.', text: 'e ' + barsOfEighths(pent(1).flatMap((_, i, a) => (i + 3 < a.length ? a.slice(i, i + 4) : [])).map((n) => n.string + ':' + n.fret)), bpm: 66, pos: 5, ...blues },
      { title: 'Box 1 descending in threes', desc: 'The threes sequence, coming down.', text: 'e ' + barsOfEighths(run(seq3(pent(1, 'down'))).split(' ')), bpm: 66, pos: 5, ...blues },
      { title: 'Lick: call and response', desc: 'A question on the high strings, an answer on the low strings.', text: rep('e 1:8 1:5 2:8 2:5 q 1:5 r | e 4:7 4:5 5:7 5:5 q 6:5 r', 4), bpm: 76, pos: 5, ...blues },
      { title: 'Lick: repeating rock phrase', desc: 'A three-note pattern that repeats across the beat.', text: rep('e 1:8 1:5 2:8 1:8 1:5 2:8 1:8 1:5 | 2:8 2:5 3:7 2:8 2:5 3:7 q 3:5', 4), bpm: 72, pos: 5, ...blues },
      { title: 'Box 2 lick with a bend', desc: 'Up in box 2, bend the B string at fret 10.', text: rep('e 3:9 2:8 2:10 1:8 q 2:10b2 e 2:8 3:9 | h 3:7~ q 4:10 r', 4), bpm: 72, pos: 7, ...blues },
      { title: 'String skipping in box 1', desc: 'Skip a string on every pair.', text: rep('e 6:5 4:5 5:5 3:5 4:5 2:5 3:5 1:5 | 1:8 3:7 2:8 4:7 3:7 5:7 4:7 6:8', 4), bpm: 70, pos: 5, ...blues },
      { title: 'The major pentatonic', desc: 'The same notes as A minor pentatonic, but home is C. Start and end on C.', text: eighths('5:3 5:5 4:2 4:5 3:2 3:5 2:3 2:5 1:3 1:5 1:3 2:5 2:3 3:5 3:2 4:5 4:2 5:5 5:3'), bpm: 72, pos: 2, backing: 'folk', chords: ['C', 'Am', 'F', 'G'] },
      { title: 'Double-stop bends', desc: 'Bend the G string while holding the B string: a classic rock sound.', text: rep('q 3:7b2 3:7b2 e 2:5 3:7 q 3:5 | h 4:7~ q 3:7b2 r', 4), bpm: 70, pos: 5, ...blues },
    ]);

    // ===== 8. Riffs =====
    const riff = (title, desc, text, bpm, backing, chords, extra) => Object.assign({ title: 'Riff: ' + title, desc: desc + ' Original, written for GuitarQuest.', origin: 'Original, written for GuitarQuest', text, bpm, backing, chords }, extra || {});
    add(8, [
      riff('Tidewater', 'Surf-style melody with slides on the B string.', rep('e 2:5 2:5 2:5/8 2:8 2:8\\5 2:5 1:5 1:8 | 1:5 2:8 2:5 3:7 q 3:5 3:5', 4), 88, 'rock', ['Am']),
      riff('Porch Swing', 'Country alternating bass: pick the bass note, then the chord.', rep('q 5:3 [C] 4:2 [C] | 6:3 [G] 4:0 [G]', 4), 96, 'folk'),
      riff('Neon Drive', 'Eighth notes on the A string with an octave jump.', rep('e 5:0 5:0 3:2 5:0 5:0 3:2 5:0 3:2 | 5:3 5:3 3:5 5:3 5:2 5:2 3:4 5:2', 4), 104, 'rock', ['A5', 'C5']),
      riff('Delta Walk', 'A blues turnaround in E, walking down the G string.', rep('e 1:0 3:4 1:0 3:3 1:0 3:2 1:0 3:1 | q 6:0 5:2 4:2 r', 4), 76, 'blues', ['E7']),
      riff('Arpeggio Rain', 'Picked arpeggios through Am, F, C and G.', rep('e 5:0 4:2 3:2 2:1 4:3 3:2 2:1 1:1 | 5:3 4:2 3:0 2:1 6:3 5:2 4:0 3:0', 4), 80, 'none'),
      riff('Garage Stomp', 'Low, loose and loud: open E with bends on the A string.', rep('e 6:0 6:0 5:2b1 6:0 6:0 5:2 6:3 6:0 | 6:0 6:0 5:2b1 6:0 q 6:3 6:5', 4), 92, 'rock', ['E5']),
      riff('Offbeat Skank', 'Reggae-style chord stabs on the offbeats with muted strums between.', rep('e r [Am]u r u r u r u | r [Dm]u r u r u r u', 4), 80, 'rock'),
      riff('Low Rider', 'A slinky single-note riff in A with a slide.', rep('e 5:0 5:3 5:5 5:3/5 5:5 5:3 q 6:5 | e 5:0 5:3 5:5 6:5 6:3 6:5 q 5:0', 4), 88, 'rock', ['A5']),
      riff('Cathedral', 'Ringing open strings against moving notes on the G string.', rep('e 3:2 2:0 1:0 2:0 3:4 2:0 1:0 2:0 | 3:5 2:0 1:0 2:0 3:4 2:0 1:0 2:0', 4), 84, 'none'),
      riff('Victory Lap', 'Power chords and a pentatonic tail: everything from units 4 and 7.', rep('e [P6:5] d d d [P6:3] d [P6:5] d | 1:8 1:5 2:8 2:5 3:7 3:5 q 4:7', 3), 100, 'rock'),
    ]);

    // ===== 9. Barre chords =====
    add(9, [
      { title: 'F, Bb and C', desc: 'The A-shape barre for Bb between two familiar chords.', text: rep('h [F] [F] | [Bb] [Bb] | [C] [C] | [F] [F]', 4), bpm: 70, backing: 'folk' },
      { title: 'Cm and Fm', desc: 'Minor barre chords in both shapes.', text: rep('h [Cm] [Cm] | [Fm] [Fm] | [Cm] [Cm] | [Gm] [Gm]', 4), bpm: 70, backing: 'rock' },
      { title: 'E-shape sevenths', desc: 'A7, B7 and C7 as barre chords: lift finger 4 from the major shape.', text: rep('h [A7@E] [A7@E] | [B7@E] [B7@E] | [C7@E] [C7@E] | [A7@E] [A7@E]', 4), bpm: 76, backing: 'blues' },
      { title: 'A-shape minor sevenths', desc: 'Bm7, C#m7 and Dm7: soft, jazzy colours.', text: rep('h [Bm7@A] [Bm7@A] | [C#m7@A] [C#m7@A] | [Dm7@A] [Dm7@A] | [C#m7@A] [C#m7@A]', 4), bpm: 72, backing: 'folk' },
      { title: 'Barre ballad', desc: 'Slow changes: check every string rings before you move.', text: rep('w [F] | [Dm@A] | [Bb] | [C@A]', 4), bpm: 60, backing: 'folk' },
      { title: 'I, IV, V in B', desc: 'B, E and F#, all as barre chords.', text: rep('h [B] [B] | [E@A] [E@A] | [F#@E] [F#@E] | [B] [B]', 4), bpm: 76, backing: 'rock' },
      { title: 'Minor progression up the neck', desc: 'Am, Dm and Em as barre chords.', text: rep('h [Am@E] [Am@E] | [Dm@A] [Dm@A] | [Em@A] [Em@A] | [Am@E] [Am@E]', 4), bpm: 76, backing: 'rock' },
      { title: 'ii, V, I', desc: 'Dm7, G7, Cmaj7: the most common jazz progression.', text: rep('h [Dm7@A] [Dm7@A] | [G7@E] [G7@E] | w [Cmaj7] | [Cmaj7]', 4), bpm: 72, backing: 'folk' },
      { title: 'Funk stabs', desc: 'Short E-shape seventh stabs with muted strums.', text: rep('s [A7@E]d x x u x x d x x u x x d x u x', 4), bpm: 76, backing: 'rock' },
      { title: 'Barre change ladder', desc: 'F to Bb to C, one strum each. The loop speeds up after each clean pass.', text: 'q [F] [Bb] [C] [F]', bpm: 110, ladder: { from: 60, to: 110 } },
    ]);

    // ===== 10. Major scale and CAGED =====
    add(10, [
      { title: 'A major, three notes per string', desc: 'From A at fret 5 of the low E.', text: 'e ' + barsOfEighths(run(T.npsPattern(9, 'major', 0, 3, 5, STD)).split(' ')), bpm: 70 },
      { title: 'E major, open position', desc: 'Low E to high E, with four sharps.', text: 'q E2 F#2 G#2 A2 | B2 C#3 D#3 E3 | F#3 G#3 A3 B3 | C#4 D#4 h E4 | q D#4 C#4 B3 A3 | G#3 F#3 E3 D#3 | C#3 B2 A2 G#2 | F#2 h. E2', bpm: 70, pos: 0 },
      { title: 'D major, second position', desc: 'Keep your first finger at fret 2.', text: 'q D3 E3 F#3 G3 | A3 B3 C#4 D4 | E4 F#4 G4 A4 | h B4 A4 | q G4 F#4 E4 D4 | C#4 B3 A3 G3 | F#3 E3 h D3', bpm: 70, pos: 2 },
      { title: 'C major arpeggio shapes', desc: 'Only C, E and G, through two octaves in fifth position.', text: 'q C3 E3 G3 C4 | E4 G4 h C4 | q G3 E3 C3 E3 | w C3', bpm: 72, pos: 5 },
      { title: 'Melody in position 5', desc: 'A short original melody inside frets 5 to 8.', text: 'q E4 D4 C4 D4 | E4 G4 h E4 | q D4 C4 A3 C4 | w D4 | q E4 D4 C4 D4 | E4 G4 A4 G4 | q E4 D4 C4 D4 | w C4', bpm: 76, pos: 5, chords: ['C', 'Am', 'F', 'G'], backing: 'folk' },
      { title: 'D Dorian', desc: 'The C major scale starting and ending on D: a minor sound with a bright 6th.', text: 'q D3 E3 F3 G3 | A3 B3 C4 D4 | E4 F4 h D4 | q C4 B3 A3 G3 | F3 E3 h D3', bpm: 72, pos: 5, chords: ['Dm', 'G'], backing: 'folk' },
      { title: 'Descending in threes', desc: 'G major coming down in groups of three.', text: 'e G4 F#4 E4 F#4 E4 D4 E4 D4 | C4 D4 C4 B3 C4 B3 A3 B3 | A3 G3 A3 G3 F#3 G3 F#3 E3 | F#3 E3 D3 E3 q G3 r', bpm: 70, pos: 2 },
      { title: 'The harmonised scale', desc: 'The chords built on each note of C major: C, Dm, Em, F, G, Am.', text: rep('h [C] [Dm] | [Em] [F] | [G] [Am] | [G] [C]', 3), bpm: 72, backing: 'folk' },
      { title: 'CAGED: G shape to E shape', desc: 'Move between two neighbouring C shapes without stopping.', text: rep('h [C@G] [C@G] | [C@E] [C@E]', 6), bpm: 66, backing: 'folk' },
      { title: 'Scale ladder', desc: 'C major three notes per string. The loop speeds up after each clean pass.', text: 'e ' + barsOfEighths(run(T.npsPattern(0, 'major', 0, 3, 8, STD)).split(' ')), bpm: 120, ladder: { from: 70, to: 120 } },
    ]);

    // ===== 11. Techniques =====
    add(11, [
      { title: 'Hammer-ons from open strings', desc: 'Pick the open string, hammer the fretted note.', text: rep('q 1:0h3 2:0h1 2:0h3 3:0h2 | 4:0h2 5:0h2 h 6:0', 4), bpm: 66, pos: 1 },
      { title: 'Pull-offs to open strings', desc: 'Flick the finger off sideways so the open string rings.', text: rep('q 1:3p0 2:3p0 2:1p0 3:2p0 | 4:2p0 5:2p0 h 6:0', 4), bpm: 66, pos: 1 },
      { title: 'Long slides', desc: 'Slide seven frets without losing pressure. Look at the target fret.', text: rep('h 3:2/9 3:9\\2 | 2:3/10 2:10\\3', 4), bpm: 60, pos: 2 },
      { title: 'Bend and pick the target', desc: 'Bend up a whole step, then play the target note to check your pitch.', text: rep('h 2:8b2 2:10 | 3:7b2 3:9', 4), bpm: 60, pos: 7, backing: 'blues', chords: ['Am'] },
      { title: 'Half-step bends in a lick', desc: 'Small, quick bends for a bluesy sound.', text: rep('e 2:8b1 2:5 3:7 3:5b1 q 3:5 4:7 | h 4:5~ h r', 4), bpm: 70, pos: 5, backing: 'blues', chords: ['Am'] },
      { title: 'Legato three notes per string', desc: 'Pick once per string and hammer the rest.', text: rep('q 6:5h7 6:8 5:5h7 5:8 | 4:5h7 4:9 3:5h7 3:9', 3), bpm: 60, pos: 5 },
      { title: 'Vibrato on every finger', desc: 'Hold each note and add even vibrato with fingers 1, 2, 3 and 4.', text: rep('w 2:5~ | 2:6~ | 2:7~ | 2:8~', 3), bpm: 72, pos: 5, backing: 'blues', chords: ['Am'] },
      { title: 'Rakes and dead notes', desc: 'Drag the pick across muted strings into the note.', text: rep('e 4:x 3:x q 2:8 e 4:x 3:x q 2:5 | e 3:x q. 3:7~ h r', 4), bpm: 70, pos: 5, backing: 'blues', chords: ['Am'] },
      { title: 'Palm mute versus open', desc: 'Alternate between thudding palm mutes and ringing open notes.', text: rep('e 6:0pm 6:0pm 6:0pm 6:0pm q 6:0 6:3 | e 5:0pm 5:0pm 5:0pm 5:0pm q 5:0 5:2', 4), bpm: 88, backing: 'rock', chords: ['E5', 'A5'] },
      { title: 'Technique étude', desc: 'Hammer-ons, pull-offs, slides, bends and vibrato in one phrase.', text: rep('q 3:5h7 3:7p5 4:7/9 e 4:9 3:7 | h 2:8b2 q 2:5 3:7 | q 3:5 4:7p5 5:7 e 5:5 6:8 | w 6:5~', 2), bpm: 66, pos: 5, backing: 'blues', chords: ['Am'] },
    ]);

    // ===== 12. Speed and accuracy =====
    const ladder = (title, desc, text, from, to, extra) => Object.assign({ title, desc: desc + ` The loop starts at ${from} BPM and speeds up after every clean pass, up to ${to}.`, text, bpm: to, ladder: { from, to }, pos: 1 }, extra || {});
    add(12, [
      ladder('Two-string alternate picking', 'Alternate picking across the B and high e strings.', 's 2:5 1:5 2:7 1:5 2:8 1:5 2:7 1:5 2:5 1:5 2:7 1:5 2:8 1:5 2:7 1:5', 60, 110, { pos: 5 }),
      ladder('Legato ladder', 'Hammer-ons and pull-offs only.', 'q 3:5h7 3:7p5 3:5h7 3:7p5', 60, 120, { pos: 5 }),
      ladder('Chromatic descending', 'Fingers 4-3-2-1 on every string, high to low.', 'e 1:4 1:3 1:2 1:1 2:4 2:3 2:2 2:1 | 3:4 3:3 3:2 3:1 4:4 4:3 4:2 4:1', 56, 100),
      ladder('String-skipping ladder', 'Skip a string with every note pair.', 'e 6:5 4:7 5:7 3:7 4:7 2:8 3:7 1:8', 60, 110, { pos: 5 }),
      ladder('Pentatonic threes ladder', 'Box 1 in threes.', 'e ' + barsOfEighths(run(seq3(pent(1))).split(' ')), 60, 110, { pos: 5 }),
      ladder('Power chord chug ladder', 'Palm-muted chugs with accent chords.', 'e 6:0pm 6:0pm 6:0pm 6:0pm [P6:3] d [P6:5] d', 80, 140),
      ladder('Sixteenth strum ladder', 'Sixteenth strums on an Em chord.', 's [Em]d u d u d u d u d u d u d u d u', 50, 90),
      ladder('Arpeggio ladder', 'C and G arpeggios, alternate picking.', 'e 5:3 4:2 3:0 2:1 1:0 2:1 3:0 4:2 | 6:3 5:2 4:0 3:0 2:0 3:0 4:0 5:2', 70, 130),
      ladder('Major scale ladder', 'G major in open position, up and down.', 'e G2 A2 B2 C3 D3 E3 F#3 G3 | A3 B3 C4 D4 E4 F#4 G4 F#4 | E4 D4 C4 B3 A3 G3 F#3 E3 | D3 C3 B2 A2 q G2 r', 60, 120, { pos: 0 }),
      ladder('Gallop ladder', 'The metal gallop on the low E.', 'e 6:0pm s 6:0pm 6:0pm e 6:0pm s 6:0pm 6:0pm e 6:0pm s 6:0pm 6:0pm q 6:3', 70, 130),
    ]);

    // ===== 13. Reading =====
    const poolLow = ['E2', 'F2', 'G2', 'A2', 'B2', 'C3', 'D3', 'E3'];
    const poolG = ['G3', 'A3', 'B3', 'C4', 'D4', 'E4', 'F#4', 'G4'];
    add(13, [
      Object.assign({ title: 'Reading rests', desc: 'Quarter and half rests: count them, and stop the string.', text: rep('q C4 r D4 r | h E4 r | q r G4 r E4 | h C4 r', 3), bpm: 70, pos: 0 }, reading),
      Object.assign({ title: 'Reading eighth notes', desc: 'Pairs of eighths are joined by flags: two notes per beat.', text: rep('e C4 D4 E4 F4 q G4 G4 | e A4 G4 F4 E4 q D4 C4', 3), bpm: 66, pos: 0 }, reading),
      Object.assign({ title: 'Reading dotted rhythms', desc: 'A dot adds half the note’s value.', text: rep('q. E4 e D4 h C4 | q. D4 e E4 h F4 | q. G4 e F4 q E4 D4 | w C4', 2), bpm: 66, pos: 0 }, reading),
      Object.assign({ title: 'Key of G: F sharp', desc: 'Every F is F sharp in G major. Watch for the sharp sign.', text: rep('q G3 A3 B3 C4 | D4 E4 F#4 G4 | F#4 E4 D4 C4 | B3 A3 h G3', 2), bpm: 66, pos: 2 }, reading),
      Object.assign({ title: 'High notes above the staff', desc: 'Notes on the high e string up to fret 5: G, A.', text: rep('q E4 F4 G4 A4 | G4 F4 h E4 | q A4 G4 F4 E4 | w D4', 2), bpm: 66, pos: 0 }, reading),
      Object.assign({ title: 'Reading in fifth position', desc: 'The same notes, played higher up the neck. Read, don’t memorise.', text: rep('q A3 C4 D4 E4 | G4 E4 D4 C4 | A3 G3 A3 C4 | w A3', 2), bpm: 66, pos: 5 }, reading),
      Object.assign({ title: 'Sight-reading 3: low strings', desc: 'New notes on the three low strings. Notation only.', text: randomMelody(1303, poolLow, 24), bpm: 64, pos: 0 }, reading),
      Object.assign({ title: 'Sight-reading 4: key of G', desc: 'New notes in G major. Notation only.', text: randomMelody(1304, poolG, 24), bpm: 64, pos: 2 }, reading),
      Object.assign({ title: 'Sight-reading 5: mixed rhythms', desc: 'New rhythms and notes. Notation only.', text: H.rhythmMelody ? H.rhythmMelody(1305, ['C3', 'E3', 'G3', 'A3', 'C4', 'D4', 'E4', 'G4'], 8) + ' | w C3' : randomMelody(1305, ['C3', 'E3', 'G3'], 24), bpm: 64, pos: 0 }, reading),
      { title: 'Reading tab with techniques', desc: 'Tab only: h, p, /, b and ~ are written on the lines.', text: rep('e 3:5h7 3:7p5 4:7/9 4:9 q 2:8b2 e 2:5 3:7 | h 3:5~ q 4:7 r', 3), bpm: 66, pos: 5, views: { fretboard: false, highway: false, tab: true, staff: false } },
    ]);
  };
})(typeof window !== 'undefined' ? window : globalThis);
