/* ===========================
   Ian Rice Building Ltd
   main.js
   =========================== */

// ─── Contact Form (Formspree) ────────────────────────────────────────────────
// Create form at formspree.io and replace YOUR_FORM_ID below
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/YOUR_FORM_ID';

async function handleSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const fname = form.fname.value.trim();
  const email = form.email.value.trim();
  const message = form.message.value.trim();

  if (!fname || !email || !message) {
    alert('Please fill in all required fields.');
    return;
  }

  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending\u2026';

  try {
    const response = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form)
    });

    if (response.ok) {
      document.getElementById('form-container').style.display = 'none';
      document.getElementById('form-success').style.display = 'block';
    } else {
      const data = await response.json();
      alert(data.errors ? data.errors.map(function(e) { return e.message; }).join(', ') : 'Something went wrong. Please call us on 01453 821555.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Send Enquiry';
    }
  } catch (err) {
    alert('Could not send your message. Please call us on 01453 821555.');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Enquiry';
  }
}

// ─── Lucide Icons ───────────────────────────────────────────────────────────
(function loadLucide() {
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
  script.onload = () => {
    if (window.lucide) window.lucide.createIcons();
  };
  document.head.appendChild(script);
})();

// ─── Mobile Nav Toggle ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  const toggle = document.querySelector('.nav-toggle');
  const navPrimary = document.querySelector('.nav-primary');
  const dropdownParents = document.querySelectorAll('.has-dropdown');

  if (toggle && navPrimary) {
    toggle.addEventListener('click', function () {
      const isOpen = navPrimary.classList.toggle('open');
      this.setAttribute('aria-expanded', isOpen);
      // toggle icon
      const icon = this.querySelector('[data-lucide]');
      if (icon) {
        icon.setAttribute('data-lucide', isOpen ? 'x' : 'menu');
        if (window.lucide) window.lucide.createIcons();
      }
    });
  }

  // Mobile dropdown toggles
  dropdownParents.forEach(function (item) {
    const link = item.querySelector('a');
    if (link) {
      link.addEventListener('click', function (e) {
        if (window.innerWidth <= 900) {
          e.preventDefault();
          item.classList.toggle('open');
        }
      });
    }
  });

  // Close nav when clicking outside
  document.addEventListener('click', function (e) {
    if (navPrimary && !navPrimary.contains(e.target) && toggle && !toggle.contains(e.target)) {
      navPrimary.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // ─── Active nav link ──────────────────────────────────────────────────────
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-primary a').forEach(function (link) {
    const href = link.getAttribute('href');
    if (href && href.split('/').pop() === currentPath) {
      link.classList.add('active');
    }
  });

  // ─── Scroll Reveal ────────────────────────────────────────────────────────
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(function (el) { observer.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }

  // ─── Sticky header shadow on scroll ──────────────────────────────────────
  const header = document.querySelector('.site-header');
  if (header) {
    window.addEventListener('scroll', function () {
      header.style.boxShadow = window.scrollY > 10
        ? '0 4px 20px rgba(0,0,0,.5)'
        : '0 2px 12px rgba(0,0,0,.35)';
    }, { passive: true });
  }

  // ─── Lightbox ────────────────────────────────────────────────────────────
  const lightbox = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');
  const lbCaption = document.getElementById('lightbox-caption');
  const lbClose = document.getElementById('lightbox-close');
  const lbPrev = document.getElementById('lightbox-prev');
  const lbNext = document.getElementById('lightbox-next');
  const lbItems = Array.from(document.querySelectorAll('[data-lightbox]'));
  let lbIndex = 0;

  function lbOpen(index) {
    lbIndex = index;
    const item = lbItems[index];
    lbImg.src = item.dataset.img;
    lbImg.alt = item.dataset.caption || '';
    lbCaption.textContent = item.dataset.caption || '';
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function lbClose_() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  if (lightbox) {
    lbItems.forEach(function (item, i) {
      item.addEventListener('click', function () { lbOpen(i); });
    });
    lbClose.addEventListener('click', lbClose_);
    lbPrev.addEventListener('click', function () { lbOpen((lbIndex - 1 + lbItems.length) % lbItems.length); });
    lbNext.addEventListener('click', function () { lbOpen((lbIndex + 1) % lbItems.length); });
    lightbox.addEventListener('click', function (e) { if (e.target === lightbox) lbClose_(); });
    document.addEventListener('keydown', function (e) {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape') lbClose_();
      if (e.key === 'ArrowLeft') lbOpen((lbIndex - 1 + lbItems.length) % lbItems.length);
      if (e.key === 'ArrowRight') lbOpen((lbIndex + 1) % lbItems.length);
    });
  }

  // ─── Back to top ─────────────────────────────────────────────────────────
  const btt = document.getElementById('back-to-top');
  if (btt) {
    window.addEventListener('scroll', function () {
      btt.classList.toggle('visible', window.scrollY > 400);
    }, { passive: true });
    btt.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
});
