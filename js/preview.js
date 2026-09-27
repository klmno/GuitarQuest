/* GuitarQuest: "Listen" previews. Plays a lesson or song with a synthesised plucked string
 * (Karplus-Strong), so you can hear it before playing. Works with or without the guitar connected. */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory, N = GQ.notation, store = GQ.store;
  const P = (GQ.preview = new GQ.Emitter());
  let own = null;          // our own AudioContext when no input is open
  const cache = new Map();
  let job = null;

  function context() {
    if (GQ.audio.ctx) return { ctx: GQ.audio.ctx, out: GQ.audio.out };
    if (!own) {
      own = new (G.AudioContext || G.webkitAudioContext)({ latencyHint: 'interactive' });
      own.master = own.createGain(); own.master.gain.value = 0.9; own.master.connect(own.destination);
    }
    return { ctx: own, out: own.master };
  }

  // Plucked string (Karplus-Strong), cached per pitch and tone. The electric tones add a magnetic
  // pickup (a comb at the pickup position), a brighter loop filter and a long sustain; the amp,
  // cabinet and room come after, in makeAmp().
  const TONE = () => store.settings().previewTone || 'clean';
  function pluck(ctx, midi, muted) {
    const tone = TONE(), electric = tone !== 'acoustic';
    const key = ctx.sampleRate + '|' + midi + '|' + (muted ? 1 : 0) + '|' + (electric ? 'e' : 'a');
    if (cache.has(key)) return cache.get(key);
    const sr = ctx.sampleRate, f = T.midiToFreq(midi, store.settings().a4);
    const len = Math.round(sr * (muted ? 0.35 : electric ? 2.8 : 2.4));
    const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
    // loop filter w*a + (1-w)*b delays by (1-w); loop delay = Li - (1-w) + allpass delay = period L
    const w = electric ? 0.78 : 0.5;
    const L = sr / f, Li = Math.max(2, Math.floor(L + (1 - w) - 0.1)), frac = L - Li + (1 - w);
    const line = new Float32Array(Li);
    let seed = midi * 7919 + 1;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 * 2 - 1; };
    for (let i = 0; i < Li; i++) line[i] = rnd();
    // pick position: a plectrum a little way from the bridge, then smooth the burst so the attack isn't scratchy
    const pp = Math.max(1, Math.round(Li * (electric ? 0.14 : 0.2))), copy = line.slice();
    for (let i = 0; i < Li; i++) line[i] = copy[i] - copy[(i + pp) % Li];
    if (electric) { let m = 0; for (let k = 0; k < 2; k++) for (let i = 0; i < Li; i++) { m += 0.5 * (line[i] - m); line[i] = m; } }
    const t60 = muted ? 0.12 : electric ? Math.max(2.2, 6.5 - (midi - 40) * 0.07) : Math.max(0.8, 4 - (midi - 40) * 0.04);
    const decay = Math.pow(0.001, 1 / (f * t60));
    const C = (1 - frac) / (1 + frac);
    const Dp = Math.max(1, Math.round(L * 0.23));               // neck-ish pickup position comb
    const hist = new Float32Array(Dp + 1);
    let idx = 0, apx = 0, apy = 0, lp = 0, hp = 0;
    for (let n = 0; n < len; n++) {
      const a = line[idx], b = line[(idx + 1) % Li];
      const y = decay * (w * a + (1 - w) * b);
      const ap = C * y + apx - C * apy; apx = y; apy = ap;
      line[idx] = ap; idx = (idx + 1) % Li;
      let v = ap;
      if (electric) { const old = hist[n % (Dp + 1)]; hist[n % (Dp + 1)] = ap; v = ap - 0.85 * old; }
      lp += (muted ? 0.25 : electric ? 0.45 : 0.6) * (v - lp);
      hp = 0.995 * hp + lp;                                      // tiny DC guard
      out[n] = (lp - hp * 0.005) * 0.5;
    }
    cache.set(key, buf);
    return buf;
  }

  // Amp, cabinet and room for the electric tones: preamp drive, a mid bump, a speaker roll-off and a short reverb
  function makeAmp(ctx) {
    const tone = TONE();
    const input = ctx.createGain(), output = ctx.createGain();
    if (tone === 'acoustic') { input.connect(output); return { input, output }; }
    const crunch = tone === 'crunch';
    const pre = ctx.createGain(); pre.gain.value = crunch ? 7 : 2.2;
    const shaper = ctx.createWaveShaper();
    const k = crunch ? 3.2 : 1.1, n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(k * x) / Math.tanh(k); }
    shaper.curve = curve; shaper.oversample = '4x';
    const hpf = ctx.createBiquadFilter(); hpf.type = 'highpass'; hpf.frequency.value = 85;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 800; mid.Q.value = 0.8; mid.gain.value = crunch ? 4 : 2.5;
    const scoop = ctx.createBiquadFilter(); scoop.type = 'peaking'; scoop.frequency.value = 2400; scoop.Q.value = 1; scoop.gain.value = -2;
    const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = crunch ? 4200 : 5200; cab.Q.value = 0.9;
    const cab2 = ctx.createBiquadFilter(); cab2.type = 'lowpass'; cab2.frequency.value = 7000;
    const post = ctx.createGain(); post.gain.value = crunch ? 0.32 : 0.55;
    input.connect(pre).connect(shaper).connect(hpf).connect(mid).connect(scoop).connect(cab).connect(cab2).connect(post);
    post.connect(output);
    // small room: exponentially decaying noise impulse
    const verb = ctx.createConvolver(), wet = ctx.createGain(); wet.gain.value = 0.16;
    const irLen = Math.round(ctx.sampleRate * 1.3), ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let c2 = 0; c2 < 2; c2++) { const d = ir.getChannelData(c2); let sd = 99 + c2; for (let i = 0; i < irLen; i++) { sd = (sd * 16807) % 2147483647; d[i] = (sd / 2147483647 * 2 - 1) * Math.pow(1 - i / irLen, 3.2); } }
    verb.buffer = ir;
    post.connect(verb).connect(wet).connect(output);
    return { input, output };
  }

  function noteAt(c, t, midi, dur, opts) {
    const { ctx, out } = c;
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = pluck(ctx, midi - (opts.bend || 0), opts.pm);
    g.gain.value = opts.gain || 0.7;
    src.connect(g).connect(out);
    const det = src.detune;
    if (opts.bend && det) { det.setValueAtTime(0, t + 0.06); det.linearRampToValueAtTime(opts.bend * 100, t + 0.26); }
    if (opts.vib && det) {
      const lfo = ctx.createOscillator(), depth = ctx.createGain();
      lfo.frequency.value = 5.5; depth.gain.setValueAtTime(0, t); depth.gain.linearRampToValueAtTime(25, t + 0.3);
      lfo.connect(depth).connect(det); lfo.start(t); lfo.stop(t + dur + 0.2);
    }
    const end = t + Math.min(dur + 0.12, src.buffer.duration);
    g.gain.setValueAtTime(opts.gain || 0.7, Math.max(t, end - 0.08));
    g.gain.linearRampToValueAtTime(0.0001, end);
    src.start(t); src.stop(end + 0.02);
  }
  function tick(c, t, gain) {
    const { ctx, out } = c;
    const len = Math.round(ctx.sampleRate * 0.03), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 2500; g.gain.value = gain;
    s.buffer = buf; s.connect(f).connect(g).connect(out); s.start(t);
  }
  function click(c, t, accent) {
    const { ctx, out } = c;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent ? 1500 : 1100;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(accent ? 0.12 : 0.07, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.06);
  }

  function playEvent(c, ev, t, spb, setup) {
    const dur = ev.dur * spb, tech = ev.tech || {};
    if (ev.kind === 'mute') { tick(c, t, 0.5); return; }
    if (ev.kind === 'note') {
      const n = ev.notes[0];
      if (n.dead) { tick(c, t, 0.35); return; }
      const midi = T.midiAt(n.string, n.fret, setup) + (tech.bend || 0);
      noteAt(c, t, midi, dur, { bend: tech.bend, vib: tech.vib, pm: tech.pm, gain: ev.legato ? 0.5 : 0.75 });
      return;
    }
    // chords and double stops: strum across the strings
    const notes = ev.notes.filter((n) => !n.dead).slice().sort((a, b) => (ev.strum === 'u' ? a.string - b.string : b.string - a.string));
    const gap = ev.chordName ? 0.012 : 0.004;
    notes.forEach((n, i) => noteAt(c, t + i * gap, T.midiAt(n.string, n.fret, setup), dur, { gain: ev.chordName ? 0.4 : 0.55, pm: tech.pm }));
  }

  // level: a curriculum level or song level. opts: {tempo, lockPos, from (beat), to (beat)}
  P.play = function (level, opts) {
    P.stop();
    opts = opts || {};
    const base = context();
    if (base.ctx.state === 'suspended') base.ctx.resume();
    const bus = base.ctx.createGain(); bus.connect(base.out);      // one bus per preview, so Stop silences it at once
    const amp = makeAmp(base.ctx); amp.output.connect(bus);
    const c = { ctx: base.ctx, out: amp.input, bus };
    const s = store.settings();
    const setup = { tuning: s.tuning, capo: s.capo };
    const text = (level.repeat || 1) > 1 ? Array(level.repeat).fill(level.text).join(' | ') : level.text;
    const parsed = N.parse(text, { setup, meter: level.meter, pos: opts.lockPos != null ? opts.lockPos : level.pos });
    const bpm = opts.bpm || (level.ladder ? level.ladder.from : level.bpm || 80) * (opts.tempo || 1);
    const spb = 60 / bpm;
    const from = opts.from || 0, to = opts.to != null ? opts.to : parsed.totalBeats;
    const lead = parsed.beatsPerBar * spb;              // one bar of count-in clicks
    const t0 = c.ctx.currentTime + 0.15 + lead - from * spb;
    if (opts.step && opts.step < 100) GQ.steps.apply(parsed.events, parsed.beatsPerBar, opts.step);
    const events = parsed.events.filter((e) => e.kind !== 'rest' && !e.ghost && e.beat >= from && e.beat < to);
    let k = 0, beat = Math.floor(from) - parsed.beatsPerBar;
    job = { c, t0, spb, parsed, level, from, to, stopped: false };
    const myJob = job;
    myJob.timer = setInterval(() => {
      if (myJob.stopped) return;
      const horizon = c.ctx.currentTime + 0.25;
      while (beat < to && t0 + beat * spb < horizon) {
        const inBar = ((beat % parsed.beatsPerBar) + parsed.beatsPerBar) % parsed.beatsPerBar;
        if (beat < from || s.metronome) click(c, t0 + beat * spb, inBar === 0);
        beat++;
      }
      while (k < events.length && t0 + events[k].beat * spb < horizon) { playEvent(c, events[k], t0 + events[k].beat * spb, spb, setup); k++; }
      if (c.ctx.currentTime > t0 + to * spb + 1.2) { P.stop(); P.emit('end', level); }
    }, 40);
    P.emit('start', level);
    return job;
  };
  P.stop = function () {
    if (!job) return;
    job.stopped = true; clearInterval(job.timer);
    const { ctx, bus } = job.c, now = ctx.currentTime;
    bus.gain.setValueAtTime(bus.gain.value, now); bus.gain.linearRampToValueAtTime(0, now + 0.06);
    setTimeout(() => { try { bus.disconnect(); } catch { /* gone */ } }, 600);
    const lv = job.level;
    job = null;
    P.emit('stop', lv);
  };
  P.active = () => !!job;
  P.output = () => context(); // for tests: {ctx, out}
  // Render a level offline (used by tests and to check the tone): returns a Promise of an AudioBuffer
  P.render = function (level, seconds, sampleRate) {
    const sr = sampleRate || 48000, off = new OfflineAudioContext(2, Math.round(sr * seconds), sr);
    const amp = makeAmp(off); amp.output.connect(off.destination);
    const s = store.settings(), setup = { tuning: s.tuning, capo: s.capo };
    const parsed = N.parse(level.text, { setup, meter: level.meter, pos: level.pos });
    const spb = 60 / (level.bpm || 80), c = { ctx: off, out: amp.input };
    for (const e of parsed.events) if (e.kind !== 'rest' && e.beat * spb < seconds) playEvent(c, e, 0.05 + e.beat * spb, spb, setup);
    return off.startRendering();
  };
  P.playing = (level) => !!job && job.level && level && job.level.id === level.id;
  // current position in beats (for the highway, tab and notation playheads)
  P.pos = function () {
    if (!job) return null;
    return (job.c.ctx.currentTime - (GQ.audio.ctx === job.c.ctx ? GQ.audio.outputLatency() : 0) - job.t0) / job.spb;
  };
})(typeof window !== 'undefined' ? window : globalThis);
