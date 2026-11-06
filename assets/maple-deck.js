/* M-ID · "Sections" layout (v35, halo.rip-style slides)
 * One full-screen slide per section: Profile · Anime · Audio Player · Music · Games · Socials · Shop.
 * Only the current slide is shown; the others are blurred out. A dot slider on the middle right
 * jumps between them, and the wheel, swipes and arrow keys move one slide at a time.
 *
 * The app renders its normal card first (same data, same buttons), then calls window.dgDeck(root, profile).
 * Elements the app has already wired (copy tiles, shop buttons) are moved, not copied, so they keep working;
 * buttons the app wires afterwards (like, react, save contact, copy, QR, share) keep their data-act hooks.
 * Audio is always played by the M-ID bottom player (window.MaplePlayer). */
(function () {
  'use strict';
  if (window.dgDeck) return;
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var NAMES = { profile: 'Profile', anime: 'Anime', player: 'Audio Player', music: 'Music', games: 'Games', socials: 'Socials', shop: 'Shop' };
  function artOk(u) { return !!u && (window.MX ? MX.artOk(u) : /^https:\/\//.test(u)); }
  function fmt(ms) { ms = Math.max(0, ms | 0); var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function first(s) { return esc((String(s || '?').trim()[0] || '?').toUpperCase()); }
  function take(n) { if (n && n.parentNode) n.parentNode.removeChild(n); return n || null; }
  function chunk(a, n) { var o = []; for (var i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; }

  function mainSong(p) {
    if (p.music === false) return null;
    if (p.song && p.song.audio) return { audio: p.song.audio, url: p.song.audio, title: p.song.title || 'Untitled', artist: p.song.artist || '', art: p.song.art || '', durationMs: p.song.durationMs || 0, note: p.song.note || '' };
    var sp = window.MX && (MX.spotify(p.spotify) || (MX.youtube && MX.youtube(p.spotify)));
    return sp ? { url: sp.url, title: '', artist: '', art: '', durationMs: 0, type: sp.type, note: '' } : null;
  }

  function slide(key, inner, head) {
    return '<section class="dk-slide dk-s-' + key + '" data-dk="' + key + '" aria-label="' + esc(NAMES[key]) + '"><div class="dk-in">'
      + (head ? '<header class="dk-head dk-item" style="--i:0"><h2>' + esc(head.title) + '</h2>' + (head.sub ? '<p>' + esc(head.sub) + '</p>' : '') + '</header>' : '')
      + inner + '</div></section>';
  }
  /* a paged carousel: n items per page, ◂ ••• ▸ under it */
  function carousel(kind, pages) {
    return '<div class="dk-car dk-item" style="--i:1" data-dk-car>'
      + '<div class="dk-track" data-dk-track tabindex="-1">' + pages.map(function (pg) { return '<div class="dk-page-' + kind + ' dk-pg">' + pg + '</div>'; }).join('') + '</div>'
      + (pages.length > 1 ? '<div class="dk-pager"><button type="button" data-dk-pg="-1" aria-label="Previous page"><i class="fa-solid fa-caret-left"></i></button>'
        + '<span class="dk-pdots">' + pages.map(function (_, i) { return '<button type="button" data-dk-pgto="' + i + '" aria-label="Page ' + (i + 1) + '"' + (i ? '' : ' aria-current="true"') + '></button>'; }).join('') + '</span>'
        + '<button type="button" data-dk-pg="1" aria-label="Next page"><i class="fa-solid fa-caret-right"></i></button></div>' : '')
      + '</div>';
  }
  function animeCard(x) {
    var cover = x.cover && artOk(x.cover) ? '<img src="' + esc(x.cover) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '';
    var score = x.rating > 0 ? (Math.round(x.rating * 2) / 2).toFixed(1) : x.score ? (x.score / 10).toFixed(1) : '';
    var fmtx = x.format ? String(x.format).replace(/_/g, ' ') : '';
    if (fmtx.length > 6) fmtx = fmtx.slice(0, 5);
    return '<article class="dk-ani" tabindex="0" aria-label="' + esc(x.title) + '">'
      + '<span class="dk-poster"><span class="dk-ph">' + first(x.title) + '</span>' + cover + '</span>'
      + '<span class="dk-ainfo"><b>' + esc(x.title) + '</b><span class="dk-arow">'
      + (score ? '<span class="dk-star"><i class="fa-solid fa-star"></i>' + score + '</span>' : '')
      + (x.year ? '<span>' + esc(x.year) + '</span>' : '') + (fmtx ? '<em>' + esc(fmtx) + '</em>' : '') + '</span></span></article>';
  }
  function musicCard(x, i) {
    var art = x.art && artOk(x.art) ? '<img src="' + esc(x.art) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '';
    var sub = x.artist || (x.audio ? 'Uploaded' : /youtube\.com/.test(x.url || '') ? 'YouTube' : /\/album\//.test(x.url) ? 'Album' : /\/playlist\//.test(x.url) ? 'Playlist' : 'Spotify');
    return '<button type="button" class="dk-mus" data-dk-play="' + i + '" aria-label="Play ' + esc(x.title || 'song') + '">'
      + '<span class="dk-cover"' + (art || !x.url || x.audio ? '' : ' data-fill-url="' + esc(x.url) + '"') + '><span class="dk-ph">' + first(x.title) + '</span>' + art + '<span class="dk-hover"><i class="fa-solid fa-play"></i></span></span>'
      + '<b>' + esc(x.title || 'Untitled') + '</b><small>' + esc(sub) + '</small></button>';
  }
  /* compact player: cover · title/artist · ⏮ ⏯ ⏭ · time ─●─ time */
  function playerRow(t, preview, big) {
    var art = t.art && artOk(t.art) ? '<img src="' + esc(t.art) + '" alt="" decoding="async" onerror="this.remove()">' : '';
    var dis = preview ? ' disabled' : '';
    return '<div class="dk-prow' + (big ? ' dk-prow-big' : '') + '">'
      + '<span class="dk-sart" data-dk-art aria-hidden="true"><span class="dk-ph"><i class="fa-solid fa-music"></i></span>' + art + '</span>'
      + '<div class="dk-pinfo"><b><span data-dk-st>' + esc(t.title || 'Loading…') + '</span>' + (big ? '<i class="dk-eq" aria-hidden="true"><i></i><i></i><i></i></i>' : '') + '</b>'
      + '<small data-dk-sa>' + esc(t.artist) + '</small>'
      + '<div class="dk-ctl"><button type="button" data-dk-song="back" aria-label="Back 10 seconds"' + dis + '><i class="fa-solid fa-backward-step"></i></button>'
      + '<button type="button" class="dk-pp" data-dk-song="toggle" aria-label="Play"' + dis + '><i class="fa-solid fa-play"></i></button>'
      + '<button type="button" data-dk-song="fwd" aria-label="Forward 10 seconds"' + dis + '><i class="fa-solid fa-forward-step"></i></button>'
      + '<span class="dk-tm" data-dk-pos>0:00</span><span class="dk-bar" aria-hidden="true"><i data-dk-fill></i><b data-dk-knob></b></span><span class="dk-tm" data-dk-dur>' + (t.durationMs ? fmt(t.durationMs) : '--:--') + '</span></div>'
      + '</div></div>';
  }

  /* ── the theme's own motif (leaves, embers, petals, stars…) drawn inside the deck background.
   * Same shapes and movement as the page-wide theme background (maplefx.js), plus a little rush in the
   * direction you move when changing slides. Still picture when "Animated theme background" is off or
   * the visitor prefers reduced motion. ── */
  function fxStart(deck, p, preview) {
    var cv = deck.querySelector('.dk-fx'); if (!cv || !cv.getContext) return null;
    var ctx = cv.getContext('2d'), still = p.bgFx === false || REDUCE.matches || !!window.__mapleLite;
    var cfg, paths = {}, parts = [], W = 1, H = 1, dpr = 1, raf = 0, flip = 0, boost = 0, alive = true, palette = [], theme = '', tries = 0, ro = null, mo = null;
    function readPalette() {
      var cs = getComputedStyle(deck), a = cs.getPropertyValue('--accent').trim() || '#e87fa0', b = cs.getPropertyValue('--accent-2').trim() || a, c = cs.getPropertyValue('--maple-red').trim() || a;
      palette = [a, b, c, a, '#ffffff'];
    }
    function spawn(q, init) {
      var s = cfg.s; q.z = Math.random(); q.s = s[0] + q.z * (s[1] - s[0]); q.x = Math.random() * W;
      if (cfg.mode === 'fall') { q.y = init ? Math.random() * H : -q.s * 1.5; q.vy = 0.25 + q.z * 0.75; if (cfg.streak) q.vy = 1.2 + q.z * 2.2; }
      else if (cfg.mode === 'rise') { q.y = init ? Math.random() * H : H + q.s * 1.5; q.vy = -(0.3 + q.z * 0.9); }
      else { q.y = Math.random() * H; q.vy = 0; }
      q.vx = (Math.random() - 0.3) * 0.35; if (cfg.mode === 'wander') { q.vx = (Math.random() - 0.5) * 0.5; q.vy = (Math.random() - 0.5) * 0.5; }
      q.r = cfg.spin ? Math.random() * 6.28 : 0; q.vr = (Math.random() - 0.5) * 0.02; q.f = Math.random() * 6.28; q.vf = 0.015 + Math.random() * 0.02;
      q.a = cfg.alpha * (0.4 + Math.random() * 0.6); q.c = palette[(Math.random() * (palette.length - (Math.random() < .2 ? 0 : 1))) | 0];
      return q;
    }
    function draw(q) {
      var a = q.a;
      if (cfg.mode === 'twinkle') a *= 0.25 + 0.75 * Math.abs(Math.sin(q.f)); else if (cfg.mode === 'wander') a *= 0.2 + 0.8 * Math.abs(Math.sin(q.f)); else if (cfg.flicker) a *= 0.7 + 0.3 * Math.sin(q.f * 3);
      ctx.save(); ctx.translate(q.x, q.y); ctx.globalAlpha = Math.max(0, Math.min(1, a));
      var sh = cfg.shape;
      if (sh === 'circle') {
        var r = q.s / 2;
        if (cfg.glow || cfg.soft) { var rr = r * (cfg.soft ? 1 : 3), g = ctx.createRadialGradient(0, 0, 0, 0, 0, rr); g.addColorStop(0, q.c); g.addColorStop(1, 'transparent'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rr, 0, 6.283); ctx.fill(); }
        else if (cfg.ring) { ctx.strokeStyle = q.c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.stroke(); }
        else { ctx.fillStyle = q.c; ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.283); ctx.fill(); }
      } else if (sh === 'rect') {
        ctx.fillStyle = q.c; if (cfg.streak) ctx.fillRect(-1, 0, 2, q.s * 5); else ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s);
      } else if (paths[sh]) {
        ctx.rotate(q.r);
        var sx = cfg.flutter ? (0.35 + 0.65 * Math.abs(Math.cos(q.f))) : 1; if (cfg.mode === 'twinkle') sx = 0.6 + 0.4 * Math.abs(Math.sin(q.f));
        ctx.scale((q.s / 100) * sx, q.s / 100); ctx.translate(-50, -50);
        if (cfg.stroke) { ctx.strokeStyle = q.c; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.stroke(paths[sh]); } else { ctx.fillStyle = q.c; ctx.fill(paths[sh]); }
      }
      ctx.restore();
    }
    function paint() { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H); for (var i = 0; i < parts.length; i++) draw(parts[i]); }
    function size() { var r = cv.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); if (cfg && still) paint(); }
    function frame() {
      raf = 0; if (!alive) return;
      if (!document.body.contains(cv)) { api.stop(); return; }
      raf = requestAnimationFrame(frame);
      if ((flip ^= 1)) return;                       // 30 fps is plenty for a background
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      boost *= 0.94;
      for (var i = 0; i < parts.length; i++) {
        var q = parts[i]; q.f += q.vf; q.r += q.vr;
        if (cfg.mode === 'wander') { q.vx += (Math.random() - 0.5) * 0.06; q.vy += (Math.random() - 0.5) * 0.06; q.vx *= 0.98; q.vy *= 0.98; q.x += q.vx; q.y += q.vy - boost * (0.4 + q.z); }
        else if (cfg.mode === 'twinkle') { q.y -= boost * (0.4 + q.z); }
        else { q.y += q.vy - boost * (0.4 + q.z); q.x += q.vx + ((cfg.flutter || cfg.sway) ? Math.sin(q.y * 0.012 + q.f) * 0.35 : 0); }
        if (q.y < -q.s * 6) { if (boost > 0.3 || cfg.mode !== 'rise') { spawn(q, true); q.y = H + q.s; } else spawn(q, false); }
        else if (q.y > H + q.s * 6) { spawn(q, true); q.y = -q.s; }
        else if (q.x < -80 || q.x > W + 80) spawn(q, false);
        draw(q);
      }
    }
    function build() {
      var F = window.mapleFxData;
      if (!F) { if (tries++ < 25 && alive) setTimeout(build, 200); return; }
      if (!document.body.contains(cv) && !preview) { if (tries++ < 25 && alive) setTimeout(build, 200); return; }
      theme = (deck.closest('[data-theme]') || document.documentElement).getAttribute('data-theme') || p.theme || '';
      cfg = F.FX[theme] || { shape: 'circle', mode: 'wander', n: 22, s: [3, 9], alpha: 0.8, glow: 1 };
      Object.keys(F.D).forEach(function (k) { paths[k] = new Path2D(F.D[k]); });
      readPalette(); size();
      var n = Math.round(cfg.n * (W < 700 ? 0.45 : 0.65) * (deck.dataset.bg === 'theme' ? 1 : 0.7));
      parts = []; for (var i = 0; i < n; i++) parts.push(spawn({}, true));
      if (still) paint(); else if (!raf) raf = requestAnimationFrame(frame);
    }
    var api = {
      kick: function (dir) { if (!still) boost = Math.max(-9, Math.min(9, boost + dir * 7)); },
      stop: function () { alive = false; cancelAnimationFrame(raf); raf = 0; if (ro) ro.disconnect(); if (mo) mo.disconnect(); }
    };
    if (window.ResizeObserver) { ro = new ResizeObserver(function () { if (cfg) size(); }); ro.observe(cv); }
    // visitors can switch the theme on the card: follow it
    if (!preview && window.MutationObserver) mo = new MutationObserver(function () {
      var t = document.documentElement.getAttribute('data-theme');
      if (t && t !== theme && cfg) { build(); var bs = deck.querySelector('.dk-bigshape'), F = window.mapleFxData, b = F && F.BIG[t];
        if (bs && b) { var gid = 'dk-g' + Math.random().toString(36).slice(2, 7); bs.innerHTML = '<svg viewBox="-6 -6 112 112" style="transform:rotate(' + b.rot + 'deg)">' + (F.G + b.svg).split('fx-g').join(gid) + '</svg>'; } }
      else if (cfg) { readPalette(); parts.forEach(function (q) { q.c = palette[(Math.random() * palette.length) | 0]; }); if (still) paint(); }
    });
    if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    requestAnimationFrame(build);
    return api;
  }

  /* ── v36-9 · opening: the hollow-star zoom (same look as the card intro), plays by itself, nothing to press ── */
  function starZoom(host, accent, done) {
    var W = host.clientWidth || window.innerWidth, H = host.clientHeight || window.innerHeight, cx = W / 2, cy = H / 2;
    var bg = (getComputedStyle(document.documentElement).getPropertyValue('--bg') || '').trim() || '#0f0d0e';
    var NS = 'http://www.w3.org/2000/svg', ov = document.createElement('div');
    ov.className = 'dk-starzoom'; ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" style="display:block">'
      + '<defs><mask id="dk-sz-mask"><rect width="' + W + '" height="' + H + '" fill="#fff"/><path id="dk-sz-hole" fill="#000"/></mask></defs>'
      + '<rect width="' + W + '" height="' + H + '" fill="' + bg + '" mask="url(#dk-sz-mask)"/><path id="dk-sz-ring" fill="none" stroke-linejoin="round"/></svg>';
    host.appendChild(ov);
    var hole = ov.querySelector('#dk-sz-hole'), ring = ov.querySelector('#dk-sz-ring');
    ring.style.stroke = accent; ring.style.filter = 'drop-shadow(0 0 10px ' + accent + ')';
    var base = Math.max(46, Math.min(74, Math.min(W, H) * 0.15)), Rmax = Math.hypot(W, H) / 2 / 0.3 * 1.12;
    var APPEAR = 450, HOLD = 250, ZOOM = 1050, t0 = performance.now(), fin = false;
    function star(R, rot) { var d = ''; for (var i = 0; i < 10; i++) { var r = i % 2 ? R * 0.382 : R, a = -Math.PI / 2 + rot + i * Math.PI / 5; d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1); } return d + 'Z'; }
    var backOut = function (u) { var c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };
    var inOut = function (u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; };
    function end() { if (fin) return; fin = true; ov.remove(); if (done) done(); }
    (function frame(now) {
      if (fin) return;
      if (!document.body.contains(ov)) { fin = true; if (done) done(); return; }
      var t = now - t0, R, rot = 0, ringA = 1, zt = APPEAR + HOLD;
      if (t < APPEAR) { var u0 = t / APPEAR; R = base * backOut(u0); ringA = Math.min(1, u0 * 1.6); }
      else if (t < zt) R = base * (1 + 0.045 * Math.sin((t - APPEAR) / 170));
      else { var u = Math.min(1, (t - zt) / ZOOM), e = inOut(u); R = base * Math.pow(Rmax / base, e); rot = e * Math.PI * 0.8; ringA = 1 - Math.max(0, (u - 0.5) / 0.5); if (u >= 1) return end(); }
      var d = star(R, rot); hole.setAttribute('d', d); ring.setAttribute('d', d);
      ring.setAttribute('stroke-width', (2 + R * 0.012).toFixed(2)); ring.style.opacity = ringA;
      requestAnimationFrame(frame);
    })(t0);
    return end;
  }

  window.dgDeck = function (root, p, opt) {
    opt = opt || {};
    var page = root && root.querySelector('.card-page'); if (!page || !p) return;
    if (page.__dkStop) page.__dkStop();
    var preview = !!opt.preview;
    var card = page.querySelector('.idcard');

    /* ── pieces from the app's own render ── */
    var bannerMedia = card && card.querySelector('.idcard-banner img, .idcard-banner video');
    var avatarInner = card && card.querySelector('.avatar-inner');
    var visits = card && card.querySelector('.visits');
    var like = card && card.querySelector('[data-act="like"]');
    var clock = card && card.querySelector('[data-clock]');
    var tag = card && card.querySelector('.chip-tag');
    var online = !!(card && card.querySelector('.status.on'));
    var actions = take(page.querySelector('.actions'));
    var reactions = take(page.querySelector('.reactions'));
    var lists = { games: null, socials: null };
    page.querySelectorAll('section.list:not(.shop)').forEach(function (sec) {
      var t = (sec.querySelector('h2') && sec.querySelector('h2').textContent || '').trim().toLowerCase();
      var ul = sec.querySelector('ul'); if (!ul) return;
      if (t.indexOf('game') === 0) lists.games = ul; else if (t.indexOf('social') === 0) lists.socials = ul;
    });
    var shop = page.querySelector('section.list.shop');
    var shopUl = shop && shop.querySelector('ul'), shopNote = shop && shop.querySelector('.shop-note');
    var donate = page.querySelector('.widget-section .donate-btn');
    var extras = Array.prototype.slice.call(page.querySelectorAll(':scope > .owner-bar, :scope > .signed-as, :scope > a.btn'));

    var song = mainSong(p), bio = (p.bio || '').trim();
    var place = [p.city, p.country].filter(Boolean).join(', ');

    /* ── 1 · profile: the glass card + the mini player under it ── */
    var prof = '<div class="dk-card dk-main dk-item" style="--i:0">'
      + '<div class="dk-ban" data-dk-slot="banner"><span class="dk-tag" data-dk-slot="tag"></span></div>'
      + '<div class="dk-id"><div class="dk-av"><div data-dk-slot="avatar"></div><i class="dk-dot ' + (online ? 'on' : 'off') + '" title="' + (online ? 'Online' : 'Offline') + '"></i></div>'
      + '<div class="dk-who"><h1>' + esc(p.name || 'Creator') + '</h1>'
      + '<div class="dk-badges"><span><i class="dk-ldot ' + (online ? 'on' : 'off') + '"></i>' + (online ? 'Online' : 'Offline') + '</span><span data-dk-slot="clockw"><i class="fa-regular fa-clock"></i><span data-dk-slot="clock"></span></span></div>'
      + (p.role && p.role.trim() ? '<p class="dk-role">' + esc(p.role.trim()) + '</p>' : '') + '</div></div>'
      + (bio ? '<p class="dk-bio" data-dk-bio aria-label="' + esc(bio) + '"><span aria-hidden="true">' + esc(bio) + '</span></p>' : '')
      + '<div data-dk-slot="socials" class="dk-socials"></div>'
      + '<div data-dk-slot="reactions" class="dk-reacts"></div>'
      + '<div class="dk-foot"><span class="dk-stat" data-dk-slot="visits"><i class="fa-solid fa-eye"></i></span>'
      + (place ? '<span class="dk-stat"><i class="fa-solid fa-location-dot"></i>' + esc(place) + '</span>' : '')
      + '<span class="dk-right"><span data-dk-slot="actions" class="dk-acts"></span><span class="dk-stat" data-dk-slot="like"></span></span></div>'
      + '</div>'
      + (song ? '<div class="dk-card dk-mini dk-item" style="--i:1" data-dk-player>' + playerRow(song, preview, false) + '</div>' : '')
      + '<div data-dk-slot="extras" class="dk-extras dk-item" style="--i:2"></div>';
    var html = slide('profile', prof);

    /* ── 2 · anime: two posters a page ── */
    var anime = window.MX && MX.animeOn(p) ? p.anime : [];
    if (anime.length) html += slide('anime', carousel('ani', chunk(anime, 2).map(function (g) { return g.map(animeCard).join(''); })), { title: p.animeTitle || 'Anime', sub: p.animeSub || 'animes i watched.' });

    /* ── 3 · audio player + lyrics ── */
    if (song) html += slide('player', '<div class="dk-card dk-big dk-item" style="--i:1" data-dk-player>' + playerRow(song, preview, true)
      + '<div class="dk-lyr" data-dk-lyr aria-live="off"><div class="dk-lyr-in" data-dk-lyr-in><p class="dk-lmsg">' + esc(song.note || '♪') + '</p></div></div></div>', { title: 'Audio Player' });

    /* ── 4 · music I like: 2 × 2 a page ── */
    var likes = window.MX && MX.musicOn(p) ? p.musicLikes : [];
    if (likes.length) html += slide('music', carousel('mus', chunk(likes.map(function (x, i) { return musicCard(x, i); }), 4).map(function (g) { return g.join(''); })), { title: p.musicTitle || 'Music I like', sub: p.musicSub || '' });

    /* ── 5 · games, 6 · socials, 7 · shop ── */
    if (lists.games) html += slide('games', '<div class="dk-card dk-list dk-item" style="--i:1" data-dk-slot="games"></div>', { title: 'Games', sub: 'tap an ID to copy it' });
    if (lists.socials) html += slide('socials', '<div class="dk-card dk-list dk-item" style="--i:1" data-dk-slot="sociallist"></div>', { title: 'Socials', sub: 'find me here' });
    if (shopUl || donate) html += slide('shop', '<div class="dk-card dk-list dk-item" style="--i:1"><div data-dk-slot="shopnote"></div><div data-dk-slot="shop"></div><div data-dk-slot="donate"></div></div>', { title: (shopUl && p.shopTitle) || (shopUl ? 'Shop' : 'Support'), sub: '' });

    var key = 'dk:in:' + (p.slug || '');
    var entered = true;                 // v36-9: no "click to enter" gate; the star zoom plays by itself instead

    var deck = document.createElement('div');
    deck.className = 'dk-deck' + (preview ? ' dk-preview' : '') + (entered ? ' dk-on' : '');
    /* background: theme (animated, in the theme's colours) · banner · custom upload */
    var bgMode = p.deckBg === 'custom' && p.deckBgUrl ? 'custom' : p.deckBg === 'banner' && bannerMedia ? 'banner' : 'theme';
    var num = function (v, lo, hi, d) { v = Number(v); return isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    var dim = p.deckDim === undefined || p.deckDim === '' ? 40 : num(p.deckDim, 0, 90, 40);
    var blur = p.deckBlur === undefined || p.deckBlur === '' ? 0 : num(p.deckBlur, 0, 24, 0);
    deck.dataset.bg = bgMode;
    deck.style.setProperty('--dk-dim', String(dim / 100));
    deck.style.setProperty('--dk-blur', blur + 'px');
    if (p.bgFx === false) deck.classList.add('dk-still');
    deck.innerHTML = '<div class="dk-bg" aria-hidden="true"><div class="dk-par"></div><i class="dk-cursor"></i><canvas class="dk-fx"></canvas><i class="dk-dim"></i><i class="dk-vig"></i></div>'
      + '<div class="dk-top">' + (song ? '<button type="button" class="dk-fab" data-dk-song="toggle" aria-label="Play music"' + (preview ? ' disabled' : '') + '><i class="fa-solid fa-volume-xmark"></i></button>' : '') + '</div>'
      + '<div class="dk-stage">' + html + '</div>'
      + '<nav class="dk-dots" aria-label="Profile sections"></nav>'
      + '<div class="dk-count" aria-hidden="true"><b data-dk-num>01</b><span data-dk-total></span><em data-dk-name></em></div>'
      + '<div class="dk-hint" aria-hidden="true"><i></i><span>scroll</span></div>';

    function slot(k, node, wrap) { var s = deck.querySelector('[data-dk-slot="' + k + '"]'); if (!s) return; if (!node) { if (wrap) s.remove(); return; } s.appendChild(take(node)); }
    var par = deck.querySelector('.dk-par');
    function themeBg() {
      deck.dataset.bg = 'theme';
      par.innerHTML = '<i class="dk-blob b1"></i><i class="dk-blob b2"></i><i class="dk-blob b3"></i><div class="dk-bigshape"></div>';
      var F = window.mapleFxData, th = (document.documentElement.getAttribute('data-theme') && !preview ? document.documentElement.getAttribute('data-theme') : p.theme), b = F && F.BIG[th];
      if (!F) { setTimeout(function () { if (deck.dataset.bg === 'theme' && window.mapleFxData && document.body.contains(deck)) themeBg(); }, 400); return; }
      if (b) { var gid = 'dk-g' + Math.random().toString(36).slice(2, 7); par.querySelector('.dk-bigshape').innerHTML = '<svg viewBox="-6 -6 112 112" style="transform:rotate(' + b.rot + 'deg)">' + (F.G + b.svg).split('fx-g').join(gid) + '</svg>'; }
    }
    function playMuted(v) { v.muted = true; v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.loop = true; v.removeAttribute('controls'); var pr = v.play && v.play(); if (pr && pr.catch) pr.catch(function () {}); }
    if (bgMode === 'banner') {
      var bgm = bannerMedia.cloneNode(true); bgm.removeAttribute('id'); par.appendChild(bgm);
      if (bgm.tagName === 'VIDEO') playMuted(bgm);
    } else if (bgMode === 'custom') {
      var cm = document.createElement(p.deckBgKind === 'video' ? 'video' : 'img');
      cm.src = p.deckBgUrl; cm.alt = ''; cm.decoding = 'async';
      cm.addEventListener('error', function () { cm.remove(); themeBg(); });
      par.appendChild(cm); if (cm.tagName === 'VIDEO') playMuted(cm);
    } else themeBg();
    if (bannerMedia) {
      deck.querySelector('[data-dk-slot="banner"]').prepend(take(bannerMedia));
    } else deck.querySelector('[data-dk-slot="banner"]').classList.add('dk-ban-none');
    if (tag && tag.textContent.trim()) deck.querySelector('[data-dk-slot="tag"]').innerHTML = tag.innerHTML; else slot('tag', null, true);
    slot('avatar', avatarInner);
    if (clock) deck.querySelector('[data-dk-slot="clock"]').replaceWith(take(clock)); else slot('clockw', null, true);
    var vs = deck.querySelector('[data-dk-slot="visits"]');
    if (visits) { var vn = visits.querySelector('[data-visits]'); vs.appendChild(take(vn)); vs.title = 'Visits'; take(visits); } else vs.remove();
    slot('like', like, true);
    slot('actions', actions, true); slot('reactions', reactions, true);
    // The full socials list gets its own slide (moved, so the app's copy/open handlers keep working).
    // The profile card keeps a row of round icons: a copy of that list whose taps are forwarded to the real tiles.
    if (lists.socials) {
      var iconRow = lists.socials.cloneNode(true); iconRow.removeAttribute('id');
      var realTiles = lists.socials.querySelectorAll('.tile');
      iconRow.querySelectorAll('.tile').forEach(function (t, i) {
        var b = t.querySelector('.txt b'), s = t.querySelector('.txt small');
        var label = [(b && b.textContent) || '', (s && s.textContent) || ''].filter(Boolean).join(' · ');
        if (label) { t.title = label; t.setAttribute('aria-label', label); }
        t.removeAttribute('id');
        t.addEventListener('click', function (e) {
          var real = realTiles[i]; if (!real) return;
          e.preventDefault(); e.stopPropagation(); real.click();
        });
      });
      iconRow.querySelectorAll('.tile-copy').forEach(function (c) { c.remove(); });
      deck.querySelector('[data-dk-slot="socials"]').appendChild(iconRow);
    } else slot('socials', null, true);
    slot('sociallist', lists.socials);
    slot('games', lists.games);
    slot('shop', shopUl, true); slot('shopnote', shopNote, true); slot('donate', donate, true);
    var ex = deck.querySelector('[data-dk-slot="extras"]'); extras.forEach(function (x) { ex.appendChild(take(x)); }); if (!extras.length) ex.remove();

    deck.querySelectorAll('.dk-list li, .dk-list .tile-row, .dk-pg').forEach(function (pg) {
      if (pg.classList.contains('dk-pg')) Array.prototype.forEach.call(pg.children, function (c, j) { c.style.setProperty('--j', j); });
      else pg.style.setProperty('--j', Array.prototype.indexOf.call(pg.parentNode.children, pg));
    });
    deck.querySelectorAll('.dk-socials li, .dk-socials .tile').forEach(function (c, j) { c.style.setProperty('--j', j); });

    page.replaceChildren(deck);
    page.classList.add('dk-page');
    if (!preview) {
      deck.classList.add('dk-live');
      // the page-wide theme animation steps aside; this layout draws its own inside the background
      var R = document.documentElement; R.setAttribute('data-bgfx', R.getAttribute('data-bgfx') || 'on');
    }
    var fx = fxStart(deck, p, preview);

    /* ── slides + dot slider ── */
    var slides = Array.prototype.slice.call(deck.querySelectorAll('.dk-slide'));
    var dots = deck.querySelector('.dk-dots');
    if (slides.length > 1) dots.innerHTML = slides.map(function (s, i) { return '<button type="button" data-dk-go="' + i + '" aria-label="' + esc(NAMES[s.dataset.dk]) + '"><i></i><span>' + esc(NAMES[s.dataset.dk]) + '</span></button>'; }).join('');
    else dots.remove();
    var cur = -1, lastNav = 0;
    function go(i, instant) {
      i = Math.max(0, Math.min(slides.length - 1, i));
      if (i === cur) return;
      lastNav = Date.now();
      slides.forEach(function (s, k) {
        s.classList.toggle('on', k === i); s.classList.toggle('above', k < i); s.classList.toggle('below', k > i);
        s.setAttribute('aria-hidden', String(k !== i)); s.inert = k !== i;
      });
      if (instant) { deck.classList.add('dk-instant'); requestAnimationFrame(function () { requestAnimationFrame(function () { deck.classList.remove('dk-instant'); }); }); }
      slides[i].scrollTop = 0;
      var dir = cur < 0 ? 0 : i > cur ? 1 : -1;
      cur = i;
      deck.style.setProperty('--dk-k', String(i)); deck.style.setProperty('--dk-n', String(slides.length)); deck.style.setProperty('--dk-sp', '0');
      deck.classList.toggle('dk-last', i === slides.length - 1);
      deck.classList.toggle('dk-first', i === 0);
      var nb = deck.querySelector('[data-dk-num]'), nn = deck.querySelector('[data-dk-name]'), nt = deck.querySelector('[data-dk-total]');
      if (nb) { nb.textContent = String(i + 1).padStart(2, '0'); nt.textContent = '/ ' + String(slides.length).padStart(2, '0'); nn.textContent = NAMES[slides[i].dataset.dk] || '';
        var cnt = nb.parentNode; cnt.classList.remove('dk-tick'); void cnt.offsetWidth; cnt.classList.add('dk-tick'); }
      if (dir && fx) fx.kick(dir);
      dots.querySelectorAll && dots.querySelectorAll('[data-dk-go]').forEach(function (b, k) { b.setAttribute('aria-current', String(k === i)); });
      var wantLyr = slides[i].dataset.dk === 'player';
      if (window.MaplePlayer && MaplePlayer.lyrics) MaplePlayer.lyrics(wantLyr);
      if (wantLyr) { lyrVer = -2; paintSong(); }
    }
    go(0, true);
    if (window.MX && MX.fill) MX.fill(deck);

    slides.forEach(function (s) {
      s.addEventListener('scroll', function () { if (s !== slides[cur]) return; var m = s.scrollHeight - s.clientHeight; deck.style.setProperty('--dk-sp', m > 4 ? (s.scrollTop / m).toFixed(3) : '0'); }, { passive: true });
    });
    if (!preview && !REDUCE.matches && matchMedia('(hover:hover)').matches) {
      var pRaf = 0, px = .5, py = .5;
      deck.addEventListener('pointermove', function (e) {
        var r = deck.getBoundingClientRect(); px = (e.clientX - r.left) / Math.max(1, r.width); py = (e.clientY - r.top) / Math.max(1, r.height);
        if (pRaf) return; pRaf = requestAnimationFrame(function () { pRaf = 0; deck.style.setProperty('--px', px.toFixed(3)); deck.style.setProperty('--py', py.toFixed(3)); });
      }, { passive: true });
    }
    function canScroll(dir) { var s = slides[cur]; if (!s) return false; return dir > 0 ? s.scrollTop + s.clientHeight < s.scrollHeight - 2 : s.scrollTop > 1; }
    function step(dir) { if (Date.now() - lastNav < 800) return; go(cur + dir); }
    function shown() {
      if (!document.body.contains(deck) || !deck.getClientRects().length) return false;
      var pane = deck.closest('.pg'); if (pane && pane.dataset.pg && document.body.dataset.page && document.body.dataset.page !== pane.dataset.pg) return false;   // another pager pane is on screen
      return true;
    }

    deck.addEventListener('wheel', function (e) {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      var dir = e.deltaY > 0 ? 1 : -1;
      if (canScroll(dir)) return;
      e.preventDefault();
      if (Math.abs(e.deltaY) > 6) step(dir);
    }, { passive: false });
    var ty = 0, tx = 0, tEdge = { up: false, down: false }, tOn = false;
    deck.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tOn = false; return; }
      tOn = true; ty = e.touches[0].clientY; tx = e.touches[0].clientX;
      tEdge = { down: !canScroll(1), up: !canScroll(-1) };
    }, { passive: true });
    deck.addEventListener('touchmove', function (e) {
      if (!tOn) return;
      var dy = e.touches[0].clientY - ty, dx = e.touches[0].clientX - tx;
      if (Math.abs(dy) > Math.abs(dx) && ((dy < 0 && tEdge.down) || (dy > 0 && tEdge.up)) && e.cancelable) e.preventDefault();
    }, { passive: false });
    deck.addEventListener('touchend', function (e) {
      if (!tOn) return; tOn = false;
      var t = e.changedTouches[0], dy = t.clientY - ty, dx = t.clientX - tx;
      if (Math.abs(dy) < 50 || Math.abs(dy) < Math.abs(dx) * 1.2) return;
      if (dy < 0 && tEdge.down) step(1); else if (dy > 0 && tEdge.up) step(-1);
    }, { passive: true });
    var onKey = null;
    if (!preview) {
      onKey = function (e) {
        if (!document.body.contains(deck)) { document.removeEventListener('keydown', onKey); return; }
        if (!shown() || e.altKey || e.ctrlKey || e.metaKey) return;
        var a = document.activeElement; if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
        if (a && a !== document.body && !deck.contains(a)) return;
        var k = e.key, dir = k === 'ArrowDown' || k === 'PageDown' ? 1 : k === 'ArrowUp' || k === 'PageUp' ? -1 : 0;
        if (k === 'Home') { e.preventDefault(); go(0); return; }
        if (k === 'End') { e.preventDefault(); go(slides.length - 1); return; }
        if (!dir || canScroll(dir)) return;
        e.preventDefault(); step(dir);
      };
      document.addEventListener('keydown', onKey);
    }

    /* carousels */
    deck.querySelectorAll('[data-dk-car]').forEach(function (car) {
      var trk = car.querySelector('[data-dk-track]'), pd = car.querySelectorAll('[data-dk-pgto]'), raf = 0;
      function idx() { return Math.round(trk.scrollLeft / Math.max(1, trk.clientWidth)); }
      trk.addEventListener('scroll', function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(function () { var n = idx(); pd.forEach(function (d, k) { if (k === n) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); }); }); }, { passive: true });
      car.__go = function (n) { n = Math.max(0, Math.min(pd.length - 1, n)); trk.scrollTo({ left: n * trk.clientWidth, behavior: REDUCE.matches ? 'auto' : 'smooth' }); };
      car.__idx = idx;
    });

    /* ── typed bio ── */
    var typeT = 0;
    function typeBio() {
      var el = deck.querySelector('[data-dk-bio] > span'); if (!el || REDUCE.matches) return;
      var i = 0; el.textContent = ''; el.classList.add('dk-typing');
      (function tick() {
        if (!document.body.contains(el)) return;
        if (i <= bio.length) { el.textContent = bio.slice(0, i); i += bio.length > 160 ? 2 : 1; typeT = setTimeout(tick, 22 + Math.random() * 24); }
        else { el.textContent = bio; }
      })();
    }
    function enter() {
      if (deck.classList.contains('dk-on')) return;
      try { sessionStorage.setItem(key, '1'); } catch (e) {}
      deck.classList.add('dk-on');
      var sp = deck.querySelector('.dk-splash'); if (sp) { sp.classList.add('out'); setTimeout(function () { sp.remove(); }, 600); }
      typeBio();
      if (song && p.musicAuto !== false) { var st = state(); if (!(mine(st) && st.playing)) songCtl('toggle'); }
    }
    if (entered && !preview && !REDUCE.matches) typeBio();
    if (!preview && !REDUCE.matches) {                                    // opening animation: the star zooms in, then the slides appear (nothing to tap)
      var acc = (getComputedStyle(document.documentElement).getPropertyValue('--accent') || '').trim() || '#ff6a3d';
      deck.classList.add('dk-opening');
      var starEnd = starZoom(deck, acc, function () { deck.classList.remove('dk-opening'); });
      setTimeout(starEnd, 4000);                                          // never get stuck
    }

    /* ── clicks ── */
    deck.addEventListener('click', function (e) {
      if (e.target.closest('[data-dk-enter]')) { enter(); return; }
      var g = e.target.closest('[data-dk-go]'); if (g) { go(Number(g.dataset.dkGo)); return; }
      var pg = e.target.closest('[data-dk-pg]'), pt = e.target.closest('[data-dk-pgto]');
      if (pg || pt) { var car = (pg || pt).closest('[data-dk-car]'); if (car && car.__go) car.__go(pt ? Number(pt.dataset.dkPgto) : car.__idx() + Number(pg.dataset.dkPg)); return; }
      if (preview) return;
      if (e.target.closest('[data-dk-lsearch]')) { if (window.MaplePlayer && MaplePlayer.searchLyrics) MaplePlayer.searchLyrics(); return; }
      var pl = e.target.closest('[data-dk-play]');
      if (pl) { var item = (p.musicLikes || [])[Number(pl.dataset.dkPlay)]; if (item && window.MX) MX.play(item, p); return; }
      var sc = e.target.closest('[data-dk-song]');
      if (sc && song) songCtl(sc.dataset.dkSong);
    });

    /* ── player: drives and mirrors the bottom player ── */
    function state() { return window.MaplePlayer && MaplePlayer.state ? MaplePlayer.state() : null; }
    function track() { return { url: song.url, audio: song.audio || '', title: song.title, artist: song.artist, art: song.art, durationMs: song.durationMs, owner: p.name, slug: p.slug, lyrics: p.lyrics !== false }; }
    function mine(st) { return !!(song && st && st.track && (st.track.url === song.url || st.track.audio === song.url)); }
    function ours(st) { return !!(st && st.track && (mine(st) || (p.slug && st.track.slug === p.slug))); }
    function songCtl(a) {
      var MP = window.MaplePlayer; if (!MP) { if (!song.audio) window.open(song.url, '_blank', 'noopener'); return; }
      var st = state();
      if (ours(st) && MP.ctl) { MP.ctl(a); return; }
      MP.play(track());
    }
    var timer = 0, last = '', lyrVer = -2, lyrCur = -1;
    function paintLyrics(st, on) {
      var box = deck.querySelector('[data-dk-lyr-in]'); if (!box || !slides[cur] || slides[cur].dataset.dk !== 'player') return;
      var L = on && window.MaplePlayer && MaplePlayer.lyrics ? MaplePlayer.lyrics() : null;
      var v = L ? L.ver + (L.ok ? 'y' : 'n') : 'none';
      if (v !== lyrVer) {
        lyrVer = v; lyrCur = -1;
        if (L && L.ok && L.lines) box.innerHTML = L.lines.map(function (l) { return '<p>' + (esc(l.x) || '♪') + '</p>'; }).join('');
        else if (L && L.ok && L.plain) box.innerHTML = '<p class="dk-lplain">' + esc(L.plain) + '</p>';
        else {
          var msg = p.lyrics === false ? (song.note || '♪') : ((L && L.ok && L.msg) || (on ? 'Finding lyrics…' : 'Press play to see the lyrics'));
          box.innerHTML = '<p class="dk-lmsg">' + esc(msg) + '</p>' + (p.lyrics !== false && on && L && L.ok ? '<p class="dk-lmsg"><button type="button" class="dk-lfind" data-dk-lsearch><i class="fa-solid fa-magnifying-glass"></i> Search lyrics manually</button></p>' : '');
        }
        box.style.transform = '';
      }
      if (L && L.ok && L.lines) {
        var pos = st.pos || 0, n = -1;
        for (var i = 0; i < L.lines.length; i++) { if (L.lines[i].t <= pos + 250) n = i; else break; }
        if (n !== lyrCur) {
          lyrCur = n;
          var ps = box.children;
          for (var k = 0; k < ps.length; k++) ps[k].className = k === n ? 'cur' : k === n + 1 ? 'nxt' : '';
          var el = ps[Math.max(0, n)], wrap = box.parentNode;
          if (el) box.style.transform = 'translateY(' + Math.round(wrap.clientHeight * 0.38 - el.offsetTop - el.offsetHeight / 2) + 'px)';
        }
      }
    }
    function paintSong() {
      if (!song) return;
      var st = state(), on = ours(st);
      var t = on ? st.track : song, playing = on && st.playing, pos = on ? st.pos : 0, dur = (on && st.dur) || (on ? t.durationMs : song.durationMs) || 0;
      paintLyrics(st, on);
      var sig = [t.title, t.artist, t.art, playing, Math.floor(pos / 500), dur].join('|'); if (sig === last) return; last = sig;
      deck.classList.toggle('dk-playing', !!playing);
      deck.querySelectorAll('[data-dk-player]').forEach(function (box) {
        box.querySelector('[data-dk-st]').textContent = t.title || 'Song';
        box.querySelector('[data-dk-sa]').textContent = t.artist || p.name || '';
        var da = box.querySelector('[data-dk-art]'), im = da.querySelector('img');
        if (t.art && artOk(t.art)) { if (!im || im.getAttribute('src') !== t.art) { if (im) im.remove(); da.insertAdjacentHTML('beforeend', '<img src="' + esc(t.art) + '" alt="" decoding="async" onerror="this.remove()">'); } }
        var f = dur ? Math.min(1, pos / dur) : 0;
        box.querySelector('[data-dk-fill]').style.transform = 'scaleX(' + f + ')';
        box.querySelector('[data-dk-knob]').style.left = (f * 100) + '%';
        box.querySelector('[data-dk-pos]').textContent = fmt(pos);
        box.querySelector('[data-dk-dur]').textContent = dur ? fmt(dur) : '--:--';
      });
      deck.querySelectorAll('[data-dk-song="toggle"]').forEach(function (b) {
        var fab = b.classList.contains('dk-fab');
        b.setAttribute('aria-label', playing ? (fab ? 'Pause music' : 'Pause') : (fab ? 'Play music' : 'Play'));
        b.firstChild.className = 'fa-solid ' + (fab ? (playing ? 'fa-volume-high' : 'fa-volume-xmark') : (playing ? 'fa-pause' : 'fa-play'));
      });
    }
    if (song) {
      if (!song.title && window.MX && !song.audio) MX.meta(song.url).then(function (m) { if (!m) return; song.title = song.title || m.title; song.artist = song.artist || m.artist; song.art = song.art || m.art; if (m.durationMs) song.durationMs = m.durationMs; last = ''; paintSong(); });
      paintSong();
      if (!preview) timer = setInterval(function () { if (!document.body.contains(deck)) { stop(); return; } if (!document.hidden) paintSong(); }, 250);
    }

    function stop() {
      clearInterval(timer); clearTimeout(typeT); if (fx) fx.stop();
      if (onKey) document.removeEventListener('keydown', onKey);
      if (window.MaplePlayer && MaplePlayer.lyrics) MaplePlayer.lyrics(false);
    }
    page.__dkStop = stop;
  };
})();
