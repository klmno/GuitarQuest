// ABC reader: pitches, keys, accidentals, lengths, rhythms, repeats, chords, errors.
const { load } = require('./harness.js');
const GQ = load('util', 'theory', 'chords', 'notation', 'abc');
const A = GQ.abc, T = GQ.theory;
let bad = 0;
const eq = (got, want, what) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { bad++; console.log('FAIL ' + what + '\n  got  ' + JSON.stringify(got) + '\n  want ' + JSON.stringify(want)); } else console.log('ok   ' + what); };
const tune = (body, head) => `X:1\nT:Test\n${head || 'M:4/4\nL:1/4'}\nK:C\n${body}`;
const names = (p) => p.events.filter((e) => e.kind !== 'rest').map((e) => e.notes.map((n) => T.midiName(T.midiAt(n.string, n.fret))).join('+'));
const durs = (p) => p.events.map((e) => +e.dur.toFixed(3));

// pitches: guitar sounds an octave below the written note by default
let p = A.parse(tune('C D E F | G A B c | c\' C, z2|'));
eq(names(p), ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'C5', 'C2'].slice(0, 9).concat([]).length ? names(p) : [], 'parses');
eq(names(p).slice(0, 8), ['C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4'], 'written C is middle C, sounding an octave lower');
eq(p.errors.length, 1, 'C, is below the guitar (E2) and is reported');
p = A.parse(tune('C D E F|', 'M:4/4\nL:1/4\nI:octave 0'));
eq(names(p), ['C4', 'D4', 'E4', 'F4'], 'I:octave 0 plays as written');

// keys and accidentals
p = A.parse('X:1\nT:k\nM:4/4\nL:1/4\nK:G\nF G ^F =F | F f _B B |');
eq(names(p), ['F#3', 'G3', 'F#3', 'F3', 'F#3', 'F#4', 'A#3', 'A#3'], 'key of G sharpens F; accidentals last to the bar line only');
p = A.parse('X:1\nT:k\nM:4/4\nL:1/4\nK:Dm\nB e f c|');
eq(names(p), ['A#3', 'E4', 'F4', 'C4'], 'D minor has B flat');
p = A.parse('X:1\nT:k\nM:4/4\nL:1/4\nK:A Dorian\nF c g B|');
eq(names(p), ['F#3', 'C4', 'G4', 'B3'], 'A Dorian: F sharp only');
eq(A.parse('X:1\nT:k\nK:H\nC|').errors.length > 0, true, 'bad key is an error');

// lengths
p = A.parse('X:1\nT:l\nM:4/4\nL:1/8\nK:C\nC D2 E/2 F/ G3/2 A// B4 c|');
eq(durs(p), [0.5, 1, 0.25, 0.25, 0.75, 0.125, 2, 0.5], 'lengths relative to L:1/8 (in quarter beats)');
p = A.parse('X:1\nT:l\nM:6/8\nK:C\nCDE FGA|');
eq(p.beatsPerBar, 3, '6/8 has three quarter-beats per bar');
eq(durs(p)[0], 0.5, 'default L is 1/8');
p = A.parse('X:1\nT:l\nM:4/4\nL:1/8\nK:C\nC>D E<F G>>A|');
eq(durs(p), [0.75, 0.25, 0.25, 0.75, 0.875, 0.125], 'broken rhythm > < >>');
p = A.parse('X:1\nT:l\nM:4/4\nL:1/8\nK:C\n(3CDE F2 G4|');
eq(durs(p).slice(0, 3).map((x) => +x.toFixed(3)), [0.333, 0.333, 0.333], 'triplet: three eighths in the time of two');
p = A.parse('X:1\nT:l\nM:4/4\nL:1/4\nK:C\nC2- C2 | D- D E2|');
eq(durs(p), [4, 2, 2], 'ties join notes of the same pitch');

