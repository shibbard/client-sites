// Delta Roofing Repairs — main.js

document.addEventListener('DOMContentLoaded', function () {

  // Init Lucide icons
  if (window.lucide) lucide.createIcons();

  // ---- Mobile nav toggle ----
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    // Inject mobile CTA into nav list
    const mobileCta = document.createElement('li');
    mobileCta.innerHTML = '<a href="tel:08000467595" class="nav-cta-mobile">Get a Free Quote</a>';
    navLinks.appendChild(mobileCta);

    hamburger.addEventListener('click', function () {
      const open = navLinks.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', open);
    });

    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      });
    });

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
        navLinks.classList.remove('open');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---- Scroll reveal ----
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

  // ---- Active nav link on scroll ----
  const sections   = document.querySelectorAll('section[id]');
  const navAnchors = document.querySelectorAll('.nav-link');

  const scrollSpy = () => {
    let current = '';
    sections.forEach(section => {
      if (window.scrollY >= section.offsetTop - 90) {
        current = section.getAttribute('id');
      }
    });
    navAnchors.forEach(a => {
      a.classList.remove('active');
      const href = a.getAttribute('href');
      if (href === '#' + current || (href === '#top' && current === 'hero')) {
        a.classList.add('active');
      }
    });
  };
  window.addEventListener('scroll', scrollSpy, { passive: true });

  // ---- Gallery tabs ----
  const tabs = document.querySelectorAll('.gallery-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      tabs.forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      const targetId = 'gallery-' + this.dataset.tab;
      document.querySelectorAll('.gallery-grid').forEach(grid => {
        grid.classList.toggle('hidden', grid.id !== targetId);
      });
    });
  });

  // ---- Staggered reveal delay for grids ----
  document.querySelectorAll('.why-grid .why-card, .specialties-grid .specialty-card').forEach((el, i) => {
    el.style.transitionDelay = (i * 80) + 'ms';
    el.classList.add('reveal');
    observer.observe(el);
  });

});
