import * as P from '../profile.js';
import { h, clear, button, leafMark } from '../ui.js';
const KEY = 'ie.tutorial.1.11';
const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
export const completed = () => { try { return localStorage.getItem(KEY) === 'done'; } catch (e) { return true; } };
export function render(root, done) {
  let step = 0;
  const pages = [
    ['Welcome to Inspired English', '欢迎使用因思博睿英语', 'Learn words and read stories here. Your progress is saved on this device.', '在这里学单词、读文章。学习记录保存在这个设备上。'],
    ['Choose how to learn', '选择学习方式', 'Study shows word meanings. Practice helps you remember them. Cards let you quiz yourself. Test checks what you know.', '学习可以查看词义。练习帮你记住。卡片可以自己考自己。测试看看你学会了多少。'],
    ['Mark words as you read', '边读边标记', 'In Study, double-tap any word to highlight it. Saved meanings appear when available. Tap Undo to remove your last mark. Try it below.', '学习时双击任意单词即可标记。有释义的词会显示意思。点击撤销可以去掉上一次标记。在下面试试吧。'],
    ['Study or test', '学习或测试', 'Study lets you choose an article. Test picks one for you. In a test, finish first to see your score. You cannot look up words during a test.', '学习时可以自己选文章。测试会帮你抽一篇。做完再看成绩。测试时不能查词。'],
    ['Fill the blanks', '完成填空', 'In Cloze, tap a blank to see the choices. Tap a letter to answer. In Study, you can also double-tap words to highlight them.', '完形填空中，点击空格查看选项，点击字母作答。学习时还可以双击单词做标记。'],
    ['Review words', '复习单词', 'Memory Palace keeps words you highlighted. Show the meaning, then check if you remembered it.', '记忆宫殿保存你标记的词。先想想意思，再打开释义看看记对了吗。'],
    ['Learn word meanings', '学习词义', 'Guided learning helps you learn all the words. Choose Learn all words, or use a daily plan to learn a few each day.', '引导学习帮你学会整张词表。可以选择一次学完，也可以用每日计划，每天学几个。'],
    ['Spelling is your choice', '拼写可以选做', 'Word tests check meanings. If you want to practise spelling too, choose Spelling on the unit page.', '单词测试考词义。想练拼写时，在单元页面选择拼写练习。'],
    ['Save your progress', '保存学习记录', 'Before changing devices, save a backup in Settings. Download audio to listen without the internet.', '换设备前，先在设置里保存备份。下载音频后，没有网络也能听。'],
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
