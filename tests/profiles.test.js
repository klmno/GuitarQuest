// Profiles: separate progress per player, switching, start-up picker, rename, delete (REQ-SC-4).
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  const passLevel = (id) => p.evaluate((lid) => GQ.store.recordRun({ level: lid, score: 90, stars: 2, accuracy: 90, timingMs: 20, unclear: 0, mode: 'beginner', scored: true }), id);

  await p.goto(URL);
  await p.waitForSelector('.unit');
  await passLevel('u1-2'); await passLevel('u1-3');
  await p.click('.profilechip');
  await p.waitForSelector('.profiles');
  await p.fill('.profile.add input', 'Ana');
  await p.click('text=+ Add profile');
  await p.waitForSelector('.unit');
  check((await p.textContent('.profilechip')).includes('Ana'), 'new profile becomes the active one');
  check(await p.evaluate(() => GQ.store.summary(GQ.store.profile().id).passed === 0), 'Ana starts with no progress');
  await passLevel('u2-1');
  await p.click('.profilechip');
  await p.waitForSelector('.profiles');
  const cards = await p.$$eval('.profile:not(.add)', (els) => els.map((e) => e.querySelector('.pname').textContent + ':' + e.querySelector('.pstats b').textContent));
  check(cards.includes('Player 1:2/140') && cards.includes('Ana:1/140'), 'each profile card shows its own progress ' + JSON.stringify(cards));
  await p.screenshot({ path: __dirname + '/shots/12-profiles.png' });
  await p.click('text=Switch to Player 1');
  await p.waitForSelector('.unit');
  check(await p.evaluate(() => GQ.store.profile().name === 'Player 1' && !!GQ.store.levelResult('u1-2') && !GQ.store.levelResult('u2-1')), 'switching back shows Player 1 progress only');

  // start-up picker in a new browser session
  const p2 = await ctx.newPage();
  await p2.goto(URL);
  await p2.waitForSelector('text=Who\'s playing?');
  check(true, 'new session asks who is playing');
  await p2.click('text=Play as Ana');
  await p2.waitForSelector('.unit');
  check(await p2.evaluate(() => GQ.store.profile().name === 'Ana'), 'picked profile is loaded');
  await p2.close();

  // rename and delete
  await p.goto(URL + '#/profiles');
  await p.waitForSelector('.profiles');
  const anaCard = p.locator('.profile', { hasText: 'Ana' });
  await anaCard.locator('text=Rename').click();
  await anaCard.locator('input').fill('Ana Maria');
  await anaCard.locator('text=Save').click();
  await p.waitForTimeout(200);
  check(await p.isVisible('.pname:text("Ana Maria")'), 'rename works');
  const card2 = p.locator('.profile', { hasText: 'Ana Maria' });
  await card2.locator('button:text("Delete")').click();
  await card2.locator('button:text("Delete Ana Maria and all progress?")').click();
  await p.waitForTimeout(200);
  check(await p.evaluate(() => GQ.store.profiles().length === 1), 'delete needs a second tap and removes the profile');
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
