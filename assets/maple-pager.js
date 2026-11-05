/* M-ID · one-page shell.
 *
 * Everything is a pane in ONE horizontally-snapping strip that is built once and kept alive:
 *     Home · Explore · [ Card ] · Profile
 * The Card pane sits to the right of Explore. It only exists once someone opens a link (/name); it is
 * then reachable by swiping or from the dock, and it keeps its state (no reload, no reset) until a
 * different card replaces it. The Studio editor opens as a layer over the strip.
 * Every movement uses one JS tween so it animates the same everywhere (iOS Safari < 15.4 has no native
 * smooth scroll, and native smooth scroll fights scroll-snap in Chrome). */
(function () {
  'use strict';
  var ALL = ['home', 'explore', 'card', 'profile'];
  // The dock mirrors the strip: Home · Explore · [ Card ] · Profile. The Card tab only exists while someone's link is open.
  var URLS = { home: '/', explore: '/#explore', profile: '/profile' };
  var TITLES = { home: 'M-ID · one link for every handle', explore: 'Explore · M-ID', profile: 'Profile · M-ID' };
  var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');

  var root, track, appEl, footEl, panes = {}, sections = {}, ro = null;
  var isOn = false, cur = '', cardOn = false, cardSlug = '', cardUrl = '/', cardTitle = 'M-ID', cardLabel = 'Card';
  var full = { card: false, profile: false };
  var raf = 0, settleT = 0, dragging = false, swallow = false;
  var layer, layerMain, layerKind = '', layerTimer = 0;
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var vis = function () { return ALL.filter(function (n) { return n !== 'card' || cardOn; }); };
  var idx = function (n) { return vis().indexOf(n); };
  var width = function () { return track ? track.clientWidth || 1 : 1; };
  var prog = function () { return track ? track.scrollLeft / width() : 0; };
  var dockEl = function () { return document.querySelector('.dock'); };
  var reduced = function () { return !!(REDUCE && REDUCE.matches); };
  var TABS = ['home', 'explore', 'profile'];          // numeric route targets: 0 Home · 1 Explore · 2 Profile (never the Card tab)
  var toName = function (n) { return typeof n === 'number' ? TABS[clamp(n, 0, 2)] : n; };
  var urlOf = function (n) { return n === 'card' ? cardUrl : URLS[n]; };

  /* ───── one tween for every horizontal move ───── */
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var anim = null;
  function stopAnim() { if (anim) { cancelAnimationFrame(anim.id); anim.el.style.scrollSnapType = ''; anim = null; } }
  function tweenLeft(el, to, ms, done) {
    stopAnim();
    var from = el.scrollLeft, dist = to - from;
    if (reduced() || Math.abs(dist) < 1 || ms <= 0) { el.scrollLeft = to; if (done) done(); return; }
    el.style.scrollSnapType = 'none';
    var t0 = 0, a = anim = { el: el, id: 0 };
    function step(now) {
      if (anim !== a) return;
      if (!t0) t0 = now;
      var u = Math.min(1, (now - t0) / ms);
      el.scrollLeft = from + dist * easeOut(u);
      if (u < 1) a.id = requestAnimationFrame(step);
      else { anim = null; el.style.scrollSnapType = ''; el.scrollLeft = to; if (done) done(); }
    }
    a.id = requestAnimationFrame(step);
  }
  ['touchstart', 'wheel', 'pointerdown'].forEach(function (ev) {
    document.addEventListener(ev, function (e) { if (anim && e.target && e.target.closest && e.target.closest('.pager-track')) stopAnim(); }, { passive: true, capture: true });
  });
  window.dgTween = tweenLeft;
  function jump(left) {                       // instant, no snapping fight
    stopAnim(); track.style.scrollSnapType = 'none'; track.scrollLeft = left;
    requestAnimationFrame(function () { track.style.scrollSnapType = ''; });
  }

  function setFullNow(name, on) { full[name] = !!on; if (sections[name]) sections[name].classList.toggle('is-full', !!on); }

  function ensure() {
    if (root) return;
    appEl = document.getElementById('app');
    footEl = document.querySelector('footer.foot');
    root = document.createElement('div'); root.id = 'pager'; root.className = 'pager'; root.hidden = true;
    track = document.createElement('div'); track.className = 'pager-track';
    ALL.forEach(function (n) {
      var sec = document.createElement('section'); sec.className = 'pg'; sec.dataset.pg = n; sec.setAttribute('aria-label', n);
      if (n === 'card') sec.hidden = true;
      var m = document.createElement('main'); m.className = 'pg-main'; m.id = 'pg-' + n;
      sec.appendChild(m); track.appendChild(sec); panes[n] = m; sections[n] = sec;
    });
    root.appendChild(track);
    document.body.insertBefore(root, appEl);
    track.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { if (isOn && cur) track.scrollLeft = idx(cur) * width(); });
    var tb = document.querySelector('.topbar');
    var setTb = function () { if (tb) document.documentElement.style.setProperty('--tb-h', tb.offsetHeight + 'px'); };
    setTb(); if (window.ResizeObserver && tb) { ro = new ResizeObserver(setTb); ro.observe(tb); }
  }
  function ensureLayer() {
    if (layer) return;
    ensure();
    layer = document.createElement('div'); layer.id = 'pg-layer'; layer.className = 'pg-layer'; layer.hidden = true;
    layerMain = document.createElement('main'); layerMain.className = 'pg-layer-main'; layerMain.id = 'pg-layer-main';
    layer.appendChild(layerMain);
    root.parentNode.insertBefore(layer, root.nextSibling);
  }

  /* ───── dock highlight (3 tabs; the card pane lights Explore) ───── */
  function items() { var d = dockEl(); return d ? d.querySelectorAll('.dock-i') : []; }
  var M = { x: [], w: [], key: '' };                   // cached tab geometry: no layout reads while scrolling
  function measure(it) {
    var key = it.length + ':' + (it[0] ? it[0].offsetWidth : 0) + ':' + (dockEl() ? dockEl().offsetWidth : 0);
    if (M.key === key && M.x.length === it.length) return;
    M.key = key; M.x = []; M.w = [];
    for (var i = 0; i < it.length; i++) { M.x.push(it[i].offsetLeft); M.w.push(it[i].offsetWidth); }
    var ind = dockEl() && dockEl().querySelector('.dock-ind'); if (ind) ind.dataset.base = M.w[0] || 84;
  }
  function moveInd(p) {
    var d = dockEl(), ind = d && d.querySelector('.dock-ind'), it = items();
    if (!ind || !it.length) return;
    measure(it);
    var a = clamp(Math.floor(p), 0, it.length - 1), b = Math.min(a + 1, it.length - 1), f = clamp(p - a, 0, 1);
    var x = lerp(M.x[a], M.x[b], f), w = lerp(M.w[a], M.w[b], f), base = +ind.dataset.base || 84;
    ind.style.width = base + 'px';                                         // fixed width: size changes are a scaleX, never a re-layout
    ind.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0) scale(' + (w / base).toFixed(4) + ',1)';
  }
  window.addEventListener('resize', function () { M.key = ''; });
  function dockProg(p) { return clamp(p, 0, vis().length - 1); }      // dock tabs == strip panes, so progress is the same
  function dockToStrip(d) { return clamp(d, 0, vis().length - 1); }   // (for dragging the dock)
  function litDock() { return layerKind === 'studio' ? vis().length - 1 : cur ? Math.max(0, idx(cur)) : 0; }
  function paint() {
    var lit = litDock(), d = dockEl(), ind = d && d.querySelector('.dock-ind');
    items().forEach(function (a, i) {
      var on = i === lit; a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (ind) ind.style.opacity = '';
    document.body.dataset.page = layerKind === 'studio' ? 'profile' : (cur || 'home');
    document.body.classList.toggle('star-mode', !layerKind && !!full[cur]);
  }
  /* the Card tab: sits between Explore and Profile while someone's card is open */
  function syncCardTab() {
    var d = dockEl(); if (!d) return;
    var el = d.querySelector('.dock-i[data-dock="card"]'), want = isOn && cardOn;
    d.classList.toggle('four', want);
    if (!want) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('a'); el.className = 'dock-i'; el.dataset.dock = 'card'; el.setAttribute('data-link', '');
      el.innerHTML = '<i class="fa-solid fa-id-card"></i><span></span>';
      d.insertBefore(el, d.querySelector('.dock-i[data-dock="profile"]'));
    }
    el.setAttribute('href', cardUrl); el.title = cardLabel;
    var sp = el.querySelector('span'); if (sp.textContent !== cardLabel) sp.textContent = cardLabel;
  }
  function decorate() {
    var d = dockEl(); if (!d) return;
    syncCardTab();
    var ind = d.querySelector('.dock-ind');
    if (!isOn) { if (ind) ind.remove(); return; }
    if (!ind) { ind = document.createElement('i'); ind.className = 'dock-ind'; ind.setAttribute('aria-hidden', 'true'); d.insertBefore(ind, d.firstChild); }
    if (!cur) cur = 'home';
    paint(); moveInd(layerKind ? litDock() : (track ? dockProg(prog()) : litDock()));
  }

  /* iframes in the card/profile panes: tell them when they're on screen (the card pauses its music when it isn't) */
  function tellFrames() {
    ['card', 'profile'].forEach(function (n) {
      var on = cur === n && !layerKind;
      panes[n] && panes[n].querySelectorAll('iframe').forEach(function (f) { try { f.contentWindow.postMessage({ maple: 'visible', v: on }, location.origin); } catch (e) {} });
    });
  }
  function setCur(n) {
    if (n === cur) return;
    cur = n; paint(); tellFrames();
    if (window.dgOnPane) try { window.dgOnPane(n); } catch (e) {}
  }

  /* ───── scroll → progress ───── */
  function update() {
    raf = 0;
    var p = prog(), v = vis();
    if (!layerKind) moveInd(dockProg(p));
    var r = clamp(Math.round(p), 0, v.length - 1);
    if (v[r] !== cur && !layerKind) setCur(v[r]);
  }
  function onScroll() {
    if (!raf) raf = requestAnimationFrame(update);
    clearTimeout(settleT); settleT = setTimeout(settle, 120);
  }
  function settle() {
    if (dragging || !isOn || layerKind || anim) return;
    var v = vis(), n = v[clamp(Math.round(prog()), 0, v.length - 1)];
    if (n !== cur) setCur(n);
    document.title = n === 'card' ? cardTitle : TITLES[n];
    var want = urlOf(n), have = location.pathname + location.hash;
    if (want !== have && !(n === 'home' && location.pathname === '/' && !location.hash)) { try { history.replaceState(history.state, '', want); } catch (e) {} }
  }

  function go(name, instant) {
    ensure(); name = toName(name);
    if (idx(name) < 0) return;
    var left = idx(name) * width();
    if (layerKind) { instant = true; }
    if (instant) { jump(left); setCur(name); update(); requestAnimationFrame(settle); }
    else { setCur(name); tweenLeft(track, left, 340, function () { update(); settle(); }); }
  }

  /* ───── the card pane ───── */
  function showCardPane(on) {
    if (cardOn === on) return;
    var keep = cur; cardOn = on; sections.card.hidden = !on;
    if (isOn && keep) jump(idx(keep) * width());     // the strip changed length: stay on the same pane
    if (isOn) decorate();
  }
  function cardOpen(slug) {
    ensure();
    var wasOn = isOn, same = cardOn && cardSlug === slug && panes.card.dataset.ready === '1';
    api.enter();
    if (layerKind) hideLayerNow();
    showCardPane(true);
    cardSlug = slug; cardUrl = location.pathname;
    if (!same) cardLabel = slug;
    if (!same) { panes.card.replaceChildren(); delete panes.card.dataset.ready; setFullNow('card', false); sections.card.scrollTop = 0; }
    go('card', !wasOn || reduced());
    return same ? null : panes.card;
  }
  function cardReset() {
    if (!cardOn) return;
    var leave = cur === 'card';
    panes.card.replaceChildren(); delete panes.card.dataset.ready; cardSlug = ''; setFullNow('card', false);
    if (leave) setCur('explore');
    showCardPane(false);
    if (isOn) { jump(idx(cur || 'home') * width()); paint(); }
  }

  /* ───── the layer (Studio) ───── */
  function hideLayerNow() {
    clearTimeout(layerTimer);
    if (!layer) return;
    layer.classList.remove('in', 'out', 'swap');
    layer.hidden = true; layerMain.replaceChildren(); layerKind = '';
    document.body.classList.remove('has-layer');
    paint(); tellFrames();
  }
  function openLayer(kind) {
    ensureLayer();
    var wasOn = isOn, was = layerKind;
    api.enter(); clearTimeout(layerTimer);
    layerKind = kind; layerMain.replaceChildren();
    layer.hidden = false; layer.scrollTop = 0;
    layer.classList.remove('in', 'out', 'swap');
    document.body.classList.add('has-layer');
    if (!reduced()) {
      if (was) { void layer.offsetWidth; layer.classList.add('swap'); }
      else if (wasOn) { void layer.offsetWidth; layer.classList.add('in'); }
    }
    layerTimer = setTimeout(function () { if (layer) layer.classList.remove('in', 'swap'); }, 420);
    paint(); tellFrames(); moveInd(litDock());
    return layerMain;
  }
  function closeLayer(to) {
    if (!layerKind || !layer) return false;
    var name = to == null ? (cur || 'home') : toName(to);
    stopAnim(); layerKind = '';
    if (idx(name) < 0) name = 'home';
    jump(idx(name) * width()); cur = ''; setCur(name); update(); moveInd(dockProg(prog()));
    document.title = name === 'card' ? cardTitle : TITLES[name];
    clearTimeout(layerTimer);
    if (reduced()) { hideLayerNow(); return true; }
    layer.classList.remove('in', 'swap'); void layer.offsetWidth; layer.classList.add('out');
    layerTimer = setTimeout(hideLayerNow, 300);
    return true;
  }

  /* ───── dragging a finger across the dock ───── */
  var ds = null;
  function dockPos(x) {
    var it = items(); if (it.length < 2) return 0;
    var r0 = it[0].getBoundingClientRect(), r1 = it[it.length - 1].getBoundingClientRect();
    var c0 = r0.left + r0.width / 2, c1 = r1.left + r1.width / 2;
    return clamp((x - c0) / (c1 - c0), 0, 1) * (it.length - 1);
  }
  document.addEventListener('pointerdown', function (e) {
    if (!isOn || !e.target.closest) return;
    var d = e.target.closest('.dock'); if (!d) return;
    ds = { x: e.clientX, id: e.pointerId, moved: false, d: d, p: 0 };
  }, true);
  document.addEventListener('pointermove', function (e) {
    if (!ds || e.pointerId !== ds.id) return;
    if (!ds.moved) {
      if (Math.abs(e.clientX - ds.x) < 8) return;
      ds.moved = true; dragging = true; stopAnim(); track.classList.add('is-dragging');
      try { ds.d.setPointerCapture(ds.id); } catch (x) {}
      ds.d.classList.add('dragging');
    }
    ds.p = dockPos(e.clientX);
    if (layerKind) moveInd(ds.p); else track.scrollLeft = dockToStrip(ds.p) * width();
    e.preventDefault();
  }, { passive: false });
  function endDrag(e) {
    if (!ds || (e && e.pointerId !== ds.id)) return;
    var moved = ds.moved, p = ds.p; ds.d.classList.remove('dragging'); ds = null;
    if (!moved) return;
    swallow = true; setTimeout(function () { swallow = false; }, 350);
    dragging = false; track.classList.remove('is-dragging');
    var name = toName(Math.round(p));
    if (layerKind) navigate(name); else go(name);
  }
  document.addEventListener('pointerup', endDrag, true);
  document.addEventListener('pointercancel', endDrag, true);

  // from the Studio the dock goes through the router (it rebuilds Profile, asks about unpublished changes, closes the layer)
  function navigate(name) {
    var want = urlOf(name);
    if (window.dgNavigate) window.dgNavigate(want);
    else { closeLayer(name); try { history.pushState(null, '', want); } catch (e) {} }
  }

  document.addEventListener('click', function (e) {
    if (swallow) { e.preventDefault(); e.stopImmediatePropagation(); swallow = false; return; }
    if (!isOn || !e.target.closest) return;
    var a = e.target.closest('.dock-i'); if (!a) return;
    var name = a.dataset.dock; if (vis().indexOf(name) < 0) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (layerKind) navigate(name);
    else if (name === cur) sections[name].scrollTo({ top: 0, behavior: 'smooth' });
    else go(name);
  }, true);

  document.addEventListener('keydown', function (e) {
    if (!isOn || layerKind || e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target; if (t && t.matches && t.matches('input,textarea,select,[contenteditable]')) return;
    var v = vis(), i = v.indexOf(cur);
    if (e.key === 'ArrowRight' && i < v.length - 1) go(v[i + 1]); else if (e.key === 'ArrowLeft' && i > 0) go(v[i - 1]);
  });

  var api = window.dgPager = {
    built: false, sig: '',
    panes: function () { ensure(); return panes; },
    active: function () { return isOn; },
    current: function () { return cur; },
    layered: function () { return !!layerKind; },
    layerKind: function () { return layerKind; },
    layerOpen: openLayer,
    layerClose: closeLayer,
    cardOpen: cardOpen,
    cardReset: cardReset,
    cardSlug: function () { return cardSlug; },
    cardMeta: function (title) {
      panes.card.dataset.ready = '1'; cardTitle = title || cardTitle;
      var nm = String(cardTitle).replace(/\s*\u00b7\s*M-ID\s*$/, '').trim(); if (nm) cardLabel = nm;
      if (cur === 'card' && !layerKind) document.title = cardTitle;
      if (isOn) syncCardTab();
    },
    setFull: function (name, on) { setFullNow(name, on); if (isOn) paint(); },
    go: go,
    decorate: decorate,
    enter: function () {
      ensure();
      if (!isOn) {
        isOn = true; root.hidden = false; appEl.hidden = true; appEl.replaceChildren();
        document.body.classList.add('pager-on');
        setTimeout(function () { document.body.classList.add('pg-anim'); }, 1500);   // fades only after the first paint, never during it
        if (footEl && footEl.parentNode !== sections.home) sections.home.appendChild(footEl);
        if (cur) track.scrollLeft = idx(cur) * width();
      }
      decorate();
    },
    leave: function () {
      if (!isOn) return;
      isOn = false; hideLayerNow(); if (root) root.hidden = true; appEl.hidden = false;
      document.body.classList.remove('pager-on', 'star-mode'); document.body.removeAttribute('data-page');
      var onStudio = location.pathname.replace(/\/+$/, '') === '/studio';
      items().forEach(function (a) { var on = onStudio && a.dataset.dock === 'profile'; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
      if (footEl && appEl.nextSibling !== footEl) appEl.parentNode.insertBefore(footEl, appEl.nextSibling);
      decorate();
    }
  };
})();
