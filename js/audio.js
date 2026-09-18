// Pronunciation. Port of audio/Speaker.kt, rebuilt around three iOS realities.
//
// 1. Audio needs a user gesture -- but iOS unlocks the ELEMENT, not the call
//    site. One <audio> for the app's life, played once inside a real gesture at
//    boot, and every later play() works even after an await.
//
// 2. <audio src="http..."> makes Safari open the file with Range: bytes=0-1.
//    A service worker answering that from Cache Storage with a full 200 stalls
//    or fails silently. So clips are never fetched by the element: we fetch()
//    them (no Range header), cache them, and hand the element a blob URL. The
//    service worker therefore has no responsibility for audio at all.
//
// 3. speechSynthesis needs a LIVE gesture and is unreliable in standalone mode.
//    It is the last resort, reached only when a word has no clip. The decision
//    is made synchronously from an in-memory Set so the gesture is not spent.

import { hasClip, audioUrl, audioPacks, urlForSlug, audioSuffix } from './data.js';
import * as Activity from './activity.js';

const CACHE = 'vd-audio-v1';
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const MAX_URLS = 60;

export const Status = { STARTING: 'STARTING', CLIP: 'CLIP', VOICE: 'DEVICE VOICE', SILENT: 'SILENT' };

let el = null;
let unlocked = false;
let status = Status.STARTING;
let loaded = null;
export const loadedUrl = () => loaded;
const objectUrls = new Map();   // request url -> object url (insertion-ordered LRU)
const statusListeners = new Set();

export const getStatus = () => status;
export const onStatus = (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); };
function setStatus(s) {
  if (s === status) return;
  status = s;
  statusListeners.forEach((fn) => { try { fn(s); } catch (e) { console.error(e); } });
}

export function init() {
  el = document.getElementById('clip');
  armUnlock();
  primeVoices();
  // An installed app can run for weeks without a cold start; an audio-session
  // interruption (a call, another app) can drop the unlock, so re-arm it.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (!unlocked) armUnlock();
      try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
    }
  });
}

function armUnlock() {
  const go = () => {
    if (unlocked || !el) return;
    try {
      el.src = SILENT_WAV;
      const p = el.play();
      if (p && p.then) p.then(() => { el.pause(); unlocked = true; }).catch(() => {});
      else { el.pause(); unlocked = true; }
    } catch (e) { /* it will re-arm on the next gesture */ }
  };
  document.addEventListener('pointerdown', go, { capture: true, once: true });
  document.addEventListener('touchstart', go, { capture: true, once: true });
}

function primeVoices() {
  if (!('speechSynthesis' in window)) return;
  try {
    speechSynthesis.getVoices();
    speechSynthesis.addEventListener?.('voiceschanged', () => speechSynthesis.getVoices(), { once: true });
  } catch (e) {}
}

// Delegates to data.audioUrl so the cache key carries the active audioVersion
// (§6) and matches the URLs used by prefetch / cachedCount / clip counts.
export const urlFor = (word) => audioUrl(word);

/**
 * Say a word. Call this DIRECTLY from a click/pointer handler -- do not await
 * anything before it, or the speechSynthesis branch loses its gesture.
 */
export function speak(word) {
  Activity.record('word-audio-requested', { word });
  const clean = String(word || '').trim();
  if (!clean) return;

  // Synchronous decision, so the gesture survives the branch we might need it for.
  if (!hasClip(clean)) { speakWithVoice(clean); return; }

  playClip(urlFor(clean)).then((ok) => {
    if (ok) setStatus(Status.CLIP);
    else speakWithVoice(clean);
  });
}

async function playClip(url) {
  if (!el) return false;
  try {
    const cache = await caches.open(CACHE);
    let res = await cache.match(url);
    if (!res) {
      // fetch() sends no Range header, so this comes back as a clean 200.
      res = await fetch(url, { cache: 'force-cache' });
      if (!res.ok) return false;
      try { await cache.put(url, res.clone()); } catch (e) { /* quota; still playable */ }
    }
    el.src = await blobUrl(url, res);
    loaded = url;
    el.currentTime = 0;
    await el.play();
    return true;
  } catch (err) {
    return false;
  }
}

async function blobUrl(key, res) {
  const cached = objectUrls.get(key);
  if (cached) return cached;
  // Force the MIME type rather than trusting the server's. Some hosts label
  // .m4a as audio/mp4a-latm (a different, LATM-framed format) and Safari will
  // refuse a blob typed that way. The bytes are AAC-LC in MP4 either way.
  const bytes = await res.arrayBuffer();
  const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mp4' }));
  objectUrls.set(key, url);
  while (objectUrls.size > MAX_URLS) {
    const oldest = objectUrls.keys().next().value;
    URL.revokeObjectURL(objectUrls.get(oldest));
    objectUrls.delete(oldest);
  }
  return url;
}

function speakWithVoice(word) {
  if (!('speechSynthesis' in window)) { setStatus(Status.SILENT); return; }
  try {
    speechSynthesis.cancel();            // clears the post-background queue jam
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.9;
    speechSynthesis.speak(u);
    setStatus(Status.VOICE);
  } catch (err) {
    setStatus(Status.SILENT);
  }
}

