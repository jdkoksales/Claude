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


  /* ---------- opbrengstcalculator ---------- */
  var nl = function (n, dec) {
    return n.toLocaleString('nl-NL', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  };

  function initCalc(root) {
    if (root.dataset.tk3Bound) return;
    root.dataset.tk3Bound = '1';

    var rates = {
      google: parseFloat(root.dataset.google) || 0.02,
      instagram: parseFloat(root.dataset.instagram) || 0.03,
      facebook: parseFloat(root.dataset.facebook) || 0.015
    };
    var share = parseFloat(root.dataset.share) || 0.8;

    var slider = root.querySelector('[data-slider]');
    var visEl = root.querySelector('[data-visitors]');
    var out = root.querySelector('[data-out]');
    var labelEl = root.querySelector('[data-outlabel]');
    var valEl = root.querySelector('[data-value]');
    var weekEl = root.querySelector('[data-week]');
    var dayEl = root.querySelector('[data-day]');
    var picks = root.querySelectorAll('.pick');

    var kind = 'google';
    var shown = 0;   // getal dat nu op het scherm staat
    var raf = null;

    function target() {
      var visitors = parseInt(slider.value, 10);
      return Math.round(visitors * share * rates[kind]);
    }

    // teller loopt naar het nieuwe getal toe in plaats van te springen
    function animateTo(goal) {
      if (raf) cancelAnimationFrame(raf);
      var from = shown;
      var start = performance.now();
      var dur = Math.min(650, 180 + Math.abs(goal - from) * 1.6);
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduce || dur < 1) { shown = goal; paint(goal); return; }
      (function tick(now) {
        var t = Math.min(1, (now - start) / dur);
        var e = 1 - Math.pow(1 - t, 3);              // ease-out
        shown = Math.round(from + (goal - from) * e);
        paint(shown);
        if (t < 1) raf = requestAnimationFrame(tick); else shown = goal;
      })(start);
    }

    function paint(n) {
      valEl.textContent = '+' + nl(n);
      weekEl.textContent = '≈ ' + nl(Math.round(n / 4.33));
      dayEl.textContent = '≈ ' + nl(n / 30.4, 1);
    }

    function update(animate) {
      visEl.textContent = nl(parseInt(slider.value, 10));
      var goal = target();
      if (animate === false) { shown = goal; paint(goal); } else animateTo(goal);
    }

    picks.forEach(function (b) {
      b.addEventListener('click', function () {
        kind = b.getAttribute('data-kind');
        picks.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
        var accent = b.getAttribute('data-accent');
        root.style.setProperty('--accent', accent);
        root.style.setProperty('--tint', hexA(accent, 0.09));
        labelEl.textContent = b.getAttribute('data-label');
        update();
      });
    });

    slider.addEventListener('input', function () { update(); });
    update(false);
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    var n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

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
    document.querySelectorAll('[data-tk3-calc]').forEach(initCalc);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Het uitklapmenu sluit vanzelf als je ernaast tikt of op Escape drukt.
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.mobmenu[open]').forEach(function (det) {
      if (!det.contains(e.target)) det.open = false;
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('details.mobmenu[open]').forEach(function (det) {
      det.open = false;
    });
  });

  // themabewerker: opnieuw binden na het herladen van een sectie
  document.addEventListener('shopify:section:load', init);
})();
