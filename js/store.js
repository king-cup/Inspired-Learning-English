// Progress. Port of data/Progress.kt + data/ProgressStore.kt.
//
// One localStorage key, written debounced. Every access is wrapped: Safari
// throws on localStorage in some privacy configurations, and losing progress
// must never take the app down with it.

import * as D from './data.js';
import * as Curriculum from './curriculum-store.js';
import * as ClozeStore from './cloze-store.js';
import * as Activity from './activity.js';
import { validState as validGuidedState } from './guided-plan.js';

const KEY = 'vd.progress.v1';
const LAST_UNIT_KEY = 'vd.lastUnit';
const LAST_BACKUP_KEY = 'vd.lastBackup';
const SAVE_DELAY = 250;

/** A test passes at 80%. Port of Progress.PASS_PCT. */
export const PASS_PCT = 80;

/** TestRun helpers. Integer percentage, matching Kotlin's (correct*100)/total. */
export const runPct = (run) => (run.total ? Math.floor((run.correct * 100) / run.total) : 0);
export const runPassed = (run) => runPct(run) >= PASS_PCT;

let state = { version: 1, words: {}, units: {} };
let timer = null;
const listeners = new Set();

/**
 * The single most important line in this codebase. Must produce exactly what
 * Progress.wordKey + Entry.key produce in the Android app:
 *   unitId + "|" + word.trim().lowercase() + "|" + pos.trim().lowercase()
 *
 * toLowerCase(), never toLocaleLowerCase() -- Kotlin's lowercase() is
 * locale-invariant, and on a Turkish-locale device the dotless i would fork
 * every key containing an I.
 *
 * Keyed by the WORD, never by position in the list. Index-keying silently
 * re-points a student's whole history whenever a list is regenerated in a
 * different order; that is a documented failure in this project's history.
 */
export const wordKey = (unitId, e) =>
  unitId + '|' + String(e.w).trim().toLowerCase() + '|' + String(e.p || '').trim().toLowerCase();

export function init() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state = { version: 1, words: parsed.words || {}, units: parsed.units || {} };
      }
    }
  } catch (err) {
    console.warn('[store] could not read progress:', err);
  }
  return state;
}

export const get = () => state;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function commit() {
  listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  clearTimeout(timer);
  timer = setTimeout(flush, SAVE_DELAY);
}

export function flush() {
  clearTimeout(timer); timer = null;
  try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
  catch (err) { Activity.storageFailure(err); return false; }
}

export const statOf = (unitId, e) =>
  state.words[wordKey(unitId, e)] || { known: false, right: 0, wrong: 0, seen: 0, lastMs: 0 };

// Defaults are spread UNDER the stored object so an older record written before
// v1.01 (no tests[]) still reads back a well-formed stat.
export const unitStat = (unitId) =>
  ({ bestPct: 0, lastPct: 0, lastMs: 0, learnRuns: 0, cardRuns: 0, tests: [], ...(state.units[unitId] || {}) });

export const knownCount = (unitId, entries) =>
  entries.reduce((n, e) => n + (statOf(unitId, e).known ? 1 : 0), 0);

export function markKnown(unitId, e, known) {
  Activity.record('word-status', { unitId, wordKey: wordKey(unitId, e), known });
  const k = wordKey(unitId, e);
  const old = state.words[k] || { known: false, right: 0, wrong: 0, seen: 0, lastMs: 0 };
  state.words[k] = {
    known,
    seen: old.seen + 1,
    right: old.right + (known ? 1 : 0),
    wrong: old.wrong + (known ? 0 : 1),
    lastMs: Date.now(),
  };
  commit();
}

export const recordAnswer = (unitId, e, correct) => markKnown(unitId, e, correct);

/**
 * A test answer. Peter's explicit decision (6.5): unlike practice this NEVER
 * promotes a word to known -- a lucky exam guess is not evidence of learning --
 * but a wrong answer DOES demote it back to the to-learn pile. Do not unify this
 * with markKnown.
 */
