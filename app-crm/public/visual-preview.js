// Única presentación de LAZO. No cambia los datos ni las acciones del CRM.
{
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = '/app/visual-preview.css?v=20261123-menu-flujos';
  document.head.append(style);
  document.body.classList.add('visual-preview', 'motion-on');
  document.body.classList.remove('quiet-preview');
  const banner = document.createElement('aside');
  banner.className = 'visual-preview-banner';
  banner.setAttribute('aria-label', 'Apariencia de LAZO');
  const label = document.createElement('span');
  label.textContent = 'LAZO · Órbita';
  banner.append(label);
  document.body.prepend(banner);

  const paths = {
    conversations: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8A8.5 8.5 0 0 1 12.5 20a8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 12.5 3H13a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h9M8 14h6"/>',
    contacts: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M21 21v-2a6 6 0 0 0-3-5.2"/>',
    sales: '<rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9 4v16M15 4v16M3 10h18"/>',
    flows: '<rect x="3" y="9" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 12h3m0 0V6h3m-3 6v6h3"/>',
    statistics: '<path d="M4 4v16h17M8 15l4-5 4 3 5-8"/><circle cx="12" cy="10" r="1"/>',
    connections: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>'
  };
  function decorateNavigation() {
    for (const item of document.querySelectorAll('.sidebar nav :is([data-view],[data-nav-icon])')) {
      const slot = item.querySelector('span');
      const icon = paths[item.dataset.navIcon || item.dataset.view];
      if (!slot || slot.dataset.orbitaIcon || !icon) continue;
      slot.dataset.orbitaIcon = '1';
      // Only fixed, local icon paths are used here; no user content is inserted.
      slot.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icon + '</svg>';
    }
    const heading = document.querySelector('.details-heading');
    if (heading && !heading.querySelector('#close-details, .visual-close-details')) {
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
      planet.src = '/app/marca-volumen.svg';
      planet.alt = '';
      planet.draggable = false;
      const light = document.createElement('span');
      light.className = 'orbita-light';
      const tiles = Object.entries(paths).slice(0, 3).map(([key], index) => {
        const tile = document.createElement('span');
        tile.className = 'scene-tile scene-tile-' + index;
        tile.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + paths[key] + '</svg>';
        return tile;
      });
      scene.append(halo, ...tiles, planet, light);
      header.append(scene);
      const resetTilt = () => {
        scene.style.removeProperty('--tilt-x');
        scene.style.removeProperty('--tilt-y');
      };
      header.addEventListener('pointermove', event => {
        const rect = header.getBoundingClientRect();
        const x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
        const y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
        scene.style.setProperty('--tilt-x', (-y * 6).toFixed(2) + 'deg');
        scene.style.setProperty('--tilt-y', (x * 9).toFixed(2) + 'deg');
      });
      header.addEventListener('pointerleave', resetTilt);
    }
  }
  decorateNavigation();
  new MutationObserver(decorateNavigation).observe(document.getElementById('root'), { childList: true, subtree: true });
}
