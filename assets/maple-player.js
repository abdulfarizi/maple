/* M-ID · bottom music player (v31)
 *
 * A mini-player that floats above the dock and slides up into a full "Now playing" sheet.
 *  · Our own controls drive every source (see "engines" below):
 *    uploaded songs play in full for everyone; Spotify links play in full for listeners who connect Spotify
 *    Premium (Web Playback SDK) and as Spotify's preview for everyone else (official player, kept out of sight;
 *    it is only shown if a browser insists on a tap inside it). Nothing is downloaded from Spotify.
 *  · YouTube links play through YouTube's official IFrame player (video shown in the expanded sheet).
 *  · Lyrics: automatic for every source (switch off per profile in Studio → Music). Looked up in LRCLIB (open community
 *    lyrics database, no key) from the song's title/artist, cleaned of "(Official Video)"-style noise, with several fallbacks;
 *    synced lines are highlighted from the playback position. Unavailable → a calm empty state.
 *  · Star cards without a Spotify link keep their built-in theme music: the player drives it inside the card.
 *
 * The app tells it which profile is on screen: MaplePlayer.setProfile('card'|'profile', profile).
 * The pane on screen comes from body[data-page] (set by maple-pager.js). */
(function () {
  'use strict';
  if (window.parent !== window || window.MaplePlayer) return;          // card iframes talk to the parent instead

  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var S = { track: null, src: '', playing: false, buffering: false, pos: 0, dur: 0, open: false, shown: false, dismissed: '', compact: false, lofiName: '', inline: '', inlineLyrics: false, engine: '', err: '', reveal: false, quiet: false, canConnect: false };
  var el = {}, ctrl = null, ctrlReady = false, apiP = null, pendingUri = '', lyr = { key: '', lines: null, plain: '', cur: -1, userAt: 0, msg: '', ver: 0, sent: -1 };

  function spotify(u) { return window.MX ? window.MX.spotify(u) : null; }
  function youtube(u) { return window.MX && window.MX.youtube ? window.MX.youtube(u) : null; }
  function srcOf(u) { return spotify(u) ? 'spotify' : youtube(u) ? 'youtube' : ''; }
  function pane() { if (window.dgPager && dgPager.layerKind && dgPager.layerKind() === 'studio') return ''; var p = document.body.dataset.page || ''; return p === 'card' || p === 'profile' ? p : ''; }
  function profileNow() { var p = pane(); return p ? (window.__mxCtx || {})[p] || null : null; }
  /* a star card on screen shows its own Audio Player section: the bottom mini-player steps aside for it */
  // known from the profile itself (no waiting for the card to load), so the mini-player never pops in and out
  function inlineNow() { var p = profileNow(); return !!(p && p.layout === 'star' && p.music !== false && S.track && S.track.slug === p.slug && starFrame()); }
  function fmt(ms) { ms = Math.max(0, ms | 0); var s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
  function starFrame() {
    var p = pane(); var f = p && document.querySelector('#pg-' + p + ' iframe.star-frame');
    return f || document.querySelector('#app iframe.star-frame');
  }
  function toFrames(msg) { document.querySelectorAll('iframe.star-frame').forEach(function (f) { try { f.contentWindow.postMessage(msg, location.origin); } catch (e) {} }); }

  /* ───── DOM ───── */
  var I = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.4-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/><rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor"/></svg>',
    up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 7 6 12l5 5M18 7l-5 5 5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    fwd: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 7 5 5-5 5M6 7l5 5-5 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  function build() {
    if (el.mini) return;
    var mini = document.createElement('div');
    mini.id = 'mp-mini'; mini.className = 'mpx-mini'; mini.setAttribute('role', 'region'); mini.setAttribute('aria-label', 'Music player'); mini.hidden = true;
    mini.innerHTML = '<button type="button" class="mpx-hit" data-mpx="open" aria-label="Open the music player">'
      + '<span class="mpx-art"><img alt="" hidden><i class="fa-solid fa-music" aria-hidden="true"></i></span>'
      + '<span class="mpx-meta"><b class="mpx-title"></b><small class="mpx-artist"></small></span></button>'
      + '<button type="button" class="mpx-pp" data-mpx="toggle" aria-label="Play">' + I.play + '</button>'
      + '<button type="button" class="mpx-ex" data-mpx="open" aria-label="Expand player">' + I.up + '</button>'
      + '<span class="mpx-bar" aria-hidden="true"><i></i></span>';
    var full = document.createElement('div');
    full.id = 'mp-sheet'; full.className = 'mpx-sheet'; full.setAttribute('role', 'dialog'); full.setAttribute('aria-modal', 'true'); full.setAttribute('aria-label', 'Now playing');
    full.setAttribute('aria-hidden', 'true'); full.inert = true;
    full.innerHTML = '<div class="mpx-bg" aria-hidden="true"><img alt=""></div>'
      + '<div class="mpx-grab" aria-hidden="true"></div>'
      + '<header class="mpx-top"><button type="button" class="mpx-ic" data-mpx="close" aria-label="Minimise player">' + I.down + '</button>'
      + '<p class="mpx-from"><span>Now playing</span><b class="mpx-owner"></b></p>'
      + '<button type="button" class="mpx-ic" data-mpx="stop" aria-label="Stop and hide the player">' + I.x + '</button></header>'
      + '<div class="mpx-body"><div class="mpx-main">'
      + '<div class="mpx-cover"><img alt="" hidden><i class="fa-solid fa-compact-disc" aria-hidden="true"></i></div>'
      + '<div class="mpx-info"><h2 class="mpx-title"></h2><p class="mpx-artist"></p></div>'
      + '<div class="mpx-prog" hidden><input type="range" class="mpx-seek" min="0" max="1000" value="0" step="1" aria-label="Seek"><div class="mpx-times"><span class="mpx-t0">0:00</span><span class="mpx-t1">0:00</span></div></div>'
      + '<div class="mpx-ctrls"><button type="button" class="mpx-ic lg" data-mpx="back" aria-label="Back 10 seconds">' + I.back + '</button>'
      + '<button type="button" class="mpx-big" data-mpx="toggle" aria-label="Play">' + I.play + '</button>'
      + '<button type="button" class="mpx-ic lg" data-mpx="fwd" aria-label="Forward 10 seconds">' + I.fwd + '</button></div>'
      + '<div class="mpx-embed-wrap"><div id="mpx-embed"></div></div>'
      + '<div class="mpx-yt-wrap" hidden><div id="mpx-yt"></div></div>'
      + '<p class="mpx-note"></p></div>'
      + '<section class="mpx-lyrics" aria-label="Lyrics"><header><b>Lyrics</b><small class="mpx-lsrc"></small><button type="button" class="mpx-lfind" data-mpx="lsearch" aria-label="Search lyrics manually"><i class="fa-solid fa-magnifying-glass"></i> Search</button></header>'
      + '<form class="mpx-lform" hidden><input name="title" placeholder="Song title" autocomplete="off" aria-label="Song title"><input name="artist" placeholder="Artist (optional)" autocomplete="off" aria-label="Artist"><button type="submit">Find</button></form>'
      + '<div class="mpx-lres" hidden></div><div class="mpx-lbody" tabindex="0"></div></section>'
      + '</div>';
    document.body.appendChild(mini); document.body.appendChild(full);
    el = { mini: mini, sheet: full, lbody: full.querySelector('.mpx-lbody'), seek: full.querySelector('.mpx-seek') };
    var act = function (e) {
      var b = e.target.closest('[data-mpx]'); if (!b) return;
      var a = b.dataset.mpx;
      if (a === 'open') setOpen(true);
      else if (a === 'close') setOpen(false);
      else if (a === 'toggle') toggle();
      else if (a === 'stop') stop();
      else if (a === 'back' || a === 'fwd') skip(a === 'fwd' ? 10 : -10);
      else if (a === 'lsearch') lyricForm(true);
      else if (a === 'lpick') lyricPick(Number(b.dataset.i));
      else if (a === 'login') connect();
      else if (a === 'disconnect') disconnect();
    };
    mini.addEventListener('click', act); full.addEventListener('click', act);
    full.querySelector('.mpx-lform').addEventListener('submit', function (e) { e.preventDefault(); lyricManual(this.elements.title.value, this.elements.artist.value); });
    el.seek.addEventListener('change', function () { if (S.dur) seekMs(S.dur * el.seek.value / 1000); });
    el.lbody.addEventListener('wheel', function () { lyr.userAt = Date.now(); }, { passive: true });
    el.lbody.addEventListener('touchmove', function () { lyr.userAt = Date.now(); }, { passive: true });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.open) setOpen(false); });
    /* swipe the sheet down to minimise */
    var y0 = 0, dy = 0, drag = false;
    full.querySelector('.mpx-top').addEventListener('touchstart', function (e) { y0 = e.touches[0].clientY; dy = 0; drag = true; full.classList.add('dragging'); }, { passive: true });
    full.addEventListener('touchmove', function (e) { if (!drag) return; dy = Math.max(0, e.touches[0].clientY - y0); full.style.transform = 'translate3d(0,' + dy + 'px,0)'; }, { passive: true });
    full.addEventListener('touchend', function () { if (!drag) return; drag = false; full.classList.remove('dragging'); full.style.transform = ''; if (dy > 90) setOpen(false); });
  }

  /* ───── layout space: nothing sits hidden behind the mini-player ───── */
  function space() {
    var inl = inlineNow(); document.body.classList.toggle('mp-inline', inl);
    var on = S.shown && !S.open && !inl;
    document.documentElement.style.setProperty('--mp-space', on ? (S.compact ? '64px' : '78px') : '0px');
    document.body.classList.toggle('has-mp', S.shown);
    toFrames({ maple: 'mp-space', px: on ? (S.compact ? 64 : 78) : 0 });
  }
  function show(on) {
    build();
    S.shown = !!on; el.mini.hidden = !on;
    document.body.classList.toggle('mp-inline', inlineNow());
    requestAnimationFrame(function () { el.mini.classList.toggle('in', !!on); });
    if (!on && S.open) setOpen(false);
    space();
  }
  function setOpen(on) {
    build(); S.open = !!on;
    el.sheet.classList.toggle('open', S.open); el.sheet.setAttribute('aria-hidden', String(!S.open)); el.sheet.inert = !S.open;
    document.documentElement.classList.toggle('mpx-locked', S.open);
    el.mini.classList.toggle('under', S.open);
    if (S.open) { if (S.engine === 'embed') ensureCtrl(); loadLyrics(); setTimeout(function () { var b = el.sheet.querySelector('.mpx-big'); b && b.focus({ preventScroll: true }); }, 60); }
    else { var m = el.mini.querySelector('.mpx-pp'); if (m && el.sheet.contains(document.activeElement)) m.focus({ preventScroll: true }); }
    space();
  }

  /* ───── paint ───── */
  var paintRaf = 0;
  function paint() { if (paintRaf) return; paintRaf = requestAnimationFrame(function () { paintRaf = 0; paintNow(); }); }
  function paintNow() {
    if (!el.mini || !S.track) return;
    var t = S.track, art = t.art && window.MX && MX.artOk(t.art) ? t.art : '';
    var title = t.title || (S.src === 'lofi' ? 'Theme music' : S.src === 'youtube' ? 'YouTube' : 'Spotify'), artist = t.artist || (S.src === 'lofi' ? (S.lofiName || 'Built-in lofi') : S.src === 'youtube' ? '' : (t.type === 'track' ? '' : (t.type ? t.type[0].toUpperCase() + t.type.slice(1) : '')));
    [el.mini, el.sheet].forEach(function (root) {
      root.querySelectorAll('.mpx-title').forEach(function (n) { if (n.textContent !== title) n.textContent = title; });
      root.querySelectorAll('.mpx-artist').forEach(function (n) { if (n.textContent !== artist) n.textContent = artist; if (n.hidden !== !artist) n.hidden = !artist; });
      root.querySelectorAll('.mpx-art img,.mpx-cover img,.mpx-bg img').forEach(function (img) { if (art) { if (img.getAttribute('src') !== art) img.src = art; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; } });
      root.querySelectorAll('[data-mpx=toggle]').forEach(function (b) { if (b.__p !== S.playing) { b.__p = S.playing; b.innerHTML = S.playing ? I.pause : I.play; } b.setAttribute('aria-label', S.playing ? 'Pause' : 'Play'); b.classList.toggle('busy', S.buffering); });
    });
    el.mini.classList.toggle('playing', S.playing); el.sheet.classList.toggle('playing', S.playing);
    el.mini.classList.toggle('compact', S.compact && !S.playing);
    el.sheet.classList.toggle('has-art', !!art);
    var ownerTxt = t.owner ? 'from ' + t.owner + (/s$/i.test(t.owner) ? "'" : "'s") + ' profile' : '', ownerEl = el.sheet.querySelector('.mpx-owner');
    if (ownerEl.textContent !== ownerTxt) ownerEl.textContent = ownerTxt;
    var isSp = S.src === 'spotify', canSeek = S.engine === 'file' || S.engine === 'yt' || isSp;
    var wrap = el.sheet.querySelector('.mpx-embed-wrap');
    wrap.hidden = S.engine !== 'embed'; wrap.classList.toggle('mpx-ghost', !S.reveal);
    var yw = el.sheet.querySelector('.mpx-yt-wrap'); if (yw) { yw.hidden = S.engine !== 'yt'; yw.classList.toggle('mpx-yt-show', !!S.reveal); }
    el.sheet.querySelectorAll('[data-mpx=back],[data-mpx=fwd]').forEach(function (b) { b.hidden = !canSeek; });
    el.sheet.querySelector('.mpx-prog').hidden = !(canSeek && S.dur > 0);
    var noteEl = el.sheet.querySelector('.mpx-note'), noteH = noteHTML(t);
    if (noteEl.__h !== noteH) { noteEl.__h = noteH; noteEl.innerHTML = noteH; }          // rewriting identical HTML every tick made the note blink
    var lyEl = el.sheet.querySelector('.mpx-lyrics'), lyHide = !lyrOk(t);
    if (lyEl.hidden !== lyHide) lyEl.hidden = lyHide;
    el.sheet.classList.toggle('no-lyrics', lyHide);
    progress();
    bcast();
  }
  function progress() {
    if (!el.mini) return;
    var f = S.dur > 0 ? Math.min(1, S.pos / S.dur) : 0;
    el.mini.querySelector('.mpx-bar i').style.transform = 'scaleX(' + f.toFixed(4) + ')';
    if (S.open && S.dur > 0) {
      if (document.activeElement !== el.seek) el.seek.value = Math.round(f * 1000);
      el.sheet.querySelector('.mpx-t0').textContent = fmt(S.pos); el.sheet.querySelector('.mpx-t1').textContent = fmt(S.dur);
    }
    syncLyric();
  }

  function lyrOk(t) { return !!(t && t.lyrics && (S.src === 'file' || S.src === 'youtube' || (S.src === 'spotify' && (t.type === 'track' || (S.engine === 'sdk' && t.title))))); }
  function noteHTML(t) {
    var open = t.url && !t.audio ? ' · <a href="' + esc(t.url) + '" target="_blank" rel="noopener noreferrer">Open in ' + (S.src === 'youtube' ? 'YouTube' : 'Spotify') + '</a>' : '';
    var err = S.err ? '<b>' + esc(S.err) + '</b> ' : '';
    if (S.engine === 'file') return err + '<i class="fa-solid fa-circle-check" aria-hidden="true"></i> Full song' + (t.owner ? ', shared by ' + esc(t.owner) : '') + '.';
    if (S.engine === 'yt') return err + '<i class="fa-brands fa-youtube" aria-hidden="true" style="color:#ff3b30"></i> Playing from YouTube' + (t.owner ? ', shared by ' + esc(t.owner) : '') + open + '.';
    if (S.engine === 'lofi') return 'This card’s built-in theme music. It changes with the card theme.';
    if (S.engine === 'sdk') return err + '<i class="fa-brands fa-spotify" aria-hidden="true"></i> Full song through your Spotify Premium. <button type="button" class="mpx-login" data-mpx="disconnect">Disconnect</button>' + open;
    var why = sdk.fail === 'premium' ? 'Full songs need a Spotify Premium account. '
      : sdk.fail === 'unsupported' ? 'Spotify doesn’t allow full songs in this browser (it works in desktop Chrome, Edge, Firefox and Safari). ' : '';
    var lead = S.reveal ? 'Tap play inside Spotify’s player above to start. ' : preview() ? '<b>30-second preview from Spotify.</b> ' : '<i class="fa-brands fa-spotify" aria-hidden="true"></i> From Spotify. ';
    var cta = S.canConnect && !sdk.fail ? '<button type="button" class="mpx-login" data-mpx="login"><i class="fa-brands fa-spotify"></i> Connect Spotify Premium</button> for full songs' : '';
    return err + lead + why + cta + open;
  }
  function preview() { return S.engine === 'embed' && S.track && S.track.type === 'track' && S.dur > 0 && S.dur <= 31000 && !(S.track.fullMs && S.track.fullMs <= 32000); }
  /* mirror the player into star cards that show an Audio Player section */
  function bcast() {
    if (!(S.inline || inlineNow()) || !S.track) return;
    var t = S.track, msg = {
      title: t.title || (S.src === 'lofi' ? 'Theme music' : 'Spotify'), artist: t.artist || (S.src === 'lofi' ? (S.lofiName || 'Built-in lofi') : ''),
      art: t.art || '', playing: S.playing, buffering: S.buffering, pos: S.pos, dur: S.dur, src: S.src, engine: S.engine, preview: preview(), connect: S.canConnect && !sdk.fail && S.engine === 'embed', lyrMsg: lyr.msg
    };
    if (lyr.sent !== lyr.ver) { lyr.sent = lyr.ver; msg.lyrKey = lyr.ver; msg.lines = lyr.lines; msg.plain = lyr.plain; }
    toFrames({ maple: 'mp-state', s: msg });
  }
  /* ───── engines ─────
   *  file  · an uploaded song, played by a plain <audio> element: the full song for everyone
   *  sdk   · Spotify Web Playback SDK in this page, for listeners who connected Spotify Premium: full songs
   *  embed · Spotify's official player kept out of sight and driven by our controls: previews for everyone else
   *  lofi  · a star card's built-in theme music (plays inside the card) */
  function msp() { return window.MSP || null; }
  function sdkWanted() { return !!(msp() && msp().connected() && !sdk.fail); }
  function pickEngine(src) { return src === 'file' ? 'file' : src === 'youtube' ? 'yt' : src === 'spotify' ? (sdkWanted() ? 'sdk' : 'embed') : 'lofi'; }

  /* file */
  var audio = null;
  function aud() {
    if (audio) return audio;
    audio = new Audio(); audio.preload = 'metadata';
    var mine = function () { return S.engine === 'file'; };
    audio.addEventListener('playing', function () { if (!mine()) return; S.playing = true; S.buffering = false; paint(); });
    audio.addEventListener('play', function () { if (!mine()) return; S.playing = true; paint(); });
    audio.addEventListener('pause', function () { if (!mine()) return; S.playing = false; S.buffering = false; paint(); });
    audio.addEventListener('waiting', function () { if (!mine()) return; S.buffering = true; paint(); });
    audio.addEventListener('canplay', function () { if (!mine()) return; if (S.buffering) { S.buffering = false; paint(); } });
    audio.addEventListener('durationchange', function () { if (!mine()) return; if (isFinite(audio.duration)) { S.dur = audio.duration * 1000; paint(); } });
    audio.addEventListener('timeupdate', function () { if (!mine()) return; S.pos = audio.currentTime * 1000; progress(); bcast(); });
    audio.addEventListener('ended', function () { if (!mine()) return; S.playing = false; S.pos = 0; paint(); });
    audio.addEventListener('error', function () { if (!mine() || !audio.getAttribute('src')) return; S.playing = false; S.buffering = false; S.err = 'This song couldn’t load. Check your connection and try again.'; paint(); });
    return audio;
  }
  function fileLoad(t, go) {
    var a = aud();
    if (a.getAttribute('src') !== t.audio) { a.src = t.audio; S.pos = 0; }
    if (go) {
      S.buffering = true; paint();
      a.play().catch(function () {
        if (!(S.quiet && !AP.off && S.track && S.track.audio === t.audio)) throw 0;
        a.muted = true; AP.muted = true; return a.play();             // sound blocked: play silently, a touch turns it on
      }).catch(function () { AP.muted = false; a.muted = false; S.buffering = false; paint(); });
    }
  }


  /* youtube (official IFrame player, shown in the expanded sheet) */
  var yt = { p: null, ready: false, want: false, busy: false, id: '', apiP: null, tick: 0 };
  function ytApi() {
    if (yt.apiP) return yt.apiP;
    yt.apiP = new Promise(function (res, rej) {
      if (window.YT && window.YT.Player) return res(window.YT);
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { try { prev && prev(); } catch (e) {} res(window.YT); };
      var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; s.async = true;
      s.onerror = function () { yt.apiP = null; rej(new Error('load')); }; document.head.appendChild(s);
    });
    return yt.apiP;
  }
  function ytId() { var y = S.track && youtube(S.track.url); return y ? y.id : ''; }
  function ytStopTick() { clearInterval(yt.tick); yt.tick = 0; }
  function ytStartTick() {
    if (yt.tick) return;
    yt.tick = setInterval(function () {
      if (S.engine !== 'yt' || !yt.p || !yt.ready) return;
      try {
        var d = yt.p.getDuration() || 0; if (d > 0) S.dur = d * 1000;
        S.pos = (yt.p.getCurrentTime() || 0) * 1000; progress(); bcast();
      } catch (e) {}
    }, 250);
  }
  function ytEnsure(then) {
    if (S.engine !== 'yt' || !S.track) return;
    var id = ytId(); if (!id) return;
    build();
    if (yt.p && yt.ready) {
      if (yt.id !== id) { yt.id = id; yt.want = !!then; try { then ? yt.p.loadVideoById(id) : yt.p.cueVideoById(id); } catch (e) {} }
      else if (then) then();
      return;
    }
    if (then) yt.want = true;
    if (yt.busy) return; yt.busy = true; yt.id = id;
    ytApi().then(function (YT) {
      var host = document.getElementById('mpx-yt'); if (!host) { yt.busy = false; return; }
      yt.p = new YT.Player(host, {
        videoId: id, width: '100%', height: '100%',
        playerVars: { playsinline: 1, controls: 1, rel: 0, modestbranding: 1, fs: 1, origin: location.origin },
        events: {
          onReady: function () {
            yt.ready = true; yt.busy = false;
            try { var v = yt.p.getVideoData && yt.p.getVideoData(); if (v && S.track && !S.track.title && v.title) { S.track.title = v.title; S.track.artist = S.track.artist || String(v.author || '').replace(/\s*-\s*Topic$/i, ''); paint(); loadLyrics(); } } catch (e) {}
            try { var d = yt.p.getDuration(); if (d > 0) S.dur = d * 1000; } catch (e) {}
            if (yt.want) { yt.want = false; try { yt.p.playVideo(); } catch (e) {} setTimeout(function () { if (S.engine === 'yt' && !S.playing && !S.buffering && !S.quiet) { S.reveal = true; setOpen(true); paint(); } }, 3500); }
            ytStartTick();
          },
          onStateChange: function (e) {
            if (S.engine !== 'yt') return;
            var st = e.data;                       // -1 unstarted · 0 ended · 1 playing · 2 paused · 3 buffering · 5 cued
            S.playing = st === 1 || st === 3; S.buffering = st === 3;
            if (st === 1) { S.reveal = false; S.err = ''; ytStartTick(); }
            if (st === 0) { S.playing = false; S.pos = 0; }
            try { var d = yt.p.getDuration(); if (d > 0) S.dur = d * 1000; } catch (x) {}
            paint();
          },
          onError: function (e) {
            var c = e && e.data; S.playing = false; S.buffering = false;
            S.err = c === 101 || c === 150 ? 'The owner of this video doesn’t allow it to play outside YouTube.' : c === 100 ? 'This video was removed or is private.' : 'YouTube couldn’t play this video.';
            paint();
          }
        }
      });
    }).catch(function () { yt.busy = false; S.err = 'YouTube’s player could not load (blocked or offline).'; paint(); });
  }
  function ytToggle() {
    if (yt.p && yt.ready && yt.id === ytId()) { try { var st = yt.p.getPlayerState(); if (st === 1 || st === 3) yt.p.pauseVideo(); else yt.p.playVideo(); } catch (e) {} return; }
    ytEnsure(function () { try { yt.p.playVideo(); } catch (e) {} });
  }

  /* sdk (Spotify Premium) */
  var sdk = { p: null, dev: '', fail: '', initP: null, loaded: '', at: 0, base: 0 };
  function sdkScript() {
    return new Promise(function (res, rej) {
      if (window.Spotify && window.Spotify.Player) return res();
      var prev = window.onSpotifyWebPlaybackSDKReady;
      window.onSpotifyWebPlaybackSDKReady = function () { try { prev && prev(); } catch (e) {} res(); };
      var s = document.createElement('script'); s.src = 'https://sdk.scdn.co/spotify-player.js'; s.async = true;
      s.onerror = function () { rej(new Error('load')); }; document.head.appendChild(s);
    });
  }
  function sdkFail(kind) {
    sdk.fail = kind; sdk.initP = null; sdk.dev = ''; sdk.loaded = '';
    if (sdk.p) { try { sdk.p.disconnect(); } catch (e) {} sdk.p = null; }
    if (S.engine === 'sdk') { S.engine = 'embed'; S.playing = false; S.buffering = false; paint(); }
  }
  function sdkInit() {
    if (sdk.initP) return sdk.initP;
    sdk.initP = sdkScript().then(function () {
      return new Promise(function (res, rej) {
        var done = false, to = setTimeout(function () { if (!done) { done = true; rej(new Error('timeout')); } }, 12000);
        var p = sdk.p = new Spotify.Player({ name: 'M-ID player', volume: 0.85, getOAuthToken: function (cb) { msp().token().then(cb, function () { sdkFail(''); }); } });
        p.addListener('ready', function (e) { sdk.dev = e.device_id; if (!done) { done = true; clearTimeout(to); res(); } });
        p.addListener('not_ready', function () { sdk.dev = ''; sdk.loaded = ''; });
        p.addListener('initialization_error', function () { if (!done) { done = true; clearTimeout(to); } rej(new Error('unsupported')); sdkFail('unsupported'); });
        p.addListener('authentication_error', function () { if (!done) { done = true; clearTimeout(to); } rej(new Error('auth')); msp().disconnect(); sdkFail(''); });
        p.addListener('account_error', function () { if (!done) { done = true; clearTimeout(to); } rej(new Error('premium')); sdkFail('premium'); });
        p.addListener('playback_error', function () { S.buffering = false; S.err = 'Spotify couldn’t play this one.'; paint(); });
        p.addListener('player_state_changed', function (st) {
          if (S.engine !== 'sdk') return;
          if (!st) { S.playing = false; S.buffering = false; sdk.loaded = ''; paint(); return; }   // moved to another device
          S.playing = !st.paused; S.buffering = !!st.loading; sdk.base = S.pos = st.position; sdk.at = performance.now(); S.dur = st.duration || S.dur; S.err = '';
          var ct = st.track_window && st.track_window.current_track, t = S.track;
          if (ct && t) {
            var title = ct.name || '', artist = (ct.artists || []).map(function (a) { return a.name; }).join(', ');
            var img = ((ct.album && ct.album.images) || []).slice().sort(function (a, b) { return (b.width || 0) - (a.width || 0); })[0];
            var changed = t.type !== 'track' ? t.title !== title : !t.artist && artist;
            if (t.type !== 'track' || !t.title) t.title = title;
            if (t.type !== 'track' || !t.artist) t.artist = artist;
            if ((t.type !== 'track' || !t.art) && img && img.url) t.art = img.url;
            if (changed) loadLyrics();
          }
          paint();
        });
        p.connect().then(function (ok) { if (!ok && !done) { done = true; clearTimeout(to); rej(new Error('connect')); } });
      });
    }).catch(function (e) { if (!sdk.fail) sdkFail(e && e.message === 'premium' ? 'premium' : 'unsupported'); throw e; });
    return sdk.initP;
  }
  function sdkStart(t) {
    var sp = spotify(t.url); if (!sp) return;
    if (sdk.p && sdk.p.activateElement) { try { sdk.p.activateElement(); } catch (e) {} }     // must run inside the tap (mobile autoplay rules)
    S.buffering = true; S.err = ''; paint();
    var body = sp.type === 'track' || sp.type === 'episode' ? { uris: [sp.uri] } : { context_uri: sp.uri };
    sdkInit().then(function () { return msp().token(); }).then(function (tok) {
      return fetch('https://api.spotify.com/v1/me/player/play?device_id=' + encodeURIComponent(sdk.dev), {
        method: 'PUT', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    }).then(function (r) {
      if (r.status === 403) { sdkFail('premium'); return; }
      if (!r.ok && r.status !== 202) throw new Error('play ' + r.status);
      sdk.loaded = sp.uri;
    }).catch(function () {
      S.buffering = false;
      if (S.engine === 'embed') toggle(); else { S.err = 'Spotify didn’t start. Tap play to try again.'; paint(); }
    });
  }
  setInterval(function () {                                           // the SDK reports position on changes only: tick between them
    if (S.engine !== 'sdk' || !S.playing || S.buffering) return;
    S.pos = Math.min(S.dur || Infinity, sdk.base + (performance.now() - sdk.at)); progress(); bcast();
  }, 500);

  /* embed (official player, hidden) */
  function resetCtrl() {
    if (ctrl) { try { ctrl.destroy(); } catch (e) {} }
    ctrl = null; ctrlReady = false; pendingUri = ''; ensureCtrl.busy = false; if (S.engine === 'embed') S.playing = false;
    var wrap = el.sheet && el.sheet.querySelector('.mpx-embed-wrap'); if (wrap) wrap.innerHTML = '<div id="mpx-embed"></div>';
    paint();
  }
  function api() {
    if (apiP) return apiP;
    apiP = new Promise(function (res, rej) {
      var prev = window.onSpotifyIframeApiReady;
      window.onSpotifyIframeApiReady = function (IFrameAPI) { try { prev && prev(IFrameAPI); } catch (e) {} res(IFrameAPI); };
      var s = document.createElement('script'); s.src = 'https://open.spotify.com/embed/iframe-api/v1'; s.async = true;
      s.onerror = function () { apiP = null; rej(new Error('Spotify player could not load')); };
      document.head.appendChild(s);
    });
    return apiP;
  }
  function ensureCtrl(then) {
    if (S.engine !== 'embed' || !S.track) return;
    var sp = spotify(S.track.url); if (!sp) return;
    build();
    if (ctrl) { if (pendingUri !== sp.uri) { pendingUri = sp.uri; try { ctrl.loadUri(sp.uri); } catch (e) {} } if (then) then(); return; }
    if (ensureCtrl.busy) return; ensureCtrl.busy = true;
    pendingUri = sp.uri;
    api().then(function (IFrameAPI) {
      var host = document.getElementById('mpx-embed');
      IFrameAPI.createController(host, { uri: pendingUri, width: '100%', height: 80, theme: 'dark' }, function (c) {
        ctrl = c; ensureCtrl.busy = false;
        c.addListener('ready', function () { ctrlReady = true; if (then) then(); });
        c.addListener('playback_update', function (e) {
          if (S.engine !== 'embed') return;
          var d = e && e.data || {};
          S.playing = !d.isPaused; S.buffering = !!d.isBuffering; S.pos = d.position || 0; S.dur = d.duration || S.dur;
          if (S.playing) S.reveal = false;
          paint();
        });
      });
    }).catch(function () {
      ensureCtrl.busy = false; S.err = 'Spotify’s player could not load (blocked or offline).'; paint();
    });
  }
  function embedPlay() { ensureCtrl(function () { try { ctrl.play ? ctrl.play() : ctrl.togglePlay(); } catch (e) {} }); }

  function connect() {
    var m = msp(); if (!m) return;
    m.connect().catch(function (e) { S.err = (e && e.message) || 'Spotify sign-in could not start.'; paint(); });
  }
  function disconnect() {
    if (S.engine === 'sdk' && sdk.p) { try { sdk.p.pause(); } catch (e) {} }
    var m = msp(); if (m) m.disconnect();
  }
  /* connecting or disconnecting (here or in another tab) switches the engine for the song on screen */
  function authChanged() {
    sdk.fail = '';
    if (S.src !== 'spotify') { paint(); return; }
    var want = pickEngine('spotify'); if (want === S.engine) { paint(); return; }
    if (S.engine === 'embed' && ctrl && S.playing) { try { ctrl.pause(); } catch (e) {} }
    if (S.engine === 'sdk' && sdk.p) { try { sdk.p.pause(); } catch (e) {} }
    S.engine = want; S.playing = false; S.buffering = false; S.pos = 0; sdk.loaded = ''; S.reveal = false;
    if (want === 'sdk') sdkInit().catch(function () {});
    paint();
  }
  if (msp()) { msp().onChange(authChanged); msp().config().then(function (id) { S.canConnect = !!id; paint(); }); }

  /* ───── controls ───── */
  function toggle() {
    if (!S.track) return;
    S.err = ''; S.quiet = false; AP.off = true; if (AP.muted) apUnmute();
    if (S.engine === 'lofi') { var f = starFrame(); if (f) try { f.contentWindow.postMessage({ maple: 'lofi', act: 'toggle' }, location.origin); } catch (e) {} return; }
    if (S.engine === 'yt') { ytToggle(); return; }
    if (S.engine === 'file') { var a = aud(); if (a.getAttribute('src') !== S.track.audio) fileLoad(S.track, true); else if (a.paused) a.play().catch(function () {}); else a.pause(); return; }
    if (S.engine === 'sdk') {
      var sp = spotify(S.track.url);
      if (sdk.p && sdk.dev && sp && sdk.loaded === sp.uri) { try { sdk.p.togglePlay(); } catch (e) {} } else sdkStart(S.track);
      return;
    }
    if (ctrl && ctrlReady) { try { ctrl.togglePlay(); } catch (e) {} return; }
    embedPlay();
    // some browsers only start Spotify from a tap inside its own player: show it if nothing started
    setTimeout(function () { if (!S.playing && !S.buffering && S.engine === 'embed') { S.reveal = true; setOpen(true); paint(); } }, 3500);
  }
  function seekMs(ms) {
    ms = Math.max(0, Math.min(S.dur || ms, ms));
    if (S.engine === 'file') { if (audio) audio.currentTime = ms / 1000; }
    else if (S.engine === 'yt') { if (yt.p && yt.ready) { try { yt.p.seekTo(ms / 1000, true); } catch (e) {} S.pos = ms; } }
    else if (S.engine === 'sdk') { if (sdk.p) { try { sdk.p.seek(Math.round(ms)); } catch (e) {} sdk.base = S.pos = ms; sdk.at = performance.now(); } }
    else if (S.engine === 'embed' && ctrl) { try { ctrl.seek(Math.round(ms / 1000)); } catch (e) {} }
    progress();
  }
  function skip(sec) { if (S.dur) seekMs(S.pos + sec * 1000); }
  function pauseAll() {
    if (audio && !audio.paused) audio.pause();
    if (yt.p && yt.ready && S.engine === 'yt') { try { yt.p.pauseVideo(); } catch (e) {} }
    if (sdk.p && S.engine === 'sdk' && S.playing) { try { sdk.p.pause(); } catch (e) {} }
    if (ctrl && S.engine === 'embed' && S.playing) { try { ctrl.pause(); } catch (e) {} }
    if (S.engine === 'lofi' && S.playing) { var f = starFrame(); if (f) try { f.contentWindow.postMessage({ maple: 'lofi', act: 'stop' }, location.origin); } catch (e) {} }
  }
  function stop() {
    pauseAll();
    S.playing = false; S.dismissed = (S.track && S.track.slug) || '*';
    show(false);
  }
  function load(track, src, autoplay) {
    var same = S.track && S.track.url === track.url && S.src === src;
    if (!same) pauseAll();
    S.src = src; S.track = track; S.engine = pickEngine(src);
    if (!same) { S.pos = 0; S.dur = track.durationMs || 0; S.err = ''; S.reveal = false; sdk.loaded = ''; if (src !== 'lofi') S.playing = false; lyr.key = ''; lyr.lines = null; lyr.plain = ''; lyr.msg = src === 'lofi' ? 'The built-in theme music has no lyrics.' : (track.lyrics ? 'Tap play to start the music.' : ''); lyr.ver++; }
    build(); show(true); paint();
    if ((src === 'spotify' || src === 'youtube') && !same && track.url && !(track.title && track.art) && window.MX) {
      MX.meta(track.url).then(function (m) {
        if (!m || S.track !== track) return;
        var mt = m.title, ma = m.artist;
        if (src === 'youtube' && mt) { var c0 = lyrCandidates({ title: mt, artist: ma })[0]; if (c0) { mt = c0.title; ma = c0.artist || ma; } }   // "Artist - Title (Official Video)" → clean title + artist
        track.title = track.title || mt; track.artist = track.artist || ma; track.art = track.art || m.art; if (src === 'spotify') track.type = m.type || track.type;
        if (m.durationMs) { track.fullMs = m.durationMs; if (!S.dur) S.dur = m.durationMs; }
        paint(); if (S.open || inlineNow() || S.deckLyr) loadLyrics();
      });
    }
    if (S.engine === 'file') fileLoad(track, !!autoplay);
    else if (S.engine === 'sdk') { if (autoplay) sdkStart(track); else sdkInit().catch(function () {}); }
    else if (S.engine === 'embed' && (autoplay || ctrl)) { if (autoplay) embedPlay(); else ensureCtrl(); }
    else if (S.engine === 'yt') { if (autoplay) ytEnsure(function () { try { yt.p.playVideo(); } catch (e) {} }); else if (yt.p && yt.ready) ytEnsure(); }
    if (S.open || inlineNow() || S.deckLyr) loadLyrics();
  }
  function trackOf(t, p) {
    p = p || {};
    if (t && t.audio && /^https:\/\/qebbuxixnqsqjuprfpyv\.supabase\.co\/storage\/v1\/object\/public\/song-media\/[0-9a-f-]{36}\/[a-z0-9]{8,24}\.(?:mp3|m4a|aac|ogg|wav|flac|webm)$/.test(t.audio))
      return { audio: t.audio, url: t.audio, type: 'track', title: t.title || 'Untitled', artist: t.artist || '', art: t.art || '', durationMs: t.durationMs || 0, owner: t.owner || p.name || '', slug: t.slug || p.slug || '', lyrics: !!t.lyrics };
    var yv = t && !spotify(t.url) ? youtube(t.url) : null;
    if (yv) return { url: yv.url, type: 'video', title: t.title || '', artist: t.artist || '', art: t.art || '', owner: t.owner || p.name || '', slug: t.slug || p.slug || '', lyrics: !!t.lyrics };
    var sp = spotify(t && t.url); if (!sp) return null;
    return { url: sp.url, type: sp.type, title: t.title || '', artist: t.artist || '', art: t.art || '', owner: t.owner || p.name || '', slug: t.slug || p.slug || '', lyrics: !!t.lyrics };
  }
  /* a song from "Music I Like" (or any caller) */
  function play(t) {
    var tr = trackOf(t); if (!tr) return;
    S.dismissed = '';
    load(tr, tr.audio ? 'file' : srcOf(tr.url), true);
    if (!inlineNow()) setOpen(true);                                   // star cards play it in their own Audio Player
  }

  /* ───── autoplay: opening a profile starts THAT profile's song ─────
     Browsers only allow sound after a tap/click. Most visits come from a tap (opening a card), so playback starts at once.
     If the browser refuses (e.g. the page was opened from a link), the song starts on the visitor's first tap anywhere.
     Pressing pause yourself switches this off for that song. */
  var AP = { url: '', off: false, armed: false, muted: false };
  function apUnmute() { AP.muted = false; try { if (audio) audio.muted = false; } catch (e) {} try { if (yt.p && yt.ready && yt.p.unMute) yt.p.unMute(); } catch (e) {} }
  function apDisarm() { AP.armed = false; ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (t) { document.removeEventListener(t, apGesture, true); }); }
  function apGesture(e) {
    if (!S.track || S.track.url !== AP.url) return apDisarm();
    if (AP.muted) { apUnmute(); return apDisarm(); }                   // it has been playing silently: the first touch turns the sound on
    if (AP.off || S.playing) return apDisarm();
    if (S.buffering) return;                                           // the automatic attempt is still in flight
    if (e && e.target && (el.mini.contains(e.target) || el.sheet.contains(e.target))) return;   // the player's own buttons handle themselves
    apDisarm(); toggle();
    if (S.engine === 'yt') setTimeout(function () { if (S.engine === 'yt' && !S.playing && !S.buffering) { S.reveal = true; setOpen(true); paint(); } }, 3500);
  }
  function autoLoad(track, src) {
    apUnmute(); AP.url = track.url; AP.off = false; S.quiet = true;   // quiet: no pop-up player if the browser says no
    load(track, src, true);
    if (src === 'youtube') [2500, 5500].forEach(function (ms) { setTimeout(function () {   // YouTube refused sound: start it muted, a touch unmutes it
      if (S.engine !== 'yt' || !S.track || S.track.url !== track.url || AP.off || AP.muted || S.playing || !yt.p || !yt.ready) return;
      try { yt.p.mute(); yt.p.playVideo(); AP.muted = true; } catch (e) {}
    }, ms); });
    if (!AP.armed) { AP.armed = true; ['pointerdown', 'touchend', 'click', 'keydown'].forEach(function (t) { document.addEventListener(t, apGesture, true); }); }
  }

  /* ───── which profile is on screen → what the player offers ───── */
  function sync() {
    var p = profileNow();
    if (p && p.music !== false && S.dismissed !== p.slug) {
      var own = p.song && p.song.audio ? trackOf(p.song, p) : null;
      if (own) {
        S.compact = p.musicAuto === false;
        if (!S.track || S.track.slug !== p.slug || (!S.playing && S.track.url !== own.url && S.track.slug === p.slug)) { own.lyrics = p.lyrics !== false; autoLoad(own, 'file'); }
        else { if (S.track.slug === p.slug) S.track.lyrics = p.lyrics !== false; show(true); paint(); }
        return;
      }
      var sp = spotify(p.spotify) || youtube(p.spotify), spSrc = srcOf(p.spotify);
      if (sp) {
        S.compact = p.musicAuto === false;
        if (!S.track || S.track.slug !== p.slug || (!S.playing && S.track.url !== sp.url && S.track.slug === p.slug))
          autoLoad({ url: sp.url, type: sp.type, title: '', artist: '', art: '', owner: p.name || '', slug: p.slug, lyrics: p.lyrics !== false }, spSrc);
        else { if (S.track.slug === p.slug) S.track.lyrics = p.lyrics !== false; show(true); paint(); }
        return;
      }
      if (p.layout === 'star' && !(S.src !== 'lofi' && S.playing)) {
        S.compact = p.musicAuto === false;
        load({ url: 'lofi:' + p.slug, title: 'Theme music', artist: '', owner: p.name || '', slug: p.slug }, 'lofi', false);
        return;
      }
    }
    if (S.playing && S.src !== 'lofi') { show(true); return; }        // keeps playing while you browse
    show(false);
  }
  var syncT = 0; function soon() { clearTimeout(syncT); syncT = setTimeout(sync, 60); }
  function setProfile(which, p) { if (which === 'card' || which === 'profile') { (window.__mxCtx = window.__mxCtx || {})[which] = p || null; try { window.dispatchEvent(new CustomEvent('maple:ctx')); } catch (e) {} } }
  window.addEventListener('maple:ctx', soon);

  /* ───── lyrics (LRCLIB) ───── */
  function parseLrc(s) {
    var out = [];
    String(s || '').split(/\r?\n/).forEach(function (ln) {
      var m = ln.match(/^\s*\[(\d+):(\d+(?:\.\d+)?)\](.*)$/); if (!m) return;
      out.push({ t: (Number(m[1]) * 60 + Number(m[2])) * 1000, x: m[3].trim() });
    });
    return out.length ? out : null;
  }
  function lyricState(html) { el.lbody.innerHTML = '<div class="mpx-lstate">' + html + '</div>'; lyr.msg = html.replace(/<\/(b|span)>/g, '. ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/\.\s*\.?\s*$/, '').trim(); lyr.lines = null; lyr.plain = ''; lyr.ver++; bcast(); }
  /* strip the noise YouTube titles carry: (Official Video), [Lyrics], "| Channel", feat. …, "- Topic" */
  var NOISE = /official|lyric|video|audio|visuali[sz]er|\bm\/?v\b|\bhd\b|\b4k\b|remaster|full (song|version)|explicit|karaoke|sub(title)?s?\b|terjemahan|\bcc\b/i;
  function tidy(s) {
    return String(s || '').replace(/[\(\[\{【「『][^\)\]\}】」』]*[\)\]\}】」』]/g, function (m) { return NOISE.test(m) ? '' : m; })
      .replace(/\s*[|｜•·].*$/, '').replace(/\b(official\s+(music\s+)?(video|audio)|lyric\s+video|lyrics?\s+video|music\s+video|lyrics?)\b/gi, '')
      .replace(/\s+/g, ' ').replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '').trim();
  }
  function noFeat(s) { return s.replace(/\s*[\(\[]?\s*(feat|ft|featuring|with)\.?\s+[^\)\]]*[\)\]]?\s*$/i, '').trim(); }
  /* the (title, artist) pairs worth trying, best guess first */
  function lyrCandidates(t) {
    var title = tidy(t.title), artist = tidy(String(t.artist || '').split(/,|&| x /i)[0]).replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
    var out = [], seen = {};
    function add(ti, ar) { ti = noFeat(ti || '').trim(); ar = (ar || '').trim(); if (!ti) return; var k = (ti + '|' + ar).toLowerCase(); if (seen[k]) return; seen[k] = 1; out.push({ title: ti, artist: ar }); }
    var m = title.match(/^(.+?)\s+[-–—~]\s+(.+)$/);
    if (m) { add(m[2], m[1]); add(m[1], m[2]); }          // "Artist - Title" (or the other way round)
    add(title, artist);
    if (artist && title.toLowerCase().indexOf(artist.toLowerCase()) === 0) add(title.slice(artist.length).replace(/^[\s\-–—:]+/, ''), artist);
    add(title, '');
    return out.slice(0, 5);
  }
  function lrcRead(r) { if (r.status === 404) return null; if (!r.ok) throw new Error('lrclib ' + r.status); return r.json(); }
  function lrcFetch(path) {
    return fetch('https://lrclib.net/api/' + path).then(lrcRead).catch(function () {   // blocked / offline / CORS → ask our own server to fetch it
      return fetch('/api/lyrics?p=' + encodeURIComponent(path)).then(lrcRead);
    });
  }
  /* LRCLIB is a community database and holds test/spam entries (a single word like "probe"): only accept real-looking lyrics
     that fit the song's length */
  function hasLyrics(d) {
    if (!d) return false;
    if (d.instrumental) return true;
    var txt = String(d.syncedLyrics || d.plainLyrics || '').replace(/\[[^\]]*\]/g, ''), words = (txt.match(/\S+/g) || []).length;
    if (words < 25) return false;
    if (S.dur && d.duration && Math.abs(d.duration * 1000 - S.dur) > 20000) return false;
    return true;
  }
  function pickBest(list) {
    list = (Array.isArray(list) ? list : []).filter(hasLyrics); if (!list.length) return null;
    list.sort(function (a, b) {
      var sa = a.syncedLyrics ? 0 : 1, sb = b.syncedLyrics ? 0 : 1; if (sa !== sb) return sa - sb;
      return S.dur ? Math.abs((a.duration || 0) * 1000 - S.dur) - Math.abs((b.duration || 0) * 1000 - S.dur) : 0;
    });
    return list[0];
  }
  /* try LRCLIB's exact match, then its fuzzy search, for each candidate, until something with lyrics turns up */
  function findLyrics(t) {
    var cands = lyrCandidates(t), steps = [], dur = S.dur ? '&duration=' + Math.round(S.dur / 1000) : '';
    cands.forEach(function (c) {
      var q = 'track_name=' + encodeURIComponent(c.title) + (c.artist ? '&artist_name=' + encodeURIComponent(c.artist) : '');
      if (c.artist) steps.push(function () { return lrcFetch('get?' + q + dur).then(function (d) { return hasLyrics(d) ? d : null; }); });
      steps.push(function () { return lrcFetch('search?' + q).then(pickBest); });
    });
    var c0 = cands[0]; if (c0) steps.push(function () { return lrcFetch('search?q=' + encodeURIComponent((c0.artist + ' ' + c0.title).trim())).then(pickBest); });
    var i = 0, failed = 0;
    return (function next() {
      if (i >= steps.length) { if (failed === steps.length && steps.length) throw new Error('offline'); return Promise.resolve(null); }
      return steps[i++]().catch(function () { failed++; return null; }).then(function (d) { return d || next(); });
    })();
  }
  var NOLYR = '<i class="fa-regular fa-file-lines"></i><b>No lyrics found for this song</b><span>Lyrics aren’t available for every track.</span><button type="button" class="mpx-lfind big" data-mpx="lsearch"><i class="fa-solid fa-magnifying-glass"></i> Search lyrics manually</button>';
  function showLyrics(d) {
    if (!d) return lyricState(NOLYR);
    if (d.instrumental) return lyricState('<i class="fa-solid fa-guitar"></i><b>Instrumental</b><span>Just the music on this one.</span>');
    lyr.lines = parseLrc(d.syncedLyrics); lyr.plain = d.plainLyrics || '';
    el.sheet.querySelector('.mpx-lsrc').innerHTML = d.custom ? 'Added by the owner' : (lyr.lines ? 'Synced · ' : '') + 'via <a href="https://lrclib.net" target="_blank" rel="noopener noreferrer">LRCLIB</a>';
    if (lyr.lines) el.lbody.innerHTML = '<ol class="mpx-lines">' + lyr.lines.map(function (l, i) { return '<li data-i="' + i + '">' + (esc(l.x) || '♪') + '</li>'; }).join('') + '</ol>';
    else if (lyr.plain) el.lbody.innerHTML = '<div class="mpx-plain">' + esc(lyr.plain).replace(/\n/g, '<br>') + '</div><p class="mpx-lhint">These lyrics aren’t time-synced, so they don’t follow along.</p>';
    else return lyricState(NOLYR);
    lyr.msg = ''; lyr.ver++; lyr.cur = -1; syncLyric(); bcast();
  }
  /* manual search: the person types a title / artist, picks the right result */
  function lyricForm(on) {
    var f = el.sheet.querySelector('.mpx-lform'), t = S.track || {}; f.hidden = on === false ? true : !f.hidden || on === true ? false : true;
    if (!f.hidden) { var c = lyrCandidates(t)[0] || {}; if (!f.elements.title.value) f.elements.title.value = c.title || tidy(t.title); if (!f.elements.artist.value) f.elements.artist.value = c.artist || ''; setTimeout(function () { f.elements.title.focus(); }, 30); }
    else el.sheet.querySelector('.mpx-lres').hidden = true;
  }
  function lyricManual(title, artist) {
    var q = (String(artist || '') + ' ' + String(title || '')).trim(), box = el.sheet.querySelector('.mpx-lres'); if (!q) return;
    box.hidden = false; box.innerHTML = '<p class="mpx-lmsg"><i class="fa-solid fa-circle-notch fa-spin"></i> Searching…</p>';
    var tn = encodeURIComponent(String(title || '').trim()), an = String(artist || '').trim();
    var first = tn ? 'search?track_name=' + tn + (an ? '&artist_name=' + encodeURIComponent(an) : '') : 'search?q=' + encodeURIComponent(q);
    lrcFetch(first).then(function (l) { return (Array.isArray(l) && l.length) ? l : lrcFetch('search?q=' + encodeURIComponent(q)); }).then(function (list) {
      list = (Array.isArray(list) ? list : []).filter(hasLyrics).slice(0, 8); lyr.results = list;
      if (!list.length) { box.innerHTML = '<p class="mpx-lmsg">Nothing found. Try just the song title, or check the spelling.</p>'; return; }
      box.innerHTML = list.map(function (d, i) {
        return '<button type="button" class="mpx-lrow" data-mpx="lpick" data-i="' + i + '"><b>' + esc(d.trackName || d.name || 'Untitled') + '</b><span>' + esc(d.artistName || '') + (d.albumName ? ' · ' + esc(d.albumName) : '') + '</span>' + (d.syncedLyrics ? '<em>Synced</em>' : '') + '</button>';
      }).join('');
    }).catch(function () { box.innerHTML = '<p class="mpx-lmsg">Couldn’t reach the lyrics service. Check your connection and try again.</p>'; });
  }
  function lyricPick(i) {
    var d = lyr.results && lyr.results[i], t = S.track; if (!d || !t) return;
    var key = t.url + '|' + t.title + '|' + t.artist + '|' + (S.dur ? Math.round(S.dur / 5000) : 0);
    lyr.key = key; lyr.manual = { url: t.url, d: d };
    showLyrics(d); lyricForm(false);
  }
  /* lyrics the profile owner picked in Studio (saved on the profile as lyricsFix) win over the automatic lookup */
  function fixFor(t) {
    var p = profileNow(), f = p && p.lyricsFix;
    if (!f || !t || (p.slug && t.slug && p.slug !== t.slug)) return null;
    if (f.url !== t.url && f.url !== t.audio) return null;
    if (!(f.syncedLyrics || f.plainLyrics || f.instrumental)) return null;
    return f;
  }
  function loadLyrics() {
    var t = S.track; if (!(S.open || inlineNow() || S.deckLyr) || !lyrOk(t)) return;
    if (!t.title) { lyricState('<i class="fa-solid fa-circle-notch fa-spin"></i> Looking up the song…<button type="button" class="mpx-lfind big" data-mpx="lsearch"><i class="fa-solid fa-magnifying-glass"></i> Search lyrics manually</button>'); return; }
    var key = t.url + '|' + t.title + '|' + t.artist + '|' + (S.dur ? Math.round(S.dur / 5000) : 0); if (lyr.key === key) return;
    lyr.key = key; lyr.lines = null; lyr.plain = ''; lyr.cur = -1;
    lyricState('<i class="fa-solid fa-circle-notch fa-spin"></i> Finding lyrics…');
    el.sheet.querySelector('.mpx-lsrc').innerHTML = '';
    (lyr.manual && lyr.manual.url === t.url ? Promise.resolve(lyr.manual.d) : fixFor(t) ? Promise.resolve(fixFor(t)) : findLyrics(t)).then(function (d) {
      if (lyr.key !== key) return;
      showLyrics(d);
    }).catch(function () {
      if (lyr.key !== key) return; lyr.key = '';
      lyricState('<i class="fa-solid fa-wifi"></i><b>Lyrics couldn’t load</b><span>Check your connection and reopen the player.</span>');
    });
  }
  function syncLyric() {
    if (!S.open || !lyr.lines) return;
    var pos = S.pos + 250, i = -1;
    for (var k = 0; k < lyr.lines.length; k++) { if (lyr.lines[k].t <= pos) i = k; else break; }
    if (i === lyr.cur) return;
    var ol = el.lbody.querySelector('.mpx-lines'); if (!ol) return;
    var prev = ol.querySelector('.on'); if (prev) prev.classList.remove('on');
    lyr.cur = i; if (i < 0) return;
    var li = ol.children[i]; if (!li) return; li.classList.add('on');
    if (Date.now() - lyr.userAt > 3500) {
      var top = li.offsetTop - el.lbody.clientHeight / 2 + li.offsetHeight / 2;
      el.lbody.scrollTo({ top: Math.max(0, top), behavior: REDUCE.matches ? 'auto' : 'smooth' });
    }
  }

  /* ───── messages from card iframes ───── */
  window.addEventListener('message', function (e) {
    var d = e.data; if (e.origin !== location.origin || !d) return;
    if (d.maple === 'mp-play' && d.track) play(d.track);
    else if (d.maple === 'mp-ctl') {
      var a = d.act;
      if (a === 'hello') { S.inline = (d.v && d.v.slug) || ''; lyr.sent = -1; soon(); setTimeout(function () { if (inlineNow()) loadLyrics(); space(); bcast(); }, 200); }
      else if (a === 'toggle') toggle();
      else if (a === 'back' || a === 'fwd') skip(a === 'fwd' ? 10 : -10);
      else if (a === 'seek' && S.dur) seekMs(S.dur * Math.min(1, Math.max(0, Number(d.v) || 0)));
      else if (a === 'seekms') seekMs(Math.max(0, Number(d.v) || 0));
      else if (a === 'lsearch') { if (S.track) { setOpen(true); lyricForm(true); } }
      else if (a === 'login') connect();
    }
    else if (d.maple === 'lofi-state') {
      S.lofiName = String(d.name || ''); if (S.engine === 'lofi') { S.playing = !!d.playing; paint(); }
    }
  });
  new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ['data-page'] });
  window.addEventListener('popstate', soon);
  soon();

  window.MaplePlayer = { setProfile: setProfile, play: play, ctl: function (a) { if (a === 'toggle') toggle(); else if (a === 'back' || a === 'fwd') skip(a === 'fwd' ? 10 : -10); }, open: function () { setOpen(true); }, close: function () { setOpen(false); }, state: function () { return S; },
    /* the Sections layout's Audio Player slide reads the lyrics too */
    searchLyrics: function () { if (!S.track) return; setOpen(true); lyricForm(true); },
    lyrics: function (want) { if (want !== undefined) { S.deckLyr = !!want; if (want && S.track) loadLyrics(); } return { lines: lyr.lines, plain: lyr.plain, msg: lyr.msg, ver: lyr.ver, ok: lyrOk(S.track) }; } };
})();
