/* Maple ID · shared UI helpers (used by the main app AND the Star card page)
 *   dgUI.theme   – site-wide theme that follows the theme picked in Studio
 *   dgUI.vcard   – proper .vcf builder + "save contact" (share sheet on phones, download on desktop)
 *   dgUI.qr      – restyled QR sheet (themed, rounded dots, logo, save as PNG, share)
 *   press animation – iOS-style press feedback on everything tappable
 */
(function () {
  'use strict';
  var root = document.documentElement;
  var UI_KEY = 'dig:ui';
  var KNOWN = ['maple', 'flame', 'cyber', 'emerald', 'sakura', 'autumn', 'sunset', 'crimson', 'gold', 'forest', 'ocean', 'violet', 'mono', 'midnight', 'ice', 'candy', 'matcha'];
  var HEX = /^#[0-9a-f]{6}$/i;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var haptic = function (ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 8); } catch (e) {} };

  /* ───────── theme (whole site follows the Studio theme) ───────── */
  var theme = {
    read: function () { try { var o = JSON.parse(localStorage.getItem(UI_KEY) || 'null'); return o && KNOWN.indexOf(o.theme) > -1 ? o : null; } catch (e) { return null; } },
    save: function (t, a, b) {
      try { localStorage.setItem(UI_KEY, JSON.stringify({ theme: KNOWN.indexOf(t) > -1 ? t : 'flame', accent: HEX.test(a || '') ? a : '', accent2: HEX.test(b || '') ? b : '' })); } catch (e) {}
    },
    clear: function () { try { localStorage.removeItem(UI_KEY); } catch (e) {} },
    /* paint the page with a theme (and optional custom colours) */
    apply: function (t, a, b) {
      t = KNOWN.indexOf(t) > -1 ? t : 'flame';
      root.setAttribute('data-theme', t);
      ['--accent', '--accent-2', '--accent-soft', '--accent-glow', '--soft'].forEach(function (v) { root.style.removeProperty(v); });
      if (HEX.test(a || '')) {
        var c2 = HEX.test(b || '') ? b : a, r = parseInt(a.slice(1, 3), 16), g = parseInt(a.slice(3, 5), 16), bl = parseInt(a.slice(5, 7), 16);
        root.style.setProperty('--accent', a); root.style.setProperty('--accent-2', c2);
        root.style.setProperty('--accent-soft', 'rgba(' + r + ',' + g + ',' + bl + ',.13)');
        root.style.setProperty('--accent-glow', 'rgba(' + r + ',' + g + ',' + bl + ',.45)');
        root.style.setProperty('--soft', 'rgba(' + r + ',' + g + ',' + bl + ',.14)');
      }
      theme.meta();
    },
    /* the visitor's own saved Studio theme (or the default) */
    restore: function () { var o = theme.read(); theme.apply(o ? o.theme : 'flame', o && o.accent, o && o.accent2); },
    /* browser / PWA bar colour follows the theme */
    meta: function () {
      var m = document.querySelector('meta[name=theme-color]'); if (!m) return;
      var bg = getComputedStyle(root).getPropertyValue('--bg').trim() || '#0c0708';
      m.setAttribute('content', bg);
    }
  };

  /* ───────── helpers ───────── */
  function cssColor(name, fallback) {
    var v = getComputedStyle(root).getPropertyValue(name).trim();
    if (HEX.test(v)) return v;
    var m = /^#([0-9a-f]{3})$/i.exec(v); if (m) return '#' + m[1].split('').map(function (x) { return x + x; }).join('');
    var r = /rgba?\(\s*(\d+)[ ,]+(\d+)[ ,]+(\d+)/i.exec(v);
    if (r) return '#' + [r[1], r[2], r[3]].map(function (n) { return ('0' + (+n).toString(16)).slice(-2); }).join('');
    return fallback;
  }
  function mix(hex, to, t) {
    var h = function (s, i) { return parseInt(s.slice(i, i + 2), 16); };
    var out = [1, 3, 5].map(function (i) { return Math.round(h(hex, i) * (1 - t) + h(to, i) * t); });
    return '#' + out.map(function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg) {
    var el = document.getElementById('toast'); if (!el) return;
    el.textContent = msg;
    if (el.classList.contains('toast')) { el.classList.add('show'); clearTimeout(el.__t); el.__t = setTimeout(function () { el.classList.remove('show'); }, 1900); }
    else { el.style.opacity = '1'; el.style.transform = 'translate(-50%,0)'; clearTimeout(el.__t); el.__t = setTimeout(function () { el.style.opacity = '0'; el.style.transform = 'translate(-50%,20px)'; }, 1900); }
  }
  function copyText(text) {
    var fb = function () { var i = document.createElement('textarea'); i.value = text; i.setAttribute('readonly', ''); i.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(i); i.select(); var ok = false; try { ok = document.execCommand('copy'); } catch (e) {} i.remove(); return ok; };
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fb(); });
    return Promise.resolve(fb());
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }
  var coarse = function () { return window.matchMedia && matchMedia('(pointer: coarse)').matches; };

  /* ───────── vCard ───────── */
  var vesc = function (v) { return String(v == null ? '' : v).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1'); };
  function fold(line) {                       // RFC 6350: lines longer than 75 bytes are folded with CRLF + space
    var enc = new TextEncoder(), chunks = [], cur = '', bytes = 0, limit = 75;
    for (var ch of line) {
      var n = enc.encode(ch).length;
      if (bytes + n > limit) { chunks.push(cur); cur = ''; bytes = 0; limit = 74; }
      cur += ch; bytes += n;
    }
    chunks.push(cur);
    return chunks.join('\r\n ');
  }
  function splitName(full) {
    var clean = String(full || '').replace(/[☆★✦✧]+/g, '').replace(/\s+/g, ' ').trim() || 'Maple ID';
    var parts = clean.split(' ');
    if (parts.length < 2) return { fn: clean, family: '', given: clean };
    return { fn: clean, family: parts.pop(), given: parts.join(' ') };
  }
  var vcard = {
    /* links: [{label, href}] – optional extra profile links (Instagram, YouTube …) */
    build: function (p, url, links) {
      var nm = splitName(p.name), L = [];
      L.push('BEGIN:VCARD', 'VERSION:3.0', 'PRODID:-//Maple ID//Card//EN');
      L.push('FN:' + vesc(nm.fn));
      L.push('N:' + vesc(nm.family) + ';' + vesc(nm.given) + ';;;');
      if (p.role && String(p.role).trim()) L.push('TITLE:' + vesc(String(p.role).trim()));
      var phone = String(p.contactPhone || '').trim(), mail = String(p.contactEmail || '').trim();
      var extras = [];
      (links || []).forEach(function (c) {
        if (!c || !c.href) return;
        if (/^mailto:/i.test(c.href)) { var m = c.href.slice(7); if (!mail) mail = m; else if (m !== mail) L.push('EMAIL;TYPE=INTERNET:' + vesc(m)); }
        else if (/^tel:/i.test(c.href)) { var t = c.href.slice(4); if (!phone) phone = t; else if (t !== phone) L.push('TEL;TYPE=CELL:' + vesc(t)); }
        else extras.push(c);
      });
      if (phone) L.push('TEL;TYPE=CELL,VOICE:' + vesc(phone));
      if (mail) L.push('EMAIL;TYPE=INTERNET,PREF:' + vesc(mail));
      if (p.city || p.country) L.push('ADR;TYPE=HOME:;;;' + vesc(p.city || '') + ';;;' + vesc(p.country || ''));
      L.push('item1.URL:' + url, 'item1.X-ABLabel:Maple ID');
      extras.slice(0, 12).forEach(function (c, i) {
        var g = 'item' + (i + 2);
        L.push(g + '.URL:' + c.href, g + '.X-ABLabel:' + vesc(c.label || 'Link'));
      });
      if (p.bio) L.push('NOTE:' + vesc(String(p.bio).slice(0, 280)));
      var av = String(p.avatar || ''), dm = /^data:image\/(jpeg|png|gif|webp);base64,([A-Za-z0-9+\/=]+)$/i.exec(av);
      if (dm && dm[2].length < 200000) L.push('PHOTO;ENCODING=b;TYPE=' + (dm[1].toLowerCase() === 'jpeg' ? 'JPEG' : dm[1].toUpperCase()) + ':' + dm[2]);
      else if (/^https?:\/\//i.test(av)) L.push('PHOTO;VALUE=uri:' + av);
      L.push('REV:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''));
      L.push('END:VCARD');
      return L.map(fold).join('\r\n') + '\r\n';
    },
    /* phones: open the share sheet (it offers "Contacts"), desktop: download the file */
    save: async function (p, url, links, done) {
      var text = vcard.build(p, url, links), name = (p.slug || 'contact') + '.vcf';
      var file; try { file = new File([text], name, { type: 'text/vcard' }); } catch (e) { file = null; }
      if (file && coarse() && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: nm(p) }); if (done) done(true); return true; }
        catch (e) { if (e && e.name === 'AbortError') return false; }
      }
      downloadBlob(new Blob([text], { type: 'text/vcard;charset=utf-8' }), name);
      if (done) done(false);
      return true;
    }
  };
  function nm(p) { return splitName(p.name).fn; }

  /* ───────── QR ───────── */
  var LEAF = 'M50 2L57 18L64 13L62 34L80 24L76 40L96 36L84 54L90 60L62 70L64 78L53 76L53 98L47 98L47 76L36 78L38 70L10 60L16 54L4 36L24 40L20 24L38 34L36 13L43 18Z';
  var qrCache = {};
  function qrSvg(text, o) {
    o = o || {};
    var q = window.dgQRLib.create(text, { errorCorrectionLevel: 'H' }), n = q.modules.size, d = q.modules.data, M = 2;
    var size = n + M * 2, fg = o.fg || '#120b0c', eye = o.eye || fg, bg = o.bg || '#ffffff', mid = size / 2, hole = Math.max(5, Math.round(n * 0.2)) | 0;
    var inEye = function (x, y) { return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7); };
    var inHole = function (x, y) { return Math.abs(x + M + .5 - mid) < hole / 2 + .6 && Math.abs(y + M + .5 - mid) < hole / 2 + .6; };
    var dots = '', on = function (x, y) { return x >= 0 && y >= 0 && x < n && y < n && d[y * n + x]; };
    for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
      if (!on(x, y) || inEye(x, y) || inHole(x, y)) continue;
      dots += '<rect x="' + (x + M + .04) + '" y="' + (y + M + .04) + '" width=".92" height=".92" rx=".3"/>';
    }
    var eyes = '';
    [[0, 0], [n - 7, 0], [0, n - 7]].forEach(function (p) {
      var ex = p[0] + M, ey = p[1] + M;
      eyes += '<rect x="' + (ex + .5) + '" y="' + (ey + .5) + '" width="6" height="6" rx=".4" fill="none" stroke="' + eye + '" stroke-width="1"/>'
        + '<rect x="' + (ex + 2) + '" y="' + (ey + 2) + '" width="3" height="3" rx=".6" fill="' + eye + '"/>';
    });
    var s = hole * .62, lx = mid - s / 2, ly = mid - s / 2;
    var logo = '<circle cx="' + mid + '" cy="' + mid + '" r="' + (hole / 2 + .3) + '" fill="' + bg + '"/>'
      + '<circle cx="' + mid + '" cy="' + mid + '" r="' + (hole / 2 - .35) + '" fill="url(#qg)"/>'
      + '<path d="' + LEAF + '" fill="#fff" transform="translate(' + (mid - s * .42) + ' ' + (mid - s * .44) + ') scale(' + (s * .0084) + ')"/>';
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="geometricPrecision">'
      + '<defs><linearGradient id="qg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + (o.a2 || '#ffb547') + '"/><stop offset="1" stop-color="' + (o.a1 || '#ff6a3d') + '"/></linearGradient></defs>'
      + '<rect width="' + size + '" height="' + size + '" fill="' + bg + '"/>'
      + '<g fill="' + fg + '">' + dots + '</g>' + eyes + logo + '</svg>';
  }
  function qrColors() {
    var a1 = cssColor('--accent', '#ff6a3d'), a2 = cssColor('--accent-2', '#ffb547');
    return { a1: a1, a2: a2, fg: mix(a1, '#000000', .78), eye: mix(a1, '#000000', .6), bg: '#ffffff' };
  }
  function svgToPng(svg, px) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), url = URL.createObjectURL(blob);
      img.onload = function () {
        var c = document.createElement('canvas'), pad = Math.round(px * .06); c.width = c.height = px + pad * 2;
        var x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, pad, pad, px, px);
        URL.revokeObjectURL(url); c.toBlob(function (b) { b ? resolve(b) : reject(new Error('png')); }, 'image/png');
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }
  var sheet = null;
  function closeSheet() {
    if (!sheet) return; var s = sheet; sheet = null; s.classList.remove('open');
    document.removeEventListener('keydown', s.__esc);
    setTimeout(function () { s.remove(); }, 380);
  }
  var qr = {
    open: function (o) {
      if (!window.dgQRLib) { toast('QR is not available'); return; }
      closeSheet();
      var url = o.url, name = o.name || '', L = o.labels || {};
      var svg; try { svg = qrSvg(url, qrColors()); } catch (e) { toast('Could not make the QR code'); return; }
      var host = String(url).replace(/^https?:\/\//, '');
      var s = document.createElement('div'); s.className = 'qs'; s.setAttribute('role', 'dialog'); s.setAttribute('aria-modal', 'true'); s.setAttribute('aria-label', L.title || 'QR code');
      s.innerHTML = '<div class="qs-back"></div>'
        + '<div class="qs-sheet"><div class="qs-grab" aria-hidden="true"></div>'
        + '<button type="button" class="qs-x" aria-label="Close"><i class="fa-solid fa-xmark"></i></button>'
        + '<div class="qs-card"><div class="qs-code">' + svg + '</div>'
        + '<h2 class="qs-name">' + esc(name) + '</h2><p class="qs-url">' + esc(host) + '</p>'
        + '<p class="qs-hint">' + esc(L.hint || 'Point your camera at the code to open this card') + '</p></div>'
        + '<div class="qs-acts"><button type="button" class="qs-btn qs-main" data-q="save"><i class="fa-solid fa-download"></i><span>' + esc(L.save || 'Save image') + '</span></button>'
        + '<button type="button" class="qs-btn" data-q="share"><i class="fa-solid fa-share-nodes"></i><span>' + esc(L.share || 'Share') + '</span></button>'
        + '<button type="button" class="qs-btn" data-q="copy"><i class="fa-solid fa-link"></i><span>' + esc(L.copy || 'Copy link') + '</span></button></div></div>';
      document.body.appendChild(s); sheet = s; void s.offsetWidth; s.classList.add('open');
      s.__esc = function (e) { if (e.key === 'Escape') closeSheet(); };
      document.addEventListener('keydown', s.__esc);
      s.querySelector('.qs-back').addEventListener('click', closeSheet);
      s.querySelector('.qs-x').addEventListener('click', closeSheet);
      s.addEventListener('click', async function (e) {
        var b = e.target.closest('[data-q]'); if (!b) return; var k = b.dataset.q; haptic(10);
        if (k === 'copy') { await copyText(url); toast(L.copied || 'Link copied'); }
        else if (k === 'share') {
          if (navigator.share) { try { await navigator.share({ title: name, url: url }); return; } catch (er) { if (er && er.name === 'AbortError') return; } }
          await copyText(url); toast(L.copied || 'Link copied');
        } else if (k === 'save') {
          try {
            var png = await svgToPng(qrSvg(url, qrColors()).replace('<svg ', '<svg width="1024" height="1024" '), 1024);
            var fname = (String(url).split('/').filter(Boolean).pop() || 'maple') + '-qr.png', f = null;
            try { f = new File([png], fname, { type: 'image/png' }); } catch (er) {}
            if (f && coarse() && navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); return; } catch (er) { if (er && er.name === 'AbortError') return; } }
            downloadBlob(png, fname); toast(L.saved || 'QR image saved');
          } catch (er) { toast('Could not save the image'); }
        }
      });
      // drag the handle / sheet down to dismiss (iOS style)
      var sh = s.querySelector('.qs-sheet'), y0 = null, dy = 0;
      sh.addEventListener('pointerdown', function (e) { if (e.target.closest('button')) return; y0 = e.clientY; dy = 0; sh.style.transition = 'none'; try { sh.setPointerCapture(e.pointerId); } catch (er) {} });
      sh.addEventListener('pointermove', function (e) { if (y0 == null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = 'translateY(' + dy + 'px)'; });
      var end = function () { if (y0 == null) return; y0 = null; sh.style.transition = ''; if (dy > 110) { closeSheet(); } sh.style.transform = ''; };
      sh.addEventListener('pointerup', end); sh.addEventListener('pointercancel', end);
    },
    close: closeSheet
  };

  /* ───────── iOS-style press feedback ───────── */
  var PRESS = 'button,a[href],.btn,.tile,.live,[role=button],[role=tab],.swatch,.tab,.ptab,.layout-opt,label.toggle,summary,.qs-btn';
  var SKIP = '[disabled],input,select,textarea,.qs-sheet,.qs-card,.music-panel,.modal-card';
  function initPress() {
    if (reduce) return;
    var held = null, t0 = 0, timer = 0;
    function release(el) {
      var wait = Math.max(0, 110 - (Date.now() - t0));
      clearTimeout(timer); timer = setTimeout(function () { if (el) el.classList.remove('is-pressed'); }, wait);
    }
    document.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      var el = e.target.closest && e.target.closest(PRESS);
      if (!el || el.matches(SKIP) || el.closest('.qs-card')) return;
      if (held && held !== el) held.classList.remove('is-pressed');
      held = el; t0 = Date.now(); el.classList.add('is-pressed');
    }, { passive: true });
    ['pointerup', 'pointercancel', 'dragend'].forEach(function (ev) { document.addEventListener(ev, function () { if (held) { release(held); held = null; } }, { passive: true }); });
    // moving the finger far away (scrolling) cancels the press so lists don't flash while scrolling
    var sx = 0, sy = 0;
    document.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; }, { passive: true });
    document.addEventListener('pointermove', function (e) { if (held && (Math.abs(e.clientX - sx) > 12 || Math.abs(e.clientY - sy) > 12)) { held.classList.remove('is-pressed'); held = null; } }, { passive: true });
    document.addEventListener('touchstart', function () {}, { passive: true });   // lets :active work on iOS Safari
  }
  initPress();

  window.dgUI = { theme: theme, vcard: vcard, qr: qr, toast: toast, copy: copyText, haptic: haptic };
  // first paint: theme colour of the browser bar
  try { theme.meta(); } catch (e) {}
})();
