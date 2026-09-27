// Notes picked while earlier notes are still ringing (arpeggios, let-ring melodies).
// Each note must still be identified; a ringing note must not be reported instead.
// Mismatches the lesson treats as doubt (flagged as possibly ringing, or 1-2 octaves / a twelfth off)
// count as "unclear": the lesson never marks them wrong.
const { ks } = require('./synth.js');
const WORKLET = process.env.GQ_WORKLET || '../js/worklet.js';
const cases = [
  // name, [midi...], spacing (s), ring (s)
  ['Am arpeggio', [45, 52, 57, 60, 64, 60, 57, 52], 0.32, 2.2],
  ['C arpeggio', [48, 52, 55, 60, 64, 60, 55, 52], 0.30, 2.2],
  ['G arpeggio', [43, 47, 50, 55, 59, 67, 59, 55], 0.30, 2.2],
  ['let-ring melody', [64, 62, 60, 62, 64, 64, 64, 62], 0.40, 1.8],
  ['low under high', [52, 40, 55, 43, 57, 45, 59, 47], 0.38, 2.0],
  ['wide jumps', [40, 64, 45, 69, 50, 71, 55, 76], 0.35, 2.0],
  ['bass walk + open e', [40, 64, 42, 64, 43, 64, 44, 64], 0.30, 2.0],
];
let total = 0, right = 0, wrong = 0, missed = 0, unclear = 0;
for (const sr of [48000, 44100]) for (const [name, notes, gap, ring] of cases) {
  let Proc; const msgs = [];
  global.sampleRate = sr; global.currentFrame = 0;
  global.AudioWorkletProcessor = class { constructor() { this.port = { postMessage: (m) => msgs.push(m) }; } };
  global.registerProcessor = (n, c) => { Proc = c; };
  delete require.cache[require.resolve(WORKLET)];
  require(WORKLET).guitarQuestWorklet();
  const sig = new Float32Array(Math.round(sr * (0.5 + notes.length * gap + ring)));
  notes.forEach((m, i) => {
    const s = ks(440 * Math.pow(2, (m - 69) / 12), sr, ring, 0.3, 17 + i);
    const o = Math.round((0.5 + i * gap) * sr);
    for (let j = 0; j < s.length && o + j < sig.length; j++) sig[o + j] += s[j];
  });
  for (let i = 0; i < sig.length; i++) sig[i] += 0.0008 * Math.sin(i * 0.37);
  const p = new Proc({ processorOptions: { gateDb: -50 } });
  for (let i = 0; i + 128 <= sig.length; i += 128) { global.currentFrame = i; p.process([[sig.subarray(i, i + 128)]]); }
  const got = msgs.filter((m) => m.type === 'note' && !m.legato);
  const un = msgs.filter((m) => m.type === 'unclear');
  const res = notes.map((m, i) => {
    const t = 0.5 + i * gap;
    const n = got.find((x) => Math.abs(x.onsetFrame / sr - t) < 0.06);
    if (n) { const h = Math.round(69 + 12 * Math.log2(n.freq / 440)); return h === m ? 'ok' : n.ringing || [12, 19, 24].includes(Math.abs(h - m)) ? 'unclear' : 'WRONG(' + h + ')'; }
    return un.some((x) => Math.abs(x.onsetFrame / sr - t) < 0.06) ? 'unclear' : 'MISSED';
  });
  total += notes.length;
  right += res.filter((r) => r === 'ok').length; wrong += res.filter((r) => r.startsWith('WRONG')).length;
  missed += res.filter((r) => r === 'MISSED').length; unclear += res.filter((r) => r === 'unclear').length;
  const legato = msgs.filter((m) => m.type === 'note' && m.legato).length;
  console.log(`${sr} ${name.padEnd(20)} ${res.join(' ')}${legato ? '  +' + legato + ' false legato' : ''}`);
}
console.log(`right ${right}/${total}, wrong ${wrong}, unclear ${unclear}, missed ${missed}`);
process.exitCode = wrong <= total * 0.01 && right >= total * 0.9 ? 0 : 1; // never accuse, and identify at least 90% even while other notes ring
