// McDonnell-Price — main.js

// Lucide icons
(function () {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
  script.onload = () => {
    if (typeof lucide !== 'undefined') lucide.createIcons();
  };
  document.head.appendChild(script);
})();

// Mobile nav toggle
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.querySelector('.hamburger');
  const navList = document.querySelector('.nav-list');

  if (hamburger && navList) {
    hamburger.addEventListener('click', () => {
      const open = navList.classList.toggle('open');
      hamburger.setAttribute('aria-expanded', String(open));
      hamburger.querySelectorAll('span').forEach((s, i) => {
        if (open) {
          if (i === 0) s.style.transform = 'translateY(7px) rotate(45deg)';
          if (i === 1) s.style.opacity = '0';
          if (i === 2) s.style.transform = 'translateY(-7px) rotate(-45deg)';
        } else {
          s.style.transform = '';
          s.style.opacity = '';
        }
      });
    });

    // Close nav when link clicked
    navList.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navList.classList.remove('open');
        hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
      });
    });
  }

  // Active nav link
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/index';
  document.querySelectorAll('.nav-list a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && currentPath.endsWith(href.replace('.html', ''))) {
      a.classList.add('active');
    }
  });

  // Scroll reveal
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
    }, { threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  // Gallery lightbox (simple)
  const galleryItems = document.querySelectorAll('.gallery-item img');
  if (galleryItems.length) {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.9);z-index:1000;align-items:center;justify-content:center;cursor:pointer;';
    const lightboxImg = document.createElement('img');
    lightboxImg.style.cssText = 'max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 4px 40px rgba(0,0,0,0.5);';
    overlay.appendChild(lightboxImg);
    document.body.appendChild(overlay);

    galleryItems.forEach(img => {
      img.addEventListener('click', () => {
        lightboxImg.src = img.src;
        overlay.style.display = 'flex';
      });
    });
    overlay.addEventListener('click', () => { overlay.style.display = 'none'; });
  }
});
