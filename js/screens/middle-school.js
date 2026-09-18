import { examTitle } from '../exam-source.js';
import * as C from '../curriculum-data.js';
import * as S from '../curriculum-store.js';
import * as P from '../profile.js';
import * as Activity from '../activity.js';
import * as Cloze from '../cloze-data.js';
import { passage } from '../passage.js';
import { h, clear, cn, topBar, paperHeader, barLabel, button, blockButton, press, srHeading } from '../ui.js';

const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
export function school({ high = false } = {}) {
const base = high ? 'high-school' : 'middle';
const title = () => high ? tr('High School English', '高中英语') : tr('Middle School English', '初中英语');
const load = high ? C.loadHigh : C.loadMiddle;
let loaded;
function examText(text) {
  const parts = String(text).split(/(\[\[image:high-school-figures\/[a-f0-9]+\.(?:png|jpe?g|gif|webp)]])/g);
  const fragment = document.createDocumentFragment();
  parts.forEach(part => {
    if (part.startsWith('[[image:')) fragment.append(h('img.exam-figure', { src: part.slice(8, -2), alt: tr('Figure from the exam paper', '试卷中的图片') }));
    else fragment.append(cn(part));
  });
  return fragment;
}
const SECTION_ORDER = ['mcq', 'cloze', ...(high ? ['word-form'] : []), 'reading-a', 'reading-b', 'reading-c', 'reading-d', 'reading-e', ...(high ? ['reading-gap'] : [])];
const SECTION_LABELS = {
  'word-form': ['Word forms', '词形与语法填空'], 'reading-gap': ['Reading: choose a sentence', '阅读选句'],
  mcq: ['MCQ', '语法选择题'], cloze: ['Cloze', '完形填空'],
  'reading-a': ['Reading A', '阅读 A'], 'reading-b': ['Reading B', '阅读 B'],
  'reading-c': ['Reading C', '阅读 C'], 'reading-d': ['Reading D', '阅读 D'],
  'reading-e': ['Reading E', '阅读 E'],
};
const sectionLabel = (id) => tr(...SECTION_LABELS[id]);
const answerKey = q => q.answer || (q.acceptedAnswers?.length ? q.acceptedAnswers : null) || (/^[A-F]$/i.test(q.answerText || '') ? q.answerText.toLowerCase() : null);
const normalize = value => String(value || '').normalize('NFKC').trim().toLowerCase().replace(/[‘’]/g, "'").replace(/\s+/g, ' ');
const matches = (value, key) => (Array.isArray(key) ? key : [key]).some(answer => normalize(value) === normalize(answer));

async function render(root, grade, section, mode, id) {
  try { loaded = await load(); } catch (error) { clear(root); root.append(h('p.note.bad', null, tr('Could not load. Please try again.', '加载失败，请重试。')), button(tr('Retry', '重试'), { onClick: () => render(root, grade, section, mode, id) })); return; }
  if (!grade) { home(root); return; }
  if (!section) { await gradeHome(root, grade); return; }
  if (!SECTION_ORDER.includes(section)) { location.hash = `#/${base}/${grade}`; return; }
  if (section === 'cloze' && !high) { location.hash = `#/cloze/${grade}`; return; }
  if (!id) { if (mode === 'study') await list(root, grade, section); else await sectionHome(root, grade, section); return; }
  await exercise(root, grade, section, mode, decodeURIComponent(id));
}

function home(root) {
  clear(root); root.append(topBar(tr('← Back', '← 返回'), title(), () => { location.hash = '#/'; }));
  root.append(h('div.mt'), paperHeader({ kicker: high ? tr('grades 11–12', '高二至高三') : tr('grades 7–9', '七至九年级'), title: title(), left: tr('Choose a grade', '选择年级'), right: '' }));
  const choices = h('div.home-choices.mt2'); (high ? ['11', '12'] : ['7', '8', '9']).forEach((grade) => choices.append(blockButton(`${tr('Grade', '年级')} ${grade}`, '', () => { location.hash = `#/${base}/${grade}`; }))); root.append(choices);
}

async function gradeHome(root, grade) {
  clear(root); root.append(topBar(tr('← Grades', '← 年级'), `${tr('Grade', '年级')} ${grade}`, () => { location.hash = `#/${base}`; }));
  const data = (await load()).grades[grade] || {};
  if (!high) await Cloze.load();
  const counts = { ...Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])), cloze: high ? (data.cloze || []).length : Cloze.forGrade(grade).length };
  root.append(h('div.mt'), paperHeader({ kicker: tr('choose a section', '选择题型'), title: `${tr('Grade', '年级')} ${grade}`, left: tr('Study or Test', '学习或测试'), right: '' }));
  const choices = h('div.home-choices.mt2');
  SECTION_ORDER.filter((id) => counts[id] > 0).forEach((id) => choices.append(blockButton(sectionLabel(id), `${counts[id]} ${tr('exercises', '份练习')}`, () => { location.hash = id === 'cloze' && !high ? `#/cloze/${grade}` : `#/${base}/${grade}/${id}`; })));
  root.append(choices, h('div', { style: { height: '30px' } }));
}

