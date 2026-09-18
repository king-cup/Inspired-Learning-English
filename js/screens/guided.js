import * as D from '../data.js';
import * as S from '../store.js';
import * as A from '../audio.js';
import * as Log from '../activity.js';
import * as i18n from '../i18n.js';
import { schedule, due, exercises, dateKey, validState } from '../guided-plan.js';
import { build, isCorrect, QType, instructionFor } from '../learn-engine.js';
import { h, clear, cn, topBar, paperHeader, button, blockButton, ruleBar, openDialog } from '../ui.js';

const tr = (en, zh) => i18n.lang() === 'zh' ? zh : en;
export const planKey = unitId => `ie.guided.${unitId}`;

export function render(root, unitId) {
  const unit = D.resolve(unitId);
  if (!unit?.words.length) { root.replaceChildren(h('p', null, i18n.t('unit.notFound'))); return; }
  const byKey = new Map(unit.words.map(entry => [S.wordKey(unitId, entry), entry]));
  let state, loadError = false;
  try {
    state = JSON.parse(localStorage.getItem(planKey(unitId)) || 'null');
    if (state && !validState(state)) loadError = true;
  } catch (_) { loadError = true; }
  if (!state) state = { progress: {}, plan: null, session: null, history: [] };
  // Migrate unfinished 1.10 plans without losing completed words or history.
  if (!loadError && state.curriculumVersion !== '1.11') {
    const names = { context: 'recall', spelling: 'meaning-review', recall: 'recall-review' };
    Object.values(state.progress).forEach(item => { item.completedKinds = [...new Set(item.completedKinds.map(kind => names[kind] || kind))]; });
    if (state.session) {
      state.session.queue.forEach(item => { item.kind = names[item.kind] || item.kind; });
      if (['SPELLING', 'SENTENCE_GAP'].includes(state.session.question?.type)) {
        state.session.question = null; state.session.feedback = null; state.session.draft = '';
      }
    }
    state.curriculumVersion = '1.11';
  }
  let storageError = false;
  const leave = () => { location.hash = `#/u/${encodeURIComponent(unitId)}`; };
  const save = () => {
    try { localStorage.setItem(planKey(unitId), JSON.stringify(state)); storageError = false; return true; }
    catch (error) { storageError = true; Log.storageFailure(error); return false; }
  };
  const log = (type, details = {}) => Log.record(type, { unitId, ...details });
  function header() {
    clear(root);
    root.append(topBar(i18n.t('common.back'), i18n.t('guided.title'), leave),
      paperHeader({ title: unit.label }),
      h('p', null, tr('Listen, read, and practise word meanings.', '听一听，读一读，再练习词义。')));
    if (loadError) {
      root.append(h('p.note.bad', { role: 'alert' }, tr('This saved plan could not be read. It has not been overwritten. Retry, or restore a progress backup in Settings; do not clear app data.', '无法读取此学习计划，原有记录未被覆盖。请重试，或在设置中恢复进度备份；请勿清除应用数据。')),
        button(tr('Retry opening plan', '重试打开计划'), { variant: 'ruled', wide: true, onClick: () => render(root, unitId) }));
      return false;
    }
    if (storageError) {
      root.append(h('p.note.bad', { role: 'alert' }, tr('Your latest step is still in memory but could not be saved. Keep this page open, free device storage, then retry saving before continuing.', '最近一步仍保留在内存中，但尚未保存。请保持此页打开，清理设备存储空间，然后重试保存再继续。')),
        button(tr('Retry saving progress', '重试保存进度'), { variant: 'ruled', wide: true, onClick: () => { save(); lesson(); } }));
      return false;
    }
    return true;
  }
  function dashboard(edit = false) {
    if (!header()) return;
    if (!state.plan || edit) { choices(); return; }
    const work = due(state.plan, state.progress);
    const complete = [...byKey.keys()].filter(key => state.progress[key]?.complete).length;
    root.append(h('p', { hidden: state.plan.mode === 'all' }, tr('Class deadline: ', '上课截止时间：') + new Date(state.plan.deadline).toLocaleString(i18n.lang() === 'zh' ? 'zh-CN' : 'en-GB', { timeZone: state.plan.timeZone }) + ' · ' + state.plan.timeZone),
      ruleBar(complete / unit.words.length, 'lg', { label: `${complete} / ${unit.words.length}` }),
      h('p', null, tr(`${complete} of ${unit.words.length} words learned. Keep reviewing!`, `已学 ${complete} / ${unit.words.length} 个词。记得复习！`)));
    if (state.plan.mode !== 'all' && Date.now() > Date.parse(state.plan.deadline)) root.append(h('p.note', null, tr('Your deadline has passed. Continue unfinished work or choose a new deadline—nothing is erased.', '截止时间已过。可继续未完成的内容或重新安排，原有记录不会删除。')));
    if (state.session) root.append(blockButton(tr('Resume this block', '继续本组学习'), '', () => lesson()));
    else if (work.reviewKeys.length) root.append(blockButton(tr(`Review first · ${work.reviewKeys.length} words`, `先复习 · ${work.reviewKeys.length} 个词`), tr('Earlier words, with difficult ones first.', '先复习学过的词，优先处理薄弱词。'), () => startBlock(work.reviewKeys.slice(0, 5), true)));
    else if (work.newKeys.length) root.append(blockButton(tr(`Start today · ${work.newKeys.length} words due`, `开始今天的学习 · 待学 ${work.newKeys.length} 个词`), tr('Five words at a time. You can pause whenever you need.', '每次五个词，可随时暂停。'), () => startBlock(work.newKeys.slice(0, 5), false)));
    else root.append(h('p.note.good', { role: 'status' }, tr('All done for today!', '今天的任务完成了！')));
    if (state.plan.mode === 'all') { root.append(button(tr('Change my plan', '修改计划'), { variant: 'thin', wide: true, onClick: () => dashboard(true) })); return; }
    const list = h('ol.guided-days');
    state.plan.days.forEach(day => list.append(h('li', null, `${day.date} — `,
      tr(`${day.keys.length} new words`, `${day.keys.length} 个新词`),
      day.date !== state.plan.days[0].date ? tr(' + earlier-word review', ' + 旧词复习') : '')));
    root.append(list, button(tr('Change my plan', '修改计划'), { variant: 'thin', wide: true, onClick: () => dashboard(true) }),
      h('p.dim', null, tr('Check that your device shows the right date.', '请确认设备日期正确。')));
  }
  function choices() {
    root.append(h('div.stack.mt2', null,
      blockButton(tr('Learn all words', '一次学完'), '', () => {
        if (state.plan) state.history.push({ plan: state.plan, changedAt: Log.stamp() });
        const remaining = [...byKey.keys()].filter(key => !state.progress[key]?.complete);
        const reviewKeys = [...byKey.keys()].filter(key => state.progress[key]?.complete);
        state.plan = { ...schedule(remaining, new Date(Date.now() + 3600000).toISOString(), 20, undefined, undefined, reviewKeys),
          mode: 'all', days: [{ date: dateKey(), keys: remaining }] };
        if (!save()) { header(); return; }
        if (state.session) lesson();
        else startBlock((remaining.length ? remaining : reviewKeys).slice(0, 5), !remaining.length);
      }),
      blockButton(tr('Daily study plan', '每日学习计划'), '', () => { if (header()) setup(); })));
    root.append(h('p.note.mt', null, tr('A daily study plan helps you learn a few words each day before class.', '每日学习计划帮你每天学几个词，在上课前学完。')));
    if (state.plan) root.append(button(tr('Back to my plan', '返回学习计划'), { variant: 'thin', onClick: () => dashboard() }));
  }
  function setup() {
    const defaultDeadline = new Date(Date.now() + 4 * 86400000);
    defaultDeadline.setHours(18, 0, 0, 0);
    const localInput = date => `${dateKey(date.getTime())}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const deadline = h('input.spelling-input', { id: 'class-deadline', type: 'datetime-local', required: true, value: localInput(state.plan ? new Date(state.plan.deadline) : defaultDeadline) });
    const error = h('p', { role: 'alert' });
    const form = h('form', { onsubmit: event => {
      event.preventDefault();
      const remaining = [...byKey.keys()].filter(key => !state.progress[key]?.complete);
      // A completed list can still have a review-only plan, without falsely
      // reintroducing its words as new learning.
      let plan;
      const reviewKeys = [...byKey.keys()].filter(key => state.progress[key]?.complete);
      try { plan = schedule(remaining, new Date(deadline.value).toISOString(), 20, undefined, undefined, reviewKeys); }
      catch (_) { error.textContent = tr('Choose a future class date within one year.', '请选择一年内的未来上课日期。'); return; }
      const apply = () => {
        if (state.plan) state.history.push({ plan: state.plan, changedAt: Log.stamp() });
        state.plan = plan; // Existing progress and unfinished block survive.
        if (!save()) { error.textContent = tr('Unable to save. Please free device storage and retry.', '无法保存，请清理设备存储后重试。'); return; }
        log('guided-plan-created', { deadline: plan.deadline, timeZone: plan.timeZone, days: plan.days.length, newWords: remaining.length, reviewOnlyLastDay: plan.reviewOnlyLastDay });
        dashboard();
      };
      apply();
    } }, h('label.spelling-label', { for: 'class-deadline' }, tr('Next class date and time', '下次上课日期和时间')), deadline,
      h('p', null, tr('We split the words across your study days. The last day is for review. If you have one day, do it all today.', '我们会把单词分到每天。最后一天用来复习。只有一天的话，就在当天全部学完。')), error);
    const submit = button(tr('Create my plan', '生成学习计划'), { variant: 'ruled', wide: true, size: 'lg' }); submit.type = 'submit'; form.append(submit); root.append(form);
    if (state.plan) root.append(button(i18n.t('common.cancel'), { variant: 'thin', onClick: () => dashboard() }));
  }
  function startBlock(keys, review) {
    keys = keys.filter(key => byKey.has(key));
    if (!keys.length) { dashboard(); return; }
    state.session = { keys, review, pos: 0, queue: review
      ? ['meaning', 'recall'].flatMap(kind => keys.map(key => ({ key, kind })))
      : [...keys.map(key => ({ key, kind: 'intro' })), ...exercises(keys)],
      question: null, feedback: null, draft: '', assisted: false, repeated: false, listened: false, startedAt: Log.stamp() };
    save(); log('guided-block-started', { keys, review }); lesson();
  }
  function lesson() {
    if (storageError || loadError) { header(); return; }
    const session = state.session;
    if (!session) { dashboard(); return; }
    const item = session.queue[session.pos];
    if (!item) { completeBlock(); return; }
    const entry = byKey.get(item.key);
    if (!entry) { state.session = null; save(); dashboard(); return; }
    header();
    root.append(h('p', null, tr(`Step ${session.pos + 1} of ${session.queue.length}`, `第 ${session.pos + 1} / ${session.queue.length} 步`)),
      ruleBar(session.pos / session.queue.length, 'sm'));
    if (item.kind === 'intro') {
      root.append(h('h2', null, entry.w));
      root.append(button(tr('Listen', '听发音'), { variant: 'ruled', onClick: async () => {
        A.speak(entry.w); session.listened = true; save(); log('guided-audio-requested', { wordKey: item.key }); lesson();
      } }));
      const repeat = h('input', { type: 'checkbox', checked: session.repeated, disabled: !session.listened,
        onchange: event => { session.repeated = event.target.checked; save(); log('pronunciation-self-confirmed', { wordKey: item.key, recognition: false }); lesson(); } });
      root.append(h('label.guided-read-check', null, repeat, h('span', null, tr('I read it aloud', '我已大声读过'))));
      if (session.repeated) {
        root.append(h('p.cn', { lang: 'zh-Hans' }, entry.c), h('p', null, entry.e || tr('No example yet.', '暂无例句。')),
          h('p.dim', null, tr('Chinese shows the word meaning.', '中文是这个词的意思。')),
          button(i18n.t('common.continue'), { wide: true, variant: 'ruled', onClick: advance }));
      }
      return;
    }
    if (session.question && [QType.SPELLING, QType.SENTENCE_GAP].includes(session.question.type)) { session.question = null; session.feedback = null; session.draft = ''; }
    if (!session.question) {
      // Old saved context/spelling steps now practise meanings too.
      const q = build(entry, unit.words, { allowedTypes: [item.kind.includes('recall') ? QType.MEANING_TO_WORD : QType.WORD_TO_MEANING] });
      const { entry: unused, ...saved } = q; session.question = saved;
      if (!save()) { lesson(); return; }
    }
    const q = { ...session.question, entry };
    root.append(h('h2', null, instructionFor(q.type)), h('p.guided-prompt', null, cn(q.prompt)));
    if (q.example) root.append(h('p', null, q.example));
    const options = h('div.stack.mt');
    q.options.forEach((text, i) => { const option = blockButton(text, '', () => answer(i)); option.disabled = !!session.feedback; options.append(option); }); root.append(options);
    if (!session.feedback) root.append(h('div.mt'), button(tr('Show a hint', '查看提示'), { variant: 'thin', onClick: () => {
      session.assisted = true; save(); log('guided-hint', { wordKey: item.key, kind: item.kind }); lesson();
    } }));
    if (session.assisted || session.feedback) root.append(h('p.note', null, `${entry.w} — `, cn(entry.c), entry.e ? h('p', null, entry.e) : null));
    if (session.feedback) {
      root.append(h('p.note' + (session.feedback.unaided ? '.good' : '.bad'), { role: 'status' },
        session.feedback.unaided ? i18n.t('practice.correct') : tr('Read the answer. Try this word again later.', '读一读答案，稍后再试一次。')),
        button(i18n.t('common.continue'), { wide: true, variant: 'ruled', onClick: advance }));
    }
  }
  function answer(response) {
    const session = state.session;
    if (session.feedback) return;
    const item = session.queue[session.pos]; const entry = byKey.get(item.key);
    if (session.question.type === QType.SPELLING && !String(response).trim()) return;
    const correct = isCorrect({ ...session.question, entry }, response);
    const unaided = correct && !session.assisted;
    session.feedback = { correct, unaided };
    const progress = state.progress[item.key] || { completedKinds: [], wrong: 0 };
    if (!unaided) { progress.wrong += 1; session.queue.push({ ...item }); }
    else if (!session.review && !progress.completedKinds.includes(item.kind)) progress.completedKinds.push(item.kind);
    progress.lastAttempt = Log.stamp(); state.progress[item.key] = progress;
    save(); S.recordTestAnswer(unitId, entry, unaided);
    log('guided-answer', { wordKey: item.key, kind: item.kind, correct, unaided, response, review: session.review }); lesson();
  }
  function advance() {
    const session = state.session;
    session.pos += 1; session.question = null; session.feedback = null; session.assisted = false; session.repeated = false; session.listened = false; session.draft = '';
    save(); lesson();
  }
  function completeBlock() {
    const session = state.session; const today = dateKey(Date.now(), state.plan.timeZone);
    for (const key of session.keys) {
      const progress = state.progress[key];
      if (session.review) progress.reviewedDate = today;
      else if (progress.completedKinds.length >= 4) { progress.complete = true; progress.lastDate = today; S.markKnown(unitId, byKey.get(key), true); }
    }
    log('guided-block-completed', { keys: session.keys, review: session.review, steps: session.queue.length });
    state.session = null; save();
    if (!header()) return;
    if (state.plan.mode === 'all') {
      const work = due(state.plan, state.progress);
      if (work.reviewKeys.length || work.newKeys.length) { startBlock((work.reviewKeys.length ? work.reviewKeys : work.newKeys).slice(0, 5), !!work.reviewKeys.length); return; }
    }
    root.append(h('h2', null, tr('Block complete', '本组完成')),
      h('p', null, tr('You recalled every word without a hint. Take a short break, then continue when you are ready.', '本组每个词都已独立作答正确。稍作休息，准备好后再继续。')),
      button(tr('Back to my plan', '返回学习计划'), { wide: true, variant: 'ruled', onClick: () => dashboard() }));
  }
  dashboard();
}
