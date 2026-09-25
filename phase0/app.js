/* GuitarQuest Phase 0: prove the input works.
 * Device picker, level meter, live pitch readout, latency measurement.
 * Plain JavaScript, no build step (REQ-NF-5). */
'use strict';

const $ = (id) => document.getElementById(id);
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const OPEN_STRINGS = [ // standard tuning, low to high
  { name: 'E', num: 6, midi: 40 }, { name: 'A', num: 5, midi: 45 }, { name: 'D', num: 4, midi: 50 },
  { name: 'G', num: 3, midi: 55 }, { name: 'B', num: 2, midi: 59 }, { name: 'e', num: 1, midi: 64 },
];
const CONF_MIN = 0.8;          // below this: "I didn't hear that clearly" (REQ-DET-6)
const LATENCY_BUDGET_MS = 60;  // REQ-DET-3

// ---------- storage (per-viewer convenience only; always optional) ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('gq.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('gq.' + k, JSON.stringify(v)); } catch { /* private mode etc. */ } },
};

// ---------- state ----------
const S = {
  ctx: null, stream: null, track: null, source: null, node: null, monGain: null,
  devices: [], deviceId: null, deviceLabel: '', opening: false,
  sr: 48000, refA4: 440,
  latestTime: 0,             // context time of the newest analysis frame
  pitch: null, gateOpen: false, lastVoiced: 0,
  level: { peakDb: -120, rmsDb: -120, holdDb: -120, holdT: 0, clipUntil: 0, recent: [] },
  trace: [], onsets: [], history: [],
  lat: { detect: [], paint: [] }, pendingPaint: [],
  cal: null,
  frames: 0, fpsT: performance.now(), analyses: 0, analysesPrev: 0,
  hiddenAt: 0,
};

// ---------- helpers ----------
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const fmtMs = (v) => (Number.isFinite(v) ? v.toFixed(1) + ' ms' : '–');
const fmtDb = (v) => (v > -100 ? v.toFixed(1) : '–∞');
function freqToMidi(f) { return 69 + 12 * Math.log2(f / S.refA4); }
function midiName(m) { const r = Math.round(m); return { name: NOTE_NAMES[((r % 12) + 12) % 12], octave: Math.floor(r / 12) - 1, midi: r }; }
function positionsFor(midi) {
  const out = [];
  for (const s of OPEN_STRINGS) { const fret = midi - s.midi; if (fret >= 0 && fret <= 24) out.push(`s${s.num} f${fret}`); }
  return out;
}

// ---------- device classification (REQ-HW-2) ----------
function classify(dev) {
  const l = (dev.label || '').toLowerCase();
  if (dev.deviceId === 'default' || dev.deviceId === 'communications')
    return { kind: 'alias', text: 'System default: may be the microphone, pick the device itself', cls: 'warn', scored: false };
  if (/built-?in|internal|macbook|imac|iphone|ipad|webcam|camera|facetime|airpods|array/.test(l))
    return { kind: 'mic', text: 'Microphone: tuner and free play only, not for scoring', cls: 'bad', scored: false };
  if (/enya|inspire|guitar/.test(l))
    return { kind: 'guitar', text: 'Looks like the guitar (direct)', cls: 'good', scored: true };
  if (/usb|interface|line|instrument|hi-?z|scarlett|focusrite|irig|audient|motu|presonus|steinberg|behringer|zoom|codec|umc/.test(l))
    return { kind: 'direct', text: 'Direct input (probably)', cls: 'good', scored: true };
  if (/microphone|\bmic\b|headset/.test(l))
    return { kind: 'mic', text: 'Microphone: tuner and free play only, not for scoring', cls: 'bad', scored: false };
  return { kind: 'unknown', text: 'Unknown: check this is the guitar', cls: 'warn', scored: false };
}

function captureConstraints(deviceId) {
  // REQ-HW-3: every voice-processing feature off, music sample rate, lowest latency.
  const a = {
    echoCancellation: false, noiseSuppression: false, autoGainControl: false,
    sampleRate: { ideal: 48000 }, channelCount: { ideal: 2 }, latency: { ideal: 0 },
  };
  a.voiceIsolation = false; // newer Chrome/Safari; ignored where unknown
  if (deviceId) a.deviceId = { exact: deviceId };
  return { audio: a, video: false };
}