function startTest(grade, section, rows, current = null) {
  if (high) rows = rows.filter(row => row.graded);
  const id = S.drawRandom(`middle-${grade}-${section}`, rows.map(row => row.id), Math.random, current);
  if (!id) return;
  sessionStorage.removeItem(`ie.ms.session.${id}.test`);
  const target = `#/${base}/${grade}/${section}/test/${id}`;
  if (location.hash === target) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = target;
}
async function sectionHome(root, grade, section) {
  const rows = (await load()).grades[grade]?.[section] || [];
  clear(root); root.append(topBar(tr('← Grade', '← 年级') + ' ' + grade, '', () => { location.hash = `#/${base}/${grade}`; }), h('div.mt'), paperHeader({ title: sectionLabel(section), left: `${rows.length} ${tr('exercises', '份练习')}` }));
  root.append(h('div.home-choices.mt2', null,
    blockButton(tr('Study', '学习'), tr('Choose any exercise. Meanings and feedback are available.', '自由选择练习，可查看释义和反馈。'), () => { location.hash = `#/${base}/${grade}/${section}/study`; }),
    blockButton(tr('Test', '测试'), tr('Random exercise. Unseen first; no immediate repeats. No word lookup.', '随机抽题：未做优先，不连续重复。测试不提供查词。'), () => startTest(grade, section, rows))));
}
async function list(root, grade, section) {
  const data = await load();
    const exercises = data.grades[grade]?.[section] || [];
    clear(root); root.append(topBar(tr('← Back', '← 返回'), sectionLabel(section), () => { location.hash = `#/${base}/${grade}/${section}`; }));
    root.append(h('div.mt'), paperHeader({ kicker: `${tr('Grade', '年级')} ${grade}`, title: sectionLabel(section), left: `${exercises.length} ${tr('exercises', '份练习')}`, right: tr('Study · Test', '学习 · 测试') }));
    const find = h('input', { type: 'search', placeholder: tr('Find an exercise', '查找练习'), 'aria-label': tr('Find exercise', '查找练习') }); root.append(h('div.find.mt', null, h('div.lbl', null, tr('Find', '查找')), find));
    const box = h('div.box.mt'); const label = barLabel(tr('Exercises', '练习'), String(exercises.length)); const list = h('div'); box.append(label, list); root.append(box, h('div', { style: { height: '30px' } }));
    const paint = () => {
      clear(list); const needle = find.value.trim(); const shown = exercises.filter((row) => !needle || examTitle(row).toLowerCase().includes(needle.toLowerCase()) || String(row.number).includes(needle)); label.lastChild.textContent = String(shown.length);
      shown.forEach((row) => { const runs = S.middleRuns(row.id); const best = runs.filter((x) => x.graded).reduce((n, x) => Math.max(n, Math.round(x.correct * 100 / Math.max(1, x.total))), 0); list.append(press(h('button.middle-row', { type: 'button', onclick: () => { location.hash = `#/${base}/${grade}/${section}/study/${row.id}`; } }, h('span.grow', null, h('b', null, examTitle(row)), h('small', null, runs.length ? `${runs.length} ${tr('attempts', '次')} · ${best}% ${tr('best', '最好')}` : tr('Not started', '尚未开始'))), h('span', null, '›')))); });
    };
    find.oninput = paint; paint();
}

