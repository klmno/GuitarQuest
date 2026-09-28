// Practice tab: categories, search, Listen, playing an exercise, score shown back on its card.
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
  await p.click('.nav >> text=Practice');
  await p.waitForSelector('.px');
  const total = await p.$$eval('.px', (els) => els.length);
  check(total === await p.evaluate(() => GQ.practice.items.length), 'all exercises listed: ' + total);
  check(await p.isVisible('text=Minor pentatonic box 3'), 'pentatonic box 3 listed by name');
  check(await p.isVisible('text=also called spider walk'), 'alternative names shown');
  await p.screenshot({ path: __dirname + '/shots/20-practice.png' });
  await p.click('.seg >> text=Rhythm & chords');
  check(/#\/practice\/rhythm$/.test(await p.evaluate(() => location.hash)), 'category kept in the address');
  check(await p.isVisible('text=12-bar blues shuffle in A') && !(await p.isVisible('text=The spider')), 'category filter works');
  await p.click('.seg >> text=All');
  await p.fill('.px-search', 'box 4');
  check(await p.$$eval('.px', (els) => els.length) === 1, 'search narrows to one exercise');
  await p.fill('.px-search', '');
  await p.click('.px[data-id="px-spider"] .listen');
  await p.waitForTimeout(400);
  check((await p.textContent('.px[data-id="px-spider"] .listen')).includes('Stop'), 'Listen starts the preview');
  await p.click('.px[data-id="px-spider"] .listen');
  // play an exercise to the end with synthetic notes
  await p.evaluate(() => { GQ.audio.source.disconnect(); GQ.audio.markGuitar(true); GQ.tuner.markPassed(); GQ.store.setSetting('mode', 'beginner'); location.hash = '#/practice'; });
  await p.waitForSelector('.px[data-id="px-pent-box1"]');
  await p.click('.px[data-id="px-pent-box1"] >> text=Play');
  await p.waitForSelector('.stepbar');
  check(await p.isVisible('text=Practice · Pentatonic & blues'), 'lesson header names the practice category');
  check(await p.isVisible('text=Next exercise →'), 'next exercise button');
  await p.click('.seg.steps >> text=100%');
  await p.click('text=▶ Start');
  await p.evaluate(async () => {
    const A = GQ.audio, T = GQ.theory, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const lv = GQ.practice.byId('px-pent-box1');
    for (const e of GQ.notation.parse(lv.text, { pos: lv.pos }).events.filter((x) => x.notes.length)) {
      A.emit('note', { freq: T.midiToFreq(T.midiAt(e.notes[0].string, e.notes[0].fret)), conf: 0.97, onsetTime: A.ctx.currentTime });
      await sleep(25);
    }
  });
  await p.waitForSelector('.overlay');
  const big = await p.textContent('.result .big');
  check(big.trim() === '100%', 'perfect run scores 100%: ' + big);
  await p.screenshot({ path: __dirname + '/shots/21-practice-result.png' });
  await p.click('.overlay >> text=Close');
  await p.click('.lesson-head >> text=← Practice');
  await p.waitForSelector('.px[data-id="px-pent-box1"]');
  check(/Best 100%/.test(await p.textContent('.px[data-id="px-pent-box1"]')), 'best score shown on the card');
  check(await p.evaluate(() => location.hash) === '#/practice/pentatonic', 'back button returns to the category');
  const learnDone = await p.evaluate(() => GQ.curriculum.levels.filter((l) => l.kind !== 'tuner' && GQ.store.profile().levels[l.id]).length);
  check(learnDone === 0, 'practice runs do not count as curriculum levels');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
