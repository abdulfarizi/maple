/* M-ID · one global header everywhere (v31)
 *
 * The same header (maple-shell.js: menu · brand · … · messages · Studio · light/dark) now also stays on top of
 * star-layout cards, whose own in-card header is hidden inside the app. This file adds:
 *  · desktop navigation links (Home · Explore · Profile) and an Alerts shortcut, mobile keeps the slide-out menu
 *  · a "View" control that only appears on a profile, built from THAT owner's published Studio settings:
 *      theme picker (if "Let visitors switch theme" is on, limited to the owner's chosen themes),
 *      language (if "Language selector" is on, star cards), card sounds (if "Show the sound button" is on).
 *    Visitors never see Studio controls; nothing here is saved to the owner's profile. */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var picked = {}, btn = null, pop = null, nav = null, bell = null;
  var HEX = /^#[0-9a-f]{6}$/i;

  function pane() { if (window.dgPager && dgPager.layerKind && dgPager.layerKind() === 'studio') return ''; var p = document.body.dataset.page || ''; return p === 'card' || p === 'profile' ? p : ''; }
  function prof() { var p = pane(); return p ? (window.__mxCtx || {})[p] || null : null; }
  function signedIn() { return !!document.querySelector('#nav-actions a[href="/studio"]'); }
  function isStar(p) { return p && p.layout === 'star'; }
  function frame() { var p = pane(); return (p && document.querySelector('#pg-' + p + ' iframe.star-frame')) || document.querySelector('#app iframe.star-frame'); }
  function send(msg) { var f = frame(); if (f) try { f.contentWindow.postMessage(msg, location.origin); } catch (e) {} }
  function themes(p) {
    var all = (window.dgUI && dgUI.themes) || [];
    var allow = Array.isArray(p.themes) && p.themes.length ? all.filter(function (t) { return p.themes.indexOf(t[0]) !== -1; }) : all;
    return allow.length ? allow : all;
  }
  function controls(p) {
    if (!p) return null;
    var c = { theme: p.themeSwitch !== false && !HEX.test(p.accent || '') && p.layout !== 'builder', lang: isStar(p) && p.langSwitch !== false, sfx: isStar(p) && p.sfx !== false };
    return c.theme || c.lang || c.sfx ? c : null;
  }

  /* ───── header pieces ───── */
  function ensure() {
    var tb = document.querySelector('.topbar'), end = tb && tb.querySelector('.tb-end'); if (!end) return false;
    if (!nav || !nav.isConnected) {
      nav = document.createElement('nav'); nav.className = 'tb-nav'; nav.setAttribute('aria-label', 'Primary');
      var brand = tb.querySelector('.brand'); brand && brand.after ? brand.after(nav) : tb.insertBefore(nav, end);
    }
    if (!btn || !btn.isConnected) {
      btn = document.createElement('button'); btn.type = 'button'; btn.className = 'tb-view'; btn.hidden = true;
      btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<i class="fa-solid fa-sliders" aria-hidden="true"></i><span>View</span>';
      btn.addEventListener('click', function (e) { e.stopPropagation(); pop && !pop.hidden ? closePop() : openPop(); });
      end.insertBefore(btn, end.firstChild);
    }
    if (!bell || !bell.isConnected) {
      bell = document.createElement('button'); bell.type = 'button'; bell.className = 'tb-bell'; bell.hidden = true; bell.setAttribute('aria-label', 'Alerts');
      bell.innerHTML = '<i class="fa-regular fa-bell" aria-hidden="true"></i><b hidden></b>';
      bell.addEventListener('click', function () { var a = document.querySelector('#sh-drawer [data-act="alerts"]'); if (a) a.click(); });
      end.insertBefore(bell, btn.nextSibling);
    }
    return true;
  }
  function paintNav() {
    if (!nav) return;
    var pg = document.body.dataset.page || 'home', inn = signedIn();
    var L = [['home', '/', inn ? 'Feed' : 'Home'], ['explore', '/#explore', 'Explore']];
    if (inn) L.push(['profile', '/profile', 'Profile']);
    var html = L.map(function (x) { var on = pg === x[0]; return '<a href="' + x[1] + '" data-link class="tb-nl' + (on ? ' on' : '') + '"' + (on ? ' aria-current="page"' : '') + '>' + x[2] + '</a>'; }).join('');
    if (nav.__h !== html) { nav.__h = html; nav.innerHTML = html; }
    var alerts = document.querySelector('#sh-drawer [data-act="alerts"]');
    bell.hidden = !alerts;
    if (alerts) { var b = alerts.querySelector('[data-badge]'), out = bell.querySelector('b'); out.hidden = !b || b.hidden; out.textContent = b ? b.textContent : ''; }
  }
  function paint() {
    if (!ensure()) return;
    paintNav();
    var p = prof(), c = controls(p);
    btn.hidden = !c;
    if (!c) closePop();
    else if (pop && !pop.hidden) renderPop();
  }

  /* ───── the View popover ───── */
  function renderPop() {
    var p = prof(), c = controls(p); if (!pop || !c) return;
    var cur = picked[p.slug] || (function () { try { return isStar(p) && localStorage.getItem('dig-theme:' + p.slug); } catch (e) { return ''; } })() || document.documentElement.dataset.theme;
    var lang = (function () { try { return localStorage.getItem('dig-lang') || ''; } catch (e) { return ''; } })() || (/^(ms|id)\b/i.test(navigator.language || '') ? 'ms' : 'en');
    var h = '<p class="tv-h">Viewing <b>' + esc(p.name || p.slug) + '</b></p>';
    if (c.theme) h += '<p class="tv-l">Theme</p><div class="tv-sw" role="group" aria-label="Theme">' + themes(p).map(function (t) {
      return '<button type="button" data-tv-theme="' + esc(t[0]) + '" aria-pressed="' + (t[0] === cur) + '" style="--c1:' + esc(t[2]) + ';--c2:' + esc(t[3]) + '" title="' + esc(t[1]) + '"><i></i><span>' + esc(String(t[1]).replace(/ .*/, '')) + '</span></button>';
    }).join('') + '</div>';
    if (c.lang) h += '<p class="tv-l">Language</p><div class="tv-seg" role="group" aria-label="Language">' + [['en', 'English'], ['ms', 'Bahasa Melayu']].map(function (l) {
      return '<button type="button" data-tv-lang="' + l[0] + '" aria-pressed="' + (lang === l[0]) + '">' + l[1] + '</button>'; }).join('') + '</div>';
    if (c.sfx) h += '<button type="button" class="tv-row" data-tv-sfx><i class="fa-solid fa-volume-high" aria-hidden="true"></i><span>Card sounds</span><small>Tap to toggle</small></button>';
    h += '<p class="tv-foot">Only changes how you see this profile.</p>';
    pop.innerHTML = h;
  }
  function openPop() {
    if (!pop) {
      pop = document.createElement('div'); pop.className = 'tv-pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Profile view options'); pop.hidden = true;
      document.body.appendChild(pop);
      pop.addEventListener('click', function (e) {
        var p = prof(); if (!p) return;
        var t = e.target.closest('[data-tv-theme]'), l = e.target.closest('[data-tv-lang]'), s = e.target.closest('[data-tv-sfx]');
        if (t) {
          var th = t.dataset.tvTheme; picked[p.slug] = th;
          if (isStar(p)) send({ maple: 'ctl', theme: th });
          else {
            if (window.dgUI) dgUI.theme.apply(th);
            var pgEl = document.getElementById('pg-' + pane()) || document.getElementById('app');
            pgEl && pgEl.querySelectorAll('.idcard').forEach(function (c) { c.dataset.theme = th; });
          }
          renderPop();
        } else if (l) { send({ maple: 'ctl', lang: l.dataset.tvLang }); try { localStorage.setItem('dig-lang', l.dataset.tvLang); } catch (e2) {} renderPop(); }
        else if (s) send({ maple: 'ctl', sfx: 'toggle' });
      });
      document.addEventListener('click', function (e) { if (pop && !pop.hidden && !pop.contains(e.target) && e.target !== btn) closePop(); });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop && !pop.hidden) { closePop(); btn && btn.focus(); } });
    }
    renderPop();
    pop.hidden = false; place();
    requestAnimationFrame(function () { pop.classList.add('in'); });
    btn.setAttribute('aria-expanded', 'true');
    var f = pop.querySelector('button'); f && f.focus({ preventScroll: true });
  }
  /* keep the whole popover on screen: under the button, clamped to the viewport edges */
  function place() {
    if (!pop || pop.hidden || !btn) return;
    var r = btn.getBoundingClientRect(), vw = document.documentElement.clientWidth || window.innerWidth;
    var w = Math.min(330, vw - 20);
    var left = Math.min(Math.max(10, r.right - w), vw - w - 10);
    pop.style.width = w + 'px'; pop.style.left = Math.round(left) + 'px'; pop.style.right = 'auto';
    pop.style.top = Math.round(r.bottom + 10) + 'px';
  }
  function closePop() { if (!pop || pop.hidden) return; pop.classList.remove('in'); pop.hidden = true; if (btn) btn.setAttribute('aria-expanded', 'false'); }

  /* ───── wiring ───── */
  var t = 0; function soon() { clearTimeout(t); t = setTimeout(paint, 40); }
  window.addEventListener('maple:ctx', soon);
  new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ['data-page'] });
  window.addEventListener('maple:forum', soon);
  window.addEventListener('resize', place);
  // a tap inside the card (an iframe) never reaches this document: the window losing focus means "tapped elsewhere"
  window.addEventListener('blur', function () { setTimeout(function () { if (document.activeElement && document.activeElement.tagName === 'IFRAME') closePop(); }, 0); });
  window.addEventListener('message', function (e) { if (e.origin === location.origin && e.data && e.data.maple === 'tap') closePop(); });
  window.addEventListener('scroll', function (e) { if (pop && e.target && e.target.nodeType === 1 && pop.contains(e.target)) return; closePop(); }, { passive: true, capture: true });
  var tries = 0, iv = setInterval(function () { paint(); if (++tries > 20 || (nav && btn)) clearInterval(iv); }, 250);
  var acts = document.getElementById('nav-actions'); if (acts) new MutationObserver(soon).observe(acts, { childList: true, subtree: true });
  setInterval(paintNav, 4000);   // unread badge mirror
})();
