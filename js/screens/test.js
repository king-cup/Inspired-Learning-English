// Test mode (6.5). Summative assessment: no feedback until Complete. The student
// picks the length, can move back and forward and change answers, and only then
// does anything turn green or red.
//
// v1.02:
//  - §4 WEB TEST EXCEPTION: Test asks only the two recall directions
//    (English->Chinese, Chinese->English); sentence-gap items are excluded here
//    but remain in Practice. Enforced via build(entry, pool, { allowedTypes }).
//  - §5 large, labelled prev/next arrows.
//  - §6 the run is persisted so a refresh/interruption can resume.
//
// Scoring is Peter's decision (store.recordTestAnswer): a test never PROMOTES a
// word to known, but a wrong answer demotes it. The fail message ships as he
// wrote it.

import * as D from '../data.js';
import * as S from '../store.js';
import { build, instructionFor, tagFor, QType } from '../learn-engine.js';
import * as P from '../profile.js';
import * as i18n from '../i18n.js';
import { h, clear, cn, press, paperHeader, barLabel, button, blockButton, gradeBlock, ruleBar, tag, posTag, topBar, shuffled, openDialog, announce, finishFlourish } from '../ui.js';

const TEST_TYPES = [QType.WORD_TO_MEANING, QType.MEANING_TO_WORD];

