/* GuitarQuest: the Practice screen. Named exercises and drills by category (js/practice.js), each with Listen and Play. */
(function (G) {
  'use strict';
  const GQ = G.GQ, h = GQ.h, store = GQ.store, UI = GQ.ui, P = GQ.practice;

  UI.screens.practice = function (main, args) {
    const p = store.profile();
    let cat = P.catOf(args[0]) ? args[0] : 'all';
    let query = '';
    const played = P.items.filter((x) => p.levels[x.id] && p.levels[x.id].best).length;
    const seg = h('div.seg.wrap', null, ...[['all', 'All']].concat(P.cats.map((c) => [c[0], c[1]])).map(([c, t]) =>
      h('button', { class: c === cat ? 'on' : '', 'data-cat': c, onclick: () => { cat = c; history.replaceState(null, '', '#/practice' + (c === 'all' ? '' : '/' + c)); for (const b of seg.children) b.classList.toggle('on', b.dataset.cat === c); draw(); } }, t)));
    const search = h('input.px-search', { type: 'search', placeholder: 'Find an exercise (e.g. spider, box 3, shuffle)', oninput: (e) => { query = e.target.value.trim().toLowerCase(); draw(); } });
    const list = h('div');
    const unplayed = () => P.items.filter((x) => !(p.levels[x.id] && p.levels[x.id].best));
    main.append(
      h('div.hero', null,
        h('div', null, h('h2', null, 'Practice room'),
          h('p.muted.small', null, `${P.items.length} well-known exercises under the names guitar teachers use: warm-ups, the pentatonic boxes, scales and modes, arpeggios, rhythm patterns and speed drills. ${played} played so far. Use them every day, even after the lessons are done.`)),
        h('div.row', null,
          h('button.btn.primary', { onclick: () => UI.go('#/lesson/px-chromatic-1234') }, '▶ Warm up'),
          h('button.btn', { title: 'An exercise you have not played yet', onclick: () => { const l = unplayed().length ? unplayed() : P.items; UI.go('#/lesson/' + l[Math.floor(Math.random() * l.length)].id); } }, '🎲 Surprise me'))),
      h('div.row', { style: { marginBottom: '1rem' } }, seg, search), list);

    const listenBtn = (x) => h('button.btn.small.ghost.listen', { 'data-id': x.id, onclick: () => { if (GQ.preview.playing(x)) GQ.preview.stop(); else GQ.preview.play(x); } }, '♪ Listen');
    function card(x) {
      const r = p.levels[x.id] || {};
      const cleared = GQ.steps.progress(x.id).cleared;
      return h('div.card.song.px', { 'data-id': x.id },
        h('div.row.spread', null, h('span.badge.info', null, P.catOf(x.cat)[1]),
          h('span.badge', null, x.ladder ? `${x.ladder.from} → ${x.ladder.to} BPM` : x.bpm + ' BPM')),
        h('h4', { style: { marginTop: '.5rem' } }, x.title),
        h('div.px-aka', null, 'also called ' + x.aka),
        h('p.small.muted.px-desc', null, x.desc),
        h('div.row', { style: { marginTop: '.4rem' } }, listenBtn(x),
          h('button.btn.small.primary', { onclick: () => UI.go('#/lesson/' + x.id) }, 'Play'),
          r.best ? h('span.small.muted', null, 'Best ' + r.best + '%' + (r.stars ? ' ' + UI.stars(r.stars) : ''))
            : cleared ? h('span.small.muted', null, 'step ' + cleared + '% cleared') : null));
    }
    function draw() {
      list.innerHTML = '';
      let shown = 0;
      for (const [c, title, blurb] of P.cats) {
        if (cat !== 'all' && cat !== c) continue;
        const xs = P.inCat(c).filter((x) => !query || (x.title + ' ' + x.aka + ' ' + x.desc).toLowerCase().includes(query));
        if (!xs.length) continue;
        shown += xs.length;
        const done = xs.filter((x) => p.levels[x.id] && p.levels[x.id].best).length;
        list.append(h('section.card.unit', null,
          h('div.unit-head', null, h('div', null, h('h2', null, title), h('p', null, blurb)), h('span.small.muted', null, `${done}/${xs.length} played`)),
          h('div.songs', null, ...xs.map(card))));
      }
      if (!shown) list.append(h('div.card', null, h('p.muted', null, 'No exercise matches "' + query + '".')));
      mark();
    }
    function mark() { for (const b of list.querySelectorAll('.listen')) { const on = GQ.preview.playing(P.byId(b.dataset.id)); b.textContent = on ? '■ Stop' : '♪ Listen'; b.classList.toggle('on', on); } }
    draw();
    const offs = ['start', 'stop', 'end'].map((e) => GQ.preview.on(e, mark));
    return { destroy() { GQ.preview.stop(); offs.forEach((f) => f()); } };
  };
})(typeof window !== 'undefined' ? window : globalThis);
