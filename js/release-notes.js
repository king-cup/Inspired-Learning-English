// One catalogue serves the once-per-release notice and permanent Settings log.
import * as P from './profile.js';
import { APP_VERSION } from './data.js';
import { h, clear, button, openDialog } from './ui.js';
const KEY = `ie.releaseNotice.${APP_VERSION}`;
let dismissed = false;
export const releases = [
  ['1.10.2', '2026-09-19', [
    ['Reading Explorer now includes 144 cleaned passages and 891 passage-supported answer keys. Multiple-choice and selectable True / False / Not Given questions are scored. Diagram-dependent, written-response and ambiguous questions are omitted.', 'Reading Explorer 更新为 144 篇清理后的文章、891 道有原文依据的答案。选择题及可点击的判断题可自动评分；不收录依赖图表、书面回答或有歧义的题目。'],
    ['Added five-word spelling practice and full-list tests in Multiple Choice, Fill in the blank or Mixed formats.', '新增每五词反馈的拼写练习，以及覆盖整张词表的选择题、填空题和混合测试。'],
    ['Guided learning supports your actual class deadline, including one-day plans, review and four retrieval rounds per word. Pronunciation is self-confirmed; there is no speech recognition.', '引导学习按实际上课时间安排，支持一天计划、复习及每词四轮回忆练习。跟读由学生自行确认，暂不识别语音。'],
    ['Added resumable learning, guided-plan backups, save-retry messages and timestamped local history. The tutorial and Settings log are available in English and Chinese.', '新增学习续接、引导计划备份、保存重试提示和带时间戳的本地记录。指南和设置更新记录均提供中英文。'],
    ['Existing recordings and the original visual style are unchanged. Android includes vocabulary audio; reading audio remains optional. Back up your progress before updating.', '保留现有录音与原有视觉风格。安卓内置词汇发音，阅读音频仍按需下载。更新前请备份进度。'],
    ['Content still being expanded: 118 vocabulary entries lack English examples, and whole-sentence Chinese translations are not supplied yet. Chinese word meanings remain available. This release does not claim those additions are complete.', '仍待补充：118 条词汇缺少英语例句，整句中文翻译暂未提供；中文词义保留。本版未将这些内容标为已完成。'],
  ]],
  ['1.10.2-preview', '2026-09-19', [
    ['Preview for testing, not a finished student release. The live PWA is unchanged; the Android preview installs separately.', '测试预览版，并非正式学生版本。线上 PWA 保持不变，安卓预览版独立安装。'],
    ['Try guided learning with a class deadline, five-word spelling practice, and full-list Multiple Choice, Fill in the blank or Mixed tests. One-day plans include all new words; longer plans include review.', '可试用按上课时间安排的引导学习、每五词反馈的拼写练习，以及整词表选择题、填空题或混合测试。一天计划当天学习全部新词，多日计划包含复习。'],
    ['Guided plans are included in backups. Added save-retry messages, typed-test progress updates and local timestamped learning history. Device time is not verified attendance.', '备份包含引导学习计划。新增保存重试提示、填空测试进度更新和带时间戳的本地学习记录。设备时间并非可靠出勤证明。'],
    ['Known limits: the restored Reading Explorer answer-key draft is not included yet. Some English examples and Chinese sentence translations remain unfinished. Current recordings are unchanged.', '已知限制：暂未加入修复后的 Reading Explorer 答案草稿；部分英语例句及中文整句翻译仍未完成。现有录音保持不变。'],
  ]],
  ['1.10.1', '2026-09-18', [
    ['Book names and units stay visible in vocabulary lists, Study, Cards, Practice, Test and results. High-school package titles are unchanged.', '词汇列表、学习、卡片、练习、测试和结果页明确显示书名与单元。高中词汇包标题保持不变。'],
    ['Study meanings fold open inside Reading Explorer, school readings and Cloze. Double-tap dotted words; tap saved highlights once to reopen or close. Undo removes the mark, not its history.', '学习模式的阅读和完形中，释义在原文内折叠展开。双击点状下划线词；单击已标记词可收起或重开。撤销仅移除标记，不删除接触记录。'],
    ['Settings offers red, green, blue, yellow, purple, dark pink, brown, black and teal highlights. Black uses white text.', '设置中可选红、绿、蓝、黄、紫、深粉、棕、黑、青绿九种标记颜色。黑色标记配白字。'],
    ['Reading books and school sections open with Study or Test. Study lets you choose; Test draws unseen exercises first, then least-used ones, avoiding immediate repeats when alternatives exist.', '阅读书本和学校题型先选择学习或测试。学习自由选题；测试优先抽未做的题，再抽次数较少的题；有其他题可选时不连续重复。'],
    ['Reading and Cloze Tests have no clickable vocabulary, definitions or saved highlights. In Cloze Study, tap the option letter to answer; looking up a word does not select an answer.', '阅读和完形测试不显示可点击词汇、释义或已保存标记。完形学习中点击选项字母作答，查词不会自动作答。'],
    ['Reading menus match the school sections. Updated instructions and tutorial explain the controls. This bilingual log stays in Settings.', '阅读菜单与学校题型保持一致。更新说明与指南解释新操作。设置中可随时查看中英文更新记录。'],
    ['Narrator replacement was cancelled. Existing recordings remain; this release does not replace them with Bedlam/Qwen recordings.', '已取消更换朗读者，保留现有录音。本次没有替换为 Bedlam/Qwen 配音。'],
  ]],
  ['1.10', '2026-09-18', [
    ['Audited middle-school sources: corrected MCQ, Cloze and Reading A–E passage/question boundaries and answer mappings. Unresolved items are held out of the app.', '对照初中试题与解析，修正单选、完形及阅读 A–E 的原文/题目混排与答案对应。无法核实的题目暂不展示。'],
    ['Audited all 144 Reading Explorer articles: removed duplicate exercises, page debris and malformed questions. Kept comprehension; removed separate lookup and vocabulary-practice sections.', '审核全部 144 篇 Reading Explorer：移除重复练习、页码杂文和异常题目。保留理解题，移除独立查词和词汇练习区。'],
    ['Reading Explorer uses book/unit menus and prominent unit numbers. Added next-exercise actions after submission. Cloze no longer asks for the grade twice.', 'Reading Explorer 按书本和单元浏览，单元编号更醒目。提交后可做下一篇。完形不再重复选择年级。'],
    ['Reading Response is not available yet. Cleaned response/writing material is retained outside the learner app for future work.', '阅读表达暂不开放。清理后的阅读表达与写作资料保留在学生应用之外，供后续开发。'],
    ['Added persistent passage highlights, inline definitions, Undo and local encounter history. Useful saved words join Memory Palace.', '新增持久原文标记、行内释义、撤销与本地生词接触记录。有释义的标记词加入记忆宫殿。'],
    ['Added a bilingual first-use tutorial, last-page restoration and remembered vocabulary book/unit selections. Backups now include reading and Cloze progress.', '新增中英文首次使用指南、上次页面恢复和词汇书本/单元记忆。备份现包含阅读及完形进度。'],
    ['Fixed page flashes, removed top-right notes and moved Home Settings to the upper left. Restored original monochrome colours and Courier interface fonts while keeping functional changes.', '修复页面切换闪烁，移除右上角小字，首页设置移至左上。恢复原黑白配色和 Courier 界面字体，保留功能更新。'],
    ['Vocabulary audio downloads as one verified pack instead of thousands of requests. Existing reading recordings were compressed by about half and made optional downloads.', '词汇音频可一次下载并校验整个包，不再发送数千次请求。现有阅读录音压缩约一半，改为按需下载。'],
    ['Android omits reading recordings and duplicate packs but includes word audio. Updated the launcher icon, phone/tablet layouts and rotation. Android has no iOS Home Screen reminder.', '安卓不再内置阅读录音及重复音频包，保留单词发音。调整启动图标、手机/平板布局和旋转；安卓不显示 iOS 添加到主屏幕提示。'],
    ['Improved matching-question grading, backups and article playback after word pronunciation.', '改进匹配题评分、进度备份及单词发音后的文章播放。'],
  ]],
  ['1.09', '2026-09-15', [
    ['Unified web and Android learning. Added 144 reading lessons and recordings across Foundation and Levels 1–5, with offline playback.', '统一网页与安卓学习体验。新增 Foundation 和 Level 1–5 共 144 篇阅读及录音，支持离线播放。'],
    ['Added Grades 7–9 English sections, reading exercises/progress, completion history, and Memory Palace collection with spaced review.', '新增七至九年级英语题型、阅读练习/进度、完成记录，以及生词收集与间隔复习的记忆宫殿。'],
    ['Added curriculum/audio integrity checks, verified Android asset synchronization and legacy-data migration.', '增加教材/音频完整性检查、安卓资源同步校验和旧版数据迁移。'],
  ]],
  ['1.07', '2026-09-13–14', [
    ['Renamed the app Inspired English and added the main learning-area menu.', '应用更名为 Inspired English，并增加主要学习功能入口。'],
    ['Added HSE Advanced Practice, improved navigation, expanded high-school packages and Cloze content, and standardized Cloze titles in subsequent content updates.', '新增 HSE 进阶练习，改进导航；后续内容更新扩充高中词汇包及完形内容，统一完形标题。'],
  ]],
  ['1.04 → 1.07', '2026-08-24–09-12', [
    ['Expanded Unlock 3 Unit 6 Part 2 to 46 words. Added Cloze Study and Test modes.', 'Unlock 3 第 6 单元第 2 部分扩充至 46 个词。新增完形填空学习与测试模式。'],
  ]],
  ['1.04', '2026-08-23', [
    ['Added per-unit/per-book audio packs, Reading vocabulary and Prepare Level 5; regenerated word recordings with Kokoro.', '新增按单元/书本下载的音频包、Reading 词汇及 Prepare Level 5；使用 Kokoro 重新生成单词录音。'],
  ]],
];
export function content() {
  const host = h('div.release-notes');
  let lang = P.get().lang;
  function paint() {
    clear(host); host.lang = lang === 'zh' ? 'zh-Hans' : 'en';
    const zh = lang === 'zh';
    host.append(h('nav.release-language', { 'aria-label': zh ? '更新记录语言' : 'Update log language' },
      ...[['en','English'],['zh','中文']].map(([code,label]) => button(label, { variant:'thin', ariaPressed:lang === code, onClick:() => { lang = code; paint(); host.querySelector('[aria-pressed="true"]').focus(); } }))));
    host.append(h('p', null, zh ? `从 1.04 到 ${APP_VERSION} 的已知变化，依据已记录的版本历史。` : `Known changes from 1.04 through ${APP_VERSION}, based on recorded release history.`));
    for (const [version,date,items] of releases) host.append(h('h2', null, version), h('p.release-date', null, date), h('ul', null, ...items.map(row => h('li', null, row[zh ? 1 : 0]))));
    host.append(h('p', null, zh ? '重要说明：阅读答案依据原文编审，并非出版社答案册。高中阅读题库尚未上线；记忆宫殿重设计仍待规划。记录仅存本机，重装或换设备前请备份。' : 'Important: Reading keys are editorial judgments supported by the passages, not a publisher answer sheet. High-school reading content is not yet available; the Memory Palace redesign remains planned. Progress is local—back up before reinstalling or changing devices.'));
  }
  paint(); return host;
}
export function pending() {
  if (dismissed) return false;
  try { return localStorage.getItem(KEY) !== 'seen'; } catch (_) { return false; }
}
export function showNotice(done) {
  const dialog = openDialog({ title: P.get().lang === 'zh' ? `已更新至 ${APP_VERSION} · 更新说明` : `Updated to ${APP_VERSION} · What changed`, body: content(),
    actions: [{ label: '继续学习 · Continue learning', variant: 'ruled' }],
    onClose: () => { dismissed = true; try { localStorage.setItem(KEY, 'seen'); } catch (_) {} if (done) done(); },
  });
  dialog.panel.classList.add('release-dialog');
}
