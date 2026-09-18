import * as D from '../data.js';
import * as S from '../store.js';
import * as A from '../audio.js';
import * as Log from '../activity.js';
import * as i18n from '../i18n.js';
import { schedule, due, exercises, dateKey, validState } from '../guided-plan.js';
import { build, blank, spelling, isCorrect, QType, instructionFor } from '../learn-engine.js';
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
      h('p', null, tr('Learn in small groups, then retrieve each word in four different rounds.', '每次学习一小组单词，再分四轮回忆和练习。')));
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
    if (!state.plan || edit) { setup(); return; }
    const work = due(state.plan, state.progress);
    const complete = [...byKey.keys()].filter(key => state.progress[key]?.complete).length;
    root.append(h('p', null, tr('Class deadline: ', '上课截止时间：') + new Date(state.plan.deadline).toLocaleString(i18n.lang() === 'zh' ? 'zh-CN' : 'en-GB', { timeZone: state.plan.timeZone }) + ' · ' + state.plan.timeZone),
      ruleBar(complete / unit.words.length, 'lg', { label: `${complete} / ${unit.words.length}` }),
      h('p', null, tr(`${complete} of ${unit.words.length} words completed. Completion is not a promise of lasting mastery.`, `已完成 ${complete} / ${unit.words.length} 个单词。完成练习不等于永久掌握。`)));
    if (Date.now() > Date.parse(state.plan.deadline)) root.append(h('p.note', null, tr('Your deadline has passed. Continue unfinished work or choose a new deadline—nothing is erased.', '截止时间已过。可继续未完成的内容或重新安排，原有记录不会删除。')));
    if (state.session) root.append(blockButton(tr('Resume this block', '继续本组学习'), '', () => lesson()));
    else if (work.reviewKeys.length) root.append(blockButton(tr(`Review first · ${work.reviewKeys.length} words`, `先复习 · ${work.reviewKeys.length} 个词`), tr('Earlier words, with difficult ones first.', '先复习学过的词，优先处理薄弱词。'), () => startBlock(work.reviewKeys.slice(0, 5), true)));
    else if (work.newKeys.length) root.append(blockButton(tr(`Start today · ${work.newKeys.length} words due`, `开始今天的学习 · 待学 ${work.newKeys.length} 个词`), tr('Five words at a time. You can pause whenever you need.', '每次五个词，可随时暂停。'), () => startBlock(work.newKeys.slice(0, 5), false)));
    else root.append(h('p.note.good', { role: 'status' }, tr('Today’s work is complete. Your next scheduled words will appear on their study day.', '今天的任务已完成。后续单词会在安排的日期出现。')));
    const list = h('ol.guided-days');
    state.plan.days.forEach(day => list.append(h('li', null, `${day.date} — `,
      tr(`${day.keys.length} new words`, `${day.keys.length} 个新词`),
      day.date !== state.plan.days[0].date ? tr(' + earlier-word review', ' + 旧词复习') : '')));
    root.append(list, button(tr('Change deadline / rebalance unfinished words', '修改截止时间／重新分配未完成的词'), { variant: 'thin', wide: true, onClick: () => dashboard(true) }),
      h('p.dim', null, tr('Dates and activity use this device’s clock. Check its date and timezone. No microphone is recorded.', '计划和记录使用设备时间，请确认日期及时区正确。不录制麦克风音频。')));
  }
  function setup() {
    const defaultDeadline = new Date(Date.now() + 4 * 86400000);
    defaultDeadline.setHours(18, 0, 0, 0);
    const localInput = date => `${dateKey(date.getTime())}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    const deadline = h('input.spelling-input', { id: 'class-deadline', type: 'datetime-local', required: true, value: localInput(state.plan ? new Date(state.plan.deadline) : defaultDeadline) });
    const minutes = h('input.spelling-input', { id: 'study-minutes', type: 'number', min: '1', max: '600', value: state.plan?.minutes || 20 });
    const error = h('p', { role: 'alert' });
    const form = h('form', { onsubmit: event => {
      event.preventDefault();
      const remaining = [...byKey.keys()].filter(key => !state.progress[key]?.complete);
      // A completed list can still have a review-only plan, without falsely
      // reintroducing its words as new learning.
      let plan;
      const reviewKeys = [...byKey.keys()].filter(key => state.progress[key]?.complete);
      try { plan = schedule(remaining, new Date(deadline.value).toISOString(), Number(minutes.value), undefined, undefined, reviewKeys); }
      catch (_) { error.textContent = tr('Choose a future class time within one year and at least one minute per day.', '请选择一年内的未来上课时间，每日学习时间至少一分钟。'); return; }
      const apply = () => {
        if (state.plan) state.history.push({ plan: state.plan, changedAt: Log.stamp() });
        state.plan = plan; // Existing progress and unfinished block survive.
        if (!save()) { error.textContent = tr('Unable to save. Please free device storage and retry.', '无法保存，请清理设备存储后重试。'); return; }
        log('guided-plan-created', { deadline: plan.deadline, timeZone: plan.timeZone, days: plan.days.length, newWords: remaining.length, reviewOnlyLastDay: plan.reviewOnlyLastDay });
        dashboard();
      };
      if (plan.overloaded) openDialog({ title: tr('This is a heavy workload', '本次任务量较大'),
        body: tr(`The busiest day is estimated at ${plan.estimatedPeakMinutes} minutes, above your ${plan.minutes}-minute budget. You can allow more time or change the deadline.`, `预计最忙一天约需 ${plan.estimatedPeakMinutes} 分钟，超过设定的 ${plan.minutes} 分钟。可以增加学习时间或延后截止日期。`),
        actions: [{ label: tr('Adjust plan', '调整计划'), variant: 'thin' }, { label: tr('Keep this plan', '仍使用此计划'), onClick: apply }] });
      else apply();
    } }, h('label.spelling-label', { for: 'class-deadline' }, tr('Next class date and time', '下次上课日期和时间')), deadline,
      h('label.spelling-label', { for: 'study-minutes' }, tr('Minutes available each day', '每天可学习的分钟数')), minutes,
      h('p', null, tr('One day? Learn and practise everything in that session. Longer plans include review; a separate final review day is reserved only when the workload allows it.', '只有一天？当天完成新词学习与练习。多日计划包含复习；只有任务量允许时才预留最后一天专门复习。')), error);
    const submit = button(tr('Create my plan', '生成学习计划'), { variant: 'ruled', wide: true, size: 'lg' }); submit.type = 'submit'; form.append(submit); root.append(form);
    if (state.plan) root.append(button(i18n.t('common.cancel'), { variant: 'thin', onClick: () => dashboard() }));
  }
  function startBlock(keys, review) {
    keys = keys.filter(key => byKey.has(key));
    if (!keys.length) { dashboard(); return; }
    state.session = { keys, review, pos: 0, queue: review
      ? ['spelling', 'meaning'].flatMap(kind => keys.map(key => ({ key, kind })))
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
      const repeat = button(tr('I said it aloud once', '我已跟读一遍'), { variant: 'thin', onClick: () => {
        session.repeated = true; save(); log('pronunciation-self-confirmed', { wordKey: item.key, recognition: false }); lesson();
      } });
      repeat.disabled = !session.listened; root.append(h('div.mt'), repeat);
      if (session.repeated) {
        root.append(h('p.cn', { lang: 'zh-Hans' }, entry.c), h('p', null, entry.e || tr('An example sentence is not yet available for this entry.', '此词的例句暂未补齐。')),
          h('p.dim', null, tr('The Chinese text is the word’s meaning, not a translation of the whole sentence.', '中文显示单词释义，并非整句翻译。')),
          button(i18n.t('common.continue'), { wide: true, variant: 'ruled', onClick: advance }));
      }
      return;
    }
    if (!session.question) {
      let q = item.kind === 'spelling' || item.kind === 'recall' ? spelling(entry)
        : build(entry, unit.words, { allowedTypes: [item.kind === 'context' && entry.e && blank(entry.e, entry.w) !== entry.e ? QType.SENTENCE_GAP : QType.WORD_TO_MEANING] });
      // A one-choice question gives away its answer instead of testing recall.
      if (q.type !== QType.SPELLING && q.options.length < 2) q = spelling(entry);
      if (item.kind === 'recall') q.example = ''; // Later retrieval has no sentence clue.
      const { entry: unused, ...saved } = q; session.question = saved;
      if (!save()) { lesson(); return; }
    }
    const q = { ...session.question, entry };
    root.append(h('h2', null, instructionFor(q.type)), h('p.guided-prompt', null, cn(q.prompt)));
    if (q.example) root.append(h('p', null, q.example));
    if (q.type === QType.SPELLING) {
      const input = h('input.spelling-input', { id: 'guided-answer', type: 'text', value: session.draft,
        disabled: !!session.feedback, autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'en',
        oninput: event => { session.draft = event.target.value; if (!save()) { lesson(); return; } check.disabled = !session.draft.trim(); },
        onkeydown: event => { if (event.key === 'Enter' && !event.isComposing && session.draft.trim()) answer(session.draft); } });
      const check = button(i18n.t('spelling.check'), { wide: true, variant: 'ruled', onClick: () => answer(session.draft) }); check.disabled = !session.draft.trim();
      root.append(h('label.spelling-label', { for: 'guided-answer' }, i18n.t('spelling.answer')), input);
      if (!session.feedback) root.append(h('div.mt'), check);
    } else {
      const options = h('div.stack.mt');
      q.options.forEach((text, i) => { const option = blockButton(text, '', () => answer(i)); option.disabled = !!session.feedback; options.append(option); }); root.append(options);
    }
    if (!session.feedback) root.append(h('div.mt'), button(tr('Show a hint', '查看提示'), { variant: 'thin', onClick: () => {
      session.assisted = true; save(); log('guided-hint', { wordKey: item.key, kind: item.kind }); lesson();
    } }));
    if (session.assisted || session.feedback) root.append(h('p.note', null, `${entry.w} — `, cn(entry.c), entry.e ? h('p', null, entry.e) : null));
    if (session.feedback) {
      root.append(h('p.note' + (session.feedback.unaided ? '.good' : '.bad'), { role: 'status' },
        session.feedback.unaided ? i18n.t('practice.correct') : tr('Read the correction. This word will return later for an unaided try.', '看一下正确答案，这个词稍后会再次出现，请独立作答。')),
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
    root.append(h('h2', null, tr('Block complete', '本组完成')),
      h('p', null, tr('You recalled every word without a hint. Take a short break, then continue when you are ready.', '本组每个词都已独立作答正确。稍作休息，准备好后再继续。')),
      button(tr('Back to my plan', '返回学习计划'), { wide: true, variant: 'ruled', onClick: () => dashboard() }));
  }
  dashboard();
}
