// Custom songs written as tab: paste into the Creator, save, play, export, import.
const { chromium } = require('playwright');
const fs = require('fs'), os = require('os'), path = require('path');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
const RIFF = fs.readFileSync(__dirname + '/fixtures/example.tab', 'utf8').replace(/^Title:.*\n/, '');
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  const paste = (t) => p.evaluate((t) => {
    const ta = document.querySelector('textarea.abc'); ta.focus();
    const dt = new DataTransfer(); dt.setData('text/plain', t);
    ta.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, t);

  await p.goto(URL + '#/creator');
  await p.waitForSelector('textarea.abc');
  check(await p.isVisible('.seg >> button.on:text("ABC")'), 'a new song starts as ABC');
  await paste(RIFF);
  await p.waitForTimeout(200);
  check(await p.isVisible('.seg >> button.on:text("Tab")'), 'pasting tab into a new song switches it to tab');
  const text = await p.inputValue('textarea.abc');
  check(/^Title: My new tab\nTime: 4\/4\n\nTempo: 100\n/.test(text) && text.includes('E|-0--------6-5'), 'the tab is kept as pasted, with only the missing header lines added');
  check(!(await p.isVisible('canvas.creator-fb')) && !(await p.isVisible('.creator-tools')) && await p.isVisible('.tab-hint'), 'ABC tools are hidden, the tab hint is shown');
  check(!(await p.isVisible('label.field:has-text("Default note length")')), 'ABC-only fields are hidden');
  check(await p.isVisible('ul.problems >> text=No problems found.'), 'no problems');
  check(/^17 bars/.test(await p.textContent('.preview-card .small.muted')), 'preview counts the bars: ' + await p.textContent('.preview-card .small.muted'));
  await p.fill('.song-fields input[placeholder="Title"]', 'Pasted riff');
  await p.fill('.song-fields input[type=number]', '120');
  const t2 = await p.inputValue('textarea.abc');
  check(t2.startsWith('Title: Pasted riff\nTime: 4/4\n\nTempo: 120\n'), 'title and tempo fields write the tab header');
  await p.screenshot({ path: __dirname + '/shots/21-creator-tab.png', fullPage: true });
  await p.click('text=♪ Listen'); await p.waitForTimeout(300);
  check(await p.evaluate(() => GQ.preview.active()), 'Listen plays the tab');
  await p.click('text=■ Stop');
  await p.click('text=Save song');
  await p.waitForTimeout(200);
  const saved = await p.evaluate(() => GQ.custom.list());
  check(saved.length === 1 && saved[0].format === 'tab' && saved[0].title === 'Pasted riff' && saved[0].bpm === 120, 'saved as a tab song');

  // Songs: card, export, play, edit
  await p.evaluate(() => { location.hash = '#/songs/mine'; });
  await p.waitForSelector('.song.mine');
  check(await p.isVisible('.song.mine >> text=my song · tab'), 'the card says it is tab');
  const dl = p.waitForEvent('download');
  await p.click('.song.mine >> text=Export');
  const d = await dl;
  check(d.suggestedFilename() === 'pasted-riff.tab', 'Export downloads a .tab file: ' + d.suggestedFilename());
  await p.click('.song.mine >> text=Play');
  await p.waitForSelector('.lesson-head');
  check((await p.textContent('.lesson-head')).includes('Pasted riff'), 'the tab song plays as a lesson');
  check(await p.evaluate(() => { const l = GQ.curriculum.songLevel('custom-' + GQ.custom.list()[0].id, 'full'); return GQ.notation.parseLevel(l).events.some((e) => e.tech.pm); }), 'the lesson keeps the palm mutes');
  await p.click('text=Edit in Creator');
  await p.waitForSelector('textarea.abc');
  check(await p.isVisible('.seg >> button.on:text("Tab")') && (await p.inputValue('textarea.abc')).startsWith('Title: Pasted riff'), 'Edit reopens it as tab');

  // switching an existing song's format asks first, and converts nothing
  p.once('dialog', (dg) => dg.dismiss());
  await p.click('.seg >> button:text("ABC")');
  check(await p.isVisible('.seg >> button.on:text("Tab")'), 'switching to ABC asks first (and cancel keeps the tab)');

  // pasting tab into an ABC song that has notes does not switch it
  await p.click('text=New');
  await p.click('.seg >> button:text("ABC")');
  await p.evaluate(() => { location.hash = '#/help'; });
  await p.click('#h-start >> text=Open in the Creator');
  await p.waitForSelector('textarea.abc');
  await p.click('textarea.abc'); await p.keyboard.press('End');
  await paste(RIFF);
  await p.waitForTimeout(200);
  check(await p.isVisible('.seg >> button.on:text("ABC")') && await p.isVisible('.toast >> text=this song is written in ABC'), 'tab pasted into an ABC song with notes: it stays ABC, with advice');

  // import a .tab file in Songs
  const tmp = path.join(os.tmpdir(), 'Imported riff.tab');
  fs.writeFileSync(tmp, RIFF);
  await p.evaluate(() => { location.hash = '#/songs'; });
  await p.waitForSelector('.songs');
  await p.setInputFiles('input[type=file]', tmp);
  await p.waitForTimeout(300);
  check(await p.evaluate(() => GQ.custom.list().some((s) => s.format === 'tab' && s.title === 'Imported riff')), 'Import adds a .tab file as a tab song named after the file');

  // the help page example
  await p.evaluate(() => { location.hash = '#/help'; });
  await p.click('#h-tab >> text=Open in the Creator');
  await p.waitForSelector('textarea.abc');
  check(await p.isVisible('.seg >> button.on:text("Tab")') && await p.isVisible('ul.problems >> text=No problems found.'), 'the help example opens as tab with no problems');

  // lessons and practice are unchanged
  await p.evaluate(() => { location.hash = '#/lesson/' + GQ.curriculum.levels[3].id; });
  await p.waitForSelector('.lesson-head');
  check(!(await p.evaluate(() => GQ.curriculum.levels.some((l) => l.tab))), 'built-in lessons are not tab songs');
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
