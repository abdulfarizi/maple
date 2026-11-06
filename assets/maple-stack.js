/* M-ID · star card sections (v32)
 * The star card shows its collections as full sections under the card instead of hiding them behind tabs:
 *   · a compact "now playing" strip right under the card
 *   · Anime      — poster shelf, paged with dots + arrows
 *   · Audio Player — big player with the cover behind it and synced lyrics
 *   · Music I like — 4 × 2 album grid, paged
 * Audio is never played here: the M-ID app's player (parent page) owns the Spotify embed. This page mirrors its
 * state ({maple:'mp-state'}) and sends taps back ({maple:'mp-ctl'}). Outside the app only the shelves render. */
(function () {
  'use strict';
  if (window.MXStack) return;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var IN_APP = window.parent !== window;
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
  var lib = [], root = null, P = null, st = { lines: null, key: '', cur: -1, userAt: 0 }, last = null;
  var I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/></svg>',
    prev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5v14M18 6.2v11.6a.8.8 0 0 1-1.2.7L9 12.7a.8.8 0 0 1 0-1.4l7.8-5.8a.8.8 0 0 1 1.2.7z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    next: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 5v14M6 6.2v11.6a.8.8 0 0 0 1.2.7l7.8-5.8a.8.8 0 0 0 0-1.4L7.2 5.5A.8.8 0 0 0 6 6.2z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
    l: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7z" fill="currentColor"/></svg>',
    r: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7z" fill="currentColor"/></svg>'
  };
  function fmt(ms) { ms = Math.max(0, ms | 0); var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function artOk(u) { return !!(window.MX && MX.artOk(u)); }
  function ctl(act, v) { try { parent.postMessage({ maple: 'mp-ctl', act: act, v: v }, location.origin); } catch (e) {} }

  /* ───── markup ───── */
  function head(title, sub) {
    return '<header class="sk-head"><h2>' + esc(title) + '</h2>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</header>';
  }
  function pager(kind, label, inner) {
    return '<div class="sk-pager" data-sk-pager="' + kind + '"><ul class="sk-track" role="list" tabindex="0" aria-label="' + esc(label) + '">' + inner + '</ul>'
      + '<div class="sk-nav"><button type="button" class="sk-arr" data-sk-go="-1" aria-label="Previous page">' + I.l + '</button>'
      + '<span class="sk-dots" aria-hidden="true"></span>'
      + '<button type="button" class="sk-arr" data-sk-go="1" aria-label="Next page">' + I.r + '</button></div></div>';
  }
  function animeCard(x) {
    var cover = x.cover && artOk(x.cover) ? '<img src="' + esc(x.cover) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '';
    var score = x.rating > 0 ? x.rating : (x.score ? Math.round(x.score) / 10 : 0);
    var fmtd = x.format ? String(x.format).replace(/_/g, ' ').replace('TV SHORT', 'Short') : '';
    return '<li class="sk-anime"><article tabindex="0" aria-label="' + esc(x.title) + '">'
      + '<div class="sk-cover"><span class="sk-ph">' + esc((x.title || '?')[0]) + '</span>' + cover + '</div>'
      + '<div class="sk-ab"><h3>' + esc(x.title) + '</h3><p>'
      + (score ? '<span class="sk-star"><i class="fa-solid fa-star" aria-hidden="true"></i>' + score.toFixed(1) + '</span>' : '')
      + (x.year ? '<span>' + x.year + '</span>' : '') + (fmtd ? '<em>' + esc(fmtd) + '</em>' : '') + '</p></div></article></li>';
  }
  function songCard(x, i) {
    var art = x.art && artOk(x.art) ? '<img src="' + esc(x.art) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '';
    return '<li class="sk-song"><button type="button" data-sk-play="' + i + '" aria-label="Play ' + esc(x.title || 'song') + '">'
      + '<span class="sk-art"><span class="sk-ph">' + esc((x.title || '♪')[0]) + '</span>' + art + '<span class="sk-pl" aria-hidden="true">' + I.play + '</span></span>'
      + '<b>' + esc(x.title || 'Untitled') + '</b><small>' + esc(x.artist || (x.audio ? 'Full song' : 'Spotify')) + '</small></button></li>';
  }
  function playerHTML() {
    return '<section class="sk-sec sk-player" data-sk-player aria-label="Audio player">' + head(P.playerTitle || 'Audio Player', P.playerSub || '')
      + '<div class="sk-ap"><div class="sk-ap-bg" aria-hidden="true"><img alt="" hidden></div>'
      + '<div class="sk-ap-top"><span class="sk-ap-art"><img alt="" hidden><i class="fa-solid fa-music" aria-hidden="true"></i></span>'
      + '<div class="sk-ap-meta"><b class="sk-t">Loading…</b><small class="sk-a"></small>'
      + '<div class="sk-ap-row"><button type="button" class="sk-ic" data-sk-ctl="back" aria-label="Back 10 seconds">' + I.prev + '</button>'
      + '<button type="button" class="sk-pp" data-sk-ctl="toggle" aria-label="Play">' + I.play + '</button>'
      + '<button type="button" class="sk-ic" data-sk-ctl="fwd" aria-label="Forward 10 seconds">' + I.next + '</button>'
      + '<span class="sk-time sk-t0">0:00</span><input type="range" class="sk-seek" min="0" max="1000" value="0" aria-label="Seek"><span class="sk-time sk-t1">0:00</span></div></div></div>'
      + '<div class="sk-lyr" tabindex="0" aria-label="Lyrics"><div class="sk-lstate">Tap play to start the music.</div></div>'
      + '<p class="sk-full" hidden></p></div></section>';
  }
  /* ── Your songs: Spotify-style list of the uploaded MP3s (full songs, played by our own player) ── */
  function libHTML() {
    var rows = lib.map(function (x, i) {
      var art = x.art && artOk(x.art) ? '<img src="' + esc(x.art) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '';
      return '<li class="sk-row"' + (i >= 8 ? ' hidden data-sk-extra' : '') + ' data-sk-key="' + esc((x.title || '').toLowerCase()) + '"><button type="button" data-sk-lib="' + i + '" aria-label="Play ' + esc(x.title || 'song') + '">'
        + '<span class="sk-rn"><b>' + (i + 1) + '</b><span class="sk-rp" aria-hidden="true">' + I.play + '</span><span class="sk-eq" aria-hidden="true"><i></i><i></i><i></i></span></span>'
        + '<span class="sk-rart"' + (art || !x.url || x.audio ? '' : ' data-fill-url="' + esc(x.url) + '"') + '><span class="sk-ph">' + esc((x.title || '♪')[0]) + '</span>' + art + '</span>'
        + '<span class="sk-rt"><b>' + esc(x.title || 'Untitled') + '</b><small>' + esc(x.artist || 'Full song') + '</small></span>'
        + '<span class="sk-rd">' + (x.durationMs ? fmt(x.durationMs) : '') + '</span></button></li>';
    }).join('');
    return '<section class="sk-sec sk-lib" data-sk-sec="music" aria-label="Music I like">' + head(P.musicTitle || 'Music I like', P.musicSub || '')
      + '<ol class="sk-rows" role="list">' + rows + '</ol>'
      + (lib.length > 8 ? '<button type="button" class="sk-more" data-sk-more>Show all ' + lib.length + ' songs</button>' : '') + '</section>';
  }
  function miniHTML() {
    return '<div class="sk-mini" data-sk-mini><span class="sk-ap-art"><img alt="" hidden><i class="fa-solid fa-music" aria-hidden="true"></i></span>'
      + '<div class="sk-ap-meta"><b class="sk-t">Loading…</b><small class="sk-a"></small>'
      + '<div class="sk-ap-row"><button type="button" class="sk-ic" data-sk-ctl="back" aria-label="Back 10 seconds">' + I.prev + '</button>'
      + '<button type="button" class="sk-pp" data-sk-ctl="toggle" aria-label="Play">' + I.play + '</button>'
      + '<button type="button" class="sk-ic" data-sk-ctl="fwd" aria-label="Forward 10 seconds">' + I.next + '</button>'
      + '<span class="sk-time sk-t0">0:00</span><span class="sk-bar"><i></i></span><span class="sk-time sk-t1">0:00</span></div></div>'
      + '<div class="sk-mlyr" aria-hidden="true"></div></div>';
  }

  /* ───── paging (dots follow the scroll position) ───── */
  function pages(pg) { var tr = pg.querySelector('.sk-track'); return Math.max(1, Math.round(tr.scrollWidth / Math.max(1, tr.clientWidth))); }
  function paintDots(pg) {
    var tr = pg.querySelector('.sk-track'), n = pages(pg), i = Math.round(tr.scrollLeft / Math.max(1, tr.clientWidth));
    var d = pg.querySelector('.sk-dots');
    if (d.childElementCount !== n) d.innerHTML = new Array(n + 1).join('<i></i>');
    Array.prototype.forEach.call(d.children, function (c, k) { c.classList.toggle('on', k === i); });
    pg.classList.toggle('one', n < 2);
    var b = pg.querySelectorAll('.sk-arr'); b[0].disabled = i <= 0; b[1].disabled = i >= n - 1;
  }
  function bindPagers() {
    root.querySelectorAll('.sk-pager').forEach(function (pg) {
      var tr = pg.querySelector('.sk-track');
      tr.addEventListener('scroll', function () { paintDots(pg); }, { passive: true });
      paintDots(pg);
    });
  }

  /* ───── live state from the app's player ───── */
  function apply(s) {
    if (!root) return;
    last = s;
    if (s.lyrKey !== undefined && s.lyrKey !== st.key) { st.key = s.lyrKey; st.lines = s.lines || null; st.plain = s.plain || ''; st.msg = s.lyrMsg || ''; st.cur = -1; paintLyrics(); }
    else if (s.lyrMsg !== undefined && s.lyrMsg !== st.msg) { st.msg = s.lyrMsg; if (!st.lines && !st.plain) paintLyrics(); }
    var art = s.art && artOk(s.art) ? s.art : '';
    root.querySelectorAll('[data-sk-player],[data-sk-mini]').forEach(function (box) {
      box.querySelectorAll('.sk-t').forEach(function (n) { var v = s.title || 'Spotify'; if (n.textContent !== v) n.textContent = v; });
      box.querySelectorAll('.sk-a').forEach(function (n) { var v = s.artist || ''; if (n.textContent !== v) n.textContent = v; });
      box.querySelectorAll('img').forEach(function (img) { if (art) { if (img.getAttribute('src') !== art) { img.hidden = true; img.onload = function () { img.hidden = false; }; img.src = art; } } else if (!img.hidden) img.hidden = true; });
      box.querySelectorAll('.sk-pp').forEach(function (b) { if (b.__p !== !!s.playing) { b.__p = !!s.playing; b.innerHTML = s.playing ? I.pause : I.play; } b.setAttribute('aria-label', s.playing ? 'Pause' : 'Play'); b.classList.toggle('busy', !!s.buffering); });
      box.querySelectorAll('.sk-t0').forEach(function (n) { n.textContent = fmt(s.pos); });
      box.querySelectorAll('.sk-t1').forEach(function (n) { n.textContent = s.dur ? fmt(s.dur) : '–:––'; });
      var f = s.dur ? Math.min(1, s.pos / s.dur) : 0;
      box.querySelectorAll('.sk-bar i').forEach(function (n) { n.style.transform = 'scaleX(' + f.toFixed(4) + ')'; });
      box.querySelectorAll('.sk-seek').forEach(function (n) { if (document.activeElement !== n) n.value = Math.round(f * 1000); n.style.setProperty('--f', (f * 100).toFixed(2) + '%'); });
      box.querySelectorAll('.sk-ic').forEach(function (b) { b.disabled = s.src !== 'spotify' && s.src !== 'file'; });
      box.classList.toggle('playing', !!s.playing);
    });
    var full = root.querySelector('.sk-full');
    if (full) {
      // previews only: offer "Connect Spotify Premium" when the site has it set up
      var showFull = s.src === 'spotify' && s.engine === 'embed' && (s.preview || !s.playing);
      full.hidden = !showFull;
      var fk = showFull ? (s.preview ? 'p' : 'n') + (s.connect ? 'c' : '') : '';
      if (showFull && full.__k !== fk) full.innerHTML = (s.preview ? '<i class="fa-brands fa-spotify"></i> 30-second preview from Spotify. ' : '<i class="fa-brands fa-spotify"></i> Spotify plays previews here. ')
        + (s.connect ? '<button type="button" data-sk-ctl="login">Connect Spotify Premium</button> for full songs.' : '');
      full.__k = fk;
    }
    var cur = String(s.title || '').toLowerCase();
    root.querySelectorAll('.sk-row').forEach(function (r) { var on = !!cur && r.dataset.skKey === cur; r.classList.toggle('on', on); r.classList.toggle('playing', on && !!s.playing); });
    syncLyric(s.pos || 0);
  }
  function paintLyrics() {
    var boxes = root.querySelectorAll('.sk-lyr');
    var html = st.lines ? '<ol class="sk-lines">' + st.lines.map(function (l, i) { return '<li data-i="' + i + '">' + (esc(l.x) || '♪') + '</li>'; }).join('') + '</ol>'
      : st.plain ? '<div class="sk-plain">' + esc(st.plain).replace(/\n/g, '<br>') + '</div>'
      : '<div class="sk-lstate"><span>' + esc(st.msg || 'Tap play to start the music.') + (/^(No lyrics|Looking up)/.test(st.msg || '') ? '<br><button type="button" class="sk-lfind" data-sk-ctl="lsearch">Search lyrics manually</button>' : '') + '</span></div>';
    boxes.forEach(function (b) { b.innerHTML = html; });
    var m = root.querySelector('.sk-mlyr'); if (m) m.innerHTML = st.lines ? '<ol class="sk-lines">' + st.lines.map(function (l) { return '<li>' + (esc(l.x) || '♪') + '</li>'; }).join('') + '</ol>' : '';
  }
  function syncLyric(pos) {
    if (!st.lines) return;
    var i = -1; for (var k = 0; k < st.lines.length; k++) { if (st.lines[k].t <= pos + 250) i = k; else break; }
    if (i === st.cur) return; st.cur = i;
    root.querySelectorAll('.sk-lyr,.sk-mlyr').forEach(function (box) {
      var ol = box.querySelector('.sk-lines'); if (!ol) return;
      Array.prototype.forEach.call(ol.children, function (li, k) { li.className = k === i ? 'on' : (Math.abs(k - i) === 1 ? 'near' : ''); });
      var li = ol.children[i]; if (!li) return;
      if (box.classList.contains('sk-lyr') && Date.now() - st.userAt < 3500) return;
      var top = li.offsetTop - box.clientHeight / 2 + li.offsetHeight / 2;
      box.scrollTo({ top: Math.max(0, top), behavior: REDUCE.matches ? 'auto' : 'smooth' });
    });
  }

  /* ───── public ───── */
  function render(host, profile) {
    root = host; P = profile || {};
    if (!root) return;
    var mx = window.MX, html = '';
    var hasPlayer = IN_APP && P.music !== false && (!!(P.song && P.song.audio) || !!(mx && mx.spotify(P.spotify)) || P.layout === 'star');
    var likes = Array.isArray(P.musicLikes) ? P.musicLikes.filter(Boolean) : [];
    var animeOn = !!(mx && mx.animeOn(P)), musicOn = !!(mx && mx.musicOn(P));
    lib = IN_APP && musicOn ? likes : [];
    /* one player only: the big Audio Player section below replaces the separate "now playing" strip */
    if (animeOn) html += '<section class="sk-sec" data-sk-sec="anime" aria-label="Anime">' + head(P.animeTitle || 'Anime', P.animeSub || '') + pager('anime', 'Anime', P.anime.map(animeCard).join('')) + '</section>';
    if (hasPlayer) html += playerHTML();
    if (musicOn && lib.length) html += libHTML();
    else if (musicOn) html += '<section class="sk-sec" data-sk-sec="music" aria-label="Music I like">' + head(P.musicTitle || 'Music I like', P.musicSub || '') + pager('music', 'Music I like', P.musicLikes.map(songCard).join('')) + '</section>';
    root.innerHTML = html; root.hidden = !html;
    root.classList.toggle('sk-lyrics-off', P.lyrics === false);
    bindPagers();
    paintLyrics();
    if (window.MX && MX.fill) MX.fill(root);
    if (!root.__bound) {
      root.__bound = 1;
      root.addEventListener('click', function (e) {
        var g = e.target.closest('[data-sk-go]');
        if (g) { var tr = g.closest('.sk-pager').querySelector('.sk-track'); tr.scrollBy({ left: Number(g.dataset.skGo) * tr.clientWidth, behavior: REDUCE.matches ? 'auto' : 'smooth' }); return; }
        var c = e.target.closest('[data-sk-ctl]'); if (c) { ctl(c.dataset.skCtl); return; }
        var mo = e.target.closest('[data-sk-more]');
        if (mo) { root.querySelectorAll('[data-sk-extra]').forEach(function (r) { r.hidden = false; }); mo.remove(); return; }
        var lb = e.target.closest('[data-sk-lib]');
        if (lb && window.MX) { var li = lib[Number(lb.dataset.skLib)]; if (li) MX.play(li, P); return; }
        var pl = e.target.closest('[data-sk-play]');
        if (pl && window.MX) { var it = (P.musicLikes || [])[Number(pl.dataset.skPlay)]; if (it) MX.play(it, P); return; }
        var ln = e.target.closest('.sk-lyr li[data-i]');
        if (ln && st.lines && last && last.src === 'spotify') ctl('seekms', st.lines[Number(ln.dataset.i)].t);
      });
      root.addEventListener('change', function (e) { if (e.target.matches('.sk-seek')) ctl('seek', Number(e.target.value) / 1000); });
      root.addEventListener('wheel', function (e) { if (e.target.closest('.sk-lyr')) st.userAt = Date.now(); }, { passive: true });
      root.addEventListener('touchmove', function (e) { if (e.target.closest('.sk-lyr')) st.userAt = Date.now(); }, { passive: true });
      window.addEventListener('resize', function () { root.querySelectorAll('.sk-pager').forEach(paintDots); });
      window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.maple === 'mp-state') apply(e.data.s || {}); });
      // any tap in the card closes menus/popovers that live in the app around it
      document.addEventListener('pointerdown', function () { try { parent.postMessage({ maple: 'tap' }, location.origin); } catch (e) {} }, { passive: true });
    }
    if (hasPlayer) { st.key = ''; ctl('hello', { slug: P.slug, lyrics: P.lyrics !== false }); }
    else if (IN_APP) ctl('hello', { slug: '' });
  }
  window.MXStack = { render: render };
})();
