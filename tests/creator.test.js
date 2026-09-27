// Creator, custom songs and the ABC help page, end to end.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  await p.goto(URL + '#/help');
  await p.waitForSelector('.helpsec');
  check((await p.$$('.helpsec')).length >= 10, 'help page has its sections');
  await p.screenshot({ path: __dirname + '/shots/16-help.png' });
  await p.click('#h-start >> text=Open in the Creator');
  await p.waitForSelector('textarea.abc');
  check((await p.inputValue('textarea.abc')).includes('T:My first tune'), 'help example opens in the Creator');
  check(await p.isVisible('ul.problems >> text=No problems found.'), 'example has no problems');

  // edit through the fields and the note tools
  await p.fill('.song-fields input[placeholder="Title"]', 'Test Song');
  check((await p.inputValue('textarea.abc')).includes('T:Test Song'), 'title field writes the T: line');
  await p.selectOption('.song-fields select >> nth=1', 'G'); // key
  check(/\nK:G/.test(await p.inputValue('textarea.abc')), 'key field writes K:');
  const count = () => p.evaluate(() => (document.querySelector('textarea.abc').value.match(/\|/g) || []).length);
  const before = await p.inputValue('textarea.abc');
  await p.click('textarea.abc'); await p.keyboard.press('Control+End');
  await p.click('.creator-tools >> text=Quarter');
  const box = await (await p.$('canvas.creator-fb')).boundingBox();
  // click near the 3rd fret of the A string, then the open G string
  const hitAt = async (s, f) => {
    const xy = await p.evaluate(([s, f]) => {
      const cv = document.querySelector('canvas.creator-fb');
      const pts = [];
      for (let x = 2; x < cv.clientWidth; x += 2) for (let y = 2; y < cv.clientHeight; y += 2) { const h = GQ.render.fretboardHit(cv, { lo: 0, hi: 15 }, x, y); if (h && h.string === s && h.fret === f) pts.push([x, y]); }
      return pts[Math.floor(pts.length / 2)];
    }, [s, f]);
    await p.mouse.click(box.x + xy[0], box.y + xy[1]);
  };
  await hitAt(5, 3); await hitAt(3, 0); await hitAt(4, 2); await hitAt(4, 4);
  const after = await p.inputValue('textarea.abc');
  const added = after.slice(before.length);
  check(/C G E F \|/.test(added.replace(/\s+/g, ' ')), 'fretboard clicks write notes (F sharp comes from the key) and a bar line: ' + JSON.stringify(added.trim()));
  await p.click('.creator-tools >> text=Rest');
  check(/z\s*$/.test(await p.inputValue('textarea.abc')), 'rest button');
  // a typing mistake is reported with its line
  await p.click('textarea.abc'); await p.keyboard.press('Control+End'); await p.keyboard.type(' C D ? ');
  check(await p.isVisible('ul.problems li.err >> text=Unexpected "?"'), 'mistakes are listed with their line');
  check(await p.isDisabled('text=Save song'), 'cannot save with problems');
  await p.keyboard.type(' ?'.repeat(30));
  const items = await p.$$eval('ul.problems li', (l) => l.map((x) => x.className + ':' + x.textContent));
  check(items.length === 11 && /^more:10 out of 31 errors shown/.test(items[10]), 'only the first 10 problems are listed, with the total: ' + items[10]);
  for (let k = 0; k < 60; k++) await p.keyboard.press('Backspace');
  await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace');
  check(await p.isEnabled('text=Save song'), 'fixed: save is enabled');
  await p.screenshot({ path: __dirname + '/shots/17-creator.png', fullPage: true });
  await p.click('text=♪ Listen'); await p.waitForTimeout(400);
  check(await p.evaluate(() => GQ.preview.active()), 'Listen plays the draft');
  await p.click('text=■ Stop');
  await p.click('text=Save song');
  await p.waitForTimeout(200);
  const saved = await p.evaluate(() => GQ.custom.list());
  check(saved.length === 1 && saved[0].title === 'Test Song', 'song saved to local storage');
  check(/#\/creator\/c/.test(await p.evaluate(() => location.hash)), 'the Creator now edits the saved song');

  // Songs > My songs
  await p.evaluate(() => { location.hash = '#/songs'; });
  await p.waitForSelector('.songs');
  check(await p.isVisible('.song.mine >> text=Test Song'), 'custom song shows in Songs');
  await p.click('.seg >> text=My songs');
  check((await p.$$('.song')).length === 1, 'My songs filter shows only your songs');
  const dl = p.waitForEvent('download');
  await p.click('.song.mine >> text=Export');
  const d = await dl;
  check(d.suggestedFilename() === 'test-song.abc', 'export downloads an .abc file: ' + d.suggestedFilename());
  // play it as a lesson, then Edit
  await p.click('.song.mine >> text=Play');
  await p.waitForSelector('.lesson-head');
  check(await p.isVisible('text=Edit in Creator'), 'lesson for a custom song has Edit');
  check((await p.textContent('.lesson-head')).includes('My song'), 'lesson labelled as your song');
  await p.click('text=Edit in Creator');
  await p.waitForSelector('textarea.abc');
  check((await p.inputValue('textarea.abc')).includes('T:Test Song'), 'Edit reopens the song in the Creator');
  await p.fill('.song-fields input[placeholder="Title"]', 'Test Song 2');
  await p.click('text=Save song');
  await p.waitForTimeout(200);
  check(await p.evaluate(() => GQ.custom.list().length === 1 && GQ.custom.list()[0].title === 'Test Song 2'), 'saving again updates the same song');

  // import a file with two tunes
  const tmp = path.join(os.tmpdir(), 'two.abc');
  fs.writeFileSync(tmp, 'X:1\nT:Tune A\nM:4/4\nL:1/4\nK:D\nD E F G | A4 |]\n\nX:2\nT:Tune B\nM:3/4\nL:1/4\nK:Am\nA B c | e3 |]\n');
  await p.evaluate(() => { location.hash = '#/songs'; });
  await p.waitForSelector('.songs');
  await p.setInputFiles('input[type=file]', tmp);
  await p.waitForTimeout(400);
  check(await p.evaluate(() => GQ.custom.list().map((s) => s.title).sort().join()) === 'Test Song 2,Tune A,Tune B', 'import adds every tune in the file');
  await p.screenshot({ path: __dirname + '/shots/18-mysongs.png' });
  const tuneB = p.locator('.song.mine', { hasText: 'Tune B' });
  await tuneB.locator('button:text("Delete")').click();
  await tuneB.locator('button:text("Delete this song?")').click();
  await p.waitForTimeout(200);
  check(await p.evaluate(() => GQ.custom.list().length === 2), 'delete needs a second tap');
  check(await p.evaluate(() => { const l = GQ.curriculum.songLevel('custom-' + GQ.custom.list()[0].id, 'full'); return !!l && l.abc && GQ.notation.parseLevel(l).events.length > 0; }), 'custom songs become playable levels');
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
