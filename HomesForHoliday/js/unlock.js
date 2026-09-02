/* Unlock panel.
   This is presentation only. It decides which panel to show; it never holds an
   owner URL and is not the paywall — /api/go/<slug> is, server-side. */
(function () {
  'use strict';

  var shell = document.getElementById('unlock-shell');
  if (!shell) return;

  var params = new URLSearchParams(location.search);
  var next = (params.get('next') || '').replace(/[^a-z0-9-]/gi, '');
  var state = { email: '' };

  function panels() { return shell.querySelectorAll('.unlock-panel'); }

  function show(name) {
    panels().forEach(function (p) { p.hidden = p.dataset.state !== name; });
    if (window.lucide) window.lucide.createIcons();
  }

  function slot(name, value) {
    shell.querySelectorAll('[data-slot="' + name + '"]').forEach(function (el) {
      el.textContent = value;
    });
  }

  function error(which, message) {
    var el = shell.querySelector('[data-error="' + which + '"]');
    if (!el) return;
    el.textContent = message || '';
    el.hidden = !message;
  }

  function busy(form, on, label) {
    var btn = form.querySelector('button[type="submit"]');
    if (!btn) return;
    btn.disabled = on;
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
    else if (btn.dataset.label) { btn.textContent = btn.dataset.label; }
  }

  function post(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); });
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }

  // Where to send them once they are in: back to the property they wanted.
  function continueHref() { return next ? '/go/' + next : '/destinations.html'; }

  function showActive(me) {
    slot('expires', formatDate(me.accessExpiresAt));
    slot('signed-in-as', me.email);
    var cta = shell.querySelector('[data-slot="continue"]');
    if (cta) cta.setAttribute('href', continueHref());
    show('active');
  }

  function refresh() {
    return fetch('/api/me', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (me) {
        if (me.signedIn && me.hasAccess) { showActive(me); return me; }
        if (me.signedIn) { slot('signed-in-as', me.email); show('lapsed'); return me; }
        show('locked');
        return me;
      })
      .catch(function () { show('locked'); });
  }

  function startCheckout() {
    post('/api/checkout', { next: next }).then(function (r) {
      if (r.ok && r.data.url) {
        location.href = r.data.url;
      } else {
        show('locked');
        alert('Sorry — we could not open the payment page just then. Please try again.');
      }
    });
  }

  function sendCode(email, onDone) {
    return post('/api/auth/send-code', { email: email }).then(function (r) {
      if (!r.ok) {
        if (onDone) onDone(r.data.message || 'Could not send a code just now.');
        return false;
      }
      state.email = r.data.email || email;
      slot('email', state.email);
      if (onDone) onDone(null);
      return true;
    });
  }

  shell.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;

    if (action === 'buy') { e.preventDefault(); startCheckout(); }
    if (action === 'show-signin') { e.preventDefault(); error('email', ''); show('email'); }
    if (action === 'show-locked') { e.preventDefault(); show('locked'); }

    if (action === 'resend') {
      e.preventDefault();
      btn.disabled = true;
      btn.textContent = 'sending…';
      sendCode(state.email, function () { btn.textContent = 'sent'; });
    }

    if (action === 'signout') {
      e.preventDefault();
      post('/api/auth/signout').then(function () { location.href = '/unlock.html'; });
    }
  });

  var emailForm = shell.querySelector('[data-form="email"]');
  if (emailForm) emailForm.addEventListener('submit', function (e) {
    e.preventDefault();
    error('email', '');
    var email = emailForm.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error('email', 'That does not look like an email address.');
    }
    busy(emailForm, true, 'Sending…');
    sendCode(email, function (err) {
      busy(emailForm, false);
      if (err) return error('email', err);
      error('code', '');
      show('code');
      var input = shell.querySelector('#unlock-code');
      if (input) { input.value = ''; input.focus(); }
    });
  });

  var codeForm = shell.querySelector('[data-form="code"]');
  if (codeForm) codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    error('code', '');
    var code = codeForm.elements.code.value.replace(/\D/g, '');
    if (code.length !== 6) return error('code', 'The code is 6 digits.');
    busy(codeForm, true, 'Checking…');
    post('/api/auth/verify-code', { email: state.email, code: code }).then(function (r) {
      busy(codeForm, false);
      if (!r.ok) return error('code', r.data.message || 'That code was not right.');
      if (r.data.hasAccess) {
        location.href = continueHref();
      } else {
        slot('signed-in-as', r.data.email);
        show('lapsed');
      }
    });
  });

  // Returning from Stripe. The webhook is what actually grants access and can
  // lag a second or two, so poll rather than assume the row is already updated.
  function afterPayment() {
    show('paid');
    var cs = params.get('cs');
    var attempts = 0;

    function poll() {
      attempts++;
      fetch('/api/me').then(function (r) { return r.json(); }).then(function (me) {
        if (me.signedIn && me.hasAccess) { showActive(me); return; }
        if (attempts < 10) setTimeout(poll, 1500);
      });
    }

    // Resolve the email from the Stripe session so they do not have to retype it.
    post('/api/auth/send-code', { checkout_session_id: cs }).then(function (r) {
      if (r.ok && r.data.email) {
        state.email = r.data.email;
        slot('email', state.email);
        error('code', '');
        show('code');
        var input = shell.querySelector('#unlock-code');
        if (input) input.focus();
      } else {
        slot('paid-status', 'Enter the email you paid with and we will send your code.');
        setTimeout(function () { show('email'); }, 1200);
      }
      poll();
    });
  }

  if (params.get('paid') === '1') afterPayment();
  else refresh();
})();
