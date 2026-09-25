// Practice runs must show on the Learn screen, and a passed tuning check must survive a reload.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  await p.goto(URL);
  await p.click('text=Allow audio input'); await p.waitForTimeout(700);
  await p.click('text=Use this input');
  await p.waitForFunction(() => GQ.audio.ctx && GQ.audio.ctx.state === 'running');
  await p.evaluate(() => GQ.audio.source.disconnect());
  await p.evaluate(() => { location.hash = '#/lesson/u1-2'; });
  await p.waitForSelector('.lesson-head');
  check(await p.isVisible('text=Scores are off until you tune'), 'lesson warns before the run that it will not be scored');
  check(await p.isVisible('text=This is my guitar'), 'lesson offers to confirm the input');
  // play the level untuned
  await p.click('text=▶ Start');
  await p.evaluate(async () => {
    const A = GQ.audio, T = GQ.theory, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const lv = GQ.curriculum.byId('u1-2');
    const evs = GQ.notation.parse(Array(lv.repeat || 1).fill(lv.text).join(' | ')).events.filter((e) => e.kind !== 'rest');
    for (const e of evs) { A.emit('note', { freq: T.midiToFreq(T.midiAt(e.notes[0].string, e.notes[0].fret)), conf: 0.97, onsetTime: A.ctx.currentTime }); await sleep(20); }
  });
  await p.waitForSelector('text=Practice run (not scored)');
  check(true, 'result says it was a practice run');
  await p.click('text=Close');
  await p.evaluate(() => { location.hash = '#/learn'; });
  await p.waitForSelector('.unit');
  check(await p.isVisible('text=practised · 100%'), 'learn screen shows the practised level');
  // confirm guitar + tune, reload, still tuned
  await p.click('text=This is my guitar');
  await p.evaluate(() => GQ.tuner.markPassed());
  await p.reload();
  await p.click('text=Allow audio input'); await p.waitForTimeout(900);
  await p.waitForFunction(() => GQ.audio.ctx && GQ.audio.ctx.state === 'running');
  check(await p.evaluate(() => GQ.tuner.isTuned() && GQ.audio.canScore()), 'tuning check and guitar confirmation survive a reload');
  await p.evaluate(() => { location.hash = '#/learn'; });
  await p.waitForTimeout(300);
  check(!(await p.isVisible('text=Scores are off')), 'no warning once tuned and confirmed');
  check(await p.isVisible('.lvl.passed >> text=Tune up'), 'level 1.1 counts as passed once tuned');
  await p.screenshot({ path: __dirname + '/shots/11-progress-fix.png' });
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
