/* GuitarQuest: hands-free control (REQ-PF-3). USB footswitches usually send key presses
 * (PageDown/PageUp, arrows, Space), so every action maps to keys the player can re-learn.
 * Voice commands use the browser's speech recognition where it exists. */
(function (G) {
  'use strict';
  const GQ = G.GQ, store = GQ.store;
  const CT = (GQ.controls = new GQ.Emitter());
  CT.ACTIONS = { toggle: 'Start / pause', next: 'Next level', again: 'Play again', slower: 'Slower', faster: 'Faster', lock: 'Practice lock' };
  let learning = null;

  CT.learn = function (action) { learning = action; CT.emit('learning', action); };
  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (learning) {
      e.preventDefault();
      if (e.code !== 'Escape') {
        const keys = Object.assign({}, store.settings().keys);
        for (const k of Object.keys(keys)) keys[k] = keys[k].filter((c) => c !== e.code); // one key, one action
        keys[learning] = [e.code];
        store.setSetting('keys', keys);
      }
      const a = learning; learning = null; CT.emit('learned', { action: a, code: e.code });
      return;
    }
    if (/INPUT|SELECT|TEXTAREA/.test(tag) && e.code !== 'PageDown' && e.code !== 'PageUp') return;
    const keys = store.settings().keys;
    for (const [action, codes] of Object.entries(keys)) {
      if (codes.includes(e.code)) { e.preventDefault(); CT.emit('action', action); return; }
    }
  });

  // ---- voice ----
  const SR = G.SpeechRecognition || G.webkitSpeechRecognition;
  CT.voiceSupported = !!SR;
  let rec = null, wanted = false;
  const WORDS = [
    [/\b(start|play|go)\b/, 'toggle'], [/\b(stop|pause)\b/, 'toggle'], [/\bnext\b/, 'next'],
    [/\b(again|repeat|restart)\b/, 'again'], [/\bslower\b/, 'slower'], [/\bfaster\b/, 'faster'], [/\block\b/, 'lock'],
  ];
  CT.setVoice = function (on) {
    wanted = on;
    if (!SR) return false;
    if (on && !rec) {
      rec = new SR();
      rec.continuous = true; rec.interimResults = false; rec.lang = 'en-US';
      rec.onresult = (ev) => {
        const r = ev.results[ev.results.length - 1];
        const text = r[0].transcript.toLowerCase();
        for (const [re, action] of WORDS) if (re.test(text)) { CT.emit('action', action); CT.emit('voice', text); break; }
      };
      rec.onend = () => { if (wanted) { try { rec.start(); } catch { /* already */ } } else rec = null; };
      rec.onerror = (e) => { if (e.error === 'not-allowed') { wanted = false; CT.emit('voice-error', e.error); } };
      try { rec.start(); } catch { /* */ }
    } else if (!on && rec) { try { rec.stop(); } catch { /* */ } }
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);
