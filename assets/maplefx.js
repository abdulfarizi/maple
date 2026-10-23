/* Maple ID · falling leaves + big maple leaf for the "Maple" theme.
 * Runs on card pages whenever <html data-theme="maple">. The home page has its own leaves, so it is skipped there. */
(function () {
  var LEAF = 'M50 2L57 18L64 13L62 34L80 24L76 40L96 36L84 54L90 60L62 70L64 78L53 76L53 98L47 98L47 76L36 78L38 70L10 60L16 54L4 36L24 40L20 24L38 34L36 13L43 18Z';
  var VEINS = 'M50 96V8M50 76L84 46M50 76L16 46M50 62L74 30M50 62L26 30M50 50L66 20M50 50L34 20';
  var root = document.documentElement, path = new Path2D(LEAF);
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cv, ctx, big, raf = 0, parts = [], dpr = 1, W = 0, H = 0, palette = [], running = false;

  function wanted() { return root.getAttribute('data-theme') === 'maple' && !document.getElementById('maple-home'); }
  function readPalette() {
    var cs = getComputedStyle(root);
    var a = cs.getPropertyValue('--accent').trim() || '#ff6a3d';
    var b = cs.getPropertyValue('--accent-2').trim() || '#ffb547';
    var c = cs.getPropertyValue('--maple-red').trim() || '#e0342f';
    palette = [a, b, c, c];
  }
  function spawn(p, initial) {
    p.z = Math.random(); p.s = 10 + p.z * 30;
    p.x = Math.random() * W; p.y = initial ? Math.random() * H : -p.s * 1.5;
    p.vy = 0.25 + p.z * 0.75; p.vx = (Math.random() - 0.3) * 0.35;
    p.r = Math.random() * 6.28; p.vr = (Math.random() - 0.5) * 0.02;
    p.f = Math.random() * 6.28; p.vf = 0.015 + Math.random() * 0.02;
    p.a = 0.16 + (1 - Math.abs(p.z - 0.55)) * 0.32;
    p.c = palette[(Math.random() * palette.length) | 0];
    return p;
  }
  function size() {
    if (!cv) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    if (reduce) paintStatic();
  }
  function draw(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
    ctx.scale((p.s / 100) * (0.35 + 0.65 * Math.abs(Math.cos(p.f))), p.s / 100);
    ctx.translate(-50, -50); ctx.globalAlpha = p.a; ctx.fillStyle = p.c; ctx.fill(path); ctx.restore();
  }
  function paintStatic() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); parts.forEach(draw); }
  function frame() {
    if (!cv) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.y += p.vy; p.x += p.vx + Math.sin(p.y * 0.012 + p.f) * 0.35; p.r += p.vr; p.f += p.vf;
      if (p.y > H + p.s * 1.5 || p.x < -80 || p.x > W + 80) spawn(p, false);
      draw(p);
    }
    raf = requestAnimationFrame(frame);
  }
  function onVis() {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; }
    else if (!raf && cv && !reduce) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return; running = true;
    big = document.createElement('div'); big.id = 'maple-bigleaf'; big.setAttribute('aria-hidden', 'true');
    big.innerHTML = '<svg viewBox="0 0 100 100"><defs><linearGradient id="mfx-grad" x1="0.2" y1="0" x2="0.8" y2="1">' +
      '<stop offset="0" style="stop-color:var(--accent-2)"/><stop offset=".45" style="stop-color:var(--accent)"/>' +
      '<stop offset="1" style="stop-color:var(--maple-red,var(--accent))"/></linearGradient></defs>' +
      '<path class="body" d="' + LEAF + '"/><path class="veins" pathLength="1" d="' + VEINS + '"/></svg>';
    cv = document.createElement('canvas'); cv.id = 'maple-fx'; cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild);
    document.body.insertBefore(big, document.body.firstChild);
    ctx = cv.getContext('2d'); readPalette(); size();
    var n = W < 700 ? 14 : 26;
    parts = Array.from({ length: n }, function () { return spawn({}, true); });
    window.addEventListener('resize', size); document.addEventListener('visibilitychange', onVis);
    if (reduce) paintStatic(); else raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return; running = false;
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('resize', size); document.removeEventListener('visibilitychange', onVis);
    if (cv) cv.remove(); if (big) big.remove(); cv = big = null; parts = [];
  }
  function recolor() {
    if (!running) return; readPalette();
    parts.forEach(function (p) { p.c = palette[(Math.random() * palette.length) | 0]; });
    if (reduce) paintStatic();
  }
  function sync() { if (wanted()) { if (!running) start(); else recolor(); } else stop(); }

  function boot() {
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    sync();
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
