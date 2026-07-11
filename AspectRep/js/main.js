// Mobile nav toggle
const header = document.querySelector('.site-header');
const toggle = document.querySelector('.nav-toggle');
if (toggle) {
  toggle.addEventListener('click', () => {
    document.body.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', document.body.classList.contains('nav-open'));
  });
}
document.querySelectorAll('.main-nav a').forEach(a => {
  a.addEventListener('click', () => document.body.classList.remove('nav-open'));
});

// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Lucide icons
if (window.lucide) lucide.createIcons();
