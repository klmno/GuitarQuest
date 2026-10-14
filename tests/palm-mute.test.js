// Palm mutes in Listen: muted notes are heard, quieter and shorter than open ones; PM marks are read
// under or above a tab block.
const { chromium } = require('playwright');
const URL = process.argv[2] || 'http://localhost:8777/index.html';
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('dialog', (d) => d.accept());
  const check = (ok, what) => { console.log((ok ? 'PASS ' : 'FAIL ') + what); if (!ok) process.exitCode = 1; };
  await p.goto(URL + '#/learn');
  await p.waitForFunction(() => window.GQ && GQ.preview);
  const r = await p.evaluate(async () => {
    const one = (pm, row) => `Tempo: 60\n\ne|--------|\nB|--------|\nG|--------|\nD|--------|\n${row}\n` + (pm ? 'PM-------\n' : '');
    // what laptop speakers can play: above 250 Hz
    const hp = (d, sr) => { const w = 2 * Math.PI * 250 / sr, al = Math.sin(w) / 1.414, cw = Math.cos(w); const b0 = (1 + cw) / 2, b1 = -(1 + cw), a0 = 1 + al, a1 = -2 * cw, a2 = 1 - al; let y1 = 0, y2 = 0, x1 = 0, x2 = 0; return d.map((x) => { const y = (b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; }); };
    const out = [];
    for (const tone of ['clean', 'crunch', 'acoustic']) {
      GQ.store.setSetting('previewTone', tone);
      for (const [nm, row] of [['low E open', 'A|--------|\nE|-0------|'], ['A string fret 5', 'A|-5------|\nE|--------|']]) {
        const m = {};
        for (const pm of [false, true]) {
          const buf = await GQ.preview.render({ id: tone + nm + pm, tab: one(pm, row), bpm: 60 }, 1.5);
          const sr = buf.sampleRate, raw = buf.getChannelData(0), d = hp(raw, sr), o = Math.round(0.05 * sr);
          let s = 0; for (let i = o; i < o + 0.3 * sr; i++) s += d[i] * d[i];
          let pk = 0, rawPk = 0; for (let i = o; i < d.length; i++) { pk = Math.max(pk, Math.abs(d[i])); rawPk = Math.max(rawPk, Math.abs(raw[i])); }
          let last = o; for (let i = o; i < d.length; i++) if (Math.abs(d[i]) > pk * 0.0316) last = i;
          m[pm] = { rms: Math.sqrt(s / (0.3 * sr)), ring: (last - o) / sr, peak: rawPk };
        }
        out.push({ tone, nm, db: 20 * Math.log10(m[true].rms / m[false].rms), ring: m[true].ring, openRing: m[false].ring, peak: m[true].peak });
      }
    }
    return out;
  });
  for (const x of r) {
    check(x.db > -9 && x.db < -2, `${x.tone}, ${x.nm}: palm mute is quieter but clearly heard (${x.db.toFixed(1)} dB)`);
    check(x.ring > 0.15 && x.ring < 0.6 && x.ring < x.openRing / 2, `${x.tone}, ${x.nm}: palm mute is short (${x.ring.toFixed(2)} s, open ${x.openRing.toFixed(2)} s)`);
    check(x.peak < 1, `${x.tone}, ${x.nm}: no clipping (peak ${x.peak.toFixed(2)})`);
  }
  // PM marks under or above the block
  const marks = await p.evaluate(() => {
    const rows = 'e|----------------|\nB|----------------|\nG|----------------|\nD|----------------|\nA|-----------3-3-3|\nE|-0-0-0-0-0-------|';
    const f = (t) => GQ.tab.parse(t).events.map((e) => (e.tech.pm ? 'M' : 'n')).join('');
    return { under: f(rows + '\n  PM-------'), above: f('  PM-------\n' + rows), dots: f('P.M. - - - -\n' + rows), none: f(rows) };
  });
  check(marks.under === 'MMMMMnnn', 'PM under the block mutes the notes in its columns: ' + marks.under);
  check(marks.above === 'MMMMMnnn', 'PM right above the block works too: ' + marks.above);
  check(/^MMMM/.test(marks.dots), '"P.M. - - -" is read: ' + marks.dots);
  check(marks.none === 'nnnnnnnn', 'no PM line, no palm mute');
  check(!errs.length, 'no page errors ' + errs.join(' | '));
  await b.close();
})();
