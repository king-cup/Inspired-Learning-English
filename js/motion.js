// Inspired English motion system. Page entrances stay restrained; navigation
// and headers themselves remain visually stable while the user scrolls.

export function enhancePage(root) {
  root.classList.remove('motion-entered');
  root.classList.add('motion-stage');
  requestAnimationFrame(() => root.classList.add('motion-entered'));
}
