// The invert-colours setting (6.7). On Android the palette is Compose snapshot
// state; on the web every colour in app.css goes through a CSS custom property,
// so flipping the theme is a single attribute on <html> that redefines the
// tokens. No call site changes.
//
// color-scheme must follow the theme or Safari renders form controls for the
// wrong background. theme-color is left at its shipped #000000: black chrome
// sits fine over both white paper (light) and black paper (dark).

export function applyTheme(inverted) {
  document.documentElement.setAttribute('data-theme', inverted ? 'dark' : 'light');
  const scheme = document.querySelector('meta[name="color-scheme"]');
  if (scheme) scheme.setAttribute('content', inverted ? 'dark' : 'light');
}
