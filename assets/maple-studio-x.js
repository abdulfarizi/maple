/* M-ID · Studio "Music & anime" tab (v31)
 * Manages the owner's Music I Like list, Anime shelf and allowed visitor themes. The data is handed to the
 * Studio's normal Publish flow through window.__mx(), so it is saved with the rest of the profile (Supabase,
 * same record as everything else) and visitors only ever see what was published. */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var MAX_M = 24, MAX_A = 48;
  var st = null, form = null, searchT = 0, searchN = 0;

  function dirty(node) { (node || form).dispatchEvent(new Event('input', { bubbles: true })); }
  function val(n) { var i = form && form.elements.namedItem(n); return i ? String(i.value || '').trim() : ''; }
  function snapshot() {
    var pin = st.song && st.music.filter(function (x) { return x.audio === st.song; })[0];
    return { musicLikes: st.music.map(function (x) { return x.audio ? { audio: x.audio, title: x.title, artist: x.artist, art: x.art, durationMs: x.durationMs || 0, note: x.note }
        : { url: x.url, title: x.title, artist: x.artist, art: x.art, note: x.note }; }),
      song: pin ? { audio: pin.audio, title: pin.title, artist: pin.artist, art: pin.art, durationMs: pin.durationMs || 0 } : null,
      anime: st.anime.map(function (x) { return Object.assign({}, x); }), themes: st.themes.slice(),
      musicTitle: val('musicTitle'), musicSub: val('musicSub'), animeTitle: val('animeTitle'), animeSub: val('animeSub') };
  }

  /* ───── music ───── */
  function musicUI() {
    var box = form.querySelector('[data-mxs-music]'); if (!box) return;
    box.innerHTML = '<div class="mxs-add"><input type="text" inputmode="url" maxlength="200" data-mxs-url placeholder="Paste a Spotify or YouTube link" aria-label="Spotify or YouTube link to add">'
      + '<button type="button" class="btn btn-sm btn-accent" data-mxs-addsong><i class="fa-solid fa-plus"></i> Add</button></div>'
      + '<div class="mxs-up"><label class="btn btn-sm"><i class="fa-solid fa-upload"></i> Upload a song<input type="file" accept="audio/*,.mp3,.m4a,.aac,.ogg,.wav,.flac" data-mxs-file hidden></label>'
      + '<small>MP3, M4A, OGG, WAV or FLAC, up to 18 MB. Uploaded songs play in full for every visitor. Only upload music you own or have permission to share.</small></div>'
      + '<div class="mxs-prog" data-mxs-prog hidden><i></i></div>'
      + '<p class="mxs-msg" data-mxs-mmsg role="status"></p><ol class="mxs-list" data-mxs-mlist></ol>'
      + '<p class="eyebrow mxs-pv-h">Preview</p><div class="mxs-pv" data-mxs-mpv></div>';
    paintMusic();
  }
  function paintMusic() {
    var ol = form.querySelector('[data-mxs-mlist]'); if (!ol) return;
    ol.innerHTML = st.music.map(function (x, i) {
      return '<li class="mxs-row" data-i="' + i + '"><span class="mxs-thumb">' + (x.art ? '<img src="' + esc(x.art) + '" alt="">' : '<i class="fa-solid fa-music"></i>') + '</span>'
        + '<div class="mxs-fields"><input data-k="title" maxlength="120" placeholder="Song title" value="' + esc(x.title) + '" aria-label="Title">'
        + '<input data-k="artist" maxlength="120" placeholder="Artist" value="' + esc(x.artist) + '" aria-label="Artist">'
        + '<input data-k="note" maxlength="140" placeholder="Personal note (optional)" value="' + esc(x.note) + '" aria-label="Personal note">'
        + (x.audio ? '<div class="mxs-filebar"><span class="mxs-tag"><i class="fa-solid fa-file-audio"></i> Uploaded · full song</span>'
          + '<label class="btn btn-sm"><i class="fa-solid fa-image"></i> Cover<input type="file" accept="image/*" data-mxs-art hidden></label>'
          + '<button type="button" class="btn btn-sm' + (st.song === x.audio ? ' btn-accent' : '') + '" data-mxs-pin aria-pressed="' + (st.song === x.audio) + '"><i class="fa-solid fa-star"></i> ' + (st.song === x.audio ? 'Card song' : 'Use as card song') + '</button></div>' : '')
        + '</div>' + moveBtns(i, st.music.length) + '</li>';
    }).join('');
    preview();
  }
  function addSong() {
    var inp = form.querySelector('[data-mxs-url]'), msg = form.querySelector('[data-mxs-mmsg]'), sp = window.MX && MX.spotify(inp.value), yv = !sp && window.MX && MX.youtube && MX.youtube(inp.value);
    msg.className = 'mxs-msg';
    if (!sp && !yv) { msg.textContent = 'That doesn’t look like a Spotify or YouTube link. Copy it from Share → Copy link.'; msg.classList.add('bad'); return; }
    if (sp && !/^(track|album|playlist|episode)$/.test(sp.type)) { msg.textContent = 'Use a song, album or playlist link.'; msg.classList.add('bad'); return; }
    var link = (sp || yv).url, brand = sp ? 'Spotify' : 'YouTube';
    if (st.music.some(function (x) { return x.url === link; })) { msg.textContent = 'That one is already in your list.'; msg.classList.add('bad'); return; }
    if (st.music.length >= MAX_M) { msg.textContent = 'You can add up to ' + MAX_M + ' songs.'; msg.classList.add('bad'); return; }
    var item = { url: link, title: '', artist: '', art: '', note: '' };
    st.music.push(item); inp.value = ''; paintMusic(); dirty();
    msg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Getting the song details from ' + brand + '…';
    MX.meta(link).then(function (m) {
      if (m && m.title) { item.title = item.title || m.title; item.artist = item.artist || m.artist || ''; item.art = item.art || m.art || ''; }
      msg.textContent = m && m.title ? (m.artist ? 'Added. ' : 'Added. ' + brand + ' didn’t share the artist name, so type it in if you like. ') + 'Publish to save.' : 'Added, but ' + brand + ' didn’t return details. You can type the title and artist yourself.';
      paintMusic(); dirty();
    });
  }

  /* ───── uploaded songs (Supabase Storage, bucket song-media) ───── */
  var EXT_TYPE = { mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', oga: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', webm: 'audio/webm' };
  function typeOf(f) { var t = String(f.type || '').toLowerCase(); if (/^audio\//.test(t) && t !== 'audio/x-mpeg') return t === 'audio/mp3' ? 'audio/mpeg' : t; return EXT_TYPE[String(f.name || '').split('.').pop().toLowerCase()] || t; }
  function durationOf(f) {
    return new Promise(function (res) {
      var a = new Audio(), u = URL.createObjectURL(f), done = function (v) { URL.revokeObjectURL(u); res(v); };
      a.preload = 'metadata'; a.onloadedmetadata = function () { done(isFinite(a.duration) ? Math.round(a.duration * 1000) : 0); }; a.onerror = function () { done(-1); };
      setTimeout(function () { done(0); }, 8000); a.src = u;
    });
  }
  /* Supabase Storage upload (bucket "song-media"): one request, straight from the browser, authorised by the user's own session. */
  function sbPut(path, body, type, upsert, auth) {
    var sb = window.__mSb || {};
    return fetch(sb.url + '/storage/v1/object/song-media/' + path, {
      method: 'POST', body: body,
      headers: { apikey: sb.key, Authorization: 'Bearer ' + auth.token, 'Content-Type': type, 'Cache-Control': '31536000', 'x-upsert': upsert ? 'true' : 'false' }
    }).then(function (r) {
      if (r.ok) return sb.url + '/storage/v1/object/public/song-media/' + path;
      return r.json().catch(function () { return {}; }).then(function (d) {
        var m = String(d.message || d.error || '');
        if (/bucket not found/i.test(m) || r.status === 404) throw new Error('Song storage is not set up yet. Run supabase_songs.sql in the Supabase SQL editor.');
        if (/mime|not supported/i.test(m)) throw new Error('This file type is not allowed by the storage bucket. Re-run supabase_songs.sql.');
        if (r.status === 413 || /size|too large/i.test(m)) throw new Error('That file is too big for the storage bucket.');
        if (r.status === 401 || r.status === 403 || /row-level|policy|unauthor/i.test(m)) throw new Error('Storage refused the upload. Re-run supabase_songs.sql (upload policy).');
        throw new Error('Upload failed (' + r.status + ').');
      });
    });
  }
  function newId() { var a = new Uint8Array(12); crypto.getRandomValues(a); return Array.prototype.map.call(a, function (b) { return 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]; }).join(''); }
  function bar(f) { var b = form.querySelector('[data-mxs-prog]'); if (!b) return; b.hidden = f < 0; b.firstChild.style.width = Math.round(Math.max(0, f) * 100) + '%'; }
  function uploadSong(file) {
    var msg = form.querySelector('[data-mxs-mmsg]'); msg.className = 'mxs-msg';
    var bad = function (t) { msg.textContent = t; msg.classList.add('bad'); bar(-1); };
    if (st.music.length >= MAX_M) return bad('You can add up to ' + MAX_M + ' songs.');
    var type = typeOf(file);
    if (!EXT_TYPE[String(file.name || '').split('.').pop().toLowerCase()] && !/^audio\//.test(type)) return bad('That isn’t an audio file.');
    if (file.size > 18 * 1048576) return bad('That song is too big (max 18 MB). Try an MP3 at 192–256 kbps.');
    if (!window.__mAuth) return bad('Reload the page and try again.');
    var auth, dur = 0, ext = (Object.keys(EXT_TYPE).filter(function (k) { return EXT_TYPE[k] === type && k !== 'oga'; })[0]) || String(file.name || '').split('.').pop().toLowerCase();
    msg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Checking the file…'; bar(0);
    durationOf(file).then(function (d) {
      if (d < 0) throw new Error('This browser can’t play that file. MP3 or M4A works everywhere.');
      dur = d; return window.__mAuth();
    }).then(function (a) {
      if (!a) throw new Error('Your session expired. Log in again, then upload.');
      auth = a;
      msg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading ' + esc(file.name) + '…'; bar(0.4);
      return sbPut(auth.uid + '/' + newId() + '.' + ext, file, type, false, auth);
    }).then(function (url) {
      return readTags(file).then(function (tags) {
        var title = String(file.name || 'Untitled').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_]+/g, ' ').trim().slice(0, 120);
        var artist = '', m = title.match(/^(.+?)\s+-\s+(.+)$/); if (m) { artist = m[1]; title = m[2]; }
        if (tags && tags.title) { title = tags.title.slice(0, 120); artist = (tags.artist || artist).slice(0, 120); } else if (tags && tags.artist) artist = tags.artist.slice(0, 120);
        var item = { audio: url, title: title, artist: artist, art: '', durationMs: dur, note: '' };
        st.music.push(item);
        if (!st.song) st.song = url;
        paintMusic(); dirty(); bar(-1);
        msg.textContent = 'Uploaded' + (tags && (tags.title || tags.artist) ? ' (title and artist read from the file).' : '.') + ' Check the details, then Publish. Lyrics are found automatically from the title and artist.';
        if (tags && tags.art) {       // embedded cover art → the song's cover
          shrink(tags.art).then(function (b) { return sbPut(url.replace(/^.*\/song-media\//, '').replace(/\.[a-z0-9]+$/, '-art.jpg'), b, 'image/jpeg', true, auth); })
            .then(function (u) { item.art = u + '?v=' + Date.now().toString(36); paintMusic(); dirty(); }).catch(function () {});
        }
      });
    }).catch(function (e) { bad((e && e.message) || 'Upload failed. Try again.'); });
  }

  /* ───── automatic title / artist / cover from the file's own ID3 tags (MP3) ───── */
  function readTags(file) {
    if (!file.slice || !file.slice(0, 1).arrayBuffer) return Promise.resolve(null);
    return file.slice(0, 10).arrayBuffer().then(function (h) {
      var v = new Uint8Array(h);
      if (String.fromCharCode(v[0], v[1], v[2]) !== 'ID3') return null;
      var ver = v[3], size = ((v[6] & 127) << 21) | ((v[7] & 127) << 14) | ((v[8] & 127) << 7) | (v[9] & 127);
      return file.slice(0, Math.min(10 + size, 6 * 1048576)).arrayBuffer().then(function (buf) {
        var b = new Uint8Array(buf), out = { title: '', artist: '', art: null }, i = 10, end = b.length;
        if (v[5] & 0x40) { var ex = ver === 4 ? (((b[10] & 127) << 21) | ((b[11] & 127) << 14) | ((b[12] & 127) << 7) | (b[13] & 127)) : ((b[10] << 24) | (b[11] << 16) | (b[12] << 8) | b[13]) + 4; i += ex; }
        function dec(enc, a) {
          try { return new TextDecoder(enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : enc === 3 ? 'utf-8' : 'iso-8859-1').decode(a).replace(/\u0000+$/g, '').trim(); } catch (e) { return ''; }
        }
        while (i + 10 < end) {
          var id = String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]); if (!/^[A-Z0-9]{4}$/.test(id)) break;
          var sz = ver === 4 ? (((b[i + 4] & 127) << 21) | ((b[i + 5] & 127) << 14) | ((b[i + 6] & 127) << 7) | (b[i + 7] & 127)) : ((b[i + 4] * 16777216) + (b[i + 5] << 16) + (b[i + 6] << 8) + b[i + 7]);
          var body = b.subarray(i + 10, i + 10 + sz); if (sz <= 0 || i + 10 + sz > end) break;
          if (id === 'TIT2') out.title = dec(body[0], body.subarray(1));
          else if (id === 'TPE1') out.artist = dec(body[0], body.subarray(1)).split(/\u0000/)[0];
          else if (id === 'APIC' && !out.art) {
            var enc = body[0], j = 1, mime = ''; while (j < body.length && body[j] !== 0) mime += String.fromCharCode(body[j++]); j++;   // mime
            j++;                                                                                                                         // picture type
            if (enc === 1 || enc === 2) { while (j + 1 < body.length && !(body[j] === 0 && body[j + 1] === 0)) j += 2; j += 2; } else { while (j < body.length && body[j] !== 0) j++; j++; }   // description
            var img = body.subarray(j); if (img.length > 200) out.art = new Blob([img], { type: /^image\//.test(mime) ? mime : (img[0] === 0x89 ? 'image/png' : 'image/jpeg') });
          }
          i += 10 + sz;
        }
        return out;
      });
    }).catch(function () { return null; });
  }

  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 640 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u); c.toBlob(function (b) { b ? res(b) : rej(new Error('That image couldn’t be read.')); }, 'image/jpeg', 0.86);
      };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('That image couldn’t be read.')); };
      img.src = u;
    });
  }
  function uploadArt(x, file) {
    var msg = form.querySelector('[data-mxs-mmsg]'); msg.className = 'mxs-msg';
    msg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading the cover…';
    var auth;
    window.__mAuth().then(function (a) { if (!a) throw new Error('Your session expired. Log in again.'); auth = a; return shrink(file); })
      .then(function (b) { return sbPut(x.audio.replace(/^.*\/song-media\//, '').replace(/\.[a-z0-9]+$/, '-art.jpg'), b, 'image/jpeg', true, auth); })
      .then(function (url) { x.art = url + '?v=' + Date.now().toString(36); paintMusic(); dirty(); msg.textContent = 'Cover added. Publish to save.'; })
      .catch(function (e) { msg.textContent = (e && e.message) || 'Cover upload failed.'; msg.classList.add('bad'); });
  }

  /* ───── anime ───── */
  function animeUI() {
    var box = form.querySelector('[data-mxs-anime]'); if (!box) return;
    box.innerHTML = '<label class="mxs-search"><i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i><input type="search" data-mxs-q maxlength="80" placeholder="Search the AniList catalogue, e.g. Frieren" aria-label="Search anime" autocomplete="off"></label>'
      + '<p class="mxs-msg" data-mxs-amsg role="status"></p><ul class="mxs-results" data-mxs-res></ul><ol class="mxs-list" data-mxs-alist></ol>'
      + '<p class="eyebrow mxs-pv-h">Preview</p><div class="mxs-pv" data-mxs-apv></div>';
    paintAnime();
  }
  function paintAnime() {
    var ol = form.querySelector('[data-mxs-alist]'); if (!ol) return;
    var S = (window.MX && MX.STATUS) || {};
    ol.innerHTML = st.anime.map(function (x, i) {
      return '<li class="mxs-row" data-i="' + i + '"><span class="mxs-thumb tall">' + (x.cover ? '<img src="' + esc(x.cover) + '" alt="">' : '<i class="fa-solid fa-tv"></i>') + '</span>'
        + '<div class="mxs-fields"><b class="mxs-title">' + esc(x.title) + (x.year ? ' <small>' + x.year + '</small>' : '') + '</b>'
        + '<div class="mxs-two"><select data-k="status" aria-label="Watch status">' + Object.keys(S).map(function (k) { return '<option value="' + k + '"' + (x.status === k ? ' selected' : '') + '>' + S[k] + '</option>'; }).join('') + '</select>'
        + '<select data-k="rating" aria-label="My rating"><option value="0">No rating</option>' + [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5, 4, 3, 2, 1].map(function (r) { return '<option value="' + r + '"' + (Number(x.rating) === r ? ' selected' : '') + '>★ ' + r + '/10</option>'; }).join('') + '</select></div>'
        + '<input data-k="note" maxlength="140" placeholder="Personal note (optional)" value="' + esc(x.note) + '" aria-label="Personal note"></div>'
        + moveBtns(i, st.anime.length) + '</li>';
    }).join('');
    preview();
  }
  function search(q) {
    var msg = form.querySelector('[data-mxs-amsg]'), res = form.querySelector('[data-mxs-res]'), n = ++searchN;
    msg.className = 'mxs-msg';
    if (q.trim().length < 2) { msg.textContent = ''; res.innerHTML = ''; return; }
    msg.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Searching AniList…';
    MX.anilist(q).then(function (list) {
      if (n !== searchN) return;
      st.results = list;
      msg.textContent = list.length ? '' : 'Nothing found. Try the English or Japanese title.';
      res.innerHTML = list.map(function (x, i) {
        var have = st.anime.some(function (a) { return a.id === x.id; });
        return '<li><button type="button" data-mxs-pick="' + i + '"' + (have ? ' disabled' : '') + '><span class="mxs-thumb tall">' + (x.cover ? '<img src="' + esc(x.cover) + '" alt="" loading="lazy">' : '<i class="fa-solid fa-tv"></i>') + '</span>'
          + '<span class="mxs-rt"><b>' + esc(x.title) + '</b><small>' + esc([x.year, x.format, x.eps ? x.eps + ' ep' : ''].filter(Boolean).join(' · ')) + '</small></span>'
          + '<span class="mxs-plus">' + (have ? '<i class="fa-solid fa-check"></i>' : '<i class="fa-solid fa-plus"></i>') + '</span></button></li>';
      }).join('');
    }, function (e) { if (n !== searchN) return; msg.textContent = e.message; msg.classList.add('bad'); res.innerHTML = ''; });
  }

  /* ───── themes allowed for visitors ───── */
  function themesUI() {
    var box = form.querySelector('[data-mxs-themes]'); if (!box || !window.dgUI) return;
    box.innerHTML = '<p class="mxs-sub">Themes visitors can pick <small>none ticked = all themes</small></p><div class="mxs-themes">' + dgUI.themes.map(function (t) {
      return '<label><input type="checkbox" data-mxs-theme="' + esc(t[0]) + '"' + (st.themes.indexOf(t[0]) !== -1 ? ' checked' : '') + '><i style="--c1:' + esc(t[2]) + ';--c2:' + esc(t[3]) + '"></i>' + esc(String(t[1]).replace(/ .*/, '')) + '</label>';
    }).join('') + '</div>';
  }

  /* ───── shared bits ───── */
  function moveBtns(i, n) {
    return '<div class="mxs-move"><button type="button" class="btn icon btn-sm" data-mxs-mv="-1" aria-label="Move up"' + (i === 0 ? ' disabled' : '') + '><i class="fa-solid fa-arrow-up"></i></button>'
      + '<button type="button" class="btn icon btn-sm" data-mxs-mv="1" aria-label="Move down"' + (i === n - 1 ? ' disabled' : '') + '><i class="fa-solid fa-arrow-down"></i></button>'
      + '<button type="button" class="btn icon btn-sm mxs-del" data-mxs-del aria-label="Remove"><i class="fa-solid fa-trash"></i></button></div>';
  }
  function preview() {
    var m = form.querySelector('[data-mxs-mpv]'), a = form.querySelector('[data-mxs-apv]');
    if (m) { m.innerHTML = MX.musicHTML(st.music, { head: false, empty: 'Add a Spotify link above to start your collection.' }); MX.mount(m, { musicLikes: st.music, name: 'Preview' }); }
    if (a) { a.innerHTML = MX.animeHTML(st.anime, { head: false, empty: 'Search the catalogue above and tap + to add a title.' }); MX.mount(a); }
  }
  function feat() {
    var box = form.querySelector('[data-mxs-feat]'), inp = form.elements.namedItem('spotify'); if (!box || !inp) return;
    var v = inp.value.trim(), sp = MX.spotify(v);
    if (!v) { box.innerHTML = ''; return; }
    if (!sp) { box.innerHTML = '<p class="mxs-msg bad">Paste a full open.spotify.com link.</p>'; return; }
    box.innerHTML = '<p class="mxs-msg"><i class="fa-solid fa-circle-notch fa-spin"></i> Checking with Spotify…</p>';
    MX.meta(sp.url).then(function (m) {
      if (inp.value.trim() !== v) return;
      box.innerHTML = '<div class="mxs-featcard">' + (m && m.art ? '<img src="' + esc(m.art) + '" alt="">' : '<i class="fa-brands fa-spotify"></i>')
        + '<span><b>' + esc((m && m.title) || 'Spotify ' + sp.type) + '</b><small>' + esc((m && m.artist) || sp.type) + '</small></span></div>';
    });
  }

  function bind() {
    form.addEventListener('click', function (e) {
      var j = e.target.closest('.linkish[data-tab]'); if (j && form.__tab) { form.__tab(j.dataset.tab); return; }
      if (e.target.closest('[data-mxs-addsong]')) { addSong(); return; }
      var pick = e.target.closest('[data-mxs-pick]');
      if (pick) {
        var x = st.results && st.results[Number(pick.dataset.mxsPick)]; if (!x) return;
        var msg = form.querySelector('[data-mxs-amsg]');
        if (st.anime.length >= MAX_A) { msg.textContent = 'You can add up to ' + MAX_A + ' titles.'; return; }
        st.anime.push(Object.assign({}, x)); pick.disabled = true; pick.querySelector('.mxs-plus').innerHTML = '<i class="fa-solid fa-check"></i>';
        msg.textContent = x.title + ' added. Set your status and rating below, then Publish.'; paintAnime(); dirty(); return;
      }
      var pinB = e.target.closest('[data-mxs-pin]');
      if (pinB) { var px = st.music[Number(pinB.closest('.mxs-row').dataset.i)]; if (px) { st.song = st.song === px.audio ? '' : px.audio; paintMusic(); dirty(); } return; }
      var row = e.target.closest('.mxs-row'); if (!row) return;
      var list = row.parentNode.matches('[data-mxs-mlist]') ? st.music : st.anime, i = Number(row.dataset.i);
      var mv = e.target.closest('[data-mxs-mv]');
      if (mv) { var to = i + Number(mv.dataset.mxsMv); if (to < 0 || to >= list.length) return; list.splice(to, 0, list.splice(i, 1)[0]); }
      else if (e.target.closest('[data-mxs-del]')) { var gone = list.splice(i, 1)[0]; if (gone && gone.audio && gone.audio === st.song) st.song = ''; }
      else return;
      list === st.music ? paintMusic() : paintAnime(); dirty();
    });
    var upd = function (e) {
      var t = e.target, row = t.closest && t.closest('.mxs-row');
      if (row && t.dataset.k) {
        var list = row.parentNode.matches('[data-mxs-mlist]') ? st.music : st.anime, x = list[Number(row.dataset.i)];
        if (x) { x[t.dataset.k] = t.dataset.k === 'rating' ? Number(t.value) || 0 : t.value; clearTimeout(upd.t); upd.t = setTimeout(preview, 250); }
      } else if (t.matches && t.matches('[data-mxs-theme]')) {
        st.themes = Array.prototype.map.call(form.querySelectorAll('[data-mxs-theme]:checked'), function (c) { return c.dataset.mxsTheme; });
      } else if (t.matches && t.matches('[data-mxs-q]')) { clearTimeout(searchT); var q = t.value; searchT = setTimeout(function () { search(q); }, 450); }
      else if (t.name === 'spotify') { clearTimeout(feat.t); feat.t = setTimeout(feat, 400); }
    };
    form.addEventListener('input', upd, true);           // capture: our state updates before the Studio reads it
    form.addEventListener('change', upd, true);
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.matches && t.matches('[data-mxs-file]') && t.files && t.files[0]) { uploadSong(t.files[0]); t.value = ''; }
      else if (t.matches && t.matches('[data-mxs-art]') && t.files && t.files[0]) { var x = st.music[Number(t.closest('.mxs-row').dataset.i)]; if (x && x.audio) uploadArt(x, t.files[0]); t.value = ''; }
    });
    form.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      if (e.target.matches('[data-mxs-url]')) { e.preventDefault(); addSong(); }
      else if (e.target.closest('[data-mxs-music],[data-mxs-anime]')) e.preventDefault();      // never publish by accident
    });
  }

  function init(f) {
    form = f; window.__mx = null;
    var cur = window.__dgGet ? window.__dgGet() : {};
    st = { music: (cur.musicLikes || []).map(function (x) { return Object.assign({ title: '', artist: '', art: '', note: '' }, x); }),
      anime: (cur.anime || []).map(function (x) { return Object.assign({}, x); }), song: (cur.song && cur.song.audio) || '', themes: Array.isArray(cur.themes) ? cur.themes.slice() : [], results: [] };
    window.__mx = snapshot;
    musicUI(); animeUI(); themesUI(); bind(); feat();
  }
  function check() {
    var f = document.getElementById('editor');
    if (f && f !== form && f.querySelector('[data-mxs-music]') && window.MX && window.__dgGet) init(f);
    if (!f && form) { form = null; window.__mx = null; }
  }
  new MutationObserver(function () { clearTimeout(check.t); check.t = setTimeout(check, 30); }).observe(document.body, { childList: true, subtree: true });
  check();
})();
