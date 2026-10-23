/* Maple ID · per-theme animated backgrounds.
 * Every theme has its own motif (falling maple leaves, rising embers, sakura petals, bubbles, stars …)
 * plus one big shape behind the card. Runs on card pages only (not the home page / Studio).
 * Also applies the per-card look options: card style, frosted-glass amount, animated background on/off. */
(function () {
  var root = document.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- shapes (100×100 grid) ---------- */
  var P = function (d) { return new Path2D(d); };
  var star5 = (function () { var d = ''; for (var i = 0; i < 10; i++) { var r = i % 2 ? 20 : 50, a = -Math.PI / 2 + i * Math.PI / 5; d += (i ? 'L' : 'M') + (50 + r * Math.cos(a)).toFixed(1) + ' ' + (50 + r * Math.sin(a)).toFixed(1); } return d + 'Z'; })();
  var D = {
    leaf: 'M50 2L57 18L64 13L62 34L80 24L76 40L96 36L84 54L90 60L62 70L64 78L53 76L53 98L47 98L47 76L36 78L38 70L10 60L16 54L4 36L24 40L20 24L38 34L36 13L43 18Z',
    veins: 'M50 96V8M50 76L84 46M50 76L16 46M50 62L74 30M50 62L26 30M50 50L66 20M50 50L34 20',
    petal: 'M50 4C78 24 88 60 50 96C12 60 22 24 50 4Z',
    round: 'M50 96C8 72 4 30 50 4C96 30 92 72 50 96Z',
    slim: 'M50 98C36 70 36 30 50 2C64 30 64 70 50 98Z',
    ginkgo: 'M50 96L47 62C20 57 4 32 8 14C25 24 40 22 50 8C60 22 75 24 92 14C96 32 80 57 53 62Z',
    spark: 'M50 0C54 35 65 46 100 50C65 54 54 65 50 100C46 65 35 54 0 50C35 46 46 35 50 0Z',
    star: star5,
    heart: 'M50 92C8 62 -2 34 16 16C31 3 46 13 50 27C54 13 69 3 84 16C102 34 92 62 50 92Z',
    drop: 'M50 0C72 30 92 52 50 100C8 52 28 30 50 0Z',
    snow: 'M50 6V94M12 28L88 72M12 72L88 28M50 22L40 12M50 22L60 12M50 78L40 88M50 78L60 88'
  };

  /* shape: path | circle | rect ; mode: fall | rise | twinkle | wander */
  var FX = {
    maple:    { shape: 'leaf',   mode: 'fall',    n: 26, s: [10, 40], spin: 1, flutter: 1, alpha: 0.5 },
    flame:    { shape: 'drop',   mode: 'rise',    n: 30, s: [6, 20],  flicker: 1, alpha: 0.6, glow: 1 },
    cyber:    { shape: 'rect',   mode: 'fall',    n: 34, s: [3, 9],   streak: 1, alpha: 0.55 },
    emerald:  { shape: 'round',  mode: 'fall',    n: 22, s: [10, 30], spin: 1, flutter: 1, alpha: 0.5 },
    sakura:   { shape: 'petal',  mode: 'fall',    n: 28, s: [8, 24],  spin: 1, flutter: 1, sway: 1, alpha: 0.6 },
    autumn:   { shape: 'ginkgo', mode: 'fall',    n: 22, s: [12, 34], spin: 1, flutter: 1, alpha: 0.55 },
    sunset:   { shape: 'circle', mode: 'rise',    n: 24, s: [8, 34],  alpha: 0.28, soft: 1 },
    crimson:  { shape: 'drop',   mode: 'rise',    n: 26, s: [5, 16],  flicker: 1, alpha: 0.6, glow: 1 },
    gold:     { shape: 'spark',  mode: 'twinkle', n: 30, s: [8, 26],  alpha: 0.85 },
    forest:   { shape: 'circle', mode: 'wander',  n: 22, s: [4, 10],  alpha: 0.85, glow: 1 },
    ocean:    { shape: 'circle', mode: 'rise',    n: 24, s: [8, 30],  ring: 1, alpha: 0.5 },
    violet:   { shape: 'star',   mode: 'twinkle', n: 30, s: [8, 24],  alpha: 0.85 },
    mono:     { shape: 'circle', mode: 'fall',    n: 36, s: [3, 9],   sway: 1, alpha: 0.5 },
    midnight: { shape: 'spark',  mode: 'twinkle', n: 36, s: [5, 18],  alpha: 0.85 },
    ice:      { shape: 'snow',   mode: 'fall',    n: 26, s: [10, 26], spin: 1, stroke: 1, sway: 1, alpha: 0.6 },
    candy:    { shape: 'heart',  mode: 'rise',    n: 22, s: [10, 28], sway: 1, flutter: 0, alpha: 0.55 },
    matcha:   { shape: 'slim',   mode: 'fall',    n: 22, s: [14, 40], spin: 1, flutter: 1, alpha: 0.5 }
  };

  /* ---------- the big shape behind the card ---------- */
  var G = '<defs><linearGradient id="fx-g" x1=".2" y1="0" x2=".8" y2="1"><stop offset="0" style="stop-color:var(--accent-2)"/><stop offset=".5" style="stop-color:var(--accent)"/><stop offset="1" style="stop-color:var(--maple-red,var(--accent))"/></linearGradient></defs>';
  var F = 'fill="url(#fx-g)"', S = 'fill="none" stroke="url(#fx-g)" stroke-linecap="round" stroke-linejoin="round"';
  function rot(path, n, step, tf) { var o = ''; for (var i = 0; i < n; i++) o += '<path d="' + path + '" transform="rotate(' + (i * step) + ' 50 50) ' + tf + '" ' + F + '/>'; return o; }
  var BIG = {
    maple:   { rot: 12, svg: '<path class="b" ' + F + ' d="' + D.leaf + '"/><path class="veins" pathLength="1" d="' + D.veins + '"/>' },
    flame:   { rot: 0,  svg: '<path class="b" ' + F + ' d="M50 2C58 20 82 34 82 62C82 82 68 97 50 97C32 97 18 82 18 62C18 46 30 38 34 26C40 38 46 40 47 32C48 22 46 12 50 2Z"/><path d="M50 52C56 62 66 68 66 80C66 90 58 96 50 96C42 96 34 90 34 80C34 68 44 62 50 52Z" fill="var(--accent-2)" opacity=".55"/>' },
    cyber:   { rot: 0,  svg: '<g ' + S + ' stroke-width="1.4"><path d="M50 4L90 27V73L50 96L10 73V27Z"/><path d="M50 22L74 36V64L50 78L26 64V36Z" opacity=".7"/><path d="M50 4V22M90 27L74 36M90 73L74 64M50 96V78M10 73L26 64M10 27L26 36" opacity=".6"/><path d="M50 40L62 47V58L50 65L38 58V47Z" ' + F + ' stroke="none" opacity=".6"/></g>' },
    emerald: { rot: 0,  svg: rot(D.heart, 4, 90, 'translate(50 50) scale(.5) translate(-50 -92)') + '<path d="M50 52C52 72 56 86 70 96" ' + S + ' stroke-width="3"/>' },
    sakura:  { rot: 0,  svg: rot(D.petal, 5, 72, 'translate(50 50) scale(.52) translate(-50 -96)') + '<circle cx="50" cy="50" r="4" fill="var(--accent-2)"/>' },
    autumn:  { rot: 14, svg: '<path class="b" ' + F + ' d="' + D.ginkgo + '"/><path d="M50 96V30M50 62L26 30M50 62L74 30" fill="none" stroke="#ffd9b0" stroke-opacity=".3" stroke-width=".6"/>' },
    sunset:  { rot: 0,  svg: '<defs><mask id="fx-m"><rect width="100" height="100" fill="#fff"/><rect y="58" width="100" height="3" fill="#000"/><rect y="68" width="100" height="4.5" fill="#000"/><rect y="79" width="100" height="6" fill="#000"/><rect y="91" width="100" height="9" fill="#000"/></mask></defs><circle cx="50" cy="50" r="46" ' + F + ' mask="url(#fx-m)"/>' },
    crimson: { rot: 0,  svg: '<circle cx="50" cy="50" r="42" ' + F + '/><circle cx="50" cy="50" r="47" ' + S + ' stroke-width=".8" opacity=".6"/><circle cx="36" cy="38" r="7" fill="#000" opacity=".16"/><circle cx="62" cy="58" r="10" fill="#000" opacity=".14"/><circle cx="46" cy="68" r="4" fill="#000" opacity=".14"/>' },
    gold:    { rot: 0,  svg: '<path class="b" ' + F + ' d="' + D.spark + '"/><path d="' + D.spark + '" transform="rotate(45 50 50) translate(18 18) scale(.64)" ' + F + ' opacity=".55"/><circle cx="50" cy="50" r="48" ' + S + ' stroke-width=".5" opacity=".5"/>' },
    forest:  { rot: 0,  svg: '<path d="M50 2L74 36H62L84 64H66L92 92H8L34 64H16L38 36H26Z" ' + F + '/><rect x="45" y="90" width="10" height="9" ' + F + '/>' },
    ocean:   { rot: 0,  svg: '<defs><clipPath id="fx-c"><circle cx="50" cy="50" r="44"/></clipPath></defs><circle cx="50" cy="50" r="46" ' + S + ' stroke-width="1"/><g clip-path="url(#fx-c)"><path d="M0 52Q12 44 25 52T50 52T75 52T100 52V100H0Z" ' + F + ' opacity=".9"/><path d="M0 64Q12 56 25 64T50 64T75 64T100 64V100H0Z" fill="var(--accent-2)" opacity=".55"/><path d="M0 76Q12 68 25 76T50 76T75 76T100 76V100H0Z" fill="var(--maple-red,var(--accent))" opacity=".6"/></g>' },
    violet:  { rot: 0,  svg: '<path class="b" ' + F + ' d="M64 4A46 46 0 1 0 96 66A38 38 0 1 1 64 4Z"/><path d="' + D.star + '" transform="translate(66 20) scale(.16)" fill="var(--accent-2)"/><path d="' + D.star + '" transform="translate(78 48) scale(.09)" fill="var(--accent-2)" opacity=".8"/>' },
    mono:    { rot: 0,  svg: '<g ' + S + '><circle cx="50" cy="50" r="46" stroke-width="1"/><circle cx="50" cy="50" r="33" stroke-width=".8" opacity=".7"/><circle cx="50" cy="50" r="20" stroke-width=".6" opacity=".5"/></g><circle cx="50" cy="50" r="5" ' + F + '/>' },
    midnight:{ rot: -18, svg: '<ellipse cx="50" cy="50" rx="48" ry="12" ' + S + ' stroke-width="1.2" opacity=".6" transform="rotate(-20 50 50)"/><circle cx="50" cy="50" r="26" ' + F + '/><ellipse cx="50" cy="50" rx="48" ry="12" ' + S + ' stroke-width="1.6" transform="rotate(-20 50 50)" stroke-dasharray="76 200" stroke-dashoffset="-6"/>' },
    ice:     { rot: 0,  svg: '<g ' + S + ' stroke-width="2.4"><path d="M50 4V96M10 27L90 73M10 73L90 27"/><path d="M50 18L40 8M50 18L60 8M50 82L40 92M50 82L60 92M16 38L8 50M16 38L26 40M84 62L92 50M84 62L74 60M16 62L8 50M16 62L26 60M84 38L92 50M84 38L74 40" stroke-width="1.6"/></g><circle cx="50" cy="50" r="6" ' + F + '/>' },
    candy:   { rot: -8, svg: '<path class="b" ' + F + ' d="' + D.heart + '"/><path d="M26 28C32 22 40 22 44 28" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="3" stroke-linecap="round"/>' },
    matcha:  { rot: 0,  svg: rot(D.slim, 5, 28, 'translate(50 96) scale(.62) translate(-50 -98)').replace(/rotate\((-?\d+) 50 50\)/g, function (m, a) { return 'rotate(' + (a - 56) + ' 50 96)'; }) }
  };

  /* ---------- state ---------- */
  var cv, ctx, big, raf = 0, parts = [], dpr = 1, W = 0, H = 0, palette = [], running = false, theme = '', cfg, paths = {}, tick = 0;

  function onHome() { var p = location.pathname.replace(/\/+$/, '') || '/'; return p === '/' || p === '/studio' || !!document.getElementById('maple-home'); }
  function wanted() {
    var t = root.getAttribute('data-theme');
    return !!FX[t] && root.getAttribute('data-bgfx') !== 'off' && !onHome() && !(document.body && document.body.classList.contains('star-mode'));
  }
  function readPalette() {
    var cs = getComputedStyle(root);
    var a = cs.getPropertyValue('--accent').trim() || '#ff6a3d', b = cs.getPropertyValue('--accent-2').trim() || a, c = cs.getPropertyValue('--maple-red').trim() || a;
    palette = [a, b, c, a];
  }
  function spawn(p, init) {
    var s = cfg.s; p.z = Math.random(); p.s = s[0] + p.z * (s[1] - s[0]);
    p.x = Math.random() * W;
    if (cfg.mode === 'fall') { p.y = init ? Math.random() * H : -p.s * 1.5; p.vy = 0.25 + p.z * 0.75; if (cfg.streak) p.vy = 1.2 + p.z * 2.2; }
    else if (cfg.mode === 'rise') { p.y = init ? Math.random() * H : H + p.s * 1.5; p.vy = -(0.3 + p.z * 0.9); }
    else { p.y = Math.random() * H; p.vy = 0; }
    p.vx = (Math.random() - 0.3) * 0.35; if (cfg.mode === 'wander') { p.vx = (Math.random() - 0.5) * 0.5; p.vy = (Math.random() - 0.5) * 0.5; }
    p.r = cfg.spin ? Math.random() * 6.28 : 0; p.vr = (Math.random() - 0.5) * 0.02;
    p.f = Math.random() * 6.28; p.vf = 0.015 + Math.random() * 0.02;
    p.a = cfg.alpha * (0.4 + Math.random() * 0.6);
    p.c = palette[(Math.random() * palette.length) | 0];
    return p;
  }
  function size() {
    if (!cv) return; dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight; cv.width = W * dpr; cv.height = H * dpr;
    if (reduce) paintStatic();
  }
  function draw(p) {
    var a = p.a;
    if (cfg.mode === 'twinkle') a *= 0.25 + 0.75 * Math.abs(Math.sin(p.f));
    else if (cfg.mode === 'wander') a *= 0.2 + 0.8 * Math.abs(Math.sin(p.f));
    else if (cfg.flicker) a *= 0.7 + 0.3 * Math.sin(p.f * 3);
    ctx.save(); ctx.translate(p.x, p.y); ctx.globalAlpha = a;
    var sh = cfg.shape;
    if (sh === 'circle') {
      var r = p.s / 2;
      if (cfg.glow || cfg.soft) { var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * (cfg.soft ? 1 : 3)); g.addColorStop(0, p.c); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * (cfg.soft ? 1 : 3), 0, 6.283); ctx.fill(); }
      else if (cfg.ring) { ctx.strokeStyle = p.c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke(); ctx.globalAlpha = a * 0.6; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.18, 0, 6.283); ctx.fillStyle = '#fff'; ctx.fill(); }
      else { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); }
    } else if (sh === 'rect') {
      ctx.fillStyle = p.c; if (cfg.streak) { ctx.fillRect(-1, 0, 2, p.s * 5); ctx.globalAlpha = a * 0.35; ctx.fillRect(-1, -p.s * 3, 2, p.s * 3); } else ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s);
    } else {
      ctx.rotate(p.r);
      var sx = cfg.flutter ? (0.35 + 0.65 * Math.abs(Math.cos(p.f))) : 1;
      if (cfg.mode === 'twinkle') { sx = 0.6 + 0.4 * Math.abs(Math.sin(p.f)); }
      ctx.scale((p.s / 100) * sx, p.s / 100); ctx.translate(-50, -50);
      if (cfg.glow) { ctx.shadowColor = p.c; ctx.shadowBlur = 14; }
      if (cfg.stroke) { ctx.strokeStyle = p.c; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(paths[sh]); } else { ctx.fillStyle = p.c; ctx.fill(paths[sh]); }
    }
    ctx.restore();
  }
  function paintStatic() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); parts.forEach(draw); }
  function frame() {
    if (!cv) return;
    if ((++tick & 63) === 0 && !wanted()) { sync(); return; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i]; p.f += p.vf; p.r += p.vr;
      if (cfg.mode === 'twinkle') { /* stays in place */ }
      else if (cfg.mode === 'wander') { p.vx += (Math.random() - 0.5) * 0.06; p.vy += (Math.random() - 0.5) * 0.06; p.vx *= 0.98; p.vy *= 0.98; p.x += p.vx; p.y += p.vy; if (p.x < -20 || p.x > W + 20 || p.y < -20 || p.y > H + 20) spawn(p, false); }
      else {
        p.y += p.vy; p.x += p.vx + ((cfg.flutter || cfg.sway) ? Math.sin(p.y * 0.012 + p.f) * 0.35 : 0);
        if (p.y > H + p.s * 6 || p.y < -p.s * 6 || p.x < -80 || p.x > W + 80) spawn(p, false);
      }
      draw(p);
    }
    raf = requestAnimationFrame(frame);
  }
  function onVis() { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf && cv && !reduce) raf = requestAnimationFrame(frame); }

  function build(t) {
    theme = t; cfg = FX[t];
    ['leaf', 'petal', 'round', 'slim', 'ginkgo', 'spark', 'star', 'heart', 'drop', 'snow'].forEach(function (k) { paths[k] = P(D[k]); });
    paths.leaf = P(D.leaf);
    var b = BIG[t];
    big = document.createElement('div'); big.id = 'fx-big'; big.setAttribute('aria-hidden', 'true');
    big.innerHTML = '<div class="fx-float"><svg viewBox="-6 -6 112 112" style="transform:rotate(' + b.rot + 'deg)">' + G + b.svg + '</svg></div>';
    cv = document.createElement('canvas'); cv.id = 'fx-canvas'; cv.setAttribute('aria-hidden', 'true');
    document.body.insertBefore(cv, document.body.firstChild); document.body.insertBefore(big, document.body.firstChild);
    ctx = cv.getContext('2d'); readPalette(); size();
    var n = Math.round(cfg.n * (W < 700 ? 0.55 : 1));
    parts = Array.from({ length: n }, function () { return spawn({}, true); });
  }
  function start() {
    running = true; root.classList.add('fx-on'); build(root.getAttribute('data-theme'));
    window.addEventListener('resize', size); document.addEventListener('visibilitychange', onVis);
    if (reduce) paintStatic(); else raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return; running = false; root.classList.remove('fx-on');
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('resize', size); document.removeEventListener('visibilitychange', onVis);
    if (cv) cv.remove(); if (big) big.remove(); cv = big = null; parts = []; theme = '';
  }
  function sync() {
    if (!wanted()) return stop();
    var t = root.getAttribute('data-theme');
    if (running && t !== theme) stop();
    if (!running) start(); else { readPalette(); parts.forEach(function (p) { p.c = palette[(Math.random() * palette.length) | 0]; }); if (reduce) paintStatic(); }
  }

  /* per-card look options (card style, frost amount, animated background) */
  window.mapleApply = function (p, el) {
    el = el || root; p = p || {};
    el.setAttribute('data-cstyle', ['outline', 'solid', 'neon', 'bubble', 'tinted'].indexOf(p.cardStyle) > -1 ? p.cardStyle : 'default');
    var gb = Number(p.glassBlur); el.style.setProperty('--gb', isFinite(gb) && p.glassBlur !== undefined && p.glassBlur !== '' ? Math.min(40, Math.max(0, gb)) : 14);
    if (el === root) root.setAttribute('data-bgfx', p.bgFx === false ? 'off' : 'on');
  };

  function boot() {
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme', 'style', 'data-bgfx'] });
    window.addEventListener('popstate', function () { setTimeout(sync, 0); });
    var ps = history.pushState; history.pushState = function () { var r = ps.apply(this, arguments); setTimeout(sync, 0); return r; };
    sync();
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
