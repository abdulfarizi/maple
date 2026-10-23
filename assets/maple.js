/* Maple ID · homepage effects: drifting maple leaves, card tilt, live theme picker.
 * Called from the home render as window.mapleHome.mount(). Cleans itself up when the home page is left. */
(function () {
  var LEAF = 'M50 2L57 18L64 13L62 34L80 24L76 40L96 36L84 54L90 60L62 70L64 78L53 76L53 98L47 98L47 76L36 78L38 70L10 60L16 54L4 36L24 40L20 24L38 34L36 13L43 18Z';
  var path = new Path2D(LEAF);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv, ctx, raf = 0, parts = [], dpr = 1, W = 0, H = 0, palette = [];

  function readPalette() {
    var cs = getComputedStyle(document.documentElement);
    var a = cs.getPropertyValue('--accent').trim() || '#ff6a3d';
    var b = cs.getPropertyValue('--accent-2').trim() || '#ffb547';
    var c = cs.getPropertyValue('--maple-red').trim() || '#e0342f';
    palette = [a, b, c, c];
  }
  function spawn(p, initial) {
    p.z = Math.random();                                   // depth: 0 far … 1 near
    p.s = 10 + p.z * 30;                                   // size in px
    p.x = Math.random() * W;
    p.y = initial ? Math.random() * H : -p.s * 1.5;
    p.vy = 0.25 + p.z * 0.75;
    p.vx = (Math.random() - 0.3) * 0.35;
    p.r = Math.random() * 6.28;
    p.vr = (Math.random() - 0.5) * 0.02;
    p.f = Math.random() * 6.28;                            // flutter phase
    p.vf = 0.015 + Math.random() * 0.02;
    p.a = 0.14 + (1 - Math.abs(p.z - 0.55)) * 0.3;
    p.c = palette[(Math.random() * palette.length) | 0];
    return p;
  }
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
  }
  function draw(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.r);
    ctx.scale((p.s / 100) * (0.35 + 0.65 * Math.abs(Math.cos(p.f))), p.s / 100);
    ctx.translate(-50, -50);
    ctx.globalAlpha = p.a;
    ctx.fillStyle = p.c;
    ctx.fill(path);
    ctx.restore();
  }
  function frame() {
    if (!document.getElementById('maple-home')) return teardown();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.y += p.vy; p.x += p.vx + Math.sin(p.y * 0.012 + p.f) * 0.35;
      p.r += p.vr; p.f += p.vf;
      if (p.y > H + p.s * 1.5 || p.x < -80 || p.x > W + 80) spawn(p, false);
      draw(p);
    }
    raf = requestAnimationFrame(frame);
  }
  function onVis() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf && cv && !reduce) raf = requestAnimationFrame(frame);
  }
  function teardown() {
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('resize', size);
    document.removeEventListener('visibilitychange', onVis);
    if (cv) { cv.remove(); cv = null; }
    parts = [];
  }

  function recolor() {
    readPalette();
    parts.forEach(function (p) { p.c = palette[(Math.random() * palette.length) | 0]; });
    if (reduce && cv) paintStatic();
  }
  function paintStatic() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    parts.forEach(draw);
  }

  function leaves() {
    if (cv) teardown();
    cv = document.createElement('canvas');
    cv.id = 'maple-canvas'; cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);
    ctx = cv.getContext('2d');
    readPalette(); size();
    var n = W < 700 ? 14 : 28;
    parts = Array.from({ length: n }, function () { return spawn({}, true); });
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', onVis);
    if (reduce) paintStatic(); else raf = requestAnimationFrame(frame);
  }

  function tilt() {
    var stage = document.querySelector('.stage'), card = document.querySelector('.hero-card');
    if (!stage || !card || reduce || !window.matchMedia('(hover:hover)').matches) return;
    stage.addEventListener('pointermove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', (x * 9).toFixed(2) + 'deg');
      card.style.setProperty('--rx', (-y * 7).toFixed(2) + 'deg');
    });
    stage.addEventListener('pointerleave', function () {
      card.style.setProperty('--ry', '0deg'); card.style.setProperty('--rx', '0deg');
    });
  }

  function themes() {
    var box = document.querySelector('.theme-pick');
    if (!box) return;
    var set = function (t) {
      document.documentElement.dataset.theme = t;
      document.querySelectorAll('.hero-card .idcard').forEach(function (c) { c.dataset.theme = t; });
      box.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.t === t)); });
      recolor();
    };
    box.querySelectorAll('button').forEach(function (b) { b.addEventListener('click', function () { set(b.dataset.t); }); });
  }

  window.mapleHome = {
    mount: function () { leaves(); tilt(); themes(); }
  };
})();
