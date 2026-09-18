import * as C from '../cloze-data.js';
import * as CS from '../cloze-store.js';
import * as P from '../profile.js';
import * as i18n from '../i18n.js';
import * as Activity from '../activity.js';
import { vocabulary } from '../passage.js';
import { h, clear, cn, press, paperHeader, barLabel, button, blockButton, gradeBlock, ruleBar, topBar, openDialog, announce, finishFlourish } from '../ui.js';

const PLACEHOLDER = /\{\{(\d+)\}\}/g;

function safeMode(mode) { return mode === 'test' ? 'test' : 'study'; }

function gradeName(grade) { return i18n.t(`cloze.grade${grade}`); }

function metadata(p) {
  return [p.year, p.term, p.area].filter(Boolean).join('  ·  ');
}

function articleText(passage) {
  const lines = String(passage.text || '').split('\n');
  if (lines.length > 1 && lines[0].trim().toLowerCase() === String(passage.title || '').trim().toLowerCase()) lines.shift();
  return lines.join('\n').trim();
}

function showLoadError(root, back) {
  clear(root);
  root.append(topBar(i18n.t('common.back'), i18n.t('cloze.title'), back));
  root.append(h('div.note.bad.mt2', null, h('div.k-11', null, i18n.t('cloze.loadError'))));
}

