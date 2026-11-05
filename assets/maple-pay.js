/* M-ID · QR checkout
 * Sellers upload the DuitNow QR from their own banking app. We read it, keep the payment details
 * untouched, and redraw it in the card's theme (custom colours, dot style, hollow-star centre).
 * At checkout the buyer sees that QR with the exact amount filled in, pays straight to the seller,
 * then sends proof on WhatsApp. Nothing here holds or verifies money: the seller confirms by hand.
 * Needs window.dgQRLib (assets/qr-lib.js) to draw. Exposes window.MaplePay. */
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.MaplePay) return;

  var HEX = /^#[0-9a-f]{6}$/i;
  var JSQR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jsQR/1.4.0/jsQR.min.js';

  /* ───────── colour helpers ───────── */
  function rgb(h) { var n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
  function hex(a) {
    return '#' + a.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? '0' : '') + v.toString(16); }).join('');
  }
  function mix(a, b, t) { var x = rgb(a), y = rgb(b); return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]); }
  function lum(h) {
    var c = rgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function ratio(a, b) { var l1 = lum(a), l2 = lum(b); if (l1 < l2) { var t = l1; l1 = l2; l2 = t; } return (l1 + 0.05) / (l2 + 0.05); }
  function parseColor(v) {
    v = String(v || '').trim();
    if (HEX.test(v)) return v.toLowerCase();
    var m3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
    if (m3) return ('#' + m3[1] + m3[1] + m3[2] + m3[2] + m3[3] + m3[3]).toLowerCase();
    var m = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})/i.exec(v);
    return m ? hex([+m[1], +m[2], +m[3]]) : '';
  }
  function pageAccent() {
    try { return parseColor(getComputedStyle(document.documentElement).getPropertyValue('--accent')); } catch (e) { return ''; }
  }
  /* theme colours: a very light tint of the accent behind dots that are the accent, darkened until they scan well */
  function autoColors(accent) {
    var a = parseColor(accent) || '#c2410c', bg = mix(a, '#ffffff', 0.93), fg = a, i = 0;
    while (ratio(fg, bg) < 6.5 && i++ < 24) fg = mix(fg, '#000000', 0.12);
    return { fg: fg, bg: bg };
  }
  function effective(cfg, accent) {
    var auto = autoColors(accent || pageAccent());
    return { fg: HEX.test(cfg.fg || '') ? cfg.fg : auto.fg, bg: HEX.test(cfg.bg || '') ? cfg.bg : auto.bg };
  }
  /* 'ok' | 'low' | 'bad' | 'inverted' */
  function contrastState(fg, bg) {
    if (lum(fg) > lum(bg)) return 'inverted';
    var r = ratio(fg, bg);
    return r < 3 ? 'bad' : r < 4.5 ? 'low' : 'ok';
  }

  /* ───────── EMV QR (DuitNow QR follows EMVCo) ───────── */
  function crc16(s) {
    var crc = 0xFFFF, i, j;
    for (i = 0; i < s.length; i++) {
      crc ^= s.charCodeAt(i) << 8;
      for (j = 0; j < 8; j++) crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
    return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
  }
  function parseTlv(s) {
    var out = [], i = 0;
    while (i < s.length) {
      var id = s.slice(i, i + 2), ln = s.slice(i + 2, i + 4);
      if (!/^\d{2}$/.test(id) || !/^\d{2}$/.test(ln)) return null;
      var n = parseInt(ln, 10), val = s.slice(i + 4, i + 4 + n);
      if (val.length !== n) return null;
      out.push([id, val]);
      i += 4 + n;
    }
    return out;
  }
  function buildEmv(tlv) {
    var body = tlv.filter(function (t) { return t[0] !== '63'; })
      .map(function (t) { return t[0] + ('0' + t[1].length).slice(-2) + t[1]; }).join('') + '6304';
    return body + crc16(body);
  }
  /* returns the parsed fields when `p` is a well-formed EMV payment QR with a correct checksum, else null */
  function validateEmv(p) {
    if (typeof p !== 'string' || p.length < 30 || p.length > 600 || !/^[\x20-\x7e]+$/.test(p) || !/^00020[12]/.test(p)) return null;     // format code 01 (EMVCo) or 02 (Touch 'n Go / Malaysia National QR)
    var tlv = parseTlv(p);
    if (!tlv || tlv[0][0] !== '00') return null;
    var last = tlv[tlv.length - 1];
    if (last[0] !== '63' || last[1].length !== 4 || crc16(p.slice(0, -4)) !== last[1].toUpperCase()) return null;
    var f = {}; tlv.forEach(function (t) { f[t[0]] = t[1]; });
    return { tlv: tlv, merchant: f['59'] || '', city: f['60'] || '', currency: f['53'] || '', hasAmount: !!f['54'] };
  }
  /* same payment details, with a fixed amount (tag 54) and a fresh checksum */
  function withAmount(p, amount) {
    var v = validateEmv(p), a = Number(amount);
    if (!v || v.currency !== '458' || !isFinite(a) || a <= 0 || a > 999999.99) return p;   // 458 = MYR
    var tlv = v.tlv.filter(function (t) { return t[0] !== '54' && t[0] !== '63' && t[0] !== '01'; });
    var out = [], placedA = false;
    tlv.forEach(function (t) {
      if (t[0] === '00') { out.push(t, ['01', '12']); return; }                     // 12 = dynamic QR
      if (!placedA && t[0] > '54') { out.push(['54', a.toFixed(2)]); placedA = true; }
      out.push(t);
    });
    if (!placedA) out.push(['54', a.toFixed(2)]);
    return buildEmv(out);
  }

  /* ───────── styled QR (SVG) ───────── */
  /* the three corner squares are what a scanner locks onto: they stay square, or at most very slightly rounded
     (tested up to 0.3 on three different QR readers; 0.4 already failed one) */
  function eyeRx(style, outer) { return style === 'square' ? 0 : outer ? 0.3 : 0.18; }
  function starPoints(cx, cy, r) {
    var pts = [], k, rad;
    for (k = 0; k < 10; k++) {
      rad = k % 2 ? r * 0.42 : r;
      var ang = -Math.PI / 2 + k * Math.PI / 5;
      pts.push((cx + rad * Math.cos(ang)).toFixed(3) + ',' + (cy + rad * Math.sin(ang)).toFixed(3));
    }
    return pts.join(' ');
  }
  function qrSvg(text, o) {
    o = o || {};
    var lib = window.dgQRLib;
    if (!lib) throw new Error('QR library is not loaded');
    var q = lib.create(text, { errorCorrectionLevel: 'H' }), n = q.modules.size, d = q.modules.data;
    var fg = HEX.test(o.fg || '') ? o.fg : '#1a1214', bg = HEX.test(o.bg || '') ? o.bg : '#ffffff';
    var style = o.dots === 'square' || o.dots === 'dots' ? o.dots : 'rounded';
    var icon = window.dgQRIcons ? window.dgQRIcons.norm(o.icon, 'star') : (o.icon === 'none' ? 'none' : 'star');
    var M = 4, size = n + M * 2;
    var hole = icon !== 'none' ? (Math.round(n * 0.2) | 1) : 0, lo = Math.floor((n - hole) / 2), hi = lo + hole;
    var inEye = function (x, y) { return (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7); };
    var sq = '', other = '', x, y;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) {
      if (!d[y * n + x] || inEye(x, y)) continue;
      if (hole && x >= lo && x < hi && y >= lo && y < hi) continue;
      var X = x + M, Y = y + M;
      if (style === 'square') sq += 'M' + X + ' ' + Y + 'h1.02v1.02h-1.02z';
      else if (style === 'dots') other += '<circle cx="' + (X + 0.5) + '" cy="' + (Y + 0.5) + '" r="0.46"/>';
      else other += '<rect x="' + (X + 0.03) + '" y="' + (Y + 0.03) + '" width="0.94" height="0.94" rx="0.3"/>';
    }
    var eyes = '';
    [[0, 0], [n - 7, 0], [0, n - 7]].forEach(function (p) {
      var ex = p[0] + M, ey = p[1] + M;
      eyes += '<rect x="' + (ex + 0.5) + '" y="' + (ey + 0.5) + '" width="6" height="6" rx="' + eyeRx(style, true) + '" fill="none" stroke="' + fg + '" stroke-width="1"/>'
        + '<rect x="' + (ex + 2) + '" y="' + (ey + 2) + '" width="3" height="3" rx="' + eyeRx(style, false) + '" fill="' + fg + '"/>';
    });
    var mid = size / 2, logo = '';
    if (hole) {
      var half = hole / 2 + 0.2;
      logo = '<rect x="' + (mid - half) + '" y="' + (mid - half) + '" width="' + half * 2 + '" height="' + half * 2 + '" rx="' + (style === 'square' ? 0.6 : 1.6) + '" fill="' + bg + '"/>'
        + (window.dgQRIcons ? window.dgQRIcons.draw(icon, mid, mid, hole * (icon.indexOf('t:') === 0 ? 0.74 : 0.8), fg) : '<polygon points="' + starPoints(mid, mid + hole * 0.03, hole * 0.4) + '" fill="none" stroke="' + fg + '" stroke-width="' + (hole * 0.075).toFixed(2) + '" stroke-linejoin="round"/>');
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="geometricPrecision">'
      + '<rect width="' + size + '" height="' + size + '" rx="1.2" fill="' + bg + '"/>'
      + (sq ? '<path d="' + sq + '" fill="' + fg + '"/>' : '') + (other ? '<g fill="' + fg + '">' + other + '</g>' : '')
      + eyes + logo + '</svg>';
  }
  function svgToCanvas(svg, px) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
      img.onload = function () {
        var c = document.createElement('canvas'); c.width = c.height = px;
        c.getContext('2d').drawImage(img, 0, 0, px, px);
        URL.revokeObjectURL(url); resolve(c);
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not draw the QR')); };
      img.src = url;
    });
  }
  function canvasToBlob(c) { return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('png')); }, 'image/png'); }); }

  /* ───────── reading a QR from a picture ───────── */
  var jsqrP = null;
  function getJsQR() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (!jsqrP) jsqrP = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = JSQR_URL; s.async = true;
      s.onload = function () { window.jsQR ? res(window.jsQR) : rej(new Error('QR reader failed to load')); };
      s.onerror = function () { jsqrP = null; rej(new Error('Could not load the QR reader. Check your connection.')); };
      document.head.appendChild(s);
    });
    return jsqrP;
  }
  async function decodeCanvas(c) {
    var native = false;
    if ('BarcodeDetector' in window) {
      try {
        var r = await new window.BarcodeDetector({ formats: ['qr_code'] }).detect(c);
        native = true;
        if (r && r[0] && r[0].rawValue) return r[0].rawValue;
      } catch (e) { /* fall through to jsQR */ }
    }
    var jsQR;
    try { jsQR = await getJsQR(); }
    catch (e) { if (native) return null; throw e; }      // the phone's own reader already looked: "no QR found" is the honest answer
    var id = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    var res = jsQR(id.data, id.width, id.height, { inversionAttempts: 'attemptBoth' });
    return res ? res.data : null;
  }
  async function decodeFile(file) {
    var url = URL.createObjectURL(file);
    try {
      var img = await new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(new Error('That file is not a readable picture.')); }; i.src = url; });
      var sizes = [1400, 900, 2000, 600];
      for (var k = 0; k < sizes.length; k++) {
        var s = Math.min(1, sizes[k] / Math.max(img.width, img.height));
        if (k > 0 && s === 1 && sizes[k] > sizes[0]) continue;
        var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.width * s)); c.height = Math.max(1, Math.round(img.height * s));
        var cx = c.getContext('2d', { willReadFrequently: true }); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.drawImage(img, 0, 0, c.width, c.height);
        var txt = await decodeCanvas(c);
        if (txt) return txt;
      }
      return null;
    } finally { URL.revokeObjectURL(url); }
  }
  /* draw the styled QR and read it back, to prove a phone camera will accept it */
  async function scanTest(payload, cfg, accent) {
    var col = effective(cfg, accent);
    var c = await svgToCanvas(qrSvg(payload, { fg: col.fg, bg: col.bg, dots: cfg.dots, icon: cfg.icon }), 720);
    var got = await decodeCanvas(c);
    return got === payload;
  }

  /* ───────── text ───────── */
  var TXT = {
    en: {
      title: 'Pay with QR', scan: 'Scan with your banking or e-wallet app', amount: 'Amount', total: 'Total',
      check: 'Before you confirm, check the amount and that the name shown in your app is {seller}.',
      save: 'Save QR', saved: 'QR saved', done: 'I’ve paid · send proof on WhatsApp', other: 'Pay another way · chat with the seller',
      note: 'Your money goes straight to the seller. They confirm your payment by hand before sending your order.',
      ref: 'Order ref', free: 'After scanning, enter {total} in your app.', close: 'Close',
      hi: 'Hi {seller}! I’ve paid by QR:', buy: 'Hi {seller}! I’d like to buy:', paidVia: 'Paid via DuitNow QR. I’ll send the screenshot here.', from: 'From your M-ID card'
    },
    ms: {
      title: 'Bayar dengan QR', scan: 'Imbas dengan aplikasi bank atau e-dompet anda', amount: 'Jumlah', total: 'Jumlah',
      check: 'Sebelum mengesahkan, semak jumlah dan pastikan nama dalam aplikasi anda ialah {seller}.',
      save: 'Simpan QR', saved: 'QR disimpan', done: 'Sudah bayar · hantar bukti di WhatsApp', other: 'Bayar cara lain · sembang dengan penjual',
      note: 'Wang anda terus ke penjual. Penjual akan semak pembayaran sebelum menghantar pesanan.',
      ref: 'Rujukan', free: 'Selepas mengimbas, masukkan {total} dalam aplikasi anda.', close: 'Tutup',
      hi: 'Hai {seller}! Saya sudah bayar melalui QR:', buy: 'Hai {seller}! Saya ingin membeli:', paidVia: 'Dibayar melalui DuitNow QR. Saya hantar tangkapan skrin di sini.', from: 'Dari kad M-ID anda'
    }
  };
  function tr(lang) { var d = TXT[lang] || TXT.en; return function (k, v) { var s = d[k] || TXT.en[k] || k; if (v) for (var n in v) s = s.split('{' + n + '}').join(v[n]); return s; }; }

  /* ───────── buyer checkout sheet ───────── */
  var sheet = null, lastFocus = null, closeTimer = 0;
  var CLOSE_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function ensureSheet() {
    if (sheet) return sheet;
    var back = el('div', 'mpay-back'); back.hidden = true;
    var box = el('div', 'mpay-sheet'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.tabIndex = -1;
    var x = el('button', 'mpay-x'); x.type = 'button'; x.innerHTML = CLOSE_ICON;       // pinned to the sheet, outside the scrolling part
    var scroll = el('div', 'mpay-scroll');
    var eyebrow = el('p', 'mpay-eyebrow'), title = el('h3', 'mpay-title'), amount = el('p', 'mpay-amount');
    var qr = el('div', 'mpay-qr'), scan = el('p', 'mpay-scan'), check = el('p', 'mpay-check'), free = el('p', 'mpay-free');
    var acts = el('div', 'mpay-acts'), save = el('button', 'mpay-btn mpay-ghost'); save.type = 'button';
    var done = el('button', 'mpay-btn mpay-main'); done.type = 'button';
    var other = el('button', 'mpay-link'); other.type = 'button';
    var note = el('p', 'mpay-note'), ref = el('p', 'mpay-ref');
    acts.appendChild(done); acts.appendChild(save);
    [eyebrow, title, amount, qr, scan, free, check, acts, other, note, ref].forEach(function (n) { scroll.appendChild(n); });
    box.appendChild(scroll); box.appendChild(x); back.appendChild(box); document.body.appendChild(back);
    back.addEventListener('click', function (e) { if (e.target === back) close(); });
    x.addEventListener('click', close);
    document.addEventListener('keydown', function (e) { if (!back.hidden && e.key === 'Escape') close(); });
    sheet = { back: back, box: box, scroll: scroll, x: x, eyebrow: eyebrow, title: title, amount: amount, qr: qr, scan: scan, free: free, check: check, save: save, done: done, other: other, note: note, ref: ref };
    return sheet;
  }
  /* slide down, then hide (instead of vanishing) */
  function close() {
    if (!sheet || sheet.back.hidden || !sheet.back.classList.contains('in')) return;
    var s = sheet;
    s.back.classList.remove('in');
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      s.back.hidden = true; document.documentElement.classList.remove('mpay-lock');
      if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    }, reduced() ? 0 : 380);
  }
  function waLink(base, text) {
    try {
      var u = new URL(base); if (u.protocol !== 'https:') return '';
      u.searchParams.delete('text');
      return u.origin + u.pathname + (u.search ? u.search + '&' : '?') + 'text=' + encodeURIComponent(text) + u.hash;
    } catch (e) { return ''; }
  }
  function newRef() {
    var A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', out = '', i, b = new Uint8Array(6);
    (window.crypto || window.msCrypto).getRandomValues(b);
    for (i = 0; i < 6; i++) out += A[b[i] % A.length];
    return out;
  }
  /* o: { seller, item, qty, total, totalText, cur, cfg:{qr,fg,bg,dots,icon}, wa, shopUrl, lang, accent, onOpenOther } */
  function open(o) {
    var t = tr(o.lang), cfg = o.cfg || {}, v = validateEmv(cfg.qr);
    var qty = Math.max(1, parseInt(o.qty, 10) || 1), total = Number(o.total) || 0;
    var plain = function (withProof) {
      var u = waLink(o.wa, t('hi', { seller: o.seller }) + '\n' + o.item + (qty > 1 ? ' x' + qty : '') + '\n' + t('total') + ': ' + o.totalText
        + (withProof ? '\n' + t('ref') + ': ' + ref + '\n' + t('paidVia') : '') + '\n' + t('from') + ': ' + o.shopUrl);
      if (u) window.open(u, '_blank', 'noopener');
    };
    var ref = 'MQ-' + newRef();
    if (!v || !window.dgQRLib) {   // bad or missing QR: fall back to the plain WhatsApp order
      var u0 = waLink(o.wa, t('buy', { seller: o.seller }) + '\n' + o.item + (qty > 1 ? ' x' + qty : '') + '\n' + t('total') + ': ' + o.totalText + '\n' + t('from') + ': ' + o.shopUrl);
      if (u0) window.open(u0, '_blank', 'noopener');
      return false;
    }
    // The seller's QR is shown exactly as their bank/wallet made it. Only if they switch on "fill in the amount" do we rewrite it with the total
    // (some apps reject that), otherwise the buyer types the total shown on the sheet.
    var fixed = cfg.amount === true && v.currency === '458' && total > 0 && (o.cur || 'MYR') === 'MYR';
    var payload = fixed ? withAmount(cfg.qr, total) : cfg.qr;
    var col = effective(cfg, o.accent), svg = qrSvg(payload, { fg: col.fg, bg: col.bg, dots: cfg.dots, icon: cfg.icon });
    var s = ensureSheet();
    lastFocus = document.activeElement;
    s.box.setAttribute('aria-label', t('title'));
    s.eyebrow.textContent = t('title');
    s.title.textContent = o.item + (qty > 1 ? ' × ' + qty : '');
    s.amount.textContent = o.totalText;
    s.qr.innerHTML = svg;
    s.scan.textContent = t('scan');
    s.free.textContent = fixed ? '' : t('free', { total: o.totalText }); s.free.hidden = fixed;
    s.check.textContent = t('check', { seller: v.merchant || o.seller });     // the name the buyer's bank app will show
    s.save.textContent = t('save'); s.done.textContent = t('done'); s.other.textContent = t('other');
    s.note.textContent = t('note'); s.ref.textContent = t('ref') + ': ' + ref; s.x.setAttribute('aria-label', t('close'));
    s.done.onclick = function () { plain(true); };
    s.other.onclick = function () { plain(false); };
    s.save.onclick = async function () {
      try {
        var blob = await canvasToBlob(await svgToCanvas(svg, 900)), name = 'pay-' + ref + '.png';
        var file = new File([blob], name, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; }
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        s.save.textContent = t('saved');
      } catch (e) { /* user cancelled the share sheet */ }
    };
    clearTimeout(closeTimer);
    s.scroll.scrollTop = 0;
    s.back.hidden = false; document.documentElement.classList.add('mpay-lock');
    void s.box.offsetHeight;                                                       // commit the off-screen start position first
    requestAnimationFrame(function () { requestAnimationFrame(function () { s.back.classList.add('in'); try { s.box.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }); });
    return true;
  }

  /* ───────── Studio editor widget ───────── */
  var EDITOR_HTML =
    '<div class="mpay-ed">'
    + '<p class="mpay-ed-h">Pay by QR</p>'
    + '<label class="toggle"><input type="checkbox" name="payEnabled"><span></span> Let buyers pay with my own bank QR</label>'
    + '<div class="mpay-ed-body" hidden>'
    + '<div class="field"><label>My QR <small>a screenshot of the DuitNow QR from your banking app</small></label>'
    + '<div class="mpay-ed-row"><label class="btn btn-sm"><i class="fa-solid fa-qrcode"></i> Upload my QR<input type="file" accept="image/*" hidden data-mp-file></label>'
    + '<span class="mpay-ed-status" data-mp-status role="status" aria-live="polite"></span></div>'
    + '<details class="mpay-ed-paste"><summary>Could not read it? Paste the QR text instead</summary>'
    + '<textarea rows="3" data-mp-text spellcheck="false" placeholder="00020101…"></textarea><button type="button" class="btn btn-sm" data-mp-use>Use this text</button></details></div>'
    + '<input type="hidden" name="payQr"><input type="hidden" name="payFg"><input type="hidden" name="payBg"><input type="hidden" name="payDots"><input type="hidden" name="payIcon">'
    + '<div class="mpay-ed-prev"><div class="mpay-ed-qr" data-mp-prev></div><div class="mpay-ed-ctl">'
    + '<div class="two"><div class="field"><label>Dots</label><input type="color" data-mp-fg></div><div class="field"><label>Background</label><input type="color" data-mp-bg></div></div>'
    + '<div class="two"><div class="field"><label>Style</label><select data-mp-dots><option value="rounded">Rounded</option><option value="square">Square</option><option value="dots">Round dots</option></select></div>'
    + '<div class="field"><label>Centre symbol</label><select data-mp-icon>' + (window.dgQRIcons ? window.dgQRIcons.options(0, true) : '<option value="star">Hollow star</option><option value="none">None</option>') + '</select><input type="text" data-mp-char maxlength="4" placeholder="Type or paste: 👟" hidden style="margin-top:6px" aria-label="Custom symbol"></div></div>'
    + '<div class="mpay-ed-row"><button type="button" class="btn btn-sm" data-mp-auto><i class="fa-solid fa-wand-magic-sparkles"></i> Match my theme</button>'
    + '<button type="button" class="btn btn-sm" data-mp-plain><i class="fa-solid fa-qrcode"></i> Plain (best compatibility)</button>'
    + '<button type="button" class="btn btn-sm" data-mp-test><i class="fa-solid fa-camera"></i> Test scan</button></div>'
    + '<p class="mpay-ed-contrast" data-mp-contrast role="status"></p><p class="mpay-ed-test" data-mp-testres role="status"></p>'
    + '</div></div>'
    + '<label class="toggle"><input type="checkbox" name="payAmount" data-mp-amt><span></span> Fill in the amount automatically (experimental)</label>'
    + '<p class="hint">Off is safest: buyers scan your QR exactly as your bank or wallet made it, then type the total shown. On: the QR carries the total, but some wallets and banks reject that. Test with your own apps first.</p>'
    + '<p class="hint">Money goes straight to your account. The site never holds it and cannot see it, so check every payment in your banking app before you send the order. You cannot test with the same wallet or bank account that owns this QR, because that app refuses to pay itself. Scan it with a friend’s phone or a different account. Colours follow your card theme unless you change them; dark dots on a light background scan best.</p>'
    + '</div></div>';

  function mountEditor(root) {
    if (!root || root.__mp) return; root.__mp = 1;
    var S = {
      on: root.getAttribute('data-enabled') === '1', qr: root.getAttribute('data-qr') || '',
      fg: root.getAttribute('data-fg') || '', bg: root.getAttribute('data-bg') || '',
      dots: root.getAttribute('data-dots') || 'rounded', icon: root.getAttribute('data-icon') || 'star', amt: root.getAttribute('data-amount') === '1'
    };
    if (!validateEmv(S.qr)) S.qr = '';
    root.innerHTML = EDITOR_HTML;
    var $ = function (s) { return root.querySelector(s); };
    var chk = $('[name=payEnabled]'), body = $('.mpay-ed-body'), file = $('[data-mp-file]'), status = $('[data-mp-status]'),
      prev = $('[data-mp-prev]'), cFg = $('[data-mp-fg]'), cBg = $('[data-mp-bg]'), selD = $('[data-mp-dots]'), selI = $('[data-mp-icon]'), charI = $('[data-mp-char]'),
      amt = $('[data-mp-amt]'), contrast = $('[data-mp-contrast]'), testRes = $('[data-mp-testres]'), hid = {
        qr: $('[name=payQr]'), fg: $('[name=payFg]'), bg: $('[name=payBg]'), dots: $('[name=payDots]'), icon: $('[name=payIcon]')
      };
    var accent = function () {
      var f = root.closest('form'), c = f && f.elements.namedItem('customColors'), a = f && f.elements.namedItem('accent');
      return (c && c.checked && a && parseColor(a.value)) || pageAccent();
    };
    function note(msg, kind) { status.textContent = msg || ''; status.className = 'mpay-ed-status' + (kind ? ' ' + kind : ''); }
    function paint(fire) {
      var col = effective(S, accent());
      hid.qr.value = S.qr; hid.fg.value = S.fg; hid.bg.value = S.bg; hid.dots.value = S.dots; hid.icon.value = S.icon;
      chk.checked = S.on; amt.checked = S.amt; body.hidden = !S.on; selD.value = S.dots; var cu = S.icon.indexOf('t:') === 0; selI.value = cu ? 'custom' : S.icon; charI.hidden = !cu; if (cu && document.activeElement !== charI) charI.value = S.icon.slice(2); cFg.value = col.fg; cBg.value = col.bg;
      testRes.textContent = ''; testRes.className = 'mpay-ed-test';
      if (S.qr && window.dgQRLib) {
        try { prev.innerHTML = qrSvg(S.qr, { fg: col.fg, bg: col.bg, dots: S.dots, icon: S.icon }); } catch (e) { prev.textContent = 'Preview unavailable'; }
        var st = contrastState(col.fg, col.bg);
        contrast.className = 'mpay-ed-contrast ' + st;
        contrast.textContent = st === 'ok' ? 'Good contrast.' : st === 'low' ? 'Low contrast. Tap Test scan to be sure it still works.'
          : st === 'bad' ? 'Too little contrast. Banking apps may not scan this.' : 'Dots are lighter than the background. Many banking apps cannot scan that.';
      } else { prev.textContent = 'Upload your QR to see it here.'; contrast.textContent = ''; contrast.className = 'mpay-ed-contrast'; }
      if (fire) hid.qr.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function accept(text) {
      var v = validateEmv(String(text || '').trim());
      if (!v) { note('That is not a bank payment QR. Upload the DuitNow QR from your banking app.', 'bad'); return false; }
      S.qr = String(text).trim();
      note('Read OK' + (v.merchant ? ': ' + v.merchant + (v.city ? ', ' + v.city : '') : '') + (v.hasAmount ? '. This QR has a fixed amount, which buyers will not need. Use your open QR if you have one.' : '.'), v.hasAmount ? 'warn' : 'good');
      return true;
    }
    chk.addEventListener('change', function () { S.on = chk.checked; paint(true); });
    amt.addEventListener('change', function () { S.amt = amt.checked; });
    file.addEventListener('change', async function () {
      var f = file.files && file.files[0]; file.value = ''; if (!f) return;
      note('Reading…');
      try {
        var txt = await decodeFile(f);
        if (!txt) { note('Could not find a QR in that picture. Try a clearer screenshot, or paste the text.', 'bad'); return; }
        if (accept(txt)) { S.on = true; paint(true); }
      } catch (e) { note(e.message || 'Could not read that picture.', 'bad'); }
    });
    $('[data-mp-use]').addEventListener('click', function () { if (accept($('[data-mp-text]').value)) { S.on = true; paint(true); } });
    cFg.addEventListener('input', function () { S.fg = cFg.value; paint(true); });
    cBg.addEventListener('input', function () { S.bg = cBg.value; paint(true); });
    selD.addEventListener('change', function () { S.dots = selD.value; paint(true); });
    selI.addEventListener('change', function () { if (selI.value === 'custom') { S.icon = 't:' + (Array.from(charI.value.trim()).slice(0, 2).join('') || '👟'); charI.hidden = false; charI.value = S.icon.slice(2); } else S.icon = selI.value; paint(true); });
    charI.addEventListener('input', function () { var v = Array.from(charI.value.trim()).slice(0, 2).join(''); S.icon = v ? 't:' + v : 'star'; paint(true); });
    $('[data-mp-auto]').addEventListener('click', function () { S.fg = ''; S.bg = ''; paint(true); });
    $('[data-mp-plain]').addEventListener('click', function () { S.fg = '#000000'; S.bg = '#ffffff'; S.dots = 'square'; S.icon = 'none'; paint(true); });
    $('[data-mp-test]').addEventListener('click', async function () {
      if (!S.qr) { testRes.textContent = 'Upload your QR first.'; testRes.className = 'mpay-ed-test bad'; return; }
      testRes.textContent = 'Testing…'; testRes.className = 'mpay-ed-test';
      try {
        var ok = await scanTest(S.qr, S, accent());
        testRes.textContent = ok ? 'Scan test passed. Still, try it once with your own banking app before you go live.' : 'The styled QR did not scan. Raise the contrast, pick Square, or remove the centre icon.';
        testRes.className = 'mpay-ed-test ' + (ok ? 'good' : 'bad');
      } catch (e) { testRes.textContent = e.message || 'Could not run the test.'; testRes.className = 'mpay-ed-test bad'; }
    });
    paint(false);
  }
  function scanForEditors() {
    var n = document.querySelectorAll('[data-pay-editor]'), i;
    for (i = 0; i < n.length; i++) mountEditor(n[i]);
  }

  /* ───────── wiring ───────── */
  function onBuyClick(e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-pay]') : null;
    if (!a) return;
    var d; try { d = JSON.parse(a.getAttribute('data-pay')); } catch (err) { return; }
    if (!d || !d.qr || !validateEmv(d.qr)) return;      // anything odd: let the normal WhatsApp link work
    e.preventDefault(); e.stopPropagation();
    open({
      seller: d.seller, item: d.item, qty: 1, total: d.price, totalText: d.text, cur: d.cur, wa: d.wa,
      shopUrl: location.origin + '/' + d.slug, lang: document.documentElement.lang === 'ms' ? 'ms' : 'en', accent: pageAccent(),
      cfg: { qr: d.qr, fg: d.fg, bg: d.bg, dots: d.dots, icon: d.icon, amount: d.amount === true }
    });
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', onBuyClick, true);
    var go = function () {
      scanForEditors();
      if (window.MutationObserver) new MutationObserver(function () { scanForEditors(); }).observe(document.body, { childList: true, subtree: true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
  }

  var api = {
    open: open, close: close, mountEditor: mountEditor, scanTest: scanTest, decodeFile: decodeFile,
    validate: validateEmv, withAmount: withAmount, qrSvg: qrSvg, autoColors: autoColors, effective: effective, contrastState: contrastState, crc16: crc16
  };
  window.MaplePay = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
