/* GuitarQuest: tuner and tuning check (REQ-DET-9). A scored lesson needs a passed check (kept for 3 hours per input and tuning). */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory, store = GQ.store;
  const TU = (GQ.tuner = new GQ.Emitter());
  const HOLD_MS = 500, TOL = 5;

  TU.passed = GQ.storage.get('tuned', null); // {at, deviceId, tuning}; kept across reloads
  TU.reset = function () {
    TU.ok = {};
    TU.hold = {};
  };
  TU.reset();
  TU.targets = function () {
    const s = store.settings();
    const setup = { tuning: s.tuning, capo: 0 }; // tune open strings without the capo
    return [6, 5, 4, 3, 2, 1].map((string) => ({ string, midi: T.openMidi(string, setup) }));
  };
  TU.isTuned = function () {
    const s = store.settings(), p = TU.passed;
    return !!(p && p.tuning === s.tuning && (p.device === GQ.audio.key() || p.deviceId === GQ.audio.deviceId) && Date.now() - p.at < 3 * 3600e3);
  };
  // passing the tuning check completes level 1.1 "Tune up"
  TU.creditLevel = function () {
    const r = store.levelResult('u1-1');
    if (!r || !r.stars) store.recordRun({ level: 'u1-1', score: 100, stars: 3, accuracy: 100, timingMs: null, unclear: 0, mode: 'tuner', scored: true });
  };
  TU.markPassed = function () {
    TU.passed = { at: Date.now(), deviceId: GQ.audio.deviceId, device: GQ.audio.key(), tuning: store.settings().tuning };
    GQ.storage.set('tuned', TU.passed);
    TU.creditLevel();
    TU.emit('passed', TU.passed);
  };
  // Feed a pitch frame; returns the reading for display
  TU.update = function (pitch) {
    if (!pitch || pitch.conf < 0.8) { TU.hold = {}; return null; }
    const a4 = store.settings().a4 || 440;
    const mf = T.freqToMidi(pitch.f, a4);
    let best = null;
    for (const t of TU.targets()) {
      const d = Math.abs(mf - t.midi);
      if (!best || d < best.d) best = { d, t };
    }
    const nearest = Math.round(mf);
    const reading = { freq: pitch.f, midi: mf, note: T.midiName(nearest), cents: Math.round((mf - nearest) * 100), string: null, stringCents: null };
    if (best && best.d < 1.6) {
      reading.string = best.t.string;
      reading.stringCents = Math.round((mf - best.t.midi) * 100);
      const now = performance.now();
      if (Math.abs(reading.stringCents) <= TOL) {
        TU.hold[best.t.string] = TU.hold[best.t.string] || now;
        if (now - TU.hold[best.t.string] >= HOLD_MS && !TU.ok[best.t.string]) {
          TU.ok[best.t.string] = true;
          TU.emit('string', best.t.string);
          if (Object.keys(TU.ok).length === 6) TU.markPassed();
        }
      } else delete TU.hold[best.t.string];
    }
    return reading;
  };
})(typeof window !== 'undefined' ? window : globalThis);
