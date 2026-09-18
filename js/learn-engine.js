// MCQ construction. Literal port of data/LearnEngine.kt.
//
// These rules are the pedagogy, not an implementation detail: distractors come
// from the SAME UNIT and prefer the same part of speech, so the wrong answers
// are always plausible. Any drift from the Android behaviour is a defect, not a
// variation.

import { shuffled } from './ui.js';
import * as i18n from './i18n.js';

export const QType = {
  WORD_TO_MEANING: 'WORD_TO_MEANING',
  MEANING_TO_WORD: 'MEANING_TO_WORD',
  SENTENCE_GAP: 'SENTENCE_GAP',
  SPELLING: 'SPELLING',
};

const GAP = ' ______ ';
const entryKey = (e) => String(e.w).trim().toLowerCase() + '|' + String(e.p || '').trim().toLowerCase();

/** Replace the target word in its own example sentence with a rule. */
export function blank(sentence, word) {
  const stem = String(word || '').trim();
  if (!stem) return sentence;
  const escaped = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return String(sentence).replace(new RegExp(`(^|[^\\p{L}])${escaped}(?=$|[^\\p{L}])`, 'giu'), (_all, before) => before + GAP);
}

export const normalizeSpelling = value => String(value || '').normalize('NFKC').trim().toLowerCase()
  .replace(/[‘’]/g, "'").replace(/[‐‑–—]/g, '-').replace(/\s+/g, ' ');

export function isCorrect(q, response) {
  if (q.type !== QType.SPELLING) return response === q.correctIndex;
  const accepted = [q.entry.w, ...(q.entry.acceptedSpellings || [])];
  return !!normalizeSpelling(response) && accepted.some(word => normalizeSpelling(word) === normalizeSpelling(response));
}

export function spelling(entry) {
  const gap = blank(entry.e || '', entry.w);
  return { entry, type: QType.SPELLING, prompt: entry.c || '', subPrompt: entry.p || '',
    example: gap.includes(GAP) ? gap : '', options: [], correctIndex: null };
}

/** Definition practice in both directions. Spelling is a separate activity. */
export function build(entry, pool, opts = {}) {
  const canMeaning = !!(entry.c && entry.c.trim());

  let kinds = [];
  if (canMeaning) kinds.push(QType.WORD_TO_MEANING, QType.MEANING_TO_WORD);

  if (!kinds.length) kinds.push(QType.MEANING_TO_WORD);

  if (opts.allowedTypes && opts.allowedTypes.length) {
    const allowed = kinds.filter((k) => opts.allowedTypes.includes(k));
    // Never emit a disallowed type; fall back to the first allowed direction.
    kinds = allowed.length ? allowed : [QType.WORD_TO_MEANING];
  }

  const kind = kinds[Math.floor(Math.random() * kinds.length)];

  // The instruction line is UI text, so it is NOT baked in here -- screens read
  // it from instructionFor(type) in the current language. Only the prompt
  // (word / gloss / gapped sentence) is data and stays as-is.
  if (kind === QType.WORD_TO_MEANING) {
    return assemble(entry, pool, kind, entry.w, entry.p, (e) => e.c);
  }
  if (kind === QType.MEANING_TO_WORD) {
    return assemble(entry, pool, kind, entry.c, entry.p, (e) => e.w);
  }
  return assemble(entry, pool, QType.MEANING_TO_WORD, entry.c, entry.p, (e) => e.w);
}

function assemble(entry, pool, type, prompt, subPrompt, answerOf) {
  const correct = String(answerOf(entry) || '').trim();
  const taken = new Set([correct.toLowerCase()]);
  const key = entryKey(entry);

  const samePos = shuffled(pool.filter((e) =>
    entryKey(e) !== key &&
    String(e.p || '').toLowerCase() === String(entry.p || '').toLowerCase() &&
    String(answerOf(e) || '').trim()));

  const anyOther = shuffled(pool.filter((e) =>
    entryKey(e) !== key && String(answerOf(e) || '').trim()));

  const distractors = [];
  for (const cand of samePos.concat(anyOther)) {
    if (distractors.length === 3) break;
    const text = String(answerOf(cand) || '').trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    if (taken.has(lower)) continue;
    taken.add(lower);
    distractors.push(text);
  }

  const options = shuffled(distractors.concat([correct]));
  return {
    entry, type, prompt: prompt || '', subPrompt: subPrompt || '',
    options, correctIndex: options.indexOf(correct),
  };
}

/** The translated instruction line for a question type. Port of instructionFor. */
export const instructionFor = (type) =>
  type === QType.SPELLING ? i18n.t('spelling.instruction')
    : type === QType.WORD_TO_MEANING ? i18n.t('practice.meaningQ')
    : type === QType.MEANING_TO_WORD ? i18n.t('practice.recallQ')
    : i18n.t('practice.gapQ');

/** The translated corner tag for a question type. Port of tagFor. */
export const tagFor = (type) =>
  type === QType.SPELLING ? i18n.t('spelling.title')
    : type === QType.WORD_TO_MEANING ? i18n.t('practice.tagMeaning')
    : type === QType.MEANING_TO_WORD ? i18n.t('practice.tagRecall')
    : i18n.t('practice.tagContext');
