/* M-ID · profile collections (v31)
 *  · "Music I Like": a horizontal album carousel of Spotify links the owner picked
 *  · "Anime": the owner's anime shelf, filled from the AniList catalogue
 * Shared by the main app (basic cards, Studio) and the star card page (/owner/index.html).
 * Nothing here plays audio itself: tapping a song hands it to the M-ID bottom player
 * (window.MaplePlayer in the top page; from inside a card iframe it asks the parent). */
(function () {
  'use strict';
  if (window.MX) return;

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var STATUS = { watching: 'Watching', completed: 'Completed', hold: 'On hold', dropped: 'Dropped', plan: 'Plan to watch' };
  var STATUS_ICON = { watching: 'fa-circle-play', completed: 'fa-circle-check', hold: 'fa-circle-pause', dropped: 'fa-circle-xmark', plan: 'fa-bookmark' };
  var ART_OK = /^https:\/\/i\.ytimg\.com\/vi\/[A-Za-z0-9_-]{11}\/[a-z0-9]+\.jpg$|^https:\/\/(?:i\.scdn\.co|image-cdn-[a-z0-9-]+\.spotifycdn\.com|mosaic\.scdn\.co|is\d-ssl\.mzstatic\.com\/image\/thumb|(?:e-)?cdns?-images\.dzcdn\.net\/images\/cover|[a-z0-9-]+\.anilist\.co|s4\.anilist\.co)\/\S+$|^https:\/\/qebbuxixnqsqjuprfpyv\.supabase\.co\/storage\/v1\/object\/public\/song-media\/[0-9a-f-]{36}\/[a-z0-9]{8,24}-art\.jpg(\?v=[a-z0-9]{1,12})?$/i;

  /* ───── Spotify links ───── */
  function spotify(u) {
    u = String(u || '').trim();
    var m = u.match(/^spotify:(track|album|playlist|episode|artist|show):([A-Za-z0-9]{22})$/)
      || u.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2,5}\/)?(?:embed\/)?(track|album|playlist|episode|artist|show)\/([A-Za-z0-9]{22})/i);
    if (!m) return null;
    var type = m[1].toLowerCase();
    return { type: type, id: m[2], url: 'https://open.spotify.com/' + type + '/' + m[2], uri: 'spotify:' + type + ':' + m[2] };
  }
  /* ───── YouTube links ───── */
  function youtube(u) {
    u = String(u || '').trim(); var id = '';
    if (/^[A-Za-z0-9_-]{11}$/.test(u)) id = u;
    else { try {
      var x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u), h = x.hostname.replace(/^(www\.|m\.|music\.)/, '');
      if (h === 'youtu.be') id = x.pathname.slice(1, 12);
      else if (h === 'youtube.com' || h === 'youtube-nocookie.com') id = x.searchParams.get('v') || ((x.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/) || [])[1] || '');
    } catch (e) {} }
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? { type: 'video', id: id, url: 'https://www.youtube.com/watch?v=' + id } : null;
  }
  function ytMeta(y) {
    var key = 'mx:yt2:' + y.id;
    if (metaCache[key]) return metaCache[key];
    try { var c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && c.title) return (metaCache[key] = Promise.resolve(c)); } catch (e) {}
    var art = 'https://i.ytimg.com/vi/' + y.id + '/hqdefault.jpg';
    var p = fetch('/api/yt-meta?url=' + encodeURIComponent(y.url))
      .then(function (r) { if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) throw 0; return r.json(); })
      .catch(function () {   // no server function (local preview): noembed.com is a CORS-enabled oEmbed proxy
        return fetch('https://noembed.com/embed?url=' + encodeURIComponent(y.url)).then(function (r) { if (!r.ok) throw 0; return r.json(); });
      })
      .then(function (d) {
        d = d || {}; var o = { url: y.url, type: 'video', title: String(d.songTitle || d.title || ''), artist: String(d.songArtist || d.artist || d.author_name || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, ''), art: ART_OK.test(d.cover || '') ? d.cover : art, rawTitle: String(d.title || ''), album: String(d.album || ''), durationMs: d.durationMs || 0 };
        if (o.title) { try { sessionStorage.setItem(key, JSON.stringify(o)); } catch (e) {} }
        return o;
      }).catch(function () { delete metaCache[key]; return { url: y.url, type: 'video', title: '', artist: '', art: art }; });
    return (metaCache[key] = p);
  }
  var metaCache = {};
  /* Title / artist / artwork for a Spotify link. Server endpoint first (it can use the Spotify Web API when
   * credentials are configured), then Spotify's public oEmbed endpoint. Never throws: returns what it found. */
  function meta(u) {
    var yt = youtube(u); if (yt && !spotify(u)) return ytMeta(yt);
    var s = spotify(u);
    if (!s) return Promise.resolve(null);
    if (metaCache[s.url]) return metaCache[s.url];
    try { var c = JSON.parse(sessionStorage.getItem('mx:sp:' + s.id) || 'null'); if (c && c.title) return (metaCache[s.url] = Promise.resolve(c)); } catch (e) {}
    var keep = function (d) { if (d && d.title) { try { sessionStorage.setItem('mx:sp:' + s.id, JSON.stringify(d)); } catch (e) {} } return d; };
    var viaApi = fetch('/api/spotify-meta?url=' + encodeURIComponent(s.url))
      .then(function (r) { if (!r.ok || !/json/.test(r.headers.get('content-type') || '')) throw 0; return r.json(); })
      .then(function (d) { if (!d || !d.title) throw 0; return d; });
    var p = viaApi.catch(function () {
      return fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(s.url))
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (d) { return { title: String(d.title || ''), artist: '', art: String(d.thumbnail_url || ''), type: s.type, source: 'oembed' }; });
    }).then(function (d) {
      d = d || {}; d.url = s.url; d.type = s.type;
      if (!ART_OK.test(d.art || '')) d.art = '';
      return keep(d);
    }).catch(function () { delete metaCache[s.url]; return { url: s.url, type: s.type, title: '', artist: '', art: '' }; });
    return (metaCache[s.url] = p);
  }

  /* ───── AniList (public GraphQL, CORS enabled, no key) ───── */
  var Q = 'query($q:String){Page(perPage:12){media(search:$q,type:ANIME,isAdult:false,sort:SEARCH_MATCH){id title{romaji english native} coverImage{large extraLarge} startDate{year} seasonYear episodes format genres averageScore description(asHtml:false)}}}';
  function plain(t) { return String(t || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
  function toAnime(m) {
    var t = m.title || {}, main = t.english || t.romaji || t.native || 'Untitled', alt = t.english && t.romaji && t.romaji !== t.english ? t.romaji : (t.native || '');
    var cover = (m.coverImage && (m.coverImage.extraLarge || m.coverImage.large)) || '';
    return { id: m.id, title: main, alt: alt, cover: ART_OK.test(cover) ? cover : '', year: m.seasonYear || (m.startDate && m.startDate.year) || 0,
      eps: m.episodes || 0, format: m.format || '', genres: (m.genres || []).slice(0, 4), score: m.averageScore || 0,
      desc: plain(m.description).slice(0, 320), status: 'completed', rating: 0, note: '' };
  }
  var lastSearch = 0;
  function anilist(q) {
    q = String(q || '').trim().slice(0, 80);
    if (q.length < 2) return Promise.resolve([]);
    var wait = Math.max(0, 700 - (Date.now() - lastSearch)); lastSearch = Date.now() + wait;      // stay well under AniList's rate limit
    return new Promise(function (r) { setTimeout(r, wait); }).then(function () {
      return fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ query: Q, variables: { q: q } }) });
    }).then(function (r) {
      if (r.status === 429) throw new Error('The anime catalogue is busy right now. Wait a minute and search again.');
      if (!r.ok) throw new Error('The anime catalogue could not be reached. Try again shortly.');
      return r.json();
    }).then(function (d) {
      var list = d && d.data && d.data.Page && d.data.Page.media;
      return (Array.isArray(list) ? list : []).map(toAnime);
    }, function (e) { throw e instanceof Error && e.message ? e : new Error('No connection to the anime catalogue.'); });
  }

  /* ───── render ───── */
  var ICON_SP = '<i class="fa-brands fa-spotify" aria-hidden="true"></i>';
  function initials(s) { return esc((String(s || '?').trim()[0] || '?').toUpperCase()); }
  function musicCard(x, i) {
    var art = x.art && ART_OK.test(x.art) ? '<img src="' + esc(x.art) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '';
    return '<li class="mx-song" style="--i:' + i + '">'
      + '<button type="button" class="mx-song-btn" data-mx-play="' + i + '" aria-label="Play ' + esc(x.title || 'song') + (x.artist ? ' by ' + esc(x.artist) : '') + '">'
      + '<span class="mx-art"><span class="mx-art-ph">' + initials(x.title) + '</span>' + art
      + '<span class="mx-play" aria-hidden="true"><i class="fa-solid fa-play"></i></span>' + (x.audio ? '<span class="mx-sp mx-up" title="Full song"><i class="fa-solid fa-headphones" aria-hidden="true"></i></span>' : /youtube\.com/.test(x.url || '') ? '<span class="mx-sp" title="YouTube" style="color:#ff3b30"><i class="fa-brands fa-youtube" aria-hidden="true"></i></span>' : '<span class="mx-sp" title="Spotify">' + ICON_SP + '</span>') + '</span>'
      + '<span class="mx-t">' + esc(x.title || 'Untitled') + '</span>'
      + '<span class="mx-a">' + esc(x.artist || (x.audio ? 'Uploaded' : /youtube\.com/.test(x.url || '') ? 'YouTube' : /\/album\//.test(x.url) ? 'Album' : /\/playlist\//.test(x.url) ? 'Playlist' : 'Spotify')) + '</span>'
      + (x.note ? '<span class="mx-note">“' + esc(x.note) + '”</span>' : '')
      + '</button></li>';
  }
  function rail(label, inner, kind) {
    return '<div class="mx-rail" data-mx-rail="' + kind + '">'
      + '<button type="button" class="mx-arrow prev" data-mx-scroll="-1" aria-label="Scroll ' + label + ' left" disabled><i class="fa-solid fa-chevron-left"></i></button>'
      + '<ul class="mx-track" role="list" tabindex="0" aria-label="' + esc(label) + '">' + inner + '</ul>'
      + '<button type="button" class="mx-arrow next" data-mx-scroll="1" aria-label="Scroll ' + label + ' right"><i class="fa-solid fa-chevron-right"></i></button></div>';
  }
  function musicHTML(list, o) {
    o = o || {}; list = Array.isArray(list) ? list : [];
    if (!list.length) return o.empty ? '<div class="mx-empty"><i class="fa-solid fa-compact-disc"></i><b>No songs yet</b><span>' + esc(o.empty) + '</span></div>' : '';
    return '<section class="mx-sec mx-music" data-sec="music" aria-label="Music I like">'
      + (o.head === false ? '' : '<header class="mx-head"><h2><i class="fa-solid fa-compact-disc"></i> Music I like</h2><span>' + list.length + (list.length === 1 ? ' song' : ' songs') + '</span></header>')
      + rail('Music I like', list.map(musicCard).join(''), 'music') + '</section>';
  }
  function stars(r) {
    if (!(r > 0)) return '';
    return '<span class="mx-rate" aria-label="Rated ' + r + ' out of 10"><i class="fa-solid fa-star"></i>' + (Math.round(r * 2) / 2) + '<small>/10</small></span>';
  }
  function animeCard(x, i) {
    var cover = x.cover && ART_OK.test(x.cover) ? '<img src="' + esc(x.cover) + '" alt="" loading="lazy" decoding="async" onerror="this.remove()">' : '';
    var st = STATUS[x.status] ? x.status : 'completed';
    var facts = [x.year || '', x.format ? String(x.format).replace(/_/g, ' ').replace('TV SHORT', 'Short') : '', x.eps ? x.eps + ' ep' : ''].filter(Boolean).join(' · ');
    return '<li class="mx-anime" data-st="' + st + '" style="--i:' + i + '">'
      + '<article tabindex="0" aria-label="' + esc(x.title) + ', ' + STATUS[st] + '">'
      + '<div class="mx-cover"><span class="mx-art-ph">' + initials(x.title) + '</span>' + cover
      + '<span class="mx-st st-' + st + '"><i class="fa-solid ' + STATUS_ICON[st] + '"></i>' + STATUS[st] + '</span>'
      + (x.score ? '<span class="mx-score" title="AniList average score">' + x.score + '%</span>' : '') + '</div>'
      + '<div class="mx-body"><h3>' + esc(x.title) + '</h3>' + (x.alt ? '<p class="mx-alt">' + esc(x.alt) + '</p>' : '')
      + '<p class="mx-facts">' + esc(facts) + stars(x.rating) + '</p>'
      + (x.genres && x.genres.length ? '<p class="mx-genres">' + x.genres.slice(0, 3).map(function (g) { return '<span>' + esc(g) + '</span>'; }).join('') + '</p>' : '')
      + (x.note ? '<p class="mx-note">“' + esc(x.note) + '”</p>' : (x.desc ? '<p class="mx-desc">' + esc(x.desc) + '</p>' : ''))
      + '</div></article></li>';
  }
  function animeHTML(list, o) {
    o = o || {}; list = Array.isArray(list) ? list : [];
    if (!list.length) return o.empty ? '<div class="mx-empty"><i class="fa-solid fa-tv"></i><b>No anime yet</b><span>' + esc(o.empty) + '</span></div>' : '';
    var present = Object.keys(STATUS).filter(function (k) { return list.some(function (x) { return (STATUS[x.status] ? x.status : 'completed') === k; }); });
    var chips = present.length > 1 ? '<div class="mx-filter" role="group" aria-label="Filter by watch status"><button type="button" data-mx-f="" aria-pressed="true">All <b>' + list.length + '</b></button>'
      + present.map(function (k) { return '<button type="button" data-mx-f="' + k + '" aria-pressed="false">' + STATUS[k] + '</button>'; }).join('') + '</div>' : '';
    return '<section class="mx-sec mx-animes" data-sec="anime" aria-label="Anime">'
      + (o.head === false ? '' : '<header class="mx-head"><h2><i class="fa-solid fa-tv"></i> Anime</h2><span>' + list.length + ' titles</span></header>')
      + chips + rail('Anime', list.map(animeCard).join(''), 'anime')
      + '<p class="mx-credit">Catalogue data from <a href="https://anilist.co" target="_blank" rel="noopener noreferrer">AniList</a></p></section>';
  }

  /* ───── behaviour (one delegated listener per root, never duplicated) ───── */
  function arrows(rl) {
    var tr = rl.querySelector('.mx-track'); if (!tr) return;
    var max = tr.scrollWidth - tr.clientWidth - 2;
    var p = rl.querySelector('.mx-arrow.prev'), n = rl.querySelector('.mx-arrow.next');
    if (p) p.disabled = tr.scrollLeft <= 2; if (n) n.disabled = tr.scrollLeft >= max;
    rl.classList.toggle('mx-fits', max <= 0);
  }
  function mount(root, profile) {
    if (!root) return;
    root.__mxProfile = profile || root.__mxProfile || null;
    root.querySelectorAll('.mx-rail').forEach(function (rl) {
      var tr = rl.querySelector('.mx-track');
      if (tr && !tr.__mx) { tr.__mx = 1; tr.addEventListener('scroll', function () { arrows(rl); }, { passive: true }); }
      arrows(rl);
    });
    if (root.__mxBound) return;
    root.__mxBound = 1;
    window.addEventListener('resize', function () { root.querySelectorAll('.mx-rail').forEach(arrows); });
    root.addEventListener('click', function (e) {
      var sc = e.target.closest('[data-mx-scroll]');
      if (sc) { var tr = sc.parentNode.querySelector('.mx-track'); tr.scrollBy({ left: Number(sc.dataset.mxScroll) * Math.max(220, tr.clientWidth * 0.8), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
      var f = e.target.closest('[data-mx-f]');
      if (f) {
        var sec = f.closest('.mx-animes'), k = f.dataset.mxF;
        sec.querySelectorAll('[data-mx-f]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === f)); });
        sec.querySelectorAll('.mx-anime').forEach(function (li) { li.hidden = !!k && li.dataset.st !== k; });
        var rl = sec.querySelector('.mx-rail'); rl.querySelector('.mx-track').scrollLeft = 0; arrows(rl); return;
      }
      var pl = e.target.closest('[data-mx-play]');
      if (pl) {
        var p = root.__mxProfile || {}, item = (p.musicLikes || [])[Number(pl.dataset.mxPlay)];
        if (item) play(item, p);
      }
    });
  }
  function play(item, p) {
    var track = { url: item.url, audio: item.audio || '', durationMs: item.durationMs || 0, title: item.title || '', artist: item.artist || '', art: item.art || '', owner: p && p.name || '', slug: p && p.slug || '', lyrics: !!(p && p.lyrics !== false) };
    if (window.MaplePlayer && window.MaplePlayer.play) return window.MaplePlayer.play(track);
    if (window.parent !== window) { try { window.parent.postMessage({ maple: 'mp-play', track: track }, location.origin); return; } catch (e) {} }
    if (item.url) window.open(item.url, '_blank', 'noopener');
  }

  window.MX = { esc: esc, spotify: spotify, youtube: youtube, meta: meta, anilist: anilist, musicHTML: musicHTML, animeHTML: animeHTML, mount: mount, play: play,
    STATUS: STATUS, artOk: function (u) { return ART_OK.test(u || ''); },
    musicOn: function (p) { return !!p && p.musicOn !== false && Array.isArray(p.musicLikes) && p.musicLikes.length > 0; },
    animeOn: function (p) { return !!p && p.animeOn !== false && Array.isArray(p.anime) && p.anime.length > 0; } };
})();