export function render(root, unitId) {
  const unit = D.resolve(unitId);
  clear(root);
  const backToUnit = () => { location.hash = '#/u/' + encodeURIComponent(unitId); };

  if (!unit) { root.append(h('div.centre', null, h('div.k-11', null, i18n.t('unit.notFound')))); return; }

  const pool = unit.words;
  if (pool.length < 2) {
    root.append(topBar(i18n.t('common.back'), i18n.t('mode.test'), backToUnit));
    root.append(h('div.centre', null, h('div.k-11', null, i18n.t('practice.tooShort'))));
    return;
  }

  const byKey = new Map(pool.map((e) => [S.wordKey(unitId, e), e]));

  let phase = 'setup';
  let isRetest = false;
  let questions = [];
  let pos = 0;
  const answers = new Map();     // question index -> chosen option index
  let wrongEntries = [];
  let score = 0;

  function saveState() {
    if (phase !== 'asking') return;
    S.saveSession(unitId, 'test', {
      mode: 'test', phase, isRetest, pos,
      questions: questions.map((q) => ({
        entryKey: S.wordKey(unitId, q.entry), type: q.type,
        prompt: q.prompt, subPrompt: q.subPrompt, options: q.options, correctIndex: q.correctIndex,
      })),
      answers: [...answers.entries()],
    });
  }

  function startTest(entries, retest) {
    questions = shuffled(entries).map((e) => build(e, pool, { allowedTypes: TEST_TYPES }));
    answers.clear();
    pos = 0;
    isRetest = retest;
    phase = 'asking';
    saveState();
    paint();
  }

  function restore(s) {
    questions = s.questions.map((q) => ({
      entry: byKey.get(q.entryKey), type: q.type, prompt: q.prompt,
      subPrompt: q.subPrompt, options: q.options, correctIndex: q.correctIndex,
    })).filter((q) => q.entry);
    if (questions.length !== s.questions.length) { S.clearSession(unitId, 'test'); phase = 'setup'; paint(); return; }
    answers.clear();
    (s.answers || []).forEach(([k, v]) => answers.set(k, v));
    pos = Math.min(s.pos || 0, questions.length - 1);
    isRetest = !!s.isRetest;
    phase = 'asking';
    paint();
  }

  function finish() {
    let correct = 0;
    const wrong = [];
    questions.forEach((q, i) => {
      const ok = answers.get(i) === q.correctIndex;
      if (ok) correct += 1; else wrong.push(q.entry);
      S.recordTestAnswer(unitId, q.entry, ok);
    });
    score = correct;
    wrongEntries = wrong;
    S.finishTest(unitId, correct, questions.length, isRetest);
    S.clearSession(unitId, 'test');
    phase = 'result';
    paint();
  }

  function leaveGuard() {
    if (phase === 'asking' && answers.size > 0) {
      openDialog({
        title: i18n.t('session.leaveTitle'),
        body: i18n.t('session.leaveBody'),
        actions: [
          { label: i18n.t('session.stay'), variant: 'thin' },
          { label: i18n.t('session.leave'), variant: 'thin bad', onClick: backToUnit },
        ],
      });
    } else { backToUnit(); }
  }

  // Entry: resume an interrupted test, or open setup.
  const saved = S.loadSession(unitId, 'test');
  if (saved && saved.phase === 'asking' && Array.isArray(saved.questions) && saved.questions.length) {
    openDialog({
      title: i18n.t('session.resumeTitle'),
      body: i18n.t('session.resumeTest'),
      actions: [
        { label: i18n.t('session.startOver'), variant: 'thin', onClick: () => { S.clearSession(unitId, 'test'); phase = 'setup'; paint(); } },
        { label: i18n.t('session.resume'), variant: 'thin', onClick: () => restore(saved) },
      ],
    });
    // Render setup underneath the dialog as a sensible fallback.
    paint();
  } else {
    paint();
  }

  function paint() {
    clear(root);
    const wrap = h('div.col-narrow');
    if (phase === 'setup') paintSetup(wrap);
    else if (phase === 'asking') paintAsking(wrap);
    else paintResult(wrap);
    root.append(wrap);
  }

  // ------------------------------------------------------------------- setup
  function paintSetup(r) {
    r.append(topBar(i18n.t('common.back'), i18n.t('mode.test'), backToUnit));
    r.append(h('div.mt'), paperHeader({
      kicker: unit.groupName || i18n.t('lib.book'),
      title: unit.label,
      left: i18n.t('test.setup'),
      right: i18n.f('unit.words', pool.length),
    }));

    const box = h('div.box.mt');
    box.append(barLabel(i18n.t('test.howMany')));
    box.append(h('div', { style: { padding: '13px', fontFamily: 'var(--serif)', fontSize: '14px' } }, i18n.f('test.lengthHelp', S.PASS_PCT)));
    r.append(box);

    const opts = h('div.stack.mt');
    if (pool.length >= 10) opts.append(blockButton(i18n.t('test.ten'), '', () => startTest(shuffled(pool).slice(0, 10), false)));
    if (pool.length >= 20) opts.append(blockButton(i18n.t('test.twenty'), '', () => startTest(shuffled(pool).slice(0, 20), false)));
    opts.append(blockButton(i18n.f('test.all', pool.length), '', () => startTest(pool, false)));
    r.append(opts);
    r.append(h('div', { style: { height: '30px' } }));
  }

  // ------------------------------------------------------------------ asking
  function paintAsking(r) {
    const q = questions[Math.min(pos, questions.length - 1)];
    const chosen = answers.has(pos) ? answers.get(pos) : -1;

    r.append(topBar(i18n.t('common.back'), isRetest ? i18n.t('test.retestTitle') : i18n.t('mode.test'), leaveGuard));

    const prog = h('div.row.mt', null,
      h('span.k-11', null, i18n.f('test.q', pos + 1, questions.length)),
      ruleBar(answers.size / questions.length, 'sm', { label: i18n.f('test.answered', answers.size) }));
    prog.lastChild.classList.add('grow');
    r.append(prog);
    r.append(h('div.k-8.dim', { style: { marginTop: '5px' } }, i18n.t('test.noAnswersYet')));

    // prompt
    const box = h('div.box.mt');
    box.append(barLabel(instructionFor(q.type), tagFor(q.type)));
    const body = h('div', { style: { padding: '16px' } });
    const promptCn = q.type === QType.MEANING_TO_WORD;   // Chinese gloss prompt
    if (q.type === QType.SENTENCE_GAP) {
      body.append(h('div', { style: { fontFamily: 'var(--serif)', fontSize: '17px', lineHeight: '26px' } }, q.prompt));
    } else if (promptCn) {
      body.append(h('div.cn', { lang: 'zh-Hans', style: { fontSize: '28px', lineHeight: '36px', fontWeight: '700' } }, q.prompt));
      if (q.subPrompt) { const p = posTag(q.subPrompt); if (p) body.append(h('div.mt', null, p)); }
    } else {
      body.append(h('div', { style: { fontFamily: 'var(--serif)', fontSize: '28px', lineHeight: '34px', fontWeight: 'bold' } }, q.prompt));
      if (q.subPrompt) { const p = posTag(q.subPrompt); if (p) body.append(h('div.mt', null, p)); }
    }
    box.append(body);
    r.append(box);

    // options -- selected, never marked right/wrong
    const optsCn = q.type === QType.WORD_TO_MEANING;   // Chinese meaning options
    const optsWrap = h('div.stack.mt');
    q.options.forEach((text, i) => {
      const sel = i === chosen;
      const el = press(h('button.opt' + (sel ? '.sel' : ''), {
        type: 'button', 'aria-pressed': sel ? 'true' : 'false',
        onclick: () => { answers.set(pos, i); saveState(); paint(); },
      },
        h('span.ltr', { 'aria-hidden': 'true' }, 'ABCD'[i]),
        h('span.txt', null, optsCn ? cn(text) : text),
        sel ? h('span.selmark', { 'aria-hidden': 'true' }, '✓') : null));
      optsWrap.append(el);
    });
    r.append(optsWrap);

    // A test can only finish after every word has an answer. On the final
    // question the forward control itself morphs into Finish, keeping one
    // clear primary action instead of offering an early-submit escape hatch.
    const atEnd = pos >= questions.length - 1;
    const prev = navBtn(i18n.t('test.previousWord'), i18n.t('a11y.prevQuestion'), pos === 0,
      () => { if (pos > 0) { pos -= 1; saveState(); paint(); } });
    let next;
    const advance = () => {
      if (!atEnd) { pos += 1; saveState(); paint(); return; }
      if (answers.size === questions.length) { finishFlourish(next, finish); return; }
      const missing = questions.findIndex((_, i) => !answers.has(i));
      if (missing >= 0) { pos = missing; saveState(); announce(i18n.t('test.findUnanswered'), true); paint(); }
    };
    next = navBtn(atEnd ? i18n.t('test.finish') : i18n.t('test.nextWord'), i18n.t('a11y.nextQuestion'), false, advance, true);
    if (atEnd) next.classList.add('finish-ready');
    r.append(h('div.test-nav.mt', null, prev, next));
    r.append(h('div', { style: { height: '28px' } }));
  }

  function navBtn(text, label, disabled, onClick, grow) {
    const el = h('button.navbtn' + (grow ? '.grow' : ''), { type: 'button', 'aria-label': label }, cn(text));
    if (disabled) el.disabled = true;
    el.addEventListener('click', onClick);
    return press(el);
  }

  // ------------------------------------------------------------------ result
  function paintResult(r) {
    const total = questions.length;
    const pct = total ? Math.floor((score * 100) / total) : 0;
    const passed = pct >= S.PASS_PCT;
    const name = P.displayName();

    r.append(topBar(i18n.t('common.back'), i18n.t('test.result'), backToUnit));
    r.append(h('div.mt'), paperHeader({
      kicker: i18n.t('test.result'),
      title: unit.label,
      left: i18n.f('test.scoreOf', score, total),
      right: passed ? i18n.t('unit.pass') : i18n.t('unit.fail'),
    }));

    r.append(h('div.mt2'), gradeBlock({
      pct, correct: score, total, passed,
      caption: passed ? i18n.f('test.passedMsg', name) : i18n.f('test.failedMsg', name),
    }));
    announce(i18n.f('test.scoreOf', score, total) + ' · ' + (passed ? i18n.t('unit.pass') : i18n.t('unit.fail')), true);

    if (!wrongEntries.length) {
      r.append(h('div.note.good.mt2', null, h('div.k-11', { style: { color: 'var(--rt-edge)' } }, i18n.t('test.allRight'))));
    } else {
      const box = h('div.box.mt2', { style: { borderColor: 'var(--wr-edge)' } });
      box.append(barLabel(i18n.t('test.gotWrong'), String(wrongEntries.length)));
      const list = h('div', { style: { background: 'var(--wr)', padding: '12px' } });
      wrongEntries.forEach((e) => list.append(h('div', { style: { fontFamily: 'var(--serif)', fontSize: '14px', padding: '3px 0' } },
        e.w, '  ·  ', i18n.displayPos(e.p), '   —   ', cn(e.c))));
      box.append(list);
      r.append(box);
      r.append(h('div.mt'), blockButton(i18n.f('test.retestWrong', wrongEntries.length), i18n.t('test.retestCaption'), () => startTest(wrongEntries, true)));
    }

    r.append(h('div.mt'), blockButton(i18n.t('test.takeAgain'), i18n.t('test.takeAgainCaption'), () => { phase = 'setup'; paint(); }));
    r.append(h('div.mt'), button(i18n.t('common.done'), { variant: 'ruled', size: 'lg', wide: true, onClick: backToUnit }));
    r.append(h('div', { style: { height: '24px' } }));
  }
}
