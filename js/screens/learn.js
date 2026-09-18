// Practice mode (renamed from "Learn" in v1.01). MCQ five at a time, feedback
// after each, missed items return at the end. Port of ui/LearnScreen.kt.
//
// v1.02: full session recovery (§6) and honest first-pass/retry progress (§9).

import * as D from '../data.js';
import * as S from '../store.js';
import * as A from '../audio.js';
import * as Activity from '../activity.js';
import { build, spelling, isCorrect, QType, instructionFor, tagFor } from '../learn-engine.js';
import * as i18n from '../i18n.js';
import { h, clear, cn, press, paperHeader, barLabel, button, blockButton, ruleBar, tag, posTag, topBar, shuffled, openDialog } from '../ui.js';

const ROUND = 5;

export function render(root, unitId, mode = 'practice') {
  const spellingMode = mode === 'spelling';
  const sessionMode = spellingMode ? 'spelling' : 'practice';
  const modeTitle = () => i18n.t(spellingMode ? 'spelling.title' : 'mode.practice');
  const unit = D.resolve(unitId);
  clear(root);
  if (!unit) { root.append(h('div.centre', null, h('div.k-11', null, i18n.t('unit.notFound')))); return; }

  const pool = unit.words;
  if (!pool.length || (!spellingMode && pool.length < 2)) {
    root.append(topBar(i18n.t('common.back'), i18n.t('mode.practice'), () => { location.hash = '#/u/' + encodeURIComponent(unitId); }));
    root.append(h('div.centre', null, h('div.k-11', null, i18n.t('practice.tooShort'))));
    return;
  }

  const byKey = new Map(pool.map((e) => [S.wordKey(unitId, e), e]));

  // --- session state -------------------------------------------------------
  let mainRun, run, pos, isRetry, firstPassRight, answeredTotal, firstPassAnswered;
  let wrongKeys, roundMarks, question, chosen, phase, draft = '';

  function fresh() {
    mainRun = shuffled(pool);
    run = mainRun; pos = 0; isRetry = false;
    firstPassRight = 0; answeredTotal = 0; firstPassAnswered = 0;
    wrongKeys = []; roundMarks = []; question = null; chosen = null; phase = 'asking';
    A.prefetch(D.clipUrlsFor(unitId));
    ask();
  }

  function restore(s) {
    const mapKeys = (ks) => ks.map((k) => byKey.get(k)).filter(Boolean);
    mainRun = mapKeys(s.mainOrder);
    run = mapKeys(s.runOrder);
    pos = s.pos; isRetry = s.isRetry;
    firstPassRight = s.firstPassRight; answeredTotal = s.answeredTotal; firstPassAnswered = s.firstPassAnswered || 0;
    wrongKeys = s.wrongKeys.slice(); roundMarks = s.roundMarks.slice();
    chosen = s.chosen === -1 ? null : s.chosen; phase = s.phase; draft = s.draft || '';
    if (s.question) {
      const e = byKey.get(s.question.entryKey);
      question = e ? { entry: e, type: s.question.type, prompt: s.question.prompt, subPrompt: s.question.subPrompt, example: s.question.example, options: s.question.options, correctIndex: s.question.correctIndex } : null;
    } else question = null;
    A.prefetch(D.clipUrlsFor(unitId));
    if (phase === 'checkpoint') checkpoint(true);
    else if (phase === 'finish') finish(true);
    else if (question) paintQuestion();
    else ask();
  }

  function validSaved(s) {
    return s && Array.isArray(s.mainOrder) && s.mainOrder.length === pool.length
      && s.mainOrder.every((k) => byKey.has(k));
  }

  function saveState() {
    S.saveSession(unitId, sessionMode, {
      mode: sessionMode,
      mainOrder: mainRun.map((e) => S.wordKey(unitId, e)),
      runOrder: run.map((e) => S.wordKey(unitId, e)),
      pos, isRetry, firstPassRight, answeredTotal, firstPassAnswered,
      wrongKeys: wrongKeys.slice(), roundMarks: roundMarks.slice(), chosen, phase, draft,
      question: question ? {
        entryKey: S.wordKey(unitId, question.entry), type: question.type,
        prompt: question.prompt, subPrompt: question.subPrompt, example: question.example,
        options: question.options, correctIndex: question.correctIndex,
      } : null,
    });
  }

  // Entry point: resume an interrupted run, or start fresh.
  const saved = S.loadSession(unitId, sessionMode);
  if (validSaved(saved)) {
    openDialog({
      title: i18n.t('session.resumeTitle'),
      body: i18n.t('session.resumePractice'),
      actions: [
        { label: i18n.t('session.startOver'), variant: 'thin', onClick: () => { S.clearSession(unitId, sessionMode); fresh(); } },
        { label: i18n.t('session.resume'), variant: 'thin', onClick: () => restore(saved) },
      ],
    });
  } else {
    fresh();
  }

  // ------------------------------------------------------------ navigation
  function leave() { location.hash = '#/u/' + encodeURIComponent(unitId); }
  function backGuard() {
    const inProgress = phase !== 'finish' && (answeredTotal > 0 || pos > 0 || chosen !== null || draft || phase === 'checkpoint');
    if (!inProgress) { leave(); return; }
    openDialog({
      title: i18n.t('session.leaveTitle'),
      body: i18n.t('session.leaveBody'),
      actions: [
        { label: i18n.t('session.stay'), variant: 'thin' },
        { label: i18n.t('session.leave'), variant: 'thin bad', onClick: leave },
      ],
    });
  }

  // --------------------------------------------------------------- question
  function ask() {
    const entry = run[Math.min(pos, run.length - 1)];
    question = spellingMode ? spelling(entry) : build(entry, pool);
    chosen = null; draft = '';
    phase = 'asking';
    saveState();
    paintQuestion();
  }

  function paintQuestion() {
    clear(root);
    root.append(topBar(i18n.t('common.back'), isRetry ? i18n.t('practice.fixing') : modeTitle(), backGuard));
    if (unit.typeName !== 'HSE Packages') root.append(h('h1.lesson-context', null, unit.label));

    const firstFrac = Math.min(1, firstPassAnswered / Math.max(1, mainRun.length));
    const prog = h('div.row.mt', null,
      h('span.k-11', null, isRetry ? i18n.f('practice.miss', pos + 1, run.length) : i18n.f('practice.q', pos + 1, run.length)),
      ruleBar(firstFrac, 'sm', { label: i18n.f('practice.firstPass', firstPassAnswered, mainRun.length) }));
    prog.lastChild.classList.add('grow');
    root.append(prog);

    const dots = h('div.dots', { 'aria-hidden': 'true', style: { marginTop: '6px' } });
    for (let i = 0; i < ROUND; i++) {
      const m = roundMarks[i];
      dots.append(h('i' + (m === true ? '.y' : m === false ? '.n' : '')));
    }
    root.append(dots);

    // prompt
    const box = h('div.box.mt');
    box.append(barLabel(instructionFor(question.type), tagFor(question.type)));
    const body = h('div', { style: { padding: '16px' } });
    const promptCn = question.type === QType.MEANING_TO_WORD || question.type === QType.SPELLING;
    if (question.type === QType.SENTENCE_GAP) {
      body.append(h('div', { style: { fontFamily: 'var(--serif)', fontSize: '17px', lineHeight: '26px' } }, question.prompt));
    } else {
      const promptNode = promptCn
        ? h('div.grow.cn', { lang: 'zh-Hans', style: { fontSize: '28px', lineHeight: '36px', fontWeight: '700' } }, question.prompt)
        : h('div.grow', { style: { fontFamily: 'var(--serif)', fontSize: '28px', lineHeight: '34px', fontWeight: 'bold' } }, question.prompt);
      const row = h('div.row', null, promptNode);
      if (question.type === QType.WORD_TO_MEANING) {
        row.append(press(h('button.btn.thin.sm', { type: 'button', 'aria-label': i18n.t('a11y.playWord'), onclick: () => A.speak(question.entry.w) }, '▶')));
      }
      body.append(row);
      if (question.subPrompt) { const p = posTag(question.subPrompt); if (p) body.append(h('div.mt', null, p)); }
    }
    box.append(body);
    if (question.example) body.append(h('p', null, question.example));
    root.append(box);

    // options
    const answered = chosen !== null;
    const optsCn = question.type === QType.WORD_TO_MEANING;   // Chinese meaning options
    const opts = h('div.stack.mt');
    question.options.forEach((text, i) => {
      const cls = !answered ? '' : i === question.correctIndex ? ' right' : i === chosen ? ' wrong' : '';
      const el = h('button.opt' + (cls ? cls.trim().split(' ').map((c) => '.' + c).join('') : ''), { type: 'button' },
        h('span.ltr', { 'aria-hidden': 'true' }, 'ABCD'[i]),
        h('span.txt', null, optsCn ? cn(text) : text));
      if (!answered) { press(el); el.addEventListener('click', () => answer(i)); }
      else el.disabled = true;
      opts.append(el);
    });
    root.append(opts);
    if (spellingMode) {
      const input = h('input.spelling-input', { id: 'spelling-answer', type: 'text', value: answered ? chosen : draft,
        disabled: answered, autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', lang: 'en',
        oninput: event => { draft = event.target.value; saveState(); check.disabled = !draft.trim(); },
        onkeydown: event => { if (event.key === 'Enter' && !event.isComposing && draft.trim() && !answered) answer(draft); },
      });
      const check = button(i18n.t('spelling.check'), { wide: true, size: 'lg', variant: 'ruled', onClick: () => answer(draft) });
      check.disabled = !draft.trim();
      root.append(h('label.spelling-label', { for: 'spelling-answer' }, i18n.t('spelling.answer')), input);
      if (!answered) root.append(h('p', null, i18n.t('spelling.help')), check);
    }

    if (answered) root.append(feedback());
    root.append(h('div', { style: { height: '28px' } }));
  }

  function answer(i) {
    if (chosen !== null || (spellingMode && !String(i).trim())) return;
    chosen = i;
    const correct = isCorrect(question, i);
    Activity.record('practice-answer', { unitId, mode: sessionMode, wordKey: S.wordKey(unitId, question.entry), type: question.type, response: i, correct, retry: isRetry });
    roundMarks.push(correct);
    answeredTotal += 1;
    if (!isRetry) firstPassAnswered += 1;
    S.recordAnswer(unitId, question.entry, correct);

    const key = S.wordKey(unitId, question.entry);
    if (!isRetry) {
      if (correct) firstPassRight += 1;
      else if (!wrongKeys.includes(key)) wrongKeys.push(key);
    } else if (correct) {
      const at = wrongKeys.indexOf(key);
      if (at >= 0) wrongKeys.splice(at, 1);
    }
    saveState();
    paintQuestion();
  }

  function feedback() {
    const correct = isCorrect(question, chosen);
    const e = question.entry;
    const box = h('div.note.mt' + (correct ? '.good' : '.bad'), { role: 'status' });
    box.append(h('div.k-13', { style: { color: correct ? 'var(--rt-edge)' : 'var(--wr-edge)' } },
      correct ? i18n.t('practice.correct') : i18n.t('practice.notQuite')));
    box.append(h('div', { style: { fontFamily: 'var(--serif)', fontSize: '15px', marginTop: '6px' } },
      e.w, '  ·  ', i18n.displayPos(e.p), '  —  ', cn(e.c)));
    if (e.e) box.append(h('div', { style: { fontFamily: 'var(--serif)', fontSize: '13px', lineHeight: '20px', marginTop: '6px', opacity: '.85' } }, e.e));
    if (!correct) box.append(h('div.k-9', { style: { color: 'var(--wr-edge)', marginTop: '6px' } }, i18n.t('practice.comesBack')));

    const foot = h('div.sticky-foot', null,
      button(i18n.t('common.continue'), { variant: 'ruled', size: 'lg', wide: true, onClick: next }));

    const wrap = h('div');
    wrap.append(box, foot);
    requestAnimationFrame(() => box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return wrap;
  }

  function next() {
    pos += 1;
    if (pos % ROUND === 0 || pos >= run.length) checkpoint();
    else ask();
  }

  // ------------------------------------------------------------- checkpoint
  function checkpoint(resuming) {
    phase = 'checkpoint';
    if (!resuming) saveState();
    const runComplete = pos >= run.length;
    const marks = roundMarks.slice();
    const got = marks.filter(Boolean).length;
    const remaining = wrongKeys.length;
    const retries = answeredTotal - firstPassAnswered;

    clear(root);
    root.append(topBar(i18n.t('common.back'), isRetry ? i18n.t('practice.fixing') : i18n.t('practice.checkpoint'), backGuard));
    root.append(h('div.mt'), paperHeader({
      kicker: isRetry ? i18n.t('practice.fixing') : i18n.t('practice.checkpoint'),
      title: (unit.typeName === 'HSE Packages' ? '' : unit.label + ' — ') + (runComplete && remaining > 0 ? i18n.t('practice.roundDone') : runComplete ? i18n.t('practice.allCorrect') : i18n.f('practice.gotOf', got, marks.length)),
      left: i18n.f('practice.answered', answeredTotal),
      right: i18n.f('practice.firstTime', firstPassRight, mainRun.length),
    }));

    const row = h('div.marks.mt2', { 'aria-hidden': 'true' });
    marks.forEach((ok) => row.append(h('i' + (ok ? '.y' : '.n'), null, ok ? '✓' : '✗')));
    for (let i = marks.length; i < ROUND; i++) row.append(h('i.blank'));
    root.append(row);

    const box = h('div.box.mt2');
    box.append(barLabel(i18n.t('practice.progress'), i18n.f('practice.firstPass', firstPassAnswered, mainRun.length)));
    const body = h('div', { style: { padding: '13px' } });
    body.append(ruleBar(Math.min(1, firstPassAnswered / Math.max(1, mainRun.length)), 'lg', { label: i18n.f('practice.firstPass', firstPassAnswered, mainRun.length) }));
    body.append(h('div.k-10', { style: { marginTop: '9px', color: remaining === 0 ? 'var(--rt-edge)' : 'var(--wr-edge)' } },
      remaining === 0 ? i18n.t('practice.nothingLeft') : i18n.f('practice.stillToGet', remaining)));
    if (retries > 0) body.append(h('div.k-9.dim', { style: { marginTop: '6px' } }, i18n.f('practice.retriesDone', retries)));
    box.append(body);
    root.append(box);

    const label = runComplete && remaining > 0 ? i18n.f('practice.retestMissed', remaining)
      : runComplete ? i18n.t('practice.seeResult')
      : i18n.t('practice.keepGoing');

    root.append(h('div.mt2'), button(label, {
      variant: 'ruled', size: 'lg', wide: true,
      onClick: () => {
        roundMarks = [];
        if (!runComplete) { ask(); return; }
        if (!wrongKeys.length) { finish(); return; }
        run = shuffled(wrongKeys.map((k) => byKey.get(k)).filter(Boolean));
        pos = 0;
        isRetry = true;
        ask();
      },
    }));
  }

  // ----------------------------------------------------------------- finish
  function finish(resuming) {
    phase = 'finish';
    const pct = Math.round((firstPassRight * 100) / Math.max(1, mainRun.length));
    if (!resuming) S.finishLearn(unitId, pct);
    S.clearSession(unitId, sessionMode);
    const extra = answeredTotal - mainRun.length;

    clear(root);
    root.append(topBar(i18n.t('common.back'), i18n.t('practice.complete'), leave));
    root.append(h('div.mt'), paperHeader({
      kicker: i18n.t('practice.complete'),
      title: unit.label,
      left: i18n.f('practice.firstTime', firstPassRight, mainRun.length),
      right: pct + '%',
    }));
    const box = h('div.note.good.mt2', { role: 'status' });
    box.append(h('div.k-11', { style: { color: 'var(--rt-edge)' } }, i18n.t('practice.everyCorrect')));
    box.append(h('div', { style: { fontFamily: 'var(--serif)', fontSize: '14px', marginTop: '6px' } },
      extra > 0 ? i18n.f('practice.extraTries', extra) : i18n.t('practice.straightThrough')));
    root.append(box);
    root.append(h('div.mt'), blockButton(i18n.t('practice.again'), i18n.t('practice.againCaption'), () => { fresh(); }));
    root.append(h('div.mt'), button(i18n.t('common.done'), { variant: 'ruled', size: 'lg', wide: true, onClick: leave }));
    root.append(h('div', { style: { height: '24px' } }));
  }
}