export function stop() {
  try { el && el.pause(); } catch (e) {}
  try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
}

/** Load a long-form bundled track through the same Safari-safe fetch → blob
 * path as pronunciation. It never autoplays and shares the app's one unlocked
 * audio element. */
export async function loadTrack(url, position = 0) {
  if (!el) throw new Error('audio element unavailable');
  const cache = await caches.open(CACHE);
  let response = await cache.match(url);
  if (!response) {
    response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`audio HTTP ${response.status}`);
    try { await cache.put(url, response.clone()); } catch (e) {}
  }
  el.src = await blobUrl(url, response);
  loaded = url;
  el.currentTime = Math.max(0, Number(position) || 0);
  return el;
}

export const element = () => el;

// ------------------------------------------------------------- prefetching

/** Which of these URLs are already on the device. */
export async function cachedCount(urls) {
  try {
    const cache = await caches.open(CACHE);
    let n = 0;
    for (const u of urls) if (await cache.match(u)) n++;
    return n;
  } catch (e) { return 0; }
}

/**
 * Warm the cache. Fire-and-forget for a unit (median 106 KB), or awaited with
 * onProgress for the explicit "download everything" button.
 */
/**
 * Work out which packs to fetch for a set of wanted slugs.
 *
 * Greedy set cover: take the pack that covers the most still-wanted clips, and
 * on a tie take the SMALLER one. That one tiebreak is what makes this do the
 * right thing at both ends without a special case — asking for one unit picks
 * that unit's 120 KB pack rather than its book's 4 MB one (both cover it
 * fully), while asking for a whole book picks the book pack (it covers far
 * more than any single unit pack).
 *
 * A pack is only worth a request if it brings several clips; below that the
 * individual files are cheaper than the bytes we would waste.
 */
const MIN_PACK_GAIN = 3;

/**
 * A pack is only worth its bytes if most of what it carries is wanted.
 * Without this, three stray new words scattered across three units of one book
 * would pull that book's 2.6 MB pack for ~15 KB of audio. ~10x the average
 * 5.7 KB clip; a healthy unit or book request runs about 4 KB per new clip, so
 * this never fires on a real request -- only on the pathological tail.
 */
const MAX_BYTES_PER_NEW_CLIP = 60000;

/** slug -> pack ids, built once per pack index. Without it the greedy loop
 *  rescans every pack's clip list every round: ~900ms to plan a full download
 *  on a laptop, and that is main-thread time on a student's phone. */
const revMaps = new WeakMap();
function reverseMap(packIndex) {
  let m = revMaps.get(packIndex);
  if (m) return m;
  m = new Map();
  for (const id of Object.keys(packIndex.packs || {})) {
    for (const sl of Object.keys(packIndex.packs[id].clips)) {
      const a = m.get(sl);
      if (a) a.push(id); else m.set(sl, [id]);
    }
  }
  revMaps.set(packIndex, m);
  return m;
}

function planPacks(packIndex, wantedSlugs) {
  const packs = packIndex.packs || {};
  const bySlug = reverseMap(packIndex);
  const want = new Set(wantedSlugs);
  const chosen = [];

  while (want.size > 0) {
    const gain = new Map();
    for (const sl of want) {
      const ids = bySlug.get(sl);
      if (!ids) continue;
      for (const id of ids) gain.set(id, (gain.get(id) || 0) + 1);
    }
    let best = null, bestGain = 0, bestBytes = Infinity;
    for (const [id, g] of gain) {
      const b = packs[id].bytes || 0;
      // Screened BEFORE the comparison: a wasteful pack that wins on gain would
      // otherwise shut out the thrifty candidates behind it and take the round.
      if (b > MAX_BYTES_PER_NEW_CLIP * g) continue;
      if (g > bestGain || (g === bestGain && b < bestBytes)) { best = id; bestGain = g; bestBytes = b; }
    }
    if (!best || bestGain < MIN_PACK_GAIN) break;
    chosen.push(best);
    for (const sl of Object.keys(packs[best].clips)) want.delete(sl);
  }
  return { packIds: chosen, leftover: [...want] };
}

/**
 * Fetch one pack and file every clip it carries into the normal per-clip cache
 * entries.
 *
 * A pack is the original .m4a files concatenated with no framing, so a slice at
 * the recorded offset IS a complete, valid MP4 — byte-identical to the file
 * that would have been downloaded on its own. That is why nothing downstream
 * has to know packs exist: after this runs, the cache looks exactly as it would
 * have after 40 individual fetches.
 */
