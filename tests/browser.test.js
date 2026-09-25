// End-to-end check in headless Chromium with a fake audio input.
// Usage: node tests/browser.test.js [url]   (serve the repo root first, e.g. python3 -m http.server 8777)
const { chromium } = require('playwright');
const path = require('path');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
const WAV = process.env.GQ_WAV || '/tmp/guitar.wav';
const shots = process.env.GQ_SHOTS || path.join(__dirname, 'shots');
(async () => {
  require('fs').mkdirSync(shots, { recursive: true });
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--use-file-for-fake-audio-capture=' + WAV, '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };

  await p.goto(URL);
  await p.waitForSelector('.unit');
  check((await p.$$('.lvl')).length >= 120, 'learn screen lists 120+ levels');
  await p.screenshot({ path: shots + '/1-learn.png' });

  // connect input
  await p.click('text=Allow audio input');
  await p.waitForTimeout(800);
  await p.click('text=Use this input');
  await p.waitForFunction(() => GQ.audio.ctx && GQ.audio.ctx.state === 'running', null, { timeout: 5000 });
  check(true, 'input opened');
  check(!(await p.evaluate(() => GQ.audio.canScore())), 'fake input is not trusted for scoring until confirmed');
  await p.evaluate(() => { GQ.audio.markGuitar(true); GQ.tuner.markPassed(); });
  check(await p.evaluate(() => GQ.audio.canScore() && GQ.tuner.isTuned()), 'confirmed as guitar and tuned');

  // simulated detections only: keep the fake microphone's own notes out of the lesson tests
  await p.evaluate(() => GQ.audio.source.disconnect());

  // ---- beginner lesson with simulated detections ----
  await p.evaluate(() => { GQ.store.setSetting('mode', 'beginner'); location.hash = '#/lesson/u2-1'; });
  await p.waitForSelector('.lesson-head');
  await p.click('text=▶ Start');
  const beginner = await p.evaluate(async () => {
    const A = GQ.audio, T = GQ.theory;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    let end = null;
    // find the live lesson through its screen: listen on the store
    GQ.store.on('progress', (r) => { end = r; });
    // first a wrong note, then every right note
    const lessonTargets = GQ.notation.parse(GQ.curriculum.byId('u2-1').text.split(' | ').concat([]).join(' | ')).events;
    let first = true;
    const lv = GQ.curriculum.byId('u2-1');
    const evs = GQ.notation.parse(Array(lv.repeat || 1).fill(lv.text).join(' | '), { pos: lv.pos }).events.filter((e) => e.kind !== 'rest');
    for (const e of evs) {
      const midi = T.midiAt(e.notes[0].string, e.notes[0].fret);
      if (first) { A.emit('note', { freq: T.midiToFreq(midi + 2), conf: 0.95, onsetTime: A.ctx.currentTime, legato: false }); first = false; await sleep(30); }
      A.emit('note', { freq: T.midiToFreq(midi) * 1.002, conf: 0.97, onsetTime: A.ctx.currentTime, legato: false });
      await sleep(25);
    }
    await sleep(300);
    return end;
  });
  check(beginner && beginner.scored && beginner.score >= 95 && beginner.score < 100 && beginner.stars === 3, 'beginner run scored, one wrong attempt costs points: ' + JSON.stringify(beginner && { score: beginner.score, stars: beginner.stars, scored: beginner.scored }));
  await p.screenshot({ path: shots + '/2-result.png' });
  await p.click('text=Close');

  // ---- intermediate lesson in time with simulated onsets ----
  const timed = await p.evaluate(async () => {
    GQ.store.setSetting('mode', 'intermediate');
    GQ.store.setSetting('countIn', false);
    const lv = GQ.curriculum.byId('u3-2');
    const L = new GQ.Lesson(lv, { mode: 'intermediate' });
    L.setTempo(2.5); // speed up the test
    const A = GQ.audio, T = GQ.theory;
    let end = null; L.on('end', (r) => (end = r));
    L.start();
    const off = A.offsetSec();
    const r = GQ.rng(7);
    // play each note with up to ±25 ms of human timing error, but skip one note and play one wrong note
    L.targets.forEach((e, k) => {
      if (k === 5) return;                                  // missed note
      const midi = T.midiAt(e.notes[0].string, e.notes[0].fret) + (k === 9 ? 1 : 0); // one wrong note
      const t = L.beatToTime(e.beat) + off + (r() - 0.5) * 0.05;
      const delay = (t - A.ctx.currentTime) * 1000 + 30;
      setTimeout(() => A.emit('note', { freq: T.midiToFreq(midi), conf: 0.96, onsetTime: t, legato: false }), Math.max(0, delay));
    });
    await new Promise((res) => { const iv = setInterval(() => { if (end) { clearInterval(iv); res(); } }, 50); });
    return { score: end.score, accuracy: end.accuracy, hits: end.hits, notes: end.notes, timing: end.timingMs, stars: end.stars };
  });
  check(timed.notes === 64 && timed.hits === 62 && timed.timing <= 25, 'intermediate: 62/64 hits, timing error measured: ' + JSON.stringify(timed));

  // ---- chord level in time with simulated onset + chroma ----
  const chords = await p.evaluate(async () => {
    const lv = GQ.curriculum.byId('u5-11'); // G C D
    const L = new GQ.Lesson(lv, { mode: 'intermediate' });
    L.setTempo(2);
    const A = GQ.audio, C = GQ.chords;
    let end = null; L.on('end', (r) => (end = r));
    L.start();
    const off = A.offsetSec();
    let frame = 1000;
    L.targets.forEach((e, k) => {
      const t = L.beatToTime(e.beat) + off + 0.01;
      const f = frame++;
      const tpl = C.template(k === 3 ? C.get('Em') : e.chord);   // one wrong chord
      const mx = Math.max(...tpl), chroma = tpl.map((v) => v / mx);
      setTimeout(() => A.emit('onset', { frame: f, time: t }), Math.max(0, (t - A.ctx.currentTime) * 1000 + 10));
      setTimeout(() => A.emit('chroma', { onsetFrame: f, time: t, chroma, decayDb: -3 }), Math.max(0, (t - A.ctx.currentTime) * 1000 + 160));
    });
    await new Promise((res) => { const iv = setInterval(() => { if (end) { clearInterval(iv); res(); } }, 50); });
    return { notes: end.notes, hits: end.hits, chordMisses: end.chordMisses, score: end.score };
  });
  check(chords.hits === chords.notes - 1 && chords.chordMisses.length === 1, 'chords: wrong chord caught, others matched: ' + JSON.stringify(chords));

  await p.evaluate(() => GQ.audio.source.connect(GQ.audio.node));
  // ---- screens ----
  await p.evaluate(() => { GQ.store.setSetting('mode', 'intermediate'); location.hash = '#/lesson/u5-11'; });
  await p.waitForSelector('.lesson-head');
  await p.click('text=▶ Start');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: shots + '/3-lesson-chords.png' });
  await p.evaluate(() => { location.hash = '#/lesson/u7-8'; });
  await p.waitForTimeout(400);
  await p.click('text=▶ Start');
  await p.waitForTimeout(3000);
  await p.screenshot({ path: shots + '/4-lesson-notes.png' });
  await p.evaluate(() => { GQ.store.setSetting('mode', 'advanced'); location.hash = '#/lesson/u13-6'; });
  await p.waitForTimeout(400);
  await p.click('text=▶ Start');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: shots + '/5-lesson-notation.png' });
  for (const [hash, name] of [['#/tuner', '6-tuner'], ['#/songs', '7-songs'], ['#/progress', '8-progress'], ['#/settings', '9-settings']]) {
    await p.evaluate((hh) => { location.hash = hh; }, hash);
    await p.waitForTimeout(1200);
    await p.screenshot({ path: shots + '/' + name + '.png', fullPage: name === '9-settings' });
  }
  await p.evaluate(() => { location.hash = '#/tuner'; });
  await p.waitForTimeout(1500);
  console.log('errors so far', JSON.stringify(errs.slice(0,3)));
  const tunerNote = await p.textContent('.tuner .note', { timeout: 3000 }).catch(() => null);
  check(tunerNote && tunerNote !== '–', 'tuner reads the fake input: ' + tunerNote);

  // device loss pauses (REQ-HW-4)
  await p.evaluate(() => { location.hash = '#/lesson/u3-1'; });
  await p.waitForTimeout(400);
  await p.click('text=▶ Start');
  await p.waitForTimeout(800);
  await p.evaluate(() => GQ.audio.track.dispatchEvent(new Event('ended')));
  await p.waitForTimeout(600);
  check(await p.isVisible('text=Everything is paused and nothing was scored'), 'unplugging the input pauses and says so');

  // mobile layout: no horizontal scroll
  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(() => { location.hash = '#/learn'; });
  await p.waitForTimeout(500);
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, 'phone width has no horizontal scroll (' + overflow + ')');
  await p.screenshot({ path: shots + '/10-phone.png' });

  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs.slice(0, 5)));
  await b.close();
})();
