/* Unlock panel.
   This is presentation only. It decides which panel to show; it never holds an
   owner URL and is not the paywall — /api/go/<slug> is, server-side.
   Signing in is a code typed in here, never a link: nothing this file handles
   can be forwarded to somebody else. */
(function () {
  'use strict';

  var shell = document.getElementById('unlock-shell');
  if (!shell) return;

  var params = new URLSearchParams(location.search);
  var next = (params.get('next') || '').replace(/[^a-z0-9-]/gi, '');
  var pendingEmail = '';
  var justPaid = params.get('welcome') === '1';

  var PROBLEMS = {
    session: 'That payment link was not one we recognised.',
    unpaid: 'Stripe has not marked that payment as complete.',
    stripe: 'We could not reach Stripe to confirm the payment.',
    noemail: 'That payment came through without an email address, so we could not set your access up.',
    config: 'Something is not set up right at our end.',
    1: 'Something went wrong at our end.'
  };

  function panels() { return shell.querySelectorAll('.unlock-panel'); }

  function show(name) {
    panels().forEach(function (p) { p.hidden = p.dataset.state !== name; });
    if (window.lucide) window.lucide.createIcons();
    var field = shell.querySelector('.unlock-panel:not([hidden]) input');
    if (field) { try { field.focus(); } catch (e) {} }
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
    }).then(function (r) {
      return r.json().then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    });
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-GB',
        { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }

  // Where to send them once they are in: back to the property they wanted.
  function continueHref() { return next ? '/go/' + next : '/destinations.html'; }

  function refresh() {
    return fetch('/api/me', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (me) {
        if (me.hasAccess) {
          slot('expires', formatDate(me.accessExpiresAt));
          slot('signed-in-as', me.email);
          var cta = shell.querySelector('[data-slot="continue"]');
          if (cta) {
            cta.setAttribute('href', continueHref());
            // The owner's site opens in a new tab, the same as the cards on the
            // region pages, so paying never navigates anyone off Home for
            // Holiday.
            if (next) {
              cta.setAttribute('target', '_blank');
              cta.setAttribute('rel', 'nofollow noopener');
            } else {
              cta.removeAttribute('target');
            }
          }
          slot('continue-label', next ? 'Open the property' : 'Browse the directory');
          var paid = shell.querySelector('[data-welcome]');
          if (paid) paid.hidden = !justPaid;
          show('active');
          return;
        }
        if (me.known && me.lapsed) {
          slot('expires', formatDate(me.accessExpiresAt));
          slot('signed-in-as', me.email);
          show('lapsed');
          return;
        }
        show('locked');
      })
      .catch(function () { show('locked'); });
  }

  function startCheckout(btn) {
    if (btn) { btn.disabled = true; }
    var failed = function () {
      if (btn) btn.disabled = false;
      slot('problem-message', 'We could not open the payment page just then. Nothing has been charged — please try again.');
      show('problem');
    };
    post('/api/checkout', { next: next }).then(function (r) {
      if (r.ok && r.data.url) { location.href = r.data.url; } else { failed(); }
    }).catch(failed);
  }

  // The reply is the same whether or not the address has ever paid, so there is
  // nothing to branch on here — always move on to the code panel.
  function sendCode(email, form, label) {
    if (form) busy(form, true, label || 'Sending…');
    return post('/api/auth/send-code', { email: email }).then(function () {
      if (form) busy(form, false);
      pendingEmail = email;
      slot('code-sent-to', email);
      error('code', '');
      var field = shell.querySelector('#unlock-code');
      if (field) field.value = '';
      show('code');
    }).catch(function () {
      if (form) busy(form, false);
      error('signin', 'We could not send that just now. Please try again shortly.');
    });
  }

  shell.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;

    if (action === 'buy') { e.preventDefault(); startCheckout(btn); }
    if (action === 'show-signin') { e.preventDefault(); error('signin', ''); show('signin'); }
    if (action === 'show-locked') { e.preventDefault(); show('locked'); }

    if (action === 'resend') {
      e.preventDefault();
      if (!pendingEmail) { show('signin'); return; }
      btn.disabled = true;
      error('code', '');
      sendCode(pendingEmail).then(function () {
        error('code', 'A fresh code is on its way. The previous one no longer works.');
      });
    }

    if (action === 'signout') {
      e.preventDefault();
      post('/api/signout').then(function () { location.href = '/unlock.html'; });
    }
  });

  var signinForm = shell.querySelector('[data-form="signin"]');
  if (signinForm) signinForm.addEventListener('submit', function (e) {
    e.preventDefault();
    error('signin', '');
    var email = signinForm.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      error('signin', 'That does not look like an email address.');
      return;
    }
    sendCode(email, signinForm);
  });

  var codeForm = shell.querySelector('[data-form="code"]');
  if (codeForm) codeForm.addEventListener('submit', function (e) {
    e.preventDefault();
    error('code', '');
    var code = codeForm.elements.code.value.replace(/\D/g, '');
    if (code.length !== 6) { error('code', 'The code is six digits.'); return; }

    busy(codeForm, true, 'Checking…');
    post('/api/auth/verify-code', { email: pendingEmail, code: code }).then(function (r) {
      busy(codeForm, false);

      if (r.ok && r.data.ok && r.data.known) {
        // The cookie is set; /api/me decides between the active and lapsed panel.
        refresh();
        return;
      }
      if (r.ok && r.data.ok && !r.data.known) {
        // Right inbox, but nothing has ever been bought with it.
        show('locked');
        return;
      }
      error('code', (r.data && r.data.message) || 'That code was not right, or it has expired.');
    }).catch(function () {
      busy(codeForm, false);
      error('code', 'We could not check that just now. Please try again shortly.');
    });
  });

  // /api/activate has already set the cookie by the time we get here, so there
  // is nothing to poll for — just read the state.
  var problem = params.get('error');
  if (problem) {
    slot('problem-message', PROBLEMS[problem] || PROBLEMS[1]);
    show('problem');
  } else if (params.get('signin') === '1') {
    // Deep link out of the confirmation email: straight to the sign-in form,
    // unless this device already holds access, in which case say so instead.
    refresh().then(function () {
      var active = shell.querySelector('[data-state="active"]');
      if (active && active.hidden) show('signin');
    });
  } else {
    refresh();
  }
})();