// ---------- 1. device picker ----------
async function allowAudio() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showBanner('This browser cannot capture audio here. It needs a secure page (https or localhost) and a current Chrome, Edge, Safari or Firefox.');
    return;
  }
  if (!window.AudioWorkletNode) { showBanner('This browser has no AudioWorklet support, which the pitch detector needs.'); return; }
  try {
    // Labels are only visible after permission, so open and close a stream once.
    const s = await navigator.mediaDevices.getUserMedia(captureConstraints(null));
    s.getTracks().forEach((t) => t.stop());
  } catch (e) {
    showBanner('Audio access was refused (' + e.name + '). Allow it in the browser\'s site settings and try again.');
    return;
  }
  $('btn-refresh').disabled = false;
  $('device').disabled = false;
  $('btn-allow').textContent = 'Access allowed';
  $('btn-allow').disabled = true;
  await refreshDevices();
  const saved = store.get('deviceId', null);
  if (saved && S.devices.some((d) => d.deviceId === saved)) openDevice(saved);
}

async function refreshDevices() {
  const all = await navigator.mediaDevices.enumerateDevices();
  S.devices = all.filter((d) => d.kind === 'audioinput');
  const sel = $('device');
  const keep = sel.value || S.deviceId || store.get('deviceId', null);
  sel.innerHTML = '';
  if (!S.devices.length) { sel.innerHTML = '<option value="">No audio inputs found</option>'; $('btn-open').disabled = true; return; }
  // guitar-like devices first
  const rank = { guitar: 0, direct: 1, unknown: 2, alias: 3, mic: 4 };
  const list = S.devices.map((d) => ({ d, c: classify(d) })).sort((a, b) => rank[a.c.kind] - rank[b.c.kind]);
  for (const { d, c } of list) {
    const o = document.createElement('option');
    o.value = d.deviceId;
    o.textContent = (d.label || 'Unnamed input') + (c.scored ? '' : c.kind === 'mic' ? '  (microphone)' : c.kind === 'alias' ? '  (default alias)' : '');
    sel.appendChild(o);
  }
  if (keep && S.devices.some((d) => d.deviceId === keep)) sel.value = keep;
  $('btn-open').disabled = false;
  updateBadge();
  // lost device while running? (REQ-HW-4)
  if (S.stream && S.deviceId && !S.devices.some((d) => d.deviceId === S.deviceId)) deviceLost();
}

function updateBadge() {
  const d = S.devices.find((x) => x.deviceId === $('device').value);
  const b = $('device-badge');
  if (!d) { b.className = 'badge'; b.textContent = 'No device'; return; }
  const c = classify(d);
  b.className = 'badge ' + c.cls;
  b.textContent = c.text;
}

async function openDevice(deviceId) {
  if (S.opening) return;
  S.opening = true;
  hideBanner();
  try {
    await closeDevice();
    const stream = await navigator.mediaDevices.getUserMedia(captureConstraints(deviceId));
    const track = stream.getAudioTracks()[0];
    const set = track.getSettings ? track.getSettings() : {};
    // Run the context at the device's own rate to avoid resampling.
    let ctx;
    try { ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: set.sampleRate || undefined }); }
    catch { ctx = new AudioContext({ latencyHint: 'interactive' }); }
    const url = guitarQuestWorkletUrl();
    await ctx.audioWorklet.addModule(url);
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    const gateDb = store.get('gate.' + deviceId, +$('gate').value);
    const node = new AudioWorkletNode(ctx, 'guitar-input', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      channelCountMode: 'max', channelInterpretation: 'discrete',
      processorOptions: { gateDb, confMin: CONF_MIN },
    });
    const source = ctx.createMediaStreamSource(stream);
    source.connect(node);
    node.connect(ctx.destination); // outputs silence; keeps the node pulled in every browser
    node.port.onmessage = (e) => onWorklet(e.data);
    node.port.postMessage({ type: 'setChannel', mode: $('channel').value });

    const monGain = ctx.createGain();
    monGain.gain.value = +$('monitor-vol').value;
    Object.assign(S, { ctx, stream, track, source, node, monGain, sr: ctx.sampleRate, deviceId });
    S.deviceLabel = track.label || 'the audio input';
    setMonitor($('monitor').checked);
    setGate(gateDb, false);

    track.onended = () => deviceLost();
    store.set('deviceId', deviceId);
    $('device').value = deviceId;
    updateBadge();
    showSettings(set);
    resetLatency();
    $('btn-floor').disabled = false;
    $('btn-cal').disabled = false;
    $('btn-open').textContent = 'Reopen device';
    showCalSaved();
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch { /* resumes on the next tap */ } }
    if (ctx.state !== 'running') showBanner('Tap anywhere to start audio.', true);
    const c = classify(S.devices.find((d) => d.deviceId === deviceId) || { label: S.deviceLabel, deviceId });
    if (!c.scored) setStatus('level-msg', c.kind === 'mic'
      ? 'This is a microphone. It works for the tuner and free play, but scored lessons will refuse it.'
      : 'Could not confirm this is the guitar. Check the device name.', 'warn');
  } catch (e) {
    console.error(e);
    showBanner('Could not open that input: ' + (e.message || e.name) + '. Is the guitar switched on and connected?');
  } finally {
    S.opening = false;
  }
}

