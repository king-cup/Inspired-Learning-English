import * as C from '../curriculum-data.js';
import * as S from '../curriculum-store.js';
import * as D from '../data.js';
import * as A from '../audio.js';
import * as P from '../profile.js';
import { h, clear, cn, topBar, paperHeader, barLabel, button, finishFlourish, announce } from '../ui.js';

const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
let cleanup = [];
export function teardown() { cleanup.forEach((fn) => fn()); cleanup = []; }

export async function render(root, id) {
  teardown(); clear(root);
  root.append(h('div.centre', null, h('div.k-11', { role: 'status' }, tr('Loading article…', '正在加载文章…'))));
  try { await C.loadReading(); } catch (error) { console.error(error); }
  const article = C.article(id);
  if (!article) { clear(root); root.append(topBar(tr('← Back', '← 返回'), tr('Reading Comprehension', '阅读理解'), () => { location.hash = '#/reading'; }), h('div.note.bad.mt2', null, tr('Article not found.', '找不到文章。'))); return; }
  let progress = S.patchArticle(id, { openedAt: S.articleState(id).openedAt || Date.now() });
  clear(root);
  root.append(topBar(tr('← Library', '← 阅读库'), tr('Reading Comprehension', '阅读理解'), () => { location.hash = '#/reading'; }));
  root.append(h('div.mt'), paperHeader({ kicker: `${article.level} · ${tr('Unit', '单元')} ${article.unit}${article.reading}`, title: article.title, left: `${article.wordCount} ${tr('words', '词')}`, right: `${article.readingMinutes} ${tr('min read', '分钟')}` }));
  root.append(audioPlayer(article, progress));
  root.append(h('div.reading-progress.mt', null, h('div.bar', null, h('span', null, tr('Reading progress', '阅读进度')), h('span', { id: 'reading-pct' }, '0%')), h('div.rulebar.sm', null, h('i', { id: 'reading-progress-fill' }))));

  const body = h('article.reading-body.mt', { 'aria-label': article.title }, ...article.paragraphs.map((paragraph) => h('p', null, cn(paragraph))));
  root.append(body);
  const lookup = h('section.lookup-panel.box.mt', { hidden: true, 'aria-live': 'polite' });
  root.append(lookup);
  bindLookup(body, lookup, article, () => { progress = S.articleState(id); paintPersonal(); });

  const comp = exerciseSection(article.comprehension, 'comp', tr('Reading comprehension', '阅读理解题'));
  const vocab = exerciseSection(article.vocabulary, 'vocab', tr('Vocabulary practice', '词汇练习'));
  root.append(comp.wrap, vocab.wrap);

  const personalWrap = h('section.box.mt', { id: 'personal-test' });
  root.append(personalWrap);
  const results = h('section.box.soft.mt', { id: 'article-results' });
  root.append(results);
  const completeWrap = h('div.mt2');
  root.append(completeWrap, h('div', { style: { height: '36px' } }));

  comp.submit.addEventListener('click', () => {
    const result = collect(comp.wrap, article.comprehension.questions);
    progress = S.patchArticle(id, { compAnswers: result.answers, compSubmitted: true, compScore: result.score, compGraded: result.graded });
    paintAll();
  });
  vocab.submit.addEventListener('click', () => {
    const result = collect(vocab.wrap, article.vocabulary.questions);
    progress = S.patchArticle(id, { vocabAnswers: result.answers, vocabSubmitted: true, vocabScore: result.score, vocabGraded: result.graded });
    paintAll();
  });

  function paintPersonal() {
    clear(personalWrap);
    personalWrap.append(barLabel(tr('Personal vocabulary test', '个性化词汇测试')));
    progress = S.articleState(id);
    if (!progress.compSubmitted || !progress.vocabSubmitted) {
      personalWrap.append(h('div.panel-empty', null, tr('Submit both source exercise sections first.', '请先提交前面的两部分练习。'))); return;
    }
    const items = (progress.tapped || []).map((itemId) => S.get().memory[itemId]).filter(Boolean).slice(0, 10);
    if (!items.length) {
      personalWrap.append(h('div.panel-empty', null, tr('No unfamiliar vocabulary was saved. This test is safely skipped.', '没有保存生词，本测试已跳过。')));
      if (!progress.personalSubmitted) progress = S.patchArticle(id, { personalSubmitted: true, personalSkipped: true });
      paintComplete(); return;
    }
    if (progress.personalSubmitted) {
      personalWrap.append(h('div.note.good', null, tr(`Submitted · ${progress.personalCorrect || 0}/${items.length} remembered`, `已提交 · 记住 ${progress.personalCorrect || 0}/${items.length}`)));
      return;
    }
    let index = Math.min(Number(progress.personalIndex) || 0, items.length - 1);
    let correct = Number(progress.personalCorrect) || 0;
    const stage = h('div.personal-stage'); personalWrap.append(stage);
    const show = () => {
      clear(stage); const item = items[index];
      stage.append(h('div.k-9.dim', null, `${tr('Item', '项目')} ${index + 1}/${items.length}`), h('h3', null, cn(item.display)), h('p.context', null, cn(item.contexts[item.contexts.length - 1]?.sentence || '')));
      const reveal = button(tr('Reveal meaning', '显示释义'), { variant: 'ruled', wide: true });
      reveal.onclick = () => {
        reveal.remove();
        stage.append(h('div.lookup-meaning', null, h('b', null, cn(item.chinese)), h('p', null, cn(item.english))), h('div.two-actions', null,
          button(tr('I knew it', '我记住了'), { variant: 'thin', onClick: () => answer(true) }),
          button(tr('Review again', '需要复习'), { variant: 'thin', onClick: () => answer(false) })));
      };
      stage.append(reveal);
    };
    const answer = (ok) => {
      S.review(items[index].id, ok); if (ok) correct += 1; index += 1;
      progress = S.patchArticle(id, { personalIndex: index, personalCorrect: correct, personalTotal: items.length });
      if (index < items.length) show();
      else { progress = S.patchArticle(id, { personalSubmitted: true, personalCorrect: correct, personalTotal: items.length }); paintAll(); }
    };
    show();
  }

  function paintResults() {
    clear(results); results.append(barLabel(tr('Results', '结果')));
    progress = S.articleState(id);
    if (!progress.compSubmitted && !progress.vocabSubmitted) { results.append(h('div.panel-empty', null, tr('Results appear after submission.', '提交后显示结果。'))); return; }
    [['comp', tr('Reading comprehension', '阅读理解题')], ['vocab', tr('Vocabulary practice', '词汇练习')]].forEach(([key, label]) => {
      if (!progress[`${key}Submitted`]) return;
      const graded = progress[`${key}Graded`];
      results.append(h('div.result-line', null, h('b', null, label), graded ? `${progress[`${key}Score`]}%` : tr('Submitted · ungraded (answer key unavailable)', '已提交 · 无答案，暂不评分')));
    });
    if (progress.personalSubmitted) results.append(h('div.result-line', null, h('b', null, tr('Personal vocabulary', '个性化词汇')), progress.personalSkipped ? tr('Skipped correctly', '已正确跳过') : `${progress.personalCorrect || 0}/${progress.personalTotal || 0}`));
  }

  function paintComplete() {
    clear(completeWrap); progress = S.articleState(id);
    const eligible = progress.compSubmitted && progress.vocabSubmitted && progress.personalSubmitted;
    const done = !!progress.completedAt;
    const complete = button(done ? tr('Completed · Open again anytime', '已完成 · 可随时重学') : tr('Complete lesson', '完成课程'), { variant: 'ruled', size: 'lg', wide: true, disabled: !eligible });
    complete.addEventListener('click', () => {
      if (!eligible || done) return;
      const scores = [progress.compGraded ? progress.compScore : null, progress.vocabGraded ? progress.vocabScore : null].filter(Number.isFinite);
      const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
      finishFlourish(complete, () => { progress = S.patchArticle(id, { completedAt: Date.now(), score }); announce(tr('Lesson completed', '课程已完成'), true); paintAll(); });
    });
    completeWrap.append(complete);
  }
  function paintAll() { comp.restore(S.articleState(id).compAnswers, S.articleState(id).compSubmitted); vocab.restore(S.articleState(id).vocabAnswers, S.articleState(id).vocabSubmitted); paintPersonal(); paintResults(); paintComplete(); }
  paintAll();

  let scrollTimer;
  const onScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const pct = max > 0 ? Math.min(100, Math.round(scrollY * 100 / max)) : 100;
    const fill = document.getElementById('reading-progress-fill'); const text = document.getElementById('reading-pct');
    if (fill) fill.style.width = `${pct}%`; if (text) text.textContent = `${pct}%`;
    clearTimeout(scrollTimer); scrollTimer = setTimeout(() => S.patchArticle(id, { scrollY }), 250);
  };
  addEventListener('scroll', onScroll, { passive: true }); cleanup.push(() => { removeEventListener('scroll', onScroll); clearTimeout(scrollTimer); });
  setTimeout(() => { scrollTo(0, Number(progress.scrollY) || 0); onScroll(); }, 0);
}

