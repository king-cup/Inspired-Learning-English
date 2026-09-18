// Local learning journal. Wall-clock timestamps are useful, never trusted proof.
// IndexedDB avoids repeatedly rewriting an ever-growing localStorage array.
let dbPromise;
let context = {};
let sessionId = '';
let lastTick = 0;
let lastInteraction = 0;
let activeMs = 0;
let initialized = false;
let warned = false;
let visible = true;

export function storageFailure(error) {
  console.warn('[learning] could not save locally', error);
  if (!warned) { warned = true; globalThis.window?.dispatchEvent(new CustomEvent('learning-storage-error')); }
}

function db() {
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open('ie.learning-journal', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('events', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export function stamp() {
  const now = new Date();
  return { at: now.toISOString(), localAt: now.toLocaleString('sv-SE'),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, offsetMinutes: -now.getTimezoneOffset(), clock: 'device-unverified' };
}

function tick() {
  const now = performance.now();
  if (lastTick && visible) {
    activeMs += Math.max(0, Math.min(now, lastInteraction + 60000) - lastTick);
  }
  lastTick = now;
}

export async function record(type, details = {}) {
  tick();
  const event = { id: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`, ...stamp(),
    sessionId, ...context, type, details, activeMs: Math.round(activeMs) };
  try {
    const database = await db();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('events', 'readwrite');
      transaction.objectStore('events').add(event);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  } catch (error) {
    storageFailure(error);
  }
  return event;
}

export function start(route) {
  if (sessionId && context.route === route) return;
  if (sessionId) record('session-ended');
  context = { route }; activeMs = 0; lastTick = performance.now(); lastInteraction = lastTick;
  sessionId = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  record('session-started');
}

export function init() {
  if (initialized) return;
  initialized = true;
  visible = document.visibilityState === 'visible';
  for (const name of ['pointerdown', 'keydown', 'scroll']) document.addEventListener(name, () => {
    tick(); lastInteraction = performance.now();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    // Hidden time is never counted; persist at the foreground/background boundary.
    tick(); visible = document.visibilityState === 'visible'; lastInteraction = lastTick;
    record(document.visibilityState === 'visible' ? 'session-resumed' : 'session-paused');
  });
  window.addEventListener('pagehide', () => record('session-paused'));
  setInterval(() => { if (sessionId && document.visibilityState === 'visible') record('active-time'); }, 30000);
}

export async function exportJournal() {
  await record('history-exported');
  const database = await db();
  const events = await new Promise((resolve, reject) => {
    const request = database.transaction('events').objectStore('events').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return { app: 'inspired-english', schema: 1, exportedAt: stamp(), notice: 'Local device clock; not proof of attendance. No audio recorded.', events: events.sort((a, b) => a.at.localeCompare(b.at)) };
}
