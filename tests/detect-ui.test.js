// Settings > Guitar input > Note detection: the options, saved per input, and sent to the detector.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  await p.goto(URL + '#/settings/input');
  await p.click('text=Allow audio input'); await p.waitForTimeout(700);
  await p.click('text=Use this input');
  await p.waitForFunction(() => GQ.audio.ctx && GQ.audio.ctx.state === 'running');
  await p.waitForSelector('text=Note detection');
  const sent = [];
  await p.exposeFunction('__sent', (m) => sent.push(m));
  await p.evaluate(() => { const port = GQ.audio.node.port, post = port.postMessage.bind(port); port.postMessage = (m) => { window.__sent(m); post(m); }; });
  const field = (label) => p.locator('#input label.field', { hasText: label }).locator('select');
  check(await p.evaluate(() => JSON.stringify(GQ.audio.detect()) === JSON.stringify(GQ.audio.DETECT_DEFAULTS)), 'starts with the recommended settings');
  check((await field('Spot new notes by').inputValue()) === 'flux' && /recommended/.test(await field('Spot new notes by').locator('option:checked').textContent()), 'spectral change is chosen and marked recommended');
  await field('Hum filter').selectOption('50');
  await p.waitForTimeout(100);
  check(await p.evaluate(() => GQ.audio.detect().hum === 50 && GQ.store.device(GQ.audio.key()).detect.hum === 50), 'choosing 50 Hz is saved for this input');
  check(sent.some((m) => m.type === 'setOptions' && m.opts.hum === 50), 'and sent to the detector');
  await field('Notes still ringing').selectOption('strong');
  await p.locator('#input label.inline', { hasText: 'Low-pass at 1.5 kHz' }).locator('input').check();
  await p.waitForTimeout(100);
  check(await p.evaluate(() => GQ.audio.detect().ring === 'strong' && GQ.audio.detect().pitchLp === true), 'ringing notes and the low-pass are saved');
  check(sent.some((m) => m.type === 'setOptions' && m.opts.ring === 'strong' && m.opts.pitchLp === true), 'and sent');
  await p.screenshot({ path: __dirname + '/shots/27-note-detection.png', fullPage: true });
  await p.click('#input button:has-text("Recommended settings")');
  await p.waitForTimeout(100);
  const after = await p.evaluate(() => [JSON.stringify(GQ.audio.detect()), JSON.stringify(GQ.audio.DETECT_DEFAULTS)]);
  check(after[0] === after[1], 'Recommended settings puts the defaults back ' + after.join(' vs '));
  check(sent.some((m) => m.type === 'setOptions' && m.opts.onset === 'flux' && m.opts.ring === 'normal'), 'and sends them');
  // the noise floor measurement reports hum and sets the gate
  await p.click('#input >> text=Measure noise floor');
  await p.waitForSelector('.toast >> text=Noise gate set to', { timeout: 6000 });
  check(await p.evaluate(() => GQ.audio.lastFloor && 'with50' in GQ.audio.lastFloor && 'humHz' in GQ.audio.lastFloor), 'the noise floor measurement also checks for hum');
  // the gate marker stays on the level meter at both ends of the slider
  const g = p.locator('#input label.inline', { hasText: 'Gate' }).locator('input[type=range]');
  for (const v of ['-80', '-20']) {
    await g.fill(v); await g.dispatchEvent('input');
    const r = await p.evaluate(() => { const m = document.querySelector('.levelmeter .gate').getBoundingClientRect(), lm = document.querySelector('.levelmeter').getBoundingClientRect(); return [m.left, m.right, lm.left, lm.right]; });
    check(r[0] >= r[2] - 1 && r[1] <= r[3] + 1, `gate at ${v} dB: the marker stays inside the level meter`);
  }
  check(errs.length === 0, 'no page errors ' + JSON.stringify(errs));
  await b.close();
})();
