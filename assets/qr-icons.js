/* M-ID · QR centre symbols shared by the card QR and the Pay QR. */
(function () {
  'use strict';
  var EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  var LEAF = 'M50 2L57 18L64 13L62 34L80 24L76 40L96 36L84 54L90 60L62 70L64 78L53 76L53 98L47 98L47 76L36 78L38 70L10 60L16 54L4 36L24 40L20 24L38 34L36 13L43 18Z';
  function star() { var p = [], k, r; for (k = 0; k < 10; k++) { r = k % 2 ? 4.4 : 10.5; var a = -Math.PI / 2 + k * Math.PI / 5; p.push((12 + r * Math.cos(a)).toFixed(2) + ',' + (12.6 + r * Math.sin(a)).toFixed(2)); } return '<polygon points="' + p.join(' ') + '"/>'; }
  function petals() { var s = '<circle cx="12" cy="12" r="2.2"/>', i; for (i = 0; i < 5; i++) s += '<ellipse cx="12" cy="6" rx="2.3" ry="3.3" transform="rotate(' + i * 72 + ' 12 12)"/>'; return s; }
  var ICONS = {
    leaf:    { l: 'Maple leaf', vb: 100, fill: 1, s: '<path d="' + LEAF + '"/>' },
    star:    { l: 'Hollow star', s: star() },
    heart:   { l: 'Heart', s: '<path d="M12 20.5s-8-4.9-9.6-10C1.3 7 3.6 4 6.8 4c2 0 3.6 1.1 5.2 3.1C13.6 5.1 15.2 4 17.2 4c3.2 0 5.5 3 4.4 6.5-1.6 5.1-9.6 10-9.6 10z"/>' },
    sneaker: { l: 'Shoe (sneaker)', s: '<path d="M2.5 16.5V9.2c0-.9.9-1.4 1.7-1L8 10l2.7-3.2 2.1 2.4 4.7 1.5c2.6.8 4.2 2.2 4.2 4.3v2.5z"/><path d="M2.5 19h19"/><path d="M10.4 9.4l1.7 1.7M12.6 11.2l1.5 1.4"/>' },
    boot:    { l: 'Shoe (boot)', s: '<path d="M7 3h7v8l5.2 2.3c1.2.5 1.8 1.4 1.8 2.7V19H5.5V3z"/><path d="M5.5 16.5H21"/>' },
    heel:    { l: 'Shoe (heel)', s: '<path d="M3.5 6.5c.2 5 2.3 7.6 6.3 8.6l5 1.2c2.3.6 4 1.6 4.7 3.2h-3.2V18.5l-1.6-.4-.6 2.9H3.5z"/>' },
    bag:     { l: 'Shopping bag', s: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>' },
    cart:    { l: 'Cart', s: '<path d="M3 4h2.4l2.3 10.5h9.9l2-7.5H6.4"/><circle cx="9.5" cy="19" r="1"/><circle cx="17" cy="19" r="1"/>' },
    shirt:   { l: 'T-shirt', s: '<path d="M8.5 3.5L3 6l2 4.2 2.2-1V20.5h9.6V9.2l2.2 1L21 6l-5.5-2.5c-.5 1.4-1.9 2.3-3.5 2.3s-3-.9-3.5-2.3z"/>' },
    bolt:    { l: 'Lightning', s: '<path d="M13.5 2.5L5 13.5h6l-1 8 8.5-11h-6z"/>' },
    crown:   { l: 'Crown', s: '<path d="M3.5 17.5L2.5 8l5.2 4.2L12 5l4.3 7.2L21.5 8l-1 9.5z"/><path d="M4 20.5h16"/>' },
    paw:     { l: 'Paw', s: '<circle cx="6.5" cy="10" r="1.8"/><circle cx="10" cy="6.3" r="1.8"/><circle cx="14" cy="6.3" r="1.8"/><circle cx="17.5" cy="10" r="1.8"/><path d="M12 12.5c-3 0-5.5 2.4-5.5 4.6 0 1.7 1.6 2.4 3 2.4 1 0 1.6-.4 2.5-.4s1.5.4 2.5.4c1.4 0 3-.7 3-2.4 0-2.2-2.5-4.6-5.5-4.6z"/>' },
    flower:  { l: 'Flower', s: petals() },
    coin:    { l: 'Coin', s: '<circle cx="12" cy="12" r="8.7"/><path d="M12 6.8v10.4M9.3 9.6c0-1 1.2-1.7 2.7-1.7s2.7.7 2.7 1.7-1.2 1.5-2.7 1.8-2.7.9-2.7 1.9 1.2 1.7 2.7 1.7 2.7-.7 2.7-1.7"/>' }
  };
  var ORDER = ['star', 'heart', 'sneaker', 'boot', 'heel', 'bag', 'cart', 'shirt', 'bolt', 'crown', 'paw', 'flower', 'coin', 'leaf'];
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* → 'none' | preset key | 't:<1-2 chars>' ; anything else becomes the fallback */
  function norm(v, fb) {
    v = String(v == null ? '' : v);
    if (v === 'none' || ICONS[v]) return v;
    if (v.indexOf('t:') === 0) { var t = Array.from(v.slice(2).replace(/[<>&"'\\]/g, '')).slice(0, 2).join(''); if (t) return 't:' + t; }
    return fb;
  }
  /* SVG markup of a symbol centred on (cx,cy), fitting a size×size square, drawn in `color` */
  function draw(icon, cx, cy, size, color) {
    if (icon === 'none') return '';
    if (icon.indexOf('t:') === 0) return '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" font-size="' + (size * 0.92).toFixed(3) + '" font-family=\'' + EMOJI + '\' fill="' + color + '">' + esc(icon.slice(2)) + '</text>';
    var d = ICONS[icon]; if (!d) return '';
    var vb = d.vb || 24, sc = size / vb, tr = 'translate(' + (cx - size / 2).toFixed(3) + ' ' + (cy - size / 2).toFixed(3) + ') scale(' + sc.toFixed(5) + ')';
    return d.fill ? '<g transform="' + tr + '" fill="' + color + '">' + d.s + '</g>'
      : '<g transform="' + tr + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + d.s + '</g>';
  }
  function options(selected, withLeaf) {
    var h = '<option value="none">None</option>';
    ORDER.forEach(function (k) { if (k === 'leaf' && !withLeaf) return; h += '<option value="' + k + '">' + ICONS[k].l + '</option>'; });
    return h + '<option value="custom">Custom emoji or letter…</option>';
  }
  window.dgQRIcons = { norm: norm, draw: draw, options: options, ORDER: ORDER };
})();
