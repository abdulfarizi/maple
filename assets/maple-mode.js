/* M-ID · light / dark mode (v3).
 * Loaded first in <head>, so the right palette is on the page before anything paints (no flash).
 * Choice order: the person's saved pick → the device setting.
 *
 * Switching is ONE atomic swap:
 *   · the new palette is applied in a single style pass with every transition switched off, so nothing
 *     fades half-way and nothing flickers (the Studio used to flicker because ~hundreds of elements
 *     transitioned on different clocks, and because touching <html style> re-seeded the leaf canvas);
 *   · the swap is wrapped in a View Transition, and the new look is revealed as a circle that grows
 *     out of the button that was tapped. Browsers without View Transitions, and reduced-motion, swap instantly.
 *   · same-origin frames (card preview, owner card) are repainted inside the same swap, so they never lag behind.
 * Inside a frame, the switch hands the job to the top page so the whole screen animates together. */
(function () {
  'use strict';
  var KEY = 'maple-mode', root = document.documentElement;
  var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var COLORS = { dark: '#0f0d0e', light: '#faf6f2' };

  /* "lite" = only when the device asks for less motion (reduced-motion or data-saver); the falling leaves run everywhere else */
  var nav = navigator, conn = nav.connection || {};
  var reduceMq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var reduce = !!(reduceMq && reduceMq.matches);
  window.__mapleLite = !!(reduce || conn.saveData);
  if (window.__mapleLite) root.setAttribute('data-lite', '');

  function read() { try { var s = localStorage.getItem(KEY); return s === 'light' || s === 'dark' ? s : ''; } catch (e) { return ''; } }
  function current() { return read() || (mq && mq.matches ? 'dark' : 'light'); }
  function store(mode) { try { localStorage.setItem(KEY, mode); } catch (e) {} }

  /* the top page owns the animation; a frame asks it to run (same-origin only) */
  function topHost() {
    try { if (window.parent !== window && window.parent.mapleMode && window.parent.location.origin === location.origin) return window.parent; } catch (e) {}
    return null;
  }

  function buttons() { return document.querySelectorAll('.mode-switch'); }
  function paintButtons(mode) {
    var dark = mode === 'dark';
    [].forEach.call(buttons(), function (b) {
      b.setAttribute('aria-pressed', String(dark));
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      b.title = dark ? 'Light mode' : 'Dark mode';
    });
  }
  /* only data-mode is written (colour-scheme comes from CSS): touching <html style> would wake every
     MutationObserver that watches it (the leaf canvas re-seeded its colours on each switch = flicker) */
  function paint(mode) {
    root.setAttribute('data-mode', mode);
    var m = document.querySelector('meta[name="theme-color"]');
    if (!m && document.head) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
    if (m) m.setAttribute('content', COLORS[mode]);
    paintButtons(mode);
    paintFrames(mode);
  }
  function paintFrames(mode) {
    var fs = document.getElementsByTagName('iframe');
    for (var i = 0; i < fs.length; i++) {
      try {
        var w = fs[i].contentWindow, d = fs[i].contentDocument;
        if (w && w.mapleMode && w.mapleMode.sync) w.mapleMode.sync(mode);
        else if (d && d.documentElement) d.documentElement.setAttribute('data-mode', mode);
      } catch (e) { /* cross-origin frame: leave it */ }
    }
  }
  function announce(mode) { try { window.dispatchEvent(new CustomEvent('maple:mode', { detail: mode })); } catch (e) {} }

  /* one swap with every transition off; the class is dropped two frames later (the colours are already final then) */
  function swapNow(mode) {
    root.classList.add('mode-swap');
    paint(mode);
    clearTimeout(swapNow.t);
    swapNow.t = setTimeout(function () { requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.remove('mode-swap'); }); }); }, 60);
  }

  function reach(x, y) { return Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y)); }
  var busy = null;
  function set(mode, save, origin) {
    if (root.getAttribute('data-mode') === mode) { if (save) store(mode); return; }
    var animate = origin && !window.__mapleLite && !(reduceMq && reduceMq.matches) && typeof document.startViewTransition === 'function' && !document.hidden;
    if (!animate) { if (save) store(mode); swapNow(mode); announce(mode); return; }
    if (busy) { try { busy.skipTransition(); } catch (e) {} }
    var x = Math.round(origin.x), y = Math.round(origin.y), r = Math.ceil(reach(x, y));
    root.classList.add('mode-vt', 'mode-swap');
    var vt;
    try { vt = document.startViewTransition(function () { paint(mode); if (save) store(mode); }); } catch (e) { root.classList.remove('mode-vt', 'mode-swap'); if (save) store(mode); swapNow(mode); announce(mode); return; }
    busy = vt;
    vt.ready.then(function () {
      try {
        root.animate(
          { clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + r + 'px at ' + x + 'px ' + y + 'px)'] },
          { duration: 620, easing: 'cubic-bezier(.22,.8,.24,1)', pseudoElement: '::view-transition-new(root)' }
        );
      } catch (e) { /* no pseudoElement animation: the browser's default cross-fade runs */ }
    }, function () {});
    var done = function () { if (busy === vt) busy = null; root.classList.remove('mode-vt', 'mode-swap'); announce(mode); };
    vt.finished.then(done, done);
  }

  function originOf(el) {
    if (!el || !el.getBoundingClientRect) return null;
    var r = el.getBoundingClientRect(), o = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    try { /* inside a frame: translate to the top page's coordinates */
      if (window.frameElement && topHost()) { var f = window.frameElement.getBoundingClientRect(); o = { x: f.left + o.x, y: f.top + o.y }; }
    } catch (e) {}
    return o;
  }
  function request(mode, origin) {
    var host = topHost();
    if (host) { host.mapleMode.set(mode, origin); return; }
    set(mode, true, origin);
  }

  paint(current());

  window.mapleMode = {
    get: function () { return root.getAttribute('data-mode'); },
    /* set('dark' | 'light', origin?) — origin {x,y} (viewport px) makes the circle grow from there */
    set: function (m, origin) { request(m === 'dark' ? 'dark' : 'light', origin || null); },
    toggle: function (origin) { request(root.getAttribute('data-mode') === 'dark' ? 'light' : 'dark', origin || null); },
    /* used by the top page to repaint a frame inside its own swap; never saves, never animates */
    sync: function (m) { if (m === 'dark' || m === 'light') { if (root.getAttribute('data-mode') !== m) { root.classList.add('mode-swap'); paint(m); announce(m); setTimeout(function () { root.classList.remove('mode-swap'); }, 120); } } }
  };

  /* follow the device until the person picks one; follow other tabs */
  if (mq) { var f = function () { if (!read()) set(mq.matches ? 'dark' : 'light', false); }; mq.addEventListener ? mq.addEventListener('change', f) : mq.addListener(f); }
  window.addEventListener('storage', function (e) { if (e.key === KEY) set(current(), false); });

  /* ---------- the toggle button ---------- */
  var ICON = '<svg class="ms-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" fill="currentColor"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></g></svg>'
    + '<svg class="ms-moon" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a.7.7 0 0 0-.9-.9A9.6 9.6 0 1 0 21.1 15.5a.7.7 0 0 0-.9-.9z"/></svg>';
  function wire(b) {
    if (b.__mw) return; b.__mw = 1;
    if (!b.querySelector('svg')) b.innerHTML = ICON;
    b.classList.add('mode-switch');
    b.addEventListener('click', function () {
      b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
      window.mapleMode.toggle(originOf(b));
    });
    b.addEventListener('animationend', function () { b.classList.remove('pop'); });
    paintButtons(root.getAttribute('data-mode'));
  }
  window.mapleMode.wire = wire;
  function makeBtn(cls) { var b = document.createElement('button'); b.type = 'button'; b.className = 'mode-switch ' + (cls || ''); wire(b); return b; }
  window.mapleMode.button = makeBtn;

  function mount() {
    /* a button the page already carries (the owner card has one in its own header) */
    var own = document.getElementById('mode-btn');
    if (own) { wire(own); return; }
    var tb = document.querySelector('.topbar');
    if (tb && !tb.querySelector('.top-controls')) {
      var acts = document.getElementById('nav-actions'), end = tb.querySelector('.tb-end');
      if (!end) { end = document.createElement('div'); end.className = 'tb-end'; tb.appendChild(end); if (acts) end.appendChild(acts); }
      var b = makeBtn(); b.id = 'mode-btn'; end.appendChild(b);
    }
  }
  function ready() {
    mount();
    var tb = document.querySelector('.topbar');
    if (tb && window.MutationObserver) new MutationObserver(function () { if (!document.getElementById('mode-btn')) mount(); }).observe(tb, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
})();
