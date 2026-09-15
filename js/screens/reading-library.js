import * as C from '../curriculum-data.js';
import * as S from '../curriculum-store.js';
import * as P from '../profile.js';
import { h, clear, cn, paperHeader, topBar, barLabel, press, ruleBar } from '../ui.js';

const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;

export async function render(root) {
  clear(root);
  root.append(h('div.centre', null, h('div.k-11', { role: 'status' }, tr('Loading reading library…', '正在加载阅读库…'))));
  let data;
  try { data = await C.loadReading(); }
  catch (error) { console.error(error); clear(root); root.append(topBar(tr('← Back', '← 返回'), tr('Reading Comprehension', '阅读理解'), () => { location.hash = '#/'; }), h('div.note.bad.mt2', null, tr('The reading library could not be loaded.', '无法加载阅读库。'))); return; }
  clear(root);
  root.append(topBar(tr('← Back', '← 返回'), tr('Reading Comprehension', '阅读理解'), () => { location.hash = '#/'; }));
  const completed = data.articles.filter((article) => S.articleState(article.id).completedAt).length;
  root.append(h('div.mt'), paperHeader({ kicker: tr('reading library', '阅读库'), title: tr('Reading Comprehension', '阅读理解'), left: `${data.articles.length} ${tr('articles', '篇文章')}`, right: `${completed}/${data.articles.length}` }));

  const filters = h('div.reading-filters.box.mt');
  const level = select(tr('Level', '级别'), [['', tr('All levels', '全部级别')], ...data.levels.map((row) => [row.id, row.label])]);
  const unit = select(tr('Unit', '单元'), [['', tr('All units', '全部单元')], ...Array.from({ length: 12 }, (_, i) => [String(i + 1), `${tr('Unit', '单元')} ${i + 1}`])]);
  const letter = select(tr('Reading', '篇目'), [['', tr('A or B', 'A 或 B')], ['A', 'A'], ['B', 'B']]);
  const status = select(tr('Status', '状态'), [['', tr('Any status', '全部状态')], ['new', tr('Not started', '尚未开始')], ['progress', tr('In progress', '进行中')], ['done', tr('Completed', '已完成')]]);
  const search = h('label.filter-field', null, h('span.k-9', null, tr('Article title', '文章标题')), h('input', { type: 'search', placeholder: tr('Search titles', '搜索标题'), 'aria-label': tr('Search article titles', '搜索文章标题') }));
  filters.append(level.wrap, unit.wrap, letter.wrap, status.wrap, search);
  root.append(filters);
  const box = h('div.box.mt');
  const label = barLabel(tr('Articles', '文章'), String(data.articles.length));
  const list = h('div.reading-list');
  box.append(label, list);
  root.append(box, h('div', { style: { height: '28px' } }));

  function paint() {
    clear(list);
    const query = search.lastChild.value.trim().toLowerCase();
    const rows = data.articles.filter((article) => {
      const progress = S.articleState(article.id);
      const state = progress.completedAt ? 'done' : Object.keys(progress).length ? 'progress' : 'new';
      return (!level.el.value || article.levelId === level.el.value)
        && (!unit.el.value || String(article.unit) === unit.el.value)
        && (!letter.el.value || article.reading === letter.el.value)
        && (!status.el.value || state === status.el.value)
        && (!query || article.title.toLowerCase().includes(query));
    });
    label.lastChild.textContent = String(rows.length);
    if (!rows.length) { list.append(h('div.panel-empty', null, tr('No matching articles.', '没有符合条件的文章。'))); return; }
    rows.forEach((article) => {
      const progress = S.articleState(article.id);
      const state = progress.completedAt ? tr('Completed', '已完成') : Object.keys(progress).length ? tr('In progress', '进行中') : tr('Not started', '尚未开始');
      const score = Number.isFinite(progress.score) ? ` · ${progress.score}%` : '';
      const audio = C.audioRecord(article.id)?.status === 'generated';
      list.append(press(h('button.reading-row', { type: 'button', onclick: () => { location.hash = `#/reading/${article.id}`; } },
        h('span.reading-code', null, `${article.level} · U${article.unit}${article.reading}`),
        h('span.reading-title', null, cn(article.title)),
        h('span.reading-status', null, `${state}${score} · ${tr('Audio', '音频')} ${audio ? '✓' : '—'}`),
        progress.completedAt ? ruleBar(1, 'sm', { label: state }) : null)));
    });
  }
  [level.el, unit.el, letter.el, status.el, search.lastChild].forEach((el) => el.addEventListener('input', paint));
  paint();
}

function select(label, options) {
  const el = h('select', { 'aria-label': label });
  options.forEach(([value, text]) => el.append(h('option', { value }, text)));
  return { el, wrap: h('label.filter-field', null, h('span.k-9', null, label), el) };
}
