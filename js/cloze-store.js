// Local-only cloze history and fair random selection. Kept separate from the
// vocabulary progress schema so both can evolve without invalidating the other.

const KEY = 'vd.cloze.v1';
const VALID_GRADES = new Set(['7', '8', '9']);
// The expanded source bank merged two pairs of passages that had previously
// been published twice. Canonicalising their old IDs keeps scores and random
// draw counts attached to the surviving passage.
const LEGACY_ID_ALIASES = { R056: 'R038', R240: 'R235' };
const DEFAULT = { version: 1, runs: [], pulls: {}, lastRandomByGrade: {}, lastGrade: '7' };

let state = { ...DEFAULT };
const listeners = new Set();

const gradeOf = (value) => VALID_GRADES.has(String(value)) ? String(value) : '7';
const isObj = (value) => value && typeof value === 'object' && !Array.isArray(value);
const canonicalId = (value) => LEGACY_ID_ALIASES[String(value)] || String(value);

export function init() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (isObj(parsed)) {
      const pulls = {};
      Object.entries(isObj(parsed.pulls) ? parsed.pulls : {}).forEach(([id, count]) => {
        const canonical = canonicalId(id);
        pulls[canonical] = Number(pulls[canonical] || 0) + Number(count || 0);
      });
      state = {
        version: 1,
        runs: Array.isArray(parsed.runs) ? parsed.runs
          .filter((r) => isObj(r) && typeof r.id === 'string')
          .map((r) => ({ ...r, id: canonicalId(r.id) })) : [],
        pulls,
        lastRandomByGrade: isObj(parsed.lastRandomByGrade)
          ? Object.fromEntries(Object.entries(parsed.lastRandomByGrade).map(([grade, id]) => [grade, canonicalId(id)])) : {},
        lastGrade: gradeOf(parsed.lastGrade),
      };
    }
  } catch (err) {
    console.warn('[cloze] could not read progress:', err);
  }
  return state;
}

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (err) { console.warn('[cloze] could not save progress:', err); }
  listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
}

export const get = () => state;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const runPct = (run) => run && run.total ? Math.floor((run.correct * 100) / run.total) : 0;

export function setLastGrade(grade) {
  state.lastGrade = gradeOf(grade);
  commit();
}

export function statsFor(id) {
  const runs = state.runs.filter((r) => r.id === canonicalId(id));
  const last = runs[runs.length - 1] || null;
  return {
    attempts: runs.length,
    bestPct: runs.reduce((best, r) => Math.max(best, runPct(r)), 0),
    lastPct: last ? runPct(last) : 0,
    lastMs: last ? last.at : 0,
    perfect: runs.some((r) => !!r.perfect),
  };
}

export const historyForGrade = (grade) => state.runs
  .filter((r) => r.grade === gradeOf(grade))
  .slice().sort((a, b) => b.at - a.at);

/**
 * Draw from a grade pool without repeating the immediately previous draw.
 * Unseen passages come first. Once all have appeared, choose among those with
 * the fewest pulls so the pool stays balanced over time.
 */
export function drawRandom(grade, ids, random = Math.random) {
  const g = gradeOf(grade);
  const pool = [...new Set(ids.map(String))];
  if (!pool.length) return null;

  const last = state.lastRandomByGrade[g];
  const eligible = pool.length > 1 ? pool.filter((id) => id !== last) : pool;
  const unseen = eligible.filter((id) => Number(state.pulls[id] || 0) === 0);
  let candidates = unseen;
  if (!candidates.length) {
    const least = Math.min(...eligible.map((id) => Number(state.pulls[id] || 0)));
    candidates = eligible.filter((id) => Number(state.pulls[id] || 0) === least);
  }

  const index = Math.min(candidates.length - 1, Math.floor(Math.max(0, random()) * candidates.length));
  const id = candidates[index];
  state.pulls[id] = Number(state.pulls[id] || 0) + 1;
  state.lastRandomByGrade[g] = id;
  state.lastGrade = g;
  commit();
  return id;
}

export function recordRun({ id, grade, mode, correct, total }) {
  const run = {
    id: canonicalId(id), grade: gradeOf(grade), mode: mode === 'test' ? 'test' : 'study',
    at: Date.now(), correct: Number(correct) || 0, total: Number(total) || 0,
    perfect: total > 0 && correct === total,
  };
  state.runs = [...state.runs, run].slice(-1000);
  state.lastGrade = run.grade;
  commit();
  return run;
}

const sessionKey = (id, mode) => `vd.cloze.session.${mode}.${canonicalId(id)}`;
export function loadSession(id, mode) {
  try { return JSON.parse(sessionStorage.getItem(sessionKey(id, mode)) || 'null'); }
  catch (e) { return null; }
}
export function saveSession(id, mode, data) {
  try { sessionStorage.setItem(sessionKey(id, mode), JSON.stringify(data)); } catch (e) {}
}
export function clearSession(id, mode) {
  try { sessionStorage.removeItem(sessionKey(id, mode)); } catch (e) {}
}
