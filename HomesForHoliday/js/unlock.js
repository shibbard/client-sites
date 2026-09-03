/* Unlock panel.
   This is presentation only. It decides which panel to show; it never holds an
   owner URL and is not the paywall — /api/go/<slug> is, server-side. */
(function () {
  'use strict';

  var shell = document.getElementById('unlock-shell');
  if (!shell) return;

  var params = new URLSearchParams(location.search);
  var next = (params.get('next') || '').replace(/[^a-z0-9-]/gi, '');

  var PROBLEMS = {
    session: 'That payment link was not one we recognised.',
    unpaid: 'Stripe has not marked that payment as complete.',
    stripe: 'We could not reach Stripe to confirm the payment.',
    noemail: 'That payment came through without an email address, so we could not send your link.',
    config: 'Something is not set up right at our end.',
    link: 'That link is not valid — it may have been cut in half by your email app.',
    1: 'Something went wrong at our end.'
  };

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

  function refresh() {
    return fetch('/api/me', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (me) {
        if (me.hasAccess) {
          slot('expires', formatDate(me.accessExpiresAt));
          slot('signed-in-as', me.email);
          var cta = shell.querySelector('[data-slot="continue"]');
          if (cta) cta.setAttribute('href', continueHref());
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
    post('/api/checkout', { next: next }).then(function (r) {
      if (r.ok && r.data.url) {
        location.href = r.data.url;
      } else {
        if (btn) btn.disabled = false;
        slot('problem-message', 'We could not open the payment page just then. Nothing has been charged — please try again.');
        show('problem');
      }
    }).catch(function () {
      if (btn) btn.disabled = false;
      slot('problem-message', 'We could not open the payment page just then. Nothing has been charged — please try again.');
      show('problem');
    });
  }

  shell.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action]');
    if (!btn) return;
    var action = btn.dataset.action;

    if (action === 'buy') { e.preventDefault(); startCheckout(btn); }
    if (action === 'show-recover') { e.preventDefault(); error('recover', ''); show('recover'); }
    if (action === 'show-locked') { e.preventDefault(); show('locked'); }

    if (action === 'signout') {
      e.preventDefault();
      post('/api/signout').then(function () { location.href = '/unlock.html'; });
    }
  });

  var recoverForm = shell.querySelector('[data-form="recover"]');
  if (recoverForm) recoverForm.addEventListener('submit', function (e) {
    e.preventDefault();
    error('recover', '');
    var email = recoverForm.elements.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error('recover', 'That does not look like an email address.');
    }
    busy(recoverForm, true, 'Sending…');
    post('/api/recover', { email: email }).then(function (r) {
      busy(recoverForm, false);
      // Same answer either way — the server will not say whether an address
      // has access, and neither does this.
      slot('sent-message', (r.data && r.data.message) || 'If that address has access, the link is on its way.');
      show('sent');
    }).catch(function () {
      busy(recoverForm, false);
      error('recover', 'We could not send that just now. Please try again shortly.');
    });
  });

  // /api/activate and /api/unlock have already set the cookie by the time we
  // get here, so there is nothing to poll for — just read the state.
  var problem = params.get('error');
  if (problem) {
    slot('problem-message', PROBLEMS[problem] || PROBLEMS[1]);
    show('problem');
  } else if (params.get('renew') === '1') {
    refresh().then(function () {
      // A lapsed token gives the lapsed panel already; an expired emailed link
      // arrives with no usable cookie, so fall back to the buy panel.
      var lapsed = shell.querySelector('[data-state="lapsed"]');
      if (lapsed && lapsed.hidden) show('locked');
    });
  } else {
    refresh();
  }
})();
