/* Homes for Holiday — interactions */
(function () {
  "use strict";

  // Signal JS is active so the reveal system's hidden state can apply.
  // If any of this fails, content stays visible (CSS hides only under html.js).
  document.documentElement.classList.add("js");

  // Mobile nav toggle
  var toggle = document.querySelector(".nav-toggle");
  var menu = document.querySelector(".nav-menu");
  var backdrop = document.querySelector(".nav-backdrop");
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("open");
    if (toggle) { toggle.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    if (backdrop) backdrop.classList.remove("show");
    document.body.style.overflow = "";
  }
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      if (backdrop) backdrop.classList.toggle("show", open);
      document.body.style.overflow = open ? "hidden" : "";
    });
    menu.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", closeMenu);
    });
    if (backdrop) backdrop.addEventListener("click", closeMenu);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });
  }

  // Header shadow on scroll
  var header = document.querySelector(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("scrolled", window.scrollY > 12);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Scroll reveal
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    reveals.forEach(function (el) { io.observe(el); });
    // Ultimate failsafe: if anything prevents the observer from firing
    // (throttled background tab, edge-case browsers), reveal everything so
    // content is never permanently hidden.
    window.setTimeout(function () {
      reveals.forEach(function (el) { el.classList.add("in"); });
    }, 2500);
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  // Property filter bar (region listing pages)
  var filterBar = document.querySelector("[data-filter-scope]");
  if (filterBar) {
    var searchInput = filterBar.querySelector("[data-filter-search]");
    var bedsSelect = filterBar.querySelector("[data-filter-beds]");
    var poolCheckbox = filterBar.querySelector("[data-filter-pool]");
    var clearButtons = filterBar.querySelectorAll("[data-filter-clear]");
    var emptyState = filterBar.querySelector("[data-filter-empty]");
    var cards = Array.prototype.slice.call(document.querySelectorAll(".prop-card"));
    var groups = Array.prototype.slice.call(document.querySelectorAll(".region-group"));

    function cardBeds(card) {
      var metaText = card.querySelector(".prop-meta") ? card.querySelector(".prop-meta").textContent : "";
      var match = metaText.match(/(\d+)\s*Bed/i);
      return match ? parseInt(match[1], 10) : 0;
    }
    function cardHasPool(card) {
      return !!card.querySelector(".prop-pool");
    }
    function cardText(card) {
      return card.textContent.toLowerCase();
    }

    function applyFilters() {
      var query = (searchInput && searchInput.value || "").trim().toLowerCase();
      var minBeds = bedsSelect ? parseInt(bedsSelect.value, 10) || 0 : 0;
      var poolOnly = !!(poolCheckbox && poolCheckbox.checked);
      var visibleCount = 0;

      cards.forEach(function (card) {
        var matches = true;
        if (query && cardText(card).indexOf(query) === -1) matches = false;
        if (matches && minBeds && cardBeds(card) < minBeds) matches = false;
        if (matches && poolOnly && !cardHasPool(card)) matches = false;
        card.classList.toggle("is-filtered-out", !matches);
        if (matches) visibleCount++;
      });

      groups.forEach(function (group) {
        var visibleInGroup = group.querySelectorAll(".prop-card:not(.is-filtered-out)").length;
        group.classList.toggle("is-empty", visibleInGroup === 0);
      });

      if (emptyState) emptyState.classList.toggle("show", visibleCount === 0);
    }

    if (searchInput) searchInput.addEventListener("input", applyFilters);
    if (bedsSelect) bedsSelect.addEventListener("change", applyFilters);
    if (poolCheckbox) poolCheckbox.addEventListener("change", applyFilters);
    clearButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (searchInput) searchInput.value = "";
        if (bedsSelect) bedsSelect.value = "0";
        if (poolCheckbox) poolCheckbox.checked = false;
        applyFilters();
      });
    });
  }

  // Lucide icons
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }

  // Current year
  var y = document.querySelectorAll("[data-year]");
  y.forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
