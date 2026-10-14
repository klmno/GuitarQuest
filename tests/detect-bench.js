// Compares the note-detection options on synthesized guitar: single notes, notes picked while
// others ring, soft notes under loud ones, re-picked notes, fast runs, and mains hum.
// Usage: node tests/detect-bench.js            (prints one line per option set)
const { ks } = require('./synth.js');
const midiF = (m) => 440 * Math.pow(2, (m - 69) / 12);

function render(sr, notes, { hum = 0, humHz = 60, noise = 0.0008, drive = 0, ring = 2 }) {
  const end = Math.max(...notes.map((n) => n.t)) + ring + 0.3;
  const sig = new Float32Array(Math.round(sr * end));
  notes.forEach((n, i) => {
    const s = ks(midiF(n.m), sr, ring, n.amp || 0.3, 17 + i);
    const o = Math.round(n.t * sr);
    for (let j = 0; j < s.length && o + j < sig.length; j++) sig[o + j] += s[j];
  });
  let r = 777; const rnd = () => { r = (r * 16807) % 2147483647; return r / 2147483647 * 2 - 1; };
  for (let i = 0; i < sig.length; i++) {
    let x = sig[i] + noise * rnd() + hum * (Math.sin(2 * Math.PI * humHz * i / sr) + 0.5 * Math.sin(2 * Math.PI * 2 * humHz * i / sr) + 0.3 * Math.sin(2 * Math.PI * 3 * humHz * i / sr));
    if (drive) x = Math.tanh(x * (1 + drive)) / Math.tanh(1 + drive);
    sig[i] = x;
  }
  return sig;
}
const seq = (ms, gap, amp, t0 = 0.5) => ms.map((m, i) => ({ m, t: t0 + i * gap, amp: Array.isArray(amp) ? amp[i] : amp }));
const SCEN = [
  ['singles clean', seq([40, 45, 50, 55, 59, 64, 69, 76, 81, 88], 0.8, 0.35), { ring: 0.6 }],
  ['singles driven', seq([40, 45, 50, 55, 59, 64, 69, 76, 81, 88], 0.8, 0.35), { ring: 0.6, drive: 3 }],
  ['Am arpeggio', seq([45, 52, 57, 60, 64, 60, 57, 52], 0.32, 0.3), {}],
  ['G arpeggio', seq([43, 47, 50, 55, 59, 67, 59, 55], 0.30, 0.3), {}],
  ['let-ring melody', seq([64, 62, 60, 62, 64, 64, 64, 62], 0.40, 0.3), {}],
  ['low under high', seq([52, 40, 55, 43, 57, 45, 59, 47], 0.38, 0.3), {}],
  ['bass walk + open e', seq([40, 64, 42, 64, 43, 64, 44, 64], 0.30, 0.3), {}],
  ['soft under loud', seq([40, 55, 45, 59, 47, 62, 52, 64], 0.45, [0.5, 0.07, 0.5, 0.07, 0.5, 0.07, 0.5, 0.07]), {}],
  ['re-picked note', seq([57, 57, 57, 57, 52, 52, 52, 52], 0.30, 0.3), {}],
  ['fast run (16ths, 120)', seq([52, 54, 55, 57, 59, 60, 62, 64, 62, 60, 59, 57], 0.125, 0.3), { ring: 0.14 }],
  ['fast let-ring semitones', seq([52, 54, 55, 57, 59, 60, 62, 64], 0.125, 0.3), { ring: 0.8 }],
  ['driven riff', seq([40, 40, 43, 45, 40, 40, 46, 45], 0.25, 0.35), { drive: 4, ring: 0.9 }],
  ['60 Hz hum', seq([40, 45, 50, 55, 59, 64, 57, 52], 0.5, 0.25), { hum: 0.02, humHz: 60, ring: 1.2 }],
  ['50 Hz hum', seq([41, 46, 50, 55, 58, 63, 57, 52], 0.5, 0.25), { hum: 0.02, humHz: 50, ring: 1.2 }],
  ['soft notes, loud 50 Hz hum', seq([40, 43, 45, 47, 50, 52, 55, 57], 0.5, 0.06), { hum: 0.04, humHz: 50, ring: 1.2 }],
  ['soft notes, loud 60 Hz hum', seq([40, 43, 45, 47, 50, 52, 55, 57], 0.5, 0.06), { hum: 0.04, humHz: 60, ring: 1.2 }],
];

