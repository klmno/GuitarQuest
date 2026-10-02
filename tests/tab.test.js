// Tab reader (js/tab.js) and custom songs written as tab.
const fs = require('fs');
const { load } = require('./harness');
const GQ = load('util', 'theory', 'chords', 'notation', 'abc', 'tab', 'custom');
const TAB = GQ.tab;
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails++; };
const notes = (p) => p.events.filter((e) => e.kind !== 'rest');
const sig = (e) => e.notes.map((n) => n.string + ':' + n.fret).join('+');

// telling tab from ABC
check(TAB.looks(TAB.EXAMPLE) && TAB.looks(TAB.TEMPLATE), 'tab is recognised');
check(!Object.values(GQ.abc.EXAMPLES).some((t) => TAB.looks(t)), 'ABC examples are not taken for tab');

// the help example
let p = TAB.parse(TAB.EXAMPLE);
check(!p.problems.length && !p.warnings.length, 'help example is clean: ' + JSON.stringify(p.errors.concat(p.warnings.map((w) => w.msg))));
check(p.meta.title === 'A first riff' && p.meta.bpm === 90 && p.bars === 4 && p.totalBeats === 16, 'header and bars: ' + [p.meta.title, p.meta.bpm, p.bars, p.totalBeats]);
const n0 = notes(p);
check(sig(n0[0]) === '6:0' && n0[0].tech.pm && n0[0].beat === 0, 'first note: open low E, palm muted, on the first beat');
const ham = n0.find((e) => e.legato);
check(ham && sig(ham) === '4:7' && ham.tech.from === 'h' && p.events[ham.i - 1].tech.into === 'h', 'hammer-on 5h7 on the D string');
const bend = n0.find((e) => e.tech.bend);
check(bend && sig(bend) === '4:7' && bend.tech.bend === 2 && GQ.notation.midis(bend)[0] === GQ.theory.midiAt(4, 9), '7b9 bends a whole step');
check(n0.some((e) => e.tech.vib && sig(e) === '3:7'), '7~ vibrato');
check(p.events.every((e, k) => k === 0 || Math.abs(e.beat - (p.events[k - 1].beat + p.events[k - 1].dur)) < 1e-9), 'events follow each other without gaps');
for (let b = 0; b < p.bars; b++) {
  const len = p.events.filter((e) => e.bar === b).reduce((a, e) => a + e.dur, 0);
  if (Math.abs(len - 4) > 1e-9) check(false, `bar ${b + 1} lasts ${len} beats`);
}

// the user's riff: x3 repeat, pm lines, a chord, slides
p = TAB.parse(fs.readFileSync(__dirname + '/fixtures/example.tab', 'utf8'));
check(!p.problems.length, 'example tab reads without problems ' + JSON.stringify(p.errors));
check(p.bars === 4 * 3 + 3 + 2, 'x3 plays the first block three times: ' + p.bars + ' bars');
const bar12 = p.events.filter((e) => e.bar === 12 && e.kind !== 'rest');
check(bar12[0].kind === 'chord' && sig(bar12[0]) === '6:0+5:2', 'notes in one column are a chord');
check(bar12.filter((e) => sig(e) === '6:0').every((e) => e.tech.pm), 'pm--- under the block palm-mutes the notes above it');
check(!bar12.find((e) => sig(e) === '5:7').legato, 'a slide with nothing before it (/7) is a picked note');

// low E on top, two-digit frets, dead notes, attached slides, bad blocks
p = TAB.parse('E|-0---|\nA|-----|\nD|-----|\nG|-----|\nB|-----|\ne|-12--|');
check(notes(p).length === 1 && sig(notes(p)[0]) === '6:0+1:12', 'labels E ... e: low E on top; 12 is one fret');
p = TAB.parse('e|---------|\nB|---------|\nG|---------|\nD|---------|\nA|-5/7-x---|\nE|---------|');
const sl = notes(p);
check(sl.length === 3 && sl[1].legato && sl[1].tech.from === 'su' && sl[2].kind === 'mute', '5/7 slides up without a pick; x is a dead note');
p = TAB.parse('e|-----|\nB|-----|\nG|-0---|\nD|-----|');
check(p.problems.length === 1 && /six string lines/.test(p.problems[0].msg), 'a block without six lines is a problem');
p = TAB.parse('Time: 3/4\n\ne|-0-0-0-|\nB|-------|\nG|-------|\nD|-------|\nA|-------|\nE|-------|');
check(p.beatsPerBar === 3 && notes(p).map((e) => e.beat).join() === '0,1,2', 'Time: 3/4 bars, three evenly spaced notes on the beats');
p = TAB.parse('e|-0-|\nB|---|\nG|---|\nD|---|\nA|---|\nD|---|'.replace('e|', 'e|-').replace(/\|---\|/g, '|----|'));
check(p.warnings.some((w) => /labelled/.test(w.msg)), 'a tab for another tuning gets a warning');

// custom songs written as tab
const t = GQ.custom.save({ format: 'tab', text: TAB.EXAMPLE });
check(t.format === 'tab' && t.tab === TAB.EXAMPLE && !('abc' in t) && t.title === 'A first riff' && t.key === 'Tab' && t.bars === 4, 'a tab song is saved as tab');
const lv = GQ.custom.level(t);
check(lv.tab === TAB.EXAMPLE && !lv.abc && GQ.notation.parseLevel(lv).events.length === TAB.parse(TAB.EXAMPLE).events.length, 'a tab song becomes a playable level');
const imp = GQ.custom.importText(TAB.TEMPLATE.replace('Title: My new tab\n', '').replace('|----------------|', '|-0--------------|'), 'Riff idea.txt');
check(imp.saved.length === 1 && imp.saved[0].format === 'tab' && imp.saved[0].title === 'Riff idea', 'importing a tab file without a Title: names it after the file');
const abc = GQ.custom.save({ abc: GQ.abc.EXAMPLES.first });
check(GQ.custom.formatOf(abc) === 'abc' && GQ.custom.textOf(abc) === GQ.abc.EXAMPLES.first, 'ABC songs are unchanged');
check(GQ.abc.splitTunes(GQ.custom.exportAll()).length === 1, 'Download all (.abc) holds only the ABC songs');

console.log(fails ? fails + ' tab test(s) failed' : 'tab tests passed');
process.exitCode = fails ? 1 : 0;
