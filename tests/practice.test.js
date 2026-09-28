// Every practice exercise must parse cleanly, stay on the neck, fit whole bars, have a unique id and a name.
const { load } = require('./harness.js');
const GQ = load('util', 'theory', 'chords', 'notation', 'store', 'songs', 'songs-extra', 'curriculum-extra', 'curriculum', 'practice');
const P = GQ.practice, C = GQ.curriculum;
let bad = 0;
const ids = new Set();
for (const lv of P.items) {
  const probs = [];
  if (ids.has(lv.id)) probs.push('duplicate id'); ids.add(lv.id);
  if (!lv.title || !lv.aka || !lv.desc) probs.push('missing name, aka or description');
  if (!P.catOf(lv.cat)) probs.push('unknown category ' + lv.cat);
  if (C.byId(lv.id) !== lv) probs.push('not found through curriculum.byId');
  const p = GQ.notation.parse(lv.text, { meter: lv.meter, pos: lv.pos });
  probs.push(...p.errors);
  if (!p.events.length) probs.push('no events');
  for (const e of p.events) for (const n of e.notes) if (n.fret < 0 || n.fret > 22) probs.push('fret ' + n.fret);
  for (const b of p.barMarks) if (Math.abs(b / p.beatsPerBar - Math.round(b / p.beatsPerBar)) > 1e-6) probs.push('bar line at beat ' + b);
  if (Math.abs(p.totalBeats / p.beatsPerBar - Math.round(p.totalBeats / p.beatsPerBar)) > 1e-6) probs.push('ends mid-bar (' + p.totalBeats + ' beats)');
  if (lv.chords) for (const c of lv.chords) if (!GQ.chords.get(c)) probs.push('unknown chord ' + c);
  const secs = p.totalBeats * 60 / (lv.ladder ? lv.ladder.from : lv.bpm);
  if (secs > 180) probs.push('too long: ' + Math.round(secs) + ' s');
  if (secs < 3) probs.push('too short: ' + secs.toFixed(1) + ' s');
  if (probs.length) { bad++; console.log(lv.id, lv.title, '->', [...new Set(probs)].slice(0, 4).join('; ')); }
}
for (const [c] of P.cats) if (!P.inCat(c).length) { bad++; console.log('empty category', c); }
// scales rise and fall in pitch the right way, and the pentatonic boxes only use A C D E G
const pcs = (id) => GQ.notation.parse(P.byId(id).text, {}).events.flatMap((e) => e.notes.map((n) => GQ.theory.midiAt(n.string, n.fret, { tuning: "standard", capo: 0 }) % 12));
for (let b = 1; b <= 5; b++) if (pcs('px-pent-box' + b).some((m) => ![9, 0, 2, 4, 7].includes(m))) { bad++; console.log('box ' + b + ' has a note outside A minor pentatonic'); }
if (!pcs('px-blues-scale').includes(3)) { bad++; console.log('blues scale is missing the flat fifth'); }
if (C.next('px-pent-box1') !== P.byId('px-pent-box2')) { bad++; console.log('next() does not stay in the practice category'); }
if (C.levels.some((l) => /^px-/.test(l.id))) { bad++; console.log('practice items leaked into the curriculum'); }
console.log(`${P.items.length} practice exercises in ${P.cats.length} categories, ${bad} with problems`);
process.exitCode = bad || P.items.length < 50 ? 1 : 0;
