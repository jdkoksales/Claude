/* tk3 — rails, pager en segmented controls. Alles binnen .tk3 gescoped. */
(function () {
  function step(el) {
    var first = el.firstElementChild;
    return (first ? first.offsetWidth : 0) + 20;
  }

  window.tk3PageRail = function (id, dir) {
    var el = document.getElementById(id);
    if (el) el.scrollBy({ left: dir * step(el), behavior: 'smooth' });
  };

  window.tk3ScrollRail = function (id, dir) {
    var el = document.getElementById(id);
    if (el) el.scrollBy({ left: dir * step(el) * 2, behavior: 'smooth' });
  };

  function syncCount(el) {
    var lbl = document.getElementById(el.id + '-count');
    if (!lbl) return;
    var total = el.children.length;
    var i = Math.min(total, Math.round(el.scrollLeft / step(el)) + 1);
    lbl.textContent = i + '/' + total;
  }

  function init() {
    document.querySelectorAll('.tk3 [data-tk3-count]').forEach(function (el) {
      syncCount(el);
      el.addEventListener('scroll', function () { syncCount(el); }, { passive: true });
    });

    document.querySelectorAll('.tk3 .seg').forEach(function (seg) {
      if (seg.dataset.tk3Bound) return;
      seg.dataset.tk3Bound = '1';
      seg.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        seg.querySelectorAll('button').forEach(function (x) {
          x.setAttribute('aria-selected', 'false');
        });
        b.setAttribute('aria-selected', 'true');
        // branchetabs: wissel de bijbehorende quote
        var target = b.getAttribute('data-tk3-pane');
        if (!target) return;
        var wrap = seg.closest('[data-tk3-panes]');
        if (!wrap) return;
        wrap.querySelectorAll('[data-tk3-pane-id]').forEach(function (p) {
          p.hidden = p.getAttribute('data-tk3-pane-id') !== target;
        });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // themabewerker: opnieuw binden na het herladen van een sectie
  document.addEventListener('shopify:section:load', init);
})();
