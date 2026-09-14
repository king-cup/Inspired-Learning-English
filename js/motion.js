// Inspired English motion system. Page entrances stay restrained; navigation
// and headers themselves remain visually stable while the user scrolls.

export function enhancePage(root, animate = true) {
  root.classList.remove('motion-stage', 'motion-entered');
  if (!animate) return;
  root.classList.add('motion-stage');
  requestAnimationFrame(() => root.classList.add('motion-entered'));
}
