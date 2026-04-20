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
