(function () {
  'use strict';

  var measurementId = 'G-BSY4SXWC7B';
  var storageKey = 'vla_analytics_consent';
  var analyticsLoaded = false;

  function getChoice() {
    try { return window.localStorage.getItem(storageKey); } catch (e) { return null; }
  }

  function saveChoice(choice) {
    try { window.localStorage.setItem(storageKey, choice); } catch (e) { /* continue for this visit */ }
  }

  function loadAnalytics() {
    if (analyticsLoaded) return;
    analyticsLoaded = true;

    window.gtag('consent', 'update', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted'
    });
    window.gtag('event', 'page_view', {
      page_title: document.title,
      page_location: window.location.href,
      page_path: window.location.pathname + window.location.search
    });
  }

  function deleteAnalyticsCookies() {
    document.cookie.split(';').forEach(function (item) {
      var name = item.split('=')[0].trim();
      if (name.indexOf('_ga') !== 0) return;
      document.cookie = name + '=; Max-Age=0; path=/; SameSite=Lax';
      document.cookie = name + '=; Max-Age=0; path=/; domain=.vlauk.com; SameSite=Lax';
    });
  }

  function createBanner() {
    if (document.querySelector('.consent-banner')) return;
    var banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Analytics preferences');
    banner.innerHTML =
      '<p><strong>Help us improve this website</strong><span>We use optional Google Analytics only if you accept. No advertising cookies. <a href="privacy-policy.html">Privacy policy</a></span></p>' +
      '<div class="consent-actions"><button type="button" class="consent-reject">No thanks</button><button type="button" class="consent-accept">Accept analytics</button></div>';
    document.body.appendChild(banner);

    banner.querySelector('.consent-accept').addEventListener('click', function () {
      saveChoice('granted');
      banner.remove();
      loadAnalytics();
    });

    banner.querySelector('.consent-reject').addEventListener('click', function () {
      var wasGranted = getChoice() === 'granted';
      saveChoice('denied');
      window.gtag('consent', 'update', {
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        analytics_storage: 'denied'
      });
      deleteAnalyticsCookies();
      banner.remove();
      if (wasGranted) window.location.reload();
    });
  }

  function addSettingsLink() {
    var footer = document.querySelector('.footer-bottom');
    if (!footer || footer.querySelector('.cookie-settings-link')) return;
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'cookie-settings-link';
    button.textContent = 'Cookie settings';
    button.addEventListener('click', createBanner);
    footer.appendChild(button);
  }

  window.vlaTrack = function (eventName, parameters) {
    if (getChoice() !== 'granted') return;
    window.gtag('event', eventName, parameters || {});
  };

  document.addEventListener('click', function (event) {
    var link = event.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (href.indexOf('tel:') === 0) window.vlaTrack('click_to_call');
    else if (href.indexOf('https://wa.me/') === 0) window.vlaTrack('whatsapp_click');
    else if (href.indexOf('mailto:') === 0) window.vlaTrack('email_click');
  });

  function init() {
    addSettingsLink();
    var choice = getChoice();
    if (choice === 'granted') loadAnalytics();
    else if (choice !== 'denied') createBanner();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}());
