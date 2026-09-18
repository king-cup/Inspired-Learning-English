import * as D from '../data.js';
import * as S from '../store.js';
import * as A from '../audio.js';
import * as P from '../profile.js';
import * as i18n from '../i18n.js';
import { h, clear, press, paperHeader, barLabel, button, blockButton, ruleBar, hrule, dropdown, topBar } from '../ui.js';

const SEL = 'vd.lib.sel';
const readSel = () => { try { return JSON.parse(localStorage.getItem(SEL) || sessionStorage.getItem(SEL)) || { t: 0, g: 0 }; } catch (e) { return { t: 0, g: 0 }; } };
const writeSel = (v) => { try { localStorage.setItem(SEL, JSON.stringify(v)); } catch (e) {} };

export function render(root) {
  const types = D.types();
  clear(root);
  if (!types.length) { root.append(h('div.centre', null, h('div.k-11', null, i18n.t('lib.empty')))); return; }

  const sel = readSel();
  const t = types[Math.min(sel.t, types.length - 1)];
  const g = t.groups[Math.min(sel.g, t.groups.length - 1)];
  const name = P.displayName();

  root.append(topBar(i18n.t('common.back'), i18n.t('home.vocabulary'), () => { location.hash = '#/'; }));

  // Header: full width on iPad; the unit/word totals are gone (6.1), the
  // student's own name is more use to them than a corpus statistic.
  root.append(h('div.mt'), paperHeader({
    kicker: i18n.t('app.kicker'),
    title: i18n.t('home.vocabulary'),
    left: name ? i18n.f('lib.hello', name) : '',
    right: 'v' + D.APP_VERSION,
  }));

  // Two-column grid on iPad (§11); a single column on phone.
  const cols = h('div.lib-cols.mt');
  const side = h('div.lib-side');
  const main = h('div.lib-main');

  // --- continue where you left off (§10) -----------------------------------
  const lastId = S.getLastUnit();
  const lastUnit = lastId ? D.resolve(lastId) : null;
  if (lastUnit) {
    side.append(blockButton(i18n.f('lib.continue', lastUnit.label), i18n.t('lib.continueKick'),
      () => { location.hash = '#/u/' + encodeURIComponent(lastUnit.id); }));
    side.append(h('div.mt'));
  }

  // --- selectors: dropdowns (6.3), one closes when the other opens (§10) ----
  const selBox = h('div.box');
  selBox.append(dropdown({
    label: i18n.t('lib.listType'),
    value: t.type,
    options: types.map((tb) => tb.type),
    onPick: (i) => { writeSel({ t: i, g: 0 }); render(root); },
  }));
  selBox.append(hrule());
  selBox.append(dropdown({
    label: (t.groupLabel || '').toLowerCase() === 'book' ? i18n.t('lib.book') : i18n.t('lib.group'),
    value: g.name,
    options: t.groups.map((grp) => grp.name),
    onPick: (i) => { writeSel({ t: sel.t, g: i }); render(root); },
  }));
  side.append(selBox);
  side.append(h('div.mt'), offlineBox());

  // --- units ---------------------------------------------------------------
  const done = g.units.filter((u) => {
    const w = D.wordsFor(u.id);
    return w.length && S.knownCount(u.id, w) === w.length;
  }).length;

  const list = h('div.box.lib-units');
  list.append(barLabel(i18n.t('lib.units'), i18n.f('lib.complete', done, g.units.length)));
  g.units.forEach((u, i) => {
    const words = D.wordsFor(u.id);
    const known = S.knownCount(u.id, words);
    const st = S.unitStat(u.id);
    const frac = words.length ? known / words.length : 0;
    // Book and unit names are the publishers' English titles and stay English
    // in both interfaces (6.6).
    const row = press(h('button.unit-row' + (lastId === u.id ? '.active-lesson' : ''), { type: 'button', onclick: () => { location.hash = '#/u/' + encodeURIComponent(u.id); } },
      h('div.grow', null,
        h('div.label', null, D.resolve(u.id).label),
        h('div.meta', null,
          ruleBar(frac, 'sm', { label: i18n.f('lib.known', known, words.length) }),
          h('span.k-9', null, i18n.f('lib.known', known, words.length) + (st.bestPct > 0 ? '   ·   ' + i18n.f('lib.best', st.bestPct) : ''))
        )),
      h('span.chev', { 'aria-hidden': 'true' }, '›')));
    list.append(row);
    if (i !== g.units.length - 1) list.append(hrule(true));
  });
  main.append(list);

  cols.append(side, main);
  root.append(cols);
}

/** One Wi-Fi session, then a term of offline use. PWA-only (the APK bundles
 *  audio); its strings live in the pwa.* section of the table. */
function offlineBox() {
  const box = h('div.box.soft');
  box.append(barLabel(i18n.t('pwa.offlineAudio')));
  const body = h('div', { style: { padding: '13px' } });
  const state = h('div.k-10', { role: 'status' });
  const bar = ruleBar(0, '', { label: i18n.t('pwa.offlineAudio') });
  const dl = button(i18n.t('pwa.downloadAll'), { variant: 'thin', size: 'sm', wide: true });
  const retry = button(i18n.t('audio.retryFailed'), { variant: 'thin bad', size: 'sm', wide: true });
  retry.classList.add('hidden');
  retry.style.marginTop = '8px';
  const failNote = h('div.field-help.warn.hidden', null, i18n.t('audio.someFailed'));
  body.append(state, h('div.mt'), bar, h('div.mt'), dl, retry, failNote);
  box.append(body);

  const urls = D.allClipUrls();
  let failedUrls = [];

  const refresh = async () => {
    const have = await A.cachedCount(urls);
    bar.firstChild.style.width = Math.round((have / Math.max(1, urls.length)) * 100) + '%';
    if (have >= urls.length && urls.length) {
      state.textContent = i18n.f('pwa.allClips', urls.length);
      state.style.color = 'var(--rt-edge)';
      dl.classList.add('hidden');
    } else {
      state.textContent = i18n.f('pwa.someClipsAll', have, urls.length);
      state.style.color = '';
      dl.classList.remove('hidden');
    }
  };
  refresh();

  const run = async (targetUrls, btn, restoreLabel) => {
    btn.disabled = true;
    failNote.classList.add('hidden');
    const res = await A.prefetch(targetUrls, {
      allInOne: true,
      concurrency: 6,
      onProgress: (n, total) => {
        btn.textContent = i18n.f('pwa.downloading', n, total);
        // reflect overall coverage while working
      },
    });
    btn.disabled = false;
    btn.textContent = restoreLabel;
    failedUrls = res.failedUrls || [];
    if (failedUrls.length) {
      // Do NOT silently reset (§9): keep the failure visible and offer a retry.
      failNote.classList.remove('hidden');
      retry.classList.remove('hidden');
      state.textContent = `${i18n.f('audio.downloadedN', res.done)} · ${i18n.f('audio.failedN', failedUrls.length)}`;
      state.style.color = 'var(--wr-edge)';
    } else {
      retry.classList.add('hidden');
      await refresh();
    }
  };

  dl.addEventListener('click', () => run(urls, dl, i18n.t('pwa.downloadAll')));
  retry.addEventListener('click', () => { const t = failedUrls.slice(); run(t, retry, i18n.t('audio.retryFailed')); });

  return box;
}
