/* GuitarQuest: shared helpers. Every script attaches to the global GQ namespace
 * (classic scripts, so the app also runs from file:// with no build step). */
(function (G) {
  'use strict';
  const GQ = (G.GQ = G.GQ || {});

  GQ.clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  GQ.median = (a) => {
    if (!a.length) return NaN;
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  GQ.mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);

  // Deterministic PRNG so generated exercises are identical on every device.
  GQ.rng = function (seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  };
  GQ.hash = function (str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };

  // Tiny event emitter
  GQ.Emitter = class {
    constructor() { this._h = {}; }
    on(ev, fn) { (this._h[ev] = this._h[ev] || []).push(fn); return () => this.off(ev, fn); }
    off(ev, fn) { const a = this._h[ev]; if (a) this._h[ev] = a.filter((f) => f !== fn); }
    emit(ev, data) { const a = this._h[ev]; if (a) for (const f of [...a]) { try { f(data); } catch (e) { console.error(e); } } }
  };

  // localStorage wrapper that never throws (private mode, blocked storage, previews)
  GQ.storage = {
    get(k, d) { try { const v = G.localStorage.getItem('gq.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { G.localStorage.setItem('gq.' + k, JSON.stringify(v)); return true; } catch { return false; } },
    del(k) { try { G.localStorage.removeItem('gq.' + k); } catch { /* ignore */ } },
  };

  GQ.today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  GQ.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // DOM helper: h('div.card#x', {onclick}, children...)
  GQ.h = function (sel, attrs, ...kids) {
    const m = sel.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
    const el = document.createElement((m && m[1]) || 'div');
    if (m && m[2]) for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1)); else el.id = part.slice(1);
    }
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k === 'class') { if (v) el.className = (el.className + ' ' + v).trim(); }
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k in el && k !== 'list' && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : String(k));
    return el;
  };

  // Canvas helper: size a canvas to its CSS box at device pixel ratio, return 2d context
  GQ.fitCanvas = function (cv) {
    const dpr = G.devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
    }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w, h };
  };

  GQ.css = (name) => (typeof getComputedStyle === 'function' ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() : '');
})(typeof window !== 'undefined' ? window : globalThis);
