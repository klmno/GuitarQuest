// Creator: suggested fixes (one button per problem), Fix all, Tidy up, and undo.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  const val = () => p.inputValue('textarea.abc');
  const errCount = () => p.$$eval('ul.problems li.err', (l) => l.length);
  await p.goto(URL + '#/creator');
  await p.waitForSelector('.editor .gutter div');
  // one fix at a time
  await p.fill('textarea.abc', 'X:1\nT:Fixes\nM:4/4\nL:1/4\nK:C\nC D E F# | G A B c |');
  await p.waitForTimeout(150);
  const btn = await p.$('ul.problems li.err .fix');
  check(btn && /Write \^F/.test(await btn.textContent()), 'a sharp written as F# gets a fix button: ' + (btn && await btn.textContent()));
  await btn.click();
  await p.waitForTimeout(150);
  check((await val()).includes('C D E ^F |'), 'the fix rewrites it as ^F');
  check(await p.isVisible('ul.problems >> text=No problems found.'), 'no problems left');
  await p.click('textarea.abc'); await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  check((await val()).includes('F#'), 'Ctrl+Z undoes the fix');
  // several errors: Fix all
  await p.fill('textarea.abc', 'X:1\nT:Many\nM:4x4\nL:1/8\nQ:fast\nK:G\nC,,,,2 D2 @E2 F2 | [CEG c2 B2 c2 |\n"Am A2 B2 c2 d2 |');
  await p.waitForTimeout(150);
  const before = await errCount();
  check(await p.isVisible('text=Fix all errors'), 'Fix all appears with several fixable errors (' + before + ' errors)');
  await p.screenshot({ path: __dirname + '/shots/34-fixes.png' });
  await p.click('text=Fix all errors');
  await p.waitForTimeout(200);
  check(await errCount() === 0, 'Fix all leaves no errors: ' + (await val()).replace(/\n/g, ' / '));
  check(/M:4\/4/.test(await val()) && /Q:1\/4=100/.test(await val()) && /\[CEG\]/.test(await val()), 'meter, tempo and chord bracket fixed');
  await p.click('textarea.abc'); await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  check((await val()).includes('M:4x4'), 'one Ctrl+Z undoes all of Fix all');
  // tidy up
  const messy = 'X:1\nT:Messy\n% my notes\nO:Somewhere\nR:reel\nZ:typed by me\nM:4/4\nL:1/8\nK:G\n"G"!p! .G2 (AB) {g}c2 ~d2 | "^verse"e2 d2 B2 G2 | % end of line\nw: la la la\n\n"D"A2 F#2 D2 B,2 | G8 |]';
  await p.fill('textarea.abc', messy);
  await p.waitForTimeout(150);
  const beforeEvents = await p.evaluate(() => GQ.abc.parse(document.querySelector('textarea.abc').value.replace(/F#/, '^F')).events.length);
  await p.click('text=Tidy up');
  await p.waitForTimeout(200);
  const t = await val();
  check(!/%|O:|R:|Z:|w:|!p!|\{g\}|\(|~|"\^verse"/.test(t), 'tidy removes comments, unused headers, lyrics, decorations, grace notes, slurs and annotations');
  check(t.includes('"G"') && t.includes('"D"') && t.includes('^F2'), 'chord symbols kept and the sharp rewritten');
  check(await p.evaluate(() => GQ.abc.parse(document.querySelector('textarea.abc').value).events.length) === beforeEvents, 'the notes are the same after tidying');
  check(await p.isVisible('.toast >> text=Tidied up') || await p.isVisible('text=Tidied up'), 'a message says what was removed');
  await p.screenshot({ path: __dirname + '/shots/35-tidy.png' });
  await p.click('textarea.abc'); await p.keyboard.press('Control+z'); await p.waitForTimeout(150);
  check((await val()) === messy, 'Ctrl+Z restores the text exactly');
  // tab tidy
  await p.click('.song-fields .seg >> text=Tab');
  await p.waitForTimeout(150);
  await p.fill('textarea.abc', 'My riff\n[Intro] Am\nTempo: 90\n\ne|-----0-----|\nB|---1---1---|\nG|-2-------2-|\nD|-----------|\nA|-0---------|\nE|-----------|\n\n\n\nlyrics go here');
  await p.waitForTimeout(150);
  await p.click('text=Tidy up');
  await p.waitForTimeout(150);
  const tt = await val();
  check(/^Title: My riff\nTempo: 90\n\ne\|/.test(tt) && !/Intro|lyrics/.test(tt), 'tab tidy keeps the tab, makes the first line the title, drops the rest: ' + tt.split('\n').slice(0, 3).join(' / '));
  await p.fill('textarea.abc', 'Title: T\nTempo: 999\nTime: 5/x\n\ne|-----0-----|\nB|---1---1---|\nG|-2-------2-|\nD|-----------|\nA|-0---------|\nE|-----------|');
  await p.waitForTimeout(150);
  await p.click('text=Fix all errors');
  await p.waitForTimeout(150);
  check(/Tempo: 400\nTime: 4\/4/.test(await val()) && await errCount() === 0, 'tab tempo and time fixed');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
