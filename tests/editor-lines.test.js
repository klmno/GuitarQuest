// Creator editor line numbers: one number per line, problem lines marked, scrolls with the text, click on a problem jumps to its line.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  await p.goto(URL + '#/creator');
  await p.waitForSelector('.editor .gutter div');
  const lines = () => p.evaluate(() => document.querySelector('textarea.abc').value.split('\n').length);
  const nums = () => p.$$eval('.editor .gutter div', (d) => d.map((x) => +x.textContent));
  let n = await nums();
  check(n.length === await lines() && n[0] === 1 && n[n.length - 1] === n.length, 'one number for each line: ' + n.length);
  // a long song with a mistake on line 30
  const body = Array.from({ length: 40 }, (_, i) => (i === 29 ? 'C D E Q2 |' : 'C D E F |')).join('\n');
  await p.fill('textarea.abc', 'X:1\nT:Lines\nM:4/4\nL:1/4\nK:C\n' + body);
  await p.waitForTimeout(200);
  n = await nums();
  check(n.length === 45, 'numbers follow the text: ' + n.length);
  const errLine = await p.evaluate(() => [...document.querySelectorAll('.editor .gutter .err')].map((x) => +x.textContent));
  const reported = await p.evaluate(() => [...document.querySelectorAll('ul.problems li.err')].map((x) => +(/Line (\d+)/.exec(x.textContent) || [])[1]));
  check(errLine.length > 0 && errLine.every((l) => reported.includes(l)) && errLine.includes(35), 'the error line is marked in the gutter: ' + errLine + ' (reported ' + reported + ')');
  // aligned: the gutter row and the text line sit at the same height
  const lh = await p.evaluate(() => { const g = document.querySelector('.editor .gutter div'), t = document.querySelector('textarea.abc'); return [g.getBoundingClientRect().height, parseFloat(getComputedStyle(t).lineHeight)]; });
  check(Math.abs(lh[0] - lh[1]) < 0.5, 'gutter rows have the text line height: ' + lh.map((x) => x.toFixed(1)));
  // clicking the problem scrolls to it and the gutter follows
  await p.click('ul.problems li.err >> nth=0');
  await p.waitForTimeout(100);
  const sc = await p.evaluate(() => [document.querySelector('textarea.abc').scrollTop, document.querySelector('.editor .gutter').scrollTop]);
  check(sc[0] > 0 && Math.abs(sc[0] - sc[1]) < 1, 'gutter scrolls with the text: ' + sc);
  const cur = await p.$eval('.editor .gutter .cur', (x) => +x.textContent);
  check(cur === 35, 'cursor line highlighted after the jump: ' + cur);
  const visible = await p.evaluate(() => { const g = document.querySelector('.editor .gutter'), c = g.querySelector('.cur'); const a = g.getBoundingClientRect(), r = c.getBoundingClientRect(); return r.top >= a.top && r.bottom <= a.bottom; });
  check(visible, 'the error line is in view');
  await p.screenshot({ path: __dirname + '/shots/30-editor-lines.png' });
  // long lines scroll sideways instead of wrapping, so the numbers stay on their lines
  await p.fill('textarea.abc', 'X:1\nT:Wide\nM:4/4\nL:1/4\nK:C\n' + Array(60).fill('C D E F |').join(' ') + '\nG A B c |');
  await p.waitForTimeout(100);
  check(await p.evaluate(() => { const t = document.querySelector('textarea.abc'); return t.scrollWidth > t.clientWidth; }), 'long lines do not wrap');
  // tab songs get numbers too
  await p.click('.song-fields .seg >> text=Tab');
  await p.waitForTimeout(200);
  check((await nums()).length === await lines(), 'tab text numbered too');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
