/* GuitarQuest: scoring rules (REQ-SC-1, REQ-SC-2). Pure functions, unit-tested. */
(function (G) {
  'use strict';
  const GQ = G.GQ;
  const SC = (GQ.scoring = {});

  SC.PASS = 60; SC.STAR2 = 80; SC.STAR3 = 95;
  SC.UNCLEAR_LIMIT = 0.2;       // more than a fifth unclear: the input needs attention
  SC.EXTRA_COST = 25;           // a confident wrong extra note costs a quarter of a note

  // Timing window in ms for a target: wider for low strings, which take longer to speak (risk 5)
  SC.window = function (mode, ev) {
    const base = mode === 'advanced' ? 70 : 150;
    const lowest = ev.notes.length ? Math.max(...ev.notes.map((n) => n.string)) : 4;
    return base + (lowest >= 6 ? 30 : lowest >= 5 ? 20 : 0) + (ev.kind === 'chord' ? 20 : 0);
  };
  // Points for an in-time correct note: full inside a third of the window, down to 50 at its edge
  SC.timedPoints = function (errMs, windowMs) {
    const a = Math.abs(errMs);
    if (a <= windowMs / 3) return 100;
    return Math.round(100 - 50 * GQ.clamp((a - windowMs / 3) / (windowMs * 2 / 3), 0, 1));
  };
  // Beginner mode (the piece waits): first try is full marks, each wrong attempt costs 25
  SC.waitPoints = (attempts) => Math.max(25, 100 - 25 * attempts);
  SC.stars = (score) => (score >= SC.STAR3 ? 3 : score >= SC.STAR2 ? 2 : score >= SC.PASS ? 1 : 0);

  // results: [{state:'hit'|'miss'|'wrong'|'unclear', points, timingMs}], extras: confident extra wrong notes
  SC.summarise = function (results, extras) {
    const n = results.length;
    const unclear = results.filter((r) => r.state === 'unclear').length;
    const scoredR = results.filter((r) => r.state !== 'unclear');
    const hits = scoredR.filter((r) => r.state === 'hit');
    const pts = scoredR.reduce((s, r) => s + (r.points || 0), 0);
    const denom = 100 * scoredR.length;
    const score = denom ? Math.max(0, Math.round((100 * (pts - SC.EXTRA_COST * (extras || 0))) / denom)) : 0;
    const timings = hits.map((r) => r.timingMs).filter((x) => Number.isFinite(x));
    const unclearFrac = n ? unclear / n : 0;
    const inputProblem = unclearFrac > SC.UNCLEAR_LIMIT;
    return {
      notes: n, hits: hits.length, unclear, extras: extras || 0,
      accuracy: scoredR.length ? Math.round((100 * hits.length) / scoredR.length) : 0,
      score, stars: inputProblem ? 0 : SC.stars(score),
      timingMs: timings.length ? Math.round(GQ.mean(timings.map(Math.abs))) : null,
      timingBias: timings.length ? Math.round(GQ.mean(timings)) : null,
      inputProblem,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
