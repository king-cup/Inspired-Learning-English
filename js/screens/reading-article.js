import * as C from '../curriculum-data.js';
import * as S from '../curriculum-store.js';
import * as A from '../audio.js';
import * as P from '../profile.js';
import * as Log from '../activity.js';
import { startTest } from './reading-library.js';
import { passage } from '../passage.js';
import { h, clear, cn, topBar, paperHeader, barLabel, button, announce } from '../ui.js';
const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
let cleanup = [];
export function teardown() { cleanup.forEach(fn => fn()); cleanup = []; }

export async function render(root, id, mode = 'study') {
  teardown();
  let data;
  try { data = await C.loadReading(); }
  catch (error) { clear(root); root.append(h('p.note.bad', null, tr('Article could not load.', '文章加载失败。')), button(tr('Retry', '重试'), { onClick: () => render(root, id, mode) })); return; }
  const article = C.article(id);
  if (!article) { location.hash = '#/reading'; return; }
  const isTest = mode === 'test';
  const stateId = isTest ? id + '::test' : id;
  const body = await passage(article, article.paragraphs, !isTest);
  let progress = S.patchArticle(stateId, { openedAt: S.articleState(stateId).openedAt || Date.now() });
  const questions = article.comprehension.questions.filter(q => q.choices?.length && q.answer);
  if (progress.answerAuditVersion !== article.answerAuditVersion) {
    progress = S.patchArticle(stateId, { previousResponse: progress.compSubmitted ? { answers: progress.compAnswers, score: progress.compScore, completedAt: progress.completedAt } : progress.previousResponse,
      compAnswers: {}, compSubmitted: false, compScore: null, compGraded: false, answerAuditVersion: article.answerAuditVersion });
  }
  clear(root);
  root.append(topBar(tr('← Articles', '← 文章'), '', () => { location.hash = '#/reading/book/' + article.levelId + (isTest ? '' : '/study'); }),
    h('div.mt'), h('div.article-unit', null, 'Reading Explorer ' + article.level + ' · ' + tr('Unit ', '单元 ') + article.unit + article.reading),
    paperHeader({ title: article.title, left: isTest ? tr('Test — no word lookup', '测试 — 不可查词') : tr('Study — meanings available', '学习 — 可查看释义') }));
  root.append(audioPlayer(article, progress), body);
  if (article.editorialNote) root.append(h('p.note', null, tr(article.editorialNote.en, article.editorialNote.zh)));
  const comp = exerciseSection({ ...article.comprehension, questions }, 'comp', tr('Reading comprehension', '阅读理解题'));
  const pendingFigures = new Set((article.figures || []).map(figure => figure.id));
  const figureStatus = h('p', { role: 'status' });
  function syncFigures() {
    const waiting = pendingFigures.size > 0;
    comp.submit.disabled = waiting || !!S.articleState(stateId).compSubmitted;
    figureStatus.textContent = waiting ? tr('The question charts must load before you can submit.', '题目所需图表加载完成后才能提交。') : '';
  }
  for (const figure of article.figures || []) {
    const img = h('img', { src: figure.path, alt: figure.alt, decoding: 'async',
      onload: () => { pendingFigures.delete(figure.id); syncFigures(); },
      onerror: () => { pendingFigures.add(figure.id); syncFigures(); retry.hidden = false; } });
    const viewport = h('div.reading-figure-viewport', { tabindex: '0', 'aria-label': figure.title }, img);
    const zoom = button(tr('Enlarge chart', '放大图表'), { variant: 'thin', onClick: () => {
      const enlarged = viewport.classList.toggle('is-zoomed');
      zoom.textContent = enlarged ? tr('Fit to page', '适应页面') : tr('Enlarge chart', '放大图表');
      zoom.setAttribute('aria-pressed', String(enlarged));
    } });
    zoom.setAttribute('aria-pressed', 'false');
    const retry = button(tr('Retry chart download', '重试加载图表'), { variant: 'thin', onClick: () => { retry.hidden = true; img.src = figure.path; } });
    retry.hidden = true;
    root.append(h('figure.reading-figure', { 'data-figure': figure.id }, h('figcaption', null, figure.title), zoom, retry, viewport));
  }
  if (article.figures?.length) root.append(figureStatus);
  root.append(comp.wrap);
  const result = h('section.article-results.mt', { 'aria-live': 'polite' });
  root.append(result);
  const next = data.articles.filter(row => row.levelId === article.levelId).find((row, i, rows) => i > 0 && rows[i-1].id === id);
  function showResult() {
    clear(result); progress = S.articleState(stateId);
    comp.restore(progress.compAnswers, !!progress.compSubmitted);
    syncFigures();
    if (!progress.compSubmitted) return;
    result.append(h('p.note.good', null, progress.compGraded ? progress.compScore + '%' : tr('Answers saved. Ask your teacher to review these questions; no verified answer key is available.', '答案已保存。此练习暂无核实的答案，请老师批阅。')));
    result.append(button(tr('Try again', '再做一次'), { variant: 'thin', onClick: () => {
      progress = S.patchArticle(stateId, { compSubmitted: false, compAnswers: {}, compScore: null, compGraded: false });
      comp.wrap.querySelectorAll('input').forEach(el => { el.checked = false; });
      comp.wrap.querySelectorAll('textarea').forEach(el => { el.value = ''; });
      showResult();
    } }));
    result.append(button(isTest || next ? tr('Next article', '下一篇文章') : tr('Back to books', '返回书本'), { variant: 'ruled', wide: true, onClick: () => { if (isTest) startTest(article.levelId, data.articles.filter(row => row.levelId === article.levelId), id); else location.hash = next ? '#/reading/' + next.id + '/study' : '#/reading'; } }));
  }
  comp.submit.onclick = () => {
    if (pendingFigures.size) return;
    const answer = collect(comp.wrap, questions);
    if (Object.values(answer.answers).some(value => !String(value).trim()) && !confirm(tr('Some questions are unanswered. Submit anyway?', '还有题目未作答，仍要提交吗？'))) return;
    progress = S.patchArticle(stateId, { compAnswers: answer.answers, compSubmitted: true, compScore: answer.score, compGraded: answer.graded, completedAt: Date.now(), score: answer.score });
    Log.record('reading-submitted', { articleId: id, mode, answers: answer.answers, score: answer.score, questionCount: questions.length });
    showResult(); result.scrollIntoView({ block: 'nearest' }); announce(tr('Answers submitted', '答案已提交'));
  };
  const saveDraft = event => { if (!S.articleState(stateId).compSubmitted) {
    S.patchArticle(stateId, { compAnswers: collect(comp.wrap, questions).answers });
    if (event.type === 'change') Log.record('reading-answer', { articleId: id, mode, questionId: event.target.name, response: event.target.value });
  } };
  comp.wrap.addEventListener('change', saveDraft);
  comp.wrap.addEventListener('input', saveDraft);
  showResult();
  let scrollTimer;
  const onScroll = () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => S.patchArticle(stateId, { scrollY: window.scrollY }), 250); };
  addEventListener('scroll', onScroll, { passive: true });
  const restore = setTimeout(() => scrollTo(0, Number(progress.scrollY) || 0), 0);
  cleanup.push(() => { removeEventListener('scroll', onScroll); clearTimeout(scrollTimer); clearTimeout(restore); });
}

