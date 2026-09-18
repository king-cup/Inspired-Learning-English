import { chooseRandom } from './random-pool.js';
import * as Activity from './activity.js';
const KEY = 'ie.curriculum.v2';
const VERSION = 2;
const DAY = 86400000;
const fresh = () => ({ version: VERSION, articles: {}, middle: {}, memory: {}, activity: [], highlights: {}, encounters: [] });
let state = fresh();

export function init() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (parsed && typeof parsed === 'object') state = {
      ...fresh(), ...parsed, version: VERSION,
      articles: parsed.articles && typeof parsed.articles === 'object' ? parsed.articles : {},
      middle: parsed.middle && typeof parsed.middle === 'object' ? parsed.middle : {},
      memory: parsed.memory && typeof parsed.memory === 'object' ? parsed.memory : {},
      activity: Array.isArray(parsed.activity) ? parsed.activity.slice(-100) : [],
      highlights: parsed.highlights && typeof parsed.highlights === 'object' ? parsed.highlights : {},
      encounters: Array.isArray(parsed.encounters) ? parsed.encounters : [],
    };
  } catch (error) { console.warn('[curriculum] ignored malformed stored data:', error); }
  return state;
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (error) { Activity.storageFailure(error); }
}

export const get = () => state;
export function drawRandom(scope, ids, random = Math.random, current = null) {
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  if (!record(state.randomPools)) state.randomPools = {};
  if (!record(state.randomPools[scope])) state.randomPools[scope] = { pulls: {}, last: null };
  const pool = state.randomPools[scope];
  if (!record(pool.pulls)) pool.pulls = {};
  const id = chooseRandom(ids, pool.pulls, current || pool.last, random);
  if (id) { pool.pulls[id] = Number(pool.pulls[id] || 0) + 1; pool.last = id; save(); }
  return id;
}
export const highlights = id => state.highlights[id] || {};
export function highlightWord(article, anchor, entry, display, sentence) {
  if (highlights(article.id)[anchor]) return;
  const item = remember({ display, baseForm: entry.w, partOfSpeech: entry.p, chinese: entry.c, english: entry.s || entry.e || '', sentence, article });
  const event = { at: Date.now(), articleId: article.id, anchor, word: entry.w, memoryId: item.id };
  state.encounters.push(event);
  Activity.record('vocabulary-highlighted', event);
  state.highlights[article.id] = { ...highlights(article.id), [anchor]: event };
  save();
}
export function undoHighlight(id) {
  const entries = Object.entries(highlights(id)).reverse();
  if (!entries.length) return;
  const [anchor] = entries.sort((a,b) => b[1].at-a[1].at)[0];
  Activity.record('vocabulary-highlight-undone', { articleId: id, anchor });
  delete state.highlights[id][anchor]; save();
}
export const articleState = (id) => state.articles[id] || {};
export function patchArticle(id, patch) {
  state.articles[id] = { ...articleState(id), ...patch, updatedAt: Date.now() };
  save();
  return state.articles[id];
}

export const middleRuns = (id) => state.middle[id]?.runs || [];
export function touchMiddle(id, mode = 'choose') {
  const old = state.middle[id] || { runs: [] };
  state.middle[id] = { ...old, lastOpened: Date.now(), lastMode: mode };
  save();
}
export function recordMiddle(id, mode, correct, total, graded) {
  Activity.record('school-exercise-completed', { id, mode, correct, total, graded: !!graded });
  const old = state.middle[id] || { runs: [] };
  const run = { at: Date.now(), mode, correct, total, graded: !!graded };
  state.middle[id] = { ...old, lastOpened: run.at, lastMode: mode, completedAt: run.at, runs: [...old.runs, run].slice(-50) };
  save();
  return run;
}

const normalized = (text) => String(text || '').trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
export function remember({ display, type, baseForm, partOfSpeech, english, chinese, sentence, article }) {
  const form = normalized(baseForm || display);
  if (!form) return null;
  const id = `v-${form.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || btoa(unescape(encodeURIComponent(form))).slice(0, 12)}`;
  const now = Date.now();
  const old = state.memory[id];
  const match = /^ms-g([789])-(reading-[a-e])-/.exec(article.id);
  const route = article.route || (match ? `#/middle/${match[1]}/${match[2]}/study/${article.id}` : `#/reading/${article.id}`);
  const context = { sentence, articleId: article.id, articleTitle: article.title, level: article.level, unit: article.unit, reading: article.reading, route };
  const contexts = old?.contexts || [];
  const duplicate = contexts.some((row) => row.articleId === context.articleId && row.sentence === context.sentence);
  state.memory[id] = {
    id, normalized: form, display: display.trim(), type: type || (form.includes(' ') ? 'phrase' : 'word'),
    baseForm: baseForm || form, partOfSpeech: partOfSpeech || '', english, chinese,
    firstEncounter: old?.firstEncounter || now, lastEncounter: now,
    encounterCount: (old?.encounterCount || 0) + 1,
    contexts: duplicate ? contexts : [...contexts, context].slice(-12),
    reviewCount: old?.reviewCount || 0, correctCount: old?.correctCount || 0,
    incorrectCount: old?.incorrectCount || 0, streak: old?.streak || 0,
    reviewHistory: Array.isArray(old?.reviewHistory) ? old.reviewHistory.slice(-100) : [],
    priority: Number.isFinite(old?.priority) ? old.priority : 1,
    mastery: old?.mastery || 'new', nextReview: old?.nextReview || now,
    note: old?.note || '', known: !!old?.known,
  };
  save();
  return state.memory[id];
}

export function forget(id) { delete state.memory[id]; save(); }
export function setKnown(id, known = true) {
  if (!state.memory[id]) return;
  state.memory[id].known = known;
  state.memory[id].mastery = known ? 'mastered' : 'review';
  state.memory[id].nextReview = known ? Date.now() + 90 * DAY : Date.now();
  save();
}
export function note(id, text) { if (state.memory[id]) { state.memory[id].note = String(text).slice(0, 500); save(); } }
export function review(id, correct) {
  const item = state.memory[id];
  if (!item) return;
  Activity.record('memory-review', { id, correct: !!correct });
  const at = Date.now(); const previousMastery = item.mastery;
  item.reviewCount += 1;
  item.lastReview = at;
  if (correct) {
    item.correctCount += 1;
    item.streak += 1;
    const intervals = [1, 3, 7, 14, 30, 60];
    item.nextReview = Date.now() + intervals[Math.min(item.streak - 1, intervals.length - 1)] * DAY;
    item.mastery = item.streak >= 5 ? 'mastered' : item.streak >= 2 ? 'review' : 'learning';
    item.priority = Math.max(0, (Number(item.priority) || 1) - 1);
  } else {
    item.incorrectCount += 1;
    item.streak = 0;
    item.nextReview = Date.now() + (item.incorrectCount >= 3 ? 4 : 12) * 3600000;
    item.mastery = item.incorrectCount >= 3 ? 'difficult' : 'learning';
    item.priority = Math.min(5, (Number(item.priority) || 1) + 1);
  }
  item.reviewHistory = [...(Array.isArray(item.reviewHistory) ? item.reviewHistory : []), {
    at, correct: !!correct, from: previousMastery, to: item.mastery,
    nextReview: item.nextReview, priority: item.priority,
  }].slice(-100);
  state.activity = [...state.activity, { id, at, correct: !!correct }].slice(-100);
  save();
}

export const memoryItems = () => Object.values(state.memory);
export const dueItems = () => memoryItems().filter((item) => !item.known && item.nextReview <= Date.now());
