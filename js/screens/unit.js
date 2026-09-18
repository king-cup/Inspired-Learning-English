import * as D from '../data.js';
import * as S from '../store.js';
import * as A from '../audio.js';
import * as i18n from '../i18n.js';
import { h, clear, cn, paperHeader, barLabel, button, blockButton, ruleBar, hrule, topBar, shortDate, openDialog } from '../ui.js';

const dateTime = (ms) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms));

export function render(root, unitId) {
  const unit = D.resolve(unitId);
  clear(root);
  if (!unit) { root.append(h('div.centre', null, h('div.k-11', null, i18n.t('unit.notFound')))); return; }

  S.setLastUnit(unitId);   // powers the Library "Continue" shortcut (§10)

  const words = unit.words;
  const known = S.knownCount(unitId, words);
  const st = S.unitStat(unitId);
  const go = (mode) => () => { location.hash = `#/u/${encodeURIComponent(unitId)}/${mode}`; };

  root.append(topBar(i18n.t('common.back'), unit.typeName, () => { location.hash = '#/vocab'; }));

  const activeHeader = paperHeader({
    kicker: unit.groupName || i18n.t('lib.book'),
    title: unit.label,
    left: i18n.f('unit.words', words.length),
    right: st.lastMs ? i18n.f('unit.lastUsed', shortDate(st.lastMs)) : i18n.t('unit.notStarted'),
  });
  activeHeader.classList.add('active-lesson');
  root.append(h('div.mt'), activeHeader);

  const cols = h('div.unit-cols.mt');
  const primary = h('div.unit-primary');
  const secondary = h('div.unit-secondary');

  // --- record --------------------------------------------------------------
  const rec = h('div.box');
  rec.append(barLabel(i18n.t('unit.record'), i18n.f('unit.knownOf', known, words.length)));
  const body = h('div', { style: { padding: '13px' } });
  body.append(ruleBar(words.length ? known / words.length : 0, '', { label: i18n.f('unit.knownOf', known, words.length) }));
  const cells = h('div.statcells');
  const cell = (label, value) => h('div', null, h('div.k-8', null, cn(label)), h('div.v', null, value));
  cells.append(
    cell(i18n.t('unit.bestTest'), st.bestPct > 0 ? st.bestPct + '%' : '—'),
    cell(i18n.t('unit.lastTest'), st.tests.length > 0 ? st.lastPct + '%' : '—'),
    cell(i18n.t('unit.testsDone'), String(st.tests.length)),
    cell(i18n.t('unit.cardRuns'), String(st.cardRuns)));
  body.append(cells);
  rec.append(body);
  primary.append(rec);

  // --- modes, in teaching order -------------------------------------------
  const modes = h('div.stack.mt2');
  modes.append(blockButton(i18n.t('guided.title'), i18n.t('guided.caption'), go('guided')));
  modes.append(blockButton(i18n.t('mode.study'), i18n.t('mode.studyCaption'), go('study')));
  modes.append(blockButton(i18n.t('mode.practice'), i18n.t('mode.practiceCaption'), go('practice')));
  modes.append(blockButton(i18n.t('spelling.title'), i18n.t('spelling.caption'), go('spelling')));
  if (unit.typeName === 'HSE Packages') {
    modes.append(blockButton(i18n.t('mode.advanced'), i18n.t('mode.advancedCaption'), go('advanced')));
  }
  modes.append(
    blockButton(i18n.t('mode.cards'), i18n.t('mode.cardsCaption'), go('cards')),
    blockButton(i18n.t('mode.test'), i18n.f('mode.testCaption', S.PASS_PCT), go('test')));
  primary.append(modes);

  // --- words you keep missing (6.12) --------------------------------------
  const missed = words.map((e) => [e, S.statOf(unitId, e)])
    .filter(([, s]) => s.wrong >= 2 && s.wrong > s.right)
    .sort((a, b) => b[1].wrong - a[1].wrong)
    .slice(0, 12);
  const missBox = h('div.box.soft');
  missBox.append(barLabel(i18n.t('unit.missed'), missed.length ? String(missed.length) : ''));
  if (!missed.length) {
    missBox.append(h('div.panel-empty', null, i18n.t('unit.missedNone')));
  } else {
    const wrap = h('div', { style: { padding: '4px 0' } });
    missed.forEach(([e, s]) => wrap.append(h('div.miss-row', null,
      h('span.w', null, e.w, '   —   ', cn(e.c)),
      h('span.n', null, i18n.f('unit.missedTimes', s.wrong)))));
    missBox.append(wrap);
  }
  secondary.append(missBox);

  // --- test history --------------------------------------------------------
  const histBox = h('div.box.soft.mt');
  histBox.append(barLabel(i18n.t('unit.history'), st.tests.length ? String(st.tests.length) : ''));
  if (!st.tests.length) {
    histBox.append(h('div.panel-empty', null, i18n.t('unit.historyNone')));
  } else {
    const rows = st.tests.slice().reverse().slice(0, 12);
    rows.forEach((run, i) => {
      const passed = S.runPassed(run);
      histBox.append(h('div.hist-row' + (passed ? '.pass' : '.fail'), null,
        h('div.grow', null,
          h('div.a', null, cn(i18n.f('unit.attempt', run.attempt) + (run.retest ? '  ·  ' + i18n.t('unit.retestTag') : ''))),
          h('div.d', null, cn(dateTime(run.at) + '   ·   ' + i18n.f('test.scoreOf', run.correct, run.total)))),
        h('span.pct', null, S.runPct(run) + '%'),
        h('span.verdict', null, cn(passed ? i18n.t('unit.pass') : i18n.t('unit.fail')))));
      if (i !== rows.length - 1) histBox.append(hrule(true));
    });
  }
  secondary.append(histBox);

  // --- pronunciation (PWA-only offline download, with retry §9) ------------
  secondary.append(audioPanel(unitId));

  // --- reset ---------------------------------------------------------------
  const reset = button(i18n.t('unit.reset'), {
    variant: 'thin', size: 'sm', wide: true,
    onClick: () => confirmReset(root, unit),
  });
  secondary.append(h('div.mt2'), reset);

  cols.append(primary, secondary);
  root.append(cols, h('div', { style: { height: '24px' } }));
}

