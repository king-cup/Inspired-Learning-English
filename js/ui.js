// The component vocabulary, ported from ui/Components.kt.
// Everything returns real DOM so screens can wire handlers without innerHTML.

import * as i18n from './i18n.js';

/** Tiny hyperscript. h('div.box', {onclick}, child, 'text') */
export function h(spec, attrs, ...kids) {
  const [tag, ...classes] = String(spec).split('.');
  const el = document.createElement(tag || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (attrs.nodeType || typeof attrs === 'string' || Array.isArray(attrs))) {
    kids.unshift(attrs);
  } else if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className += ' ' + v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };

// --------------------------------------------------------- Chinese text (§3)
//
// Chinese content gets bold TT SongTi (falling back to system Songti). Rather
// than tag every call site, we auto-detect CJK: any string that contains Han
// characters is wrapped in a .cn span with lang="zh-Hans". English vocabulary
// words and Latin UI labels contain no CJK, so they keep the serif/monospace
// system untouched. See --cn in app.css.
const CJK_RE = /[　-〿㐀-鿿豈-﫿＀-￯]/;
export const hasCJK = (s) => CJK_RE.test(String(s));
export function cn(str) {
  const s = String(str == null ? '' : str);
  return hasCJK(s) ? h('span.cn', { lang: 'zh-Hans' }, s) : document.createTextNode(s);
}

/**
 * Invert-on-press. CSS :active does not fire reliably on iOS, which would kill
 * the entire button language, so the state is driven from pointer events.
 */
export function press(el) {
  const on = () => el.classList.add('is-pressed');
  const off = () => el.classList.remove('is-pressed');
  el.addEventListener('pointerdown', on);
  el.addEventListener('pointerup', off);
  el.addEventListener('pointercancel', off);
  el.addEventListener('pointerleave', off);
  return el;
}

/** The double-ruled header sheet: 3px outer rule, 1px inner. The title is the
 *  screen's h1 (§8 logical heading). */
export const paperHeader = ({ kicker, title, left, right }) =>
  h('header.paper-head', null,
    h('div.kick', null, cn(String(kicker || ''))),
    h('h1', null, cn(String(title || ''))),
    h('div.band', { 'aria-hidden': 'true' }),
    h('div.feet', null,
      h('span', null, cn(String(left || ''))),
      h('span', null, cn(String(right || '')))));

/** A screen heading for views without a paper header (Practice/Test/Cards). */
export const srHeading = (text) => h('h1.sr-only', null, cn(String(text)));

export const barLabel = (text, right) =>
  h('div.bar', null, h('span', null, cn(String(text))),
    right != null ? h('span', null, cn(String(right))) : null);

export function button(text, opts = {}) {
  const cls = ['btn', opts.variant || '', opts.size || '', opts.wide ? 'wide' : '', opts.on ? 'on' : '']
    .filter(Boolean).join(' ');
  const el = h('button.' + cls.split(' ').join('.'), { type: 'button' }, cn(text));
  if (opts.ariaLabel) el.setAttribute('aria-label', opts.ariaLabel);
  if (opts.ariaPressed != null) el.setAttribute('aria-pressed', opts.ariaPressed ? 'true' : 'false');
  if (opts.title) el.title = opts.title;
  if (opts.disabled) el.disabled = true;
  if (opts.onClick) el.addEventListener('click', opts.onClick);
  return press(el);
}

export function blockButton(title, caption, onClick) {
  const el = h('button.block', { type: 'button', onclick: onClick },
    h('div.t', null, cn(String(title))),
    caption ? h('div.c', null, cn(caption)) : null);
  return press(el);
}

/** A ruled progress bar. Exposes progressbar semantics (§8). */
export function ruleBar(fraction, size = '', opts = {}) {
  const clamped = Math.max(0, Math.min(1, fraction || 0));
  const pct = Math.round(clamped * 100);
  const bar = h('div.rulebar' + (size ? '.' + size : ''), {
    role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct),
    'aria-label': opts.label || i18n.t('a11y.progress'),
  }, h('i'));
  bar.firstChild.style.width = pct + '%';
  return bar;
}

export const tag = (text, inverted) => {
  const s = String(text);
  const isCn = hasCJK(s);
  return h('span.tag' + (inverted ? '.inv' : '') + (isCn ? '.cn' : ''), isCn ? { lang: 'zh-Hans' } : null, s);
};

