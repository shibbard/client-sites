// Delta Roofing Repairs — main.js

document.addEventListener('DOMContentLoaded', function () {

  // Init Lucide icons
  if (window.lucide) lucide.createIcons();

  // ---- Mobile nav toggle ----
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('nav-links');

  if (hamburger && navLinks) {
    const mobileCta = document.createElement('li');
    mobileCta.innerHTML = '<a href="#contact" class="nav-cta-mobile">Get a Free Quote</a>';
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
      if (window.scrollY >= section.offsetTop - 90) current = section.getAttribute('id');
    });
    navAnchors.forEach(a => {
      a.classList.remove('active');
      const href = a.getAttribute('href');
      if (href === '#' + current || (href === '#top' && current === 'hero')) a.classList.add('active');
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

  // ---- Lightbox ----
  // Build lightbox DOM
  const lb = document.createElement('div');
  lb.id = 'lightbox';
  lb.setAttribute('role', 'dialog');
  lb.setAttribute('aria-modal', 'true');
  lb.setAttribute('aria-label', 'Image viewer');
  lb.innerHTML = `
    <div class="lb-backdrop"></div>
    <button class="lb-close" aria-label="Close">&times;</button>
    <button class="lb-prev" aria-label="Previous">&#8249;</button>
    <button class="lb-next" aria-label="Next">&#8250;</button>
    <div class="lb-content">
      <img class="lb-img" src="" alt="">
      <p class="lb-caption"></p>
    </div>
  `;
  document.body.appendChild(lb);

  const lbImg     = lb.querySelector('.lb-img');
  const lbCaption = lb.querySelector('.lb-caption');
  let items = [];
  let current = 0;

  function getVisibleItems() {
    // Collect gallery items from the currently visible gallery grid
    const activeGrid = document.querySelector('.gallery-grid:not(.hidden)');
    return activeGrid ? Array.from(activeGrid.querySelectorAll('.gallery-item')) : [];
  }

  function open(index) {
    items = getVisibleItems();
    current = index;
    show();
    lb.classList.add('lb-open');
    document.body.style.overflow = 'hidden';
    lb.querySelector('.lb-close').focus();
  }

  function close() {
    lb.classList.remove('lb-open');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  function show() {
    const item = items[current];
    const src  = item.getAttribute('href');
    const alt  = item.querySelector('img')?.getAttribute('alt') || '';
    const cap  = item.querySelector('.gallery-caption')?.textContent || '';
    lbImg.src = src;
    lbImg.alt = alt;
    lbCaption.textContent = cap;
    lb.querySelector('.lb-prev').style.visibility = current > 0 ? 'visible' : 'hidden';
    lb.querySelector('.lb-next').style.visibility = current < items.length - 1 ? 'visible' : 'hidden';
  }

  function prev() { if (current > 0) { current--; show(); } }
  function next() { if (current < items.length - 1) { current++; show(); } }

  // Intercept gallery item clicks
  document.querySelectorAll('.gallery-grid').forEach(grid => {
    grid.addEventListener('click', function (e) {
      const item = e.target.closest('.gallery-item');
      if (!item) return;
      e.preventDefault();
      const visibleItems = getVisibleItems();
      const idx = visibleItems.indexOf(item);
      if (idx !== -1) open(idx);
    });
  });

  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-backdrop').addEventListener('click', close);
  lb.querySelector('.lb-prev').addEventListener('click', prev);
  lb.querySelector('.lb-next').addEventListener('click', next);

  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('lb-open')) return;
    if (e.key === 'Escape')      close();
    if (e.key === 'ArrowLeft')   prev();
    if (e.key === 'ArrowRight')  next();
  });

  // Touch swipe support
  let touchStartX = 0;
  lb.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend',   e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) dx < 0 ? next() : prev();
  });

});
