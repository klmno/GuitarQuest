/* GuitarQuest: your own songs, written in ABC and kept in this browser's local storage.
 * They are shared by all profiles on this device; each profile keeps its own scores for them. */
(function (G) {
  'use strict';
  const GQ = G.GQ, S = GQ.storage;
  const CS = (GQ.custom = new GQ.Emitter());
  const KEY = 'customSongs';

  CS.list = () => S.get(KEY, []);
  CS.get = (id) => CS.list().find((s) => s.id === id) || null;
  const write = (list) => { const ok = S.set(KEY, list); CS.emit('change', list); return ok; };

  // song: {id?, abc, file?}; title and details come from the ABC header. `file` is the song's .abc file in the songs folder (js/folder.js).
  CS.save = function (song) {
    const p = GQ.abc.parse(song.abc);
    if (p.errors.length) throw new Error('Fix the errors before saving: ' + p.errors[0]);
    const list = CS.list(), now = new Date().toISOString();
    const entry = {
      id: song.id || 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36),
      abc: song.abc, title: p.meta.title || 'Untitled', composer: p.meta.composer || '', key: p.meta.keyName,
      meter: p.meta.meterText, bpm: p.meta.bpm, bars: p.bars, notes: p.events.filter((e) => e.kind !== 'rest').length,
      difficulty: difficultyOf(p), updated: now,
    };
    const i = list.findIndex((s) => s.id === entry.id);
    if (song.file) entry.file = song.file;
    if (i >= 0) { entry.created = list[i].created; if (!entry.file && list[i].file) entry.file = list[i].file; list[i] = entry; } else { entry.created = now; list.push(entry); }
    if (!write(list)) throw new Error('This browser did not save the song (storage full or blocked).');
    CS.emit('saved', entry);
    return entry;
  };
  CS.remove = function (id) {
    const list = CS.list(), gone = list.find((s) => s.id === id);
    write(list.filter((s) => s.id !== id));
    if (gone) CS.emit('removed', gone);
  };
  // link a song to its file in the songs folder (null to unlink), without counting as an edit
  CS.setFile = function (id, file) {
    const list = CS.list(), s = list.find((x) => x.id === id);
    if (!s) return;
    if (file) s.file = file; else delete s.file;
    write(list);
  };
  // every song in one .abc file, numbered X:1, X:2 ...
  CS.exportAll = () => CS.list().map((s, i) => { const t = s.abc.trim(); return /^X:/m.test(t) ? t.replace(/^X:.*$/m, 'X:' + (i + 1)) : 'X:' + (i + 1) + '\n' + t; }).join('\n\n') + '\n';

  // import every tune in an .abc file; returns {saved: [entries], failed: [{title, error}]}
  CS.importText = function (text) {
    const saved = [], failed = [];
    for (const abc of GQ.abc.splitTunes(text)) {
      try { saved.push(CS.save({ abc })); }
      catch (e) { const t = /(^|\n)T:(.*)/.exec(abc); failed.push({ title: t ? t[2].trim() : 'Untitled', error: e.message }); }
    }
    if (!saved.length && !failed.length) failed.push({ title: 'File', error: 'No tunes found: each tune needs an X: line and a K: line.' });
    return { saved, failed };
  };

  // 1 to 3 dots, from note speed and how far the notes move around the neck
  function difficultyOf(p) {
    const notes = p.events.filter((e) => e.kind !== 'rest');
    if (!notes.length) return 1;
    const fastest = Math.min(...notes.map((e) => e.dur)) * 60 / (p.meta.bpm || 100);
    const frets = notes.flatMap((e) => e.notes.map((n) => n.fret));
    const span = Math.max(...frets) - Math.min(...frets);
    let d = 1;
    if (fastest < 0.3 || span > 5 || notes.some((e) => e.kind === 'chord')) d = 2;
    if (fastest < 0.16 || span > 9) d = 3;
    return d;
  }
})(typeof window !== 'undefined' ? window : globalThis);
