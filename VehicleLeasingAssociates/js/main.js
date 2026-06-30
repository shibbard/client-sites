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
    loadLucide();
    initNav();
    initReveal();
    initForm();
    initToTop();
    var y = document.querySelector('#year');
    if (y) y.textContent = new Date().getFullYear();
  });
})();
