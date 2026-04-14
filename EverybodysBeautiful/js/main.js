// Everybody's Beautiful – main.js

// ---- Contact Form (Formspree) ----
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

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Sending\u2026';

  try {
    const res = await fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: new FormData(form)
    });
    if (res.ok) {
      document.getElementById('form-container').style.display = 'none';
      document.getElementById('form-success').style.display = 'block';
    } else {
      const data = await res.json();
      alert(data.errors ? data.errors.map(e => e.message).join(', ') : 'Something went wrong. Please call us on 01453 823903.');
      btn.disabled = false;
      btn.textContent = 'Send Message';
    }
  } catch {
    alert('Could not send your message. Please call us on 01453 823903.');
    btn.disabled = false;
    btn.textContent = 'Send Message';
  }
}

document.addEventListener('DOMContentLoaded', () => {

  // ---- Load Lucide icons ----
  const lucideScript = document.createElement('script');
  lucideScript.src = 'https://unpkg.com/lucide@latest/dist/umd/lucide.min.js';
  lucideScript.onload = () => {
    replaceIcons();
    lucide.createIcons();
  };
  document.head.appendChild(lucideScript);

  // ---- Replace emoji icons with Lucide ----
  function replaceIcons() {
    // Treatment category icons on homepage / treatments page
    const iconMap = {
      '🌸': 'flower-2',
      '💆': 'heart-handshake',
      '👁️': 'eye',
      '🪷': 'flower',
      '☀️': 'sun',
      '💉': 'syringe',
      '🕊️': 'feather',
      '💅': 'paintbrush-2',
      '💎': 'gem',
      '💫': 'star',
      '✨': 'sparkles',
      '🌿': 'leaf',
      '🎁': 'gift',
      '💧': 'droplets',
      '⚡': 'zap',
      '💼': 'briefcase',
      '💝': 'heart',
      '💻': 'monitor',
      '📋': 'clipboard-list',
      '📞': 'phone',
      '✉️': 'mail',
      '📍': 'map-pin',
      '🗓️': 'calendar',
    };

    // Replace .icon and .card-icon divs/spans
    document.querySelectorAll('.icon, .card-icon').forEach(el => {
      const text = el.textContent.trim();
      const lucideName = iconMap[text];
      if (lucideName) {
        el.innerHTML = `<i data-lucide="${lucideName}"></i>`;
        el.classList.add('lucide-icon-wrap');
      }
    });

    // Replace contact-icon content
    document.querySelectorAll('.contact-icon').forEach(el => {
      const text = el.textContent.trim();
      const lucideName = iconMap[text];
      if (lucideName) {
        el.innerHTML = `<i data-lucide="${lucideName}"></i>`;
      }
    });

    // Strip emoji from footer links (replace with small inline icon)
    document.querySelectorAll('.footer-col a').forEach(a => {
      const href = a.getAttribute('href') || '';
      let icon = null;
      if (href.startsWith('tel:'))    icon = 'phone';
      else if (href.startsWith('mailto:')) icon = 'mail';
      else if (a.textContent.includes('High Street') || a.textContent.includes('Stonehouse')) icon = 'map-pin';
      else if (href.includes('phorest')) icon = 'calendar';

      if (icon) {
        // Strip leading emoji and whitespace
        const cleanText = a.textContent.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}📞✉️📍🗓️✨💆🌿🎁\s]+/gu, '').trim();
        a.innerHTML = `<i data-lucide="${icon}" class="footer-link-icon"></i>${cleanText}`;
      }
    });

    // Strip emoji from CTA / contact buttons
    document.querySelectorAll('.btn').forEach(btn => {
      // Remove leading emoji + whitespace from button text
      btn.innerHTML = btn.innerHTML.replace(/^([\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}📞✉️📍🗓️✨🎁🗓️]\s*)+/gu, '').trim();
    });

    // Announcement bar - strip emoji
    document.querySelectorAll('.announcement').forEach(el => {
      el.innerHTML = el.innerHTML.replace(/✨\s*/g, '');
    });
  }

  // ---- Mobile nav toggle ----
  const toggle = document.querySelector('.nav-toggle');
  const navList = document.querySelector('.nav-list');

  if (toggle && navList) {
    toggle.addEventListener('click', () => {
      navList.classList.toggle('open');
      toggle.setAttribute('aria-expanded', navList.classList.contains('open'));
    });
  }

  // ---- Mobile: dropdown toggles ----
  document.querySelectorAll('.has-dropdown > a').forEach(link => {
    link.addEventListener('click', (e) => {
      if (window.innerWidth <= 768) {
        e.preventDefault();
        link.parentElement.classList.toggle('open');
      }
    });
  });

  // ---- Active nav link ----
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-list a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === currentPath || (currentPath === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ---- Smooth reveal on scroll ----
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.card, .team-card, .review-card, .treatment-section, .brand-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });

  const style = document.createElement('style');
  style.textContent = `.visible { opacity: 1 !important; transform: translateY(0) !important; }`;
  document.head.appendChild(style);

  // ---- Close mobile menu on outside click ----
  document.addEventListener('click', (e) => {
    if (navList && !e.target.closest('.site-nav')) {
      navList.classList.remove('open');
    }
  });

  // ---- Lightbox ----
  const lightbox = document.getElementById('lightbox');
  const lbImg    = document.getElementById('lb-img');
  const lbCaption = document.getElementById('lb-caption');
  const lbClose  = document.getElementById('lb-close');
  const lbPrev   = document.getElementById('lb-prev');
  const lbNext   = document.getElementById('lb-next');
  const lbItems  = Array.from(document.querySelectorAll('[data-lightbox]'));
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

  function lbCloseFn() {
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    lbImg.src = '';
  }

  if (lightbox && lbItems.length) {
    lbItems.forEach((item, i) => item.addEventListener('click', () => lbOpen(i)));
    lbClose.addEventListener('click', lbCloseFn);
    lbPrev.addEventListener('click', () => lbOpen((lbIndex - 1 + lbItems.length) % lbItems.length));
    lbNext.addEventListener('click', () => lbOpen((lbIndex + 1) % lbItems.length));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lbCloseFn(); });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('open')) return;
      if (e.key === 'Escape')     lbCloseFn();
      if (e.key === 'ArrowLeft')  lbOpen((lbIndex - 1 + lbItems.length) % lbItems.length);
      if (e.key === 'ArrowRight') lbOpen((lbIndex + 1) % lbItems.length);
    });
  }

});