function run(opts, sr, notes, cfg) {
  let Proc; const msgs = [];
  global.sampleRate = sr; global.currentFrame = 0;
  global.AudioWorkletProcessor = class { constructor() { this.port = { postMessage: (m) => msgs.push(m) }; } };
  global.registerProcessor = (n, c) => { Proc = c; };
  delete require.cache[require.resolve('../js/worklet.js')];
  require('../js/worklet.js').guitarQuestWorklet();
  const sig = render(sr, notes, cfg);
  const p = new Proc({ processorOptions: { gateDb: -50, opts: Object.assign({}, opts, cfg.hum && opts.hum === 'auto' ? { hum: cfg.humHz } : { hum: opts.hum === 'auto' ? 0 : opts.hum }) } });
  for (let i = 0; i + 128 <= sig.length; i += 128) { global.currentFrame = i; p.process([[sig.subarray(i, i + 128)]]); }
  const got = msgs.filter((m) => m.type === 'note' && !m.legato), un = msgs.filter((m) => m.type === 'unclear');
  const r = { n: notes.length, right: 0, wrong: 0, unclear: 0, missed: 0, extra: 0, lat: [], terr: [] };
  const used = new Set();
  notes.forEach((nt, i) => {
    const win = Math.min(0.06, (i + 1 < notes.length ? notes[i + 1].t - nt.t : 1) * 0.5);
    const n = got.find((x) => !used.has(x) && Math.abs(x.onsetFrame / sr - nt.t) < win);
    if (n) {
      used.add(n);
      const hm = Math.round(69 + 12 * Math.log2(n.freq / 440));
      if (hm === nt.m) { r.right++; r.lat.push(n.detectMs); r.terr.push(Math.abs(n.onsetFrame / sr - nt.t) * 1000); }
      else if (n.ringing || [12, 19, 24].includes(Math.abs(hm - nt.m))) r.unclear++;
      else r.wrong++;
    } else if (un.some((x) => Math.abs(x.onsetFrame / sr - nt.t) < win)) r.unclear++;
    else r.missed++;
  });
  r.extra = got.filter((x) => !used.has(x)).length;
  return r;
}
function bench(name, opts) {
  const T = { n: 0, right: 0, wrong: 0, unclear: 0, missed: 0, extra: 0, lat: [], terr: [] }, per = [];
  for (const sr of [48000, 44100]) for (const [sn, notes, cfg] of SCEN) {
    const r = run(opts, sr, notes, cfg);
    for (const k of ['n', 'right', 'wrong', 'unclear', 'missed', 'extra']) T[k] += r[k];
    T.lat.push(...r.lat); T.terr.push(...r.terr);
    if (sr === 48000) per.push(`${sn}:${r.right}/${r.n}${r.wrong ? ' W' + r.wrong : ''}${r.extra ? ' +' + r.extra : ''}`);
  }
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const score = T.right - 3 * T.wrong - T.extra - 0.5 * T.missed;
  console.log(`${name.padEnd(34)} right ${String(T.right).padStart(3)}/${T.n} wrong ${T.wrong} unclear ${String(T.unclear).padStart(2)} missed ${String(T.missed).padStart(2)} extra ${String(T.extra).padStart(2)}  detect ${avg(T.lat).toFixed(0)} ms (max ${Math.max(...T.lat).toFixed(0)})  onset err ${avg(T.terr).toFixed(1)} ms  score ${score}`);
  if (process.env.DETAIL) console.log('   ' + per.join(' | '));
  return { T, score };
}
module.exports = { bench };
if (require.main === module) {
  // the original detector, the defaults, and each setting changed on its own
  const orig = { hum: 0, onset: 'energy', sens: 'normal', ring: 'normal', pitchLp: false, confirm: 2 };
  const def = { hum: 'auto', onset: 'flux', sens: 'normal', ring: 'normal', pitchLp: false, confirm: 2 };
  const sets = JSON.parse(process.env.SETS || 'null') || [
    ['original detector', orig], ['defaults', def],
    ['  onset: level change', { ...def, onset: 'energy' }], ['  sensitivity: low', { ...def, sens: 'low' }], ['  sensitivity: high', { ...def, sens: 'high' }],
    ['  ringing notes: off', { ...def, ring: 'off' }], ['  ringing notes: strong', { ...def, ring: 'strong' }],
    ['  pitch low-pass: on', { ...def, pitchLp: true }], ['  confirm: careful (3)', { ...def, confirm: 3 }], ['  hum filter: off', { ...def, hum: 0 }],
  ];
  for (const [n, o] of sets) bench(n, o);
}