async function closeDevice() {
  if (S.track) S.track.onended = null;
  if (S.stream) S.stream.getTracks().forEach((t) => t.stop());
  if (S.ctx) { try { await S.ctx.close(); } catch { /* already closed */ } }
  Object.assign(S, { ctx: null, stream: null, track: null, source: null, node: null, monGain: null, cal: null });
  S.pitch = null;
}

function deviceLost() {
  const label = S.deviceLabel || 'the audio input';
  closeDevice();
  $('btn-floor').disabled = true;
  $('btn-cal').disabled = true;
  $('btn-open').textContent = 'Open device';
  showBanner(`Lost ${label}. Everything is paused and nothing was scored. Reconnect it, then pick it again.`, false, 'Choose device', async () => {
    await refreshDevices(); $('device').focus();
  });
}

function showSettings(s) {
  const rows = [];
  const add = (name, val, ok) => rows.push(`<li><span>${name}</span><span class="${ok === true ? 'ok' : ok === false ? 'no' : 'na'}">${val}</span></li>`);
  const flag = (v) => (v === undefined ? ['not reported', null] : v === false ? ['off ✓', true] : ['ON ✗', false]);
  for (const k of ['echoCancellation', 'noiseSuppression', 'autoGainControl']) { const [t, ok] = flag(s[k]); add(k, t, ok); }
  if (s.voiceIsolation !== undefined) { const [t, ok] = flag(s.voiceIsolation); add('voiceIsolation', t, ok); }
  add('sampleRate', s.sampleRate ? s.sampleRate + ' Hz' : 'not reported', s.sampleRate ? [44100, 48000].includes(s.sampleRate) : null);
  add('AudioContext rate', S.ctx.sampleRate + ' Hz' + (s.sampleRate && s.sampleRate !== S.ctx.sampleRate ? ' (resampled)' : ''), s.sampleRate ? s.sampleRate === S.ctx.sampleRate : null);
  add('channelCount', s.channelCount != null ? String(s.channelCount) : 'not reported', null);
  add('latency', s.latency != null ? (s.latency * 1000).toFixed(1) + ' ms' : 'not reported', null);
  $('settings').innerHTML = rows.join('');
  S.inputLatencyMs = s.latency != null ? s.latency * 1000 : NaN;
}

// ---------- monitoring (REQ-HW-7) ----------
function setMonitor(on) {
  if (!S.source || !S.monGain) return;
  try { S.source.disconnect(S.monGain); } catch { /* not connected */ }
  try { S.monGain.disconnect(); } catch { /* not connected */ }
  if (on) { S.source.connect(S.monGain); S.monGain.connect(S.ctx.destination); }
}

// ---------- 2. level & gate ----------
function setGate(db, save = true) {
  db = Math.round(clamp(db, -80, -20));
  $('gate').value = db;
  $('gate-val').textContent = db + ' dBFS';
  $('meter-gate').style.left = dbToPct(db) + '%';
  if (S.node) S.node.port.postMessage({ type: 'setGate', db });
  if (save && S.deviceId) store.set('gate.' + S.deviceId, db);
  S.gateDb = db;
}
function dbToPct(db) { return clamp((db + 60) / 60, 0, 1) * 100; }

function measureFloor() {
  if (!S.node) return;
  $('btn-floor').disabled = true;
  setStatus('floor-msg', 'Measuring… keep your hands off the strings.');
  S.node.port.postMessage({ type: 'measureFloor', seconds: 2 });
}

// ---------- worklet messages ----------
function onWorklet(m) {
  switch (m.type) {
    case 'frame': onFrame(m); break;
    case 'onset': onOnset(m); break;
    case 'note': onNote(m); break;
    case 'unclear': onUnclear(m); break;
    case 'floor': onFloor(m); break;
  }
}

