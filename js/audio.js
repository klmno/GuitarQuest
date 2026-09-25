/* GuitarQuest: audio input engine.
 * Direct input only (REQ-HW-1..7): device choice, voice processing off, microphone refusal for scoring,
 * device-loss handling, noise floor, level, monitoring with an amp tone, calibration offset. */
(function (G) {
  'use strict';
  const GQ = G.GQ, store = GQ.store;
  const A = (GQ.audio = new GQ.Emitter());

  A.ctx = null; A.stream = null; A.track = null; A.node = null; A.source = null;
  A.devices = []; A.deviceId = null; A.deviceLabel = '';
  A.level = { peakDb: -120, rmsDb: -120, clipUntil: 0 };
  A.pitch = null;               // latest {f, conf, frame}
  A.gateDb = -55;
  A.inputLatencyMs = NaN;
  A.CONF_MIN = 0.8;
  let lastCtxT = 0, lastPerf = 0;

  // Per-device data is keyed by the device name: browsers may hand out a new deviceId after a
  // reload (always for pages opened from a file), but the Enya keeps its name.
  A.keyOf = (dev) => (dev && dev.label ? 'label:' + dev.label : dev ? dev.deviceId : '');
  A.key = () => A.keyOf(A.current());
  A.findSaved = function () {
    const s = store.settings();
    return A.devices.find((d) => d.deviceId === s.deviceId) || (s.deviceLabel ? A.devices.find((d) => d.label === s.deviceLabel) : null) || null;
  };
  A.supported = () => !!(G.navigator && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && G.AudioWorkletNode);

  // ---- device classification (REQ-HW-2) ----
  A.classify = function (dev) {
    const l = (dev.label || '').toLowerCase();
    const ov = A.keyOf(dev) ? store.device(A.keyOf(dev)).isGuitar : undefined;
    if (ov === true) return { kind: 'guitar', text: 'Guitar (you confirmed it)', cls: 'good', scored: true };
    if (ov === false) return { kind: 'mic', text: 'Microphone (you marked it)', cls: 'bad', scored: false };
    if (dev.deviceId === 'default' || dev.deviceId === 'communications')
      return { kind: 'alias', text: 'System default: pick the device itself', cls: 'warn', scored: false };
    if (/enya|inspire|guitar/.test(l)) return { kind: 'guitar', text: 'Guitar (direct)', cls: 'good', scored: true };
    if (/built-?in|internal|macbook|imac|iphone|ipad|webcam|camera|facetime|airpods|array/.test(l))
      return { kind: 'mic', text: 'Microphone: tuner and free play only', cls: 'bad', scored: false };
    if (/usb|interface|line|instrument|hi-?z|scarlett|focusrite|irig|audient|motu|presonus|steinberg|behringer|zoom|codec|umc/.test(l))
      return { kind: 'direct', text: 'Direct input', cls: 'good', scored: true };
    if (/microphone|\bmic\b|headset/.test(l)) return { kind: 'mic', text: 'Microphone: tuner and free play only', cls: 'bad', scored: false };
    return { kind: 'unknown', text: 'Unknown input: confirm it is the guitar', cls: 'warn', scored: false };
  };
  A.current = () => A.devices.find((d) => d.deviceId === A.deviceId) || (A.deviceId ? { deviceId: A.deviceId, label: A.deviceLabel } : null);
  A.canScore = () => { const d = A.current(); return !!(A.ctx && d && A.classify(d).scored); };
  A.markGuitar = function (isGuitar) { if (A.deviceId) { store.setDevice(A.key(), { isGuitar }); A.emit('device', A.current()); } };

  function constraints(deviceId) {
    const a = { echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      sampleRate: { ideal: 48000 }, channelCount: { ideal: 2 }, latency: { ideal: 0 }, voiceIsolation: false };
    if (deviceId) a.deviceId = { exact: deviceId };
    return { audio: a, video: false };
  }

  A.requestPermission = async function () {
    const s = await navigator.mediaDevices.getUserMedia(constraints(null));
    s.getTracks().forEach((t) => t.stop());
    A.permitted = true;
    return A.refreshDevices();
  };
  A.refreshDevices = async function () {
    const all = await navigator.mediaDevices.enumerateDevices();
    A.devices = all.filter((d) => d.kind === 'audioinput');
    if (A.devices.some((d) => d.label)) A.permitted = true;
    A.emit('devices', A.devices);
    if (A.stream && A.deviceId && !A.devices.some((d) => d.deviceId === A.deviceId)) lost();
    return A.devices;
  };

  A.open = async function (deviceId) {
    await A.close(true);
    const stream = await navigator.mediaDevices.getUserMedia(constraints(deviceId));
    const track = stream.getAudioTracks()[0];
    const set = track.getSettings ? track.getSettings() : {};
    let ctx;
    try { ctx = new AudioContext({ latencyHint: 'interactive', sampleRate: set.sampleRate || undefined }); }
    catch { ctx = new AudioContext({ latencyHint: 'interactive' }); }
    const url = guitarQuestWorkletUrl();
    await ctx.audioWorklet.addModule(url);
    if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    const label0 = track.label || (A.devices.find((d) => d.deviceId === deviceId) || {}).label;
    const dev = store.device(label0 ? 'label:' + label0 : deviceId || set.deviceId || '');
    A.gateDb = dev.gateDb != null ? dev.gateDb : -55;
    const node = new AudioWorkletNode(ctx, 'guitar-input', {
      numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1],
      channelCountMode: 'max', channelInterpretation: 'discrete',
      processorOptions: { gateDb: A.gateDb, confMin: A.CONF_MIN },
    });
    const source = ctx.createMediaStreamSource(stream);
    source.connect(node);
    node.connect(ctx.destination); // silent output keeps the node running everywhere
    node.port.onmessage = (e) => onMsg(e.data);
    node.port.postMessage({ type: 'setChannel', mode: dev.channel || 'mix' });

    // output buses
    A.out = ctx.createGain(); A.out.connect(ctx.destination);
    A.metroBus = ctx.createGain(); A.metroBus.connect(A.out);
    A.backBus = ctx.createGain(); A.backBus.connect(A.out);
    A.monBus = ctx.createGain(); A.monBus.connect(A.out);

    Object.assign(A, { ctx, stream, track, source, node, deviceId: deviceId || set.deviceId, settings: set });
    A.deviceLabel = track.label || 'audio input';
    A.inputLatencyMs = set.latency != null ? set.latency * 1000 : NaN;
    A.applyMixer();
    A.setMonitor();
    track.onended = () => lost();
    store.setSetting('deviceId', A.deviceId);
    store.setSetting('deviceLabel', A.deviceLabel);
    if (ctx.state !== 'running') { try { await ctx.resume(); } catch { /* resumed on next tap */ } }
    A.emit('state', A.state());
    A.emit('device', A.current());
    // noise floor at the start of the session (REQ-DET-7), unless one was measured recently for this device
    if (!dev.floorAt || Date.now() - dev.floorAt > 12 * 3600e3) A.measureFloor();
    return set;
  };

  A.close = async function (quiet) {
    if (A.track) A.track.onended = null;
    if (A.stream) A.stream.getTracks().forEach((t) => t.stop());
    if (A.ctx) { try { await A.ctx.close(); } catch { /* closed */ } }
    Object.assign(A, { ctx: null, stream: null, track: null, source: null, node: null, pitch: null });
    if (!quiet) A.emit('state', A.state());
  };
  function lost() {
    const label = A.deviceLabel;
    A.close(true).then(() => { A.emit('lost', { label }); A.emit('state', A.state()); });
  }
  A.state = () => (!A.ctx ? 'closed' : A.ctx.state);
  A.resume = () => (A.ctx && A.ctx.state === 'suspended' ? A.ctx.resume() : Promise.resolve());

  // ---- gate / floor / channel ----
  A.setGate = function (db) {
    A.gateDb = Math.round(GQ.clamp(db, -80, -20));
    if (A.node) A.node.port.postMessage({ type: 'setGate', db: A.gateDb });
    if (A.deviceId) store.setDevice(A.key(), { gateDb: A.gateDb });
    A.emit('gate', A.gateDb);
  };
  A.measureFloor = function () {
    if (!A.node) return;
    A.measuringFloor = true;
    A.emit('floor-start');
    A.node.port.postMessage({ type: 'measureFloor', seconds: 2 });
  };
  A.setChannel = function (mode) {
    if (A.node) A.node.port.postMessage({ type: 'setChannel', mode });
    if (A.deviceId) store.setDevice(A.key(), { channel: mode });
  };

  // ---- mixer & monitoring (REQ-FN-5, REQ-HW-7) ----
  A.applyMixer = function () {
    if (!A.ctx) return;
    const s = store.settings(), t = A.ctx.currentTime;
    A.metroBus.gain.setTargetAtTime(s.metronome ? s.metronomeVol : 0, t, 0.02);
    A.backBus.gain.setTargetAtTime(s.backing ? s.backingVol : 0, t, 0.02);
    A.monBus.gain.setTargetAtTime(s.monitor ? s.monitorVol : 0, t, 0.02);
  };
  function curve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
    return c;
  }
  A.setMonitor = function () {
    if (!A.ctx) return;
    const s = store.settings();
    if (A.monChain) { try { A.source.disconnect(A.monChain.input); } catch { /* */ } A.monChain.output.disconnect(); A.monChain = null; }
    if (!s.monitor) { A.applyMixer(); return; }
    const ctx = A.ctx;
    // shortest possible path for clean; a small amp model otherwise
    if (s.ampTone === 'clean') {
      const g = ctx.createGain();
      A.monChain = { input: g, output: g };
    } else {
      const pre = ctx.createGain(); pre.gain.value = s.ampTone === 'crunch' ? 6 : 2;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 80;
      const ws = ctx.createWaveShaper(); ws.curve = curve(s.ampTone === 'crunch' ? 4 : 1.5); ws.oversample = '2x';
      const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = s.ampTone === 'crunch' ? 4200 : 6000;
      const post = ctx.createGain(); post.gain.value = s.ampTone === 'crunch' ? 0.35 : 0.6;
      pre.connect(hp).connect(ws).connect(cab).connect(post);
      A.monChain = { input: pre, output: post };
    }
    A.source.connect(A.monChain.input);
    A.monChain.output.connect(A.monBus);
    A.applyMixer();
  };

  // ---- clocks ----
  // Smooth context time for drawing (ctx.currentTime moves in audio-callback steps)
  A.now = function () {
    if (!A.ctx) return 0;
    const t = A.ctx.currentTime, p = performance.now();
    if (t !== lastCtxT) { lastCtxT = t; lastPerf = p; return t; }
    return t + Math.min(0.05, (p - lastPerf) / 1000);
  };
  A.outputLatency = () => (A.ctx ? (A.ctx.outputLatency || 0) + (A.ctx.baseLatency || 0) : 0);
  // Calibration offset (s) for the current device: subtract from onset times before comparing with the beat
  A.calibration = () => (A.deviceId ? store.device(A.key()).calib || null : null);
  A.offsetSec = () => { const c = A.calibration(); return c ? c.offsetMs / 1000 : A.outputLatency() + (Number.isFinite(A.inputLatencyMs) ? A.inputLatencyMs / 1000 : 0.01); };

  // ---- worklet messages ----
  function onMsg(m) {
    switch (m.type) {
      case 'frame': {
        const L = A.level;
        L.peakDb = m.peakDb; L.rmsDb = m.rmsDb;
        if (m.clip > 0) L.clipUntil = performance.now() + 1500;
        A.pitch = m.pitch; A.gateOpen = m.gateOpen; A.analyses = m.analyses; A.lastFrameTime = m.time;
        A.emit('frame', m);
        break;
      }
      case 'floor': {
        A.measuringFloor = false;
        const gate = GQ.clamp(Math.max(m.rmsDb + 12, m.peakDb + 3), -80, -35);
        A.setGate(gate);
        if (A.deviceId) store.setDevice(A.key(), { floorAt: Date.now(), floorDb: m.rmsDb });
        A.emit('floor', { ...m, gate });
        break;
      }
      default: A.emit(m.type, m); // onset, note, chroma, unclear
    }
  }

  // ---- calibration (REQ-DET-4): play along with clicks, median offset ----
  A.calibrate = function ({ bpm = 90, clicks = 16, onTick } = {}) {
    return new Promise((resolve, reject) => {
      if (!A.ctx) return reject(new Error('No input open'));
      const spb = 60 / bpm, count = 4, t0 = A.ctx.currentTime + 0.4;
      const times = [];
      for (let i = 0; i < count + clicks; i++) {
        const t = t0 + i * spb; times.push(t);
        GQ.sound.click(t, i < count ? 2 : ((i - count) % 4 === 0 ? 1 : 0), A.out);
      }
      const onsets = [];
      const off = A.on('onset', (m) => onsets.push(m.time));
      const end = times[times.length - 1] + spb * 0.6;
      const iv = setInterval(() => {
        const now = A.ctx ? A.ctx.currentTime : Infinity;
        if (onTick) onTick(times.findIndex((t) => now >= t && now < t + spb * 0.5), times.length, count);
        if (now < end + 0.1) return;
        clearInterval(iv); off();
        const offs = [], used = new Set(), hits = [];
        for (let i = count; i < times.length; i++) {
          let best = -1, bd = Infinity;
          onsets.forEach((o, j) => { const d = Math.abs(o - times[i]); if (!used.has(j) && d < bd && d < spb * 0.45) { best = j; bd = d; } });
          hits.push(best >= 0);
          if (best >= 0) { used.add(best); offs.push((onsets[best] - times[i]) * 1000); }
        }
        if (offs.length < Math.max(4, clicks / 2)) return resolve({ ok: false, hits, n: clicks, found: offs.length });
        const med = GQ.median(offs), mad = GQ.median(offs.map((x) => Math.abs(x - med)));
        const res = { ok: true, offsetMs: +med.toFixed(1), spreadMs: +mad.toFixed(1), found: offs.length, n: clicks, hits, date: new Date().toISOString() };
        if (A.deviceId) store.setDevice(A.key(), { calib: res });
        resolve(res);
      }, 30);
    });
  };

  // ---- lifecycle ----
  if (G.navigator && navigator.mediaDevices && navigator.mediaDevices.addEventListener)
    navigator.mediaDevices.addEventListener('devicechange', () => { if (A.permitted) A.refreshDevices().catch(() => {}); });
  let hiddenAt = 0;
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
    if (document.hidden) { hiddenAt = performance.now(); return; }
    if (A.ctx && hiddenAt && performance.now() - hiddenAt > 3000) { A.resume(); A.emit('resumed'); }
  });
  store.on('profile', () => { A.applyMixer(); A.setMonitor(); });
  store.on('settings', (e) => {
    if (/^(metronome|backing|monitorVol)/.test(e.key)) A.applyMixer();
    if (e.key === 'monitor' || e.key === 'ampTone') A.setMonitor();
  });
})(typeof window !== 'undefined' ? window : globalThis);
