// Single notes E2..E6, clean and overdriven, 44.1 and 48 kHz (REQ-DET-1, REQ-DET-3, REQ-NF-1).
const { mix } = require('./synth.js');
let fails = 0;
for (const sr of [44100, 48000]) for (const drive of [0, 3]) {
  let Proc; const msgs = [];
  global.sampleRate = sr; global.currentFrame = 0;
  global.AudioWorkletProcessor = class { constructor() { this.port = { postMessage: (m) => msgs.push(m) }; } };
  global.registerProcessor = (n, c) => { Proc = c; };
  delete require.cache[require.resolve('../js/worklet.js')];
  require('../js/worklet.js').guitarQuestWorklet();
  const notes = [40, 45, 50, 55, 59, 64, 69, 76, 81, 88];
  const ev = notes.map((m, i) => ({ f: 440 * Math.pow(2, (m - 69) / 12), t: 0.5 + i * 0.8, dur: 0.6, amp: 0.35 }));
  const sig = mix(sr, ev, 0.5 + notes.length * 0.8 + 0.5, { hum: 0.003, noise: 0.001, drive });
  const p = new Proc({ processorOptions: { gateDb: -45 } });
  for (let i = 0; i + 128 <= sig.length; i += 128) { global.currentFrame = i; p.process([[sig.subarray(i, i + 128)]]); }
  const got = msgs.filter((m) => m.type === 'note' && !m.legato);
  let ok = 0; const det = [];
  for (const n of got) {
    const idx = Math.round((n.onsetFrame / sr - 0.5) / 0.8);
    const m = Math.round(69 + 12 * Math.log2(n.freq / 440));
    if (m === notes[idx]) ok++;
    det.push(n.detectMs);
  }
  const worst = Math.max(...det);
  console.log(`sr ${sr} drive ${drive}: ${ok}/${notes.length} correct, ${got.length} notes, detection max ${worst.toFixed(1)} ms`);
  if (ok < notes.length || got.length !== notes.length || worst > 45) fails++;
}
process.exitCode = fails ? 1 : 0;
