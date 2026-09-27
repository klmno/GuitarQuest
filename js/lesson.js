/* GuitarQuest: the lesson engine.
 * Modes (REQ-FN-2): beginner waits for each note; intermediate and advanced run in time.
 * Practice lock (REQ-FN-3), loop with tempo ramp (REQ-FN-6), metronome, count-in and backing (REQ-FN-5),
 * scoring with doubt (REQ-SC-1/2, REQ-DET-6), drift re-check (REQ-DET-9), chord changes (REQ-SC-3). */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory, N = GQ.notation, C = GQ.chords, SC = GQ.scoring, store = GQ.store;
  const A = () => GQ.audio;

  class Lesson extends GQ.Emitter {
    constructor(level, opts) {
      super();
      opts = opts || {};
      this.level = level;
      const s = store.settings();
      this.mode = opts.mode || s.mode;
      this.setup = { tuning: s.tuning, capo: s.capo };
      this.a4 = s.a4 || 440;
      this.lockPos = opts.lockPos != null ? opts.lockPos : null;
      const text = (level.repeat || 1) > 1 ? Array(level.repeat).fill(level.text).join(' | ') : level.text;
      this.parsed = N.parse(text, { setup: this.setup, meter: level.meter, pos: this.lockPos != null ? this.lockPos : level.pos });
      this.events = this.parsed.events;
      this.step = opts.step || 100;                       // % of the notes to play (GQ.steps)
      GQ.steps.apply(this.events, this.parsed.beatsPerBar, this.step);
      this.targets = this.events.filter((e) => e.kind !== 'rest' && !e.ghost);
      this.bpb = this.parsed.beatsPerBar;
      this.totalBeats = this.parsed.totalBeats;
      this.bpm = level.bpm || 80;
      this.tempo = opts.tempo || 1;
      this.lock = !!s.practiceLock;
      this.backingStyle = level.backing || 'none';
      this.state = 'ready';
      this.results = new Map();
      this.loop = null;
      this.posBeat = 0;
      this.subs = [];
    }
    get spb() { return 60 / (this.bpm * this.tempo); }
    get waitMode() { return this.mode === 'beginner' || this.lock; }
    beatToTime(b) { return this.anchor.t + (b - this.anchor.beat) * this.spb; }
    timeToBeat(t) { return this.anchor.beat + (t - this.anchor.t) / this.spb; }
    expMidis(ev) { return N.midis(ev, this.setup); }
    toMidi(f) { return T.freqToMidi(f, this.a4); }

    // ---------- control ----------
    start() {
      const a = A();
      if (!a.ctx) throw new Error('Open the guitar input first.');
      this.stopTimers();
      const tuned = GQ.tuner.isTuned();
      this.scored = a.canScore() && tuned && !this.loop;
      this.unscoredReason = !a.canScore() ? 'This input is not confirmed as the guitar, so the run is not scored.'
        : !tuned ? 'Tune first to get a score. This run is practice only.' : this.loop ? 'Loop practice is not scored.' : '';
      this.results.clear();
      this.instances = []; this.extras = 0; this.attempts = {}; this.changes = [];
      this.drift = {}; this.driftWarned = {}; this.pass = 0; this.pendingPass = null; this.bending = null;
      this.lastChordHit = null; this.heard = null;
      const startBeat = this.loop ? this.loop.a : 0;
      const countBeats = store.settings().countIn && !this.waitMode ? this.bpb : 0;
      this.anchor = { t: a.ctx.currentTime + 0.3 + countBeats * this.spb, beat: startBeat };
      this.schedBeat = Math.floor(startBeat) - countBeats;
      this.schedTarget = this.targets.findIndex((e) => e.beat >= startBeat);
      if (this.schedTarget < 0) this.schedTarget = this.targets.length;
      this.nextIdx = this.schedTarget;
      this.run();
    }
    run() {
      const a = A();
      this.state = 'playing';
      this.playStart = performance.now();
      this.subs = [a.on('note', (m) => this.onNote(m)), a.on('onset', (m) => this.onOnset(m)),
        a.on('chroma', (m) => this.onChroma(m)), a.on('frame', (m) => this.onFrame(m)),
        a.on('unclear', () => this.emit('feedback', { kind: 'unclear', text: "I didn't hear that clearly." })),
        a.on('lost', () => this.pause('lost'))];
      this.timer = setInterval(() => this.tick(), 25);
      this.emit('state', this.state);
    }
    resume() {
      if (this.state !== 'paused' || !A().ctx) return this.start();
      const now = A().ctx.currentTime;
      const pos = Math.max(this.loop ? this.loop.a : 0, (this.pausedAt || 0) - 1); // back up one beat
      this.instances = this.instances.filter((x) => x.res);
      this.anchor = { t: now + 0.4, beat: pos };
      this.schedBeat = Math.ceil(pos);
      this.schedTarget = this.targets.findIndex((e) => e.beat >= pos);
      if (this.schedTarget < 0) this.schedTarget = this.targets.length;
      if (this.waitMode) {
        this.nextIdx = this.targets.findIndex((e) => !this.results.has(e.i));
        if (this.nextIdx < 0) this.nextIdx = this.targets.length;
      }
      this.run();
    }
    stopTimers() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      for (const u of this.subs) u();
      this.subs = [];
    }
    stop() {
      if (this.state === 'playing') this.addPractice();
      this.stopTimers();
      this.state = 'stopped';
      this.emit('state', this.state);
    }
    pause(reason) {
      if (this.state !== 'playing') return;
      this.addPractice();
      this.stopTimers();
      this.state = 'paused';
      this.pausedAt = this.displayPos();
      this.emit('state', this.state);
      if (reason) this.emit('paused', reason);
    }
    addPractice() {
      const sec = (performance.now() - (this.playStart || performance.now())) / 1000;
      if (sec > 1) store.addPracticeSeconds(Math.min(sec, 1800));
      this.playStart = performance.now();
    }
    setTempo(f) {
      f = GQ.clamp(f, 0.4, 1.6);
      if (this.state === 'playing' && !this.waitMode && A().ctx) {
        const now = A().ctx.currentTime;
        this.anchor = { t: now, beat: this.timeToBeat(now) };
      }
      this.tempo = f;
      this.emit('tempo', this.bpm * f);
    }
    setLock(on) {
      if (on === this.lock) return;
      const pos = this.displayPos();
      this.lock = on;
      if (this.state !== 'playing') return;
      const now = A().ctx.currentTime;
      if (on) { // drop open timed instances; wait from the first unplayed target
        this.instances = this.instances.filter((x) => x.res);
        this.nextIdx = this.targets.findIndex((e) => !this.results.has(e.i) && e.beat >= pos - 0.01);
        if (this.nextIdx < 0) this.nextIdx = this.targets.length;
      } else { // continue in time from here
        this.anchor = { t: now + 0.15, beat: pos };
        this.schedBeat = Math.ceil(pos);
        this.schedTarget = this.targets.findIndex((e) => e.beat >= pos);
        if (this.schedTarget < 0) this.schedTarget = this.targets.length;
      }
      this.emit('lock', on);
    }
    setLoop(a, b, ramp) {
      this.loop = a == null ? null : { a, b, ramp: ramp == null ? 0.05 : ramp, target: 1, clean: 0 };
      this.emit('loop', this.loop);
    }

    // ---------- clock ----------
    displayPos() {
      if (this.state !== 'playing') return this.state === 'paused' ? this.pausedAt : this.posBeat;
      const a = A();
      if (!a.ctx) return this.posBeat;
      let p = this.timeToBeat(a.now() - a.outputLatency());
      if (this.waitMode) {
        const t = this.targets[this.nextIdx];
        if (t && p > t.beat) p = t.beat;
      }
      this.posBeat = p;
      return p;
    }

    tick() {
      const a = A();
      if (!a.ctx) return;
      const now = a.ctx.currentTime;
      const s = store.settings();
      if (!this.waitMode) {
        const horizon = now + 0.12;
        for (;;) {
          if (this.loop && this.schedBeat >= this.loop.b) {
            const tWrap = this.beatToTime(this.loop.b);
            this.pendingPass = { t: tWrap, pass: this.pass };
            this.pass++;
            this.anchor = { t: tWrap, beat: this.loop.a };
            this.schedBeat = Math.floor(this.loop.a);
            this.schedTarget = this.targets.findIndex((e) => e.beat >= this.loop.a);
            for (const e of this.targets) if (e.beat >= this.loop.a && e.beat < this.loop.b) this.results.delete(e.i);
            continue;
          }
          const b = this.schedBeat;
          if (!this.loop && b > this.totalBeats) break;
          const t = this.beatToTime(b);
          if (t > horizon) break;
          const inBar = ((b % this.bpb) + this.bpb) % this.bpb;
          if (b < 0) GQ.sound.click(t, 2);
          else if (b < this.totalBeats) {
            if (s.metronome) GQ.sound.click(t, inBar === 0 ? 1 : 0);
            if (s.backing && this.backingStyle !== 'none') GQ.sound.backingBeat(t, inBar, this.bpb, this.spb, this.chordAt(b), this.backingStyle);
          }
          // targets starting in [b, b+1)
          while (this.schedTarget >= 0 && this.schedTarget < this.targets.length && this.targets[this.schedTarget].beat < b + 1 &&
                 (!this.loop || this.targets[this.schedTarget].beat < this.loop.b)) {
            const ev = this.targets[this.schedTarget++];
            if (ev.beat < b) continue;
            this.instances.push({ ev, time: this.beatToTime(ev.beat), win: SC.window(this.mode, ev) / 1000, pass: this.pass, res: null });
          }
          this.schedBeat = b + 1;
        }
        // misses
        for (const x of this.instances) {
          if (x.res) continue;
          const grace = x.ev.kind === 'chord' ? 0.3 : 0.08;
          if (x.bend && now < x.time + x.ev.dur * this.spb + 0.1) continue;
          if (now > x.time + x.win + grace) {
            if (x.bend) this.resolveBend(x); else this.resolve(x, { state: 'miss', points: 0 });
          }
        }
        // loop pass finished
        if (this.pendingPass && now > this.pendingPass.t + 0.45) this.finishPass();
        if (!this.loop && now > this.beatToTime(this.totalBeats) + 0.6) this.finish();
      } else if (this.bending && performance.now() - this.bending.startPerf > 2500) {
        this.emit('feedback', { kind: 'hint', text: 'Bend further: push until the pitch reaches the target note.' });
        this.bending = null;
      }
    }

    chordAt(beat) {
      let c = null;
      for (const e of this.events) { if (e.beat > beat + 1e-6) break; if (e.chord) c = e.chord; }
      if (!c && this.level.chords) { const k = Math.floor(beat / this.bpb) % this.level.chords.length; c = C.get(this.level.chords[k]); }
      return c;
    }

    // ---------- matching ----------
    heardInfo(m) {
      const mf = this.toMidi(m.freq);
      return { midi: Math.round(mf), cents: Math.round((mf - Math.round(mf)) * 100), name: T.midiName(mf), freq: m.freq, conf: m.conf };
    }
    onNote(m) {
      const h = this.heardInfo(m);
      this.heard = h;
      this.emit('heard', h);
      if (this.waitMode) return this.waitNote(m, h);
      // a slur we can't confirm, or a pitch that may be an older note still ringing, is never a mistake (REQ-DET-6)
      if (m.legato && this.pitchVerdictAny(h) !== 'ok') return;
      const t = m.onsetTime - A().offsetSec() - (m.legato ? 0.03 : 0);
      const cands = this.instances.filter((x) => !x.res && !x.bend && x.ev.kind === 'note' && Math.abs(t - x.time) <= x.win);
      if (!cands.length) {
        const near = this.instances.some((x) => Math.abs(t - x.time) <= x.win * 2);
        if (!near && m.conf >= 0.9 && !m.legato && this.instances.length) { this.extras++; this.emit('feedback', { kind: 'extra', text: 'Extra note: ' + h.name }); }
        return;
      }
      cands.sort((x, y) => {
        const px = this.pitchVerdict(x.ev, h) === 'ok' ? 0 : 1, py = this.pitchVerdict(y.ev, h) === 'ok' ? 0 : 1;
        return px - py || Math.abs(t - x.time) - Math.abs(t - y.time);
      });
      const x = cands[0];
      const v = this.pitchVerdict(x.ev, h, m);
      const timingMs = Math.round((t - x.time) * 1000);
      if (v === 'bend-start') { x.bend = { start: this.toMidi(m.freq), max: this.toMidi(m.freq), timingMs }; return; }
      if (v === 'ok') {
        this.trackDrift(x.ev, m);
        this.resolve(x, { state: 'hit', points: SC.timedPoints(timingMs, x.win * 1000), timingMs, cents: h.cents, heard: h.name });
      } else if (v === 'unclear') this.resolve(x, { state: 'unclear', points: 0, heard: h.name });
      else this.resolve(x, { state: 'wrong', points: 0, timingMs, heard: h.name, hint: this.positionHint(x.ev, h) });
    }
    pitchVerdictAny(h) {
      const now = A().ctx ? A().ctx.currentTime : 0;
      return this.instances.some((x) => !x.res && x.ev.kind === 'note' && Math.abs(now - x.time) < 1 && this.pitchVerdict(x.ev, h) === 'ok') ? 'ok' : 'no';
    }
    // ok | wrong | unclear | bend-start
    pitchVerdict(ev, h, m) {
      const exp = this.expMidis(ev)[0];
      if (exp == null) return 'unclear';
      const bend = ev.tech && ev.tech.bend;
      if (bend && h.midi === exp - bend) return 'bend-start';
      if (h.midi === exp) return 'ok';
      if ([12, 19, 24].includes(Math.abs(h.midi - exp)) || (m && (m.conf < 0.88 || m.ringing))) return 'unclear'; // octave / twelfth / maybe a ringing note: detector doubt
      return 'wrong';
    }
    positionHint(ev, h) {
      const n = ev.notes[0];
      const where = T.positionsFor(h.midi, this.setup).map((p) => `string ${p.string} fret ${p.fret}`).slice(0, 3).join(', ');
      return `Heard ${h.name}${where ? ' (' + where + ')' : ''}. The lesson wants string ${n.string}, fret ${n.fret}.`;
    }
    onOnset(m) {
      if (this.waitMode) {
        const tg = this.targets[this.nextIdx];
        if (tg && tg.kind === 'mute') this.waitHit(tg, {});
        if (tg && tg.kind === 'chord') this.pendingOnset = m.frame;
        return;
      }
      const t = m.time - A().offsetSec();
      const cands = this.instances.filter((x) => !x.res && !x.onsetT && (x.ev.kind === 'chord' || x.ev.kind === 'mute') && Math.abs(t - x.time) <= x.win);
      if (!cands.length) return;
      cands.sort((x, y) => Math.abs(t - x.time) - Math.abs(t - y.time));
      const x = cands[0];
      const timingMs = Math.round((t - x.time) * 1000);
      if (x.ev.kind === 'mute') this.resolve(x, { state: 'hit', points: SC.timedPoints(timingMs, x.win * 1000), timingMs });
      else { x.onsetT = t; x.onsetFrame = m.frame; x.timingMs = timingMs; }
    }
    onChroma(m) {
      // palm-mute hint (REQ-DET-10): a palm-muted note dies away quickly
      const pmNote = this.targets.find((e) => e.tech && e.tech.pm && this.results.get(e.i) && this.results.get(e.i).state === 'hit' && !this.results.get(e.i).pmChecked);
      if (pmNote) { this.results.get(pmNote.i).pmChecked = true; if (m.decayDb > -4) this.emit('feedback', { kind: 'hint', text: 'Palm mute: rest the edge of your picking hand on the strings by the bridge.' }); }
      if (this.waitMode) {
        const tg = this.targets[this.nextIdx];
        if (!tg || tg.kind !== 'chord') return;
        const j = this.judgeChord(tg, m.chroma);
        if (j.verdict === 'match') this.waitHit(tg, { confidence: j.confidence });
        else if (j.verdict === 'wrong') { this.attempts[tg.i] = (this.attempts[tg.i] || 0) + 1; this.emit('feedback', { kind: 'wrong', text: `That sounded like ${j.heard}. Check the shape of ${tg.chordName || 'the chord'}.` }); }
        else this.emit('feedback', { kind: 'unclear', text: "I didn't hear that chord clearly. Strum all the strings of the shape." });
        return;
      }
      const x = this.instances.find((i) => !i.res && i.onsetFrame === m.onsetFrame);
      if (!x) return;
      const j = this.judgeChord(x.ev, m.chroma);
      const pts = SC.timedPoints(x.timingMs, x.win * 1000);
      if (j.verdict === 'match') this.resolve(x, { state: 'hit', points: pts, timingMs: x.timingMs, confidence: j.confidence, heard: x.ev.chordName });
      else if (j.verdict === 'wrong') this.resolve(x, { state: 'wrong', points: 0, timingMs: x.timingMs, heard: j.heard, confidence: j.confidence });
      else this.resolve(x, { state: 'unclear', points: 0, confidence: j.confidence });
    }
    judgeChord(ev, chroma) {
      const chord = ev.chord || { name: '', notes: ev.notes, frets: [] };
      if (!ev.chord) { // double stop: compare with its own notes
        const tpl = new Array(12).fill(0);
        for (const m of this.expMidis(ev)) { tpl[m % 12] += 1; tpl[(m + 7) % 12] += 0.4; }
        const sc = C.cosine(chroma, tpl);
        return { verdict: sc >= 0.75 ? 'match' : sc < 0.5 ? 'wrong' : 'unclear', confidence: sc, heard: '' };
      }
      return C.judge(chroma, chord, this.setup);
    }
    onFrame(m) {
      const p = m.pitch;
      if (!p || p.conf < 0.8) return;
      const mf = this.toMidi(p.f);
      if (this.waitMode && this.bending) {
        const tg = this.targets[this.nextIdx];
        if (tg && Math.abs(mf - this.expMidis(tg)[0]) <= 0.35) { this.bending = null; this.waitHit(tg, { bend: true }); }
        return;
      }
      for (const x of this.instances) if (x.bend && !x.res && mf > x.bend.max && mf < x.bend.start + 3) x.bend.max = mf;
    }
    resolveBend(x) {
      const want = x.ev.tech.bend, got = x.bend.max - x.bend.start;
      const ratio = GQ.clamp(got / want, 0, 1.2);
      const ok = Math.abs(got - want) <= 0.35;
      const pts = ok ? SC.timedPoints(x.bend.timingMs, x.win * 1000) : Math.round(100 * Math.min(ratio, 1) * 0.8);
      this.resolve(x, { state: ratio >= 0.5 ? 'hit' : 'wrong', points: pts, timingMs: x.bend.timingMs, bendCents: Math.round(got * 100),
        hint: ok ? null : `The bend reached ${Math.round(got * 100)} cents of ${want * 100}.` });
    }
    resolve(x, res) {
      x.res = res;
      this.results.set(x.ev.i, res);
      this.emit('result', { ev: x.ev, res });
    }

    // ---------- wait mode (beginner, practice lock) ----------
    waitNote(m, h) {
      const tg = this.targets[this.nextIdx];
      if (!tg || tg.kind !== 'note') return;
      const v = this.pitchVerdict(tg, h, m);
      if (m.legato && v !== 'ok') return; // unconfirmed slur: ignore rather than count an attempt
      if (v === 'ok') { this.trackDrift(tg, m); this.waitHit(tg, { cents: h.cents, heard: h.name }); }
      else if (v === 'bend-start') { this.bending = { startPerf: performance.now() }; this.emit('feedback', { kind: 'hint', text: 'Now bend it up to the target pitch.' }); }
      else if (v === 'unclear') this.emit('feedback', { kind: 'unclear', text: "I didn't hear that clearly. Try again." });
      else {
        this.attempts[tg.i] = (this.attempts[tg.i] || 0) + 1;
        this.emit('feedback', { kind: 'wrong', text: this.positionHint(tg, h) });
      }
    }
    waitHit(tg, extra) {
      const attempts = this.attempts[tg.i] || 0;
      const res = Object.assign({ state: 'hit', points: SC.waitPoints(attempts), attempts }, extra);
      this.results.set(tg.i, res);
      this.emit('result', { ev: tg, res });
      if (tg.kind === 'chord' && tg.chordName) {
        const nowP = performance.now();
        if (this.lastChordHit && this.lastChordHit.name !== tg.chordName)
          this.changes.push({ pair: this.lastChordHit.name + '→' + tg.chordName, ms: Math.round(nowP - this.lastChordHit.t) });
        this.lastChordHit = { name: tg.chordName, t: nowP };
      }
      this.nextIdx++;
      const next = this.targets[this.nextIdx];
      if (!next) { this.finish(); return; }
      if (this.mode !== 'beginner') return; // practice lock keeps the tempo feel
      const now = A().ctx.currentTime;
      this.anchor = { t: now, beat: Math.max(tg.beat, next.beat - 1) };
    }

    // ---------- tuning drift (REQ-DET-9) ----------
    trackDrift(ev, m) {
      const n = ev.notes[0]; if (!n || ev.tech && ev.tech.bend) return;
      const cents = (this.toMidi(m.freq) - this.expMidis(ev)[0]) * 100;
      const a = (this.drift[n.string] = this.drift[n.string] || []);
      a.push(cents); if (a.length > 6) a.shift();
      if (a.length >= 5 && !this.driftWarned[n.string]) {
        const med = GQ.median(a);
        if (Math.abs(med) > 18) {
          this.driftWarned[n.string] = true;
          this.emit('drift', { string: n.string, cents: Math.round(med) });
        }
      }
    }

    // ---------- loop passes and the end ----------
    finishPass() {
      const p = this.pendingPass.pass;
      this.pendingPass = null;
      const xs = this.instances.filter((x) => x.pass === p);
      if (!xs.length) return;
      const hits = xs.filter((x) => x.res && x.res.state === 'hit').length;
      const judged = xs.filter((x) => !x.res || x.res.state !== 'unclear').length || 1;
      const acc = hits / judged;
      const clean = acc >= 0.9;
      if (clean && this.loop.ramp && this.tempo < this.loop.target) this.setTempo(Math.min(this.loop.target, this.tempo * (1 + this.loop.ramp)));
      this.instances = this.instances.filter((x) => x.pass !== p);
      this.emit('pass', { pass: p + 1, accuracy: Math.round(acc * 100), clean, bpm: Math.round(this.bpm * this.tempo) });
    }
    finish() {
      if (this.state !== 'playing') return;
      this.addPractice();
      this.stopTimers();
      this.state = 'done';
      const list = this.targets.map((e) => this.results.get(e.i) || { state: 'miss', points: 0 });
      const sum = SC.summarise(list, this.extras);
      const misses = [], chordMisses = [];
      this.targets.forEach((e, k) => {
        const r = list[k];
        if (r.state !== 'miss' && r.state !== 'wrong') return;
        if (e.kind === 'chord' && e.chordName) chordMisses.push(e.chordName);
        else if (e.kind === 'note') misses.push(T.midiName(this.expMidis(e)[0]));
      });
      const scored = this.scored && !sum.inputProblem;
      // a step with part of the notes can score at most that part (e.g. 40% of the notes: 40 max)
      sum.rawScore = sum.score;
      if (this.step < 100) { sum.score = Math.round((sum.score * this.step) / 100); if (!sum.inputProblem) sum.stars = SC.stars(sum.score); }
      const run = Object.assign({}, sum, { step: this.step, level: this.level.id, mode: this.mode, scored, misses, chordMisses, changes: this.changes,
        reason: sum.inputProblem ? 'More than a fifth of the notes were unclear, so this run is not scored. Check the input level and the noise gate.' : this.unscoredReason });
      if (!this.loop) store.recordRun(run);
      this.emit('state', this.state);
      this.emit('end', run);
    }
  }

  GQ.Lesson = Lesson;
})(typeof window !== 'undefined' ? window : globalThis);
