/* GuitarQuest: generated sound: metronome, count-in, reference tones and backing tracks (REQ-FN-5).
 * Everything is synthesised with Web Audio, so there is nothing to license or download. */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory;
  const S = (GQ.sound = {});
  const A = () => GQ.audio;
  let noiseBuf = null;

  function noise(ctx) {
    if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }
  function env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  }

  // accent: 0 normal, 1 bar start, 2 count-in
  S.click = function (t, accent, dest) {
    const ctx = A().ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = accent === 2 ? 1600 : accent === 1 ? 1400 : 1000;
    env(g, t, 0.002, accent ? 0.5 : 0.32, 0.05);
    o.connect(g).connect(dest || A().metroBus);
    o.start(t); o.stop(t + 0.08);
  };

  // plucked reference tone (tuner, "play me the note")
  S.tone = function (t, midi, dur, dest, level) {
    const ctx = A().ctx; if (!ctx) return;
    const f = T.midiToFreq(midi, GQ.store.settings().a4);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(Math.min(8000, f * 8), t); lp.frequency.exponentialRampToValueAtTime(Math.max(200, f * 1.5), t + dur);
    env(g, t, 0.005, level || 0.25, dur);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(dest || A().out);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  };

  // ---- drum kit ----
  S.kick = function (t, dest) {
    const ctx = A().ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    env(g, t, 0.002, 0.9, 0.25);
    o.connect(g).connect(dest); o.start(t); o.stop(t + 0.3);
  };
  S.snare = function (t, dest) {
    const ctx = A().ctx, n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noise(ctx); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.7;
    env(g, t, 0.001, 0.45, 0.14);
    n.connect(bp).connect(g).connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + 0.2);
    const o = ctx.createOscillator(), g2 = ctx.createGain();
    o.frequency.value = 190; env(g2, t, 0.001, 0.3, 0.08); o.connect(g2).connect(dest); o.start(t); o.stop(t + 0.12);
  };
  S.hat = function (t, dest, open) {
    const ctx = A().ctx, n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = ctx.createGain();
    n.buffer = noise(ctx); hp.type = 'highpass'; hp.frequency.value = 7000;
    env(g, t, 0.001, 0.16, open ? 0.25 : 0.04);
    n.connect(hp).connect(g).connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + 0.3);
  };
  S.bass = function (t, midi, dur, dest) {
    const ctx = A().ctx, o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = T.midiToFreq(midi);
    lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.32, t + 0.01);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.8, 0.05);
    o.connect(lp).connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.3);
  };
  S.pad = function (t, midis, dur, dest) {
    const ctx = A().ctx, g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06, t + 0.08);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.9, 0.08);
    lp.connect(g).connect(dest);
    for (const m of midis) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = T.midiToFreq(m);
      o.connect(lp); o.start(t); o.stop(t + dur + 0.5);
    }
  };

  // ---- backing track patterns ----
  // style: 'rock' | 'folk' | 'blues' | 'none'; called once per beat by the lesson scheduler
  S.backingBeat = function (t, beatInBar, beatsPerBar, spb, chord, style, dest) {
    if (!A().ctx || style === 'none') return;
    const d = dest || A().backBus;
    if (style === 'blues') { // shuffle
      if (beatInBar % 2 === 0) S.kick(t, d); else S.snare(t, d);
      S.hat(t, d); S.hat(t + spb * 2 / 3, d);
    } else if (style === 'folk') {
      if (beatInBar === 0) S.kick(t, d);
      S.hat(t, d, beatInBar % 2 === 1);
    } else { // rock
      if (beatInBar % 2 === 0) S.kick(t, d); else S.snare(t, d);
      S.hat(t, d); S.hat(t + spb / 2, d);
    }
    if (chord) {
      const tones = GQ.chords.midis(chord).sort((a, b) => a - b);
      const info = T.parseChordName(chord.name);
      const root = info ? 36 + ((info.root - 0 + 12) % 12) : tones[0] - 12;
      const r = root < 38 ? root + 12 : root;
      if (style === 'blues') S.bass(t, beatInBar % 2 ? r + 7 : r, spb * 0.9, d);
      else S.bass(t, r + (style === 'folk' && beatInBar % 2 ? 7 : 0), spb * 0.9, d);
      if (beatInBar === 0) S.pad(t, tones.filter((m) => m > 50).slice(0, 4), spb * beatsPerBar, d);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