/** Part-of-speech chip, expanded and localized (§2). Chinese labels get the
 *  bold SongTi stack; English labels stay in the mono label voice. Returns null
 *  for an empty POS so callers can `pos && ...`. */
export function posTag(rawPos) {
  const label = i18n.displayPos(rawPos);
  if (!label) return null;
  const isCn = hasCJK(label);
  return h('span.tag.pos' + (isCn ? '.cn' : ''), isCn ? { lang: 'zh-Hans' } : null, label);
}

export const hrule = (thin) => h('div.hr' + (thin ? '.thin' : ''), { 'aria-hidden': 'true' });

export const speakerGlyph = () => h('span.glyph', { 'aria-hidden': 'true' }, '▶');

export const topBar = (leftText, rightText, onBack) =>
  h('div.topbar', null,
    button(leftText, { variant: 'thin', size: 'sm', onClick: onBack }),
    h('span.k-9.dim', null, cn(String(rightText || ''))));

export const centreNote = (text) => h('div.centre', null, h('div.k-11', null, cn(text)));

/** Bold every occurrence of the target word inside its own example sentence. */
export function highlight(sentence, word) {
  const frag = document.createDocumentFragment();
  const stem = String(word || '').trim();
  if (!stem) { frag.append(sentence); return frag; }
  const lower = String(sentence).toLowerCase();
  const needle = stem.toLowerCase();
  let i = 0;
  while (i < sentence.length) {
    const hit = lower.indexOf(needle, i);
    if (hit < 0) { frag.append(sentence.slice(i)); break; }
    if (hit > i) frag.append(sentence.slice(i, hit));
    frag.append(h('b', null, sentence.slice(hit, hit + stem.length)));
    i = hit + stem.length;
  }
  return frag;
}

export const shortDate = (ms) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(new Date(ms));

/** The Inspire Education leaf mark, from the licensed app icon. Decorative. */
export const leafMark = (size = 44) =>
  h('img.leaf', { src: 'icons/icon-192-inspire.png', width: size, height: size, alt: '', 'aria-hidden': 'true' });

// --------------------------------------------------------- dropdowns (6.3, §8)

// Registry so opening one Library dropdown closes any other (§10).
const openDropdownClosers = new Set();

export function dropdown({ label, value, options, onPick }) {
  const menuId = 'dd-' + Math.random().toString(36).slice(2, 8);
  const menu = h('div.dd-menu.hidden', { id: menuId, role: 'listbox' });
  options.forEach((opt, i) => {
    const on = opt === value;
    const item = press(h('button.dd-item' + (on ? '.on' : ''), {
      type: 'button', role: 'option', 'aria-selected': on ? 'true' : 'false',
      onclick: () => onPick(i),
    }, cn(opt)));
    menu.append(item);
  });

  const head = press(h('button.dd-head', {
    type: 'button', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-controls': menuId,
  }, h('span.dd-val', null, cn(value)), h('span.dd-caret', { 'aria-hidden': 'true' }, '▾')));

  const setOpen = (open) => {
    menu.classList.toggle('hidden', !open);
    head.classList.toggle('open', open);
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) openDropdownClosers.add(close); else openDropdownClosers.delete(close);
  };
  const close = () => setOpen(false);
  head.addEventListener('click', () => {
    const willOpen = menu.classList.contains('hidden');
    if (willOpen) openDropdownClosers.forEach((c) => c());   // close the other one
    setOpen(willOpen);
  });

  return h('div.dd', null, barLabel(label), head, menu);
}

/** A settings row: title, one line of help, and a hard ON/OFF toggle exposed as
 *  a switch (§8). */
export function toggleRow({ title, help, checked, onLabel, offLabel, onChange }) {
  const pip = h('span.toggle' + (checked ? '.on' : ''), { 'aria-hidden': 'true' }, cn(checked ? onLabel : offLabel));
  const row = press(h('button.toggle-row', {
    type: 'button', role: 'switch', 'aria-checked': checked ? 'true' : 'false',
    onclick: () => onChange(!checked),
  },
    h('div.grow', null, h('div.k-11', null, cn(title)), h('div.toggle-help', null, cn(help))),
    pip));
  return row;
}

/** The big pass/fail number on the test result screen. Port of GradeBlock. */
export function gradeBlock({ pct, correct, total, passed, caption }) {
  return h('div.grade' + (passed ? '.good' : '.bad'), { role: 'group' },
    h('div.grade-pct', { 'aria-hidden': 'true' }, pct + '%'),
    h('div.grade-score', null, `${correct} / ${total}`),
    h('div.grade-msg', null, cn(caption)));
}

