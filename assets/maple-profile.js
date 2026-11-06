/* M-ID · basic-layout profile sections (v31)
 * Adds the owner's "Music I Like" and "Anime" collections to a basic card page and a sticky, horizontally
 * scrolling section bar (Overview · About · Music · Anime · Games · Socials · Shop). Only sections that exist
 * on this profile get a tab. Called by the app after it renders a card: window.dgProfileX(container, profile). */
(function () {
  'use strict';
  var REDUCE = matchMedia('(prefers-reduced-motion: reduce)');
  var LABEL = { overview: 'Overview', about: 'About', music: 'Music I like', anime: 'Anime', games: 'Games', socials: 'Socials', shop: 'Shop' };

  window.dgProfileX = function (root, p) {
    var page = root && root.querySelector('.card-page'); if (!page || !p) return;
    if (p.layout === 'deck' && window.dgDeck) return window.dgDeck(root, p);
    page.querySelectorAll('.mx-sec,.pf-nav').forEach(function (n) { n.remove(); });
    var card = page.querySelector('.idcard'); if (card) card.dataset.sec = 'overview';
    var bio = card && card.querySelector('.bio'); if (bio) { bio.dataset.sec = 'about'; bio.id = bio.id || 'pf-about'; }
    page.querySelectorAll('section.list').forEach(function (sec) {
      var t = (sec.querySelector('h2') && sec.querySelector('h2').textContent || '').toLowerCase();
      if (t.indexOf('game') === 0) sec.dataset.sec = 'games'; else if (t.indexOf('social') === 0) sec.dataset.sec = 'socials';
    });
    var shop = page.querySelector('.shop,.dg-shop,[data-shop]'); if (shop && !shop.dataset.sec) shop.dataset.sec = 'shop';

    var mx = window.MX, html = '';
    if (mx && mx.musicOn(p)) html += mx.musicHTML(p.musicLikes);
    if (mx && mx.animeOn(p)) html += mx.animeHTML(p.anime);
    var anchor = page.querySelector('.reactions') || page.querySelector('.actions') || card;
    if (html && anchor) { anchor.insertAdjacentHTML('afterend', html); mx.mount(page, p); }

    var order = ['overview', 'about', 'music', 'anime', 'games', 'socials', 'shop'];
    var secs = order.map(function (k) { return page.querySelector('[data-sec="' + k + '"]'); }).filter(Boolean);
    if (secs.length < 3) return;                                       // a tiny card does not need a section bar
    var nav = document.createElement('nav'); nav.className = 'pf-nav'; nav.setAttribute('aria-label', 'Profile sections');
    nav.innerHTML = '<div class="pf-nav-track">' + secs.map(function (s) { var k = s.dataset.sec; return '<button type="button" data-go="' + k + '" aria-current="false">' + LABEL[k] + '</button>'; }).join('') + '<i class="pf-ind" aria-hidden="true"></i></div>';
    (page.querySelector('.actions') || card).insertAdjacentElement('afterend', nav);
    var track = nav.firstChild, ind = nav.querySelector('.pf-ind'), cur = '';
    var scroller = page.closest('.pg,.pg-layer') || null;
    function mark(k) {
      if (k === cur) return; cur = k;
      var b = null;
      track.querySelectorAll('button').forEach(function (x) { var on = x.dataset.go === k; x.setAttribute('aria-current', String(on)); if (on) b = x; });
      if (!b) return;
      ind.style.width = b.offsetWidth + 'px'; ind.style.transform = 'translateX(' + b.offsetLeft + 'px)';
      var want = b.offsetLeft - (track.clientWidth - b.offsetWidth) / 2;
      track.scrollTo({ left: Math.max(0, want), behavior: REDUCE.matches ? 'auto' : 'smooth' });
    }
    track.addEventListener('click', function (e) {
      var b = e.target.closest('[data-go]'); if (!b) return;
      var s = page.querySelector('[data-sec="' + b.dataset.go + '"]'); if (!s) return;
      mark(b.dataset.go); lock = Date.now();
      s.scrollIntoView({ behavior: REDUCE.matches ? 'auto' : 'smooth', block: 'start' });
    });
    var lock = 0;
    if ('IntersectionObserver' in window) {
      var seen = {};
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) { seen[en.target.dataset.sec] = en.isIntersecting ? en.intersectionRatio : 0; });
        if (Date.now() - lock < 700) return;
        var best = '', v = 0; secs.forEach(function (s) { var r = seen[s.dataset.sec] || 0; if (r > v) { v = r; best = s.dataset.sec; } });
        if (best) mark(best);
        if (!document.body.contains(nav)) io.disconnect();
      }, { root: scroller, rootMargin: '-35% 0px -45% 0px', threshold: [0, .25, .5, .75, 1] });
      secs.forEach(function (s) { io.observe(s); });
    }
    requestAnimationFrame(function () { mark('overview'); });
  };
})();
