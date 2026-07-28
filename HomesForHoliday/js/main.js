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

  // Featured properties carousel
  var carousel = document.querySelector("[data-carousel]");
  if (carousel) {
    var track = carousel.querySelector("[data-car-track]");
    var slides = Array.prototype.slice.call(carousel.querySelectorAll("[data-car-slide]"));
    var prevBtn = carousel.querySelector("[data-car-prev]");
    var nextBtn = carousel.querySelector("[data-car-next]");
    var dotsWrap = carousel.querySelector("[data-car-dots]");
    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var pageCount = function () {
      // how many "pages" of slides fit the viewport
      if (!slides.length) return 1;
      var per = Math.max(1, Math.round(track.clientWidth / slides[0].offsetWidth));
      return Math.max(1, Math.ceil(slides.length / per));
    };
    var currentPage = function () {
      if (!track.clientWidth) return 0;
      return Math.round(track.scrollLeft / track.clientWidth);
    };

    // dots
    var dots = [];
    var buildDots = function () {
      dotsWrap.innerHTML = "";
      dots = [];
      for (var i = 0; i < pageCount(); i++) {
        (function (i) {
          var b = document.createElement("button");
          b.type = "button";
          b.setAttribute("role", "tab");
          b.setAttribute("aria-label", "Go to slide " + (i + 1));
          b.addEventListener("click", function () {
            track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
            pause();
          });
          dotsWrap.appendChild(b);
          dots.push(b);
        })(i);
      }
    };
    var syncUi = function () {
      var page = currentPage();
      dots.forEach(function (d, i) { d.setAttribute("aria-selected", i === page ? "true" : "false"); });
      if (prevBtn) prevBtn.disabled = track.scrollLeft <= 4;
      if (nextBtn) nextBtn.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
    };

    var step = function (dir) {
      track.scrollBy({ left: dir * track.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
      pause();
    };
    if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
    if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });

    // auto-advance, looping back to the start at the end
    var timer = null;
    var start = function () {
      if (reduceMotion || timer) return;
      timer = window.setInterval(function () {
        if (document.hidden) return;
        var atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
        track.scrollTo({ left: atEnd ? 0 : track.scrollLeft + track.clientWidth, behavior: "smooth" });
      }, 5000);
    };
    var stop = function () { if (timer) { window.clearInterval(timer); timer = null; } };
    // pause briefly after manual interaction, then resume
    var resumeTimer = null;
    var pause = function () {
      stop();
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(start, 9000);
    };

    track.addEventListener("scroll", function () { window.requestAnimationFrame(syncUi); }, { passive: true });
    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", start);
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("touchstart", pause, { passive: true });
    window.addEventListener("resize", function () { buildDots(); syncUi(); });

    buildDots();
    syncUi();
    start();
  }

  // Back-to-top (mobile)
  var toTop = document.querySelector("[data-to-top]");
  if (toTop) {
    var onScrollTop = function () { toTop.classList.toggle("show", window.scrollY > 500); };
    window.addEventListener("scroll", onScrollTop, { passive: true });
    onScrollTop();
    toTop.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
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
