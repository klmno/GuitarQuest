// Chord changes while the previous chord is still ringing (no muting between strums).
const { load } = require('./harness.js');
const { ks } = require('./synth.js');
const GQ = load('util', 'theory', 'chords');
const WORKLET = process.env.GQ_WORKLET || '../js/worklet.js';
const sr = 48000;
let Proc; const msgs = [];
global.sampleRate = sr; global.currentFrame = 0;
global.AudioWorkletProcessor = class { constructor() { this.port = { postMessage: (m) => msgs.push(m) }; } };
global.registerProcessor = (n, c) => { Proc = c; };
require(WORKLET).guitarQuestWorklet();
const seq = ['G', 'C', 'D', 'Em', 'Am', 'F', 'C', 'G', 'E', 'A', 'D', 'Bm', 'G', 'D', 'Em', 'C'];
const gap = 0.6, sig = new Float32Array(Math.round(sr * (seq.length * gap + 3)));
seq.forEach((n, i) => {
  const ms = GQ.chords.midis(GQ.chords.get(n)).sort((a, b) => a - b);
  ms.forEach((m, k) => {
    const s = ks(440 * Math.pow(2, (m - 69) / 12), sr, 2.2, 0.14, 31 + k + 7 * i);
    const o = Math.round((0.5 + i * gap + k * 0.008) * sr);
    for (let j = 0; j < s.length && o + j < sig.length; j++) sig[o + j] += s[j];
  });
});
const p = new Proc({ processorOptions: { gateDb: -50 } });
for (let i = 0; i + 128 <= sig.length; i += 128) { global.currentFrame = i; p.process([[sig.subarray(i, i + 128)]]); }
const ch = msgs.filter((m) => m.type === 'chroma');
let ok = 0, wrong = 0, unclear = 0;
const out = [];
for (let i = 0; i < seq.length; i++) {
  const m = ch.find((x) => Math.abs(x.time - (0.5 + i * gap)) < 0.05);
  if (!m) { out.push('MISSED'); continue; }
  const j = GQ.chords.judge(m.chroma, GQ.chords.get(seq[i]));
  if (j.verdict === 'match') ok++; else if (j.verdict === 'wrong') wrong++; else unclear++;
  out.push(j.verdict === 'match' ? 'ok' : j.verdict + '(' + j.heard + ')');
}
console.log(seq.map((s, i) => s + ':' + out[i]).join(' '));
console.log(`ringing chord changes: matched ${ok}/${seq.length}, wrong ${wrong}, unclear ${unclear}`);
process.exitCode = ok >= seq.length * 0.9 && wrong === 0 ? 0 : 1;
