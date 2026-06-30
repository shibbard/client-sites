// Vehicle Leasing Associates — main.js
(function () {
  // ---- Lucide icons ----
  function loadLucide() {
    if (window.lucide) { window.lucide.createIcons(); return; }
    var s = document.createElement('script');
    s.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
    s.onload = function () { if (window.lucide) window.lucide.createIcons(); };
    document.head.appendChild(s);
  }

  // ---- Mobile nav ----
  function initNav() {
    var burger = document.querySelector('.hamburger');
    var links = document.querySelector('.nav-links');
    var backdrop = document.querySelector('.nav-backdrop');
    if (!burger || !links) return;
    function close() {
      links.classList.remove('open');
      if (backdrop) backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
    burger.addEventListener('click', function () {
      var open = links.classList.toggle('open');
      if (backdrop) backdrop.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    if (backdrop) backdrop.addEventListener('click', close);
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        // allow dropdown parent taps on mobile without closing
        if (a.parentElement.classList.contains('has-dropdown') && window.innerWidth <= 900) return;
        close();
      });
    });
    // mobile dropdown toggle
    links.querySelectorAll('.has-dropdown > a').forEach(function (a) {
      a.addEventListener('click', function (e) {
        if (window.innerWidth <= 900) {
          e.preventDefault();
          a.parentElement.classList.toggle('drop-open');
        }
      });
    });
  }

  // ---- Scroll reveal ----
  function initReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ---- Form (demo handler) ----
  function initForm() {
    var f = document.querySelector('#quote-form');
    if (!f) return;
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var note = f.querySelector('.form-note');
      if (note) { note.style.display = 'block'; }
      f.reset();
    });
  }

  // ---- Brand social icons (Lucide dropped these) ----
  function initSocialIcons() {
    var PATHS = {
      facebook: 'M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07c0 6 4.39 10.97 10.13 11.87v-8.4H7.08v-3.47h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.23 2.68.23v2.97h-1.5c-1.48 0-1.95.93-1.95 1.88v2.26h3.31l-.53 3.47h-2.78v8.4C19.61 23.04 24 18.07 24 12.07z',
      twitter: 'M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z',
      instagram: 'M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.43.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.43.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.43-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.43-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zm0 1.62c-3.15 0-3.52.01-4.76.07-1.15.05-1.77.24-2.19.41-.55.21-.94.47-1.35.88-.41.41-.67.8-.88 1.35-.17.42-.36 1.04-.41 2.19-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.05 1.15.24 1.77.41 2.19.21.55.47.94.88 1.35.41.41.8.67 1.35.88.42.17 1.04.36 2.19.41 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c1.15-.05 1.77-.24 2.19-.41.55-.21.94-.47 1.35-.88.41-.41.67-.8.88-1.35.17-.42.36-1.04.41-2.19.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.05-1.15-.24-1.77-.41-2.19-.21-.55-.47-.94-.88-1.35-.41-.41-.8-.67-1.35-.88-.42-.17-1.04-.36-2.19-.41-1.24-.06-1.61-.07-4.76-.07zm0 2.76a5.46 5.46 0 100 10.92 5.46 5.46 0 000-10.92zm0 9.01a3.55 3.55 0 110-7.1 3.55 3.55 0 010 7.1zm5.68-9.23a1.28 1.28 0 11-2.55 0 1.28 1.28 0 012.55 0z'
    };
    document.querySelectorAll('[data-lucide="facebook"],[data-lucide="twitter"],[data-lucide="instagram"]').forEach(function (el) {
      var name = el.getAttribute('data-lucide');
      if (!PATHS[name]) return;
      var size = el.closest('.tb-social') ? 15 : 18;
      var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('fill', 'currentColor');
      svg.setAttribute('width', size);
      svg.setAttribute('height', size);
      svg.style.display = 'block';
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', PATHS[name]);
      svg.appendChild(path);
      el.replaceWith(svg);
    });
  }

  // ---- Back to top ----
  function initToTop() {
    var btn = document.createElement('button');
    btn.className = 'to-top';
    btn.setAttribute('aria-label', 'Back to top');
    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
    document.body.appendChild(btn);
    function toggle() { btn.classList.toggle('show', window.pageYOffset > 500); }
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', toggle, { passive: true });
    toggle();
  }

  document.addEventListener('DOMContentLoaded', function () {
    initSocialIcons();
    loadLucide();
    initNav();
    initReveal();
    initForm();
    initToTop();
    var y = document.querySelector('#year');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