async function exercise(root, grade, section, mode, id) {
  const item = loaded.grades[grade]?.[section]?.find(row => row.id === id);
  if (!item) { list(root, grade, section); return; }
  S.touchMiddle(id, mode || 'choose');
  const back = () => { location.hash = `#/${base}/${grade}/${section}`; };
  if (mode === 'choose') {
    clear(root); root.append(topBar(tr('← Exercises', '← 练习'), sectionLabel(section), back), h('div.mt'), paperHeader({ kicker: `${tr('Grade', '年级')} ${grade} · ${sectionLabel(section)}`, title: examTitle(item), left: `${item.questions.length} ${tr('questions', '题')}`, right: item.graded ? tr('Graded', '可评分') : tr('Ungraded', '不评分') }));
    root.append(h('div.home-choices.mt2', null, blockButton(tr('Study', '学习'), tr('Immediate feedback', '即时反馈'), () => { location.hash = `#/${base}/${grade}/${section}/study/${id}`; }), blockButton(tr('Test', '测试'), tr('Results after submission', '提交后显示结果'), () => { location.hash = `#/${base}/${grade}/${section}/test/${id}`; })));
    return;
  }
  const isTest = mode === 'test'; const sessionKey = `ie.ms.session.${id}.${mode}`; let saved = {};
  const content = item.content && (high || section.startsWith('reading-')) ? await passage({ ...item, level: `Grade ${grade}`, unit: section, reading: '' }, item.content.split(/\n+/).filter(Boolean), !isTest) : null;
  try { saved = JSON.parse(sessionStorage.getItem(sessionKey) || '{}'); } catch (e) {}
  clear(root); root.append(topBar(tr('← Back', '← 返回'), '', () => { location.hash = `#/${base}/${grade}/${section}${isTest ? '' : '/study'}`; }), h('div.mt'), paperHeader({ title: examTitle(item), left: `${sectionLabel(section)} · ${isTest ? tr('Test — no word lookup', '测试 — 不可查词') : tr('Study', '学习')}` }));
  if (content) root.append(content);
  else if (item.content) root.append(h('div.exercise-source.box.mt', null, barLabel(examTitle(item), `${item.questions.length} ${tr('questions', '题')}`), ...item.content.split(/\n+/).filter(Boolean).map((text) => h('p', null, cn(text)))));
  if (high && !item.graded) root.append(h('p.note', null, tr('The source has no answer key for these questions. Study only; no score.', '原卷没有这些题的答案。仅供学习，不计分。')));
  const form = h('form.middle-form.mt');
  form.addEventListener('change', event => {
    const field = event.target.closest('[data-id]');
    if (field) Activity.record('school-answer', { id, mode, questionId: field.dataset.id, response: event.target.value });
  });
  item.questions.forEach((q) => {
    const field = h('fieldset.question', { 'data-id': q.id }, h('legend', null, `${q.number}. `, examText(q.prompt)));
    if (q.choices.length) q.choices.forEach((choice) => { const input = h('input', { type: 'radio', name: q.id, value: choice.id }); if (saved[q.id] === choice.id) input.checked = true; input.onchange = () => { persist(); if (!isTest && q.answer) feedback(field, input.value === q.answer, q); }; field.append(h('label.choice', null, input, h('span', null, `${choice.label}. `, examText(choice.text)))); });
    else {
      const input = answerKey(q) ? h('input.match-answer', { type: 'text', maxlength: section === 'word-form' ? '120' : '1', autocomplete: 'off', placeholder: section === 'word-form' ? tr('Your answer', '你的答案') : tr('Letter', '选项字母'), 'aria-label': `${item.title} ${q.number}` }) : h('textarea', { rows: '2', 'aria-label': `${item.title} ${q.number}` });
      input.value = saved[q.id] || ''; input.oninput = persist;
      input.onchange = () => { if (!isTest && answerKey(q)) feedback(field, matches(input.value, answerKey(q)), q); };
      field.append(input);
    }
    form.append(field);
  });
  const result = h('div'); const submit = button(isTest ? tr('Submit test', '提交测试') : tr('Finish study', '完成学习'), { variant: 'ruled', size: 'lg', wide: true });
  submit.onclick = () => {
    if (Object.values(values()).some(value => !String(value).trim()) && !confirm(tr('Some questions are unanswered. Submit anyway?', '还有题目未作答，仍要提交吗？'))) return;
    const answers = values(); const graded = item.questions.filter(answerKey); const correct = graded.filter((q) => matches(answers[q.id], answerKey(q))).length; const run = S.recordMiddle(id, mode, correct, graded.length, graded.length > 0); sessionStorage.removeItem(sessionKey);
    form.querySelectorAll('input,textarea').forEach((el) => { el.disabled = true; }); submit.disabled = true;
    clear(result); result.append(h('div.note.' + (run.graded && correct === graded.length ? 'good' : 'bad'), null, run.graded ? `${Math.round(correct * 100 / graded.length)}% · ${correct}/${graded.length}` : tr('Submitted · ungraded because no valid answer key is available.', '已提交 · 因无有效答案而不评分。')));
    if (isTest) item.questions.forEach((q) => { const field = form.querySelector(`[data-id="${q.id}"]`); feedback(field, answerKey(q) && matches(answers[q.id], answerKey(q)), q); });
    const rows = loaded.grades[grade]?.[section] || [];
    const next = rows[rows.findIndex(row => row.id === id) + 1];
    result.append(button(isTest || next ? tr('Next exercise', '下一篇练习') : tr('Back to exercises', '返回练习列表'), { variant: 'ruled', size: 'lg', wide: true, onClick: async () => { if (isTest) startTest(grade, section, (await load()).grades[grade][section], id); else location.hash = next ? `#/${base}/${grade}/${section}/study/${next.id}` : `#/${base}/${grade}/${section}/study`; } }));
  };
  root.append(form, submit, result, h('div', { style: { height: '32px' } }));
  function values() { const out = {}; item.questions.forEach((q) => { const field = form.querySelector(`[data-id="${q.id}"]`); out[q.id] = field.querySelector('input:checked')?.value || field.querySelector('textarea,input[type=text]')?.value || ''; }); return out; }
  function persist() { try { sessionStorage.setItem(sessionKey, JSON.stringify(values())); } catch (e) {} }
}

function feedback(field, ok, q) { let note = field.querySelector('.question-feedback'); if (!note) { note = h('div.question-feedback', { role: 'status' }); field.append(note); } note.className = `question-feedback note ${ok ? 'good' : answerKey(q) ? 'bad' : ''}`; note.textContent = ok ? tr('Correct', '正确') : answerKey(q) ? `${tr('Answer', '答案')}: ${(Array.isArray(answerKey(q)) ? answerKey(q).join(' / ') : answerKey(q).toUpperCase())}` : tr('Submitted · teacher review', '已提交 · 请老师批阅'); }

return { render };
}
export const { render } = school();
