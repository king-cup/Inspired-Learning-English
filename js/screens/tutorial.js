import * as P from '../profile.js';
import { h, clear, button, leafMark } from '../ui.js';
const KEY = 'ie.tutorial.1.10.2';
const tr = (en, zh) => P.get().lang === 'zh' ? zh : en;
export const completed = () => { try { return localStorage.getItem(KEY) === 'done'; } catch (e) { return true; } };
export function render(root, done) {
  let step = 0;
  const pages = [
    ['Welcome to Inspired English', '欢迎使用因思博睿英语', 'Your books, practice and reading in one place. Your progress stays on this device. We’ll remember your last page.', '在这里学习课本词汇、练习和阅读。学习记录保存在此设备上，下次打开时继续上次的页面。'],
    ['Choose how to learn', '选择学习方式', 'Vocabulary: Study shows meanings and examples. Practice gives feedback. Cards help recall; use the buttons or swipe. Test saves your score. Reverse cards in Settings for a harder challenge.', '词汇：学习模式显示释义和例句；练习模式即时反馈；卡片帮助记忆，可用按钮或滑动；测试保存成绩。在设置中可翻转卡片正反面。'],
    ['Read without losing your place', '在原文中理解生词', 'In Study, double-tap a dotted word or phrase to save a highlight and fold open its meaning. Tap a saved highlight once to fold it closed or reopen it. Undo removes the latest mark, not its history. Choose your highlight colour in Settings. Try it below.', '学习模式下双击点状下划线词或短语，保存标记并折叠展开释义。单击已标记词可收起或展开。撤销仅移除最近标记，不删除接触记录。可在设置中选择标记颜色。请在下面试试。'],
    ['Study freely, test fairly', '自由学习，公平测试', 'Choose a reading book or a school grade and section, then Study or Test. Study lets you browse exercises and look up words. Test draws a random exercise: unseen first, then least used, never the same one twice in a row. No highlights or definitions appear in Test. After submission, Next gives another test. Reading comprehension uses passage-based choices, including True / False / Not Given. Diagram-dependent and ambiguous questions are omitted.', '选择阅读书本或学校年级和题型，再选择学习或测试。学习可自由浏览、查看生词；测试随机抽题：未做优先，之后优先抽取次数较少的题，不连续重复。测试不显示标记或释义。提交后可开始下一篇测试。阅读理解仅保留依据原文作答的选择题（包括判断题）；不收录依赖图表或答案有歧义的题目。'],
    ['Cloze: choose a letter', '完形填空：点击选项字母', 'Tap a numbered blank to unfold its options. In Study, tap the option letter to answer; double-tap dotted words in the passage or options to open meanings without selecting an answer. Test has no word lookup and shows feedback only after submission.', '点击编号空格展开选项。学习模式点击选项字母作答；双击原文或选项中的点状下划线词可查看释义，不会自动作答。测试不能查词，提交后才显示反馈。'],
    ['Keep and review useful words', '保存并复习生词', 'Highlighted words with offline meanings join Memory Palace. Review the due list, reveal the meaning and record whether you remembered it. Undoing a highlight does not erase the encounter history.', '有离线释义的标记词会加入记忆宫殿。查看待复习列表，揭示释义并记录是否记住。撤销标记不会删除学习接触记录。'],
    ['Ready for offline study', '准备离线学习', 'Download vocabulary audio as one pack in Vocabulary. Reading audio is optional and downloads when you choose it. Settings is at the top left of Home: change language, display, cards, replay this guide and export a backup before changing devices.', '在词汇页面一次下载整个词汇音频包。阅读音频按需下载。首页左上角的设置可更改语言、显示和卡片，重看指南，并在换设备前导出备份。'],
  ];
  pages.splice(6, 0,
    ['Practise spelling, then test', '练习拼写，再测试', 'Spelling practice gives feedback every five words. Test covers your selected list: choose Multiple Choice, Fill in the blank or Mixed. Answers are marked after submission, and unfinished tests can be resumed.', '拼写练习每五个词提供一次反馈。测试覆盖所选词表，可选选择题、填空题或混合题；提交后评分，未完成的测试可继续。'],
    ['Learn before your next class', '为下次课安排学习', 'Guided learning uses your actual deadline. One-day plans cover the whole list; longer plans divide new words and review. Listen, confirm that you repeated the word, then practise it in four rounds. There is no speech recognition. Some examples are still missing; Chinese word meanings are not sentence translations.', '引导学习按实际上课时间安排：一天计划学习整张词表，多日计划分配新词与复习。听发音、确认已跟读，再分四轮练习；目前没有语音识别。部分例句尚缺，中文词义并非整句翻译。'],
    ['Your progress and learning history', '学习进度与记录', 'Plans and progress are saved on this device and included in Settings backups. Activity timestamps use the device clock, not verified attendance. Keep a backup before changing devices or reinstalling.', '计划与进度保存在此设备，并包含在设置中的备份里。活动时间戳采用设备时间，不是可靠的出勤证明。换设备或重装前请备份。']);
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
