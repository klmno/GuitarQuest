// Every level must parse cleanly, stay on the neck, and have bar lines that land on bar boundaries.
const { load } = require('./harness.js');
const GQ = load('util', 'theory', 'chords', 'notation', 'store', 'songs', 'curriculum');
const C = GQ.curriculum;
let bad = 0;
const all = C.levels.concat(GQ.SONGS.flatMap((s) => [C.songLevel(s.id, 'riff'), C.songLevel(s.id, 'full')]));
for (const lv of all) {
  if (lv.kind === 'tuner') continue;
  const p = GQ.notation.parse(lv.text, { meter: lv.meter, pos: lv.pos });
  const probs = [...p.errors];
  if (!p.events.length) probs.push('no events');
  for (const e of p.events) for (const n of e.notes) if (n.fret < 0 || n.fret > 24) probs.push('fret ' + n.fret);
  for (const b of p.barMarks) if (Math.abs(b / p.beatsPerBar - Math.round(b / p.beatsPerBar)) > 1e-6) probs.push('bar line at beat ' + b);
  if (Math.abs(p.totalBeats / p.beatsPerBar - Math.round(p.totalBeats / p.beatsPerBar)) > 1e-6) probs.push('ends mid-bar (' + p.totalBeats + ' beats)');
  if (lv.pos === 0) for (const e of p.events) for (const n of e.notes) if (n.fret > 5) probs.push('open-position note at fret ' + n.fret);
  const secs = p.totalBeats * 60 / lv.bpm;
  if (secs > 180) probs.push('too long: ' + Math.round(secs) + ' s');
  if (probs.length) { bad++; console.log(lv.id, lv.title, '->', [...new Set(probs)].slice(0, 4).join('; ')); }
}
console.log(`${C.units.length} units, ${C.levels.length} levels, ${bad} with problems`);
process.exitCode = bad || C.levels.length < 120 || C.units.length !== 14 ? 1 : 0;