async function fetchPack(cache, pack, wanted) {
  // The cache-buster matters here as much as it does for a clip: _headers marks
  // everything under /audio/ immutable for a year, and packs live there too, so
  // a pack rebuilt at the same path after an audio replacement would otherwise
  // be served stale. The pack INDEX needs no suffix -- its filename already
  // carries the content version.
  const res = await fetch(pack.url + audioSuffix(), { cache: 'force-cache' });
  if (!res.ok) throw new Error('pack HTTP ' + res.status);
  const buf = await res.arrayBuffer();
  if (typeof pack.bytes === 'number' && buf.byteLength !== pack.bytes) {
    throw new Error('pack ' + pack.url + ' is ' + buf.byteLength + ' bytes, expected ' + pack.bytes);
  }
  if (pack.sha256) {
    const digest = await crypto.subtle.digest('SHA-256', buf);
    const hex = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
    if (hex !== pack.sha256) throw new Error('Audio pack integrity check failed');
  }
  let filed = 0;
  for (const sl of Object.keys(pack.clips)) {
    if (wanted && !wanted.has(sl)) continue;
    const [off, len] = pack.clips[sl];
    if (off + len > buf.byteLength) continue;          // index/pack mismatch
    const blob = new Blob([buf.slice(off, off + len)], { type: 'audio/mp4' });
    await cache.put(urlForSlug(sl), new Response(blob, {
      headers: { 'Content-Type': 'audio/mp4', 'Content-Length': String(len) },
    }));
    filed++;
  }
  return filed;
}

const slugFromUrl = (u) => {
  const m = /(?:^|\/)audio\/([^/?]+)\.m4a/.exec(u);
  return m ? m[1] : null;
};

/**
 * Download clips for [urls], preferring packs.
 *
 * Same signature and same return shape as the pre-1.04 per-file version, so
 * every call site improved without being touched. Falls back to per-file
 * fetching for anything packs cannot cover, and for a publish that has no
 * packs at all.
 */
export async function prefetch(urls, { concurrency = 6, onProgress, allInOne = false } = {}) {
  let cache;
  try { cache = await caches.open(CACHE); } catch (e) { return { done: 0, failed: urls.length, failedUrls: urls.slice() }; }

  const total = urls.length;
  let done = 0, failed = 0;
  const failedUrls = [];
  const report = () => { onProgress && onProgress(done + failed, total); };

  // 1. Anything already on the device costs nothing.
  const missing = [];
  for (const url of urls) {
    try {
      if (await cache.match(url)) { done++; continue; }
    } catch (e) { /* treat as missing */ }
    missing.push(url);
  }
  report();
  if (!missing.length) return { done, failed, failedUrls };

  // 2. Cover as much as possible with packs.
  let perFile = missing;
  let index = null;
  try { index = await audioPacks(); } catch (e) { index = null; }

  if (allInOne && index?.all && location.hostname !== 'app.local') {
    // One HTTP download even for retries. Do not silently explode a pack error
    // into thousands of mobile requests; the UI offers a single-pack retry.
    try {
      await fetchPack(cache, index.all, new Set(missing.map(slugFromUrl)));
      done += missing.length;
    } catch (error) { failed = missing.length; failedUrls.push(...missing); }
    report(); return { done, failed, failedUrls };
  }

  if (index && location.hostname !== 'app.local') {
    const bySlug = new Map();
    for (const url of missing) {
      const sl = slugFromUrl(url);
      if (sl) bySlug.set(sl, url);
    }
    const { packIds, leftover } = planPacks(index, [...bySlug.keys()]);
    const wanted = new Set(bySlug.keys());

    let k = 0;
    const packWorker = async () => {
      while (k < packIds.length) {
        const id = packIds[k++];
        const pack = index.packs[id];
        const covered = Object.keys(pack.clips).filter((sl) => wanted.has(sl));
        try {
          await fetchPack(cache, pack, wanted);
          done += covered.length;
        } catch (e) {
          // One bad pack must not lose the words it covered -- hand them back
          // to the per-file path rather than reporting them failed.
          for (const sl of covered) leftover.push(sl);
        }
        report();
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, packIds.length) }, packWorker));

    perFile = leftover.map((sl) => bySlug.get(sl)).filter(Boolean);
  }

  // 3. Whatever packs did not cover, fetch the old way.
  let i = 0;
  const worker = async () => {
    while (i < perFile.length) {
      const url = perFile[i++];
      try {
        if (await cache.match(url)) { done++; }
        else {
          const res = await fetch(url, { cache: 'force-cache' });
          if (res.ok) { await cache.put(url, res.clone()); done++; }
          else { failed++; failedUrls.push(url); }
        }
      } catch (e) { failed++; failedUrls.push(url); }
      report();
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, perFile.length) }, worker));

  // failedUrls lets the UI offer "Retry failed downloads" (§9) instead of
  // silently resetting to 0/N.
  return { done, failed, failedUrls };
}

export async function clearCache() {
  try { await caches.delete(CACHE); } catch (e) {}
  for (const url of objectUrls.values()) URL.revokeObjectURL(url);
  objectUrls.clear();
}

export async function cacheSize() {
  try {
    const cache = await caches.open(CACHE);
    return (await cache.keys()).length;
  } catch (e) { return 0; }
}

// 24 MB across 4,321 clips -> ~5.7 KB each. Estimating avoids reading every
// blob just to show an approximate figure in Settings.
const AVG_CLIP_BYTES = 5700;
export async function cacheSizeInfo() {
  const count = await cacheSize();
  return { count, approxBytes: count * AVG_CLIP_BYTES };
}
