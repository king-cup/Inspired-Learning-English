import * as C from '../curriculum-data.js';
import * as S from '../curriculum-store.js';
import * as A from '../audio.js';
import * as P from '../profile.js';
import { passage } from '../passage.js';
import { h, clear, cn, topBar, paperHeader, barLabel, button, announce } from '../ui.js';
const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
let cleanup = [];
export function teardown() { cleanup.forEach(fn => fn()); cleanup = []; }

export async function render(root, id) {
  teardown();
  let data;
  try { data = await C.loadReading(); }
  catch (error) { clear(root); root.append(h('p.note.bad', null, tr('Article could not load.', '文章加载失败。')), button(tr('Retry', '重试'), { onClick: () => render(root, id) })); return; }
  const article = C.article(id);
  if (!article) { location.hash = '#/reading'; return; }
  const body = await passage(article, article.paragraphs);
  let progress = S.patchArticle(id, { openedAt: S.articleState(id).openedAt || Date.now() });
  clear(root);
  root.append(topBar(tr('← Articles', '← 文章'), '', () => { location.hash = '#/reading/book/' + article.levelId; }),
    h('div.mt'), h('div.article-unit', null, article.level + ' · ' + tr('Unit ', '单元 ') + article.unit + article.reading),
    paperHeader({ title: article.title, left: article.wordCount + tr(' words', ' 词') }));
  root.append(audioPlayer(article, progress), body);
  const comp = exerciseSection(article.comprehension, 'comp', tr('Reading comprehension', '阅读理解题'));
  root.append(comp.wrap);
  const result = h('section.article-results.mt', { 'aria-live': 'polite' });
  root.append(result);
  const next = data.articles.filter(row => row.levelId === article.levelId).find((row, i, rows) => i > 0 && rows[i-1].id === id);
  function showResult() {
    clear(result); progress = S.articleState(id);
    comp.restore(progress.compAnswers, !!progress.compSubmitted);
    if (!progress.compSubmitted) return;
    result.append(h('p.note.good', null, progress.compGraded ? progress.compScore + '%' : tr('Answers saved. Ask your teacher to review these questions; no verified answer key is available.', '答案已保存。此练习暂无核实的答案，请老师批阅。')));
    result.append(button(tr('Try again', '再做一次'), { variant: 'thin', onClick: () => {
      progress = S.patchArticle(id, { compSubmitted: false, compAnswers: {}, compScore: null, compGraded: false });
      comp.wrap.querySelectorAll('input').forEach(el => { el.checked = false; });
      comp.wrap.querySelectorAll('textarea').forEach(el => { el.value = ''; });
      showResult();
    } }));
    result.append(button(next ? tr('Next article', '下一篇文章') : tr('Back to books', '返回书本'), { variant: 'ruled', wide: true, onClick: () => { location.hash = next ? '#/reading/' + next.id : '#/reading'; } }));
  }
  comp.submit.onclick = () => {
    const answer = collect(comp.wrap, article.comprehension.questions);
    if (Object.values(answer.answers).some(value => !String(value).trim()) && !confirm(tr('Some questions are unanswered. Submit anyway?', '还有题目未作答，仍要提交吗？'))) return;
    progress = S.patchArticle(id, { compAnswers: answer.answers, compSubmitted: true, compScore: answer.score, compGraded: answer.graded, completedAt: Date.now(), score: answer.score });
    showResult(); result.scrollIntoView({ block: 'nearest' }); announce(tr('Answers submitted', '答案已提交'));
  };
  const saveDraft = () => { if (!S.articleState(id).compSubmitted) S.patchArticle(id, { compAnswers: collect(comp.wrap, article.comprehension.questions).answers }); };
  comp.wrap.addEventListener('change', saveDraft);
  comp.wrap.addEventListener('input', saveDraft);
  showResult();
  let scrollTimer;
  const onScroll = () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(() => S.patchArticle(id, { scrollY: window.scrollY }), 250); };
  addEventListener('scroll', onScroll, { passive: true });
  const restore = setTimeout(() => scrollTo(0, Number(progress.scrollY) || 0), 0);
  cleanup.push(() => { removeEventListener('scroll', onScroll); clearTimeout(scrollTimer); clearTimeout(restore); });
}

function exerciseSection(section, key, title) {
  const wrap = h('section.exercise-section.box.mt', { 'data-section': key });
  wrap.append(barLabel(title), h('p.exercise-instructions', null, cn(section.instructions || tr('Answer the questions below.', '请回答以下问题。'))));
  const fields = h('div.exercise-fields');
  section.questions.forEach((q) => {
    const field = h('fieldset.question', { 'data-id': q.id }, h('legend', null, `${q.number}. `, cn(q.prompt)));
    if (q.choices.length) q.choices.forEach((choice) => field.append(h('label.choice', null, h('input', { type: 'radio', name: q.id, value: choice.id }), h('span', null, `${choice.label}. `, cn(choice.text)))));
    else field.append(h('textarea', { rows: '2', 'aria-label': `${title} ${q.number}` }));
    fields.append(field);
  });
  const submit = button(tr('Submit section', '提交本部分'), { variant: 'ruled', wide: true });
  wrap.append(fields, submit);
  return { wrap, submit, restore(answers = {}, submitted = false) {
    for (const [qid, value] of Object.entries(answers || {})) {
      const field = wrap.querySelector(`[data-id="${qid}"]`); if (!field) continue;
      const input = field.querySelector(`input[value="${CSS.escape(String(value))}"]`) || field.querySelector('textarea'); if (input) { if (input.type === 'radio') input.checked = true; else input.value = value; }
    }
    wrap.querySelectorAll('input,textarea').forEach((el) => { el.disabled = submitted; }); submit.disabled = submitted;
  } };
}

function collect(wrap, questions) {
  const answers = {}; let correct = 0, gradedCount = 0;
  questions.forEach((q) => {
    const field = wrap.querySelector(`[data-id="${q.id}"]`); const input = field?.querySelector('input:checked') || field?.querySelector('textarea');
    answers[q.id] = input?.value || '';
    if (q.answer) { gradedCount += 1; if (answers[q.id] === q.answer) correct += 1; }
  });
  return { answers, graded: gradedCount > 0, score: gradedCount ? Math.round(correct * 100 / gradedCount) : null };
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
