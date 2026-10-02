/* GuitarQuest: keep My songs in a folder on this computer, one file per song (.abc, or .tab for songs written as tab),
 * so they survive cleared browser data.
 * Uses the File System Access API (Chrome and Edge on a computer). The folder handle is kept in IndexedDB, because
 * localStorage cannot hold it. After a reload the browser may ask again before the app can write: until then saves
 * stay in the browser, and the next sync catches the folder up.
 *
 * Sync rules: a song and its file with the same text are left alone. When they differ, the newer one wins (the file's
 * modified time against the song's `updated`). Songs without a file get one named after the title; .abc files with
 * one tune, and .tab files, that no song owns are added to My songs. Deleting a song deletes its file, even if the folder was not
 * reachable at the time. Files are never deleted for any other reason. */
(function (G) {
  'use strict';
  const GQ = G.GQ, S = GQ.storage, CS = GQ.custom;
  const F = (GQ.folder = new GQ.Emitter());
  F.supported = typeof G.showDirectoryPicker === 'function' && typeof G.indexedDB !== 'undefined';
  F.handle = null;
  F.state = F.supported ? 'none' : 'unsupported'; // unsupported | none | ask (needs the user's OK) | ready | error
  F.error = '';
  F.last = S.get('folderSync', null); // result of the last sync, with its date

  const setState = (st, err) => { F.state = st; F.error = err || ''; F.emit('state', st); };
  F.name = () => (F.handle ? F.handle.name : '');

  // ----- the folder handle, in IndexedDB -----
  function idb(mode, fn) {
    return new Promise((res, rej) => {
      const open = G.indexedDB.open('guitarquest', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => rej(open.error);
      open.onsuccess = () => {
        const db = open.result;
        try {
          const tx = db.transaction('kv', mode), req = fn(tx.objectStore('kv'));
          tx.oncomplete = () => { db.close(); res(req.result); };
          tx.onerror = tx.onabort = () => { db.close(); rej(tx.error); };
        } catch (e) { db.close(); rej(e); }
      };
    });
  }
  const storeHandle = (h) => idb('readwrite', (s) => (h ? s.put(h, 'songsFolder') : s.delete('songsFolder')));
  const loadHandle = () => idb('readonly', (s) => s.get('songsFolder'));

  // one folder job at a time, in order
  let chain = Promise.resolve();
  const queue = (fn) => { const p = chain.then(fn); chain = p.catch(() => {}); return p; };

  function fail(e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) setState('ask');
    else if (e && e.name === 'NotFoundError') setState('error', 'The folder was moved, renamed or deleted. Choose it again.');
    else setState('error', 'Could not use the folder: ' + (e && e.message || e));
    console.warn('Songs folder:', e);
  }

  // ----- start-up, choosing and forgetting -----
  F.init = async function () {
    if (!F.supported) return;
    try { F.handle = (await loadHandle()) || null; } catch { F.handle = null; }
    if (!F.handle) return setState('none');
    let perm = 'prompt';
    try { perm = await F.handle.queryPermission({ mode: 'readwrite' }); } catch { /* treat as prompt */ }
    if (perm === 'granted') { setState('ready'); await F.sync(); } else setState('ask');
  };

  F.choose = async function () {
    let h;
    try { h = await G.showDirectoryPicker({ id: 'gq-songs', mode: 'readwrite', startIn: 'documents' }); }
    catch (e) { if (e.name === 'AbortError') return null; throw e; }
    F.handle = h;
    try { await storeHandle(h); } catch (e) { console.warn('Songs folder not remembered:', e); }
    // links to files in another folder no longer mean anything; the sync re-links files with the same text
    for (const s of CS.list()) if (s.file) CS.setFile(s.id, null);
    S.del('folderDeleted');
    setState('ready');
    return F.sync();
  };

  // must run from a click: the browser shows its "allow" prompt
  F.allow = async function () {
    if (!F.handle) return null;
    const perm = await F.handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return null;
    setState('ready');
    return F.sync();
  };

  // stop saving to the folder; the files stay where they are
  F.forget = async function () {
    F.handle = null;
    try { await storeHandle(null); } catch { /* ignore */ }
    for (const s of CS.list()) if (s.file) CS.setFile(s.id, null);
    S.del('folderDeleted'); S.del('folderSync'); F.last = null;
    setState('none');
  };

  // ----- files -----
  const norm = (t) => String(t).replace(/\r\n?/g, '\n').trim();
  const same = (a, b) => norm(a) === norm(b);
  const baseName = (title) => String(title || 'Untitled').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^\.+/, '').slice(0, 80).trim() || 'Untitled';
  const extOf = (s) => CS.ext(CS.formatOf(s));
  // "Title.abc", or "Title (2).abc" ... when that name is taken (compared without case, as on macOS and Windows)
  F.fileName = function (title, taken, ext) {
    const b = baseName(title), x = ext || '.abc';
    let name = b + x;
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${b} (${n})${x}`;
    return name;
  };
  // does this file name still belong to this song's title and format?
  const fits = (file, s) => {
    const b = baseName(s.title).toLowerCase(), f = file.toLowerCase(), x = extOf(s);
    return f === b + x || (f.startsWith(b + ' (') && f.endsWith(x) && /^ \(\d+\)$/.test(f.slice(b.length, -x.length)));
  };
  // a song from a file's text: .tab files hold one tab song, .abc files ABC tunes
  function fromFile(name, text) {
    if (/\.tab$/i.test(name)) {
      const named = /(^|\n)\s*title\s*:/i.test(text) ? text : 'Title: ' + name.replace(/\.tab$/i, '') + '\n' + text;
      return { format: 'tab', text: named };
    }
    const tunes = GQ.abc.splitTunes(text);
    if (tunes.length !== 1) throw new Error(tunes.length ? `has ${tunes.length} tunes. Use Songs > Import for a file with several` : 'no tune found (it needs an X: line and a K: line)');
    return { format: 'abc', text: tunes[0] };
  }

  async function readFolder(dir) {
    const files = new Map();
    for await (const [name, fh] of dir.entries()) {
      if (fh.kind !== 'file' || !/\.(abc|tab)$/i.test(name)) continue;
      const f = await fh.getFile();
      files.set(name, { text: await f.text(), modified: f.lastModified });
    }
    return files;
  }
  async function writeFile(dir, name, text) {
    const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
    await w.write(norm(text) + '\n');
    await w.close();
  }
  async function removeFile(dir, name) {
    try { await dir.removeEntry(name); return true; } catch (e) { if (e.name === 'NotFoundError') return false; throw e; }
  }

  // save one song straight after it was saved in the app; a new title renames its file
  async function writeSong(id) {
    const s = CS.get(id), dir = F.handle;
    if (!s || !dir || F.state !== 'ready') return;
    let name = s.file;
    if (!name || !fits(name, s)) {
      const taken = new Set(CS.list().filter((x) => x.id !== id && x.file).map((x) => x.file.toLowerCase()));
      for (;;) {
        name = F.fileName(s.title, taken, extOf(s));
        try { await dir.getFileHandle(name); taken.add(name.toLowerCase()); } catch (e) { if (e.name === 'NotFoundError') break; throw e; }
      }
    }
    await writeFile(dir, name, CS.textOf(s));
    if (s.file && s.file !== name) await removeFile(dir, s.file);
    if (s.file !== name) CS.setFile(id, name);
  }

  // true while the sync itself saves songs, so those saves are not written straight back
  let fromSync = false;
  const saveFromSync = (song) => { fromSync = true; try { return CS.save(song); } finally { fromSync = false; } };

  CS.on('saved', (s) => { if (!fromSync && F.state === 'ready') queue(() => writeSong(s.id)).catch(fail); });
  CS.on('removed', (s) => {
    if (!s.file) return;
    if (F.state === 'ready') queue(() => removeFile(F.handle, s.file)).catch(fail);
    else S.set('folderDeleted', [...S.get('folderDeleted', []), s.file]);
  });

  // bring the folder and My songs together; returns what changed, or null when the folder is not usable
  F.sync = () => queue(async function () {
    if (F.state !== 'ready' || !F.handle) return null;
    const dir = F.handle, r = { written: 0, imported: 0, updated: 0, removed: 0, skipped: [] };
    try {
      const files = await readFolder(dir);
      // songs deleted in the app while the folder could not be reached
      for (const name of S.get('folderDeleted', [])) if (files.has(name)) { await removeFile(dir, name); files.delete(name); r.removed++; }
      S.del('folderDeleted');

      const songs = CS.list(), owned = new Set();
      for (const s of songs) {
        if (s.file && files.has(s.file) && !owned.has(s.file)) owned.add(s.file);
        else if (s.file) { CS.setFile(s.id, null); delete s.file; }
      }
      // songs without a file: take over a file with exactly the same text (a folder chosen again after data was cleared)
      for (const s of songs) {
        if (s.file) continue;
        for (const [name, f] of files) if (!owned.has(name) && same(f.text, CS.textOf(s))) { s.file = name; owned.add(name); CS.setFile(s.id, name); break; }
      }
      const taken = new Set([...files.keys()].map((n) => n.toLowerCase()));
      for (const s of songs) {
        if (!s.file) {
          const name = F.fileName(s.title, taken, extOf(s));
          await writeFile(dir, name, CS.textOf(s));
          taken.add(name.toLowerCase()); owned.add(name); CS.setFile(s.id, name); r.written++;
          continue;
        }
        const f = files.get(s.file);
        if (same(f.text, CS.textOf(s))) continue;
        if (f.modified > (Date.parse(s.updated) || 0)) {
          // edited outside the app
          try { saveFromSync({ id: s.id, ...fromFile(s.file, f.text) }); r.updated++; } catch (e) { r.skipped.push(`${s.file}: not read, ${e.message.replace(/^Fix the errors before saving: /, '')}. The song in the app is unchanged.`); }
        } else {
          // changed in the app while the folder could not be reached; a new title renames the file
          let name = s.file;
          if (!fits(name, s)) { name = F.fileName(s.title, taken, extOf(s)); taken.add(name.toLowerCase()); owned.add(name); }
          await writeFile(dir, name, CS.textOf(s));
          if (name !== s.file) { await removeFile(dir, s.file); CS.setFile(s.id, name); }
          r.written++;
        }
      }
      // new files in the folder
      for (const [name, f] of files) {
        if (owned.has(name)) continue;
        try { saveFromSync({ ...fromFile(name, f.text), file: name }); r.imported++; }
        catch (e) { r.skipped.push(`${name}: ${e.message.replace(/^Fix the errors before saving: /, '')}. Open it in the Creator to fix it.`); }
      }
      F.last = Object.assign({ date: new Date().toISOString(), songs: CS.list().length }, r);
      S.set('folderSync', F.last);
      F.emit('synced', F.last);
      return r;
    } catch (e) { fail(e); return null; }
  });

  F.summary = function (r) {
    if (!r) return '';
    const parts = [];
    if (r.written) parts.push(`${r.written} saved to the folder`);
    if (r.imported) parts.push(`${r.imported} added from the folder`);
    if (r.updated) parts.push(`${r.updated} updated from the folder`);
    if (r.removed) parts.push(`${r.removed} deleted`);
    if (r.skipped.length) parts.push(`${r.skipped.length} file${r.skipped.length > 1 ? 's' : ''} skipped`);
    return parts.length ? 'Songs folder: ' + parts.join(', ') + '.' : 'Songs folder is up to date.';
  };

  // pick up files edited in another app when the user comes back
  if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => { if (!document.hidden && F.state === 'ready') F.sync(); });
})(typeof window !== 'undefined' ? window : globalThis);