// --------------------------------------------------------- live region (§8)

let liveStatus = null;
let liveAlert = null;
function ensureLive() {
  if (liveStatus) return;
  liveStatus = h('div.sr-only', { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' });
  liveAlert = h('div.sr-only', { role: 'alert', 'aria-live': 'assertive', 'aria-atomic': 'true' });
  document.body.append(liveStatus, liveAlert);
}
/** Announce a message to screen readers without stealing focus. */
export function announce(msg, assertive) {
  ensureLive();
  const region = assertive ? liveAlert : liveStatus;
  region.textContent = '';
  setTimeout(() => { region.textContent = String(msg); }, 30);
}

// A brief, non-modal, non-blocking status pill (v1.03 update feedback). Visual
// only (aria-hidden); the message is also announced via the live region.
let toastEl = null;
let toastTimer = null;
export function toast(msg, ms = 3400) {
  announce(msg);
  if (!toastEl) { toastEl = h('div.toast', { 'aria-hidden': 'true' }); document.body.append(toastEl); }
  clear(toastEl);
  toastEl.append(cn(msg));
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.classList.remove('show'); }, ms);
}

// --------------------------------------------------- accessible dialog (§8)

const dialogStack = [];

/** Close every open dialog. Called on route change so a modal never survives a
 *  navigation and blocks a different screen. */
export function closeAllDialogs() { while (dialogStack.length) dialogStack[dialogStack.length - 1].close('route'); }

/**
 * A reusable accessible modal. role="dialog", aria-modal, labelled title,
 * initial focus, focus trap, Escape-to-cancel, inert/aria-hidden background,
 * focus restoration, and automatic route cleanup.
 *
 * actions: [{ label, variant, onClick, grow, keepOpen, reason, ariaLabel }]
 */
export function openDialog({ title, body, actions = [], onClose } = {}) {
  const prevFocus = document.activeElement;
  const titleId = 'dlg-title-' + Math.random().toString(36).slice(2, 8);

  const bg = [document.getElementById('app'), document.getElementById('tabwarn')].filter(Boolean);
  const setInert = (on) => bg.forEach((n) => {
    if (on) { n.setAttribute('aria-hidden', 'true'); try { n.inert = true; } catch (e) {} }
    else { n.removeAttribute('aria-hidden'); try { n.inert = false; } catch (e) {} }
  });

  const overlay = h('div.dlg-overlay');
  const panel = h('div.dlg-panel', { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' });
  panel.append(h('div.bar', { id: titleId }, cn(String(title || ''))));
  const bodyWrap = h('div.dlg-body');
  if (typeof body === 'string') bodyWrap.append(h('p.dlg-text', null, cn(body)));
  else if (body) bodyWrap.append(body);
  panel.append(bodyWrap);

  let dlg;
  const close = (reason) => {
    if (!overlay.isConnected) return;
    document.removeEventListener('keydown', onKey, true);
    overlay.remove();
    setInert(false);
    const idx = dialogStack.indexOf(dlg);
    if (idx >= 0) dialogStack.splice(idx, 1);
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
    if (onClose) try { onClose(reason); } catch (e) {}
  };

  const act = h('div.dlg-actions');
  actions.forEach((a) => {
    const b = button(a.label, {
      variant: a.variant || 'thin', ariaLabel: a.ariaLabel,
      onClick: () => { if (a.onClick) a.onClick(); if (!a.keepOpen) close(a.reason || 'action'); },
    });
    if (a.grow !== false) b.classList.add('grow');
    act.append(b);
  });
  if (act.children.length) panel.append(act);

  overlay.append(panel);
  overlay.addEventListener('pointerdown', (ev) => { if (ev.target === overlay) close('backdrop'); });

  const focusables = () => [...panel.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((e) => !e.disabled && e.offsetParent !== null);
  const onKey = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); close('escape'); return; }
    if (ev.key !== 'Tab') return;
    const f = focusables();
    if (!f.length) { ev.preventDefault(); panel.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  };

  setInert(true);
  document.body.append(overlay);
  document.addEventListener('keydown', onKey, true);
  (focusables()[0] || panel).focus();

  dlg = { close, overlay, panel };
  dialogStack.push(dlg);
  return dlg;
}

/** Fisher-Yates, so a deck order is genuinely uniform. */
export function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