function exerciseSection(section, key, title) {
  const wrap = h('section.exercise-section.box.mt', { 'data-section': key });
  wrap.append(barLabel(title), h('p.exercise-instructions', null, tr('Choose one answer per question using the passage or the chart named in the question. True means supported, False means contradicted, and Not Given means the material does not tell you. Answers and explanations appear after submission.', '根据文章或题目指定的图表，每题选择一个答案。True（正确）表示材料支持，False（错误）表示材料反驳，Not Given（未提及）表示材料未提供信息。提交后显示答案及解析。')));
  const fields = h('div.exercise-fields');
  section.questions.forEach((q, index) => {
    const field = h('fieldset.question', { 'data-id': q.id }, h('legend', null, `${index + 1}. `, cn(q.prompt)));
    q.choices.forEach((choice) => field.append(h('label.choice', null, h('input', { type: 'radio', name: q.id, value: choice.id }), h('span', null, `${choice.label}. `, cn(choiceText(choice))))));
    fields.append(field);
  });
  const submit = button(tr('Submit section', '提交本部分'), { variant: 'ruled', wide: true });
  if (!section.questions.length) {
    wrap.append(h('p.note', null, tr('These questions are awaiting source verification and are not included in scoring.', '此篇题目正在核对原文，暂不计分。')));
    submit.hidden = true;
  }
  wrap.append(fields, submit);
  return { wrap, submit, restore(answers = {}, submitted = false) {
    for (const [qid, value] of Object.entries(answers || {})) {
      const field = wrap.querySelector(`[data-id="${qid}"]`); if (!field) continue;
      const input = field.querySelector(`input[value="${CSS.escape(String(value))}"]`); if (input) input.checked = true;
    }
    wrap.querySelectorAll('input').forEach((el) => { el.disabled = submitted; }); submit.disabled = submitted;
    wrap.querySelectorAll('.answer-explanation').forEach(el => el.remove());
    if (submitted) section.questions.forEach(q => {
      const correct = answers[q.id] === q.answer;
      const choice = q.choices.find(row => row.id === q.answer);
      wrap.querySelector(`[data-id="${q.id}"]`).append(h('div.answer-explanation.note' + (correct ? '.good' : '.bad'), null,
        h('strong', null, correct ? tr('Correct', '正确') : tr('Correct answer: ', '正确答案：') + choiceText(choice)),
        h('p', null, q.explanation)));
    });
  } };
}

