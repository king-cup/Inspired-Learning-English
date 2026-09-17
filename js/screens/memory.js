import * as S from '../curriculum-store.js';
import * as P from '../profile.js';
import { h, clear, cn, topBar, paperHeader, barLabel, button, press } from '../ui.js';

const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
const labels = { new: ['Newly discovered', '新发现'], learning: ['Learning', '学习中'], review: ['Review', '复习中'], difficult: ['Difficult', '难点'], mastered: ['Mastered', '已掌握'] };

export function render(root, action, id) {
  if (action === 'item' && id) { detail(root, id); return; }
  if (action === 'review') { review(root); return; }
  home(root);
}

function home(root) {
  clear(root);
  const items = S.memoryItems(); const due = S.dueItems();
  root.append(topBar(tr('← Back', '← 返回'), tr('Memory Palace', '记忆宫殿'), () => { location.hash = '#/'; }));
  root.append(h('div.mt'), paperHeader({ kicker: tr('spaced review', '间隔复习'), title: tr('Memory Palace', '记忆宫殿'), left: `${items.filter((x) => x.type === 'word').length} ${tr('words', '单词')} · ${items.filter((x) => x.type === 'phrase').length} ${tr('phrases', '短语')}`, right: `${due.length} ${tr('due', '待复习')}` }));
  const stats = h('div.memory-stats.mt');
  stats.append(stat(tr('Due for review', '待复习'), due.length));
  Object.entries(labels).forEach(([key, pair]) => stats.append(stat(tr(pair[0], pair[1]), items.filter((x) => x.mastery === key).length)));
  root.append(stats);
  if (due.length) root.append(h('div.mt', null, button(tr('Review due items', '复习到期项目'), { variant: 'ruled', size: 'lg', wide: true, onClick: () => { location.hash = '#/memory/review'; } })));

  const levels = [...new Set(items.flatMap((x) => x.contexts.map((c) => c.level)).filter(Boolean))];
  const sources = [...new Set(items.flatMap((x) => x.contexts.map((c) => c.articleTitle)).filter(Boolean))];
  const filters = h('div.reading-filters.box.mt');
  const level = select(tr('Level', '级别'), ['', ...levels]); const source = select(tr('Source article', '来源文章'), ['', ...sources]);
  filters.append(level.wrap, source.wrap); root.append(filters);
  const list = h('div.box.mt'); const title = barLabel(tr('Saved vocabulary', '已保存词汇'), String(items.length)); const rows = h('div'); list.append(title, rows); root.append(list, recentActivity(), h('div', { style: { height: '30px' } }));
  function paint() {
    clear(rows);
    const shown = items.filter((item) => (!level.el.value || item.contexts.some((c) => c.level === level.el.value)) && (!source.el.value || item.contexts.some((c) => c.articleTitle === source.el.value)));
    title.lastChild.textContent = String(shown.length);
    if (!shown.length) { rows.append(h('div.panel-empty', null, tr('Double-tap a dotted word in a reading passage to begin.', '双击阅读文章中带点状下划线的词即可开始。'))); return; }
    shown.sort((a, b) => b.lastEncounter - a.lastEncounter).forEach((item) => {
      const row = h('button.memory-row', {
        type: 'button', onclick: () => { location.hash = `#/memory/item/${encodeURIComponent(item.id)}`; },
      }, h('span.grow', null,
        h('b', null, cn(item.display)),
        h('small', null, cn(item.chinese))),
      h('span', null, tr(...(labels[item.mastery] || labels.new))));
      rows.append(press(row));
    });
  }
  level.el.oninput = source.el.oninput = paint; paint();
}

