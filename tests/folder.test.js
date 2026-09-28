// Songs folder sync (js/folder.js) against an in-memory folder that behaves like the File System Access API.
const { load } = require('./harness');
const GQ = load('util', 'theory', 'notation', 'abc', 'custom', 'folder');
const F = GQ.folder, CS = GQ.custom;
let fails = 0;
const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) fails++; };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const err = (name) => Object.assign(new Error(name), { name });
function fakeDir(name) {
  const files = new Map(); // name -> {text, modified}
  const fh = (n) => ({
    kind: 'file', name: n,
    getFile: async () => ({ text: async () => files.get(n).text, lastModified: files.get(n).modified }),
    createWritable: async () => { let buf = ''; return { write: async (t) => { buf += t; }, close: async () => { files.set(n, { text: buf, modified: Date.now() }); } }; },
  });
  return {
    name, files, kind: 'directory',
    async *entries() { for (const n of [...files.keys()]) yield [n, fh(n)]; },
    async getFileHandle(n, o) { if (!files.has(n) && !(o && o.create)) throw err('NotFoundError'); return fh(n); },
    async removeEntry(n) { if (!files.has(n)) throw err('NotFoundError'); files.delete(n); },
  };
}
const tune = (t, notes) => `X:1\nT:${t}\nM:4/4\nL:1/4\nK:C\n${notes || 'C D E F | G4 |]'}\n`;
const settle = () => new Promise((r) => setTimeout(r, 20));
// an edit in another app, clearly later than anything before it
const touch = async (dir, n, text) => { await sleep(5); dir.files.set(n, { text, modified: Date.now() }); await sleep(5); };

(async () => {
  CS.save({ abc: tune('Song One') });
  CS.save({ abc: tune('Song/Two: B?') });
  const dir = fakeDir('Songs');
  await touch(dir, 'From Folder.abc', tune('From Folder', 'E F G A | c4 |]'));
  await touch(dir, 'Two Tunes.abc', tune('A') + '\n' + tune('B').replace('X:1', 'X:2'));
  await touch(dir, 'Broken.abc', 'X:1\nT:Broken\nK:C\nC D ? E |]\n');
  await touch(dir, 'notes.txt', 'not a tune');
  F.handle = dir; F.state = 'ready';

  let r = await F.sync();
  check(r.written === 2 && dir.files.has('Song One.abc') && dir.files.has('Song Two B.abc'), 'songs are written as Title.abc, unsafe characters removed: ' + [...dir.files.keys()].join(', '));
  check(r.imported === 1 && CS.list().some((s) => s.title === 'From Folder' && s.file === 'From Folder.abc'), 'a new one-tune file is added to My songs');
  check(r.skipped.length === 2 && r.skipped.some((t) => /Two Tunes.*2 tunes/.test(t)) && r.skipped.some((t) => /^Broken\.abc/.test(t)), 'files with several tunes or errors are skipped with a reason');
  check(dir.files.get('Song One.abc').text.includes('T:Song One'), 'the file holds the ABC');

  r = await F.sync();
  check(!r.written && !r.imported && !r.updated && !r.removed, 'a second sync changes nothing');

  // saving in the app writes the file; a new title renames it
  const one = CS.list().find((s) => s.title === 'Song One');
  CS.save({ id: one.id, abc: tune('Song One', 'C C C C | C4 |]') });
  await settle();
  check(dir.files.get('Song One.abc').text.includes('C C C C'), 'saving a song rewrites its file');
  CS.save({ id: one.id, abc: tune('Renamed', 'C C C C | C4 |]') });
  await settle();
  check(dir.files.has('Renamed.abc') && !dir.files.has('Song One.abc') && CS.get(one.id).file === 'Renamed.abc', 'a new title renames the file');
  CS.save({ abc: tune('Renamed', 'D D D D | D4 |]') });
  await settle();
  check(dir.files.has('Renamed (2).abc'), 'a second song with the same title gets "(2)"');

  // edited in another app: the newer file wins
  await touch(dir, 'Renamed.abc', tune('Renamed', 'G G G G | G4 |]'));
  r = await F.sync();
  check(r.updated === 1 && CS.get(one.id).abc.includes('G G G G'), 'a file edited outside the app updates the song');
  await touch(dir, 'Renamed.abc', tune('Renamed', 'G ? G |]'));
  r = await F.sync();
  check(r.skipped.some((t) => /^Renamed\.abc: not read/.test(t)) && CS.get(one.id).abc.includes('G G G G'), 'a broken edit is reported and the song kept');
  await touch(dir, 'Renamed.abc', tune('Renamed', 'G G G G | G4 |]'));
  await F.sync();

  // deleting a song deletes its file; while the folder is not reachable it waits for the next sync
  const ff = CS.list().find((s) => s.title === 'From Folder');
  CS.remove(ff.id); await settle();
  check(!dir.files.has('From Folder.abc'), 'deleting a song deletes its file');
  F.state = 'ask';
  const two = CS.list().find((s) => s.file === 'Song Two B.abc');
  CS.remove(two.id);
  const ren = CS.list().find((s) => s.file === 'Renamed (2).abc');
  CS.save({ id: ren.id, abc: tune('Third', 'E E E E | E4 |]') });
  await settle();
  check(dir.files.has('Song Two B.abc') && dir.files.has('Renamed (2).abc'), 'nothing is written while the folder waits for permission');
  F.state = 'ready';
  r = await F.sync();
  check(r.removed === 1 && !dir.files.has('Song Two B.abc'), 'a song deleted meanwhile has its file deleted on the next sync');
  check(dir.files.has('Third.abc') && !dir.files.has('Renamed (2).abc') && dir.files.get('Third.abc').text.includes('E E E E'), 'a song edited meanwhile is written, and renamed, on the next sync');

  // browser data lost: an empty library and the same folder brings every song back, without duplicates
  const before = [...dir.files.keys()].sort().join();
  localStorage.removeItem('gq.customSongs');
  r = await F.sync();
  check(CS.list().map((s) => s.title).sort().join() === 'Renamed,Third', 'songs come back from the folder after the browser data is cleared');
  check([...dir.files.keys()].sort().join() === before, 'and no files are added or removed');

  // choosing a folder again after data loss while the songs are still in the browser: same text links up
  for (const s of CS.list()) CS.setFile(s.id, null);
  r = await F.sync();
  check(!r.written && !r.imported && CS.list().every((s) => s.file), 'songs with the same text as a file are linked to it, not duplicated');

  // export all, readable by import
  const all = CS.exportAll();
  check(GQ.abc.splitTunes(all).length === CS.list().length && /X:1[\s\S]*X:2/.test(all), 'Download all puts every song in one file, numbered');

  // the folder disappears
  dir.entries = async function* () { throw err('NotFoundError'); };
  r = await F.sync();
  check(r === null && F.state === 'error' && /moved/.test(F.error), 'a missing folder is reported');

  console.log(fails ? fails + ' folder test(s) failed' : 'folder tests passed');
  process.exitCode = fails ? 1 : 0;
})();