function collect(wrap, questions) {
  const answers = {}; let correct = 0, gradedCount = 0;
  questions.forEach((q) => {
    const field = wrap.querySelector(`[data-id="${q.id}"]`); const input = field?.querySelector('input:checked');
    answers[q.id] = input?.value || '';
    if (q.answer) { gradedCount += 1; if (answers[q.id] === q.answer) correct += 1; }
  });
  return { answers, graded: gradedCount > 0, score: gradedCount ? Math.round(correct * 100 / gradedCount) : null };
}

function choiceText(choice) {
  return ({ t: tr('True', 'True · 正确'), f: tr('False', 'False · 错误'), ng: tr('Not Given', 'Not Given · 未提及'),
    fact: tr('Reported as a fact', '文中作为事实陈述'), speculation: tr('Theory / possibility / prediction', '理论／可能性／预测') })[choice?.id] || choice?.text || '';
}

function audioPlayer(article, progress) {
  const wrap = h('section.audio-player.box.mt', null, barLabel(tr('Article audio', '文章音频')));
  const time = h('span.audio-time', null, '0:00 / --:--');
  const seek = h('input', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': tr('Audio position', '音频位置') });
  const play = button(tr('Play', '播放'), { variant: 'thin' }); const restart = button(tr('Restart', '重新开始'), { variant: 'thin' });
  const record = C.audioRecord(article.id);
  const path = record?.compactPath || article.audio.path;
  const url = location.hostname === 'app.local' ? 'https://inspiredvocab.netlify.app/' + path : path;
  const size = record?.bytes ? (record.bytes / 1048576).toFixed(1) + ' MB' : '';
  const status = h('div.k-9.dim.audio-status', { role: 'status' }, tr('Optional download · ', '按需下载 · ') + size);
  wrap.append(h('div.audio-controls', null, play, restart, time), seek, status);
  let track = null;
  let bound = false;
  const load = async () => {
    if (track && A.loadedUrl() === url) return track;
    status.textContent = tr('Loading audio…', '正在加载音频…');
    try {
      track = await A.loadTrack(url, S.articleState(article.id).audioPosition || 0); if (!bound) { bind(); bound = true; } status.textContent = tr('Audio ready offline after this download.', '下载后可离线播放。'); return track;
    }
    catch (error) { status.textContent = tr('Audio is unavailable. Try again when online.', '音频暂不可用，请联网后重试。'); throw error; }
  };
  play.addEventListener('click', async () => { try { const el = await load(); if (el.paused) { await el.play(); play.textContent = tr('Pause', '暂停'); } else { el.pause(); play.textContent = tr('Play', '播放'); } } catch (e) {} });
  restart.addEventListener('click', async () => { try { const el = await load(); el.currentTime = 0; await el.play(); play.textContent = tr('Pause', '暂停'); } catch (e) {} });
  seek.addEventListener('input', async () => { try { const el = await load(); if (Number.isFinite(el.duration)) el.currentTime = Number(seek.value) * el.duration / 1000; } catch (e) {} });
  const fmt = (seconds) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '--:--';
  const update = () => { if (!track || A.loadedUrl() !== url) return; seek.value = track.duration ? String(Math.round(track.currentTime * 1000 / track.duration)) : '0'; time.textContent = `${fmt(track.currentTime)} / ${fmt(track.duration)}`; S.patchArticle(article.id, { audioPosition: track.currentTime }); };
  const bind = () => {
    const ended = () => { play.textContent = tr('Play', '播放'); };
    track.addEventListener('timeupdate', update);
    track.addEventListener('loadedmetadata', update);
    track.addEventListener('ended', ended);
    if (track.readyState >= 1) update();
    cleanup.push(() => {
      track?.removeEventListener('timeupdate', update);
      track?.removeEventListener('loadedmetadata', update);
      track?.removeEventListener('ended', ended);
    });
  };
  return wrap;
}
