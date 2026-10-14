// Keyboard shortcuts for each page: labels, keys, choosing them in Settings, conflicts.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  const before = (sel) => p.evaluate((sel) => getComputedStyle(document.querySelector(sel), '::before').content, sel);
  const go = async (hash, sel) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForSelector(sel); await p.mouse.click(5, 5); };

  await p.goto(URL + '#/learn');
  await p.waitForSelector('[data-sk="start"]');
  check(await before('[data-sk="start"]') === '"1."', 'Learn: the start button reads "1.▶ …"');
  check(await before('[data-sk="intermediate"]') === '"3."', 'Learn: Intermediate reads "3.Intermediate"');
  await p.keyboard.press('3');
  check(await p.evaluate(() => GQ.store.settings().mode) === 'intermediate', 'Learn: key 3 picks Intermediate');
  await p.keyboard.press('Numpad2');
  check(await p.evaluate(() => GQ.store.settings().mode) === 'beginner', 'the number pad works too');
  await p.keyboard.press('Control+4');
  check(await p.evaluate(() => GQ.store.settings().mode) === 'beginner', 'with Ctrl held, nothing happens');

  await go('#/songs', '.songs');
  await p.keyboard.press('4');
  check(await p.isVisible('.seg button.on[data-cat="mine"]'), 'Songs: key 4 shows My songs');
  await p.screenshot({ path: __dirname + '/shots/23-shortcuts-songs.png', clip: { x: 0, y: 0, width: 1280, height: 260 } });

  await go('#/practice', '.px-search');
  await p.keyboard.press('3');
  check(await p.evaluate(() => document.activeElement.classList.contains('px-search')) && await p.inputValue('.px-search') === '', 'Practice: key 3 goes to the search box without typing a 3');
  await p.keyboard.type('spider');
  check(await p.inputValue('.px-search') === 'spider', 'typing in the box is not taken as shortcuts');

  // lesson
  const lv = await p.evaluate(() => GQ.curriculum.levels[3].id);
  await go('#/lesson/' + lv, '[data-sk="toggle"]');
  check(await before('[data-sk="toggle"]') === '"1."' && await before('[data-sk="next"]') === '"8."', 'Lesson: Start reads "1.▶ Start", Next level "8.Next level →"');
  const bpm0 = await p.textContent('.toolbar .mono, .toolbar span:has-text("BPM")').catch(() => '');
  await p.keyboard.press('5');
  const bpm1 = await p.evaluate(() => [...document.querySelectorAll('.toolbar *')].map((e) => e.textContent).find((t) => /^\d+ BPM$/.test(t)));
  check(bpm1 && bpm1 !== bpm0, 'Lesson: key 5 is faster: ' + bpm1);
  await p.keyboard.press('7');
  check(await p.isVisible('.loopbar'), 'Lesson: key 7 opens Loop');
  await p.screenshot({ path: __dirname + '/shots/24-shortcuts-lesson.png', clip: { x: 0, y: 0, width: 1280, height: 260 } });

  // Creator: digits typed in the text are text
  await go('#/creator', 'textarea.abc');
  await p.click('textarea.abc'); await p.keyboard.press('Control+End'); await p.keyboard.press('Meta+ArrowDown');
  await p.keyboard.type('8');
  check((await p.inputValue('textarea.abc')).endsWith('8') && await p.isVisible('.seg button.on[data-f="abc"]'), 'Creator: a digit typed in the text stays text');
  await p.keyboard.press('Backspace');
  await p.mouse.click(5, 5);
  await p.keyboard.press('8');
  check(await p.isVisible('.seg button.on[data-f="tab"]'), 'Creator: key 8 switches to tab');

  // Settings: choose keys
  await go('#/settings/shortcuts', '#shortcuts');
  check((await p.$$('#shortcuts table.keys tr')).length === 8, 'Settings lists the 8 lesson shortcuts');
  const row = (name) => p.locator('#shortcuts tr', { hasText: name });
  await row('Again').locator('text=Set key').click();
  await p.keyboard.press('KeyA');
  check(await row('Again').locator('kbd').textContent() === 'A', 'Set key: Again is now A');
  await row('Listen').locator('text=Set key').click();
  await p.keyboard.press('KeyA');
  check(await row('Listen').locator('kbd').textContent() === 'A' && await row('Again').locator('text=none').isVisible(), 'one key, one action: A moves from Again to Listen');
  check(await p.isVisible('#shortcuts >> text=A was taken from: Again.'), 'and says so');
  await row('Lock').locator('text=Set key').click();
  await p.keyboard.press('Space');
  check(await p.evaluate(() => !GQ.store.settings().keys.toggle.includes('Space')), 'a lesson shortcut takes its key from the hands-free keys');
  await row('Slower').locator('text=Set key').click();
  await p.keyboard.press('Escape');
  check(await row('Slower').locator('kbd').textContent() === '4', 'Escape keeps the old key');
  await row('Next level').locator('text=Clear').click();
  check(await row('Next level').locator('text=none').isVisible(), 'Clear removes a key');
  await p.screenshot({ path: __dirname + '/shots/25-shortcuts-settings.png', clip: { x: 0, y: 0, width: 1280, height: 900 } });
  await go('#/lesson/' + lv, '[data-sk="toggle"]');
  check(await before('[data-sk="listen"]') === '"A."' && await before('[data-sk="again"]') === 'none' && await before('[data-sk="next"]') === 'none', 'the lesson labels follow: "A.♪ Listen", Again and Next level without a key');
  await go('#/settings/shortcuts', '#shortcuts');
  await p.click('#shortcuts >> text=Default keys');
  check(await row('Again').locator('kbd').textContent() === '2', 'Default keys puts them back');
  await p.selectOption('#shortcuts select', 'tuner');
  check((await p.$$('#shortcuts table.keys tr')).length === 8 && await row('Low E string').locator('kbd').textContent() === '1', 'other pages have their own list');

  // the result panel after a run has its own keys and labels
  await p.goto(URL);
  await p.click('text=Allow audio input'); await p.waitForTimeout(700);
  await p.click('text=Use this input');
  await p.waitForFunction(() => GQ.audio.ctx && GQ.audio.ctx.state === 'running');
  await p.evaluate(() => { GQ.audio.source.disconnect(); GQ.audio.markGuitar(true); GQ.tuner.markPassed(); GQ.store.setSetting('mode', 'beginner'); GQ.steps.setStart('u2-4', 10); location.hash = '#/lesson/u2-4'; });
  await p.waitForSelector('[data-sk="toggle"]');
  const playStep = async () => {
    await p.mouse.click(5, 5);
    await p.keyboard.press('1');
    await p.evaluate(async () => {
      const A = GQ.audio, T = GQ.theory, sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const lv = GQ.curriculum.byId('u2-4'), parsed = GQ.notation.parse(lv.text, { pos: lv.pos });
      const keep = GQ.steps.keep(parsed.events, 4, GQ.steps.startStep('u2-4'));
      for (const e of parsed.events.filter((x) => keep.has(x.i))) { A.emit('note', { freq: T.midiToFreq(T.midiAt(e.notes[0].string, e.notes[0].fret)), conf: 0.97, onsetTime: A.ctx.currentTime }); await sleep(25); }
    });
    await p.waitForSelector('.overlay');
  };
  await playStep();
  check(await before('.overlay [data-sk="nextstep"]') === '"1."' && await before('.overlay [data-sk="again"]') === '"2."' && await before('.overlay [data-sk="close"]') === '"3."' && await before('.overlay [data-sk="next"]') === '"8."',
    'result panel: "1.Next step", "2.↺ Again", "3.Close", "8.Next level"');
  await p.screenshot({ path: __dirname + '/shots/26-shortcuts-result.png' });
  await p.keyboard.press('3');
  check(!(await p.$('.overlay')), 'result panel: key 3 closes it');
  await playStep();
  await p.keyboard.press('1');
  check(!(await p.$('.overlay')) && /Playing \d+ notes/.test(await p.textContent('.stepbar')) && await p.evaluate(() => GQ.steps.startStep('u2-4')) === 20, 'result panel: key 1 goes to the next step');
  await playStep();
  await p.keyboard.press('8');
  await p.waitForFunction(() => location.hash !== '#/lesson/u2-4');
  check(await p.evaluate(() => location.hash) === '#/lesson/' + await p.evaluate(() => GQ.curriculum.next('u2-4').id), 'result panel: key 8 opens the next level');
  check(await before('[data-sk="toggle"]') === '"1."', 'and the next level shows its shortcuts');
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
