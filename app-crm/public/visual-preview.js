// Opt-in visual comparison. This module never changes workspace data or actions.
if (new URLSearchParams(location.search).get('visual') === '1') {
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/app/visual-preview.css?v=20261117';
  document.head.append(style);
  document.body.classList.add('visual-preview');
  const banner = document.createElement('aside');
  banner.className = 'visual-preview-banner';
  banner.setAttribute('aria-label', 'Vista previa de diseño');
  const label = document.createElement('span');
  label.textContent = 'Propuesta inmersiva · Órbita';
  const detail = document.createElement('small');
  detail.textContent = 'Isotipo provisional';
  const back = document.createElement('a');
  back.href = '/app/';
  back.textContent = 'Ver versión actual ↗';
  const motion = document.createElement('button');
  motion.type = 'button';
  motion.className = 'visual-motion-toggle';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.body.classList.toggle('quiet-preview', reducedMotion);
  motion.textContent = reducedMotion ? 'Activar animaciones' : 'Pausar animaciones';
  motion.setAttribute('aria-pressed', String(reducedMotion));
  motion.addEventListener('click', () => {
    const paused = document.body.classList.toggle('quiet-preview');
    document.body.classList.toggle('motion-on', !paused);
    motion.textContent = paused ? 'Activar animaciones' : 'Pausar animaciones';
    motion.setAttribute('aria-pressed', String(paused));
  });
  banner.append(label, detail, motion, back);
  document.body.prepend(banner);

  const paths = {
    conversations: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h9M8 14h6"/>',
    contacts: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-3-5.2"/>',
    sales: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16M3 10h18"/>',
    statistics: '<path d="M4 4v16h17M8 15l4-5 4 3 5-8"/><circle cx="12" cy="10" r="1"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>'
  };
  function decorateNavigation() {
    for (const button of document.querySelectorAll('.sidebar nav [data-view]')) {
      const slot = button.querySelector('span');
      if (!slot || slot.dataset.orbitaIcon || !paths[button.dataset.view]) continue;
      slot.dataset.orbitaIcon = '1';
      // Only fixed, local icon paths are used here; no user content is inserted.
      slot.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + paths[button.dataset.view] + '</svg>';
    }
    const heading = document.querySelector('.details-heading');
    if (heading && !heading.querySelector('.visual-close-details')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'icon visual-close-details';
      close.setAttribute('aria-label', 'Cerrar ficha del cliente');
      close.textContent = '×';
      close.addEventListener('click', () => heading.closest('.inbox')?.classList.remove('show-details'));
      heading.append(close);
    }
    const header = document.querySelector('.topbar');
    if (header && !header.querySelector('.orbita-scene')) {
      const scene = document.createElement('div');
      scene.className = 'orbita-scene';
      scene.setAttribute('aria-hidden', 'true');
      const halo = document.createElement('span');
      halo.className = 'orbita-halo';
      const planet = document.createElement('img');
      planet.src = '/app/marca.svg';
      planet.alt = '';
      planet.draggable = false;
      const light = document.createElement('span');
      light.className = 'orbita-light';
      scene.append(halo, planet, light);
      header.append(scene);
    }
  }
  decorateNavigation();
  new MutationObserver(decorateNavigation).observe(document.getElementById('root'), { childList: true, subtree: true });
}
