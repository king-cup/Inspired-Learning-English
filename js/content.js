// Remote content mechanics (v1.03). The network + Cache API + validation +
// active/pending-pointer plumbing for remotely published vocabulary. data.js
// orchestrates these into a last-known-good load; screens never touch this
// module directly.
//
// Design guarantees:
//  - The manifest is fetched fresh every time (no-store + cache-buster) and the
//    service worker ignores everything under content/, so a stale manifest can
//    never be served -- that is what lets a new release appear on the FIRST
//    launch after publishing.
//  - Versioned files live in their OWN cache (vd-content-v1), never mixed with
//    the app shell or the audio cache.
//  - A version is written to cache only after BOTH its files parse and validate,
//    and the active pointer is moved only after a whole version is in hand, so a
//    failed update can never corrupt or half-apply a working version.

const CONTENT_CACHE = 'vd-content-v1';
const MANIFEST_URL = 'content/manifest.json';

const ACTIVE_KEY = 'vd.content.active';     // manifest currently loaded / last good
const PENDING_KEY = 'vd.content.pending';   // downloaded, waiting for a safe moment to apply
const LASTCHECK_KEY = 'vd.content.lastCheck';

const MANIFEST_TIMEOUT = 6000;
const DOWNLOAD_TIMEOUT = 15000;
const BUNDLED_TIMEOUT = 8000;

// --------------------------------------------------------------- storage

const readJSON = (key) => {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; }
  catch (e) { return null; }
};
const writeJSON = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
};
const remove = (key) => { try { localStorage.removeItem(key); } catch (e) {} };

export const getActive = () => readJSON(ACTIVE_KEY);
export const setActive = (m) => writeJSON(ACTIVE_KEY, m);
export const getPending = () => readJSON(PENDING_KEY);
export const setPending = (m) => writeJSON(PENDING_KEY, m);
export const clearPending = () => remove(PENDING_KEY);
export const getLastCheck = () => { const v = readJSON(LASTCHECK_KEY); return typeof v === 'number' ? v : 0; };
export const setLastCheck = (ms) => writeJSON(LASTCHECK_KEY, ms);

// --------------------------------------------------------------- helpers

// Resolve content-relative URLs against the document so paths work at the site
// root and inside an installed PWA (scope-relative).
const resolveUrl = (rel) => new URL(rel, document.baseURI).href;

const jsonResponse = (text) => new Response(text, { headers: { 'Content-Type': 'application/json' } });