export function recordTestAnswer(unitId, e, correct) {
  Activity.record('word-assessed', { unitId, wordKey: wordKey(unitId, e), correct });
  const k = wordKey(unitId, e);
  const old = state.words[k] || { known: false, right: 0, wrong: 0, seen: 0, lastMs: 0 };
  state.words[k] = {
    known: correct ? old.known : false,
    seen: old.seen + 1,
    right: old.right + (correct ? 1 : 0),
    wrong: old.wrong + (correct ? 0 : 1),
    lastMs: Date.now(),
  };
  commit();
}

function touchUnit(unitId, patch) {
  Activity.record('vocabulary-session-completed', { unitId, ...patch });
  const u = unitStat(unitId);
  state.units[unitId] = { ...u, ...patch, lastMs: Date.now() };
  commit();
}

export const finishCards = (unitId) => touchUnit(unitId, { cardRuns: unitStat(unitId).cardRuns + 1 });

export const finishLearn = (unitId, pct) => touchUnit(unitId, {
  learnRuns: unitStat(unitId).learnRuns + 1,
  lastPct: pct,
  bestPct: Math.max(unitStat(unitId).bestPct, pct),
});

/**
 * Records one finished test. Wrong answers have already been folded in by
 * recordTestAnswer; this only writes the history row and the headline score.
 * A fresh attempt increments the attempt number; a retest keeps the number of
 * the attempt it is fixing, and carries the retest flag. Port of finishTest().
 */
export function finishTest(unitId, correct, total, retest, details = {}) {
  Activity.record('vocabulary-test-completed', { unitId, correct, total, retest, ...details });
  const u = unitStat(unitId);
  const at = Date.now();
  const run = {
    at,
    attempt: u.tests.filter((r) => !r.retest).length + (retest ? 0 : 1),
    correct, total, retest: !!retest, ...details,
  };
  const pct = total ? Math.floor((correct * 100) / total) : 0;
  state.units[unitId] = {
    ...u,
    tests: [...u.tests, run],
    lastPct: pct,
    bestPct: Math.max(u.bestPct, pct),
    lastMs: at,
  };
  commit();
}

export function resetUnit(unitId) {
  Activity.record('unit-reset', { unitId });
  try { localStorage.removeItem(`ie.guided.${unitId}`); } catch (_) {}
  const prefix = unitId + '|';
  for (const k of Object.keys(state.words)) if (k.startsWith(prefix)) delete state.words[k];
  delete state.units[unitId];
  clearUnitSessions(unitId);   // an active Practice/Test/Cards run for this unit is now stale
  commit();
}

export function resetAll() {
  Activity.record('progress-reset');
  try { for (const key of Object.keys(localStorage)) if (key.startsWith('ie.guided.')) localStorage.removeItem(key); }
  catch (error) { Activity.storageFailure(error); return false; }
  state = { version: 1, words: {}, units: {} };
  clearAllSessions();
  commit();
}

// --------------------------------------------------- session recovery (§6)
//
// Runs persist across tab/app closure. Read legacy sessionStorage on upgrade;
// clear both stores on completion, explicit restart, or unit reset.
export const sessionKey = (unitId, mode) => `vd.session.${mode}.${unitId}`;
const SESSION_MODES = ['cards', 'practice', 'spelling', 'test'];

export function loadSession(unitId, mode) {
  try { return JSON.parse(localStorage.getItem(sessionKey(unitId, mode)) || sessionStorage.getItem(sessionKey(unitId, mode)) || 'null'); }
  catch (e) { return null; }
}
export function saveSession(unitId, mode, data) {
  try { localStorage.setItem(sessionKey(unitId, mode), JSON.stringify(data)); return true; }
  catch (e) { Activity.storageFailure(e); return false; }
}
export function clearSession(unitId, mode) {
  try { localStorage.removeItem(sessionKey(unitId, mode)); sessionStorage.removeItem(sessionKey(unitId, mode)); } catch (e) {}
}
export function clearUnitSessions(unitId) { SESSION_MODES.forEach((m) => clearSession(unitId, m)); }
function clearAllSessions() {
  try {
    for (const k of Object.keys(sessionStorage)) if (k.startsWith('vd.session.')) sessionStorage.removeItem(k);
    for (const k of Object.keys(localStorage)) if (k.startsWith('vd.session.')) localStorage.removeItem(k);
  } catch (e) {}
}

