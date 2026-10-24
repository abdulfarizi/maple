/* Maple ID · swipe pager.
 * Home / Explore / Profile live side by side in one horizontally-snapping strip.
 * The bottom dock's highlight follows the swipe (progress = scrollLeft / width), and you can
 * also drag a finger across the dock itself to glide between pages. */
(function () {
  'use strict';
  var NAMES = ['home', 'explore', 'profile'];
  var URLS = ['/', '/#explore', '/studio'];
  var TITLES = ['Maple ID · one link for every handle', 'Explore · Maple ID', 'Profile · Maple ID'];

  var root, track, appEl, footEl, panes = {}, sections = [];
  var isOn = false, cur = -1, raf = 0, settleT = 0, dragging = false, swallow = false, ro = null;
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var width = function () { return track ? track.clientWidth || 1 : 1; };
  var prog = function () { return track ? track.scrollLeft / width() : 0; };
  var dockEl = function () { return document.querySelector('.dock'); };

  function ensure() {
    if (root) return;
    appEl = document.getElementById('app');
    footEl = document.querySelector('footer.foot');
    root = document.createElement('div'); root.id = 'pager'; root.className = 'pager'; root.hidden = true;
    track = document.createElement('div'); track.className = 'pager-track';
    NAMES.forEach(function (n, i) {
      var sec = document.createElement('section'); sec.className = 'pg'; sec.dataset.pg = n;
      sec.setAttribute('aria-label', n);
      var m = document.createElement('main'); m.className = 'pg-main'; m.id = 'pg-' + n;
      sec.appendChild(m); track.appendChild(sec); panes[n] = m; sections[i] = sec;
    });
    root.appendChild(track);
    document.body.insertBefore(root, appEl);
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { if (isOn && cur >= 0) track.scrollLeft = cur * width(); });
    var tb = document.querySelector('.topbar');
    var setTb = function () { if (tb) document.documentElement.style.setProperty('--tb-h', tb.offsetHeight + 'px'); };
    setTb(); if (window.ResizeObserver && tb) { ro = new ResizeObserver(setTb); ro.observe(tb); }
  }

  /* ───── dock highlight ───── */
  function items() { var d = dockEl(); return d ? d.querySelectorAll('.dock-i') : []; }
  function moveInd(p) {
    var d = dockEl(), ind = d && d.querySelector('.dock-ind'), it = items();
    if (!ind || !it.length) return;
    var a = clamp(Math.floor(p), 0, it.length - 1), b = Math.min(a + 1, it.length - 1), f = clamp(p - a, 0, 1);
    var A = it[a], B = it[b];
    var x = lerp(A.offsetLeft, B.offsetLeft, f), w = lerp(A.offsetWidth, B.offsetWidth, f), s = Math.sin(Math.PI * f);
    ind.style.width = w + 'px';
    ind.style.transform = 'translate3d(' + x + 'px,0,0) scale(' + (1 + 0.14 * s).toFixed(3) + ',' + (1 - 0.06 * s).toFixed(3) + ')';
  }
  function mark(r) {
    cur = r; document.body.dataset.page = NAMES[r];
    items().forEach(function (a) {
      var on = a.dataset.dock === NAMES[r];
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function decorate() {
    var d = dockEl();
    if (!d) return;
    var ind = d.querySelector('.dock-ind');
    if (!isOn) { if (ind) ind.remove(); items().forEach(function (a) { a.classList.remove('on'); a.removeAttribute('aria-current'); }); return; }
    if (!ind) { ind = document.createElement('i'); ind.className = 'dock-ind'; ind.setAttribute('aria-hidden', 'true'); d.insertBefore(ind, d.firstChild); }
    if (cur < 0) cur = 0;
    mark(cur); moveInd(track ? prog() : cur);
  }

  /* ───── scroll → progress ───── */
  function update() {
    raf = 0;
    var p = prog();
    moveInd(p);
    var r = clamp(Math.round(p), 0, NAMES.length - 1);
    if (r !== cur) mark(r);
    sections.forEach(function (s, i) { s.style.setProperty('--d', clamp(Math.abs(p - i), 0, 1).toFixed(3)); });
  }
  function onScroll() {
    if (!raf) raf = requestAnimationFrame(update);
    clearTimeout(settleT); settleT = setTimeout(settle, 120);
  }
  function settle() {
    if (dragging || !isOn) return;
    var r = clamp(Math.round(prog()), 0, NAMES.length - 1);
    if (r !== cur) mark(r);
    document.title = TITLES[r];
    var want = URLS[r], have = location.pathname + location.hash;
    if (want !== have && !(r === 0 && location.pathname === '/' && !location.hash)) { try { history.replaceState(history.state, '', want); } catch (e) {} }
  }

  function go(i, instant) {
    ensure(); i = clamp(i, 0, NAMES.length - 1);
    var left = i * width();
    if (instant) { track.style.scrollSnapType = 'none'; track.scrollLeft = left; requestAnimationFrame(function () { track.style.scrollSnapType = ''; update(); settle(); }); mark(i); moveInd(i); }
    else track.scrollTo({ left: left, behavior: 'smooth' });
  }

  /* ───── dragging a finger across the dock ───── */
  var ds = null;
  function posToProg(x) {
    var it = items(); if (it.length < 2) return 0;
    var r0 = it[0].getBoundingClientRect(), r1 = it[it.length - 1].getBoundingClientRect();
    var c0 = r0.left + r0.width / 2, c1 = r1.left + r1.width / 2;
    return clamp((x - c0) / (c1 - c0), 0, 1) * (it.length - 1);
  }
  document.addEventListener('pointerdown', function (e) {
    if (!isOn || !e.target.closest) return;
    var d = e.target.closest('.dock'); if (!d) return;
    ds = { x: e.clientX, id: e.pointerId, moved: false, d: d };
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!ds || e.pointerId !== ds.id) return;
    if (!ds.moved) {
      if (Math.abs(e.clientX - ds.x) < 8) return;
      ds.moved = true; dragging = true; track.classList.add('is-dragging');
      try { ds.d.setPointerCapture(ds.id); } catch (x) {}
      ds.d.classList.add('dragging');
    }
    track.scrollLeft = posToProg(e.clientX) * width();
    e.preventDefault();
  }, { passive: false });
  function endDrag(e) {
    if (!ds || (e && e.pointerId !== ds.id)) return;
    var moved = ds.moved; ds.d.classList.remove('dragging'); ds = null;
    if (!moved) return;
    swallow = true; setTimeout(function () { swallow = false; }, 350);
    dragging = false; track.classList.remove('is-dragging');
    go(clamp(Math.round(prog()), 0, NAMES.length - 1));
  }
  document.addEventListener('pointerup', endDrag, true);
  document.addEventListener('pointercancel', endDrag, true);

  /* dock taps switch pages without a route change; tapping the current tab scrolls it back to the top */
  document.addEventListener('click', function (e) {
    if (swallow) { e.preventDefault(); e.stopImmediatePropagation(); swallow = false; return; }
    if (!isOn || !e.target.closest) return;
    var a = e.target.closest('.dock-i'); if (!a) return;
    var i = NAMES.indexOf(a.dataset.dock); if (i < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (i === cur) sections[i].scrollTo({ top: 0, behavior: 'smooth' }); else go(i);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!isOn || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target; if (t && t.matches && t.matches('input,textarea,select,[contenteditable]')) return;
    if (e.key === 'ArrowRight') go(cur + 1); else if (e.key === 'ArrowLeft') go(cur - 1);
  });

  window.dgPager = {
    built: false, sig: '',
    panes: function () { ensure(); return panes; },
    active: function () { return isOn; },
    index: function () { return cur; },
    go: go,
    decorate: decorate,
    enter: function () {
      ensure();
      if (!isOn) {
        isOn = true; root.hidden = false; appEl.hidden = true; appEl.replaceChildren();
        document.body.classList.add('pager-on');
        if (footEl && footEl.parentNode !== sections[0]) sections[0].appendChild(footEl);
        if (cur >= 0) track.scrollLeft = cur * width();
      }
      decorate();
    },
    leave: function () {
      if (!isOn) return;
      isOn = false; if (root) root.hidden = true; appEl.hidden = false;
      document.body.classList.remove('pager-on'); document.body.removeAttribute('data-page');
      if (footEl && appEl.nextSibling !== footEl) appEl.parentNode.insertBefore(footEl, appEl.nextSibling);
      decorate();
    }
  };
})();
