import * as D from '../data.js';
import * as S from '../store.js';
import * as A from '../audio.js';
import * as i18n from '../i18n.js';
import { h, clear, cn, press, paperHeader, barLabel, button, hrule, topBar, posTag, speakerGlyph, highlight } from '../ui.js';

// The iPad master/detail layout switches at 768px. We keep a listener so a
// rotate/split-view resize rebuilds the layout; teardown() removes it on route
// change (main wires it like Cards).
let mqCleanup = null;
export function teardown() { if (mqCleanup) mqCleanup(); mqCleanup = null; }

export function render(root, unitId) {
  teardown();
  const unit = D.resolve(unitId);
  clear(root);
  if (!unit) { root.append(h('div.centre', null, h('div.k-11', null, i18n.t('unit.notFound')))); return; }

  const words = unit.words;
  let query = '';
  let openIndex = -1;      // phone: inline disclosure
  let selEntry = null;     // iPad: selected word

  const mq = matchMedia('(min-width: 768px)');
  const onChange = () => layout();
  mq.addEventListener('change', onChange);
  mqCleanup = () => mq.removeEventListener('change', onChange);

  A.prefetch(D.clipUrlsFor(unitId));

  let listBox, detailPane, clearBtn;

  const filtered = () => {
    const q = query.toLowerCase();
    if (!q) return words;
    return words.filter((e) =>
      e.w.toLowerCase().includes(q) || (e.c || '').includes(query) || (e.p || '').toLowerCase().includes(q));
  };

  function searchRow() {
    const input = h('input', {
      type: 'search', placeholder: i18n.t('pwa.searchHint'), value: query,
      'aria-label': i18n.t('study.find'),
      autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false',
      inputmode: 'search', enterkeyhint: 'search',
    });
    clearBtn = button('×', { size: 'sm', ariaLabel: i18n.t('common.close'), onClick: () => { input.value = ''; query = ''; openIndex = -1; paintList(); input.focus(); } });
    clearBtn.classList.toggle('hidden', !query);
    input.addEventListener('input', () => { query = input.value.trim(); openIndex = -1; paintList(); });
    return h('div.find', null, h('span.lbl', null, i18n.t('study.find')), input, clearBtn);
  }

  function layout() {
    const wide = mq.matches;
    clear(root);
    root.append(topBar(i18n.t('common.back'), i18n.t('mode.study'), () => { location.hash = '#/u/' + encodeURIComponent(unitId); }));
    root.append(h('div.mt'), paperHeader({
      kicker: unit.groupName || 'word list',
      title: unit.label,
      left: i18n.f('unit.words', words.length),
      right: i18n.t('study.tapToHear'),
    }));

    listBox = h('div.box' + (wide ? '.study-list' : ''));

    if (wide) {
      detailPane = h('div.box.study-detail');
      const left = h('div', null, searchRow(), h('div.mt'), listBox);
      root.append(h('div.study-cols.mt', null, left, detailPane));
      paintList();
      paintDetail();
    } else {
      detailPane = null;
      root.append(h('div.mt'), searchRow(), h('div.mt'), listBox);
      paintList();
    }
  }

  function paintList() {
    const wide = mq.matches;
    const shown = filtered();
    clear(listBox);
    if (clearBtn) clearBtn.classList.toggle('hidden', !query);
    listBox.append(barLabel(i18n.t('study.wordList'), i18n.f('study.shown', shown.length)));

    shown.forEach((e, idx) => {
      const n = words.indexOf(e) + 1;
      const known = S.statOf(unitId, e).known;
      const selected = wide && e === selEntry;
      const row = h('div.word-row' + (known ? '.known' : '') + (selected ? '.sel' : ''));

      const bodyKids = [
        h('div.row', null, h('span.w', null, e.w), speakerGlyph(), posTag(e.p)),
        e.c ? h('div.c', null, cn(e.c)) : null,
      ];
      let body;
      if (wide) {
        // Tapping the row selects it and shows the detail pane.
        body = press(h('button.body', { type: 'button', 'aria-current': selected ? 'true' : 'false', onclick: () => { selEntry = e; paintDetail(); paintList(); } }, ...bodyKids));
      } else {
        // Phone: tapping the word speaks it (gesture survives, nothing awaited).
        body = press(h('button.body', { type: 'button', 'aria-label': i18n.f('a11y.playWord'), onclick: () => A.speak(e.w) }, ...bodyKids));
      }

      let action;
      if (wide) {
        action = press(h('button.exp', { type: 'button', 'aria-label': i18n.t('a11y.playWord'), onclick: (ev) => { ev.stopPropagation(); A.speak(e.w); } }, '▶'));
      } else {
        const open = openIndex === idx;
        action = press(h('button.exp', { type: 'button', 'aria-expanded': open ? 'true' : 'false', onclick: () => { openIndex = open ? -1 : idx; paintList(); } },
          open ? i18n.t('study.hide') : i18n.t('study.details')));
      }

      row.append(h('span.n', { 'aria-hidden': 'true' }, String(n).padStart(2, '0')), body, action);
      listBox.append(row);

      if (!wide && openIndex === idx) listBox.append(detailBlock(e));
      if (idx !== shown.length - 1) listBox.append(hrule(true));
    });
  }

  function paintDetail() {
    if (!detailPane) return;
    clear(detailPane);
    detailPane.append(barLabel(i18n.t('mode.study')));
    const inner = h('div', { style: { padding: '16px' } });
    if (!selEntry) {
      inner.append(h('div.sd-empty', null,
        h('div.k-11', null, i18n.t('study.chooseWord')),
        h('div', { style: { marginTop: '8px' } }, i18n.t('study.chooseWordHelp'))));
      detailPane.append(inner);
      return;
    }
    const e = selEntry;
    inner.append(h('div.row', { style: { gap: '10px', flexWrap: 'wrap' } },
      h('div.sd-word', null, e.w), posTag(e.p),
      press(h('button.btn.thin.sm', { type: 'button', 'aria-label': i18n.t('a11y.playWord'), onclick: () => A.speak(e.w) }, '▶'))));
    if (e.c) inner.append(h('div.sd-block', null, h('div.cn', { lang: 'zh-Hans', style: { fontSize: '22px', lineHeight: '30px', fontWeight: '700' } }, e.c)));
    inner.append(detailBlock(e, true));
    detailPane.append(inner);
  }

  function detailBlock(e, plain) {
    const d = h('div' + (plain ? '' : '.word-detail'));
    if (plain) d.className = 'sd-block';
    if (e.e) {
      d.append(h('div.k-8', { style: { marginTop: plain ? '14px' : '0' } }, i18n.t('study.example')));
      d.append(h('div.ex', { style: { fontFamily: 'var(--serif)', fontSize: '14px', lineHeight: '21px', marginTop: '3px' } }, highlight(e.e, e.w)));
    }
    if (e.s || e.a) {
      const pair = h('div.row.mt', { style: { alignItems: 'flex-start', gap: '16px' } });
      if (e.s) pair.append(h('div.grow', null, h('div.k-8', null, i18n.t('study.same')), h('div', { style: { fontFamily: 'var(--serif)', fontSize: '14px' } }, e.s)));
      if (e.a) pair.append(h('div.grow', null, h('div.k-8', null, i18n.t('study.opposite')), h('div', { style: { fontFamily: 'var(--serif)', fontSize: '14px' } }, e.a)));
      d.append(pair);
    }
    if (!e.e && !e.s && !e.a) d.append(h('div.k-9.dim', { style: { marginTop: plain ? '14px' : '0' } }, i18n.t('study.noExample')));
    return d;
  }

  layout();
}
