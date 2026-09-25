/* GuitarQuest: profiles, settings and progress. All data stays in this browser (REQ-SC-4, REQ-NF-4). */
(function (G) {
  'use strict';
  const GQ = G.GQ, S = GQ.storage;
  const store = (GQ.store = new GQ.Emitter());

  const DEFAULT_SETTINGS = {
    mode: 'beginner',                // beginner | intermediate | advanced
    tuning: 'standard', capo: 0, a4: 440,
    leftHanded: false, displaySize: 1,
    views: { fretboard: true, highway: true, tab: true, staff: false },
    metronome: true, metronomeVol: 0.6, backing: true, backingVol: 0.5, countIn: true,
    monitor: false, monitorVol: 0.7, ampTone: 'clean',
    autoAdvance: false, voice: false,
    keys: { toggle: ['Space'], next: ['PageDown', 'ArrowRight'], again: ['PageUp', 'ArrowLeft'], slower: ['ArrowDown'], faster: ['ArrowUp'], lock: ['KeyL'] },
    practiceLock: false, positionLock: false,
    deviceId: null, deviceLabel: null,
  };
  store.DEFAULT_SETTINGS = DEFAULT_SETTINGS;

  function blankProfile(name) {
    return {
      id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36),
      name: name || 'Player', created: new Date().toISOString(),
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      levels: {}, minutes: 0, days: {}, history: [], misses: {}, chordMisses: {}, changes: {},
    };
  }
  function migrate(p) {
    p.settings = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), p.settings || {});
    p.settings.views = Object.assign({}, DEFAULT_SETTINGS.views, p.settings.views || {});
    p.settings.keys = Object.assign({}, DEFAULT_SETTINGS.keys, p.settings.keys || {});
    for (const k of ['levels', 'days', 'misses', 'chordMisses', 'changes']) p[k] = p[k] || {};
    p.history = p.history || []; p.minutes = p.minutes || 0;
    return p;
  }

  let profiles = S.get('profiles', null);
  let current = null;
  if (!profiles || !profiles.length) {
    const p = blankProfile('Player 1');
    profiles = [{ id: p.id, name: p.name }];
    S.set('profiles', profiles); S.set('p.' + p.id, p); S.set('active', p.id);
  }

  store.load = function (id) {
    id = id || S.get('active', profiles[0].id);
    let p = S.get('p.' + id, null);
    if (!p) { p = blankProfile(); p.id = id; }
    current = migrate(p);
    S.set('active', current.id);
    store.emit('profile', current);
    return current;
  };
  store.profile = () => current || store.load();
  store.settings = () => store.profile().settings;
  store.save = function () { if (current) S.set('p.' + current.id, current); };
  store.setSetting = function (key, value) {
    const s = store.settings();
    const path = key.split('.');
    let o = s;
    for (let i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = value;
    store.save();
    store.emit('settings', { key, value });
  };
  store.profiles = () => profiles.slice();
  store.createProfile = function (name) {
    const p = blankProfile(name);
    profiles.push({ id: p.id, name: p.name });
    S.set('profiles', profiles); S.set('p.' + p.id, p);
    return store.load(p.id);
  };
  store.renameProfile = function (name) {
    const p = store.profile(); p.name = name;
    const e = profiles.find((x) => x.id === p.id); if (e) e.name = name;
    S.set('profiles', profiles); store.save(); store.emit('profile', p);
  };
  store.deleteProfile = function (id) {
    if (profiles.length <= 1) return false;
    profiles = profiles.filter((x) => x.id !== id);
    S.set('profiles', profiles); S.del('p.' + id);
    if (current && current.id === id) store.load(profiles[0].id);
    return true;
  };

  // ----- progress -----
  store.levelResult = (id) => store.profile().levels[id] || null;
  store.recordRun = function (run) {
    // run: {level, score, stars, accuracy, timingMs, unclear, notes, mode, misses:[names], chordMisses:[names], changes:[{pair, ms}], scored}
    const p = store.profile();
    if (run.scored) {
      const r = p.levels[run.level] || { best: 0, stars: 0, attempts: 0 };
      r.attempts++;
      r.last = run.score;
      if (run.score > r.best) r.best = run.score;
      if (run.stars > r.stars) r.stars = run.stars;
      if (run.stars > 0 && !r.passedAt) r.passedAt = new Date().toISOString();
      p.levels[run.level] = r;
      for (const n of run.misses || []) p.misses[n] = (p.misses[n] || 0) + 1;
      for (const n of run.chordMisses || []) p.chordMisses[n] = (p.chordMisses[n] || 0) + 1;
      for (const c of run.changes || []) {
        const e = p.changes[c.pair] || { n: 0, totalMs: 0, bestMs: null };
        e.n++; e.totalMs += c.ms; e.bestMs = e.bestMs == null ? c.ms : Math.min(e.bestMs, c.ms);
        p.changes[c.pair] = e;
      }
    }
    p.history.push({ t: new Date().toISOString(), level: run.level, score: run.score, stars: run.stars, acc: run.accuracy,
      timing: run.timingMs, unclear: run.unclear, mode: run.mode, scored: !!run.scored });
    if (p.history.length > 1000) p.history.splice(0, p.history.length - 1000);
    store.save();
    store.emit('progress', run);
  };
  store.addPracticeSeconds = function (sec) {
    const p = store.profile();
    p.minutes += sec / 60;
    const d = GQ.today();
    p.days[d] = (p.days[d] || 0) + sec / 60;
    store.save();
  };
  store.streak = function () {
    const days = store.profile().days;
    let n = 0;
    const d = new Date();
    const key = (x) => x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
    if (!(days[key(d)] >= 1)) d.setDate(d.getDate() - 1); // today not practised yet: count from yesterday
    while (days[key(d)] >= 1) { n++; d.setDate(d.getDate() - 1); }
    return n;
  };

  // ----- per-device data (calibration, gate, "this is my guitar") -----
  store.device = (id) => S.get('dev.' + id, {});
  store.setDevice = (id, patch) => { const d = Object.assign(store.device(id), patch); S.set('dev.' + id, d); return d; };

  // ----- export / import -----
  store.exportData = function () {
    return JSON.stringify({ app: 'GuitarQuest', version: 1, exported: new Date().toISOString(), profile: store.profile() }, null, 1);
  };
  store.importData = function (json) {
    const data = JSON.parse(json);
    if (!data || data.app !== 'GuitarQuest' || !data.profile) throw new Error('This is not a GuitarQuest export.');
    const p = migrate(data.profile);
    p.id = 'p' + Date.now().toString(36);
    if (profiles.some((x) => x.name === p.name)) p.name += ' (imported)';
    profiles.push({ id: p.id, name: p.name });
    S.set('profiles', profiles); S.set('p.' + p.id, p);
    return store.load(p.id);
  };

  store.load();
})(typeof window !== 'undefined' ? window : globalThis);
