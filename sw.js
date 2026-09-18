/* Service worker: the app shell only.
 *
 * Audio is deliberately NOT handled here. js/audio.js talks to the Cache API
 * directly, which means (a) Safari's Range requests for media never reach a
 * worker that would mishandle them, (b) audio caching keeps working after
 * Safari has put this worker to sleep, and (c) a broken registration degrades
 * pronunciation to a plain network fetch instead of breaking it.
 */

// Bumped v4 -> v5 for the v1.03 release (remote content publishing). The root
// vocab.json / audio-index.json stay in the shell as EMERGENCY offline fallback
// only -- the live vocabulary now comes from content/ (see js/content.js), which
// this worker deliberately does not touch. js/content.js is added below.
// v6: v1.03.1 adds the shared update bar (app-code + vocabulary).
// v7: additional reading vocabulary + Prepare Level 5 added to GROUP_ORDER.
// v8: v1.04 audio packs. audio/packs/*.pack is NOT precached and NOT handled
//     here -- like every other clip, packs are fetched by js/audio.js straight
//     into vd-audio-v1, for the Range-request reason at the top of this file.
// v9: v1.05 adds the grade-based cloze passage reader and its offline corpus.
// v10: v1.07 renames Inspired English and adds the product hub + motion system.
// v11: stable headers/navigation, refreshed cloze sources, HSE advanced practice.
// v12: full 608-passage cloze bank, flash-free cloze routes, HSE Packages 7–8.
// v13: v1.09 reading library, middle-school sections, and Memory Palace.
const SHELL = 'vd-shell-v18-preview'; // Non-production 1.10.2 checkpoint.

const PRECACHE = [
  './',
  'index.html',
  'app.css',
  'reader.css',
  'js/random-pool.js',
  'js/release-notes.js',
  'js/release-policy.js',
  'manifest.webmanifest',
  'vocab.json',           // emergency fallback only; live content is under content/
  'audio-index.json',     // emergency fallback only
  'cloze.json',
  'advanced-practice.json',
  'reading-content.json',
  'reading-figures/re3-12b-missions-1.jpg',
  'reading-figures/re3-12b-missions-2.jpg',
  'reading-figures/re5-5a-traveler.jpg',
  'reading-audio-manifest.json',
  'middle-school.json',
  'passage-glossary.json',
  'js/passage.js',
  'js/screens/tutorial.js',
  'js/main.js',
  'js/motion.js',
  'js/data.js',
  'js/content.js',
  'js/updates.js',
  'js/store.js',
  'js/cloze-data.js',
  'js/advanced-data.js',
  'js/cloze-store.js',
  'js/curriculum-data.js',
  'js/curriculum-store.js',
  'js/ui.js',
  'js/audio.js',
  'js/learn-engine.js',
  'js/activity.js',
  'js/guided-plan.js',
  'js/i18n.js',
  'js/profile.js',
  'js/theme.js',
  'js/screens/library.js',
  'js/screens/home.js',
  'js/screens/reading-library.js',
  'js/screens/reading-article.js',
  'js/screens/middle-school.js',
  'js/screens/high-school.js',
  'js/screens/memory.js',
  'js/screens/unit.js',
  'js/screens/study.js',
  'js/screens/cards.js',
  'js/screens/learn.js',
  'js/screens/guided.js',
  'js/screens/advanced.js',
  'js/screens/test.js',
  'js/screens/onboarding.js',
  'js/screens/settings.js',
  'js/screens/cloze-library.js',
  'js/screens/cloze.js',
  'icons/icon-180-inspire.png',
  'icons/icon-192-inspire.png',
  'icons/icon-512-inspire.png',
  'icons/icon-512-maskable-inspire.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(SHELL).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil((async () => {
    const names = await caches.keys();
    // Only shell caches are pruned. vd-audio-v1 is never versioned with the
    // shell, because a code update must not throw away clips the student has
    // already downloaded.
    await Promise.all(names.filter((n) => n.startsWith('vd-shell-') && n !== SHELL).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', (ev) => {
  if (ev.data && ev.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Hands off: the page owns the audio cache.
  if (url.pathname.includes('/audio/')) return;
  if (url.pathname.endsWith('/release-policy.json')) return;
  // Hands off: js/content.js owns remote-content caching. Passing these straight
  // to the network means the manifest is never served from a stale worker cache
  // -- that is what lets a new release appear on the FIRST launch after publish
  // (§3). Versioned content files are immutable and cached by the loader itself.
  if (url.pathname.includes('/content/')) return;

  // Documents: network-first with a short timeout, so a deployed fix reaches
  // students on the next launch rather than whenever the cache happens to turn over.
  if (req.mode === 'navigate') {
    ev.respondWith((async () => {
      try {
        const fresh = await withTimeout(fetch(req), 3000);
        const cache = await caches.open(SHELL);
        cache.put('index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache = await caches.open(SHELL);
        return (await cache.match('index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Everything else: stale-while-revalidate. Instant from cache, refreshed behind.
  ev.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(req);
    const net = fetch(req).then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}
