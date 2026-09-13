import * as C from '../cloze-data.js';
import * as CS from '../cloze-store.js';
import * as i18n from '../i18n.js';
import { h, clear, cn, press, paperHeader, barLabel, blockButton, topBar, hrule, shortDate } from '../ui.js';

const gradeName = (grade) => i18n.t(`cloze.grade${grade}`);
const safeGrade = (grade) => ['7', '8', '9'].includes(String(grade)) ? String(grade) : CS.get().lastGrade;

function loading(root) {
  clear(root);
  root.append(h('div.centre', null, h('div.k-11', { role: 'status' }, i18n.t('cloze.loading'))));
}

function loadError(root, err) {
  console.error('[cloze] could not load passages:', err);
  clear(root);
  root.append(topBar(i18n.t('common.back'), i18n.t('cloze.title'), () => { location.hash = '#/'; }));
  root.append(h('div.note.bad.mt2', null, h('div.k-11', null, i18n.t('cloze.loadError'))));
}

function gradeTabs(grade, target) {
  const tabs = h('div.cloze-grade-tabs', { role: 'group', 'aria-label': i18n.t('cloze.chooseGrade') });
  ['7', '8', '9'].forEach((g) => {
    const selected = g === grade;
    tabs.append(press(h('button.cloze-grade' + (selected ? '.on' : ''), {
      type: 'button', 'aria-pressed': selected ? 'true' : 'false',
      onclick: () => {
        CS.setLastGrade(g);
        location.hash = target === 'study' ? `#/cloze/study/${g}` : `#/cloze/${g}`;
      },
    }, h('span.n', null, g), h('span.l', null, gradeName(g)))));
  });
  return tabs;
}

function passageMeta(p) {
  return [p.year, p.term, p.area].filter(Boolean).join('  ·  ');
}

function startRandom(grade, pool) {
  const id = CS.drawRandom(grade, pool.map((p) => p.id));
  if (id) {
    CS.clearSession(id, 'test');
    location.hash = `#/cloze/test/${grade}/${encodeURIComponent(id)}`;
  }
}

export async function renderLanding(root, requestedGrade) {
  const pickedGrade = ['7', '8', '9'].includes(String(requestedGrade));
  const grade = pickedGrade ? String(requestedGrade) : safeGrade(requestedGrade);
  loading(root);
  try { await C.load(); } catch (err) { loadError(root, err); return; }
  const pool = C.forGrade(grade);
  if (pickedGrade) CS.setLastGrade(grade);
  clear(root);

  root.append(topBar(i18n.t('common.back'), i18n.t('cloze.reading'), () => { location.hash = '#/'; }));
  root.append(h('div.mt'), paperHeader({
    kicker: i18n.t('cloze.kicker'), title: i18n.t('cloze.title'),
    left: i18n.f('cloze.passages', pool.length), right: gradeName(grade),
  }));

  const gradeBox = h('div.box.mt');
  gradeBox.append(barLabel(i18n.t('cloze.chooseGrade')), gradeTabs(grade, 'landing'));
  root.append(gradeBox);

  // First visit is a clean grade choice. Study/Test appears only after a grade
  // is deliberately selected, which keeps the flow legible on a phone.
  if (!pickedGrade) {
    root.append(h('div', { style: { height: '30px' } }));
    return;
  }

  const modes = h('div.stack.mt2');
  modes.append(
    blockButton(i18n.t('cloze.studyMode'), i18n.t('cloze.studyCaption'), () => { location.hash = `#/cloze/study/${grade}`; }),
    blockButton(i18n.t('cloze.testMode'), i18n.t('cloze.testCaption'), () => startRandom(grade, pool)));
  root.append(modes);

  const allHistory = CS.historyForGrade(grade);
  const history = allHistory.slice(0, 12);
  const box = h('div.box.soft.mt2');
  box.append(barLabel(i18n.t('cloze.record'), allHistory.length ? String(allHistory.length) : ''));
  if (!history.length) {
    box.append(h('div.panel-empty', null, i18n.t('cloze.noRecord')));
  } else {
    history.forEach((run, index) => {
      const passage = C.get(run.id);
      if (!passage) return;
      const pct = CS.runPct(run);
      const row = press(h('button.cloze-history-row' + (run.perfect ? '.perfect' : ''), {
        type: 'button',
        onclick: () => {
          CS.clearSession(run.id, run.mode);
          location.hash = `#/cloze/${run.mode}/${grade}/${encodeURIComponent(run.id)}`;
        },
      },
        h('span.grow', null,
          h('span.a', null, cn(passage.title || passage.id)),
          h('span.d', null, `${shortDate(run.at)}  ·  ${i18n.t(`cloze.${run.mode}Mode`)}`)),
        h('span.pct', null, pct + '%'),
        h('span.verdict', null, run.perfect ? i18n.t('cloze.perfect') : i18n.t('cloze.redo'))));
      box.append(row);
      if (index !== history.length - 1) box.append(hrule(true));
    });
  }
  root.append(box, h('div', { style: { height: '26px' } }));
}