function audioPanel(unitId) {
  const urls = D.clipUrlsFor(unitId);
  const box = h('div.box.soft.mt');
  box.append(barLabel(i18n.t('pwa.pronunciation')));
  const body = h('div', { style: { padding: '13px' } });
  const state = h('div.k-10', { role: 'status' });
  const dl = button(i18n.t('pwa.download'), { variant: 'thin', size: 'sm', wide: true });
  const retry = button(i18n.t('audio.retryFailed'), { variant: 'thin bad', size: 'sm', wide: true });
  retry.classList.add('hidden');
  retry.style.marginTop = '8px';
  body.append(state, h('div.mt'), dl, retry);
  box.append(body);

  let failed = [];
  const refresh = async () => {
    const have = await A.cachedCount(urls);
    if (!urls.length) { state.textContent = i18n.t('pwa.noClips'); dl.classList.add('hidden'); return; }
    if (have >= urls.length) {
      state.textContent = i18n.f('pwa.readyOffline', have); state.style.color = 'var(--rt-edge)'; dl.classList.add('hidden');
    } else {
      state.textContent = i18n.f('pwa.someClips', have, urls.length); state.style.color = ''; dl.classList.remove('hidden');
    }
  };
  refresh();

  const run = async (target, btn, restore) => {
    btn.disabled = true;
    btn.textContent = i18n.f('pwa.downloading', 0, target.length);
    const res = await A.prefetch(target, { onProgress: (n, total) => { btn.textContent = i18n.f('pwa.downloading', n, total); } });
    btn.disabled = false; btn.textContent = restore;
    failed = res.failedUrls || [];
    if (failed.length) {
      retry.classList.remove('hidden');
      state.textContent = i18n.t('audio.someFailed'); state.style.color = 'var(--wr-edge)';
    } else { retry.classList.add('hidden'); await refresh(); }
  };
  dl.addEventListener('click', () => run(urls, dl, i18n.t('pwa.download')));
  retry.addEventListener('click', () => run(failed.slice(), retry, i18n.t('audio.retryFailed')));

  // Quietly warm this unit in the background. Median payload is ~106 KB.
  A.prefetch(urls).then(refresh);
  return box;
}

function confirmReset(root, unit) {
  openDialog({
    title: i18n.t('unit.resetAsk'),
    body: i18n.f('unit.resetBody', unit.label),
    actions: [
      { label: i18n.t('common.cancel'), variant: 'thin' },
      { label: i18n.t('unit.reset'), variant: 'thin bad', onClick: () => { S.resetUnit(unit.id); render(root, unit.id); } },
    ],
  });
}
