/* GuitarQuest: renderers: fretboard (REQ-UI-1), falling-note highway (REQ-UI-2), tab (REQ-UI-3),
 * standard notation (REQ-UI-4) and chord boxes (REQ-UI-5). Left-handed mode mirrors the neck (REQ-UI-7). */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory, N = GQ.notation;
  const R = (GQ.render = {});

  const FINGER = () => ({
    0: GQ.css('--f0') || '#cfd6de', 1: GQ.css('--f1') || '#4aa3ff', 2: GQ.css('--f2') || '#3ecf8e',
    3: GQ.css('--f3') || '#f0c33a', 4: GQ.css('--f4') || '#f0609e',
  });
  const COL = () => ({
    bg: GQ.css('--canvas') || '#0e1013', line: GQ.css('--line') || '#2b3038', text: GQ.css('--text') || '#e8eaed',
    muted: GQ.css('--muted') || '#8b939e', good: GQ.css('--good') || '#3ecf8e', bad: GQ.css('--bad') || '#f05a4f',
    warn: GQ.css('--warn') || '#f0c33a', accent: GQ.css('--accent') || '#f0a53a', wood: GQ.css('--wood') || '#1d1712',
  });
  R.fingerColor = (f) => FINGER()[f] || FINGER()[0];
  const resState = (opts, e) => { const r = opts.results && opts.results.get(e.i); return r && (r.state || r); };
  const stateColor = (st, c) => (st === 'hit' ? c.good : st === 'miss' || st === 'wrong' ? c.bad : st === 'unclear' ? c.warn : null);

  function roundRect(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }

  // ================= Fretboard =================
  // opts: {lo, hi, markers:[{string,fret,finger,state,alpha,label}], heard:{string,fret,ok}, lefty, lock:{lo,hi}, names, barre}
  R.fretboard = function (cv, opts) {
    const { g, w, h } = GQ.fitCanvas(cv);
    const c = COL(), size = opts.size || 1;
    g.clearRect(0, 0, w, h);
    const lo = opts.lo || 0, hi = Math.max(lo + 4, opts.hi || 12);
    const padL = 34 * size, padR = 14, padT = 16 * size, padB = 20 * size;
    const nutX = padL + (lo === 0 ? 26 * size : 0);
    const W = w - nutX - padR, H = h - padT - padB;
    const span = (f) => 1 - Math.pow(2, -f / 12);
    const fx0 = (f) => nutX + W * (span(f) - span(lo)) / (span(hi) - span(lo));
    const X = (x) => (opts.lefty ? w - x : x);
    const fretX = (f) => X(fx0(f));
    const noteX = (f) => (f === 0 ? X(lo === 0 ? nutX - 14 * size : fx0(lo) - 10) : X((fx0(f - 1) + fx0(f)) / 2));
    const stringY = (s) => padT + ((s - 1) / 5) * H;

    // board
    g.fillStyle = c.wood;
    const bx0 = Math.min(fretX(lo), fretX(hi)), bx1 = Math.max(fretX(lo), fretX(hi));
    g.fillRect(bx0, padT - 8, bx1 - bx0, H + 16);
    if (opts.lock) { // position lock window
      g.fillStyle = 'rgba(240,165,58,.10)';
      const a = fretX(Math.max(lo, opts.lock.lo - 1)), b = fretX(Math.min(hi, opts.lock.hi));
      g.fillRect(Math.min(a, b), padT - 8, Math.abs(b - a), H + 16);
    }
    // inlays
    g.fillStyle = 'rgba(255,255,255,.10)';
    for (const f of [3, 5, 7, 9, 12, 15, 17, 19, 21, 24]) {
      if (f <= lo || f > hi) continue;
      const x = noteX(f);
      if (f % 12 === 0) { g.beginPath(); g.arc(x, padT + H * 0.3, 5 * size, 0, 7); g.arc(x, padT + H * 0.7, 5 * size, 0, 7); g.fill(); }
      else { g.beginPath(); g.arc(x, padT + H / 2, 5 * size, 0, 7); g.fill(); }
    }
    // frets
    for (let f = lo; f <= hi; f++) {
      const x = fretX(f);
      g.strokeStyle = f === 0 ? '#d8d2c4' : '#6d6a66'; g.lineWidth = f === 0 ? 6 : 2;
      g.beginPath(); g.moveTo(x, padT - 8); g.lineTo(x, padT + H + 8); g.stroke();
      if (f > 0) { g.fillStyle = c.muted; g.font = `${11 * size}px ui-monospace, Menlo, monospace`; g.textAlign = 'center'; g.fillText(f, noteX(f), h - 4); }
    }
    // strings
    const names = opts.names || T.stringNames();
    for (let s = 1; s <= 6; s++) {
      const y = stringY(s);
      g.strokeStyle = '#b9b3a7'; g.lineWidth = 0.8 + (s - 1) * 0.35;
      g.beginPath(); g.moveTo(Math.min(fretX(lo), fretX(hi)), y); g.lineTo(Math.max(fretX(lo), fretX(hi)), y); g.stroke();
      g.fillStyle = c.muted; g.font = `600 ${12 * size}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s === 1 ? names[s].toLowerCase() : names[s], opts.lefty ? w - 12 : 12, y);
    }
    // barre
    if (opts.barre) {
      const b = opts.barre, x = noteX(b.fret);
      g.strokeStyle = R.fingerColor(1); g.lineWidth = 14 * size; g.lineCap = 'round'; g.globalAlpha = 0.55;
      g.beginPath(); g.moveTo(x, stringY(b.to)); g.lineTo(x, stringY(b.from)); g.stroke();
      g.globalAlpha = 1; g.lineCap = 'butt';
    }
    // markers
    const r = 12 * size;
    for (const m of opts.markers || []) {
      if (m.fret < lo && m.fret !== 0) continue;
      if (m.fret > hi) continue;
      const x = noteX(m.fret), y = stringY(m.string);
      g.globalAlpha = m.alpha != null ? m.alpha : 1;
      const col = stateColor(m.state, c) || R.fingerColor(m.finger);
      if (m.dead) {
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(x - r * 0.6, y - r * 0.6); g.lineTo(x + r * 0.6, y + r * 0.6);
        g.moveTo(x + r * 0.6, y - r * 0.6); g.lineTo(x - r * 0.6, y + r * 0.6); g.stroke();
      } else if (m.fret === 0) {
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r * 0.8, 0, 7); g.stroke();
      } else {
        g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
        if (m.next) { g.strokeStyle = c.text; g.lineWidth = 2.5; g.beginPath(); g.arc(x, y, r + 4, 0, 7); g.stroke(); }
        g.fillStyle = '#111'; g.font = `700 ${13 * size}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(m.label != null ? m.label : m.finger || '', x, y + 1);
      }
      g.globalAlpha = 1;
    }
    // heard note (REQ-UI-6)
    if (opts.heard && opts.heard.fret >= (lo === 0 ? 0 : lo) && opts.heard.fret <= hi) {
      const x = noteX(opts.heard.fret), y = stringY(opts.heard.string);
      g.strokeStyle = opts.heard.ok ? c.good : c.warn; g.lineWidth = 3; g.setLineDash([4, 3]);
      g.beginPath(); g.arc(x, y, r + 7, 0, 7); g.stroke(); g.setLineDash([]);
    }
  };
  // Which string and fret is at (x, y) on a fretboard drawn with the same opts (for clicking)
  R.fretboardHit = function (cv, opts, x, y) {
    const w = cv.clientWidth, h = cv.clientHeight, size = opts.size || 1;
    const lo = opts.lo || 0, hi = Math.max(lo + 4, opts.hi || 12);
    const padL = 34 * size, padR = 14, padT = 16 * size, padB = 20 * size;
    const nutX = padL + (lo === 0 ? 26 * size : 0);
    const W = w - nutX - padR, H = h - padT - padB;
    const span = (f) => 1 - Math.pow(2, -f / 12);
    const fx0 = (f) => nutX + W * (span(f) - span(lo)) / (span(hi) - span(lo));
    const xx = opts.lefty ? w - x : x;
    const string = GQ.clamp(Math.round((y - padT) / (H / 5)) + 1, 1, 6);
    if (lo === 0 && xx < nutX + 4) return { string, fret: 0 };
    for (let f = Math.max(1, lo + 1); f <= hi; f++) if (xx <= fx0(f)) return { string, fret: f };
    return null;
  };

  // choose a fret window that shows everything in `events`
  R.fretWindow = function (events, lockLo, lockHi) {
    let mn = 99, mx = 0;
    for (const e of events) for (const n of e.notes) { if (n.fret > 0) mn = Math.min(mn, n.fret); mx = Math.max(mx, n.fret + (e.tech && e.tech.bend ? 0 : 0)); }
    if (lockLo != null) { mn = Math.min(mn, lockLo); mx = Math.max(mx, lockHi); }
    if (mn === 99) return { lo: 0, hi: 5 };
    if (mx <= 5) return { lo: 0, hi: Math.max(5, mx + 1) };
    const lo = Math.max(0, mn - 2), hi = Math.min(24, Math.max(mx + 1, lo + 7));
    return { lo: lo <= 2 ? 0 : lo, hi };
  };

  // ================= Highway =================
  // opts: {events, pos (beats), ahead (beats), results: Map(i->state), lefty, size, bpm}
  R.highway = function (cv, opts) {
    const { g, w, h } = GQ.fitCanvas(cv);
    const c = COL(), size = opts.size || 1;
    g.clearRect(0, 0, w, h);
    const ahead = opts.ahead || 4, hitY = h - 36 * size, pad = 10;
    const laneW = (w - pad * 2) / 6;
    const laneX = (s) => { const i = 6 - s; return pad + laneW * (opts.lefty ? 5 - i : i) + laneW / 2; }; // low E on the left
    const Y = (beat) => hitY - ((beat - opts.pos) / ahead) * (hitY - 10);
    const names = opts.names || T.stringNames();
    for (let s = 1; s <= 6; s++) {
      const x = laneX(s);
      g.strokeStyle = c.line; g.lineWidth = 1; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h - 20); g.stroke();
      g.fillStyle = c.muted; g.font = `600 ${12 * size}px system-ui`; g.textAlign = 'center'; g.fillText(s === 1 ? 'e' : names[s], x, h - 6);
    }
    // beat lines
    for (let b = Math.ceil(opts.pos); b < opts.pos + ahead; b++) {
      const y = Y(b); g.strokeStyle = b % (opts.beatsPerBar || 4) === 0 ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.05)';
      g.beginPath(); g.moveTo(pad, y); g.lineTo(w - pad, y); g.stroke();
    }
    g.fillStyle = c.accent; g.fillRect(pad, hitY - 1.5, w - pad * 2, 3);
    const r = Math.min(laneW * 0.36, 16 * size);
    for (const e of opts.events) {
      if (e.kind === 'rest') continue;
      if (e.beat > opts.pos + ahead || e.beat + e.dur < opts.pos - 1.2) continue;
      const y = Y(e.beat), st = resState(opts, e);
      const past = e.beat < opts.pos - 0.05;
      g.globalAlpha = e.ghost ? 0.14 : past ? 0.45 : 1;
      if (e.kind === 'chord' && e.chordName) {
        const xs = e.notes.map((n) => laneX(n.string));
        g.fillStyle = stateColor(st, c) || 'rgba(240,165,58,.22)';
        roundRect(g, Math.min(...xs) - r, y - r * 0.55, Math.max(...xs) - Math.min(...xs) + r * 2, r * 1.1, 6); g.fill();
        g.fillStyle = c.text; g.font = `700 ${14 * size}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(e.chordName + (e.strum === 'u' ? ' ↑' : e.strum === 'd' ? ' ↓' : ''), (Math.min(...xs) + Math.max(...xs)) / 2, y);
      } else if (e.kind === 'mute') {
        g.strokeStyle = stateColor(st, c) || c.muted; g.lineWidth = 3;
        g.beginPath(); g.moveTo(pad + 10, y); g.lineTo(w - pad - 10, y); g.stroke();
      } else {
        for (const n of e.notes) {
          const x = laneX(n.string);
          // sustain tail
          if (e.dur >= 1) { g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x - 3, Y(e.beat + e.dur), 6, y - Y(e.beat + e.dur)); }
          g.fillStyle = stateColor(st, c) || R.fingerColor(n.finger);
          roundRect(g, x - r, y - r * 0.7, r * 2, r * 1.4, 6); g.fill();
          g.fillStyle = '#111'; g.font = `700 ${14 * size}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(n.dead ? 'x' : n.fret, x, y + 1);
          const t = e.tech || {};
          const lab = t.into === 'h' ? 'h' : t.into === 'p' ? 'p' : t.into === 'su' ? '/' : t.into === 'sd' ? '\\' : t.bend ? 'b' + (t.bend === 1 ? '½' : '') : t.vib ? '~' : t.pm ? 'PM' : '';
          if (lab) { g.fillStyle = c.text; g.font = `600 ${11 * size}px system-ui`; g.fillText(lab, x + r + 8, y); }
        }
      }
      g.globalAlpha = 1;
    }
  };

  // ================= Tab =================
  R.tab = function (cv, opts) {
    const { g, w, h } = GQ.fitCanvas(cv);
    const c = COL(), size = opts.size || 1;
    g.clearRect(0, 0, w, h);
    const top = 24 * size, gap = Math.min(18 * size, (h - top - 34 * size) / 5);
    const ppb = opts.pxPerBeat || 70 * size, headX = w * 0.22;
    const X = (b) => headX + (b - opts.pos) * ppb;
    const Ys = (s) => top + (s - 1) * gap;
    g.strokeStyle = c.line; g.lineWidth = 1;
    for (let s = 1; s <= 6; s++) { g.beginPath(); g.moveTo(0, Ys(s)); g.lineTo(w, Ys(s)); g.stroke(); }
    g.fillStyle = c.muted; g.font = `700 ${11 * size}px ui-monospace, monospace`; g.textAlign = 'left';
    ['T', 'A', 'B'].forEach((ch, i) => g.fillText(ch, 4, Ys(2) + i * gap * 1.4));
    // bars
    const bpb = opts.beatsPerBar || 4;
    for (let b = Math.floor((opts.pos - headX / ppb) / bpb) * bpb; X(b) < w; b += bpb) {
      if (b < 0 || b > opts.totalBeats) continue;
      g.strokeStyle = c.muted; g.beginPath(); g.moveTo(X(b), Ys(1)); g.lineTo(X(b), Ys(6)); g.stroke();
    }
    if (opts.loop) { g.fillStyle = 'rgba(74,163,255,.10)'; g.fillRect(X(opts.loop.a), 0, X(opts.loop.b) - X(opts.loop.a), h); }
    g.fillStyle = c.accent; g.fillRect(headX - 1, top - 14, 2, gap * 5 + 28);
    for (const e of opts.events) {
      const x = X(e.beat);
      if (x < -40 || x > w + 40) continue;
      const st = resState(opts, e), col = e.ghost ? 'rgba(139,147,158,.35)' : stateColor(st, c) || c.text;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      if (e.kind === 'rest') { g.fillStyle = c.muted; g.font = `${12 * size}px system-ui`; g.fillText('𝄽', x, Ys(3.5)); continue; }
      if (e.kind === 'mute') { g.fillStyle = col; g.font = `700 ${13 * size}px ui-monospace`; for (let s = 1; s <= 6; s++) g.fillText('x', x, Ys(s)); }
      for (const n of e.notes) {
        const lab = N.tabLabel(e, n);
        g.font = `700 ${14 * size}px ui-monospace, Menlo, monospace`;
        const tw = g.measureText(lab).width + 6;
        g.fillStyle = c.bg; g.fillRect(x - tw / 2, Ys(n.string) - 8 * size, tw, 16 * size);
        g.fillStyle = col; g.fillText(lab, x, Ys(n.string));
      }
      const t = e.tech || {};
      g.fillStyle = c.muted; g.font = `600 ${11 * size}px system-ui`;
      if (t.into) { const sy = e.notes[0].string; const sym = { h: 'h', p: 'p', su: '/', sd: '\\' }[t.into]; g.fillText(sym, x + ppb * e.dur / 2, Ys(sy) - 10 * size); }
      if (t.pm) g.fillText('PM', x, top - 12);
      if (e.chordName && !e.repeat) { g.fillStyle = c.accent; g.font = `700 ${12 * size}px system-ui`; g.fillText(e.chordName, x, top - 12); }
      if (e.strum && e.kind !== 'note') { g.fillStyle = c.muted; g.fillText(e.strum === 'u' ? '↑' : e.strum === 'd' ? '↓' : '', x, Ys(6) + 30 * size); }
      // rhythm stems
      const sy = Ys(6) + 10 * size, len = 14 * size;
      g.strokeStyle = c.muted; g.lineWidth = 1.2;
      if (e.dur < 4) { g.beginPath(); g.moveTo(x, sy); g.lineTo(x, sy + (e.dur >= 2 ? len * 0.6 : len)); g.stroke(); }
      if (e.dur <= 0.75) { g.beginPath(); g.moveTo(x, sy + len); g.lineTo(x + 7, sy + len - 5); g.stroke(); }
      if (e.dur <= 0.375) { g.beginPath(); g.moveTo(x, sy + len - 4); g.lineTo(x + 7, sy + len - 9); g.stroke(); }
      if (e.dur % 1.5 === 0 || e.dur === 0.75 || e.dur === 0.375) { g.fillStyle = c.muted; g.beginPath(); g.arc(x + 5, sy + 2, 1.6, 0, 7); g.fill(); }
    }
  };

  // ================= Standard notation (treble clef, sounds an octave lower) =================
  const LETTER = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6]; // diatonic index for each pc (sharps)
  const ACC = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  R.staff = function (cv, opts) {
    const { g, w, h } = GQ.fitCanvas(cv);
    const c = COL(), size = opts.size || 1;
    g.clearRect(0, 0, w, h);
    const lineGap = Math.min(11 * size, h / 11), bottom = h / 2 + lineGap * 1.2;
    const ppb = opts.pxPerBeat || 70 * size, headX = w * 0.22;
    const X = (b) => headX + (b - opts.pos) * ppb;
    // staff position: 0 = E4 (bottom line), each step = half a line gap
    const stepOf = (written) => { const oct = Math.floor(written / 12) - 1, pc = written % 12; return (oct - 4) * 7 + LETTER[pc] - 2; };
    const Y = (step) => bottom - step * lineGap / 2;
    g.strokeStyle = c.muted; g.lineWidth = 1;
    for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, Y(i * 2)); g.lineTo(w, Y(i * 2)); g.stroke(); }
    g.fillStyle = c.text; g.font = `${lineGap * 6.4}px serif`; g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillText('𝄞', 4, Y(-1.6)); g.font = `${lineGap}px system-ui`; g.fillText('8', 4 + lineGap * 1.5, Y(-5));
    g.fillStyle = c.accent; g.fillRect(headX - 1, Y(10), 2, Y(-2) - Y(10));
    const bpb = opts.beatsPerBar || 4;
    for (let b = 0; b <= opts.totalBeats; b += bpb) { const x = X(b); if (x < 30 || x > w) continue; g.strokeStyle = c.muted; g.beginPath(); g.moveTo(x, Y(8)); g.lineTo(x, Y(0)); g.stroke(); }
    for (const e of opts.events) {
      const x = X(e.beat);
      if (x < 30 || x > w + 20) continue;
      const st = resState(opts, e), col = e.ghost ? 'rgba(139,147,158,.3)' : stateColor(st, c) || c.text;
      if (e.kind === 'rest') { g.fillStyle = c.muted; g.font = `${14 * size}px serif`; g.textAlign = 'center'; g.fillText(e.dur >= 2 ? '▬' : '𝄽', x, Y(4)); continue; }
      const midis = N.midis(e, opts.setup).map((m) => m + 12); // guitar is written an octave above sounding pitch
      let minStep = 99, maxStep = -99;
      for (const m of midis) {
        const step = stepOf(m); minStep = Math.min(minStep, step); maxStep = Math.max(maxStep, step);
        const y = Y(step);
        g.strokeStyle = c.muted; // ledger lines
        for (let l = -2; l >= step; l -= 2) { g.beginPath(); g.moveTo(x - 9, Y(l)); g.lineTo(x + 9, Y(l)); g.stroke(); }
        for (let l = 10; l <= step; l += 2) { g.beginPath(); g.moveTo(x - 9, Y(l)); g.lineTo(x + 9, Y(l)); g.stroke(); }
        g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 1.6;
        g.beginPath(); g.ellipse(x, y, lineGap * 0.62, lineGap * 0.45, -0.3, 0, 7);
        if (e.dur >= 2) g.stroke(); else g.fill();
        if (ACC[m % 12]) { g.font = `${lineGap * 1.8}px serif`; g.textAlign = 'center'; g.fillText('♯', x - lineGap * 1.5, y + lineGap * 0.6); }
      }
      if (e.dur < 4 && midis.length) {
        const up = (minStep + maxStep) / 2 < 4;
        const sx = up ? x + lineGap * 0.58 : x - lineGap * 0.58;
        const y0 = Y(up ? minStep : maxStep), y1 = up ? Y(maxStep) - lineGap * 3.2 : Y(minStep) + lineGap * 3.2;
        g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath(); g.moveTo(sx, y0); g.lineTo(sx, y1); g.stroke();
        const flags = e.dur <= 0.375 ? 2 : e.dur <= 0.75 ? 1 : 0;
        for (let k = 0; k < flags; k++) { const fy = y1 + (up ? 1 : -1) * k * 6; g.beginPath(); g.moveTo(sx, fy); g.lineTo(sx + 8, fy + (up ? 9 : -9)); g.stroke(); }
        if (e.dur === 1.5 || e.dur === 3 || e.dur === 0.75) { g.beginPath(); g.arc(x + lineGap * 1.2, Y(maxStep), 1.8, 0, 7); g.fill(); }
      }
    }
  };

  // ================= Chord box (SVG) =================
  R.chordBox = function (chord, opts) {
    opts = opts || {};
    if (!chord) return '';
    const lefty = !!opts.lefty, W = 150, H = 190, x0 = 30, y0 = 40, sw = 18, fh = 26, frets = 5;
    const base = chord.maxFret > 4 ? chord.minFret : 1;
    const sx = (s) => { const i = 6 - s; return x0 + sw * (lefty ? 5 - i : i); };
    const fy = (f) => y0 + (f - base + 0.5) * fh;
    let o = `<svg viewBox="0 0 ${W} ${H}" class="chordbox" role="img" aria-label="${GQ.esc(chord.name)} chord diagram">`;
    o += `<text x="${x0 + sw * 2.5}" y="18" class="cb-name" text-anchor="middle">${GQ.esc(opts.label || chord.name)}</text>`;
    if (base === 1) o += `<rect x="${x0 - 1}" y="${y0 - 5}" width="${sw * 5 + 2}" height="5" class="cb-nut"/>`;
    else o += `<text x="${lefty ? x0 + sw * 5 + 8 : x0 - 8}" y="${fy(base) + 4}" class="cb-base" text-anchor="${lefty ? 'start' : 'end'}">${base}fr</text>`;
    for (let f = 0; f <= frets; f++) o += `<line x1="${x0}" x2="${x0 + sw * 5}" y1="${y0 + f * fh}" y2="${y0 + f * fh}" class="cb-line"/>`;
    for (let s = 1; s <= 6; s++) o += `<line x1="${sx(s)}" x2="${sx(s)}" y1="${y0}" y2="${y0 + frets * fh}" class="cb-line"/>`;
    for (let i = 0; i < 6; i++) {
      const s = 6 - i, f = chord.frets[i];
      if (f < 0) o += `<text x="${sx(s)}" y="${y0 - 10}" class="cb-mark" text-anchor="middle">×</text>`;
      else if (f === 0) o += `<circle cx="${sx(s)}" cy="${y0 - 14}" r="5" class="cb-open"/>`;
    }
    if (chord.barre) {
      const a = sx(chord.barre.from), b = sx(chord.barre.to);
      o += `<rect x="${Math.min(a, b) - 8}" y="${fy(chord.barre.fret) - 8}" width="${Math.abs(b - a) + 16}" height="16" rx="8" class="cb-barre"/>`;
    }
    for (let i = 0; i < 6; i++) {
      const s = 6 - i, f = chord.frets[i], fi = chord.fingers[i];
      if (f <= 0) continue;
      if (chord.barre && f === chord.barre.fret && fi === 1 && s !== chord.barre.from) continue;
      o += `<circle cx="${sx(s)}" cy="${fy(f)}" r="8" fill="${R.fingerColor(fi)}"/>`;
      o += `<text x="${sx(s)}" y="${fy(f) + 4}" class="cb-finger" text-anchor="middle">${fi || ''}</text>`;
    }
    return o + '</svg>';
  };
})(typeof window !== 'undefined' ? window : globalThis);
