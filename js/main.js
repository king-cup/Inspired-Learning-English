// Boot, routing, and the install nag.

import * as D from './data.js';
import * as S from './store.js';
import * as A from './audio.js';
import * as P from './profile.js';
import * as CS from './cloze-store.js';
import * as i18n from './i18n.js';
import { applyTheme } from './theme.js';
import * as library from './screens/library.js';
import * as unit from './screens/unit.js';
import * as study from './screens/study.js';
import * as cards from './screens/cards.js';
import * as learn from './screens/learn.js';
import * as advanced from './screens/advanced.js';
import * as test from './screens/test.js';
import * as settings from './screens/settings.js';
import * as onboarding from './screens/onboarding.js';
import * as clozeLibrary from './screens/cloze-library.js';
import * as cloze from './screens/cloze.js';
import * as home from './screens/home.js';
import * as motion from './motion.js';
import { runUpdateCheck, showVocabUpdateBar } from './updates.js';
import { h, clear, cn, button, closeAllDialogs, showUpdateBar as showBar, hideUpdateBar } from './ui.js';

// Only look for new vocabulary on foreground if it has been a while, so
// re-focusing the app does not hammer the network.
const FOREGROUND_CHECK_INTERVAL = 15 * 60 * 1000;

const root = document.getElementById('app');
let teardown = null;

/** Keep the document language in sync with the chosen UI language (§8), so
 *  assistive tech announces Chinese content in Chinese. */
function syncHtmlLang() { document.documentElement.setAttribute('lang', i18n.htmlLang()); }

// The iOS share glyph, as an inline SVG element (matches #tabwarn svg in CSS).
function shareGlyph() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 3l4 4h-3v9h-2V7H8l4-4zM5 14v6h14v-6h2v8H3v-8h2z');
  svg.appendChild(path);
  return svg;
}

// The tab-storage warning, rendered in the student's chosen language (6.4 was
// UI-only; Peter asked for this PWA-only banner to follow the choice too).
// index.html carries an English copy as the pre-JS fallback; this replaces it.
function renderTabWarn() {
  const el = document.getElementById('tabwarn');
  if (!el) return;
  clear(el);
  el.append(h('div.tabwarn-in', null,
    h('b', null, cn(i18n.t('install.title'))),
    h('p', null, cn(i18n.t('install.lead')), h('strong', null, cn(i18n.t('install.bold'))), cn(i18n.t('install.tail'))),
    h('p.steps', null,
      h('span', { 'aria-hidden': 'true' }, '1'), ' ', cn(i18n.t('install.step1')), ' ', shareGlyph(),
      '  ·  ',
      h('span', { 'aria-hidden': 'true' }, '2'), ' ', cn(i18n.t('install.step2'))),
    h('p.fine', null, cn(i18n.t('install.fine')))));
}

