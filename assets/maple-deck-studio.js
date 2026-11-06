/* M-ID · Studio → Look → "Glass slides background" (v36)
 * Lets the owner pick the background of the Glass slides layout:
 *   · Theme   – the new animated background drawn in the current theme's colours (with the theme's own motif)
 *   · Banner  – the card banner (picture or video) stretched full screen
 *   · Custom  – a new picture, GIF or video uploaded here (or pasted as an https link), only for this layout
 * plus how dark and how blurred it is. The values ride along with the Studio's normal Publish through
 * window.__dkBg(), like the other Studio add-ons, and are saved with the rest of the profile. */
(function () {
  'use strict';
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var form = null, st = null, busy = false;
  var MODES = [
    { id: 'theme', label: 'Theme', sub: 'Animated, follows your theme', icon: 'fa-wand-magic-sparkles' },
    { id: 'banner', label: 'Banner', sub: 'Your banner, full screen', icon: 'fa-panorama' },
    { id: 'custom', label: 'Custom', sub: 'Upload a picture, GIF or video', icon: 'fa-image' }
  ];

  function isVideoUrl(u) { return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(u || ''); }
  function dirty() { if (form) form.dispatchEvent(new Event('input', { bubbles: true })); }
  function snapshot() {
    return { deckBg: st.mode === 'custom' && !st.url ? 'theme' : st.mode, deckBgUrl: st.url, deckBgKind: st.kind, deckDim: st.dim, deckBlur: st.blur };
  }

  function thumb() {
    if (!st.url) return '<span class="dkbg-empty"><i class="fa-regular fa-image"></i> No background yet</span>';
    return st.kind === 'video'
      ? '<video src="' + esc(st.url) + '" muted loop playsinline autoplay></video>'
      : '<img src="' + esc(st.url) + '" alt="Custom background" onerror="this.replaceWith(Object.assign(document.createElement(\'span\'),{className:\'dkbg-empty\',textContent:\'This link could not be loaded\'}))">';
  }
  function paint() {
    var box = form && form.querySelector('[data-dkbg]'); if (!box) return;
    box.innerHTML = '<div class="dkbg-modes" role="radiogroup" aria-label="Background">'
      + MODES.map(function (m) {
        return '<label class="dkbg-mode"><input type="radio" name="dkbg-mode" value="' + m.id + '"' + (st.mode === m.id ? ' checked' : '') + '>'
          + '<span><i class="dkbg-sw dkbg-sw-' + m.id + '" aria-hidden="true"><i class="fa-solid ' + m.icon + '"></i></i><b>' + m.label + '</b><small>' + m.sub + '</small></span></label>';
      }).join('') + '</div>'
      + '<div class="dkbg-custom"' + (st.mode === 'custom' ? '' : ' hidden') + '>'
      + '<div class="dkbg-thumb" data-dkbg-thumb>' + thumb() + '</div>'
      + '<div class="dkbg-acts"><label class="btn btn-sm btn-accent"><i class="fa-solid fa-upload"></i> Upload<input type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" data-dkbg-file hidden></label>'
      + (st.url ? '<button type="button" class="btn btn-sm" data-dkbg-clear><i class="fa-solid fa-trash"></i> Remove</button>' : '') + '</div>'
      + '<div class="dkbg-link"><input type="url" inputmode="url" maxlength="600" placeholder="…or paste an https:// link to a picture, GIF or MP4" data-dkbg-url value="' + esc(st.url) + '" aria-label="Background link">'
      + '<button type="button" class="btn btn-sm" data-dkbg-use>Use</button></div>'
      + '<small class="dkbg-note">Pictures up to 3 MB (bigger ones are shrunk for you), GIFs up to 3 MB, videos up to 25 MB. Videos play muted and loop.</small>'
      + '</div>'
      + '<p class="dkbg-msg" data-dkbg-msg role="status"></p>'
      + '<div class="field frost"><label>Darken <small>keeps the text easy to read</small></label>'
      + '<div class="frost-row"><input type="range" min="0" max="90" step="1" value="' + st.dim + '" data-dkbg-dim aria-label="Darken background"><output>' + st.dim + '%</output></div></div>'
      + '<div class="field frost"><label>Blur <small>soften a busy picture</small></label>'
      + '<div class="frost-row"><input type="range" min="0" max="24" step="1" value="' + st.blur + '" data-dkbg-blur aria-label="Blur background"><output>' + st.blur + '</output></div></div>'
      + '<p class="hint">Turn off “Animated theme background” below to keep the theme background still.</p>';
  }
  function msg(t, bad) { var m = form && form.querySelector('[data-dkbg-msg]'); if (!m) return; m.className = 'dkbg-msg' + (bad ? ' bad' : ''); m.innerHTML = t; }

  /* pictures over 3 MB are re-encoded (GIFs are kept as they are so they still move) */
  function shrink(file) {
    return new Promise(function (res, rej) {
      var img = new Image(), u = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 2200 / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(function (b) { b ? res(b) : rej(new Error('That picture couldn’t be read.')); }, 'image/jpeg', 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(u); rej(new Error('That picture couldn’t be read.')); };
      img.src = u;
    });
  }
  function upload(file) {
    if (busy) return;
    var type = String(file.type || '').toLowerCase(), video = /^video\//.test(type);
    if (!/^(image\/(jpeg|png|webp|gif)|video\/(mp4|webm))$/.test(type)) { msg('Use a JPG, PNG, WebP, GIF, MP4 or WebM file.', true); return; }
    if (video && file.size > 25 * 1048576) { msg('That video is too big (max 25 MB).', true); return; }
    if (type === 'image/gif' && file.size > 3 * 1048576) { msg('That GIF is too big (max 3 MB). Try a shorter one, or paste a link instead.', true); return; }
    busy = true;
    msg('<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading ' + esc(file.name || 'file') + '…');
    var ready = !video && type !== 'image/gif' && file.size > 3 * 1048576 ? shrink(file) : Promise.resolve(file);
    ready.then(function (blob) {
      return fetch('/api/uploads?kind=forum-' + (video ? 'vid' : 'img'), { method: 'POST', body: blob });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { if (!r.ok || !d.url) throw new Error(d.error || 'Upload failed. Please try again.'); return d.url; });
    }).then(function (url) {
      st.url = url; st.kind = video ? 'video' : 'image'; st.mode = 'custom';
      busy = false; paint(); dirty(); msg('Background uploaded. Publish to save it.');
    }).catch(function (e) { busy = false; msg(esc((e && e.message) || 'Upload failed. Please try again.'), true); });
  }
  function useLink() {
    var inp = form.querySelector('[data-dkbg-url]'), u = String(inp && inp.value || '').trim();
    if (!u) { msg('Paste a link first.', true); return; }
    if (!/^https:\/\/[^\s"'<>]+$/i.test(u) || u.length > 600) { msg('Use a full https:// link.', true); return; }
    st.url = u; st.kind = isVideoUrl(u) ? 'video' : 'image'; st.mode = 'custom';
    paint(); dirty(); msg('Background set. Publish to save it.');
  }

  function bind() {
    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'dkbg-mode') {
        st.mode = t.value;
        var c = form.querySelector('.dkbg-custom'); if (c) c.hidden = st.mode !== 'custom';
        if (st.mode === 'banner' && window.__dgGet && !window.__dgGet().banner) msg('You have no banner yet. Add one on the Profile tab, otherwise the theme background is used.');
        else msg('');
        dirty();
      } else if (t.matches && t.matches('[data-dkbg-file]') && t.files && t.files[0]) { upload(t.files[0]); t.value = ''; }
      else if (t.name === 'layout') syncVis();
    });
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches && t.matches('[data-dkbg-dim]')) { st.dim = Number(t.value) || 0; t.nextElementSibling.textContent = st.dim + '%'; }
      else if (t.matches && t.matches('[data-dkbg-blur]')) { st.blur = Number(t.value) || 0; t.nextElementSibling.textContent = st.blur; }
    });
    form.addEventListener('click', function (e) {
      if (e.target.closest('[data-dkbg-use]')) { e.preventDefault(); useLink(); }
      else if (e.target.closest('[data-dkbg-clear]')) { e.preventDefault(); st.url = ''; st.kind = 'image'; paint(); dirty(); msg('Removed. The theme background is used until you add a new one.'); }
    });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.matches && e.target.matches('[data-dkbg-url]')) { e.preventDefault(); useLink(); }
    });
  }
  function syncVis() {
    var l = form && form.querySelector('input[name="layout"]:checked');
    var on = !!l && l.value === 'deck';
    form.querySelectorAll('[data-deck-only]').forEach(function (f) { f.hidden = !on; });
  }

  function init(f) {
    form = f; window.__dkBg = null;
    var cur = window.__dgGet ? window.__dgGet() : {};
    var dim = Number(cur.deckDim), blur = Number(cur.deckBlur);
    st = {
      mode: ['theme', 'banner', 'custom'].indexOf(cur.deckBg) > -1 ? cur.deckBg : 'theme',
      url: cur.deckBgUrl || '', kind: cur.deckBgKind === 'video' ? 'video' : 'image',
      dim: isFinite(dim) && cur.deckDim !== undefined && cur.deckDim !== '' ? dim : 40,
      blur: isFinite(blur) && cur.deckBlur !== undefined && cur.deckBlur !== '' ? blur : 0
    };
    window.__dkBg = snapshot;
    paint(); bind(); syncVis();
  }
  function check() {
    var f = document.getElementById('editor');
    if (f && f !== form && f.querySelector('[data-dkbg]') && window.__dgGet) init(f);
    if (!f && form) { form = null; window.__dkBg = null; }
  }
  new MutationObserver(function () { clearTimeout(check.t); check.t = setTimeout(check, 30); }).observe(document.body, { childList: true, subtree: true });
  check();
})();
