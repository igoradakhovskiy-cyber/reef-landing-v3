/* The Reef · v3 · одно появление на странице (правило Hallmark).
   Заголовки разделов открываются по строкам из-под маски; остальное просто на месте.
   Первый экран оживает сам, через CSS (keyframes settle). Без скрипта и при reduced motion всё видно сразу. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  /* слово = .w (окно) > .wi (текст); --l = номер строки */
  function split(el) {
    var tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    while (tw.nextNode()) nodes.push(tw.currentNode);
    nodes.forEach(function (tn) {
      if (!/\S/.test(tn.nodeValue)) return;
      var frag = document.createDocumentFragment();
      tn.nodeValue.split(/(\s+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
        var w = document.createElement('span'); w.className = 'w';
        var wi = document.createElement('span'); wi.className = 'wi'; wi.textContent = part;
        w.appendChild(wi); frag.appendChild(w);
      });
      tn.parentNode.replaceChild(frag, tn);
    });
    lines(el);
  }
  function lines(el) {
    var top = null, n = -1;
    $$('.w', el).forEach(function (w) {
      var t = w.getBoundingClientRect().top;
      if (top === null || t - top > 4) { n++; top = t; }
      w.style.setProperty('--l', n);
    });
  }

  var heads = $$('main h2').filter(function (h) {
    var r = h.getBoundingClientRect();
    return r.top > window.innerHeight; /* то, что уже на экране, не прячем */
  });
  heads.forEach(split);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () { heads.forEach(function (h) { if (!h.classList.contains('is-in')) lines(h); }); });
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px' });

  /* прячем только после разбивки и только то, что будет наблюдаться */
  heads.forEach(function (h) { h.classList.add('is-split'); io.observe(h); });
})();
