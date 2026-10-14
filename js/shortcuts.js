/* GuitarQuest: keyboard shortcuts for each page. Every page has up to 8 actions, each a button (or field)
 * marked with data-sk="<action>". The player picks the keys in Settings > Keyboard shortcuts (per profile);
 * the key is shown in front of the button's name ("1.▶ Start") by a style rule, so buttons that change
 * their text keep it. Shortcuts don't fire while typing in a text field or with Ctrl, Alt or Cmd held.
 * The hands-free keys in js/controls.js are separate; one key never does two things on the lesson page. */
(function (G) {
  'use strict';
  const GQ = G.GQ, store = GQ.store;
  const KS = (GQ.shortcuts = new GQ.Emitter());
  const D = (n) => 'Digit' + n;

  // page -> [action, name, default key]; at most 8 per page
  KS.PAGES = {
    lesson: { title: 'Lesson', actions: [['toggle', 'Start / pause', D(1)], ['again', 'Again', D(2)], ['listen', 'Listen', D(3)], ['slower', 'Slower', D(4)],
      ['faster', 'Faster', D(5)], ['lock', 'Lock', D(6)], ['loop', 'Loop', D(7)], ['next', 'Next level', D(8)]] },
    // the panel after a run (it covers the lesson page while it is open)
    result: { title: 'Lesson result', actions: [['nextstep', 'Next step', D(1)], ['again', 'Again', D(2)], ['close', 'Close', D(3)], ['next', 'Next level', D(8)]] },
    learn: { title: 'Learn', actions: [['start', 'Start the next level', D(1)], ['beginner', 'Beginner', D(2)], ['intermediate', 'Intermediate', D(3)],
      ['advanced', 'Advanced', D(4)], ['players', 'Switch player', D(5)]] },
    songs: { title: 'Songs', actions: [['new', 'New song', D(1)], ['import', 'Import', D(2)], ['all', 'All songs', D(3)], ['mine', 'My songs', D(4)],
      ['folk', 'Folk', D(5)], ['blues', 'Blues', D(6)], ['rock', 'Rock', D(7)], ['help', 'ABC help', D(8)]] },
    practice: { title: 'Practice', actions: [['warmup', 'Warm up', D(1)], ['surprise', 'Surprise me', D(2)], ['search', 'Find an exercise', D(3)], ['all', 'All exercises', D(4)]] },
    creator: { title: 'Creator', actions: [['save', 'Save song', D(1)], ['practise', 'Save and practise', D(2)], ['listen', 'Listen', D(3)], ['download', 'Download', D(4)],
      ['open', 'Open file', D(5)], ['new', 'New', D(6)], ['abc', 'Write in ABC', D(7)], ['tab', 'Write as tab', D(8)]] },
    tuner: { title: 'Tuner', actions: [['s6', 'Low E string', D(1)], ['s5', 'A string', D(2)], ['s4', 'D string', D(3)], ['s3', 'G string', D(4)], ['s2', 'B string', D(5)],
      ['s1', 'High e string', D(6)], ['again', 'Start again', D(7)], ['back', 'Back / continue', D(8)]] },
    settings: { title: 'Settings', actions: [['calibrate', 'Calibrate', D(1)], ['noise', 'Measure noise floor', D(2)], ['updates', 'Check for updates', D(3)], ['sync', 'Sync the songs folder', D(4)]] },
    profiles: { title: 'Profiles', actions: [['add', 'Add a profile', D(1)], ['import', 'Import a profile', D(2)]] },
    help: { title: 'ABC help', actions: [['creator', 'Open the Creator', D(1)], ['mine', 'My songs', D(2)]] },
  };
  KS.MAX = 8;

  const norm = (code) => (/^Numpad\d$/.test(code) ? 'Digit' + code.slice(6) : code);
  const NAMES = { Space: 'Space', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Semicolon: ';', Quote: "'", Backquote: '`', Backslash: '\\',
    Comma: ',', Period: '.', Slash: '/', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', PageUp: 'PgUp', PageDown: 'PgDn', Backspace: '⌫' };
  // "Digit1" -> "1", "KeyA" -> "A", "F2" -> "F2"
  KS.keyName = (code) => (!code ? '' : /^Digit\d$/.test(code) ? code.slice(5) : /^Key[A-Z]$/.test(code) ? code.slice(3) : NAMES[code] || code);

  // the key for an action: the player's choice, else the default ('' = none)
  KS.keyFor = function (page, action) {
    const mine = (store.settings().shortcuts || {})[page] || {};
    if (action in mine) return mine[action] || '';
    const a = (KS.PAGES[page] || { actions: [] }).actions.find((x) => x[0] === action);
    return a ? a[2] : '';
  };
  KS.keys = (page) => Object.fromEntries((KS.PAGES[page] || { actions: [] }).actions.map(([a]) => [a, KS.keyFor(page, a)]));
  KS.set = function (page, action, code) {
    const all = JSON.parse(JSON.stringify(store.settings().shortcuts || {}));
    all[page] = Object.assign({}, all[page], { [action]: code || '' });
    store.setSetting('shortcuts', all);
  };
  KS.reset = function (page) {
    const all = JSON.parse(JSON.stringify(store.settings().shortcuts || {}));
    if (page) delete all[page]; else for (const k of Object.keys(all)) delete all[k];
    store.setSetting('shortcuts', all);
  };

  // ----- the key in front of each button's name -----
  KS.page = null;
  let styleEl = null;
  const cssStr = (s) => '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  function restyle() {
    if (typeof document === 'undefined') return;
    if (!styleEl) { styleEl = document.createElement('style'); styleEl.id = 'gq-shortcuts'; document.head.append(styleEl); }
    const rules = (page, scope) => Object.entries(KS.keys(page)).filter(([, c]) => c)
      .map(([a, c]) => `${scope} [data-sk="${a}"]::before { content: ${cssStr(KS.keyName(c) + '.')}; }`);
    styleEl.textContent = (KS.page ? rules(KS.page, 'main') : []).concat(KS.page === 'lesson' ? rules('result', '.overlay') : []).join('\n');
  }
  // where keys go right now: the result panel while it is open over the lesson, else the page
  const context = () => (KS.page === 'lesson' && document.querySelector('.overlay') ? { page: 'result', scope: '.overlay' } : { page: KS.page, scope: 'main' });
  KS.setPage = function (page) { KS.page = KS.PAGES[page] ? page : null; restyle(); };
  store.on('settings', (e) => { if (e.key === 'shortcuts') restyle(); });
  store.on('profile', restyle);

  // ----- choosing a key in Settings -----
  let learning = null;
  KS.learn = function (page, action) { learning = { page, action }; KS.emit('learning', learning); };
  KS.cancel = function () { if (learning) { learning = null; KS.emit('learned', null); } };
  KS.isLearning = () => !!learning;

  // called first for every key press (js/controls.js); true when the key was used here
  KS.keydown = function (e) {
    if (learning) {
      if (/^(Shift|Control|Alt|Meta|CapsLock|Fn)/.test(e.key)) return true; // wait for a real key
      e.preventDefault();
      const { page, action } = learning;
      learning = null;
      if (e.code === 'Escape') { KS.emit('learned', null); return true; }
      if (e.code === 'Tab' || e.code === 'Enter') { KS.emit('learned', { page, action, refused: KS.keyName(e.code) + ' is kept for moving around the page.' }); return true; }
      const code = norm(e.code), moved = [];
      // one key, one action on a page
      for (const [a, c] of Object.entries(KS.keys(page))) if (a !== action && c === code) { KS.set(page, a, ''); moved.push(KS.nameOf(page, a)); }
      if (page === 'lesson') {
        const hf = Object.assign({}, store.settings().keys);
        for (const [a, codes] of Object.entries(hf)) if (codes.includes(code)) { hf[a] = codes.filter((c) => c !== code); moved.push('Hands-free: ' + GQ.controls.ACTIONS[a]); }
        store.setSetting('keys', hf);
      }
      KS.set(page, action, code);
      KS.emit('learned', { page, action, code, moved });
      return true;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || !KS.page) return false;
    const t = e.target || {}, tag = t.tagName || '';
    if (tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return false;
    if (tag === 'INPUT' && !/^(checkbox|radio|range|button|submit|reset|color)$/i.test(t.type || '')) return false;
    const code = norm(e.code), ctx = context();
    const hit = Object.entries(KS.keys(ctx.page)).find(([, c]) => c && c === code);
    if (!hit) return false;
    const el = [...document.querySelectorAll(`${ctx.scope} [data-sk="${hit[0]}"]`)].find((x) => x.offsetParent !== null || x.getClientRects().length);
    if (!el) return false;
    e.preventDefault();
    if (el.disabled) return true;
    if (el.tagName === 'INPUT' && !/^(checkbox|radio|button)$/i.test(el.type)) el.focus();
    else el.click();
    KS.emit('used', { page: ctx.page, action: hit[0] });
    return true;
  };
  KS.nameOf = (page, action) => ((KS.PAGES[page] || { actions: [] }).actions.find((x) => x[0] === action) || [, action])[1];
})(typeof window !== 'undefined' ? window : globalThis);
