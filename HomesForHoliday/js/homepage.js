(() => {
  const menu = document.querySelector('.homepage #main-menu');
  const toggle = document.querySelector('.homepage .nav-toggle');
  if (menu && toggle) {
    const drawer = window.matchMedia('(max-width: 860px)');
    let wasOpen = false;
    const syncMenu = () => {
      if (!drawer.matches && menu.classList.contains('open')) toggle.click();
      const open = drawer.matches && menu.classList.contains('open');
      menu.inert = drawer.matches && !open;
      if (menu.inert) menu.setAttribute('aria-hidden', 'true');
      else menu.removeAttribute('aria-hidden');
      if (open && !wasOpen) menu.querySelector('a')?.focus({ preventScroll: true });
      wasOpen = open;
    };
    new MutationObserver(syncMenu).observe(menu, { attributes: true, attributeFilter: ['class'] });
    drawer.addEventListener('change', syncMenu);
    document.addEventListener('keydown', event => {
      if (!drawer.matches || !menu.classList.contains('open')) return;
      if (event.key === 'Escape') toggle.focus({ preventScroll: true });
      if (event.key === 'Tab') {
        const first = menu.querySelector('a');
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); toggle.focus(); }
        else if (!event.shiftKey && document.activeElement === toggle) { event.preventDefault(); first?.focus(); }
      }
    }, true);
    syncMenu();
  }
})();