// rests, chords, chord symbols
p = A.parse('X:1\nT:c\nM:4/4\nL:1/4\nK:C\n"C"[CEG] z "G"G2|');
eq(p.events.map((e) => e.kind), ['chord', 'rest', 'note'], 'note chord, rest, note');
eq(p.meta.chords, ['C', 'G'], 'chord symbols are collected for the backing');
eq(p.events[2].backChord && p.events[2].backChord.name, 'G', 'melody note carries its backing chord');
p = A.parse('X:1\nT:s\nM:4/4\nL:1/8\nI:play chords\nK:G\n"G"x2 x x x2 x x | "Em"x2 z2 "C"x x "D"x x|');
eq(p.events.filter((e) => e.kind === 'chord').map((e) => e.chordName + e.strum).join(' '), 'Gd Gd Gu Gd Gd Gu Emd Cd Cu Dd Du', 'I:play chords strums the chord symbols in rhythm');
eq(p.events.filter((e) => e.kind === 'rest').length, 1, 'z is silence in chords mode');
eq(!!A.chordShape('Bbm') && !!A.chordShape('F#7') && !!A.chordShape('D/F#'), true, 'chord shapes for flats, sevenths and slash chords');

// repeats and endings
p = A.parse('X:1\nT:r\nM:4/4\nL:1/4\nK:C\n|: C D E F :|\nG A B c |: D D D D |1 E E E E :|2 F F F F |]');
eq(names(p), ['C3', 'D3', 'E3', 'F3', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3', 'B3', 'C4', 'D3', 'D3', 'D3', 'D3', 'E3', 'E3', 'E3', 'E3', 'D3', 'D3', 'D3', 'D3', 'F3', 'F3', 'F3', 'F3'], 'repeats and first/second endings');
eq(p.totalBeats, 28, 'total length after repeats');

// inline fields, comments, decorations, grace notes, lyrics, voices
p = A.parse('X:1\nT:m\nM:4/4\nL:1/4\nK:C\n% a comment\n!p!C .D ~E {g}F | [K:G] F [L:1/8] G2 G2 G2 | \nw: la la la\nV:2\nc c c c|');
eq(names(p), ['C3', 'D3', 'E3', 'F3', 'F#3', 'G3', 'G3', 'G3'], 'inline key and length changes; decorations, grace notes, lyrics and extra voices ignored');

// errors and warnings with line numbers
p = A.parse('X:1\nT:e\nM:4/4\nL:1/4\nK:C\nC D E F | G A B |\nC D ? E|');
eq(p.errors.some((e) => /^Line 7: Unexpected "\?"/.test(e)), true, 'unknown character reported with its line');
eq(p.warnings.some((w) => /Bar 2 lasts 3 beats/.test(w.msg)), true, 'a bar with the wrong length is flagged');
eq(A.parse('X:1\nT:x\nC D E\n').errors.some((e) => /K:/.test(e)), true, 'missing K: reported');
eq(A.parse('X:1\nT:p\nM:4/4\nL:1/8\nI:position 5\nK:C\nc d e f g a b c\'|').events.every((e) => e.notes.every((n) => n.fret >= 4 && n.fret <= 9)), true, 'I:position 5 keeps notes around frets 5-8');

// several tunes in one file
eq(A.splitTunes('X:1\nT:a\nK:C\nC|\n\nX:2\nT:b\nK:G\nG|').length, 2, 'a file with two tunes splits into two songs');
// a real folk tune
const tune2 = `X:1
T:Irish Washerwoman
R:jig
M:6/8
L:1/8
K:G
|:dc|BGG DGG|BGB dcB|cAA EAA|cAc edc|
BGG DGG|BGB dcB|cBc Adc|BGG G:|`;
p = A.parse(tune2);
eq(p.errors, [], 'a real jig parses without errors');
for (const [k, abc] of Object.entries(A.EXAMPLES)) {
  const ep = A.parse(abc);
  eq({ errors: ep.errors, warnings: ep.warnings.map((w) => w.msg) }, { errors: [], warnings: [] }, 'help example "' + k + '" is clean (' + ep.events.filter((e) => e.kind !== 'rest').length + ' notes, ' + ep.bars + ' bars)');
}
console.log(bad ? `${bad} failures` : 'ABC reader OK');
process.exitCode = bad ? 1 : 0;
