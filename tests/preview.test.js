// "Listen" previews: sound comes out, the playhead moves, Stop works, songs page toggles.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  await p.goto(URL + '#/lesson/u8-12');
  await p.waitForSelector('.lesson-head');
  await p.evaluate(() => { const o = GQ.preview.output(); window.__an = o.ctx.createAnalyser(); o.out.connect(window.__an); });
  await p.click('text=♪ Listen');
  await p.waitForTimeout(4200);
  const r = await p.evaluate(() => {
    const a = window.__an, d = new Float32Array(a.fftSize); let peak = 0;
    a.getFloatTimeDomainData(d); for (const v of d) peak = Math.max(peak, Math.abs(v));
    return { pos: GQ.preview.pos(), peak, btn: document.querySelector('.toolbar .btn:nth-child(3)').textContent };
  });
  check(r.pos > 0.5, 'playhead moves during the preview (beat ' + (r.pos || 0).toFixed(2) + ')');
  check(r.peak > 0.01, 'preview produces sound (peak ' + r.peak.toFixed(3) + ')');
  check(/Stop listening/.test(r.btn), 'button switches to "Stop listening"');
  await p.screenshot({ path: __dirname + '/shots/13-preview.png' });
  await p.click('text=■ Stop listening');
  check(!(await p.evaluate(() => GQ.preview.active())), 'stop ends the preview');
  // chords with bends etc.
  for (const id of ['u5-21', 'u11-14', 'u7-20']) {
    await p.evaluate((i) => { location.hash = '#/lesson/' + i; }, id);
    await p.waitForTimeout(300);
    await p.click('text=♪ Listen');
    const a = await p.evaluate(() => GQ.preview.pos());
    await p.waitForTimeout(700);
    const z = await p.evaluate(() => GQ.preview.pos());
    check(z > a, 'preview runs for ' + id);
  }
  await p.evaluate(() => { location.hash = '#/songs'; });
  await p.waitForSelector('.songs');
  check(!(await p.evaluate(() => GQ.preview.active())), 'leaving the lesson stops the preview');
  const n = await p.$$eval('.song', (els) => els.length);
  check(n >= 60, 'song library lists ' + n + ' songs');
  await p.click('.song >> nth=0 >> text=♪ Listen');
  await p.waitForTimeout(800);
  check((await p.textContent('.song >> nth=0 >> .listen')).includes('Stop'), 'song card listen toggles');
  await p.screenshot({ path: __dirname + '/shots/14-songs.png' });
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