// Installed home-screen app, or a browser tab? It decides whether the storage
// warning shows, and iOS keeps SEPARATE storage for the two, so a student who
// practises in a tab and then installs will find an empty app.
const isStandalone = () =>
  window.navigator.standalone === true ||
  (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

function afterRoute() {
  // Move focus to the top of the new screen so screen readers announce it and
  // keyboard users start at the beginning (§8). Programmatic focus does not
  // trigger the :focus-visible ring for pointer users.
  try { root.focus({ preventScroll: false }); } catch (e) {}
  motion.enhancePage(root);
}

async function route() {
  // Route cleanup (§9): tear down the previous screen, close any open dialog,
  // and stop audio so nothing survives the navigation.
  if (teardown) { try { teardown(); } catch (e) {} teardown = null; }
  closeAllDialogs();
  A.stop();

  // Shown exactly once. Until it is done, nothing else can render -- every
  // other screen depends on the name and language it collects.
  if (!P.get().onboarded) {
    onboarding.render(root, (name, lang) => {
      P.completeOnboarding(name, lang);
      i18n.use(lang);
      syncHtmlLang();
      if (location.hash && location.hash !== '#/') location.hash = '#/';
      else route();
    });
    motion.enhancePage(root);
    return;
  }

  const hash = location.hash || '#/';
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  // Apply a vocabulary version that finished downloading during a session, now
  // that we are navigating to a NON-session screen (§4). Never mid-session.
  const goingToSession = parts[0] === 'u' && parts[1]
    && (parts[2] === 'cards' || parts[2] === 'practice' || parts[2] === 'learn'
      || parts[2] === 'advanced' || parts[2] === 'test');
  if (D.hasPending()) {
    if (goingToSession) {
      // Can't swap under a live session: leave the bar up so the student knows
      // new words are waiting and can reload if they want them now.
      showVocabUpdateBar();
    } else {
      try { await D.applyPendingIfReady(); } catch (e) {}
      hideUpdateBar();
    }
  }

  if (parts[0] === 'settings') { settings.render(root); afterRoute(); return; }

  if (parts[0] === 'vocab') { library.render(root); afterRoute(); return; }

  if (parts[0] === 'cloze') {
    if (parts[1] === 'study' && parts[2] && !parts[3]) {
      await clozeLibrary.renderStudyList(root, parts[2]); afterRoute(); return;
    }
    if ((parts[1] === 'study' || parts[1] === 'test') && parts[2] && parts[3]) {
      await cloze.render(root, parts[1], parts[2], decodeURIComponent(parts[3])); afterRoute(); return;
    }
    await clozeLibrary.renderLanding(root, parts[1]); afterRoute(); return;
  }

  if (parts[0] === 'u' && parts[1]) {
    const id = decodeURIComponent(parts[1]);
    const mode = parts[2];
    if (mode === 'study') { teardown = study.teardown; study.render(root, id); afterRoute(); return; }
    if (mode === 'cards') { teardown = cards.teardown; cards.render(root, id, null); afterRoute(); return; }
    if (mode === 'practice' || mode === 'learn') { learn.render(root, id); afterRoute(); return; }
    if (mode === 'advanced') { await advanced.render(root, id); afterRoute(); return; }
    if (mode === 'test') { test.render(root, id); afterRoute(); return; }
    unit.render(root, id); afterRoute(); return;
  }
  home.render(root); afterRoute();
}

let started = false;

function showLoadError(err) {
  // Technical detail to the console only (§9); a plain-language, retryable panel
  // to the student.
  console.error('[vocab-drill] could not load vocab.json:', err);
  clear(root);
  const panel = h('div.centre', null, h('div', { style: { maxWidth: '460px' } },
    h('div.k-13', { style: { textAlign: 'center' } }, i18n.t('error.loadTitle')),
    h('div', { style: { fontFamily: 'var(--serif)', fontSize: '15px', lineHeight: '1.5', marginTop: '12px', textAlign: 'center' } }, i18n.t('error.loadBody')),
    h('div', { style: { marginTop: '16px' } }, button(i18n.t('common.retry'), { variant: 'ruled', size: 'lg', wide: true, onClick: tryLoad }))));
  root.append(panel);
}

async function tryLoad() {
  clear(root);
  try {
    const stats = await D.load();
    const missing = D.auditClips();
    console.log(`[vocab-drill] ${stats.units} units · ${stats.words} words · ${stats.clips} clips`);
    if (missing) console.warn(`[vocab-drill] ${missing} words have no audio clip`);
    const untranslated = i18n.missingTranslations();
    if (untranslated.length) console.warn('[vocab-drill] untranslated keys:', untranslated.sort());
  } catch (err) {
    showLoadError(err);
    return;
  }
  proceed();
}

function proceed() {
  if (started) { route(); return; }
  started = true;
  window.addEventListener('hashchange', route);
  route();

  // Foreground vocabulary check (§4): when the installed app comes back after a
  // while, look for a new release. Quiet unless something changed, and never
  // interrupts an active session (updates.js applies it on the next navigation).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (Date.now() - D.lastCheck() < FOREGROUND_CHECK_INTERVAL) return;
    runUpdateCheck({ manual: false, onApplied: () => route() });
  });

  registerServiceWorker();
}

async function boot() {
  P.init();
  i18n.use(P.get().lang);
  syncHtmlLang();
  applyTheme(P.get().inverted);
  S.init();
  CS.init();
  A.init();

  // Keep the global language in sync, update <html lang>, and re-localise the
  // install banner (outside #app, so screen re-renders do not touch it).
  P.subscribe((p) => { i18n.use(p.lang); syncHtmlLang(); if (!isStandalone()) renderTabWarn(); });

  if (isStandalone()) document.body.classList.add('standalone');
  else { renderTabWarn(); document.getElementById('tabwarn').hidden = false; }

  tryLoad();
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('sw.js');
      // An installed app can run for weeks without a cold start, so check for a
      // new version whenever it comes back to the foreground.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          // Never skipWaiting unprompted: it can swap modules mid-Practice.
          if (sw.state === 'installed' && navigator.serviceWorker.controller) showAppUpdateBar(sw);
        });
      });
    } catch (err) {
      console.warn('[vocab-drill] service worker not registered:', err);
    }
  }
}

/** New app CODE is waiting in the service worker. */
function showAppUpdateBar(sw) {
  showBar({
    kind: 'app',
    message: i18n.t('update.appReady'),
    actionLabel: i18n.t('update.reload'),
    onAction: () => { sw.postMessage({ type: 'SKIP_WAITING' }); },
  });
  navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
}

boot();
