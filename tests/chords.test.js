// Strums synthesized open chords into the worklet and checks chroma matching (REQ-DET-5, REQ-NF-1).
const { load } = require('./harness.js');
const { ks } = require('./synth.js');
const GQ = load('util', 'theory', 'chords');
const sr = 48000;
let Proc; const msgs = [];
global.sampleRate = sr; global.currentFrame = 0;
global.AudioWorkletProcessor = class { constructor() { this.port = { postMessage: (m) => msgs.push(m) }; } };
global.registerProcessor = (n, c) => { Proc = c; };
require('../js/worklet.js').guitarQuestWorklet();

const names = ['E', 'Em', 'A', 'Am', 'D', 'Dm', 'G', 'C', 'F', 'Bm', 'E7', 'A7', 'D7', 'G7', 'B7', 'C7'];
const spacing = 1.0, sig = new Float32Array(Math.round(sr * (names.length * spacing + 1)));
names.forEach((n, i) => {
  const c = GQ.chords.get(n);
  const ms = GQ.chords.midis(c).sort((a, b) => a - b);
  ms.forEach((m, k) => {
    const s = ks(440 * Math.pow(2, (m - 69) / 12), sr, 0.9, 0.18, 11 + k + i);
    const o = Math.round((0.5 + i * spacing + k * 0.008) * sr);
    for (let j = 0; j < s.length && o + j < sig.length; j++) sig[o + j] += s[j];
  });
});
const p = new Proc({ processorOptions: { gateDb: -50 } });
for (let i = 0; i + 128 <= sig.length; i += 128) { global.currentFrame = i; p.process([[sig.subarray(i, i + 128)]]); }
const ch = msgs.filter((m) => m.type === 'chroma');
let ok = 0, falseMatch = 0;
ch.forEach((m) => {
  const idx = Math.round((m.time - 0.5) / spacing);
  const exp = GQ.chords.get(names[idx]);
  const j = GQ.chords.judge(m.chroma, exp);
  const pass = j.verdict === 'match';
  if (pass) ok++;
  // also: a different chord must not be judged a match
  const wrongName = names[(idx + 3) % names.length];
  const jw = GQ.chords.judge(m.chroma, GQ.chords.get(wrongName));
  if (jw.verdict === 'match') { falseMatch++; }
  console.log(names[idx].padEnd(4), j.verdict, j.confidence.toFixed(2), '| vs', wrongName.padEnd(3), jw.verdict);
});
console.log(`chords matched ${ok}/${names.length}, false matches ${falseMatch}, onsets seen ${ch.length}`);
process.exitCode = ok >= Math.ceil(names.length * 0.9) && falseMatch <= 1 && ch.length === names.length ? 0 : 1;
