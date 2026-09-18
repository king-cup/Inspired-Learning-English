import { examTitle } from './exam-source.js';
// Cloze passage repository. The bundled JSON is distilled from the three
// grade-specific Markdown corpora into complete, de-duplicated questions.

const SOURCE_GRADE = { '7': '七年级', '8': '八年级', '9': '九年级' };

let passages = [];
let byId = new Map();
let loading = null;

function validPassage(p) {
  if (!p || typeof p.id !== 'string' || typeof p.text !== 'string' || !Array.isArray(p.blanks) || !p.blanks.length) return false;
  return p.blanks.every((b) => Array.isArray(b.opts) && b.opts.length >= 2
    && Number.isInteger(b.key) && b.key >= 0 && b.key < b.opts.length);
}

export async function load() {
  if (passages.length) return passages;
  if (!loading) {
    loading = fetch('cloze.json').then(async (res) => {
      if (!res.ok) throw new Error(`cloze.json: HTTP ${res.status}`);
      const parsed = await res.json();
      if (!Array.isArray(parsed)) throw new Error('cloze.json is not an array');
      passages = parsed.filter(validPassage);
      byId = new Map(passages.map((p) => [p.id, p]));
      if (!passages.length) throw new Error('cloze.json contains no complete passages');
      return passages;
    }).catch((err) => { loading = null; throw err; });
  }
  return loading;
}

export const gradeSource = (grade) => SOURCE_GRADE[String(grade)] || SOURCE_GRADE['7'];
export const gradeOf = (sourceGrade) => Object.keys(SOURCE_GRADE).find((g) => SOURCE_GRADE[g] === sourceGrade) || '7';
export const all = () => passages;
export const get = (id) => byId.get(String(id)) || null;
export const forGrade = (grade) => passages.filter((p) => p.grade === gradeSource(grade));
export const sourceTitle = p => examTitle(p || {});
