/* The Reef · общее поведение страницы: контакты, меню, анимации, калькулятор, отсчёт, трекинг. */
(function () {
  'use strict';
  var C = window.REEF_CONFIG || {};
  var Reef = window.Reef = window.Reef || {};

  /* ---------- утилиты ---------- */
  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  Reef.usd = function (n) { return usd.format(n); };
  Reef.unit = function (id) { return (C.UNITS || []).filter(function (u) { return u.id === id; })[0] || null; };
  function store(kind) {
    try { var s = window[kind]; var k = '__reef'; s.setItem(k, '1'); s.removeItem(k); return s; } catch (e) { return null; }
  }
  var LS = store('localStorage');
  var SS = store('sessionStorage');
  Reef.ls = LS; Reef.ss = SS;
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- страна по IP (общая для телефона и баннера cookies) ---------- */
  Reef.geo = (function () {
    try {
      var cached = LS && JSON.parse(LS.getItem('reef_iso') || 'null');
      if (cached && cached.iso && Date.now() - cached.t < 7 * 864e5) return Promise.resolve(cached.iso);
    } catch (e) { /* ignore */ }
    function save(iso) {
      iso = String(iso || '').toLowerCase();
      if (!/^[a-z]{2}$/.test(iso)) throw new Error('bad iso');
      try { LS && LS.setItem('reef_iso', JSON.stringify({ iso: iso, t: Date.now() })); } catch (e) { /* ignore */ }
      return iso;
    }
    function get(url, field) {
      return fetch(url, { cache: 'no-store' }).then(function (r) {
        if (!r.ok) throw new Error('geo ' + r.status);
        return r.json();
      }).then(function (j) { return save(j[field]); });
    }
    return get('https://ipapi.co/json/', 'country_code')
      .catch(function () { return get('https://get.geojs.io/v1/ip/country.json', 'country'); })
      .catch(function () { return null; });
  })();

  /* ---------- UTM и клики (первое и последнее касание) ---------- */
  (function captureTouch() {
    var p = new URLSearchParams(location.search);
    var keys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
    var touch = {};
    keys.forEach(function (k) { if (p.get(k)) touch[k] = p.get(k).slice(0, 300); });
    var has = Object.keys(touch).length > 0;
    touch.landing_url = location.href.split('#')[0];
    touch.referrer = document.referrer || '';
    touch.at = new Date().toISOString();
    try {
      if (LS && !LS.getItem('reef_ft')) LS.setItem('reef_ft', JSON.stringify(touch));
      if (SS && (has || !SS.getItem('reef_lt'))) SS.setItem('reef_lt', JSON.stringify(touch));
    } catch (e) { /* ignore */ }
    Reef._touch = touch;
    if (touch.fbclid && document.cookie.indexOf('_fbc=') === -1) {
      document.cookie = '_fbc=fb.1.' + Date.now() + '.' + touch.fbclid + ';path=/;max-age=7776000;SameSite=Lax';
    }
  })();
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  Reef.tracking = function () {
    var ft = {}, lt = {};
    try { ft = JSON.parse((LS && LS.getItem('reef_ft')) || '{}'); } catch (e) { /* ignore */ }
    try { lt = JSON.parse((SS && SS.getItem('reef_lt')) || '{}'); } catch (e) { /* ignore */ }
    if (!lt.landing_url) lt = Reef._touch || {};
    return {
      utm_source: lt.utm_source || '', utm_medium: lt.utm_medium || '', utm_campaign: lt.utm_campaign || '',
      utm_content: lt.utm_content || '', utm_term: lt.utm_term || '',
      fbclid: lt.fbclid || '', gclid: lt.gclid || '',
      fbp: cookie('_fbp'), fbc: cookie('_fbc'),
      landing_url: lt.landing_url || '', referrer: lt.referrer || '',
      first_touch: ft
    };
  };

  /* ---------- Meta Pixel + согласие на cookies ---------- */
  var EU = 'at be bg hr cy cz dk ee fi fr de gr hu ie it lv lt lu mt nl pl pt ro sk si es se is li no gb ch'.split(' ');
  var pixelLoaded = false;
  function loadPixel() {
    if (pixelLoaded || !C.PIXEL_ID) return;
    pixelLoaded = true;
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', C.PIXEL_ID);
    window.fbq('track', 'PageView');
  }
  Reef.track = function (event, params, eventId) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event: 'reef_' + event.toLowerCase() }, params || {}));
    if (!window.fbq || !pixelLoaded) return;
    var std = ['PageView', 'ViewContent', 'Lead', 'Contact', 'CompleteRegistration', 'Schedule', 'SubmitApplication'];
    window.fbq(std.indexOf(event) > -1 ? 'track' : 'trackCustom', event, params || {}, eventId ? { eventID: eventId } : undefined);
  };
  (function consent() {
    if (!C.PIXEL_ID) return;
    var saved = null;
    try { saved = LS && LS.getItem('reef_consent'); } catch (e) { /* ignore */ }
    if (saved === 'accept') return loadPixel();
    if (saved === 'decline') return;
    var banner = document.querySelector('.cookie');
    Reef.geo.then(function (iso) {
      if (iso && EU.indexOf(iso) === -1) { loadPixel(); return; }
      banner.hidden = false;
    });
    banner.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cookie]');
      if (!b) return;
      var v = b.getAttribute('data-cookie');
      try { LS && LS.setItem('reef_consent', v); } catch (err) { /* ignore */ }
      banner.hidden = true;
      if (v === 'accept') loadPixel();
    });
  })();

  /* ---------- контакты из конфига ---------- */
  Reef.waLink = C.WHATSAPP ? 'https://wa.me/' + String(C.WHATSAPP).replace(/\D/g, '') + '?text=' + encodeURIComponent(C.WHATSAPP_TEXT || '') : '';
  function fillContacts(root) {
    $$('[data-contact]', root).forEach(function (a) {
      var kind = a.getAttribute('data-contact');
      var label = a.querySelector('span');
      if (kind === 'phone' && C.PHONE) { a.href = 'tel:' + C.PHONE.replace(/[^\d+]/g, ''); if (label) label.textContent = C.PHONE; a.hidden = false; }
      if (kind === 'email' && C.EMAIL) { a.href = 'mailto:' + C.EMAIL; if (label) label.textContent = C.EMAIL; a.hidden = false; }
      if (kind === 'tg' && C.TELEGRAM) { a.href = 'https://t.me/' + C.TELEGRAM.replace('@', ''); a.target = '_blank'; a.rel = 'noopener'; a.hidden = false; }
      if (kind === 'wa') {
        if (Reef.waLink) { a.href = Reef.waLink; a.target = '_blank'; a.rel = 'noopener'; a.addEventListener('click', function () { Reef.track('Contact', { method: 'whatsapp' }); }); }
        else { a.setAttribute('role', 'button'); a.setAttribute('data-open-form', ''); a.setAttribute('data-form', 'whatsapp'); }
      }
    });
    $$('[data-privacy]', root).forEach(function (a) { a.href = C.PRIVACY_URL || '#'; });
  }
  Reef.fillContacts = fillContacts;
  fillContacts(document);
  var cons = document.querySelector('[data-construction]');
  if (cons && C.CONSTRUCTION_URL) { cons.href = C.CONSTRUCTION_URL; cons.hidden = false; }

  /* ---------- появление блоков и счётчики: в js/motion.js ---------- */
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- вкладки юнитов ---------- */
  var tabs = $$('.tabs__btn');
  function selectTab(btn) {
    tabs.forEach(function (t) {
      var on = t === btn;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  }
  /* без скрипта обе панели видны; со скриптом остаётся выбранная */
  if (tabs.length) selectTab(tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]);
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      var n = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(n); n.focus();
    });
  });
  var unitsSeen = false;
  var unitsSec = document.getElementById('residences');
  if (unitsSec && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en, obs) {
      if (en[0].isIntersecting && !unitsSeen) { unitsSeen = true; Reef.track('ViewContent', { content_name: 'residences' }); obs.disconnect(); }
    }, { threshold: 0.25 }).observe(unitsSec);
  }

  /* ---------- калькулятор платежей ---------- */
  var sel = document.getElementById('calc-unit');
  if (sel && C.UNITS) {
    C.UNITS.forEach(function (u) {
      var o = document.createElement('option');
      o.value = u.id;
      o.textContent = u.name.replace(' Apartment', '');
      sel.appendChild(o);
    });
    var out = {};
    $$('[data-calc]').forEach(function (el) { out[el.getAttribute('data-calc')] = el; });
    var cta = document.querySelector('[data-calc-cta]');
    var render = function () {
      var u = Reef.unit(sel.value);
      if (!u) return;
      var tenth = Math.round(u.price * 0.1);
      var month = Math.floor((u.price * 0.8) / 24 / 10) * 10;
      out.total.textContent = Reef.usd(u.price);
      if (out.area) out.area.textContent = u.area + ' m²';
      out.p1.textContent = Reef.usd(tenth);
      out.p2.textContent = Reef.usd(tenth);
      out.q.textContent = Reef.usd(tenth);
      out.month.textContent = Reef.usd(month);
      if (cta) cta.setAttribute('data-unit', u.id);
    };
    sel.addEventListener('change', render);
    render();
  }

  /* ---------- v3: шаг оплаты в прокрутке подсвечивает строку калькулятора ---------- */
  var paySteps = $$('[data-pay-step]');
  var calcRows = $$('.calc__step');
  if (paySteps.length && calcRows.length && 'IntersectionObserver' in window) {
    var setStep = function (n) {
      paySteps.forEach(function (el) { el.classList.toggle('is-current', el.getAttribute('data-pay-step') === String(n)); });
      calcRows.forEach(function (el, i) { el.classList.toggle('is-current', i === n); });
    };
    /* текущий шаг: последний, чей верх уже прошёл линию на 45% высоты окна */
    var pick = function () {
      var line = window.innerHeight * 0.45, n = -1;
      paySteps.forEach(function (el, i) { if (el.getBoundingClientRect().top <= line) n = i; });
      setStep(n);
    };
    /* пассивная прокрутка, раз в кадр и только пока секция оплаты на экране
       (отступы IntersectionObserver во фреймах браузеры игнорируют) */
    var ticking = false;
    var onScroll = function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; pick(); });
    };
    var paySec = document.getElementById('payment');
    new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { window.addEventListener('scroll', onScroll, { passive: true }); pick(); }
      else { window.removeEventListener('scroll', onScroll); }
    }).observe(paySec || paySteps[0].parentNode);
  }

  /* ---------- обратный отсчёт до конца пресейла ---------- */
  var cd = document.querySelector('[data-countdown]');
  if (cd) {
    var end = new Date(C.PRESALE_DEADLINE || '2026-12-31T23:59:59+03:00').getTime();
    var d = cd.querySelector('[data-cd=d]'), h = cd.querySelector('[data-cd=h]'), m = cd.querySelector('[data-cd=m]');
    var nums = cd.querySelector('.countdown__nums');
    if (nums) nums.hidden = false;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var tick = function () {
      var left = end - Date.now();
      if (left <= 0) {
        cd.querySelector('.countdown__nums').hidden = true;
        cd.querySelector('.countdown__label').hidden = true;
        cd.querySelector('.countdown__ended').hidden = false;
        return false;
      }
      var mins = Math.floor(left / 6e4);
      d.textContent = Math.floor(mins / 1440);
      h.textContent = pad(Math.floor(mins % 1440 / 60));
      m.textContent = pad(mins % 60);
      return true;
    };
    if (tick()) setInterval(tick, 15000);
  }

  /* ---------- липкая панель на телефоне ---------- */
  var bar = document.querySelector('.sticky-cta');
  var hero = document.querySelector('.hero');
  var final = document.getElementById('get');
  if (bar && hero && 'IntersectionObserver' in window) {
    var heroOut = false, finalIn = false;
    var upd = function () {
      var show = heroOut && !finalIn;
      bar.classList.toggle('is-visible', show);
      bar.setAttribute('aria-hidden', String(!show));
      $$('a, button', bar).forEach(function (el) { el.tabIndex = show ? 0 : -1; });
    };
    new IntersectionObserver(function (en) { heroOut = !en[0].isIntersecting; upd(); }, { threshold: 0, rootMargin: '-60% 0px 0px 0px' }).observe(hero);
    if (final) new IntersectionObserver(function (en) { finalIn = en[0].isIntersecting; upd(); }, { threshold: 0.15 }).observe(final);
  }
})();
