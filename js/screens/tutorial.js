import * as P from '../profile.js';
import { h, clear, button, leafMark } from '../ui.js';
const KEY = 'ie.tutorial.1.10';
const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
export const completed = () => { try { return localStorage.getItem(KEY) === 'done'; } catch (e) { return true; } };
export function render(root, done) {
  let step = 0;
  const pages = [
    ['Welcome to Inspired English', '欢迎使用因思博睿英语', 'Your books, practice and reading in one place. Your progress stays on this device. We’ll remember your last page.', '在这里学习课本词汇、练习和阅读。学习记录保存在此设备上，下次打开时继续上次的页面。'],
    ['Choose how to learn', '选择学习方式', 'Vocabulary: Study shows meanings and examples. Practice gives feedback. Cards help recall; use the buttons or swipe. Test saves your score. Reverse cards in Settings for a harder challenge.', '词汇：学习模式显示释义和例句；练习模式即时反馈；卡片帮助记忆，可用按钮或滑动；测试保存成绩。在设置中可翻转卡片正反面。'],
    ['Read without losing your place', '在原文中理解生词', 'Double-tap a dotted word or phrase to highlight it and open its meaning in the passage. Tap a yellow highlight once to close or reopen it. Undo removes the last highlight. Try it below.', '双击带点状下划线的词或短语，在原文中展开释义并标黄。单击黄色词可收起或再次展开。撤销可移除最近的标记。请在下面试试。'],
    ['Read, answer, continue', '阅读、答题、继续', 'Reading Comprehension opens by book, then unit. Middle School opens by grade and section. Study gives feedback; Test waits until submission. Use Next exercise after your result. Some reading prompts need teacher review and have no automatic score.', '阅读理解按书本和单元选择，初中英语按年级和题型选择。学习模式即时反馈，测试模式提交后显示结果。结果页可继续下一篇。部分阅读题需老师批阅，不能自动评分。'],
    ['Keep and review useful words', '保存并复习生词', 'Highlighted words with offline meanings join Memory Palace. Review the due list, reveal the meaning and record whether you remembered it. Undoing a highlight does not erase the encounter history.', '有离线释义的标记词会加入记忆宫殿。查看待复习列表，揭示释义并记录是否记住。撤销标记不会删除学习接触记录。'],
    ['Ready for offline study', '准备离线学习', 'Download vocabulary audio as one pack in Vocabulary. Reading audio is optional and downloads when you choose it. Settings is at the top left of Home: change language, display, cards, replay this guide and export a backup before changing devices.', '在词汇页面一次下载整个词汇音频包。阅读音频按需下载。首页左上角的设置可更改语言、显示和卡片，重看指南，并在换设备前导出备份。'],
  ];
  const finish = () => { try { localStorage.setItem(KEY, 'done'); } catch (e) {} done(); };
  function paint() {
    clear(root); const row = pages[step];
    const heading = h('h1', { tabindex: '-1' }, tr(row[0], row[1]));
    const wrap = h('section.tutorial', null, leafMark(48), h('p.tutorial-count', null, `${step + 1} / ${pages.length}`), heading, h('p', null, tr(row[2], row[3])));
    if (step === 2) {
      let marked = false, open = false, last = 0;
      const word = h('button.passage-term', { type: 'button', 'aria-expanded': 'false' }, 'discover');
      const meaning = h('div.inline-definition', { hidden: true }, h('b', null, 'discover · verb'), h('p', null, '发现；找到'));
      const show = () => { word.classList.toggle('is-highlighted', marked); word.setAttribute('aria-expanded', String(open)); meaning.hidden = !open; };
      word.onclick = (ev) => { const now = Date.now(); if (marked) open = !open; else if (ev.detail === 0 || now - last < 450) { marked = true; open = true; } last = now; show(); };
      wrap.append(h('div.tutorial-demo', null, 'Read to ', word, ' something new.', meaning), button(tr('Undo highlight', '撤销标记'), { variant: 'thin', onClick: () => { marked = open = false; show(); } }));
    }
    wrap.append(h('nav.tutorial-actions', { 'aria-label': tr('Tutorial', '使用指南') }, button(tr('Back', '上一步'), { variant: 'thin', disabled: step === 0, onClick: () => { step--; paint(); } }), button(step === pages.length - 1 ? tr('Start learning', '开始学习') : tr('Next', '下一步'), { variant: 'ruled', onClick: () => { if (step === pages.length - 1) finish(); else { step++; paint(); } } })), button(tr('Skip for now', '暂时跳过'), { variant: 'thin', onClick: finish }));
    root.append(wrap); heading.focus();
  }
  paint();
}