export async function renderStudyList(root, requestedGrade) {
  const grade = safeGrade(requestedGrade);
  loading(root);
  try { await C.load(); } catch (err) { loadError(root, err); return; }
  const pool = C.forGrade(grade);
  CS.setLastGrade(grade);
  clear(root);

  root.append(topBar(i18n.t('common.back'), i18n.t('cloze.studyMode'), () => { location.hash = `#/cloze/${grade}`; }));
  root.append(h('div.mt'), paperHeader({
    kicker: i18n.t('cloze.studyMode'), title: i18n.t('cloze.choosePassage'),
    left: i18n.f('cloze.passages', pool.length), right: gradeName(grade),
  }));

  const gradeBox = h('div.box.mt');
  gradeBox.append(barLabel(i18n.t('cloze.chooseGrade')), gradeTabs(grade, 'study'));
  root.append(gradeBox);

  const find = h('div.find.mt', null,
    h('div.lbl', null, i18n.t('study.find')),
    h('input', { type: 'search', inputmode: 'search', placeholder: i18n.t('cloze.search'), 'aria-label': i18n.t('cloze.search') }));
  root.append(find);

  const list = h('div.box.cloze-passage-list.mt');
  const label = barLabel(i18n.t('cloze.passagesLabel'), i18n.f('cloze.shown', pool.length));
  const rows = h('div');
  list.append(label, rows);
  root.append(list, h('div', { style: { height: '26px' } }));

  function paintRows(query = '') {
    clear(rows);
    const needle = query.trim().toLowerCase();
    const shown = pool.filter((p) => !needle || `${p.title} ${p.year} ${p.term} ${p.area}`.toLowerCase().includes(needle));
    label.lastChild.textContent = i18n.f('cloze.shown', shown.length);
    if (!shown.length) { rows.append(h('div.panel-empty', null, i18n.t('cloze.noMatches'))); return; }
    shown.forEach((p, index) => {
      const stat = CS.statsFor(p.id);
      const row = press(h('button.cloze-passage-row' + (stat.perfect ? '.perfect' : ''), {
        type: 'button', onclick: () => {
          location.hash = `#/cloze/study/${grade}/${encodeURIComponent(p.id)}`;
        },
      },
        h('span.num', null, p.id.replace(/^R/, '')),
        h('span.grow', null,
          h('span.title', null, cn(p.title || p.id)),
          h('span.meta', null, cn(passageMeta(p)))),
        stat.attempts ? h('span.score', null,
          h('span', null, stat.bestPct + '%'),
          h('small', null, stat.perfect ? i18n.t('cloze.perfect') : i18n.f('cloze.attempts', stat.attempts))) : h('span.chev', { 'aria-hidden': 'true' }, '›')));
      rows.append(row);
      if (index !== shown.length - 1) rows.append(hrule(true));
    });
  }

  find.lastChild.addEventListener('input', (ev) => paintRows(ev.target.value));
  paintRows();
}
