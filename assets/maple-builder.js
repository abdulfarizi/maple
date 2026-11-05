/* M-ID · Free-canvas builder: opens the drag-and-drop editor full screen and syncs it into the Studio form. */
(function () {
  'use strict';
  var overlay = null, form = null;
  function sync() {
    var f = document.getElementById('editor'); if (!f) return;
    if (f !== form) { form = f; window.__bld = null; window.__gifs = null; window.__bdr = null; window.__qri = null; }
    starUi(f); qrUi(f);
    var r = f.querySelector('input[name=layout]:checked');
    var fs = f.querySelector('[data-builder-only]');
    if (fs && !fs.querySelector('#bld-inbox')) {
      var b = document.createElement('button'); b.type = 'button'; b.id = 'bld-inbox'; b.className = 'btn'; b.style.marginLeft = '8px';
      b.innerHTML = '<i class="fa-solid fa-inbox"></i> Messages'; fs.appendChild(b);
    }
    f.querySelectorAll('[data-builder-only]').forEach(function (e) { e.hidden = !(r && r.value === 'builder'); });
  }
  var SECS = [['panel', 'Whole card'], ['banner', 'Banner'], ['avatar', 'Avatar'], ['name', 'Name'], ['specs', 'Gear box'], ['bio', 'Bio'], ['links', 'Link buttons']];
  var TPLS = [['default', 'Default (no change)'], ['neon', 'Neon'], ['gold', 'Gold'], ['pastel', 'Pastel'], ['pixel', 'Pixel'], ['glass', 'Glass'], ['none', 'No borders']];
  function qrUi(f) {
    if (f.querySelector('#qr-sym') || !window.dgQRIcons) return;
    var lay = f.querySelector('input[name=layout]'), host = lay && lay.closest('fieldset'); if (!host) return;
    var fs = document.createElement('fieldset'); fs.id = 'qr-sym';
    fs.innerHTML = '<legend>QR code symbol</legend><p class="hint">The little picture in the middle of your card&rsquo;s QR code.</p>'
      + '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div id="qr-prev" style="width:104px;height:104px;flex:none"></div><div style="flex:1;min-width:160px">'
      + '<div class="field"><label>Symbol</label><select id="qr-sel"><option value="">Default (maple leaf)</option>' + window.dgQRIcons.options(0, false) + '</select></div>'
      + '<div class="field"><input type="text" id="qr-chr" maxlength="4" placeholder="Type or paste: 👟" hidden aria-label="Custom symbol"></div></div></div>';
    host.parentNode.insertBefore(fs, host.nextSibling);
    var sel = fs.querySelector('#qr-sel'), chr = fs.querySelector('#qr-chr'), prev = fs.querySelector('#qr-prev');
    var cur = function () { var p = window.__dgGet ? window.__dgGet() : {}; return window.__qri !== undefined && window.__qri !== null ? window.__qri : (p.qrIcon || ''); };
    var paint = function () {
      var v = cur(); sel.value = v.indexOf('t:') === 0 ? 'custom' : v; chr.hidden = sel.value !== 'custom';
      if (v.indexOf('t:') === 0 && document.activeElement !== chr) chr.value = v.slice(2);
      var p = window.__dgGet ? window.__dgGet() : {};
      try { prev.innerHTML = window.dgUI && window.dgUI.qrSvg ? window.dgUI.qrSvg(location.origin + '/' + (p.slug || 'you'), v || 'leaf') : ''; prev.firstChild && (prev.firstChild.style.cssText = 'width:100%;height:100%;border-radius:10px'); } catch (e) { prev.textContent = ''; }
    };
    var fire = function () { paint(); f.dispatchEvent(new Event('change', { bubbles: true })); };
    sel.addEventListener('change', function () {
      if (sel.value === 'custom') { var v = Array.from(chr.value.trim()).slice(0, 2).join('') || '👟'; window.__qri = 't:' + v; chr.value = v; }
      else window.__qri = sel.value; fire();
    });
    chr.addEventListener('input', function () { var v = Array.from(chr.value.trim()).slice(0, 2).join(''); window.__qri = v ? 't:' + v : ''; fire(); });
    setTimeout(paint, 50);
  }
  function bdr() {
    if (!window.__bdr) { var p = window.__dgGet ? window.__dgGet() : {}; window.__bdr = { tpl: p.bdTpl || 'default', map: JSON.parse(JSON.stringify(p.bd || {})) }; }
    return window.__bdr;
  }
  function starUi(f) {
    if (f.querySelector('#star-gb')) return;
    var anchor = f.querySelector('fieldset[data-star-only]'); if (!anchor) return;
    var fs = document.createElement('fieldset'); fs.id = 'star-gb'; fs.setAttribute('data-star-only', ''); fs.hidden = anchor.hidden;
    var opt = function (a) { return a.map(function (x) { return '<option value="' + x[0] + '">' + x[1] + '</option>'; }).join(''); };
    fs.innerHTML = '<legend>GIFs &amp; borders</legend>'
      + '<p class="hint">Add GIFs anywhere on your Star card: behind the card, in front of the buttons, or as the whole page background.</p>'
      + '<button type="button" class="btn btn-accent" id="gif-open"><i class="fa-solid fa-wand-magic-sparkles"></i> Add &amp; place GIFs</button>'
      + '<div class="field" style="margin-top:14px"><label>Border style (all sections)</label><select id="bd-tpl">' + opt(TPLS) + '</select></div>'
      + '<div class="field"><label>Edit one border by hand</label><select id="bd-sec">' + opt(SECS) + '</select></div>'
      + '<div class="field"><label>Colour</label><input type="color" data-k="c" value="#ff5d7e"></div>'
      + '<div class="field"><label>Thickness</label><input type="range" data-k="w" min="0" max="12" value="1"></div>'
      + '<div class="field"><label>Roundness</label><input type="range" data-k="r" min="0" max="60" value="14"></div>'
      + '<div class="field"><label>Glow</label><input type="range" data-k="g" min="0" max="30" value="0"></div>'
      + '<div class="field"><label>Line style</label><select data-k="s">' + opt([['solid', 'Solid'], ['dashed', 'Dashed'], ['dotted', 'Dotted'], ['double', 'Double'], ['groove', 'Groove'], ['ridge', 'Ridge']]) + '</select></div>'
      + '<div class="field"><label>GIF or image border (https link, optional)</label><input type="text" data-k="img" placeholder="https://…"></div>'
      + '<label class="toggle"><input type="checkbox" data-k="off"><span>Hide this border</span></label>'
      + '<button type="button" class="btn" id="bd-reset" style="margin-top:8px">Reset this border</button>';
    anchor.parentNode.insertBefore(fs, anchor);
    var tpl = fs.querySelector('#bd-tpl'), sec = fs.querySelector('#bd-sec');
    var fire = function () { f.dispatchEvent(new Event('change', { bubbles: true })); };
    var load = function () {
      var o = bdr().map[sec.value] || {};
      fs.querySelectorAll('[data-k]').forEach(function (i) {
        var k = i.dataset.k, v = o[k];
        if (i.type === 'checkbox') i.checked = !!v;
        else if (v !== undefined) i.value = v;
        else i.value = { c: '#ff5d7e', w: 1, r: 14, g: 0, s: 'solid', img: '' }[k];
      });
    };
    tpl.value = bdr().tpl; load();
    tpl.addEventListener('change', function () { bdr().tpl = tpl.value; fire(); });
    sec.addEventListener('change', load);
    fs.addEventListener('input', function (e) {
      var i = e.target; if (!i.dataset || !i.dataset.k) return;
      var m = bdr().map, o = m[sec.value] = m[sec.value] || {}, k = i.dataset.k;
      if (i.type === 'checkbox') { if (i.checked) o.off = true; else delete o.off; }
      else if (k === 'c' || k === 's' || k === 'img') { if (i.value) o[k] = i.value.trim(); else delete o[k]; }
      else o[k] = Number(i.value);
      fire();
    });
    fs.addEventListener('click', function (e) {
      if (e.target.closest('#bd-reset')) { delete bdr().map[sec.value]; load(); fire(); }
      else if (e.target.closest('#gif-open')) openFrame('/owner/index.html?preview=1&gifedit=1', 'GIF editor');
    });
  }
  var hidden = [];
  function openFrame(src, title) {
    if (!window.__dgGet) return; close();
    overlay = document.createElement('div'); overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:var(--bg);color:var(--text);font:14px system-ui,sans-serif';
    var note = document.createElement('div'); note.textContent = 'Loading editor…'; note.style.cssText = 'position:absolute;inset:0;display:grid;place-items:center'; overlay.appendChild(note);
    var fr = document.createElement('iframe'); fr.title = title; fr.src = src; fr.style.cssText = 'position:absolute;inset:0;border:0;width:100%;height:100%;display:block;background:transparent';
    var tries = 0, go = function () {
      try { if (fr.contentWindow && typeof fr.contentWindow.renderCard === 'function') { fr.contentWindow.renderCard(window.__dgGet()); note.remove(); return; } } catch (e) {}
      if (++tries < 60) setTimeout(go, 100); else note.textContent = 'Could not open the editor. Close and try again.';
    };
    fr.addEventListener('load', go);
    overlay.appendChild(fr);
    // the Studio page behind (with its own live preview) is parked while the editor is open, so a phone only draws one page at a time
    hidden = []; Array.prototype.forEach.call(document.body.children, function (c) { if (c !== overlay && c.style.display !== 'none') { hidden.push([c, c.style.display]); c.style.display = 'none'; } });
    document.body.appendChild(overlay); document.documentElement.style.overflow = 'hidden';
    document.addEventListener('keydown', esc);
  }
  function esc(e) { if (e.key === 'Escape') close(); }
  function close() {
    document.removeEventListener('keydown', esc);
    if (overlay) { overlay.remove(); overlay = null; document.documentElement.style.overflow = ''; }
    hidden.forEach(function (h) { h[0].style.display = h[1]; }); hidden = [];
    window.dispatchEvent(new Event('resize'));
  }
  function open() { openFrame('/builder/page.html?edit=1', 'Page builder'); }
  function el(tag, css, txt) { var e = document.createElement(tag); if (css) e.style.cssText = css; if (txt) e.textContent = txt; return e; }
  function inbox() {
    var ov = el('div', 'position:fixed;inset:0;z-index:100000;background:color-mix(in srgb,var(--bg) 93%,transparent);overflow:auto;padding:16px');
    var box = el('div', 'max-width:560px;margin:0 auto;color:var(--text);font:15px system-ui,sans-serif');
    var top = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:12px'), h = el('b', 'flex:1;font-size:18px', 'Anonymous messages');
    var x = el('button', 'font:inherit;padding:6px 12px;border-radius:8px;border:1px solid var(--line-strong);background:var(--bg-2);color:inherit;cursor:pointer', 'Close');
    x.onclick = function () { ov.remove(); }; top.append(h, x); box.append(top);
    var list = el('div', '', 'Loading…'); box.append(list); ov.append(box); document.body.append(ov);
    fetch('/api/messages').then(function (r) { return r.json(); }).then(function (d) {
      list.textContent = ''; var ms = (d && d.messages) || [];
      if (!ms.length) { list.textContent = d && d.error ? d.error : 'No messages yet.'; return; }
      ms.forEach(function (m) {
        var c = el('div', 'background:var(--panel-solid);border:1px solid var(--line-strong);border-left:4px solid #ff5d7e;border-radius:10px;padding:10px;margin-bottom:10px');
        c.append(el('small', 'opacity:.6', new Date(m.created_at).toLocaleString()));
        if (m.body) c.append(el('div', 'white-space:pre-wrap;margin-top:4px', m.body));
        if (/^data:image\/(jpeg|png);base64,/.test(m.drawing || '')) { var im = el('img', 'display:block;max-width:100%;margin-top:6px;background:#fff;border-radius:8px'); im.alt = 'Drawing'; im.src = m.drawing; c.append(im); }
        var del = el('button', 'margin-top:8px;font:inherit;padding:4px 10px;border-radius:8px;border:1px solid var(--line-strong);background:transparent;color:inherit;cursor:pointer', 'Delete');
        del.onclick = function () { fetch('/api/messages/' + m.id, { method: 'DELETE' }).then(function () { c.remove(); }); };
        c.append(del); list.append(c);
      });
    }).catch(function () { list.textContent = 'Could not load messages.'; });
  }
  document.addEventListener('click', function (e) { if (e.target.closest('#bld-inbox')) inbox(); });
  window.addEventListener('message', function (e) {
    var d = e.data; if (e.origin !== location.origin || !d) return;
    if (d.maple === 'bld' && Array.isArray(d.blocks)) {
      window.__bld = { blocks: d.blocks, page: d.page };
      var f = document.getElementById('editor'); if (f) f.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (d.maple === 'gifs' && Array.isArray(d.gifs)) {
      window.__gifs = d.gifs;
      var f2 = document.getElementById('editor'); if (f2) f2.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (d.maple === 'bld-close') close();
  });
  document.addEventListener('click', function (e) { if (e.target.closest('#bld-open')) open(); });
  document.addEventListener('change', function (e) { if (e.target && e.target.name === 'layout') sync(); });
  new MutationObserver(sync).observe(document.documentElement, { childList: true, subtree: true });
})();