// --------------------------------------------------- continue shortcut (§10)
export function setLastUnit(unitId) { try { localStorage.setItem(LAST_UNIT_KEY, unitId); } catch (e) {} }
export function getLastUnit() { try { return localStorage.getItem(LAST_UNIT_KEY) || null; } catch (e) { return null; } }

// --------------------------------------------------- backup / restore (§7)

export function getLastBackup() {
  try { const v = localStorage.getItem(LAST_BACKUP_KEY); return v ? Number(v) : 0; } catch (e) { return 0; }
}
export function markBackup() { try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch (e) {} }

// Export/import hooks existed from day one; v1.02 wraps them in a validated,
// self-describing backup envelope and surfaces them in Settings.
export const toJSON = () => JSON.stringify(state);

export function exportBackup() {
  const guided = Object.fromEntries(Object.keys(localStorage).filter(key => key.startsWith('ie.guided.'))
    .map(key => [key.slice('ie.guided.'.length), JSON.parse(localStorage.getItem(key))]));
  if (!Object.values(guided).every(validGuidedState)) throw new Error('Invalid saved guided plan; backup was not created.');
  return JSON.stringify({
    app: 'inspired-vocab',
    kind: 'progress-backup',
    schema: 3,
    exportedAt: new Date().toISOString(),
    progress: { version: 1, words: state.words, units: state.units },
    curriculum: Curriculum.get(),
    cloze: ClozeStore.get(),
    guided,
  }, null, 2);
}

const isObj = (o) => o && typeof o === 'object' && !Array.isArray(o);

/** Parse + validate a backup file. Accepts the v1.02 envelope or a bare
 *  {words,units} progress object (older exports / toJSON). Returns
 *  { ok, progress } or { ok:false, reason }. */
export function validateBackup(text) {
  let obj;
  try { obj = JSON.parse(text); } catch (e) { return { ok: false, reason: 'parse' }; }
  if (!isObj(obj)) return { ok: false, reason: 'shape' };
  const p = isObj(obj.progress) ? obj.progress : obj;
  if (!isObj(p.words) || !isObj(p.units)) return { ok: false, reason: 'shape' };
  for (const k of Object.keys(p.words)) {
    const w = p.words[k];
    if (!isObj(w) || typeof w.known !== 'boolean') return { ok: false, reason: 'shape' };
  }
  for (const k of Object.keys(p.units)) {
    if (!isObj(p.units[k])) return { ok: false, reason: 'shape' };
  }
  if (obj.curriculum && (!isObj(obj.curriculum) || !isObj(obj.curriculum.articles) || !isObj(obj.curriculum.memory) || !isObj(obj.curriculum.middle) || (obj.curriculum.encounters && !Array.isArray(obj.curriculum.encounters)) || (obj.curriculum.highlights && !isObj(obj.curriculum.highlights)))) return { ok: false, reason: 'shape' };
  if (obj.cloze && (!isObj(obj.cloze) || !Array.isArray(obj.cloze.runs))) return { ok: false, reason: 'shape' };
  if (obj.guided !== undefined && (!isObj(obj.guided) || !Object.values(obj.guided).every(validGuidedState))) return { ok: false, reason: 'shape' };
  return { ok: true, progress: { version: 1, words: p.words, units: p.units }, curriculum: obj.curriculum, cloze: obj.cloze, guided: obj.guided };
}

