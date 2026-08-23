// Word lists + remote-content orchestration (v1.03).
//
// The in-memory repository API (types/wordsFor/resolve/slug/...) is unchanged so
// screens are untouched. What changed is WHERE the bundle comes from: instead of
// always fetching the root vocab.json, load() now runs a last-known-good loader
// over remotely published, versioned content (see js/content.js), and only falls
// back to the bundled root files as an emergency.
//
// vocab.json shape (unchanged):
//   { types:[{type,groupLabel,groups:[{name,units:[{id,label}]}]}],
//     data:{ unitId: [{w,p,c,e,s,a}] } }

import * as C from './content.js';

export const APP_VERSION = '1.04';

let bundle = { types: [], data: {} };
let cleanTypes = [];
let clipSlugs = new Set();
let audioVer = '1';
let activeManifest = null;
let packIndex = null;         // lazily loaded; null = not loaded or unavailable
let packPromise = null;
let lastStatus = { activeVersion: null, installedNew: false, usedBundled: false, updateFailed: false, updateAvailable: false, appliedPending: false };

/**
 * Display order (6.3), imposed HERE in the client rather than by editing the
 * drill board's BUNDLE. Books run easiest first; anything not listed sorts to
 * the end in its original order (Array.prototype.sort is stable).
 */
const TYPE_ORDER = ['Book Units', 'HSE Packages'];
const GROUP_ORDER = [
  'Prepare Level 1', 'Prepare Level 2', 'Prepare Level 3', 'Prepare Level 4',
  'Prepare Level 5',
  'Unlock 3', 'Unlock 4', 'Openworld FCE',
  'Reading Explorer Foundations', 'Reading Explorer 1',
  'Reading Explorer 2', 'Reading Explorer 3',
];
const rank = (order, name) => { const i = order.indexOf(name); return i < 0 ? order.length : i; };

/**
 * Audio filename stem. MUST stay byte-identical to Speaker.slug() in the Android
 * app and slug() in tools/*.py, or a word silently loses its clip.
 */
export const slug = (word) =>
  String(word).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'x';

// audioVersion (§6): a query on every audio URL so replacing a clip at the same
// path forces a re-download past the year-long immutable cache. Version "1" adds
// NO query, so students upgrading from v1.02 keep their already-cached clips
// instead of re-downloading 24 MB. Only a real audio replacement bumps this.
export const audioSuffix = () => (audioVer && audioVer !== '1') ? ('?v=' + audioVer) : '';
export const audioUrl = (word) => 'audio/' + slug(word) + '.m4a' + audioSuffix();
export const audioVersion = () => audioVer;

function buildCleanTypes(b) {
  return (b.types || []).map((t) => ({
    ...t,
    groups: (t.groups || []).map((g) => ({
      ...g,
      units: (g.units || []).filter((u) => (b.data[u.id] || []).length > 0),
    })).filter((g) => g.units.length > 0)
      .sort((a, b2) => rank(GROUP_ORDER, a.name) - rank(GROUP_ORDER, b2.name)),
  })).filter((t) => t.groups.length > 0)
    .sort((a, b2) => rank(TYPE_ORDER, a.type) - rank(TYPE_ORDER, b2.type));
}

/** Swap the in-memory content. The ONLY place bundle/clipSlugs/audioVer change. */
function applyBundle(vocab, index, manifest) {
  bundle = vocab && typeof vocab === 'object' ? vocab : { types: [], data: {} };
  clipSlugs = new Set(index || []);
  audioVer = (manifest && typeof manifest.audioVersion === 'string' && manifest.audioVersion) ? manifest.audioVersion : '1';
  cleanTypes = buildCleanTypes(bundle);
  // Packs belong to one published version. Swapping content invalidates them,
  // and slicing a pack built for different audio would produce silence.
  activeManifest = manifest || null;
  packIndex = null;
  packPromise = null;
}

/**
 * The audio pack index for the ACTIVE version, or null if this publish has no
 * packs / they could not be fetched. Loaded once, on first use.
 */