function onFrame(m) {
  const now = performance.now();
  S.latestTime = m.time;
  const L = S.level;
  L.peakDb = m.peakDb; L.rmsDb = m.rmsDb;
  if (m.peakDb >= L.holdDb || now - L.holdT > 1200) { L.holdDb = m.peakDb; L.holdT = now; }
  if (m.clip > 0) L.clipUntil = now + 1500;
  L.recent.push({ t: now, peak: m.peakDb });
  while (L.recent.length && now - L.recent[0].t > 3000) L.recent.shift();
  S.gateOpen = m.gateOpen;
  S.pitch = m.pitch;
  S.analyses = m.analyses;
  if (m.pitch) {
    S.trace.push({ t: m.time, midi: freqToMidi(m.pitch.f), conf: m.pitch.conf });
    if (m.pitch.conf >= CONF_MIN) S.lastVoiced = now;
  }
  const cutoff = m.time - 8;
  while (S.trace.length && S.trace[0].t < cutoff) S.trace.shift();
  while (S.onsets.length && S.onsets[0].t < cutoff) S.onsets.shift();
}

function onOnset(m) {
  S.onsets.push({ t: m.time, note: null });
  if (S.cal && S.cal.active) S.cal.onsets.push(m.time);
}

function onNote(m) {
  const mid = freqToMidi(m.freq);
  const n = midiName(mid);
  S.history.unshift({ label: n.name + n.octave, ms: m.detectMs, legato: m.legato });
  S.history.length = Math.min(S.history.length, 8);
  const o = S.onsets[S.onsets.length - 1];
  if (o && !m.legato) o.note = n.name + n.octave;
  if (!m.legato && m.detectMs != null) {
    push(S.lat.detect, m.detectMs);
    // delivery lag: how far the audio clock had moved on when this message arrived
    const lagMs = S.ctx ? Math.max(0, (S.ctx.currentTime - m.frame / S.sr) * 1000) : 0;
    S.pendingPaint.push({ recv: performance.now(), lagMs });
  }
}
function push(arr, v) { arr.push(v); if (arr.length > 30) arr.shift(); }

function onUnclear() {
  setStatus('pitch-state', "I didn't hear that clearly. No mistake counted.", 'warn');
  S.unclearUntil = performance.now() + 1200;
}

function onFloor(m) {
  $('btn-floor').disabled = false;
  const gate = clamp(Math.max(m.rmsDb + 12, m.peakDb + 3), -80, -25);
  setGate(gate);
  setStatus('floor-msg', `Noise floor ${fmtDb(m.rmsDb)} dBFS RMS, peak ${fmtDb(m.peakDb)} dBFS. Gate set to ${Math.round(gate)} dBFS.`);
}

// ---------- 4. latency ----------
function resetLatency() { S.lat.detect = []; S.lat.paint = []; S.pendingPaint = []; renderLatency(); }

function renderLatency() {
  const ctx = S.ctx;
  const inMs = S.inputLatencyMs;
  const base = ctx && ctx.baseLatency != null ? ctx.baseLatency * 1000 : NaN;
  const det = median(S.lat.detect), paint = median(S.lat.paint);
  $('l-input').textContent = Number.isFinite(inMs) ? fmtMs(inMs) : 'not reported';
  $('l-base').textContent = fmtMs(base);
  $('l-detect').textContent = S.lat.detect.length ? `${fmtMs(det)} (last ${fmtMs(S.lat.detect[S.lat.detect.length - 1])})` : '–';
  $('l-paint').textContent = fmtMs(paint);
  const out = ctx && ctx.outputLatency ? ctx.outputLatency * 1000 : NaN;
  $('l-output').textContent = Number.isFinite(out) ? fmtMs(out) : (ctx ? 'not reported by this browser' : '–');
  const v = $('l-verdict');
  if (!S.lat.detect.length) { $('l-total').textContent = '–'; v.className = 'badge'; v.textContent = 'No samples yet'; $('l-count').textContent = ''; return; }
  const total = (Number.isFinite(inMs) ? inMs : 0) + (Number.isFinite(base) ? base : 0) + det + (Number.isFinite(paint) ? paint : 0);
  $('l-total').textContent = fmtMs(total) + (Number.isFinite(inMs) ? '' : ' + input');
  const ok = total <= LATENCY_BUDGET_MS;
  v.className = 'badge ' + (ok ? 'good' : 'bad');
  v.textContent = ok ? 'Within the 60 ms budget' : 'Over the 60 ms budget';
  $('l-count').textContent = `${S.lat.detect.length} notes`;
}

