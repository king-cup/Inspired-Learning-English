// The student profile: name, language, and the two display toggles. Port of
// data/Profile.kt + ProfileStore.
//
// DELIBERATELY a separate localStorage key from progress (vd.progress.v1):
// resetting a unit's records must never cost a student their name or settings.
// Every access is wrapped -- Safari can throw on localStorage in some privacy
// configurations, and a read failure must degrade to defaults, not a blank app.

import { langOf } from './i18n.js';

const KEY = 'vd.profile.v1';
export const HIGHLIGHTS = {
  red: ['Red', '红色', '#f6b0b0', '#000'], green: ['Green', '绿色', '#ade1ac', '#000'],
  blue: ['Blue', '蓝色', '#aacdf5', '#000'], yellow: ['Yellow', '黄色', '#ffe57a', '#000'],
  purple: ['Purple', '紫色', '#d4b2ef', '#000'], pink: ['Dark pink', '深粉色', '#a51f65', '#fff'],
  brown: ['Brown', '棕色', '#78482c', '#fff'], black: ['Black', '黑色', '#000', '#fff'],
  teal: ['Teal', '青色', '#87d5ce', '#000'],
};
export function applyHighlight() {
  const color = HIGHLIGHTS[state.highlightColor] || HIGHLIGHTS.yellow;
  document.documentElement.style.setProperty('--highlight', color[2]);
  document.documentElement.style.setProperty('--highlight-ink', color[3]);
}

const DEFAULT = {
  name: '',
  lang: 'en',
  inverted: false,
  // Cards start on the Chinese side and the student recalls the English.
  cardsReversed: false,
  onboarded: false,
  highlightColor: 'yellow',
};

let state = { ...DEFAULT };
const listeners = new Set();

export function init() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        state = {
          name: typeof parsed.name === 'string' ? parsed.name : '',
          lang: langOf(parsed.lang),
          inverted: !!parsed.inverted,
          cardsReversed: !!parsed.cardsReversed,
          onboarded: !!parsed.onboarded,
          highlightColor: Object.hasOwn(HIGHLIGHTS, parsed.highlightColor) ? parsed.highlightColor : 'yellow',
        };
      }
    }
  } catch (err) {
    console.warn('[profile] could not read profile:', err);
  }
  applyHighlight(); return state;
}

export const get = () => state;
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const displayName = () => state.name.trim();

function update(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (err) { console.warn('[profile] could not save profile:', err); }
  listeners.forEach((fn) => { try { fn(state); } catch (e) { console.error(e); } });
  return state;
}

export const completeOnboarding = (name, lang) =>
  update({ name: String(name).trim(), lang: langOf(lang), onboarded: true });

export const setName = (name) => update({ name: String(name).trim() });
export const setLang = (lang) => update({ lang: langOf(lang) });
export const setInverted = (on) => update({ inverted: !!on });
export const setCardsReversed = (on) => update({ cardsReversed: !!on });
export const setHighlightColor = color => { update({ highlightColor: Object.hasOwn(HIGHLIGHTS, color) ? color : 'yellow' }); applyHighlight(); };
