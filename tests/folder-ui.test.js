// Settings > Songs folder, end to end, with an in-memory folder standing in for the browser's folder picker.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
const TUNE = (t) => `X:1\nT:${t}\nM:4/4\nL:1/4\nK:G\nG A B c | d4 |]\n`;
(async () => {
  const b = await chromium.launch();
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };

  // a browser that cannot pick folders
  const p0 = await b.newPage();
  await p0.addInitScript(() => { delete window.showDirectoryPicker; });
  await p0.goto(URL + '#/settings/folder');
  await p0.waitForSelector('#folder');
  check(await p0.isVisible('#folder >> text=This browser cannot save to a folder'), 'unsupported browsers are told, and offered Download all');
  await p0.close();

  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.addInitScript((tune) => {
    const files = (window.__folder = new Map([['Waiting.abc', { text: tune, modified: Date.now() - 60000 }]]));
    const fh = (n) => ({ kind: 'file', name: n,
      getFile: async () => ({ text: async () => files.get(n).text, lastModified: files.get(n).modified }),
      createWritable: async () => { let buf = ''; return { write: async (t) => { buf += t; }, close: async () => { files.set(n, { text: buf, modified: Date.now() }); } }; } });
    const nf = () => Object.assign(new Error('not found'), { name: 'NotFoundError' });
    const dir = { kind: 'directory', name: 'GuitarQuest songs',
      async *entries() { for (const n of [...files.keys()]) yield [n, fh(n)]; },
      async getFileHandle(n, o) { if (!files.has(n) && !(o && o.create)) throw nf(); return fh(n); },
      async removeEntry(n) { if (!files.has(n)) throw nf(); files.delete(n); },
      async queryPermission() { return 'granted'; }, async requestPermission() { return 'granted'; } };
    window.showDirectoryPicker = async () => dir;
  }, TUNE('Waiting in the folder'));
  await p.goto(URL + '#/settings/folder');
  await p.waitForSelector('#folder');
  await p.evaluate((t) => GQ.custom.save({ abc: t }), TUNE('Already in the app'));
  await p.click('#folder >> text=Choose a folder…');
  await p.waitForSelector('#folder >> text=saving here');
  const names = () => p.evaluate(() => [...window.__folder.keys()].sort().join());
  check(await names() === 'Already in the app.abc,Waiting.abc', 'choosing a folder writes the songs to it: ' + await names());
  check(await p.evaluate(() => GQ.custom.list().map((s) => s.title).sort().join()) === 'Already in the app,Waiting in the folder', 'and adds the songs already in it');
  check(await p.isVisible('#folder >> text=GuitarQuest songs'), 'the folder name is shown');
  check(await p.isVisible('#folder >> text=1 added from the folder'), 'the last sync is summarised');
  await p.screenshot({ path: __dirname + '/shots/19-songs-folder.png' });

  // the Creator's Save goes to the folder too
  await p.evaluate(() => { location.hash = '#/help'; });
  await p.click('#h-start >> text=Open in the Creator');
  await p.waitForSelector('textarea.abc');
  await p.fill('.song-fields input[placeholder="Title"]', 'Made in the Creator');
  await p.click('text=Save song');
  await p.waitForTimeout(300);
  check((await names()).includes('Made in the Creator.abc'), 'saving in the Creator writes the file');

  // delete from Songs
  await p.evaluate(() => { location.hash = '#/songs/mine'; });
  await p.waitForSelector('.song.mine');
  const card = p.locator('.song.mine', { hasText: 'Already in the app' });
  await card.locator('button:text("Delete")').click();
  await card.locator('button:text("Delete this song?")').click();
  await p.waitForTimeout(300);
  check(!(await names()).includes('Already in the app.abc'), 'deleting a song deletes its file');

  // Download all
  await p.evaluate(() => { location.hash = '#/settings/folder'; });
  await p.waitForSelector('#folder');
  const dl = p.waitForEvent('download');
  await p.click('#folder >> text=Download all my songs (.abc)');
  const d = await dl;
  check(d.suggestedFilename() === 'my-songs.abc', 'Download all gives one .abc file');
  await p.click('#folder >> text=Stop using this folder');
  await p.waitForSelector('#folder >> text=Choose a folder…');
  check(await p.evaluate(() => GQ.custom.list().every((s) => !s.file) && window.__folder.size === 2), 'stopping keeps the files and the songs');
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