// play-along calibration
function startCalibration() {
  const ctx = S.ctx; if (!ctx) return;
  const bpm = clamp(+$('cal-bpm').value || 90, 50, 160), n = clamp(+$('cal-n').value || 16, 8, 64);
  const spb = 60 / bpm, count = 4, t0 = ctx.currentTime + 0.4;
  const clicks = [];
  for (let i = 0; i < count + n; i++) {
    const t = t0 + i * spb; clicks.push(t);
    scheduleClick(t, i < count ? (i === 0 ? 1600 : 1200) : (((i - count) % 4 === 0) ? 1400 : 1000), i < count ? 0.5 : 0.35);
  }
  S.cal = { active: true, clicks, count, n, spb, onsets: [], end: clicks[clicks.length - 1] + spb * 0.6, result: null };
  $('beats').innerHTML = clicks.map((_, i) => `<i class="${i < count ? 'count' : ''}"></i>`).join('');
  $('btn-cal').disabled = true;
  setStatus('cal-msg', 'Listen to the 4 count-in clicks, then pick a note on every click.');
}

function scheduleClick(t, freq, level) {
  const ctx = S.ctx;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(level, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  o.connect(g).connect(ctx.destination);
  o.start(t); o.stop(t + 0.07);
}

function tickCalibration() {
  const c = S.cal; if (!c || !c.active || !S.ctx) return;
  const now = S.ctx.currentTime;
  const dots = $('beats').children;
  for (let i = 0; i < c.clicks.length; i++) {
    const on = now >= c.clicks[i] && now < c.clicks[i] + c.spb * 0.5;
    dots[i].classList.toggle('now', on);
  }
  if (now > c.end + 0.1) finishCalibration();
}

function finishCalibration() {
  const c = S.cal; c.active = false;
  const offs = [], dots = $('beats').children;
  const used = new Set();
  for (let i = c.count; i < c.clicks.length; i++) {
    const t = c.clicks[i];
    let best = -1, bestD = Infinity;
    c.onsets.forEach((o, j) => { const d = Math.abs(o - t); if (!used.has(j) && d < bestD && d < c.spb * 0.45) { best = j; bestD = d; } });
    if (best >= 0) { used.add(best); offs.push((c.onsets[best] - t) * 1000); dots[i].className = 'hit'; }
    else dots[i].className = 'miss';
  }
  $('btn-cal').disabled = false;
  if (offs.length < Math.max(4, c.n / 2)) {
    setStatus('cal-msg', `Only ${offs.length} of ${c.n} clicks had a note near them. Check the level meter moves when you pick, then try again.`, 'bad');
    return;
  }
  const med = median(offs);
  const mad = median(offs.map((x) => Math.abs(x - med)));
  const res = { offsetMs: +med.toFixed(1), spreadMs: +mad.toFixed(1), hits: offs.length, n: c.n, date: new Date().toISOString(), label: S.deviceLabel };
  store.set('calib.' + S.deviceId, res);
  setStatus('cal-msg', `Offset ${med.toFixed(1)} ms (spread ±${mad.toFixed(1)} ms, ${offs.length}/${c.n} clicks).` +
    (mad > 25 ? ' The spread is wide: try again with shorter, cleaner picks.' : ''), mad > 25 ? 'warn' : 'good');
  showCalSaved();
}

function showCalSaved() {
  const r = S.deviceId && store.get('calib.' + S.deviceId, null);
  $('cal-saved').textContent = r
    ? `Saved for this device: ${r.offsetMs} ms ±${r.spreadMs} ms (${new Date(r.date).toLocaleString()}).`
    : 'Not calibrated for this device yet.';
}

// ---------- rendering ----------
const trace = $('trace');
function drawTrace() {
  const dpr = window.devicePixelRatio || 1;
  const w = trace.clientWidth, h = trace.clientHeight;
  if (trace.width !== Math.round(w * dpr) || trace.height !== Math.round(h * dpr)) { trace.width = Math.round(w * dpr); trace.height = Math.round(h * dpr); }
  const g = trace.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  const lo = 38, hi = 90, span = 6, tEnd = S.latestTime, tStart = tEnd - span;
  const y = (m) => h - ((m - lo) / (hi - lo)) * h;
  const x = (t) => ((t - tStart) / span) * w;
  g.font = '11px ui-monospace, Menlo, monospace';
  // open strings as reference lines
  for (const s of OPEN_STRINGS) {
    g.strokeStyle = '#2b3038'; g.beginPath(); g.moveTo(0, y(s.midi)); g.lineTo(w, y(s.midi)); g.stroke();
    g.fillStyle = '#8b939e'; g.fillText(`${NOTE_NAMES[s.midi % 12]}${Math.floor(s.midi / 12) - 1} (open ${s.num})`, 4, y(s.midi) - 3);
  }
  for (const oct of [76, 88]) { g.strokeStyle = '#20242b'; g.beginPath(); g.moveTo(0, y(oct)); g.lineTo(w, y(oct)); g.stroke(); g.fillStyle = '#5c636d'; g.fillText(oct === 76 ? 'E5' : 'E6', 4, y(oct) - 3); }
  // onsets
  for (const o of S.onsets) {
    if (o.t < tStart) continue;
    g.strokeStyle = 'rgba(240,165,58,.5)'; g.beginPath(); g.moveTo(x(o.t), 0); g.lineTo(x(o.t), h); g.stroke();
    if (o.note) { g.fillStyle = '#f0a53a'; g.fillText(o.note, x(o.t) + 3, 12); }
  }
  // pitch points
  for (const p of S.trace) {
    if (p.t < tStart || p.midi < lo || p.midi > hi) continue;
    g.fillStyle = p.conf >= CONF_MIN ? '#3ecf8e' : 'rgba(139,147,158,.6)';
    g.fillRect(x(p.t) - 1.5, y(p.midi) - 1.5, 3, 3);
  }
}

function renderPitch(now) {
  const p = S.pitch;
  const noteEl = $('note'), needle = $('needle');
  const voiced = p && p.conf >= CONF_MIN;
  if (voiced) {
    const m = freqToMidi(p.f), n = midiName(m), cents = (m - n.midi) * 100;
    noteEl.innerHTML = `${n.name}<sub>${n.octave}</sub>`;
    noteEl.classList.remove('dim');
    $('freq').textContent = p.f.toFixed(2);
    $('cents').textContent = (cents >= 0 ? '+' : '') + cents.toFixed(1);
    needle.style.left = (50 + clamp(cents, -50, 50)) + '%';
    needle.className = 'cents-needle ' + (Math.abs(cents) <= 5 ? 'in' : Math.abs(cents) <= 15 ? 'near' : 'out');
    $('positions').textContent = positionsFor(n.midi).join('  ') || 'outside the neck';
    if (!(S.unclearUntil > now)) setStatus('pitch-state', '');
  } else if (p) {
    noteEl.classList.add('dim');
    if (!(S.unclearUntil > now)) setStatus('pitch-state', 'Signal, but no clear pitch.', 'warn');
  } else if (now - S.lastVoiced > 400) {
    noteEl.classList.add('dim');
    needle.className = 'cents-needle';
    if (!(S.unclearUntil > now)) setStatus('pitch-state', S.ctx ? 'Silence (below the gate).' : '');
  }
  const conf = p ? p.conf : 0;
  $('conf-fill').style.width = (conf * 100).toFixed(0) + '%';
  $('conf-fill').style.background = conf >= CONF_MIN ? 'var(--good)' : 'var(--muted)';
  $('conf-val').textContent = p ? conf.toFixed(2) : '–';
  $('history').innerHTML = S.history.map((h) => `<span>${h.label}${h.legato ? ' (legato)' : h.ms != null ? ` ${h.ms.toFixed(0)}ms` : ''}</span>`).join('');
}

function renderLevel(now) {
  const L = S.level;
  const pct = S.ctx ? dbToPct(L.peakDb) : 0;
  $('meter-mask').style.width = (100 - pct) + '%';
  $('meter-peak').style.left = `calc(${S.ctx ? dbToPct(L.holdDb) : 0}% - 1.5px)`;
  $('peak-db').textContent = S.ctx ? fmtDb(L.peakDb) : '–';
  $('rms-db').textContent = S.ctx ? fmtDb(L.rmsDb) : '–';
  const clipping = L.clipUntil > now;
  $('clip').classList.toggle('on', clipping);
  if (!S.ctx) return;
  const maxRecent = L.recent.reduce((a, r) => Math.max(a, r.peak), -200);
  if (clipping) setStatus('level-msg', 'Clipping. Turn the guitar volume down, or lower the input gain on the interface.', 'bad');
  else if (L.recent.length > 20 && maxRecent < S.gateDb) setStatus('level-msg', 'Nothing above the gate. Play a note; if the meter stays still, check the cable or choose another device.', 'warn');
  else if (maxRecent > S.gateDb && maxRecent < -36) setStatus('level-msg', 'Quiet. Detection still works, but more level (guitar volume up) helps.', 'warn');
  else if (maxRecent > -36) setStatus('level-msg', 'Level OK.', 'good');
}

function frame(now) {
  // Paint-time bookkeeping for latency: this frame shows any note that arrived before it.
  if (S.pendingPaint.length) {
    for (const p of S.pendingPaint) push(S.lat.paint, now - p.recv + p.lagMs);
    S.pendingPaint = [];
  }
  renderLevel(now);
  renderPitch(now);
  drawTrace();
  tickCalibration();
  // stats
  S.frames++;
  if (now - S.fpsT >= 1000) {
    $('fps').textContent = Math.round(S.frames * 1000 / (now - S.fpsT)) + ' fps';
    $('rate').textContent = S.ctx ? Math.round((S.analyses - S.analysesPrev) * 1000 / (now - S.fpsT)) + ' analyses/s' : '– analyses/s';
    S.analysesPrev = S.analyses; S.frames = 0; S.fpsT = now;
    renderLatency();
  }
  requestAnimationFrame(frame);
}

// ---------- banners & status ----------
function showBanner(text, info = false, actionLabel, action) {
  const b = $('banner');
  b.className = 'banner' + (info ? ' info' : '');
  b.innerHTML = '';
  const span = document.createElement('span'); span.textContent = text; b.appendChild(span);
  if (actionLabel) { const btn = document.createElement('button'); btn.className = 'primary small'; btn.textContent = actionLabel; btn.onclick = action; b.appendChild(btn); }
  const x = document.createElement('button'); x.className = 'ghost small'; x.textContent = 'Dismiss'; x.onclick = hideBanner; b.appendChild(x);
  b.hidden = false;
}
function hideBanner() { $('banner').hidden = true; }
function setStatus(id, text, cls = '') { const el = $(id); el.textContent = text; el.className = el.className.split(' ').filter((c) => !['warn', 'bad', 'good'].includes(c)).concat(cls ? [cls] : []).join(' '); }

// ---------- wiring ----------
$('btn-allow').onclick = allowAudio;
$('btn-refresh').onclick = refreshDevices;
$('device').onchange = updateBadge;
$('btn-open').onclick = () => openDevice($('device').value);
$('channel').onchange = (e) => { if (S.node) S.node.port.postMessage({ type: 'setChannel', mode: e.target.value }); store.set('channel', e.target.value); };
$('monitor').onchange = (e) => setMonitor(e.target.checked);
$('monitor-vol').oninput = (e) => { if (S.monGain) S.monGain.gain.setTargetAtTime(+e.target.value, S.ctx.currentTime, 0.01); };
$('gate').oninput = (e) => setGate(+e.target.value);
$('btn-floor').onclick = measureFloor;
$('btn-cal').onclick = startCalibration;
$('btn-lat-reset').onclick = resetLatency;
$('ref').onchange = (e) => { S.refA4 = clamp(+e.target.value || 440, 415, 466); e.target.value = S.refA4; store.set('refA4', S.refA4); };
document.addEventListener('pointerdown', () => { if (S.ctx && S.ctx.state === 'suspended') S.ctx.resume().then(hideBanner); });
if (navigator.mediaDevices && 'ondevicechange' in navigator.mediaDevices) navigator.mediaDevices.addEventListener('devicechange', () => { if (!$('device').disabled) refreshDevices(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { S.hiddenAt = performance.now(); return; }
  if (S.ctx && S.hiddenAt && performance.now() - S.hiddenAt > 3000) {
    S.ctx.resume().catch(() => {});
    resetLatency();
    showBanner('The page was in the background. Latency can change after resuming, so re-run the calibration before trusting timing.', true);
  }
});

// restore small preferences
S.refA4 = store.get('refA4', 440); $('ref').value = S.refA4;
$('channel').value = store.get('channel', 'mix');
setGate(-55, false);
requestAnimationFrame(frame);