export function audioPacks() {
  if (packIndex) return Promise.resolve(packIndex);
  if (!activeManifest || !activeManifest.audioPacksUrl) return Promise.resolve(null);
  if (!packPromise) {
    packPromise = C.loadPacks(activeManifest).then((p) => {
      // A pack set built against different audio would slice to the wrong
      // bytes. Refuse it rather than cache silence under every clip URL.
      if (p && String(p.audioVersion || '1') !== String(audioVer)) {
        console.warn('audio packs are for audioVersion', p.audioVersion, 'but content is', audioVer);
        return null;
      }
      packIndex = p;
      return p;
    }).catch(() => null);
  }
  return packPromise;
}

// --------------------------------------------------------------- loading

/**
 * Last-known-good content load (v1.03 §2). Runs at startup. Returns repository
 * counts plus a status object for the UI:
 *   activeVersion, installedNew, usedBundled, updateFailed, updateAvailable,
 *   appliedPending.
 */
export async function load() {
  const status = { activeVersion: null, installedNew: false, usedBundled: false, updateFailed: false, updateAvailable: false, appliedPending: false };

  // 0. Promote a version downloaded during a previous session -- but only if its
  //    files are genuinely still cached and valid.
  const pending = C.getPending();
  if (pending) {
    const ok = await C.loadFromCache(pending);
    if (ok) { C.setActive(pending); status.appliedPending = true; }
    C.clearPending();
  }

  let active = C.getActive();
  let loaded = null;

  // 1-8. fresh manifest, then download the new version if there is one.
  let fresh = null;
  try { fresh = await C.fetchManifest(); }
  catch (e) { console.warn('[content] manifest check failed:', e && e.message); }

  if (fresh) {
    C.setLastCheck(Date.now());
    if (!active || fresh.contentVersion !== active.contentVersion) {
      status.updateAvailable = true;
      try {
        const dl = await C.downloadVersion(fresh);   // validated + cached, atomic
        C.setActive(fresh);                           // 7. commit pointer AFTER success
        active = fresh;
        loaded = { ...dl, manifest: fresh };
        status.installedNew = true;
      } catch (e) {
        // 9/11. a failed update never disturbs the working version.
        console.warn('[content] update failed, keeping last good:', e && e.message);
        status.updateFailed = true;
      }
    }
  }

  // 9. load the (retained) active version from cache.
  if (!loaded && active) {
    const cached = await C.loadFromCache(active);
    if (cached) loaded = { ...cached, manifest: active };
    else console.warn('[content] active version missing from cache; falling back to bundled');
  }

  // 10. bundled emergency fallback.
  if (!loaded) {
    const b = await C.loadBundled();   // throws only if even the bundle is gone
    loaded = { ...b, manifest: null };
    status.usedBundled = true;
  }

  applyBundle(loaded.vocab, loaded.index, loaded.manifest);
  status.activeVersion = loaded.manifest ? loaded.manifest.contentVersion : null;
  lastStatus = status;
  C.pruneOldVersions([C.getActive(), C.getPending()]);
  return { units: totalUnits(), words: totalWords(), clips: clipSlugs.size, ...status };
}

/**
 * Check for a newer version (§4). Called on foreground and from Settings.
 *   apply=true  -> if safe (no active session), swap the in-memory bundle now.
 *   apply=false -> download it and store as pending for the next safe moment.
 * Returns { ok, upToDate, updated, appliedNow, reason }.
 */
