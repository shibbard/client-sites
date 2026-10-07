/* HFH measurement loads only after an explicit analytics choice. */
(function () {
  'use strict';
  if (!/^(www\.)?hfhtravel\.com$/.test(location.hostname)) return;

  var id = 'G-G1ZCPF3TRB';
  var key = 'hfh-analytics-consent-v1';
  var lifetime = 180 * 864e5;
  var loaded = false;
  var allowed = false;
  var choice;
  try {
    choice = JSON.parse(localStorage.getItem(key));
    if (!choice || Date.now() - choice.time > lifetime) choice = null;
  } catch (_) { choice = null; }

  function cleanUrl(value) {
    try { var url = new URL(value); return url.origin + url.pathname; }
    catch (_) { return ''; }
  }
  function start() {
    allowed = true;
    window['ga-disable-' + id] = false;
    if (loaded) {
      window.gtag('consent', 'update', { analytics_storage: 'granted' });
      return;
    }
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', id, {
      send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_location: cleanUrl(location.href),
      page_referrer: cleanUrl(document.referrer), cookie_expires: 180 * 86400
    });
    window.gtag('event', 'page_view', {
      page_location: cleanUrl(location.href),
      page_referrer: cleanUrl(document.referrer), page_title: document.title
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + id;
    document.head.appendChild(script);
  }
  function stop() {
    allowed = false;
    window['ga-disable-' + id] = true;
    if (loaded) window.gtag('consent', 'update', { analytics_storage: 'denied' });
    document.cookie.split(';').forEach(function (entry) {
      var name = entry.trim().split('=')[0];
      if (!/^_ga(?:_|$)/.test(name)) return;
      ['', '; domain=hfhtravel.com', '; domain=.hfhtravel.com', '; domain=' + location.hostname].forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; path=/' + domain + '; SameSite=Lax; Secure';
      });
    });
  }

  var banner = document.createElement('section');
  banner.className = 'analytics-choice';
  banner.setAttribute('aria-label', 'Cookie choices');
  banner.innerHTML = '<div><strong>Your cookie choices</strong><p>Essential cookies keep directory access working. With your permission, Google Analytics helps us understand visits and improve the site. <a href="/privacy-policy.html">Privacy policy</a></p></div><div class="analytics-choice-actions"><button type="button" class="btn btn-ghost" data-consent="no">Essential only</button><button type="button" class="btn btn-primary" data-consent="yes">Accept analytics</button></div>';
  document.body.appendChild(banner);
  banner.hidden = !!choice;
  banner.addEventListener('click', function (event) {
    var button = event.target.closest('[data-consent]');
    if (!button) return;
    choice = { accepted: button.dataset.consent === 'yes', time: Date.now() };
    try { localStorage.setItem(key, JSON.stringify(choice)); } catch (_) {}
    if (choice.accepted) start(); else stop();
    banner.hidden = true;
    settings.focus();
  });
  var settings = document.createElement('button');
  settings.type = 'button';
  settings.className = 'analytics-settings';
  settings.textContent = 'Cookie settings';
  settings.addEventListener('click', function () {
    banner.hidden = false;
    banner.querySelector('button').focus();
  });
  (document.querySelector('.site-footer .container') || document.body).appendChild(settings);
  if (choice && choice.accepted) start();
  window.addEventListener('storage', function (event) {
    if (event.key !== key) return;
    try { choice = JSON.parse(event.newValue); } catch (_) { choice = null; }
    if (choice && choice.accepted) start(); else stop();
  });

  document.addEventListener('click', function (event) {
    if (!allowed || !window.gtag) return;
    var buy = event.target.closest('[data-action="buy"]');
    if (buy) window.gtag('event', 'begin_checkout', {
      currency: 'GBP', value: 5.95,
      items: [{ item_id: 'directory-30-days', item_name: '30-day directory access', price: 5.95, quantity: 1 }]
    });
    var link = event.target.closest('a[href]');
    if (!link) return;
    var url = new URL(link.href);
    if (url.origin === location.origin && url.pathname.indexOf('/go/') === 0) {
      window.gtag('event', 'select_content', { content_type: 'holiday_home', item_id: url.pathname.split('/').pop() });
    }
  });
})();