export async function render(root, requestedMode, grade, passageId) {
  const mode = safeMode(requestedMode);
  const backToList = () => { location.hash = mode === 'study' ? `#/cloze/study/${grade}` : `#/cloze/${grade}`; };
  clear(root);
  root.append(h('div.centre', null, h('div.k-11', { role: 'status' }, i18n.t('cloze.loading'))));
  try { await C.load(); } catch (err) { console.error(err); showLoadError(root, backToList); return; }

  const passage = C.get(passageId);
  if (!passage || C.gradeOf(passage.grade) !== String(grade)) { showLoadError(root, backToList); return; }
  const vocab = await vocabulary({ id: 'cloze-' + passage.id, title: C.sourceTitle(passage), route: `#/cloze/study/${grade}/${encodeURIComponent(passage.id)}` }, mode === 'study');

  let phase = 'asking';
  let answers = new Map();
  let activeFold = null;
  let recordedRun = null;

  const saved = CS.loadSession(passage.id, mode);
  if (saved && Array.isArray(saved.answers)) {
    saved.answers.forEach(([index, choice]) => {
      if (Number.isInteger(index) && Number.isInteger(choice) && passage.blanks[index] && passage.blanks[index].opts[choice] != null) {
        answers.set(index, choice);
      }
    });
  }

  function save() {
    if (phase !== 'asking') return;
    CS.saveSession(passage.id, mode, { answers: [...answers.entries()], at: Date.now() });
  }

  function score() {
    let correct = 0;
    passage.blanks.forEach((blank, index) => { if (answers.get(index) === blank.key) correct += 1; });
    return correct;
  }

  function record() {
    if (recordedRun) return recordedRun;
    recordedRun = CS.recordRun({
      id: passage.id, grade, mode, correct: score(), total: passage.blanks.length,
    });
    CS.clearSession(passage.id, mode);
    return recordedRun;
  }

  function closeFold(ref) {
    if (!ref || ref.panel.hidden) return;
    ref.panel.classList.remove('open');
    ref.button.setAttribute('aria-expanded', 'false');
    window.setTimeout(() => {
      if (!ref.panel.classList.contains('open')) ref.panel.hidden = true;
    }, 380);
    if (activeFold === ref) activeFold = null;
  }

  function openFold(ref) {
    if (activeFold === ref) { closeFold(ref); return; }
    if (activeFold) closeFold(activeFold);
    ref.panel.hidden = false;
    ref.button.setAttribute('aria-expanded', 'true');
    activeFold = ref;
    window.requestAnimationFrame(() => ref.panel.classList.add('open'));
  }

  function leaveGuard() {
    if (phase === 'asking' && answers.size > 0) {
      openDialog({
        title: i18n.t('session.leaveTitle'), body: i18n.t('cloze.leaveBody'),
        actions: [
          { label: i18n.t('session.stay'), variant: 'thin' },
          { label: i18n.t('session.leave'), variant: 'thin bad', onClick: backToList },
        ],
      });
    } else backToList();
  }

  function finishTest() {
    record();
    phase = 'result';
    paint();
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  function celebrate() {
    if (!recordedRun || !recordedRun.perfect) return;
    const overlay = h('div.cloze-celebration', { 'aria-hidden': 'true' });
    for (let i = 0; i < 30; i += 1) {
      const angle = (i / 30) * Math.PI * 2;
      const distance = 90 + (i % 6) * 22;
      const piece = h('i');
      piece.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
      piece.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
      piece.style.setProperty('--r', `${(i * 71) % 260 - 130}deg`);
      piece.style.setProperty('--delay', `${(i % 5) * 22}ms`);
      overlay.append(piece);
    }
    overlay.append(h('div.cloze-well-done', null, cn(i18n.f('cloze.wellDone', P.displayName()))));
    document.body.append(overlay);
    window.setTimeout(() => overlay.remove(), 3200);
  }

  function resultBlock() {
    const correct = score();
    const total = passage.blanks.length;
    const pct = total ? Math.floor((correct * 100) / total) : 0;
    const perfect = correct === total;
    const wrap = h('section.cloze-result', { 'aria-label': i18n.t('cloze.result') });
    if (perfect) wrap.append(h('div.cloze-perfect-banner', null,
      h('span.burst', { 'aria-hidden': 'true' }, '✶'),
      h('span', null, cn(i18n.f('cloze.wellDone', P.displayName()))),
      h('span.burst', { 'aria-hidden': 'true' }, '✶')));
    const grade = gradeBlock({
      pct, correct, total, passed: perfect || pct >= 80,
      caption: perfect ? i18n.t('cloze.everyRight') : i18n.f('cloze.score', correct, total),
    });
    grade.classList.add('mt2');
    wrap.append(grade);

    const wrong = passage.blanks.map((blank, index) => ({ blank, index }))
      .filter(({ blank, index }) => answers.get(index) !== blank.key);
    if (wrong.length) {
      const box = h('div.box.mt2');
      box.append(barLabel(i18n.t('cloze.review'), String(wrong.length)));
      wrong.forEach(({ blank, index }) => box.append(h('div.cloze-review-row', null,
        h('span.n', null, String(index + 1).padStart(2, '0')),
        h('span', null, blank.opts[blank.key]))));
      wrap.append(box);
    }
    wrap.append(h('div.mt'), blockButton(i18n.t('cloze.tryAgain'), i18n.t('cloze.tryAgainCaption'), () => {
      CS.clearSession(passage.id, mode);
      answers = new Map(); phase = 'asking'; recordedRun = null; paint(); window.scrollTo(0, 0);
    }));
    wrap.append(h('div.mt'), button(i18n.t('common.done'), { variant: 'ruled', size: 'lg', wide: true, onClick: backToList }));
    const gradeId = C.gradeOf(passage.grade);
    const rows = C.forGrade(gradeId);
    const next = rows[rows.findIndex(row => row.id === passage.id) + 1];
    if (next || mode === 'test') wrap.append(h('div.mt'), button(P.get().lang === 'zh' ? '下一篇练习' : 'Next exercise', { variant: 'ruled', wide: true, onClick: () => {
      const id = mode === 'test' ? CS.drawRandom(gradeId, rows.map(row => row.id), Math.random, passage.id) : next.id;
      if (!id) return;
      CS.clearSession(id, mode);
      const target = `#/cloze/${mode}/${gradeId}/${encodeURIComponent(id)}`;
      if (location.hash === target) render(root, mode, gradeId, id); else location.hash = target;
    } }));
    return wrap;
  }

  function makeBlank(index, resultMode, progress, resultMount) {
    const blank = passage.blanks[index];
    if (!blank) return document.createTextNode('_____');
    const chosen = answers.has(index) ? answers.get(index) : -1;
    const isCorrect = chosen === blank.key;
    const revealed = resultMode || (mode === 'study' && chosen >= 0);
    const shownText = chosen >= 0 ? blank.opts[chosen] : (resultMode ? blank.opts[blank.key] : '_____');
    const cls = revealed ? (isCorrect ? '.right' : '.wrong') : (chosen >= 0 ? '.answered' : '');
    const buttonEl = press(h(`button.cloze-blank${cls}`, {
      type: 'button', 'aria-expanded': 'false',
      'aria-label': i18n.f('cloze.blankLabel', index + 1, shownText),
    }, h('span.blank-no', { 'aria-hidden': 'true' }, String(index + 1)), h('span.blank-answer', null, shownText)));

    const optionWrap = h('span.cloze-options');
    const status = h('span.cloze-feedback', { role: 'status' });
    const inner = h('span.cloze-fold-inner', null,
      h('span.cloze-fold-bar', null,
        h('span', null, i18n.f('cloze.chooseAnswer', index + 1)),
        h('span.crease-mark', { 'aria-hidden': 'true' }, '◇')),
      optionWrap, status);
    const panel = h('span.cloze-fold', { hidden: true }, inner);
    const ref = { button: buttonEl, panel, index };
    buttonEl.addEventListener('click', () => openFold(ref));

    blank.opts.forEach((text, choice) => {
      const selected = choice === chosen;
      const correctChoice = choice === blank.key;
      let optionClass = selected ? '.selected' : '';
      if (revealed && correctChoice) optionClass += '.right';
      if (revealed && selected && !correctChoice) optionClass += '.wrong';
      const pick = press(h(`button${mode === 'study' ? '.cloze-pick' : '.cloze-option' + optionClass}`, {
        type: 'button', disabled: mode === 'study' && chosen >= 0 || resultMode,
        'aria-pressed': selected ? 'true' : 'false',
        'aria-label': `${String.fromCharCode(65 + choice)}. ${text}`,
      }, h('span.ltr', { 'aria-hidden': 'true' }, String.fromCharCode(65 + choice)), mode === 'test' ? h('span.txt', null, text) : null));
      const opt = mode === 'study' ? h(`div.cloze-option.cloze-option-study${optionClass}`, null, pick, h('span.txt', null, vocab.text(text, `option-${index}-${choice}`))) : pick;
      pick.addEventListener('click', () => {
        if (resultMode || (mode === 'study' && answers.has(index))) return;
        answers.set(index, choice);
        Activity.record('cloze-answer', { passageId: passage.id, grade, mode, question: index, response: choice });
        save();
        if (mode === 'test') {
          buttonEl.classList.add('answered');
          buttonEl.querySelector('.blank-answer').textContent = text;
          buttonEl.setAttribute('aria-label', i18n.f('cloze.blankLabel', index + 1, text));
          optionWrap.querySelectorAll('.cloze-option').forEach((el) => {
            el.classList.toggle('selected', el === opt);
            el.setAttribute('aria-pressed', el === opt ? 'true' : 'false');
          });
          progress.update();
          window.setTimeout(() => closeFold(ref), 180);
          return;
        }

        const ok = choice === blank.key;
        buttonEl.classList.add(ok ? 'right' : 'wrong');
        buttonEl.querySelector('.blank-answer').textContent = text;
        optionWrap.querySelectorAll('.cloze-option').forEach((el, optionIndex) => {
          el.disabled = true;
          const pick = el.querySelector('.cloze-pick'); if (pick) pick.disabled = true;
          if (optionIndex === blank.key) el.classList.add('right');
          if (optionIndex === choice && !ok) el.classList.add('wrong');
        });
        status.replaceChildren(
          h('strong', null, i18n.t(ok ? 'cloze.correct' : 'cloze.notQuite')),
          !ok ? document.createTextNode(` · ${i18n.f('cloze.answerIs', blank.opts[blank.key])}`) : null,
          blank.why ? h('span.why.cn', { lang: 'zh-Hans' }, blank.why) : null);
        progress.update();
        if (answers.size === passage.blanks.length) {
          record(); phase = 'result';
          root.querySelector('.cloze-end-note')?.remove();
          resultMount.append(resultBlock());
          announce(i18n.f('cloze.score', score(), passage.blanks.length), true);
          if (recordedRun.perfect) celebrate();
        }
      });
      optionWrap.append(opt);
    });

    if (revealed) {
      status.replaceChildren(
        h('strong', null, i18n.t(isCorrect ? 'cloze.correct' : 'cloze.notQuite')),
        !isCorrect ? document.createTextNode(` · ${i18n.f('cloze.answerIs', blank.opts[blank.key])}`) : null,
        blank.why ? h('span.why.cn', { lang: 'zh-Hans' }, blank.why) : null);
    } else if (mode === 'test') {
      status.textContent = i18n.t('cloze.hiddenUntilEnd');
    }
    return [buttonEl, panel];
  }

  function passageBody(resultMode, progress, resultMount) {
    const body = h('article.cloze-article');
    const paragraphs = articleText(passage).split(/\n\s*\n/).filter((p) => p.trim());
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const p = h('p');
      let at = 0;
      PLACEHOLDER.lastIndex = 0;
      let match;
      while ((match = PLACEHOLDER.exec(paragraph))) {
        if (match.index > at) p.append(vocab.text(paragraph.slice(at, match.index), String(paragraphIndex), at));
        p.append(...makeBlank(Number(match[1]) - 1, resultMode, progress, resultMount));
        at = match.index + match[0].length;
      }
      if (at < paragraph.length) p.append(vocab.text(paragraph.slice(at), String(paragraphIndex), at));
      body.append(p);
    });
    return body;
  }

  function paint() {
    activeFold = null;
    clear(root);
    const resultMode = phase === 'result';
    const wrap = h('div.cloze-screen');
    wrap.append(topBar(i18n.t('common.back'), i18n.t(`cloze.${mode}Mode`), leaveGuard));
    wrap.append(h('div.mt'), paperHeader({
      kicker: `${gradeName(grade)}  ·  ${i18n.t(`cloze.${mode}Mode`)}`,
      title: C.sourceTitle(passage),
      left: metadata(passage), right: `${passage.blanks.length} ${i18n.t('cloze.blanks')}`,
    }));


    const statusBox = h('div.cloze-status.mt', null,
      h('span.k-10', null, mode === 'test' && !resultMode ? i18n.t('cloze.hiddenUntilEnd') : i18n.t('cloze.tapBlank')),
      h('span.k-10', null, i18n.f('cloze.answered', answers.size, passage.blanks.length)));
    const progressText = statusBox.lastChild;
    const progressBar = ruleBar(answers.size / passage.blanks.length, 'sm', { label: progressText.textContent });
    const progress = { text: progressText, bar: progressBar, finish: null, update: () => {
      const pct = Math.round((answers.size / passage.blanks.length) * 100);
      progressText.textContent = i18n.f('cloze.answered', answers.size, passage.blanks.length);
      progressBar.firstChild.style.width = pct + '%';
      progressBar.setAttribute('aria-valuenow', String(pct));
      progressBar.setAttribute('aria-label', progressText.textContent);
      if (progress.finish) {
        const complete = answers.size === passage.blanks.length;
        progress.finish.disabled = !complete;
        progress.finish.classList.toggle('finish-ready', complete);
      }
    } };
    wrap.append(statusBox, progressBar);

    const resultMount = h('div');
    if (vocab.tools) wrap.append(vocab.tools, h('p.note', null, P.get().lang === 'zh' ? '点击选项字母作答；双击带点状下划线的词查看释义。' : 'Tap an option letter to answer; double-tap dotted words for meanings.'));
    wrap.append(h('div.cloze-paper.mt', null, passageBody(resultMode, progress, resultMount)));

    if (!resultMode && mode === 'test') {
      const finishButton = button(i18n.t('cloze.finish'), {
        variant: 'ruled', size: 'lg', wide: true, disabled: answers.size < passage.blanks.length,
        onClick: () => finishFlourish(finishButton, finishTest),
      });
      progress.finish = finishButton;
      progress.update();
      wrap.append(h('div.mt2'), finishButton);
    } else if (!resultMode) {
      wrap.append(h('div.cloze-end-note.mt2', null, i18n.t('cloze.answerAll')));
    }
    if (resultMode) resultMount.append(resultBlock());
    wrap.append(resultMount, h('div', { style: { height: '30px' } }));
    root.append(wrap);

    if (resultMode) {
      announce(i18n.f('cloze.score', score(), passage.blanks.length), true);
      window.setTimeout(celebrate, 80);
    }
  }

  paint();
}