export async function checkForUpdate({ apply = false } = {}) {
  const result = { ok: false, upToDate: false, updated: false, appliedNow: false, reason: null };
  let fresh;
  try { fresh = await C.fetchManifest(); }
  catch (e) { console.warn('[content] check failed:', e && e.message); result.reason = 'network'; return result; }
  C.setLastCheck(Date.now());
  result.ok = true;

  const active = C.getActive();
  const pending = C.getPending();
  const haveIt = (active && active.contentVersion === fresh.contentVersion)
    || (pending && pending.contentVersion === fresh.contentVersion);

  if (active && active.contentVersion === fresh.contentVersion && !pending) {
    result.upToDate = true;
    return result;
  }

  try {
    if (!haveIt) await C.downloadVersion(fresh);   // validated + cached
    if (apply) {
      const cached = await C.loadFromCache(fresh);
      if (!cached) { result.reason = 'download'; return result; }
      C.setActive(fresh); C.clearPending();
      applyBundle(cached.vocab, cached.index, fresh);
      lastStatus = { ...lastStatus, activeVersion: fresh.contentVersion, installedNew: true, updateFailed: false };
      C.pruneOldVersions([C.getActive(), null]);
      result.updated = true; result.appliedNow = true;
    } else {
      C.setPending(fresh);
      result.updated = true; result.appliedNow = false;
    }
    return result;
  } catch (e) {
    console.warn('[content] update download failed:', e && e.message);
    result.reason = 'download';
    return result;
  }
}

/** Apply a pending version if one is ready. Called on a safe navigation so a
 *  version downloaded mid-session is applied without interrupting it. Returns
 *  true if the in-memory bundle changed. */
export async function applyPendingIfReady() {
  const pending = C.getPending();
  if (!pending) return false;
  const cached = await C.loadFromCache(pending);
  if (!cached) { C.clearPending(); return false; }
  C.setActive(pending); C.clearPending();
  applyBundle(cached.vocab, cached.index, pending);
  lastStatus = { ...lastStatus, activeVersion: pending.contentVersion, installedNew: true };
  C.pruneOldVersions([C.getActive(), null]);
  return true;
}

export const hasPending = () => !!C.getPending();
export const activeVersion = () => { const a = C.getActive(); return a ? a.contentVersion : (lastStatus.activeVersion || null); };
export const lastCheck = () => C.getLastCheck();
export const contentStatus = () => ({ ...lastStatus });

// --------------------------------------------------------------- repository

export const types = () => cleanTypes;
export const wordsFor = (unitId) => bundle.data[unitId] || [];
export const hasClip = (word) => clipSlugs.has(slug(word));
export const clipCount = () => clipSlugs.size;

export function resolve(unitId) {
  for (const t of cleanTypes) {
    for (const g of t.groups) {
      for (const u of g.units) {
        if (u.id === unitId) {
          return { id: u.id, label: u.label, groupName: g.name, typeName: t.type, words: wordsFor(unitId) };
        }
      }
    }
  }
  const words = wordsFor(unitId);
  return words.length ? { id: unitId, label: unitId, groupName: '', typeName: '', words } : null;
}

export const totalWords = () => Object.values(bundle.data || {}).reduce((n, v) => n + v.length, 0);
export const totalUnits = () => cleanTypes.reduce((n, t) => n + t.groups.reduce((m, g) => m + g.units.length, 0), 0);

/** Every distinct clip URL a unit needs, for the per-unit prefetch. */
export function clipUrlsFor(unitId) {
  const seen = new Set();
  for (const e of wordsFor(unitId)) {
    const s = slug(e.w);
    if (clipSlugs.has(s)) seen.add('audio/' + s + '.m4a' + audioSuffix());
  }
  return [...seen];
}

/** slug -> clip URL, so the pack slicer can file each slice where the player
 *  will look for it. Keeping this in one place is what lets packs stay entirely
 *  invisible to the playback path. */
export const urlForSlug = (s) => 'audio/' + s + '.m4a' + audioSuffix();

export function allClipUrls() {
  return [...clipSlugs].map((s) => 'audio/' + s + '.m4a' + audioSuffix());
}

/** Boot assert: catches a new unit whose words have no generated clips. */
export function auditClips() {
  let missing = 0;
  for (const list of Object.values(bundle.data || {})) {
    for (const e of list) if (!clipSlugs.has(slug(e.w))) missing++;
  }
  return missing;
}
