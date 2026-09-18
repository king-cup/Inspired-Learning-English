import * as D from '../data.js';
import * as AP from '../advanced-data.js';
import * as i18n from '../i18n.js';
import * as Activity from '../activity.js';
import { h, clear, cn, press, paperHeader, barLabel, button, ruleBar, topBar, gradeBlock } from '../ui.js';

export async function render(root, unitId) {
  const unit = D.resolve(unitId);
  const leave = () => { location.hash = '#/u/' + encodeURIComponent(unitId); };
  clear(root);
  root.append(h('div.centre', null, h('div.k-11', { role: 'status' }, i18n.t('advanced.loading'))));

  let pool = [];
  try { pool = await AP.forUnit(unitId); }
  catch (err) { console.error('[advanced-practice]', err); }

  if (!unit || unit.typeName !== 'HSE Packages' || !pool.length) {
    clear(root);
    root.append(topBar(i18n.t('common.back'), i18n.t('mode.advanced'), leave));
    root.append(h('div.note.bad.mt2', null, h('div.k-11', null, i18n.t('advanced.empty'))));
    return;
  }

  let pos = 0;
  let chosen = -1;
  let correct = 0;

  function paint() {
    const q = pool[pos];
    clear(root);
    root.append(topBar(i18n.t('common.back'), i18n.t('mode.advanced'), leave));

    const progress = h('div.row.mt', null,
      h('span.k-11', null, i18n.f('advanced.question', pos + 1, pool.length)),
      ruleBar(pos / pool.length, 'sm', { label: i18n.f('advanced.question', pos + 1, pool.length) }));
    progress.lastChild.classList.add('grow');
    root.append(progress);

    if (q.context) {
      const context = h('div.box.advanced-context.mt');
      context.append(barLabel(q.sourceTitle || unit.label, i18n.t('advanced.reading')),
        h('div.advanced-passage', null, cn(q.context)));
      root.append(context);
    }

    const box = h('div.box.mt');
    box.append(barLabel(q.section || i18n.t('mode.advanced'), q.sourceTitle || unit.label));
    box.append(h('div.advanced-prompt', null, cn(q.stem)));
    root.append(box);

    const answered = chosen >= 0;
    const options = h('div.stack.mt');
    q.options.forEach((text, index) => {
      let cls = '';
      if (answered && index === q.key) cls = '.right';
      else if (answered && index === chosen) cls = '.wrong';
      const option = press(h(`button.opt${cls}`, { type: 'button', disabled: answered },
        h('span.ltr', { 'aria-hidden': 'true' }, 'ABCD'[index]),
        h('span.txt', null, cn(text))));
      if (!answered) option.addEventListener('click', () => answer(index));
      options.append(option);
    });
    root.append(options);

    if (answered) {
      const right = chosen === q.key;
      const feedback = h(`div.note.mt.${right ? 'good' : 'bad'}`, { role: 'status' },
        h('div.k-13', null, i18n.t(right ? 'advanced.correct' : 'advanced.notQuite')),
        right ? null : h('div.advanced-answer', null, cn(i18n.f('advanced.answer', q.options[q.key]))));
      root.append(feedback, h('div.sticky-foot', null,
        button(pos === pool.length - 1 ? i18n.t('advanced.seeResult') : i18n.t('advanced.next'), {
          variant: 'ruled', size: 'lg', wide: true, onClick: next,
        })));
    }
    root.append(h('div', { style: { height: '28px' } }));
  }

  function answer(index) {
    if (chosen >= 0) return;
    chosen = index;
    Activity.record('advanced-answer', { unitId, question: pool[pos].id || pos, response: index, correct: index === pool[pos].key });
    if (index === pool[pos].key) correct += 1;
    paint();
  }

  function next() {
    if (pos >= pool.length - 1) { finish(); return; }
    pos += 1;
    chosen = -1;
    paint();
    window.scrollTo(0, 0);
  }

  function finish() {
    Activity.record('advanced-completed', { unitId, correct, total: pool.length });
    clear(root);
    root.append(topBar(i18n.t('common.back'), i18n.t('advanced.complete'), leave));
    root.append(h('div.mt'), paperHeader({
      kicker: i18n.t('advanced.complete'), title: unit.label,
      left: i18n.f('advanced.score', correct, pool.length),
      right: Math.floor((correct * 100) / pool.length) + '%',
    }));
    const result = gradeBlock({
      pct: Math.floor((correct * 100) / pool.length), correct, total: pool.length,
      passed: correct / pool.length >= .8, caption: i18n.f('advanced.score', correct, pool.length),
    });
    result.classList.add('mt2');
    root.append(result,
      h('div.mt2', null, button(i18n.t('advanced.again'), {
        variant: 'ruled', size: 'lg', wide: true,
        onClick: () => { pos = 0; chosen = -1; correct = 0; paint(); window.scrollTo(0, 0); },
      })),
      h('div.mt', null, button(i18n.t('common.done'), { variant: 'thin', size: 'lg', wide: true, onClick: leave })));
  }

  paint();
}