function exerciseSection(section, key, title) {
  const wrap = h('section.exercise-section.box.mt', { 'data-section': key });
  wrap.append(barLabel(title), h('div.exercise-source', null, ...section.sourceText.split(/\n\n+/).map((text) => h('p', null, cn(text)))));
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

function bindLookup(body, panel, article, changed) {
  const saveLookup = (text, sentence) => {
    text = String(text || '').trim().replace(/\s+/g, ' ');
    if (!text || text.length > 80) return;
    sentence = sentence || article.paragraphs.find((p) => p.toLowerCase().includes(text.toLowerCase())) || '';
    const entry = D.findEntry(text); const type = text.includes(' ') ? 'phrase' : 'word';
    const item = S.remember({ display: text, type, baseForm: entry?.w || text.toLowerCase(), partOfSpeech: entry?.p || '', english: entry?.s || 'No authored offline definition is available for this selection.', chinese: entry?.c || '此选词暂无离线释义，请结合原句理解。', sentence, article });
    const old = S.articleState(article.id); const tapped = [...new Set([...(old.tapped || []), item.id])]; S.patchArticle(article.id, { tapped });
    clear(panel); panel.hidden = false;
    panel.append(barLabel(tr('Vocabulary lookup', '词汇查询'), type), h('h3', null, cn(item.display)), h('div.k-9.dim', null, cn([item.baseForm, item.partOfSpeech].filter(Boolean).join(' · '))), h('p.lookup-cn', null, cn(item.chinese)), h('p', null, cn(item.english)), h('blockquote', null, cn(sentence)), h('div.two-actions', null,
      button(tr('Remove', '移除'), { variant: 'thin', onClick: () => { S.forget(item.id); S.patchArticle(article.id, { tapped: tapped.filter((id) => id !== item.id) }); panel.hidden = true; changed(); } }),
      button(tr('Already know this', '我已经会了'), { variant: 'thin', onClick: () => { S.setKnown(item.id, true); S.patchArticle(article.id, { tapped: tapped.filter((id) => id !== item.id) }); panel.hidden = true; changed(); } })));
    changed();
  };
  const inspect = () => setTimeout(() => {
    const selection = getSelection(); const text = String(selection || '').trim().replace(/\s+/g, ' ');
    if (!text || text.length > 80 || !selection.rangeCount || !body.contains(selection.anchorNode)) return;
    const sentence = article.paragraphs.find((p) => p.toLowerCase().includes(text.toLowerCase())) || selection.anchorNode.parentElement?.textContent || '';
    saveLookup(text, sentence);
  }, 20);
  const input = h('input', { type: 'text', maxlength: '80', placeholder: tr('Type a word or phrase', '输入单词或短语'), 'aria-label': tr('Word or phrase to look up', '要查询的单词或短语') });
  const manual = h('div.lookup-manual.box.mt', null, barLabel(tr('Keyboard vocabulary lookup', '键盘词汇查询')), h('div.lookup-manual-row', null, input, button(tr('Look up', '查询'), { variant: 'thin', onClick: () => { saveLookup(input.value); input.value = ''; } })));
  panel.before(manual);
  body.addEventListener('mouseup', inspect); body.addEventListener('touchend', inspect, { passive: true }); body.addEventListener('keyup', inspect);
  cleanup.push(() => { body.removeEventListener('mouseup', inspect); body.removeEventListener('touchend', inspect); body.removeEventListener('keyup', inspect); });
}

function audioPlayer(article, progress) {
  const wrap = h('section.audio-player.box.mt', null, barLabel(tr('Article audio', '文章音频')));
  const time = h('span.audio-time', null, '0:00 / --:--');
  const seek = h('input', { type: 'range', min: '0', max: '1000', value: '0', 'aria-label': tr('Audio position', '音频位置') });
  const play = button(tr('Play', '播放'), { variant: 'thin' }); const restart = button(tr('Restart', '重新开始'), { variant: 'thin' });
  const status = h('div.k-9.dim.audio-status', { role: 'status' }, tr('Ready · no autoplay', '已就绪 · 不会自动播放'));
  wrap.append(h('div.audio-controls', null, play, restart, time), seek, status);
  let track = null;
  const load = async () => {
    if (track) return track;
    status.textContent = tr('Loading audio…', '正在加载音频…');
    try { track = await A.loadTrack(article.audio.path, progress.audioPosition || 0); bind(); status.textContent = tr('Audio ready offline after this download.', '下载后可离线播放。'); return track; }
    catch (error) { status.textContent = tr('Audio is unavailable. Try again when online.', '音频暂不可用，请联网后重试。'); throw error; }
  };
  play.addEventListener('click', async () => { try { const el = await load(); if (el.paused) { await el.play(); play.textContent = tr('Pause', '暂停'); } else { el.pause(); play.textContent = tr('Play', '播放'); } } catch (e) {} });
  restart.addEventListener('click', async () => { try { const el = await load(); el.currentTime = 0; await el.play(); play.textContent = tr('Pause', '暂停'); } catch (e) {} });
  seek.addEventListener('input', async () => { try { const el = await load(); if (Number.isFinite(el.duration)) el.currentTime = Number(seek.value) * el.duration / 1000; } catch (e) {} });
  const fmt = (seconds) => Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '--:--';
  const update = () => { if (!track) return; seek.value = track.duration ? String(Math.round(track.currentTime * 1000 / track.duration)) : '0'; time.textContent = `${fmt(track.currentTime)} / ${fmt(track.duration)}`; S.patchArticle(article.id, { audioPosition: track.currentTime }); };
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
