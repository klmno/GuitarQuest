/* GuitarQuest: guitar tab reader for custom songs written as plain-text (ASCII) tab.
 * Turns the tab into the same events the lessons use, with the exact strings and frets of the tab.
 *
 *   Title: Name        optional header lines, anywhere before the tab: Title, By (or Artist),
 *   Tempo: 90          Tempo (or BPM, quarter notes a minute) and Time (or Meter, such as 3/4)
 *   Time: 4/4
 *
 *   e|-----------------|       six lines per block, high e on top (low E on top is recognised
 *   B|-----------------|       when the labels say E ... e). Bar lines | split the bars.
 *   G|-----------------|
 *   D|-------5---------|  x3   "x3" after a block plays the block three times
 *   A|----7-------7----|
 *   E|-0-------6-5-----|
 *      pm-------|              pm under the block: palm mute for the notes above the dashes
 *
 *   5h7 7p5  hammer-on, pull-off      5/7 7\5  slide up, down (attached to the note before it)
 *   7b9 7b   bend up to the pitch of fret 9 (a whole step if no target)    7~  vibrato   x  dead note
 *
 * Tab has no note lengths, so the rhythm is read from the spacing: each bar is the meter long, and
 * every note lands on the nearest eighth (or sixteenth, when notes are close together) by its column.
 * Other lines (chord names, counts, comments) are ignored. */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory;
  const TAB = (GQ.tab = {});

  const LABEL = /^\s*([A-Ga-g][#b]?)?\s*(\|\||\||:)/;
  const HEADER = /^\s*(title|by|artist|composer|tempo|bpm|time|meter)\s*:\s*(.*)$/i;
  // a line of one string: an optional label, then mostly dashes, frets and tab marks
  function stringLine(l) {
    const m = LABEL.exec(l);
    const start = m ? m[0].length : l.search(/\S/);
    if (start < 0) return null;
    let body = l.slice(start);
    const last = body.lastIndexOf('|');
    let trail = '';
    if (last >= 0) { trail = body.slice(last + 1); body = body.slice(0, last + 1); }
    else { const t = /\s{2,}(\S.*)$/.exec(body); if (t) { trail = t[1]; body = body.slice(0, t.index); } }
    if ((body.match(/-/g) || []).length < 3) return null;
    if (!/^[-0-9|xXhpbr/\\~().<>^v=*sSt:\s]*$/.test(body)) return null;
    if ((body.match(/-/g) || []).length < body.replace(/\s/g, '').length * 0.4) return null;
    return { label: m && m[1] ? m[1] : '', body, trail: trail.trim() };
  }

  // does this text look like tab rather than ABC?
  TAB.looks = function (text) {
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    let run = 0;
    for (const l of lines) { if (stringLine(l)) { if (++run >= 4) return true; } else run = 0; }
    return false;
  };

  TAB.TEMPLATE = 'Title: My new tab\nTempo: 90\nTime: 4/4\n\n' +
    ['e', 'B', 'G', 'D', 'A', 'E'].map((s) => s + '|----------------|----------------|').join('\n') + '\n';

  // example for the help page (checked by tests/tab.test.js)
  TAB.EXAMPLE = `Title: A first riff
Tempo: 90
Time: 4/4

e|-----------------|-----------------|-----------------|-----------------|
B|-----------------|-----------------|-----------------|-----------------|
G|-----------------|-----------------|-----------------|-------------7~--|
D|---------5h7-----|---------5-7-----|---------5h7-----|-----5-7b9-------|
A|-----5-------7---|-----5-------5---|-----5-------7---|-----------------|
E|-0-0-------------|-0-0-------------|-0-0-------------|-0---------------|
   pm-              pm-               pm-               pm`;

  TAB.parse = function (source, opts) {
    opts = opts || {};
    const setup = opts.setup || T.setup;
    const problems = [], warnings = [];
    const err = (line, msg) => problems.push({ line, msg });
    const warn = (line, msg) => { if (!warnings.some((w) => w.msg === msg)) warnings.push({ line, msg }); };
    const lines = String(source || '').replace(/\r\n?/g, '\n').split('\n');
    const meta = { title: '', composer: '', origin: '', rhythm: '', notes: '', bpm: null, meterText: '4/4', keyName: 'Tab', unit: null,
      position: 0, octave: 0, play: 'melody', chords: [], format: 'tab' };
    let meter = [4, 4], firstText = '';

    // ----- header lines and blocks of six string lines -----
    const blocks = [];
    for (let i = 0; i < lines.length; i++) {
      const hm = HEADER.exec(lines[i]);
      if (hm && !stringLine(lines[i])) {
        const k = hm[1].toLowerCase(), v = hm[2].trim();
        if (k === 'title') meta.title = v;
        else if (k === 'by' || k === 'artist' || k === 'composer') meta.composer = v;
        else if (k === 'tempo' || k === 'bpm') { const n = parseFloat(v); if (n >= 20 && n <= 400) meta.bpm = Math.round(n); else err(i + 1, 'Tempo must be a number of beats a minute, such as 90'); }
        else { const mm = /^(\d+)\s*\/\s*(\d+)$/.exec(v); if (mm && +mm[1] > 0 && [1, 2, 4, 8, 16].includes(+mm[2])) { meter = [+mm[1], +mm[2]]; meta.meterText = mm[1] + '/' + mm[2]; } else err(i + 1, 'Time must be a meter such as 4/4, 3/4 or 6/8'); }
        continue;
      }
      if (!stringLine(lines[i])) { if (!firstText && lines[i].trim() && !blocks.length) firstText = lines[i].trim(); continue; }
      const start = i, rows = [];
      while (i < lines.length && stringLine(lines[i])) rows.push({ ...stringLine(lines[i]), raw: lines[i] }), i++;
      // lines under the block, up to a blank line or the next block: palm mute marks
      const notes = [];
      while (i < lines.length && lines[i].trim() && !stringLine(lines[i]) && !HEADER.test(lines[i])) notes.push(lines[i]), i++;
      i--;
      if (rows.length !== 6) { err(start + 1, `A tab block needs six string lines, one per string; this one has ${rows.length}.`); continue; }
      blocks.push({ line: start + 1, rows, notes });
    }
    if (!meta.title && firstText && firstText.length <= 80) meta.title = firstText;
    const barBeats = meter[0] * 4 / meter[1];

    // ----- events -----
    const events = [], barMarks = [];
    let beat = 0, barIndex = 0, hand = 1;
    const fingerOf = (fret) => {
      if (fret <= 0) return 0;
      if (fret < hand) hand = fret; else if (fret > hand + 3) hand = fret - 3;
      return fret - hand + 1;
    };
    const names = T.stringNames(setup);
    let labelsChecked = false;

    for (const b of blocks) {
      const labels = b.rows.map((r) => r.label);
      const lowOnTop = labels[0] === 'E' && labels[5] === 'e';
      const strOf = (k) => (lowOnTop ? 6 - k : k + 1);
      if (!labelsChecked && labels.every(Boolean)) {
        labelsChecked = true;
        const want = [1, 2, 3, 4, 5, 6].map((s) => names[s].toLowerCase());
        const got = b.rows.map((r, k) => ({ s: strOf(k), l: r.label.toLowerCase() })).sort((x, y) => x.s - y.s).map((x) => x.l);
        if (got.join() !== want.join()) warn(b.line, `The tab's strings are labelled ${got.slice().reverse().map((x) => x.toUpperCase()).join(' ')}, but the app is set to ${[6, 5, 4, 3, 2, 1].map((s) => names[s]).join(' ')}. Change the tuning in Settings > Instrument if the tab is for another tuning.`);
      }
      // repeat count, written after the block ("x3", "3x")
      let times = 1;
      for (const r of b.rows) { const m = /(?:^|\s)[xX]\s*(\d+)\b|\b(\d+)\s*[xX](?:\s|$)/.exec(r.trail); if (m) times = Math.max(1, Math.min(16, +(m[1] || m[2]))); }

      // notes on each string, by column
      const hits = []; // {col, string, fret, dead, from, bend, vib, two}
      b.rows.forEach((r, k) => {
        const s = strOf(k), body = r.body;
        let last = null, pending = null;
        for (let c = 0; c < body.length; c++) {
          const ch = body[c];
          if (ch >= '0' && ch <= '9') {
            let n = +ch, len = 1;
            if (body[c + 1] >= '0' && body[c + 1] <= '9' && +(ch + body[c + 1]) <= 24) { n = +(ch + body[c + 1]); len = 2; }
            const hit = { col: c, string: s, fret: n, two: len === 2, line: b.line + k };
            if (pending && last) { hit.from = pending === 's' ? (n >= last.fret ? 'su' : 'sd') : pending; hit.prev = last; }
            pending = null;
            hits.push(hit); last = hit; c += len - 1;
            continue;
          }
          const attached = last && c === last.col + (last.two ? 2 : 1) + (last.bendLen || 0);
          if ((ch === 'h' || ch === 'p') && attached) { pending = ch; continue; }
          if ((ch === '/' || ch === '\\') && attached) { pending = 's'; continue; }
          if (ch === 'b' && attached) {
            const m = /^\d{1,2}/.exec(body.slice(c + 1));
            last.bend = m ? Math.max(1, Math.min(4, +m[0] - last.fret)) : 2;
            last.bendLen = 1 + (m ? m[0].length : 0);
            c += m ? m[0].length : 0; continue;
          }
          if (ch === 'r' && last) { const m = /^\d{1,2}/.exec(body.slice(c + 1)); c += m ? m[0].length : 0; continue; } // release: ignored
          if (ch === '~' && last) { last.vib = true; continue; }
          if (ch === 'x' || ch === 'X') { hits.push({ col: c, string: s, fret: 0, dead: true, line: b.line + k }); last = null; continue; }
          if (ch !== '(' && ch !== ')') pending = null;
        }
      });
      // palm mute spans from the lines under the block, in the same columns as the bottom string line
      const off = b.rows[5].raw.length - b.rows[5].raw.slice(LABEL.exec(b.rows[5].raw) ? LABEL.exec(b.rows[5].raw)[0].length : b.rows[5].raw.search(/\S/)).length;
      const pmSpans = [];
      for (const l of b.notes) {
        for (const m of l.matchAll(/p\.?m\.?/gi)) {
          let j = m.index + m[0].length;
          while (j < l.length && (l[j] === '-' || l[j] === '.' || l[j] === ' ' && l[j + 1] === '-')) j++;
          pmSpans.push([m.index - off - 1, j - off]);
        }
      }
      // bars: columns with a | on most strings
      const width = Math.max(...b.rows.map((r) => r.body.length));
      const bars = [];
      for (let c = 0; c < width; c++) if (b.rows.filter((r) => r.body[c] === '|').length >= 4) bars.push(c);
      const edges = [-1, ...bars];
      if (width - 1 > edges[edges.length - 1] + 1 && hits.some((x) => x.col > edges[edges.length - 1])) edges.push(width);
      const segs = [];
      for (let k = 1; k < edges.length; k++) if (edges[k] - edges[k - 1] > 1) segs.push([edges[k - 1], edges[k]]);
      if (!segs.length) continue;

      // group the notes of one column (two-digit frets may start one column earlier)
      const groups = [];
      for (const x of [...hits].sort((p, q) => p.col - q.col)) {
        const g = groups[groups.length - 1];
        if (g && !g.notes.some((n) => n.string === x.string) && (g.col === x.col || (Math.abs(g.col - x.col) <= 1 && (x.two || g.notes.some((n) => n.two))))) g.notes.push(x);
        else groups.push({ col: x.col, notes: [x] });
      }

      const blockEvents = [];
      for (const [b0, b1] of segs) {
        const inBar = groups.filter((g) => g.col > b0 && g.col < b1);
        const n = b1 - b0 - 1;
        const lead = b.rows.every((r) => r.body[b0 + 1] === '-' || r.body[b0 + 1] === undefined) ? 1 : 0;
        const ideal = inBar.map((g) => Math.max(0, (g.col - b0 - 1 - lead) / Math.max(1, n - lead) * barBeats));
        let slots = null;
        for (const grid of [0.5, 0.25]) {
          const s = ideal.map((x) => Math.round(x / grid) * grid);
          for (let k = 1; k < s.length; k++) if (s[k] <= s[k - 1]) s[k] = s[k - 1] + grid;
          if (!s.length || s[s.length - 1] < barBeats - 1e-6) { slots = s; if (s.every((v, k) => Math.abs(v - ideal[k]) <= grid * 0.75)) break; }
        }
        if (!slots) slots = inBar.map((_, k) => k * barBeats / inBar.length); // crowded bar: share it out evenly
        const evs = [];
        if (!inBar.length || slots[0] > 1e-6) evs.push({ kind: 'rest', notes: [], dur: inBar.length ? slots[0] : barBeats, line: b.line });
        inBar.forEach((g, k) => {
          const dur = (k + 1 < inBar.length ? slots[k + 1] : barBeats) - slots[k];
          const notes = g.notes.sort((p, q) => q.string - p.string).map((x) => (x.dead ? { string: x.string, fret: 0, dead: true, finger: 0 } : { string: x.string, fret: x.fret, finger: fingerOf(x.fret) }));
          const live = g.notes.filter((x) => !x.dead);
          const tech = {};
          if (live.some((x) => x.bend)) tech.bend = live.find((x) => x.bend).bend;
          if (live.some((x) => x.vib)) tech.vib = true;
          if (pmSpans.some(([a, z]) => g.col >= a && g.col <= z)) tech.pm = true;
          const from = live.length === 1 && live[0].from ? live[0] : null;
          for (const x of live) if (x.fret > T.FRETS) err(x.line, `Fret ${x.fret} is past the end of the neck.`);
          evs.push({ kind: !live.length ? 'mute' : notes.length > 1 ? 'chord' : 'note', notes, dur, tech, line: from ? from.line : g.notes[0].line, from });
        });
        evs.barEnd = true;
        blockEvents.push(evs);
      }
      for (let t = 0; t < times; t++) {
        for (const bar of blockEvents) {
          for (const e of bar) {
            const ev = { kind: e.kind, notes: e.notes.map((x) => ({ ...x })), dur: e.dur, tech: { ...(e.tech || {}) }, line: e.line, i: events.length, beat, bar: barIndex };
            if (e.from) {
              // hammer-on, pull-off or slide from the note before, without a new pick
              const prev = events[events.length - 1];
              if (prev && prev.kind === 'note' && prev.notes[0].string === e.from.prev.string) { prev.tech.into = e.from.from; ev.legato = true; ev.tech.from = e.from.from; }
            }
            events.push(ev); beat += e.dur;
          }
          barIndex++; barMarks.push(beat);
        }
      }
    }
    barMarks.pop();
    if (!blocks.length && !problems.length) err(0, 'No tab found yet: write six lines, one per string, such as e|---0---|');
    else if (!events.some((e) => e.kind !== 'rest' && e.kind !== 'mute') && !problems.length) err(0, 'There are no notes to play yet.');
    meta.bpm = meta.bpm || 100;
    meta.meter = meter;
    return {
      events, totalBeats: beat, beatsPerBar: barBeats, bars: Math.ceil(beat / barBeats - 1e-6), barMarks, pos: 0,
      errors: problems.map((p) => (p.line ? 'Line ' + p.line + ': ' : '') + p.msg), problems, warnings, meta,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
