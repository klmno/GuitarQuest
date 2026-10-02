// Note steps in the lesson screen: fewer notes to play, capped score, next step, progress mark.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  await p.goto(URL);
  await p.click('text=Allow audio input'); await p.waitForTimeout(700);
  await p.click('text=Use this input');
  await p.waitForFunction(() => GQ.audio.ctx && GQ.audio.ctx.state === 'running');
  await p.evaluate(() => { GQ.audio.source.disconnect(); GQ.audio.markGuitar(true); GQ.tuner.markPassed(); GQ.store.setSetting('mode', 'beginner'); location.hash = '#/lesson/u2-4'; });
  await p.waitForSelector('.stepbar');
  await p.click('.seg.steps >> text=20%');
  const info = await p.textContent('.stepbar .small');
  check(/Playing 6 notes of 32/.test(info), 'step 20% plays 6 of 32 notes: ' + info);
  await p.screenshot({ path: __dirname + '/shots/15-steps.png' });
  const playAll = async () => {
    await p.click('text=▶ Start');
    await p.evaluate(async () => {
      const A = GQ.audio, T = GQ.theory, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const lv = GQ.curriculum.byId('u2-4');
      const parsed = GQ.notation.parse(lv.text, { pos: lv.pos });
      const step = GQ.steps.startStep('u2-4');
      const keep = GQ.steps.keep(parsed.events, 4, step);
      const mid = [];
      for (const e of parsed.events.filter((x) => keep.has(x.i))) {
        A.emit('note', { freq: T.midiToFreq(T.midiAt(e.notes[0].string, e.notes[0].fret)), conf: 0.97, onsetTime: A.ctx.currentTime });
        await sleep(25);
        mid.push(document.querySelector('.songprog').textContent);
      }
      window.__mid = mid;
    });
    await p.waitForSelector('.overlay');
  };
  await playAll();
  const big = await p.textContent('.result .big');
  check(big.trim() === '20%', 'perfect run at 20% scores 20%: ' + big);
  const mid = await p.evaluate(() => window.__mid);
  check(mid[2] === '3 / 6 right' && mid[5] === '6 / 6 right', 'the bar after the steps counts the notes played right: ' + mid.join(', '));
  check(await p.isVisible('text=Next step: 30% of the notes'), 'offers the next step');
  await p.click('text=Next step: 30% of the notes');
  check(/Playing 10 notes/.test(await p.textContent('.stepbar .small')), 'moved to 30%');
  check(await p.isVisible('.seg.steps button.cleared >> text=20%'), '20% step marked as cleared');
  await p.evaluate(() => { location.hash = '#/learn'; });
  await p.waitForSelector('.unit');
  check(await p.isVisible('text=step 20% cleared'), 'learn tile shows the step progress');
  await p.evaluate(() => { location.hash = '#/lesson/u2-4'; });
  await p.waitForSelector('.stepbar');
  check(await p.isVisible('.seg.steps button.on >> text=30%'), 'reopening the lesson resumes at 30%');
  // preview plays only the step's notes
  await p.click('text=♪ Listen');
  await p.waitForTimeout(300);
  check(await p.evaluate(() => GQ.preview.active()), 'listen works at a step');
  await p.click('text=■ Stop listening');
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
