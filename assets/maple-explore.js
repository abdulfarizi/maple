/* Maple ID · homepage "Who's on Maple ID": creator finder + leaderboard.
 * Data comes from /api/directory/stats (light list of slugs + numbers) and /api/directory/cards
 * (names/avatars for just the rows being shown). Creators can opt out in Studio → Profile → Community. */
(function () {
  'use strict';
  var PAGE = 10, st = null, io = null;
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var api = function (u) { return fetch(u).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d && d.error || 'fail'); return d; }); }); };
  var $ = function (sel) { return document.querySelector(sel); };
  var fmt = function (n) { return Number(n || 0).toLocaleString('en-US'); };
  var themeColors = function (id) { var t = (window.dgUI && dgUI.themes || []).filter(function (x) { return x[0] === id; })[0]; return t ? [t[2], t[3]] : null; };
  var initials = function (n) { return (String(n || '?').replace(/[☆★]/g, '').trim().split(/\s+/).slice(0, 2).map(function (w) { return Array.from(w)[0] || ''; }).join('') || '?').toUpperCase(); };

  function row(r, c, rank, medal) {
    var col = themeColors(c.theme), style = col ? ' style="--c1:' + col[0] + ';--c2:' + col[1] + '"' : '';
    var av = c.avatar ? '<img src="' + esc(c.avatar) + '" alt="" loading="lazy" onerror="this.remove()">' : esc(initials(c.name));
    var where = [c.city, c.country].filter(Boolean).join(', ');
    var stat = st.sort === 'likes' ? '<i class="fa-solid fa-heart"></i>' + fmt(r.likes) : '<i class="fa-solid fa-eye"></i>' + fmt(r.visits);
    return '<li><a class="ex-row' + (medal && rank <= 3 ? ' t' + rank : '') + '" href="/' + esc(r.slug) + '" data-link>'
      + '<span class="ex-rank">' + rank + '</span><span class="ex-av"' + style + '>' + av + '</span>'
      + '<span class="ex-who"><b>' + esc(c.name) + (r.slug === st.me ? '<span class="ex-you">You</span>' : '') + '</b><small>/' + esc(r.slug) + (where ? ' · ' + esc(where) : '') + '</small></span>'
      + '<span class="ex-stat">' + stat + '</span></a></li>';
  }
  function skeleton() { return '<li class="ex-skel"></li><li class="ex-skel"></li><li class="ex-skel"></li><li class="ex-skel"></li>'; }

  async function fetchPage(gen) {
    var out = [], tries = 0;
    while (out.length < PAGE && !st.done && tries++ < 4) {
      var d = await api('/api/directory/stats?sort=' + st.sort + '&offset=' + st.offset + '&limit=' + PAGE + '&q=' + encodeURIComponent(st.q));
      if (gen !== st.gen) return null;
      st.total = d.total;
      st.offset += d.rows.length;
      if (d.rows.length < PAGE) st.done = true;
      if (!d.rows.length) break;
      var cards = (await api('/api/directory/cards?slugs=' + d.rows.map(function (r) { return r.slug; }).join(','))).cards || {};
      if (gen !== st.gen) return null;
      var q = st.q.toLowerCase();
      d.rows.forEach(function (r) {
        var c = cards[r.slug]; if (!c) return;
        if (q && (c.name + ' ' + r.slug).toLowerCase().indexOf(q) < 0) return;
        out.push({ r: r, c: c });
      });
    }
    return out;
  }

  async function load(reset) {
    var list = $('#ex-list'), more = $('.ex-more'), count = $('[data-ex-count]');
    if (!list || !st) return;
    if (reset) { st.gen++; st.offset = 0; st.rank = 0; st.done = false; st.busy = false; list.innerHTML = skeleton(); more.hidden = true; }
    if (st.busy) return; st.busy = true; var gen = st.gen;
    try {
      var got = await fetchPage(gen);
      if (got === null) return;
      if (reset) list.innerHTML = '';
      var medal = !st.q;
      list.insertAdjacentHTML('beforeend', got.map(function (x) { return row(x.r, x.c, ++st.rank, medal); }).join(''));
      if (!st.rank) {
        var slug = st.q.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
        list.innerHTML = st.q
          ? '<li class="ex-empty">No creator found for <b>“' + esc(st.q) + '”</b>.' + (slug.length >= 3 && !st.me ? '<br>Maybe it could be you?<br><a class="btn btn-accent btn-sm" href="/#auth" data-claim-q="' + esc(slug) + '">Claim /' + esc(slug) + '</a>' : '') + '</li>'
          : '<li class="ex-empty">Be the first one here.' + (st.me ? '' : '<br><a class="btn btn-accent btn-sm" href="/#auth" data-claim-q="">Get your ID</a>') + '</li>';
      }
      more.hidden = st.done;
      if (count) count.innerHTML = st.q
        ? '<b>' + fmt(st.rank) + '</b> match' + (st.rank === 1 ? '' : 'es') + (st.done ? '' : '+')
        : (st.total ? '<b>' + fmt(st.total) + '</b> creator' + (st.total === 1 ? ' is' : 's are') + ' on Maple ID. Find one, or see who’s on top.' : 'Be the first creator on Maple ID.');
    } catch (e) {
      if (reset) list.innerHTML = '<li class="ex-empty">Couldn’t load the list right now.<br><button type="button" class="btn btn-sm" data-ex-retry>Try again</button></li>';
      if (count) count.textContent = 'See who’s already here.';
      more.hidden = true;
    } finally { st.busy = false; }
  }

  function mount(me) {
    var box = $('#explore'); if (!box) return;
    if (io) { io.disconnect(); io = null; }
    st = { sort: 'visits', q: '', offset: 0, rank: 0, total: null, busy: false, done: false, gen: 0, me: me || '' };
    var inp = $('#ex-q'), clear = $('.ex-clear'), timer = 0;
    inp.addEventListener('input', function () {
      clear.hidden = !inp.value; clearTimeout(timer);
      timer = setTimeout(function () { st.q = inp.value.trim().replace(/[^\p{L}\p{N} ._-]/gu, '').slice(0, 30); load(true); }, 320);
    });
    clear.addEventListener('click', function () { inp.value = ''; clear.hidden = true; st.q = ''; load(true); inp.focus(); });
    box.querySelectorAll('.ex-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (st.sort === b.dataset.sort) return; st.sort = b.dataset.sort;
        box.querySelectorAll('.ex-tabs button').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); });
        load(true);
      });
    });
    $('.ex-more').addEventListener('click', function () { load(false); });
    box.addEventListener('click', function (e) {
      if (e.target.closest('[data-ex-retry]')) load(true);
      var c = e.target.closest('[data-claim-q]');
      if (c) {
        e.preventDefault(); var v = c.dataset.claimQ, cs = document.getElementById('claim-slug');
        if (cs) { cs.value = v || ''; cs.dispatchEvent(new Event('input')); cs.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(function () { cs.focus({ preventScroll: true }); }, 450); }
        else { var j = document.querySelector('[data-auth="signup"]'); if (j) j.click(); }
      }
    });
    // keep the bottom bar's highlight in step with what's on screen
    if (!window.dgPager && 'IntersectionObserver' in window && window.dgUI && dgUI.dock) {
      io = new IntersectionObserver(function (es) { es.forEach(function (en) { dgUI.dock.active(en.isIntersecting ? 'explore' : 'home'); }); }, { rootMargin: '-35% 0px -35% 0px' });
      io.observe(box);
    }
    load(true);
    if (!window.dgPager && location.hash === '#explore') setTimeout(function () { box.scrollIntoView({ block: 'start' }); }, 350);
  }
  window.dgExplore = { mount: mount };
})();
