import * as C from '../curriculum-data.js';
import * as S from '../curriculum-store.js';
import * as P from '../profile.js';
import * as Cloze from '../cloze-data.js';
import { passage } from '../passage.js';
import { h, clear, cn, topBar, paperHeader, barLabel, button, blockButton, press, srHeading } from '../ui.js';

const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
const SECTION_ORDER = ['mcq', 'cloze', 'reading-a', 'reading-b', 'reading-c', 'reading-d', 'reading-e'];
const SECTION_LABELS = {
  mcq: ['MCQ', '语法选择题'], cloze: ['Cloze', '完形填空'],
  'reading-a': ['Reading A', '阅读 A'], 'reading-b': ['Reading B', '阅读 B'],
  'reading-c': ['Reading C', '阅读 C'], 'reading-d': ['Reading D', '阅读 D'],
  'reading-e': ['Reading E', '阅读 E'],
};
const sectionLabel = (id) => tr(...SECTION_LABELS[id]);
const answerKey = q => q.answer || (/^[A-F]$/i.test(q.answerText || '') ? q.answerText.toLowerCase() : null);
const matches = (value, key) => String(value || '').trim().toLowerCase() === String(key).trim().toLowerCase();

export async function render(root, grade, section, mode, id) {
  try { await C.loadMiddle(); } catch (error) { console.error(error); }
  if (!grade) { home(root); return; }
  if (!section) { await gradeHome(root, grade); return; }
  if (!SECTION_ORDER.includes(section)) { location.hash = `#/middle/${grade}`; return; }
  if (section === 'cloze') { location.hash = `#/cloze/${grade}`; return; }
  if (!id) { list(root, grade, section); return; }
  await exercise(root, grade, section, mode, decodeURIComponent(id));
}

function home(root) {
  clear(root); root.append(topBar(tr('← Back', '← 返回'), tr('Middle School English', '初中英语'), () => { location.hash = '#/'; }));
  root.append(h('div.mt'), paperHeader({ kicker: tr('grades 7–9', '七至九年级'), title: tr('Middle School English', '初中英语'), left: tr('Choose a grade', '选择年级'), right: 'v1.09' }));
  const choices = h('div.home-choices.mt2'); ['7', '8', '9'].forEach((grade) => choices.append(blockButton(`${tr('Grade', '年级')} ${grade}`, '', () => { location.hash = `#/middle/${grade}`; }))); root.append(choices);
}

async function gradeHome(root, grade) {
  clear(root); root.append(topBar(tr('← Grades', '← 年级'), `${tr('Grade', '年级')} ${grade}`, () => { location.hash = '#/middle'; }));
  const data = (await C.loadMiddle()).grades[grade] || {};
  await Cloze.load();
  const counts = { ...Object.fromEntries(Object.entries(data).map(([key, rows]) => [key, rows.length])), cloze: Cloze.forGrade(grade).length };
  root.append(h('div.mt'), paperHeader({ kicker: tr('choose a section', '选择题型'), title: `${tr('Grade', '年级')} ${grade}`, left: tr('Study or Test', '学习或测试'), right: Object.values(counts).reduce((a, b) => a + b, 0) }));
  const choices = h('div.home-choices.mt2');
  SECTION_ORDER.filter((id) => counts[id] > 0).forEach((id) => choices.append(blockButton(sectionLabel(id), `${counts[id]} ${tr('exercises', '份练习')}`, () => { location.hash = id === 'cloze' ? `#/cloze/${grade}` : `#/middle/${grade}/${id}`; })));
  root.append(choices, h('div', { style: { height: '30px' } }));
}

function list(root, grade, section) {
  C.loadMiddle().then((data) => {
    const exercises = data.grades[grade]?.[section] || [];
    clear(root); root.append(topBar(`← ${tr('Grade', '年级')} ${grade}`, sectionLabel(section), () => { location.hash = `#/middle/${grade}`; }));
    root.append(h('div.mt'), paperHeader({ kicker: `${tr('Grade', '年级')} ${grade}`, title: sectionLabel(section), left: `${exercises.length} ${tr('exercises', '份练习')}`, right: tr('Study · Test', '学习 · 测试') }));
    const find = h('input', { type: 'search', placeholder: tr('Find an exercise', '查找练习'), 'aria-label': tr('Find exercise', '查找练习') }); root.append(h('div.find.mt', null, h('div.lbl', null, tr('Find', '查找')), find));
    const box = h('div.box.mt'); const label = barLabel(tr('Exercises', '练习'), String(exercises.length)); const list = h('div'); box.append(label, list); root.append(box, h('div', { style: { height: '30px' } }));
    const paint = () => {
      clear(list); const needle = find.value.trim(); const shown = exercises.filter((row) => !needle || row.title.toLowerCase().includes(needle.toLowerCase()) || String(row.number).includes(needle)); label.lastChild.textContent = String(shown.length);
      shown.forEach((row) => { const runs = S.middleRuns(row.id); const best = runs.filter((x) => x.graded).reduce((n, x) => Math.max(n, Math.round(x.correct * 100 / Math.max(1, x.total))), 0); list.append(press(h('button.middle-row', { type: 'button', onclick: () => { location.hash = `#/middle/${grade}/${section}/choose/${row.id}`; } }, h('span.grow', null, h('b', null, row.title), h('small', null, runs.length ? `${runs.length} ${tr('attempts', '次')} · ${best}% ${tr('best', '最好')}` : tr('Not started', '尚未开始'))), h('span', null, '›')))); });
    };
    find.oninput = paint; paint();
  });
}

