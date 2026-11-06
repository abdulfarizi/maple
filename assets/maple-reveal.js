/* M-ID · scroll reveal.
 * Cards on a star card slide up one by one as their section scrolls into view:
 *   · Anime and Music I like: the cards in the shelf come in one after another
 *   · the mini player and the Audio Player come in as single cards
 *   · Links: each link block comes in as it reaches the screen
 * Runs once per card. Skipped with reduced motion, in the GIF editor and without IntersectionObserver. */
(function () {
  'use strict';
  if (window.MReveal) return;
  var qs = new URLSearchParams(location.search);
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  if (qs.get('gifedit') === '1' || !('IntersectionObserver' in window) || (REDUCE && REDUCE.matches)) { window.MReveal = { scan: function () {} }; return; }
  var STEP = 80, MAX = 8; // ms between cards, cards that get their own delay step
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      show(e.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  function show(group) {
    var items = group.__rv || [];
    items.forEach(function (el) {
      el.classList.add('rv-on');
      // drop the reveal styles when done so hover/press transitions behave as before
      setTimeout(function () { el.classList.remove('rv', 'rv-on'); el.style.removeProperty('--rv-d'); }, 700 + MAX * STEP);
    });
  }

  function arm(group, items) {
    if (group.__rvArmed) return;
    items = items.filter(function (el) { return !el.__rvDone; });
    if (!items.length) return;
    group.__rvArmed = 1; group.__rv = items;
    items.forEach(function (el, i) {
      el.__rvDone = 1;
      el.style.setProperty('--rv-d', Math.min(i, MAX) * STEP + 'ms');
      el.classList.add('rv');
    });
    io.observe(group);
  }

  function scan() {
    var stack = document.getElementById('mx-stack');
    if (stack) {
      stack.querySelectorAll('[data-sk-sec]').forEach(function (sec) {
        arm(sec, Array.prototype.slice.call(sec.querySelectorAll('.sk-track > li')));
      });
      stack.querySelectorAll('[data-sk-player] .sk-ap, [data-sk-mini]').forEach(function (box) { arm(box, [box]); });
    }
    var links = document.getElementById('sections');
    if (links) Array.prototype.forEach.call(links.children, function (c) { arm(c, [c]); });
  }

  var t = 0;
  function soon() { clearTimeout(t); t = setTimeout(scan, 30); }
  function init() {
    scan();
    if (window.MutationObserver) {
      var mo = new MutationObserver(soon);
      ['mx-stack', 'sections'].forEach(function (id) { var el = document.getElementById(id); if (el) mo.observe(el, { childList: true, subtree: id === 'mx-stack' }); });
    }
  }
  window.MReveal = { scan: soon };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