async function fetchWithTimeout(url, ms, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

// --------------------------------------------------------------- validation

export function validateManifest(m) {
  return !!m && typeof m === 'object' && !Array.isArray(m)
    && m.schemaVersion === 1
    && typeof m.contentVersion === 'string' && m.contentVersion.length > 0
    && typeof m.vocabUrl === 'string' && m.vocabUrl.startsWith('content/')
    && typeof m.audioIndexUrl === 'string' && m.audioIndexUrl.startsWith('content/')
    && typeof m.audioVersion === 'string' && m.audioVersion.length > 0;
}

export function validateVocab(v) {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  if (!Array.isArray(v.types)) return false;
  if (!v.data || typeof v.data !== 'object' || Array.isArray(v.data)) return false;
  let any = false;
  for (const list of Object.values(v.data)) {
    if (!Array.isArray(list)) return false;
    for (const e of list) {
      if (!e || typeof e !== 'object') return false;
      if (typeof e.w !== 'string' || !e.w.trim()) return false;
    }
    if (list.length) any = true;
  }
  return any;
}

export function validateAudioIndex(a) {
  return Array.isArray(a) && a.every((s) => typeof s === 'string');
}

// --------------------------------------------------------------- network / cache

/** Fetch the manifest fresh. Throws on network error, timeout, non-OK, or an
 *  invalid manifest. */
export async function fetchManifest() {
  const url = resolveUrl(MANIFEST_URL) + '?_=' + Date.now();   // defeat any intermediary cache
  const res = await fetchWithTimeout(url, MANIFEST_TIMEOUT, { cache: 'no-store' });
  if (!res.ok) throw new Error('manifest HTTP ' + res.status);
  const m = await res.json();
  if (!validateManifest(m)) throw new Error('manifest failed validation');
  return m;
}

/**
 * Download + validate both files for a manifest and cache them under their
 * version-specific URLs. Atomic: nothing is cached unless BOTH parse and
 * validate. Reuses already-cached files when present. Throws on any failure.
 */
export async function downloadVersion(manifest) {
  const vocabUrl = resolveUrl(manifest.vocabUrl);
  const idxUrl = resolveUrl(manifest.audioIndexUrl);
  const cache = await caches.open(CONTENT_CACHE);

  const get = async (url) => {
    const hit = await cache.match(url);
    if (hit) return { text: await hit.text(), fromCache: true };
    const res = await fetchWithTimeout(url, DOWNLOAD_TIMEOUT, { cache: 'no-cache' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    return { text: await res.text(), fromCache: false };
  };

  const [vg, ig] = await Promise.all([get(vocabUrl), get(idxUrl)]);

  let vocab, index;
  try { vocab = JSON.parse(vg.text); } catch (e) { throw new Error('vocab is not valid JSON'); }
  try { index = JSON.parse(ig.text); } catch (e) { throw new Error('audio-index is not valid JSON'); }
  if (!validateVocab(vocab)) throw new Error('vocab failed validation');
  if (!validateAudioIndex(index)) throw new Error('audio-index failed validation');

  // Cache only after both validated, so a bad file never lands in the cache.
  if (!vg.fromCache) await cache.put(vocabUrl, jsonResponse(vg.text));
  if (!ig.fromCache) await cache.put(idxUrl, jsonResponse(ig.text));
  return { vocab, index };
}

/** Load an already-downloaded version from cache. Returns null if either file
 *  is missing or invalid (so the caller can fall back). Offline path. */
export async function loadFromCache(manifest) {
  try {
    const cache = await caches.open(CONTENT_CACHE);
    const v = await cache.match(resolveUrl(manifest.vocabUrl));
    const i = await cache.match(resolveUrl(manifest.audioIndexUrl));
    if (!v || !i) return null;
    const vocab = JSON.parse(await v.text());
    const index = JSON.parse(await i.text());
    if (!validateVocab(vocab) || !validateAudioIndex(index)) return null;
    return { vocab, index };
  } catch (e) { return null; }
}

/**
 * Audio packs (v1.04) — OPTIONAL and lazy.
 *
 * The index is ~180 KB gzipped, which is not worth adding to every content
 * update for a student who never downloads audio. It is fetched the first time
 * a prefetch actually needs it and then cached alongside the version it belongs
 * to. A publish with no audioPacksUrl, a failed fetch, or a malformed index all
 * degrade to the pre-1.04 behaviour of fetching clips one at a time.
 */
export function validatePacks(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
  if (!p.packs || typeof p.packs !== 'object' || Array.isArray(p.packs)) return false;
  for (const k of Object.keys(p.packs)) {
    const e = p.packs[k];
    if (!e || typeof e !== 'object') return false;
    if (typeof e.url !== 'string' || !e.url.startsWith('audio/')) return false;
    if (!e.clips || typeof e.clips !== 'object') return false;
  }
  return true;
}

export async function loadPacks(manifest) {
  const rel = manifest && manifest.audioPacksUrl;
  if (typeof rel !== 'string' || !rel.startsWith('content/')) return null;
  const url = resolveUrl(rel);
  try {
    const cache = await caches.open(CONTENT_CACHE);
    const hit = await cache.match(url);
    if (hit) {
      const p = JSON.parse(await hit.text());
      return validatePacks(p) ? p : null;
    }
    const res = await fetchWithTimeout(url, DOWNLOAD_TIMEOUT, { cache: 'no-cache' });
    if (!res.ok) return null;
    const text = await res.text();
    const p = JSON.parse(text);
    if (!validatePacks(p)) return null;
    await cache.put(url, jsonResponse(text));
    return p;
  } catch (e) { return null; }
}

/** Bundled root files — the emergency fallback for a device that has never
 *  successfully fetched remote content. Served from the shell cache offline. */
export async function loadBundled() {
  const [vres, ires] = await Promise.all([
    fetchWithTimeout('vocab.json', BUNDLED_TIMEOUT, { cache: 'no-cache' }),
    fetchWithTimeout('audio-index.json', BUNDLED_TIMEOUT, { cache: 'no-cache' }).catch(() => null),
  ]);
  if (!vres || !vres.ok) throw new Error('bundled vocab.json unavailable');
  const vocab = await vres.json();
  if (!validateVocab(vocab)) throw new Error('bundled vocab.json invalid');
  let index = [];
  try { if (ires && ires.ok) index = await ires.json(); } catch (e) { index = []; }
  if (!validateAudioIndex(index)) index = [];
  return { vocab, index };
}

/** Drop cached content that no longer belongs to the active or pending version,
 *  so old releases do not accumulate. Never touches the version currently in
 *  use. Best-effort; failures are ignored. */
export async function pruneOldVersions(keepManifests) {
  try {
    const keep = new Set();
    for (const m of keepManifests) {
      if (!m) continue;
      keep.add(resolveUrl(m.vocabUrl));
      keep.add(resolveUrl(m.audioIndexUrl));
      if (typeof m.audioPacksUrl === 'string') keep.add(resolveUrl(m.audioPacksUrl));
    }
    const cache = await caches.open(CONTENT_CACHE);
    for (const req of await cache.keys()) {
      if (!keep.has(req.url)) await cache.delete(req);
    }
  } catch (e) {}
}