async function exercise(root, grade, section, mode, id) {
  const item = C.middleExercise(grade, section, id);
  if (!item) { list(root, grade, section); return; }
  S.touchMiddle(id, mode || 'choose');
  const back = () => { location.hash = `#/middle/${grade}/${section}`; };
  if (mode === 'choose') {
    clear(root); root.append(topBar(tr('← Exercises', '← 练习'), sectionLabel(section), back), h('div.mt'), paperHeader({ kicker: `${tr('Grade', '年级')} ${grade} · ${sectionLabel(section)}`, title: item.title, left: `${item.questions.length} ${tr('questions', '题')}`, right: item.graded ? tr('Graded', '可评分') : tr('Ungraded', '不评分') }));
    root.append(h('div.home-choices.mt2', null, blockButton(tr('Study', '学习'), tr('Immediate feedback', '即时反馈'), () => { location.hash = `#/middle/${grade}/${section}/study/${id}`; }), blockButton(tr('Test', '测试'), tr('Results after submission', '提交后显示结果'), () => { location.hash = `#/middle/${grade}/${section}/test/${id}`; })));
    return;
  }
  const isTest = mode === 'test'; const sessionKey = `ie.ms.session.${id}.${mode}`; let saved = {};
  const content = item.content && section.startsWith('reading-') ? await passage({ ...item, level: `Grade ${grade}`, unit: section, reading: '' }, item.content.split(/\n\n+/)) : null;
  try { saved = JSON.parse(sessionStorage.getItem(sessionKey) || '{}'); } catch (e) {}
  clear(root); root.append(srHeading(`${item.title} · ${isTest ? tr('Test', '测试') : tr('Study', '学习')}`), topBar(tr('← Exercise', '← 练习'), `${sectionLabel(section)} · ${isTest ? tr('Test', '测试') : tr('Study', '学习')}`, () => { location.hash = `#/middle/${grade}/${section}/choose/${id}`; }));
  if (content) root.append(h('h1.exercise-title', null, cn(item.title)), content);
  else if (item.content) root.append(h('div.exercise-source.box.mt', null, barLabel(item.title, `${item.questions.length} ${tr('questions', '题')}`), ...item.content.split(/\n\n+/).map((text) => h('p', null, cn(text)))));
  const form = h('form.middle-form.mt');
  item.questions.forEach((q) => {
    const field = h('fieldset.question', { 'data-id': q.id }, h('legend', null, `${q.number}. `, cn(q.prompt)));
    if (q.choices.length) q.choices.forEach((choice) => { const input = h('input', { type: 'radio', name: q.id, value: choice.id }); if (saved[q.id] === choice.id) input.checked = true; input.onchange = () => { persist(); if (!isTest && q.answer) feedback(field, input.value === q.answer, q); }; field.append(h('label.choice', null, input, h('span', null, `${choice.label}. `, cn(choice.text)))); });
    else {
      const input = answerKey(q) ? h('input.match-answer', { type: 'text', maxlength: '1', autocomplete: 'off', placeholder: tr('Letter', '选项字母'), 'aria-label': `${item.title} ${q.number}` }) : h('textarea', { rows: '2', 'aria-label': `${item.title} ${q.number}` });
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
    const next = C.nextMiddle(grade, section, id);
    result.append(button(next ? tr('Next exercise', '下一篇练习') : tr('Back to exercises', '返回练习列表'), { variant: 'ruled', size: 'lg', wide: true, onClick: () => { location.hash = next ? `#/middle/${grade}/${section}/${mode}/${next.id}` : `#/middle/${grade}/${section}`; } }));
  };
  root.append(form, submit, result, h('div', { style: { height: '32px' } }));
  function values() { const out = {}; item.questions.forEach((q) => { const field = form.querySelector(`[data-id="${q.id}"]`); out[q.id] = field.querySelector('input:checked')?.value || field.querySelector('textarea,input[type=text]')?.value || ''; }); return out; }
  function persist() { try { sessionStorage.setItem(sessionKey, JSON.stringify(values())); } catch (e) {} }
}

function feedback(field, ok, q) { let note = field.querySelector('.question-feedback'); if (!note) { note = h('div.question-feedback', { role: 'status' }); field.append(note); } note.className = `question-feedback note ${ok ? 'good' : answerKey(q) ? 'bad' : ''}`; note.textContent = ok ? tr('Correct', '正确') : answerKey(q) ? `${tr('Answer', '答案')}: ${answerKey(q).toUpperCase()}` : tr('Submitted · teacher review', '已提交 · 请老师批阅'); }
