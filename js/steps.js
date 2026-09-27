/* GuitarQuest: note steps. Any lesson or song can be played with only 10%, 20% ... 100% of its notes.
 * Notes on the strongest beats are kept first (bar start, then mid-bar, then the other beats, then
 * off-beats), spread evenly through the piece. Every step contains the notes of the step below it,
 * so the piece builds up. The score of a step is capped at its percentage. */
(function (G) {
  'use strict';
  const GQ = G.GQ;
  const ST = (GQ.steps = {});
  ST.LEVELS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  ST.CLEAR = 80;  // a step counts as cleared at 80% of its notes right

  // van der Corput radical inverse: spreads choices evenly for any prefix
  const vdc = (n) => { let v = 0, d = 1; while (n) { d *= 2; v += (n & 1) / d; n >>= 1; } return v; };

  // events: parsed events; returns the Set of event indexes to keep for `percent`
  ST.keep = function (events, beatsPerBar, percent) {
    const all = events.filter((e) => e.kind !== 'rest');
    if (percent >= 100) return new Set(all.map((e) => e.i));
    // group slurred notes (hammer-on, pull-off, slide) with the picked note they belong to
    const groups = [];
    for (const e of all) {
      if (e.legato && groups.length) groups[groups.length - 1].members.push(e.i);
      else groups.push({ head: e, members: [e.i] });
    }
    const bpb = beatsPerBar || 4;
    const tier = (e) => {
      const pos = ((e.beat % bpb) + bpb) % bpb;
      if (pos < 1e-6) return 0;                                     // first beat of the bar
      if (bpb >= 4 && Math.abs(pos - bpb / 2) < 1e-6) return 1;     // middle of the bar
      if (Math.abs(pos - Math.round(pos)) < 1e-6) return 2;         // other beats
      if (Math.abs(pos * 2 - Math.round(pos * 2)) < 1e-6) return 3; // eighth off-beats
      return 4;                                                     // everything finer
    };
    const byTier = [[], [], [], [], []];
    groups.forEach((g) => byTier[tier(g.head)].push(g));
    const order = [];
    for (const list of byTier) {
      const ranked = list.map((g, k) => ({ g, key: vdc(k + 1) })).sort((a, b) => a.key - b.key);
      for (const r of ranked) order.push(r.g);
    }
    const n = Math.max(1, Math.round((groups.length * percent) / 100));
    const keep = new Set();
    for (const g of order.slice(0, n)) for (const i of g.members) keep.add(i);
    return keep;
  };

  // mark events that are not played in this step as ghosts (drawn faded, not scored)
  ST.apply = function (events, beatsPerBar, percent) {
    const keep = ST.keep(events, beatsPerBar, percent);
    for (const e of events) e.ghost = e.kind !== 'rest' && !keep.has(e.i);
    return keep;
  };

  // progress of a level's steps for the current profile: {cleared: highest cleared %, best: {pct: raw score}}
  ST.progress = function (levelId) {
    const r = GQ.store.levelResult(levelId) || {};
    const best = r.steps || {};
    let cleared = 0;
    for (const p of ST.LEVELS) if ((best[p] || 0) >= ST.CLEAR) cleared = p;
    return { cleared, best };
  };
  // the step to open a level at: where the player left off
  ST.startStep = (levelId) => (GQ.store.profile().lastSteps || {})[levelId] || 100;
  ST.setStart = function (levelId, pct) {
    const p = GQ.store.profile();
    p.lastSteps = p.lastSteps || {};
    p.lastSteps[levelId] = pct;
    GQ.store.save();
  };
})(typeof window !== 'undefined' ? window : globalThis);
