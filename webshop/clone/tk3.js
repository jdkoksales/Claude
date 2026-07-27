/* tk3 — rails, pager, segmented controls en de wisselende hero. */
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

  /* Achtergrondverloop per uitvoering — de sectie kleurt mee met het bordje. */
  var GRAD = {
    'google-wit': 'linear-gradient(112deg,#fbfbfc 0%,#fcf6f8 48%,#fbecf0 100%)',
    'google-zwart': 'linear-gradient(112deg,#fcfcfd 0%,#f4f6f9 48%,#e7ecf2 100%)',
    instagram: 'linear-gradient(112deg,#fdfbfe 0%,#fdf1f7 46%,#fbe2ef 100%)',
    facebook: 'linear-gradient(112deg,#fbfcfe 0%,#f1f5fd 46%,#e5edfc 100%)',
    sticker: 'linear-gradient(112deg,#fdfdfc 0%,#f9f7f2 46%,#f2eee4 100%)'
  };

  function initHero(hero) {
    if (hero.dataset.tk3Bound) return;
    hero.dataset.tk3Bound = '1';

    var buy = hero.querySelector('[data-tk3-buy]');
    var plat = 'google';

    function apply() {
      var key = plat === 'google' ? 'google-wit' : plat;
      var found = false;
      hero.querySelectorAll('[data-shot]').forEach(function (img) {
        var on = img.getAttribute('data-shot') === key;
        img.classList.toggle('on', on);
        if (on) found = true;
      });
      if (!found) {
        // geen beeld voor deze combinatie: val terug op het eerste
        var first = hero.querySelector('[data-shot]');
        if (first) first.classList.add('on');
      }
      hero.style.background = GRAD[key] || GRAD['google-wit'];
      var btn = hero.querySelector('[data-plat="' + plat + '"]');
      if (buy && btn && btn.getAttribute('data-url')) buy.href = btn.getAttribute('data-url');
    }

    hero.querySelectorAll('[data-plat]').forEach(function (b) {
      b.addEventListener('click', function () { plat = b.getAttribute('data-plat'); apply(); });
    });
    apply();
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

    document.querySelectorAll('[data-tk3-hero]').forEach(initHero);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // themabewerker: opnieuw binden na het herladen van een sectie
  document.addEventListener('shopify:section:load', init);
})();
