// McDonnell-Price — main.js

// Lucide icons
(function () {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
  script.onload = () => { if (typeof lucide !== 'undefined') lucide.createIcons(); };
  document.head.appendChild(script);
})();

document.addEventListener('DOMContentLoaded', () => {

  // ── Mobile nav toggle ──
  const hamburger = document.getElementById('hamburger');
  const navWrap   = document.getElementById('site-nav-wrap');
  const navList   = document.getElementById('nav-list');

  if (hamburger && navList) {
    hamburger.addEventListener('click', () => {
      const open = navList.classList.toggle('open');
      if (navWrap) navWrap.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
      const [s1, , s3] = hamburger.querySelectorAll('span');
      if (open) {
        s1.style.transform = 'translateY(7px) rotate(45deg)';
        hamburger.querySelectorAll('span')[1].style.opacity = '0';
        s3.style.transform = 'translateY(-7px) rotate(-45deg)';
      } else {
        hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      }
    });

    navList.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navList.classList.remove('open');
        if (navWrap) navWrap.classList.remove('open');
        hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      });
    });
  }

  // ── Active nav link ──
  const path = window.location.pathname;
  const file = path.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-list a').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    if (href === file || (file === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ── Scroll reveal ──
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
    }, { threshold: 0.10 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  // ── Gallery lightbox ──
  const lightbox    = document.getElementById('lightbox');
  const lbImg       = document.getElementById('lightbox-img');
  const lbCounter   = document.getElementById('lightbox-counter');
  const lbClose     = document.getElementById('lightbox-close');
  const lbPrev      = document.getElementById('lightbox-prev');
  const lbNext      = document.getElementById('lightbox-next');
  const galleryItems = Array.from(document.querySelectorAll('.gallery-item'));

  if (lightbox && galleryItems.length) {
    let current = 0;

    function openLightbox(index) {
      current = index;
      const img = galleryItems[current].querySelector('img');
      lbImg.src = img.src;
      lbImg.alt = img.alt;
      lbCounter.textContent = `${current + 1} / ${galleryItems.length}`;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }

    function showPrev() { openLightbox((current - 1 + galleryItems.length) % galleryItems.length); }
    function showNext() { openLightbox((current + 1) % galleryItems.length); }

    galleryItems.forEach((item, i) => item.addEventListener('click', () => openLightbox(i)));
    lbClose.addEventListener('click', closeLightbox);
    lbPrev.addEventListener('click', showPrev);
    lbNext.addEventListener('click', showNext);
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', e => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    });
  }
});
