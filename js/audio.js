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

import { hasClip, audioUrl } from './data.js';

const CACHE = 'vd-audio-v1';
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
const MAX_URLS = 60;

export const Status = { STARTING: 'STARTING', CLIP: 'CLIP', VOICE: 'DEVICE VOICE', SILENT: 'SILENT' };

let el = null;
let unlocked = false;
let status = Status.STARTING;
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
export async function prefetch(urls, { concurrency = 6, onProgress } = {}) {
  let cache;
  try { cache = await caches.open(CACHE); } catch (e) { return { done: 0, failed: urls.length, failedUrls: urls.slice() }; }

  let i = 0, done = 0, failed = 0;
  const failedUrls = [];
  const worker = async () => {
    while (i < urls.length) {
      const url = urls[i++];
      try {
        if (await cache.match(url)) {
          done++;                                   // already on the device
        } else {
          const res = await fetch(url, { cache: 'force-cache' });
          if (res.ok) { await cache.put(url, res.clone()); done++; }
          else { failed++; failedUrls.push(url); }
        }
      } catch (e) { failed++; failedUrls.push(url); }
      onProgress && onProgress(done + failed, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));
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