function detail(root, id) {
  const item = S.get().memory[id];
  clear(root); root.append(topBar(tr('← Memory Palace', '← 记忆宫殿'), tr('Vocabulary detail', '词汇详情'), () => { location.hash = '#/memory'; }));
  if (!item) { root.append(h('div.note.bad.mt2', null, tr('This item no longer exists.', '该项目已不存在。'))); return; }
  root.append(h('div.mt'), paperHeader({ kicker: item.type, title: item.display, left: item.partOfSpeech, right: tr(...(labels[item.mastery] || labels.new)) }));
  const box = h('section.box.mt', null, barLabel(tr('Definitions', '释义')), h('div.memory-detail', null,
    h('h3', null, cn(item.chinese)), h('p', null, cn(item.english)), h('div.k-9.dim', null, `${tr('Encounters', '遇见次数')}: ${item.encounterCount} · ${tr('Reviews', '复习次数')}: ${item.reviewCount} · ${tr('Priority', '优先级')}: ${item.priority || 0}`)));
  item.contexts.forEach((context) => box.append(h('blockquote', null, cn(context.sentence)), button(context.articleTitle, { variant: 'thin', wide: true, onClick: () => { location.hash = context.route || `#/reading/${context.articleId}`; } })));
  const note = h('textarea', { rows: '3', maxlength: '500', placeholder: tr('Optional student note', '可选学习笔记'), 'aria-label': tr('Student note', '学习笔记') }); note.value = item.note || ''; note.onchange = () => S.note(id, note.value);
  box.append(h('div.mt', null, barLabel(tr('Note', '笔记')), note));
  const history = Array.isArray(item.reviewHistory) ? item.reviewHistory.slice(-8).reverse() : [];
  box.append(h('div.mt', null, barLabel(tr('Review history', '复习记录')), history.length
    ? h('ul.review-history', null, ...history.map((row) => h('li', null,
      `${row.correct ? '✓' : '×'} ${new Date(row.at).toLocaleDateString()} · ${tr(...(labels[row.from] || labels.new))} → ${tr(...(labels[row.to] || labels.new))}`)))
    : h('div.panel-empty', null, tr('No reviews yet.', '还没有复习记录。'))));
  root.append(box, h('div.two-actions.mt', null,
    button(tr('Review now', '立即复习'), { variant: 'ruled', onClick: () => { location.hash = '#/memory/review'; } }),
    button(item.known ? tr('Return to review', '恢复复习') : tr('Mark as known', '标记为已掌握'), { variant: 'thin', onClick: () => { S.setKnown(id, !item.known); detail(root, id); } })),
    h('div.mt', null, button(tr('Remove learning history', '删除学习记录'), { variant: 'thin', wide: true, onClick: () => { if (confirm(tr('Permanently remove this learning history?', '确定永久删除这条学习记录吗？'))) { S.forget(id); location.hash = '#/memory'; } } })), h('div', { style: { height: '30px' } }));
}

function review(root) {
  const queue = S.dueItems(); let index = 0;
  clear(root); root.append(topBar(tr('← Memory Palace', '← 记忆宫殿'), tr('Review', '复习'), () => { location.hash = '#/memory'; }));
  const stage = h('section.box.mt'); root.append(stage);
  const paint = () => {
    clear(stage); stage.append(barLabel(tr('Active recall', '主动回忆'), `${Math.min(index + 1, queue.length)}/${queue.length}`));
    if (!queue.length || index >= queue.length) { stage.append(h('div.panel-empty', null, tr('Review complete. Difficult items will return sooner.', '复习完成。难点词会更早再次出现。')), button(tr('Done', '完成'), { variant: 'ruled', wide: true, onClick: () => { location.hash = '#/memory'; } })); return; }
    const item = queue[index]; stage.append(h('h2', null, cn(item.display)), h('blockquote', null, cn(item.contexts[item.contexts.length - 1]?.sentence || '')));
    const reveal = button(tr('Reveal answer', '显示答案'), { variant: 'ruled', wide: true });
    reveal.onclick = () => { reveal.remove(); stage.append(h('div.lookup-meaning', null, h('b', null, cn(item.chinese)), h('p', null, cn(item.english))), h('div.two-actions', null,
      button(tr('Correct', '正确'), { variant: 'thin', onClick: () => grade(true) }), button(tr('Incorrect', '错误'), { variant: 'thin', onClick: () => grade(false) }))); };
    stage.append(reveal);
  };
  const grade = (correct) => { S.review(queue[index].id, correct); index += 1; paint(); };
  paint();
}

const stat = (label, value) => h('div.memory-stat', null, h('b', null, String(value)), h('span', null, label));
function select(label, options) { const el = h('select', { 'aria-label': label }); options.forEach((value) => el.append(h('option', { value }, value || tr('All', '全部')))); return { el, wrap: h('label.filter-field', null, h('span.k-9', null, label), el) }; }
function recentActivity() { const activity = S.get().activity.slice(-8).reverse(); const box = h('div.box.soft.mt', null, barLabel(tr('Recent review activity', '最近复习'))); box.append(h('div.panel-empty', null, activity.length ? activity.map((row) => row.correct ? '✓' : '×').join('  ') : tr('No reviews yet.', '还没有复习记录。'))); return box; }
