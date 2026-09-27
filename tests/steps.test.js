// Note steps: nested, strong beats first, right counts, every level works at every step.
const { load } = require('./harness.js');
const GQ = load('util', 'theory', 'chords', 'notation', 'store', 'steps', 'songs', 'songs-extra', 'curriculum-extra', 'curriculum');
const ST = GQ.steps;
let bad = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };
const all = GQ.curriculum.levels.filter((l) => l.kind !== 'tuner');
for (const lv of all) {
  const text = (lv.repeat || 1) > 1 ? Array(lv.repeat).fill(lv.text).join(' | ') : lv.text;
  const p = GQ.notation.parse(text, { meter: lv.meter, pos: lv.pos });
  let prev = new Set();
  for (const pct of ST.LEVELS) {
    const k = ST.keep(p.events, p.beatsPerBar, pct);
    for (const i of prev) if (!k.has(i)) { fail(`${lv.id} ${pct}% drops a note kept at a lower step`); break; }
    if (!k.size) fail(`${lv.id} ${pct}% keeps nothing`);
    prev = k;
  }
  const n = p.events.filter((e) => e.kind !== 'rest').length;
  if (prev.size !== n) fail(`${lv.id} 100% should keep all ${n} notes, kept ${prev.size}`);
}
// strong beats first: in 2.4 (quarter notes) 25% keeps exactly the first beat of every bar
const lv = GQ.curriculum.byId('u2-4');
const p = GQ.notation.parse(lv.text, { pos: lv.pos });
const k30 = ST.keep(p.events, 4, 30);
const kept = p.events.filter((e) => k30.has(e.i));
if (!kept.every((e) => e.beat % 4 === 0 || e.beat % 4 === 2)) fail('2.4 at 30% should only use beats 1 and 3');
if (!p.events.filter((e) => e.beat % 4 === 0).every((e) => k30.has(e.i))) fail('2.4 at 30% should include every bar start');
const k10 = ST.keep(p.events, 4, 10);
console.log(`2.4: ${p.events.length} notes; 10% keeps ${k10.size} at beats ${[...k10].map((i) => p.events[i].beat).join(',')}; 30% keeps ${k30.size}`);
// hammer-on groups stay together
const h = GQ.notation.parse('q 3:5h7 3:5h7 3:5h7 3:5h7 | 3:5h7 3:5h7 3:5h7 3:5h7');
const kh = ST.keep(h.events, 4, 50);
for (const e of h.events) if (e.legato && kh.has(e.i) !== kh.has(e.i - 1)) fail('slur split from its picked note');
console.log(bad ? `${bad} problems` : `steps OK across ${all.length} levels`);
process.exitCode = bad ? 1 : 0;
