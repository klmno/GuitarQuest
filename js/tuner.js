/* GuitarQuest: tuner and tuning check (REQ-DET-9). A scored lesson needs a passed check this session. */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory, store = GQ.store;
  const TU = (GQ.tuner = new GQ.Emitter());
  const HOLD_MS = 500, TOL = 5;

  TU.passed = null; // {at, deviceId, tuning}
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
    return !!(p && p.tuning === s.tuning && p.deviceId === GQ.audio.deviceId && Date.now() - p.at < 3 * 3600e3);
  };
  TU.markPassed = function () {
    TU.passed = { at: Date.now(), deviceId: GQ.audio.deviceId, tuning: store.settings().tuning };
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
