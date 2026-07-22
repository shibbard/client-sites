// Mobile nav toggle
const hamburger = document.querySelector('.site-nav__hamburger');
const navLinks = document.querySelector('.site-nav__links');

if (hamburger && navLinks) {
  hamburger.addEventListener('click', () => {
    navLinks.classList.toggle('open');
    const icon = hamburger.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', navLinks.classList.contains('open') ? 'x' : 'menu');
      lucide.createIcons();
    }
  });
}

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

revealEls.forEach(el => observer.observe(el));

// Lucide icons
if (typeof lucide !== 'undefined') {
  lucide.createIcons();
}

// Lightbox
const lightboxLinks = document.querySelectorAll('[data-lightbox]');
if (lightboxLinks.length) {
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.innerHTML = `
    <button class="lightbox-close" aria-label="Close"><i data-lucide="x" width="28" height="28"></i></button>
    <button class="lightbox-prev" aria-label="Previous"><i data-lucide="chevron-left" width="36" height="36"></i></button>
    <img class="lightbox-img" src="" alt="">
    <button class="lightbox-next" aria-label="Next"><i data-lucide="chevron-right" width="36" height="36"></i></button>
  `;
  document.body.appendChild(overlay);
  if (typeof lucide !== 'undefined') lucide.createIcons();

  const items = Array.from(lightboxLinks);
  let current = 0;
  const lbImg = overlay.querySelector('.lightbox-img');

  function lbOpen(index) {
    current = (index + items.length) % items.length;
    const link = items[current];
    lbImg.src = link.href;
    lbImg.alt = link.querySelector('img') ? link.querySelector('img').alt : '';
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function lbClose() {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  items.forEach((link, i) => link.addEventListener('click', e => { e.preventDefault(); lbOpen(i); }));
  overlay.querySelector('.lightbox-close').addEventListener('click', lbClose);
  overlay.querySelector('.lightbox-prev').addEventListener('click', () => lbOpen(current - 1));
  overlay.querySelector('.lightbox-next').addEventListener('click', () => lbOpen(current + 1));
  overlay.addEventListener('click', e => { if (e.target === overlay) lbClose(); });
  document.addEventListener('keydown', e => {
    if (!overlay.classList.contains('active')) return;
    if (e.key === 'Escape') lbClose();
    if (e.key === 'ArrowLeft') lbOpen(current - 1);
    if (e.key === 'ArrowRight') lbOpen(current + 1);
  });
}
