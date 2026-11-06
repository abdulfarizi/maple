/* M-ID · section rail.
 * A slim column of dots on the right edge of a star card. One dot per section (Profile, Anime, Audio Player,
 * Music I like, Links). The dot of the section you're looking at stretches into a pill and slides as you scroll;
 * tap a dot to glide to that section. Scrolling also settles gently on the nearest section. */
(function () {
  'use strict';
  if (window.MRail) return;
  var qs = new URLSearchParams(location.search);
  // Studio preview sizes the frame to the whole card (no inner scrolling), and the GIF editor needs the edge
  if (qs.get('preview') === '1' || qs.get('gifedit') === '1') { window.MRail = { refresh: function () {} }; return; }
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
  var DEFS = [
    { key: 'card', label: 'Profile', sel: '#shell > .panel' },
    { key: 'anime', label: 'Anime', sel: '#mx-stack [data-sk-sec="anime"]' },
    { key: 'player', label: 'Audio player', sel: '#mx-stack [data-sk-player]' },
    { key: 'music', label: 'Music I like', sel: '#mx-stack [data-sk-sec="music"]' },
    { key: 'links', label: 'Links', sel: '#pager', need: '#sections > *' }
  ];
  var rail = null, items = [], cur = -1, raf = 0, ro = null, sig = '';

  function shown(el) { return !!(el && !el.hidden && el.offsetParent !== null && el.offsetHeight > 24); }
  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

  function collect() {
    var out = [];
    DEFS.forEach(function (d) {
      var el = document.querySelector(d.sel);
      if (!shown(el)) return;
      if (d.need && !document.querySelector(d.need)) return;
      out.push({ key: d.key, label: d.label, el: el });
    });
    out.sort(function (a, b) { return docTop(a.el) - docTop(b.el); });
    return out;
  }

  function build() {
    if (!rail) {
      rail = document.createElement('nav');
      rail.className = 'sec-rail';
      rail.setAttribute('aria-label', 'Sections');
      rail.addEventListener('click', function (e) {
        var b = e.target.closest('button[data-i]'); if (!b) return;
        go(Number(b.dataset.i));
      });
      document.body.appendChild(rail);
    }
    rail.innerHTML = items.map(function (it, i) {
      return '<button type="button" data-i="' + i + '" aria-label="Go to ' + it.label + '"><i></i></button>';
    }).join('');
    cur = -1;
  }

  function fit(it, i) {
    // the first section snaps to the very top of the page, so loading the card never nudges the scroll
    if (i === 0) { it.el.style.scrollSnapAlign = 'start'; it.el.style.scrollMarginTop = Math.ceil(docTop(it.el)) + 'px'; return; }
    // short sections settle in the middle of the screen, tall ones at their top edge
    var short = it.el.offsetHeight < window.innerHeight - 80;
    it.el.style.scrollSnapAlign = short ? 'center' : 'start';
    it.el.style.scrollMarginTop = short ? '' : '16px';
  }

  function refresh() {
    var next = collect();
    var s = next.map(function (it) { return it.key; }).join('|');
    var shell = document.getElementById('shell');
    var on = next.length > 1 && shell && !shell.hidden && !document.documentElement.classList.contains('gedit');
    items.forEach(function (it) { if (next.indexOf(it) < 0) { it.el.style.scrollSnapAlign = ''; it.el.style.scrollMarginTop = ''; } });
    if (s !== sig || !rail) { items = next; sig = s; build(); } else items = next;
    items.forEach(fit);
    rail.hidden = !on;
    document.documentElement.classList.toggle('rail-on', !!on);
    if (ro) { ro.disconnect(); items.forEach(function (it) { ro.observe(it.el); }); }
    paint();
  }

  function activeIndex() {
    if (!items.length) return -1;
    var vh = window.innerHeight, mid = window.scrollY + vh * 0.5;
    if (window.scrollY + vh >= document.documentElement.scrollHeight - 4) return items.length - 1;
    var best = 0, bestD = Infinity;
    items.forEach(function (it, i) {
      var r = it.el.getBoundingClientRect(), top = r.top + window.scrollY, bot = top + r.height;
      var d = mid < top ? top - mid : mid > bot ? mid - bot : 0;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function paint() {
    raf = 0;
    if (!rail || rail.hidden) return;
    var i = activeIndex();
    if (i === cur) return;
    cur = i;
    Array.prototype.forEach.call(rail.children, function (b, k) {
      b.classList.toggle('on', k === i);
      if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }

  function go(i) {
    var it = items[i]; if (!it) return;
    var r = it.el.getBoundingClientRect(), vh = window.innerHeight;
    var off = r.height < vh - 80 ? (vh - r.height) / 2 : 16;
    window.scrollTo({ top: Math.max(0, r.top + window.scrollY - off), behavior: REDUCE && REDUCE.matches ? 'auto' : 'smooth' });
  }

  function onScroll() { if (!raf) raf = requestAnimationFrame(paint); }

  var refreshT = 0;
  function soon() { clearTimeout(refreshT); refreshT = setTimeout(refresh, 60); }

  function init() {
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', soon);
    if (window.ResizeObserver) ro = new ResizeObserver(soon);
    if (window.MutationObserver) {
      var mo = new MutationObserver(soon);
      ['mx-stack', 'sections', 'shell'].forEach(function (id) {
        var el = document.getElementById(id);
        if (!el) return;
        var o = { childList: true };
        if (id !== 'sections') o.attributeFilter = ['hidden'];
        mo.observe(el, o);
      });
    }
    refresh();
    window.addEventListener('load', soon);
  }

  window.MRail = { refresh: soon };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
