/* GuitarQuest: the terse lesson notation (requirements, risk 7: "design the notation format first").
 *
 *   q h w e s      set the current duration (quarter, half, whole, eighth, sixteenth); add "." for dotted
 *   6:3            string 6, fret 3            E4 / F#3 / Bb4   a pitch; string and fret are chosen for the position
 *   6:3@2          ...played with finger 2     6:x              dead (muted) note, rhythm only
 *   5:5h7 5:7p5    hammer-on / pull-off (splits the duration: pick, then slur)
 *   3:7/9 3:9\7    slide up / down             3:7b2 3:7b1  bend up a whole / half step     3:7~ vibrato
 *   6:0pm          palm mute                   6:5+5:7      notes played together (double stop)
 *   [Am] [F#m@E] [P6:5]   a strummed chord (library name, movable E/A-shape barre, power chord root string:fret)
 *   d u            strum the previous chord down / up        x   muted strum (rhythm only)
 *   r              rest                        |            bar line (for reading only)
 */
(function (G) {
  'use strict';
  const GQ = G.GQ, T = GQ.theory, C = GQ.chords;
  const N = (GQ.notation = {});
  const DUR = { w: 4, h: 2, q: 1, e: 0.5, s: 0.25 };

  N.parse = function (text, opts) {
    opts = opts || {};
    const setup = opts.setup || T.setup;
    const meter = opts.meter || [4, 4];
    const beatsPerBar = meter[0] * (4 / meter[1]);
    const posHint = opts.pos;
    const events = [];
    const errors = [];
    const barMarks = [];
    let dur = 1, beat = 0, lastChord = null, prev = null;
    const tokens = String(text).trim().split(/\s+/).filter(Boolean);

    // fingering base for fretted notes: the level's position, else its lowest fretted note
    let pos = posHint;
    if (pos == null) {
      const frets = [...String(text).matchAll(/(?:^|\s|\+)[1-6]:(\d+)/g)].map((m) => +m[1]).filter((f) => f > 0);
      pos = frets.length ? Math.min(...frets) : 0;
    }

    // sliding hand position: one finger per fret, the hand moves when a note falls outside it
    let hand = pos > 0 ? pos : 1;
    const fingerOf = (fret) => {
      if (fret <= 0) return 0;
      if (fret < hand) hand = fret; else if (fret > hand + 3) hand = fret - 3;
      return fret - hand + 1;
    };
    const push = (ev) => { ev.i = events.length; ev.beat = beat; ev.dur = ev.dur || dur; ev.bar = Math.floor(beat / beatsPerBar + 1e-6); events.push(ev); beat += ev.dur; };

    for (const tok of tokens) {
      let m;
      if ((m = /^([whqes])(\.?)$/.exec(tok))) { dur = DUR[m[1]] * (m[2] ? 1.5 : 1); continue; }
      if (tok === '|') { barMarks.push(beat); continue; }
      if (tok === 'r') { push({ kind: 'rest', notes: [] }); continue; }
      if ((m = /^\[([^\]]+)\]([du]?)$/.exec(tok))) {
        const ch = C.get(m[1]);
        if (!ch) { errors.push('unknown chord ' + m[1]); continue; }
        lastChord = ch;
        push({ kind: 'chord', chord: ch, chordName: ch.name, notes: ch.notes.map((n) => ({ ...n })), strum: m[2] || 'd' });
        continue;
      }
      if (tok === 'd' || tok === 'u') {
        if (!lastChord) { errors.push('strum before any chord'); continue; }
        push({ kind: 'chord', chord: lastChord, chordName: lastChord.name, notes: lastChord.notes.map((n) => ({ ...n })), strum: tok, repeat: true });
        continue;
      }
      if (tok === 'x') { push({ kind: 'mute', notes: [], strum: 'x', chordName: lastChord && lastChord.name }); continue; }

      // notes, possibly several joined with "+"
      const parts = tok.split('+');
      const notes = [];
      let follow = null, tech = {}, bad = false;
      for (const p of parts) {
        m = /^(?:([1-6]):(\d{1,2}|x)|([A-G][#b]?-?\d))(.*)$/.exec(p);
        if (!m) { bad = true; break; }
        let string, fret, dead = false;
        if (m[3]) {
          const midi = T.parsePitch(m[3]);
          const pl = midi != null && T.placePitch(midi, pos, prev, setup);
          if (!pl) { bad = true; break; }
          string = pl.string; fret = pl.fret;
        } else {
          string = +m[1];
          if (m[2] === 'x') { dead = true; fret = 0; } else fret = +m[2];
        }
        let rest = m[4], finger = null, mm;
        while (rest) {
          if ((mm = /^@([0-4])/.exec(rest))) finger = +mm[1];
          else if ((mm = /^([hp])(\d{1,2})/.exec(rest))) follow = { tech: mm[1], fret: +mm[2] };
          else if ((mm = /^([/\\])(\d{1,2})/.exec(rest))) follow = { tech: mm[1] === '/' ? 'su' : 'sd', fret: +mm[2] };
          else if ((mm = /^b([12])?/.exec(rest))) tech.bend = mm[1] ? +mm[1] : 2;
          else if ((mm = /^~/.exec(rest))) tech.vib = true;
          else if ((mm = /^pm/.exec(rest))) tech.pm = true;
          else { bad = true; break; }
          rest = rest.slice(mm[0].length);
        }
        if (bad) break;
        if (fret > T.FRETS) { bad = true; break; }
        notes.push({ string, fret, dead, finger: finger != null ? finger : fingerOf(fret) });
      }
      if (bad || !notes.length) { errors.push('cannot read "' + tok + '"'); continue; }
      prev = notes[0];
      const kind = notes.every((n) => n.dead) ? 'mute' : notes.length > 1 ? 'chord' : 'note';
      if (follow && notes.length === 1) {
        const d0 = dur;
        push({ kind, notes, tech: { ...tech, into: follow.tech }, dur: d0 / 2 });
        const n2 = { string: notes[0].string, fret: follow.fret, finger: fingerOf(follow.fret) };
        push({ kind: 'note', notes: [n2], legato: true, tech: { from: follow.tech }, dur: d0 / 2 });
        prev = n2;
      } else {
        push({ kind, notes, tech });
      }
    }
    return { events, totalBeats: beat, beatsPerBar, bars: Math.ceil(beat / beatsPerBar - 1e-6), errors, pos, barMarks };
  };

  // Events for any level: lesson notation, or an ABC tune (custom songs)
  N.parseLevel = function (level, opts) {
    opts = opts || {};
    if (level.abc) return GQ.abc.parse(level.abc, { setup: opts.setup, pos: opts.pos != null && opts.pos !== level.pos ? opts.pos : undefined });
    const text = (level.repeat || 1) > 1 ? Array(level.repeat).fill(level.text).join(' | ') : level.text;
    return N.parse(text, { setup: opts.setup, meter: level.meter, pos: opts.pos != null ? opts.pos : level.pos });
  };

  // Expected pitches of an event (with bends: the target pitch after the bend)
  N.midis = function (ev, setup) {
    return ev.notes.filter((n) => !n.dead).map((n) => T.midiAt(n.string, n.fret, setup) + ((ev.tech && ev.tech.bend) || 0));
  };

  // Label used in tab for an event note
  N.tabLabel = function (ev, n) {
    if (n.dead) return 'x';
    let s = String(n.fret);
    const t = ev.tech || {};
    if (t.bend) s += 'b' + (n.fret + t.bend);
    if (t.vib) s += '~';
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
