import * as C from '../curriculum-data.js';
import * as S from '../curriculum-store.js';
import * as P from '../profile.js';
import { h, clear, cn, paperHeader, topBar, blockButton, button } from '../ui.js';
const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;

export async function render(root, bookId) {
  let data;
  try { data = await C.loadReading(); }
  catch (error) { clear(root); root.append(topBar(tr('← Home', '← 首页'), '', () => { location.hash = '#/'; }), h('p.note.bad', null, tr('Reading could not load. Please retry.', '阅读内容加载失败，请重试。')), button(tr('Retry', '重试'), { onClick: () => render(root, bookId) })); return; }
  const book = data.levels.find(row => row.id === bookId);
  clear(root);
  root.append(topBar(book ? tr('← Books', '← 书本') : tr('← Home', '← 首页'), '', () => { location.hash = book ? '#/reading' : '#/'; }));
  root.append(h('div.mt'), paperHeader({ title: book?.label || tr('Reading Comprehension', '阅读理解'), left: book ? tr('Choose an article', '选择文章') : tr('Choose your book', '选择书本') }));
  if (!book) {
    const list = h('div.book-menu.mt2');
    data.levels.forEach((level, i) => {
      const articles = data.articles.filter(row => row.levelId === level.id);
      const count = articles.filter(row => S.articleState(row.id).completedAt).length;
      const entry = blockButton(level.label, tr(articles.length + ' articles · ' + count + ' completed', articles.length + ' 篇文章 · 已完成 ' + count + ' 篇'), () => { location.hash = '#/reading/book/' + level.id; });
      entry.classList.add('book-choice'); list.append(entry);
    });
    root.append(list); return;
  }
  const articles = data.articles.filter(row => row.levelId === book.id);
  for (const unit of [...new Set(articles.map(row => row.unit))].sort((a,b) => a-b)) {
    const section = h('section.reading-unit.mt2', null, h('h2.unit-heading', null, tr('Unit ', '单元 ') + unit));
    articles.filter(row => row.unit === unit).forEach(article => {
      const progress = S.articleState(article.id);
      section.append(h('button.reading-row', { type: 'button', onclick: () => { location.hash = '#/reading/' + article.id; } },
        h('span.reading-code', null, String(unit) + article.reading),
        h('span.reading-title', null, cn(article.title)),
        h('span.reading-status', null, progress.completedAt ? tr('Completed', '已完成') : progress.openedAt ? tr('Continue reading', '继续阅读') : article.readingMinutes + tr(' min', ' 分钟'))));
    });
    root.append(section);
  }
}