/** Replace all progress from a validated backup. Returns { ok } or
 *  { ok:false, reason } and leaves progress UNTOUCHED on failure. */
export function importBackup(text) {
  const v = validateBackup(text);
  if (!v.ok) return v;
  // Stage every affected local key, including the main progress, before writes.
  // Roll back synchronous storage failures; localStorage is not crash-atomic.
  // Old backups without guided data preserve existing guided plans.
  let changes = [], written = [];
  try {
    const next = new Map([[KEY, JSON.stringify(v.progress)]]);
    if (v.curriculum) {
      const events = [...Curriculum.get().encounters, ...(v.curriculum.encounters || [])];
      v.curriculum.encounters = [...new Map(events.map(row => [JSON.stringify(row), row])).values()];
      next.set('ie.curriculum.v2', JSON.stringify(v.curriculum));
    }
    if (v.cloze) next.set('vd.cloze.v1', JSON.stringify(v.cloze));
    if (v.guided !== undefined) {
      for (const key of Object.keys(localStorage)) if (key.startsWith('ie.guided.')) next.set(key, null);
      for (const [unitId, plan] of Object.entries(v.guided)) next.set(`ie.guided.${unitId}`, JSON.stringify(plan));
    }
    for (const key of Object.keys(localStorage)) if (key.startsWith('vd.session.')) next.set(key, null);
    changes = [...next].map(([key, value]) => ({ key, value, before: localStorage.getItem(key) }));
    for (const change of changes) {
      if (change.value === null) localStorage.removeItem(change.key); else localStorage.setItem(change.key, change.value);
      written.push(change);
    }
  } catch (e) {
    try {
      for (const change of written) localStorage.removeItem(change.key);
      for (const change of written) if (change.before !== null) localStorage.setItem(change.key, change.before);
    } catch (rollbackError) { Activity.storageFailure(rollbackError); }
    Activity.storageFailure(e);
    return { ok: false, reason: 'storage' };
  }
  clearTimeout(timer);
  Curriculum.init(); ClozeStore.init();
  state = v.progress;
  clearAllSessions();   // any in-flight run no longer matches the restored data
  listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } });
  Activity.record('progress-restored', { guidedPlans: Object.keys(v.guided || {}).length });
  return { ok: true };
}

export function fromJSON(text) {
  const parsed = JSON.parse(text);
  state = { version: 1, words: parsed.words || {}, units: parsed.units || {} };
  commit();
}

// --------------------------------------------------- progress report (§7)

/** Aggregate everything a teacher report needs. Labels/word text come from the
 *  repository; formatting/localization is the caller's job. */
export function aggregate() {
  let unitsStarted = 0, unitsComplete = 0, wordsKnown = 0;
  const missed = [];
  const best = [];
  for (const t of D.types()) {
    for (const g of t.groups) {
      for (const u of g.units) {
        const words = D.wordsFor(u.id);
        if (!words.length) continue;
        const st = unitStat(u.id);
        const known = knownCount(u.id, words);
        wordsKnown += known;
        const touched = known > 0 || st.cardRuns > 0 || st.learnRuns > 0 || (st.tests && st.tests.length) || st.lastMs > 0;
        if (touched) unitsStarted += 1;
        if (known === words.length) unitsComplete += 1;
        if (st.bestPct > 0) best.push({ label: u.label, bestPct: st.bestPct, tests: (st.tests || []).length });
        for (const e of words) {
          const ws = statOf(u.id, e);
          if (ws.wrong >= 2 && ws.wrong > ws.right) missed.push({ w: e.w, c: e.c, wrong: ws.wrong, label: u.label });
        }
      }
    }
  }
  missed.sort((a, b) => b.wrong - a.wrong);
  best.sort((a, b) => b.bestPct - a.bestPct);
  return { unitsStarted, unitsComplete, wordsKnown, topMissed: missed.slice(0, 15), bestScores: best.slice(0, 15) };
}
