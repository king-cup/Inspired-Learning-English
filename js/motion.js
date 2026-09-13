// Inspired English motion system.
// The timings follow the HyperFrames motion hierarchy: navigation leads,
// content follows in a short stagger, and feedback resolves fastest.

const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
let cleanup = () => {};
let wipe = null;

export function startWipe() {
  if (REDUCED) return;
  if (wipe) wipe.remove();
  wipe = document.createElement('div');
  wipe.className = 'page-wipe';
  wipe.setAttribute('aria-hidden', 'true');
  document.body.append(wipe);
  wipe.addEventListener('animationend', () => { wipe?.remove(); wipe = null; }, { once: true });
}

export function enhancePage(root) {
  cleanup();
  root.classList.remove('motion-entered');
  root.classList.add('motion-stage');
  requestAnimationFrame(() => root.classList.add('motion-entered'));

  const header = root.querySelector('.paper-head');
  if (header) header.classList.add('motion-header');

  let logo = document.getElementById('motion-logo');
  if (!logo) {
    logo = document.createElement('div');
    logo.id = 'motion-logo';
    logo.setAttribute('aria-hidden', 'true');
    const img = document.createElement('img');
    img.src = 'icons/icon-192-inspire.png';
    img.alt = '';
    logo.append(img);
    document.body.append(logo);
  }

  let touching = false;
  let wheelTimer = 0;
  const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 6;
  const update = () => {
    if (header) header.style.setProperty('--header-collapse', String(Math.min(1, window.scrollY / 150)));
    const show = atBottom() && (touching || wheelTimer);
    logo.classList.toggle('peek', !!show);
  };
  const down = () => { touching = true; update(); };
  const up = () => { touching = false; logo.classList.remove('peek'); };
  const wheel = () => {
    window.clearTimeout(wheelTimer);
    wheelTimer = window.setTimeout(() => { wheelTimer = 0; logo.classList.remove('peek'); }, 180);
    update();
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('touchstart', down, { passive: true });
  window.addEventListener('touchend', up, { passive: true });
  window.addEventListener('touchcancel', up, { passive: true });
  window.addEventListener('pointerup', up, { passive: true });
  window.addEventListener('wheel', wheel, { passive: true });
  update();

  cleanup = () => {
    window.removeEventListener('scroll', update);
    window.removeEventListener('touchstart', down);
    window.removeEventListener('touchend', up);
    window.removeEventListener('touchcancel', up);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('wheel', wheel);
    window.clearTimeout(wheelTimer);
    logo.classList.remove('peek');
  };
}
