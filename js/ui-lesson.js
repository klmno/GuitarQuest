/* GuitarQuest: the lesson screen: fretboard, highway, tab, notation, chord box, live feedback, results. */
(function (G) {
  'use strict';
  const GQ = G.GQ, h = GQ.h, store = GQ.store, A = GQ.audio, T = GQ.theory, N = GQ.notation, R = GQ.render, UI = GQ.ui, CUR = GQ.curriculum;

  UI.screens.lesson = function (main, args) {
    const id = args.join('/');
    let level = CUR.byId(id);
    if (!level && id.startsWith('song-')) { const m = /^song-(.+)-(riff|full)$/.exec(id); if (m) level = CUR.songLevel(m[1], m[2]); }
    if (!level) { main.append(h('div.card', null, 'Level not found. ', h('a', { href: '#/learn' }, 'Back to the levels'))); return; }
    if (level.kind === 'tuner') { location.replace('#/tuner/level'); return; }

    const s = store.settings();
    const unit = CUR.units.find((u) => u.id === level.unit);
    const hasPitchTokens = /(^|\s)[A-G][#b]?\d/.test(level.text);
    const views = Object.assign({}, s.views, level.views || {});
    let mode = s.mode;
    if (mode === 'advanced' && !level.views) views.fretboard = false, views.highway = false; // REQ-FN-2: tab or notation only
    let lockPos = s.positionLock && hasPitchTokens ? (level.pos || 0) : null;
    let lesson = null, overlay = null, msgUntil = 0, lastRes = null, autoTimer = null;

    // ---------- header ----------
    const nextLv = CUR.next(level.id);
    const head = h('div.lesson-head', null,
      h('div', null,
        h('div.small.muted', null, unit ? `Unit ${unit.id} · ${unit.title} · level ${level.n}` : 'Song'),
        h('h2', null, level.title),
        h('p', null, level.desc || '')),
      h('div.row', null, h('button.btn.ghost', { onclick: () => UI.go('#/learn') }, '← Levels'),
        nextLv ? h('button.btn', { onclick: () => UI.go('#/lesson/' + nextLv.id) }, 'Next level →') : null));

    // ---------- toolbar ----------
    const playBtn = h('button.btn.primary.big', { onclick: toggle }, '▶ Start');
    const againBtn = h('button.btn', { onclick: () => restart() }, '↺ Again');
    const listenBtn = h('button.btn', { onclick: () => listen(), title: 'Hear how it should sound before you play' }, '♪ Listen');
    const tempoLbl = h('span.tempo');
    const lockBtn = h('button.btn', { onclick: () => setLock(!(lesson ? lesson.lock : s.practiceLock)), title: 'Hold on each note until it is played' }, 'Lock');
    const loopBtn = h('button.btn', { onclick: () => { loopBar.hidden = !loopBar.hidden; loopBtn.classList.toggle('on', !loopBar.hidden); } }, '⟲ Loop');
    const viewBtns = ['fretboard', 'highway', 'tab', 'staff'].map((k) => h('button.btn.small', { class: views[k] ? 'on' : '', onclick: (e) => { views[k] = !views[k]; e.target.classList.toggle('on', views[k]); layout(); } }, { fretboard: 'Fretboard', highway: 'Highway', tab: 'Tab', staff: 'Notation' }[k]));
    const posSel = hasPitchTokens ? h('select', { title: 'Position lock (REQ-POS-4)', onchange: (e) => { lockPos = e.target.value === '' ? null : +e.target.value; store.setSetting('positionLock', lockPos != null); build(); } },
      h('option', { value: '' }, 'Any position'), ...[0, 2, 5, 7, 9, 12].map((p) => h('option', { value: p, selected: lockPos === p }, p === 0 ? 'Open position' : 'Position ' + p))) : null;
    const toolbar = h('div.toolbar', null, playBtn, againBtn, listenBtn, h('span.sep'),
      UI.modeSeg((m) => { mode = m; if (lesson && lesson.state === 'playing') lesson.stop(); build(); }), h('span.sep'),
      h('button.btn.small', { onclick: () => tempo(-0.05), title: 'Slower' }, '−'), tempoLbl, h('button.btn.small', { onclick: () => tempo(0.05), title: 'Faster' }, '+'),
      h('span.sep'), lockBtn, loopBtn, posSel, h('span.sep'), ...viewBtns);

    // loop bar (REQ-FN-6)
    const loopA = h('input', { type: 'number', min: 1, value: 1 }), loopB = h('input', { type: 'number', min: 1, value: 2 });
    const ramp = h('input', { type: 'checkbox', checked: true });
    const loopInfo = h('span.small.muted');
    const loopBar = h('div.card.loopbar', { hidden: true, style: { marginBottom: '.8rem' } },
      h('strong', null, 'Loop bars'), loopA, h('span', null, 'to'), loopB,
      h('label.inline', null, ramp, 'Raise the tempo 5% after each clean pass'),
      h('button.btn.small.primary', { onclick: () => startLoop() }, 'Loop'), h('button.btn.small', { onclick: () => { if (lesson) { lesson.stop(); lesson.setLoop(null); } loopInfo.textContent = ''; updateButtons(); } }, 'Stop loop'), loopInfo);

    // ---------- stage ----------
    const hw = h('canvas'), tab = h('canvas'), staff = h('canvas'), fb = h('canvas');
    const heardEl = h('div.heard.dim', null, '–');
    const centsNeedle = h('div.needle'), timeNeedle = h('div.needle');
    const centsV = h('span.v'), timeV = h('span.v'), confV = h('span.v');
    const msg = h('div.msg', null, '');
    const chordCard = h('div.card.chordcard', { hidden: true });
    const feedback = h('div.card.feedback', null, heardEl, h('div.meters', null,
      h('div.meter-row', null, h('span.muted', null, 'Pitch'), h('div.cmeter', null, h('div.zone'), h('div.mid'), centsNeedle), centsV),
      h('div.meter-row', null, h('span.muted', null, 'Timing'), h('div.cmeter', null, h('div.zone'), h('div.mid'), timeNeedle), timeV),
      h('div.meter-row', null, h('span.muted', null, 'Clarity'), h('div.cmeter', null, h('div', { style: { position: 'absolute', inset: 0, width: '0%', background: 'var(--good)', borderRadius: '7px' }, class: 'clarity' })), confV),
      msg));
    const hwcol = h('div.hwcol', null, hw);
    const tabStrip = h('div.strip.tab', null, tab), staffStrip = h('div.strip.staff', null, staff);
    const maincol = h('div.maincol', null, h('div.feedrow', null, feedback, chordCard), tabStrip, staffStrip);
    const stage = h('div.stage', null, hwcol, maincol);
    const fbWrap = h('div.fb', { style: { marginTop: '.8rem' } }, fb);
    const notices = h('div');
    main.append(head, notices, toolbar, loopBar, stage, fbWrap);
    if (!A.ctx) notices.append(h('div', { style: { marginBottom: '.8rem' } }, UI.connectCard(() => { notices.innerHTML = ''; build(); showBlockers(); })));

    function layout() {
      hwcol.hidden = !views.highway; stage.classList.toggle('nohw', !views.highway);
      tabStrip.hidden = !views.tab; staffStrip.hidden = !views.staff; fbWrap.hidden = !views.fretboard;
    }
    layout();

    // ---------- lesson lifecycle ----------
    function build() {
      if (lesson) lesson.stop();
      clearTimeout(autoTimer);
      lesson = new GQ.Lesson(level, { mode, lockPos });
      if (level.ladder) { lesson.setTempo(level.ladder.from / level.bpm); lesson.setLoop(0, lesson.totalBeats, 0.05); loopInfo.textContent = 'Metronome ladder: tempo rises after each clean pass.'; }
      lesson.on('state', updateButtons);
      lesson.on('tempo', updateButtons);
      lesson.on('result', ({ res }) => {
        lastRes = res;
        if (res.state === 'wrong' && res.hint) say(res.hint, 'bad');
        else if (res.state === 'wrong') say('Heard ' + (res.heard || 'something else'), 'bad');
        else if (res.state === 'unclear') say("I didn't hear that clearly. Not counted.", 'warn');
        else if (res.state === 'miss') say('Missed', 'bad', 600);
        else if (res.hint) say(res.hint, 'warn');
      });
      lesson.on('feedback', (f) => say(f.text, f.kind === 'wrong' ? 'bad' : f.kind === 'hint' ? 'info' : 'warn'));
      lesson.on('drift', (d) => {
        notices.innerHTML = '';
        notices.append(UI.banner('warn', `Your ${T.STRING_LABEL[d.string]} string sounds ${Math.abs(d.cents)} cents ${d.cents > 0 ? 'sharp' : 'flat'}. It may have gone out of tune.`, [
          h('button.btn.small.primary', { onclick: () => { lesson.pause(); UI.go('#/tuner'); } }, 'Re-tune'),
          h('button.btn.small', { onclick: () => (notices.innerHTML = '') }, 'Keep going')]));
      });
      lesson.on('pass', (p) => { loopInfo.textContent = `Pass ${p.pass}: ${p.accuracy}%${p.clean ? ' clean' : ''} · ${p.bpm} BPM`; });
      lesson.on('paused', (r) => { if (r === 'lost') say('Input lost: paused, nothing scored.', 'bad', 5000); });
      lesson.on('end', showResult);
      updateButtons();
    }
    function showBlockers() {
      if (!A.ctx) return;
      notices.innerHTML = '';
      const b = UI.scoreBlockers(level.id, showBlockers);
      if (b.length) notices.append(...b);
      else if (lesson && lesson.loop) notices.append(UI.banner('info', 'Loop practice is not scored.'));
    }
    function listen() {
      const PV = GQ.preview;
      if (PV.playing(level)) { PV.stop(); return; }
      if (lesson && lesson.state === 'playing') lesson.pause();
      if (overlay) { overlay.remove(); overlay = null; }
      const lp = lesson && lesson.loop;
      PV.play(level, { bpm: lesson.bpm * lesson.tempo, lockPos, from: lp ? lp.a : 0, to: lp ? lp.b : undefined });
    }
    const pvOff = [GQ.preview.on('start', pvState), GQ.preview.on('stop', pvState), GQ.preview.on('end', pvState)];
    function pvState() { const on = GQ.preview.playing(level); listenBtn.textContent = on ? '■ Stop listening' : '♪ Listen'; listenBtn.classList.toggle('on', on); }
    function toggle() {
      GQ.preview.stop();
      if (!A.ctx) { say('Connect the guitar first.', 'warn'); return; }
      if (lesson.state === 'playing') { lesson.pause(); return; }
      if (overlay) { overlay.remove(); overlay = null; }
      try {
        if (lesson.state === 'paused') { lesson.resume(); return; }
        if (lesson.state === 'done' || lesson.state === 'stopped') { const t = lesson.tempo, lp = lesson.loop, lk = lesson.lock; build(); lesson.tempo = t; lesson.lock = lk; if (lp) lesson.setLoop(lp.a, lp.b, lp.ramp); }
        lesson.start();
        showBlockers();
      } catch (e) { say(e.message, 'bad'); }
    }
    function restart() { if (overlay) { overlay.remove(); overlay = null; } const t = lesson ? lesson.tempo : 1; build(); lesson.tempo = t; if (A.ctx) toggle(); }
    function tempo(d) { lesson.setTempo(Math.round((lesson.tempo + d) * 100) / 100); updateButtons(); }
    function setLock(on) { store.setSetting('practiceLock', on); lesson.setLock(on); if (lesson.state !== 'playing') lesson.lock = on; updateButtons(); }
    function startLoop() {
      const bpb = lesson.bpb, bars = Math.ceil(lesson.totalBeats / bpb);
      const a = GQ.clamp((+loopA.value || 1) - 1, 0, bars - 1), b = GQ.clamp(+loopB.value || a + 1, a + 1, bars);
      lesson.stop(); const t = lesson.tempo; build(); lesson.tempo = t;
      lesson.setLoop(a * bpb, Math.min(lesson.totalBeats, b * bpb), ramp.checked ? 0.05 : 0);
      loopInfo.textContent = `Looping bars ${a + 1} to ${b}.`;
      if (A.ctx) lesson.start();
      updateButtons();
    }
    function updateButtons() {
      if (!lesson) return;
      playBtn.textContent = lesson.state === 'playing' ? '❚❚ Pause' : lesson.state === 'paused' ? '▶ Resume' : '▶ Start';
      tempoLbl.textContent = Math.round(lesson.bpm * lesson.tempo) + ' BPM';
      lockBtn.classList.toggle('on', lesson.lock);
      loopB.max = loopA.max = Math.ceil(lesson.totalBeats / lesson.bpb);
    }
    function say(text, cls, ms) { msg.textContent = text; msg.className = 'msg ' + (cls || ''); msgUntil = performance.now() + (ms || 2500); }

    function showResult(run) {
      const passed = run.stars > 0;
      const next = CUR.next(level.id);
      overlay = h('div.overlay', null, h('div.card.result', null,
        h('h2', null, run.inputProblem ? 'The input needs attention' : !run.scored ? 'Practice run (not scored)' : passed ? 'Level passed' : 'Keep going'),
        run.inputProblem ? h('p', null, run.reason) : h('div', null, h('div.big', null, run.score + '%'), h('div.stars', null, UI.stars(run.stars))),
        h('div.grid3', null,
          h('div.stat', null, h('b', null, run.accuracy + '%'), h('span', null, 'notes right')),
          h('div.stat', null, h('b', null, run.timingMs != null ? '±' + run.timingMs + ' ms' : '–'), h('span', null, run.timingBias != null ? (run.timingBias > 0 ? 'late by ' : 'early by ') + Math.abs(run.timingBias) + ' ms on average' : 'timing')),
          h('div.stat', null, h('b', null, run.unclear), h('span', null, 'unclear (not counted)'))),
        !run.scored && !run.inputProblem ? h('div', { style: { textAlign: 'left' } }, ...(UI.scoreBlockers(level.id, () => {}).length ? UI.scoreBlockers(level.id, () => { overlay.remove(); overlay = null; showBlockers(); }) : [h('p.small.muted', null, run.reason || '')])) : null,
        run.changes && run.changes.length ? h('p.small.muted', null, 'Chord changes: average ' + (GQ.mean(run.changes.map((c) => c.ms)) / 1000).toFixed(2) + ' s') : null,
        h('div.row', { style: { justifyContent: 'center' } },
          h('button.btn', { onclick: () => restart() }, '↺ Again'),
          next ? h('button.btn.primary', { onclick: () => UI.go('#/lesson/' + next.id) }, 'Next level →') : null,
          h('button.btn.ghost', { onclick: () => { overlay.remove(); overlay = null; } }, 'Close'))));
      document.body.append(overlay);
      if (passed && next && store.settings().autoAdvance) {
        const note = h('p.small.muted', null, 'Next level in 4 s…');
        overlay.firstChild.append(note);
        autoTimer = setTimeout(() => { if (overlay) { overlay.remove(); overlay = null; } UI.go('#/lesson/' + next.id); }, 4000);
      }
    }

    // ---------- drawing ----------
    const fw = R.fretWindow(N.parse(level.text, { pos: lockPos != null ? lockPos : level.pos }).events, lockPos, lockPos != null ? lockPos + 4 : null);
    UI.draw = function (now) {
      if (!lesson) return;
      const st = store.settings(), size = st.displaySize || 1, lefty = st.leftHanded;
      const pv = GQ.preview.playing(level) ? GQ.preview.pos() : null;
      const pos = pv != null ? pv : lesson.state === 'ready' ? -0.5 : lesson.displayPos();
      const events = lesson.events;
      const setup = lesson.setup, names = T.stringNames(setup);
      if (views.highway) R.highway(hw, { events, pos, ahead: 4, results: lesson.results, lefty, size, beatsPerBar: lesson.bpb, names });
      if (views.tab) R.tab(tab, { events, pos, results: lesson.results, size, beatsPerBar: lesson.bpb, totalBeats: lesson.totalBeats, loop: lesson.loop });
      if (views.staff) R.staff(staff, { events, pos, results: lesson.results, size, beatsPerBar: lesson.bpb, totalBeats: lesson.totalBeats, setup });

      // current and upcoming targets
      const tg = lesson.targets;
      let k = pv == null && lesson.waitMode && lesson.state === 'playing' ? lesson.nextIdx : tg.findIndex((e) => e.beat + e.dur > pos + 0.02 && !lesson.results.has(e.i));
      if (k < 0) k = tg.length;
      const cur = tg[k];
      // chord box: current chord, or the next one from two beats before the change (REQ-UI-5)
      let chordEv = null;
      for (let i = k; i < tg.length && tg[i].beat <= pos + 2.01; i++) if (tg[i].chord && !tg[i].repeat) { chordEv = tg[i]; break; }
      if (!chordEv) for (let i = Math.min(k, tg.length - 1); i >= 0; i--) if (tg[i] && tg[i].chord) { chordEv = tg[i]; break; }
      if (chordEv && chordEv.chord.name) {
        chordCard.hidden = false;
        const key = chordEv.chord.name + lefty + (chordEv.beat > pos + 0.05 ? 'n' : 'c');
        if (chordCard.dataset.key !== key) {
          chordCard.dataset.key = key;
          const sounding = GQ.chords.soundingName(chordEv.chord, setup);
          chordCard.innerHTML = (chordEv.beat > pos + 0.05 && cur !== chordEv ? '<div class="soon">Next</div>' : '<div class="soon">Now</div>') +
            R.chordBox(chordEv.chord, { lefty, label: chordEv.chord.name }) +
            (sounding && sounding !== chordEv.chord.name ? `<div class="small muted">sounds as ${GQ.esc(sounding)}</div>` : '');
        }
      } else chordCard.hidden = true;

      if (views.fretboard) {
        const markers = [];
        if (cur) for (const n of cur.notes) markers.push({ string: n.string, fret: n.fret, finger: n.finger, dead: n.dead, next: true });
        for (let i = k + 1; i < Math.min(tg.length, k + 3); i++) for (const n of tg[i].notes) if (!markers.some((m) => m.string === n.string && m.fret === n.fret)) markers.push({ string: n.string, fret: n.fret, finger: n.finger, dead: n.dead, alpha: i === k + 1 ? 0.45 : 0.22 });
        // what the app heard, placed where it can be played (REQ-UI-6)
        let heard = null;
        const p = A.pitch;
        if (p && p.conf >= A.CONF_MIN) {
          const hm = Math.round(T.freqToMidi(p.f, st.a4));
          const exp = cur && cur.kind === 'note' ? N.midis(cur, setup)[0] : null;
          if (exp === hm) heard = { string: cur.notes[0].string, fret: cur.notes[0].fret, ok: true };
          else {
            const cand = T.positionsFor(hm, setup).filter((q) => q.fret >= fw.lo && q.fret <= fw.hi);
            if (cand.length) heard = Object.assign(cand[0], { ok: false });
          }
        }
        R.fretboard(fb, { lo: fw.lo, hi: fw.hi, markers, heard, lefty, size, names, barre: cur && cur.chord && cur.chord.barre,
          lock: lockPos != null ? { lo: Math.max(1, lockPos), hi: lockPos + 4 } : null });
      }

      // live feedback
      const p = A.pitch;
      if (p && p.conf >= A.CONF_MIN) {
        const mf = T.freqToMidi(p.f, st.a4), r = Math.round(mf), c = Math.round((mf - r) * 100);
        heardEl.innerHTML = T.pcName(r) + '<sub>' + (Math.floor(r / 12) - 1) + '</sub>';
        heardEl.classList.remove('dim');
        centsNeedle.style.left = (50 + GQ.clamp(c, -50, 50)) + '%';
        centsNeedle.style.background = Math.abs(c) <= 10 ? 'var(--good)' : Math.abs(c) <= 25 ? 'var(--warn)' : 'var(--bad)';
        centsV.textContent = (c > 0 ? '+' : '') + c + '¢';
      } else heardEl.classList.add('dim');
      const conf = p ? p.conf : 0;
      feedback.querySelector('.clarity').style.width = (conf * 100) + '%';
      confV.textContent = p ? Math.round(conf * 100) + '%' : '–';
      if (lastRes && Number.isFinite(lastRes.timingMs)) {
        const win = mode === 'advanced' ? 100 : 180;
        timeNeedle.style.left = (50 + GQ.clamp(lastRes.timingMs / win * 50, -50, 50)) + '%';
        timeNeedle.style.background = Math.abs(lastRes.timingMs) <= 40 ? 'var(--good)' : Math.abs(lastRes.timingMs) <= 90 ? 'var(--warn)' : 'var(--bad)';
        timeV.textContent = (lastRes.timingMs > 0 ? '+' : '') + lastRes.timingMs + ' ms';
      } else if (lesson.waitMode) timeV.textContent = 'waits';
      if (now > msgUntil && msg.textContent) { msg.textContent = ''; }
    };

    build();
    showBlockers();
    if (level.ladder) loopBtn.classList.add('on');
    return {
      destroy() { if (lesson) lesson.stop(); if (overlay) overlay.remove(); clearTimeout(autoTimer); GQ.preview.stop(); pvOff.forEach((f) => f()); },
      onAction(a) {
        if (a === 'toggle') toggle();
        else if (a === 'again') restart();
        else if (a === 'next') { const n = CUR.next(level.id); if (n) UI.go('#/lesson/' + n.id); }
        else if (a === 'slower') tempo(-0.05);
        else if (a === 'faster') tempo(0.05);
        else if (a === 'lock') setLock(!lesson.lock);
      },
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
