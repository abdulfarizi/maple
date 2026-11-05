/* M-ID · Studio enhancer: adds the mobile Edit/Preview switch and a few conveniences to the editor once it renders.
 * It only touches the DOM the Studio already produced; the form logic itself is unchanged. */
(function () {
  'use strict';
  var TAB_KEY = 'dig:studio-tab';
  function enhance(st) {
    if (st.__enh) return; st.__enh = true;
    var grid = st.querySelector('.studio-grid'), form = st.querySelector('#editor');
    if (!grid || !form) return;
    st.classList.add('studio-enter');
    // Edit | Preview switch (shown on phones only)
    var sw = document.createElement('div'); sw.className = 'st-switch'; sw.setAttribute('role', 'tablist');
    sw.innerHTML = '<button type="button" role="tab" data-v="edit" class="on"><i class="fa-solid fa-pen"></i> Edit</button><button type="button" role="tab" data-v="preview"><i class="fa-solid fa-mobile-screen"></i> Preview</button>';
    grid.parentNode.insertBefore(sw, grid);
    sw.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      st.dataset.view = b.dataset.v;
      sw.querySelectorAll('button').forEach(function (x) { var on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', String(on)); });
      var sc = st.closest('.pg-layer, .pg'); if (sc) sc.scrollTo({ top: 0 });
    });
    // remember the last tab you were on
    form.addEventListener('click', function (e) { var t = e.target.closest('.tab'); if (t) try { sessionStorage.setItem(TAB_KEY, t.dataset.tab); } catch (x) {} });
    try { var last = sessionStorage.getItem(TAB_KEY), tb = last && form.querySelector('.tab[data-tab="' + last + '"]'); if (tb && !tb.classList.contains('active')) tb.click(); } catch (x) {}
    // Ctrl/Cmd+S publishes
    st.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); var b = form.querySelector('#save-btn'); if (b && !b.disabled) form.requestSubmit ? form.requestSubmit() : b.click(); }
    });
  }
  function scan(root) { var s = (root.querySelector ? root.querySelector('.studio') : null); if (s) enhance(s); }
  new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) for (var j = 0; j < list[i].addedNodes.length; j++) { var n = list[i].addedNodes[j]; if (n.nodeType === 1) { if (n.classList && n.classList.contains('studio')) enhance(n); else scan(n); } }
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
