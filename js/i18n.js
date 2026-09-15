// In-app translation. Port of i18n/Strings.kt.
//
// Deliberately an in-app table that OVERRIDES the device/browser locale rather
// than following it: Peter wants the student's explicit choice at onboarding to
// win. Book and unit names are never translated -- they are the publishers'
// English titles and stay English in both interfaces.
//
// The EN_TABLE / ZH_TABLE below are a verbatim port of Strings.kt. Keep them in
// this one file so a terminology change is a one-line edit. Peter has NOT yet
// proofed the Chinese; treat it as changeable.

export const LANGS = [
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

export const langOf = (code) => (LANGS.some((l) => l.code === code) ? code : 'en');

/** %s / %d / %% only -- the same specifiers Strings.kt uses. */
function applyFormat(fmt, args) {
  let i = 0;
  return String(fmt).replace(/%(%|d|s)/g, (_m, spec) => {
    if (spec === '%') return '%';
    const a = args[i++];
    return a == null ? '' : String(a);
  });
}

class Strings {
  constructor(table) { this.table = table; }
  get(key) { return this.table[key] ?? EN_TABLE[key] ?? key; }
  f(key, ...args) {
    try { return applyFormat(this.get(key), args); } catch (e) { return this.get(key); }
  }
}

// Initialised at the bottom of the file, once EN_TABLE exists (a const declared
// later is in the temporal dead zone up here).
let current;
let curCode = 'en';

export const stringsFor = (code) => new Strings(code === 'zh' ? ZH_TABLE : EN_TABLE);

/** Set the active language for the whole app. Called from main on boot and
 *  whenever the profile language changes. */
export const use = (code) => { curCode = langOf(code); current = stringsFor(curCode); return current; };

/** The current Strings object, for helpers that want to pass it around. */
export const strings = () => current;

/** The active language code ('en' | 'zh'). */
export const lang = () => curCode;

/** The BCP-47 tag for <html lang> / lang attributes. */
export const htmlLang = (code = curCode) => (code === 'zh' ? 'zh-Hans' : 'en');

/** Look up / format against the current language. */
export const t = (key) => current.get(key);
export const f = (key, ...args) => current.f(key, ...args);

/** Keys present in English but missing from Chinese. Empty is the only good
 *  answer. Logged at boot so a half-translated build cannot quietly ship. */
export function missingTranslations() {
  return Object.keys(EN_TABLE).filter((k) => !(k in ZH_TABLE));
}

// ---------------------------------------------------------------------------
// Part-of-speech expansion (v1.02 §2)
//
// DISPLAY-ONLY. The stored `e.p` in vocab.json and every progress key stay the
// raw abbreviation -- this only changes what the student reads. Covers all 20
// distinct raw values found in vocab.json (audited 2026-08-22); anything else
// falls back to a humanised label rather than an unexplained abbreviation.
// ---------------------------------------------------------------------------
const POS_EN = {
  'n': 'Noun', 'v': 'Verb', 'adj': 'Adjective', 'adv': 'Adverb',
  'prep': 'Preposition', 'pron': 'Pronoun', 'conj': 'Conjunction',
  'det': 'Determiner', 'num': 'Numeral', 'phr': 'Phrase',
  'phr.v': 'Phrasal verb', 'n phr': 'Noun phrase', 'v phr': 'Verb phrase',
  'idiom': 'Idiom', 'prefix': 'Prefix', 'abbr': 'Abbreviation',
  'modal': 'Modal verb', 'n (u)': 'Noun (uncountable)', 'n / adj': 'Noun / Adjective',
};
const POS_ZH = {
  'n': '名词', 'v': '动词', 'adj': '形容词', 'adv': '副词',
  'prep': '介词', 'pron': '代词', 'conj': '连词',
  'det': '限定词', 'num': '数词', 'phr': '短语',
  'phr.v': '短语动词', 'n phr': '名词短语', 'v phr': '动词短语',
  'idiom': '习语', 'prefix': '前缀', 'abbr': '缩写',
  'modal': '情态动词', 'n (u)': '名词（不可数）', 'n / adj': '名词／形容词',
};

const humanisePos = (raw) => raw.charAt(0).toUpperCase() + raw.slice(1);

/**
 * Full localized part-of-speech term for a raw stored value. `lang` defaults to
 * the active language. Empty POS returns '' (render nothing). Unknown values are
 * humanised, never shown as a bare abbreviation.
 */
export function displayPos(rawPos, langCode = curCode) {
  const raw = String(rawPos == null ? '' : rawPos).trim();
  if (!raw) return '';
  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  const table = langCode === 'zh' ? POS_ZH : POS_EN;
  return table[key] || POS_EN[key] || humanisePos(raw);
}

const EN_TABLE = {
  // --- app ---------------------------------------------------------------
  'app.title': 'Inspired English',
  'app.kicker': 'student edition · works offline',
  'common.back': '← Back',
  'common.done': 'Done',
  'common.cancel': 'Cancel',
  'common.continue': 'Continue',
  'common.start': 'Start',
  'common.save': 'Save',
  'common.of': 'of',

  // --- onboarding --------------------------------------------------------
  'onboard.kicker': 'welcome',
  'onboard.title': 'Before you start',
  'onboard.nameLabel': 'What is your name?',
  'onboard.nameHint': 'Your first name',
  'onboard.nameHelp': 'Your teacher will see this name if you show them your progress.',
  'onboard.langLabel': 'Choose your language',
  'onboard.langHelp': 'You can change this later in Settings.',
  'onboard.begin': 'Start learning',
  'onboard.needName': 'Please enter your name first.',

  // --- home --------------------------------------------------------------
  'home.vocabulary': 'Vocabulary',
  'home.reading': 'Reading Comprehension',
  'home.middle': 'Middle School English',
  'home.high': 'High School English',
  'home.memory': 'Memory Palace',
  'home.comingSoon': 'Coming soon',

  // --- library -----------------------------------------------------------
  'lib.listType': 'List type',
  'lib.book': 'Book',
  'lib.group': 'Group',
  'lib.units': 'Units',
  'lib.complete': '%d / %d complete',
  'lib.known': '%d/%d known',
  'lib.best': 'best %d%%',
  'lib.settings': 'Settings',
  'lib.empty': 'No word lists found',
  'lib.hello': 'Hello, %s',
  'lib.cloze': 'Cloze Reading',
  'lib.clozeCaption': 'Read full passages and open each blank like a folded sheet of paper.',

  // --- unit --------------------------------------------------------------
  'unit.notFound': 'Unit not found',
  'unit.words': '%d words',
  'unit.lastUsed': 'last %s',
  'unit.notStarted': 'not started',
  'unit.record': 'Your record',
  'unit.knownOf': '%d / %d known',
  'unit.bestTest': 'Best test',
  'unit.lastTest': 'Last test',
  'unit.testsDone': 'Tests done',
  'unit.cardRuns': 'Flashcard runs',
  'unit.reset': 'Reset this unit',
  'unit.resetAsk': 'Reset this unit?',
  'unit.resetBody': 'This clears everything you have marked for %s. Other units are not touched.',
  'unit.missed': 'Words you keep missing',
  'unit.missedNone': 'Nothing yet — keep practising',
  'unit.missedTimes': 'wrong %d×',
  'unit.history': 'Test history',
  'unit.historyNone': 'No tests yet',
  'unit.attempt': 'Attempt %d',
  'unit.pass': 'PASS',
  'unit.fail': 'FAIL',
  'unit.retestTag': 'retest',

  // --- modes -------------------------------------------------------------
  'mode.study': 'Study',
  'mode.studyCaption': 'The whole list. Tap any word to hear it said aloud.',
  'mode.practice': 'Practice',
  'mode.practiceCaption': 'Multiple choice, five at a time. You see the answer after each one.',
  'mode.advanced': 'Advanced Practice',
  'mode.advancedCaption': 'Exam-style multiple choice from this HSE worksheet.',
  'mode.cards': 'Flashcard',
  'mode.cardsCaption': "Swipe right if you know it, left if you don't. Tap the card to flip it.",
  'mode.test': 'Test',
  'mode.testCaption': 'No answers until the end. You need %d%% to pass.',

  // --- study -------------------------------------------------------------
  'study.find': 'Find',
  'study.wordList': 'Word list',
  'study.shown': '%d shown',
  'study.example': 'Example',
  'study.same': 'Same meaning',
  'study.opposite': 'Opposite',
  'study.noExample': 'No example for this word yet',
  'study.tapToHear': 'tap a word to hear it',

  // --- cards -------------------------------------------------------------
  'cards.tapToFlip': 'Tap to flip',
  'cards.sayIt': '▶  Say it',
  'cards.dontKnow': "✗  Don't know",
  'cards.know': '✓  I know it',
  'cards.flip': '↻  Flip',
  'cards.hint': "Swipe left = don't know · Swipe right = know · Tap to flip",
  'cards.finished': 'Flashcards finished',
  'cards.knownOf': '%d of %d known',
  'cards.stillToLearn': 'Still to learn',
  'cards.drillMissed': 'Drill the %d I missed',
  'cards.drillMissedCaption': 'Only the words you swiped left.',
  'cards.again': 'Shuffle and go again',
  'cards.againCaption': 'The whole list, new order.',
  'cards.allKnown': 'Every word known',
  'cards.empty': 'This list is empty',
  'cards.retry': 'Flashcards · retry',

  // --- HSE advanced practice --------------------------------------------
  'advanced.loading': 'Loading advanced practice…',
  'advanced.empty': 'No advanced-practice questions are available for this package.',
  'advanced.question': 'Question %d / %d',
  'advanced.reading': 'Reading context',
  'advanced.correct': 'Correct',
  'advanced.notQuite': 'Not quite',
  'advanced.answer': 'Answer: %s',
  'advanced.next': 'Next question',
  'advanced.seeResult': 'See the result',
  'advanced.complete': 'Advanced Practice complete',
  'advanced.score': '%d / %d correct',
  'advanced.again': 'Practise again',

  // --- practice ----------------------------------------------------------
  'practice.tooShort': 'This list is too short to test',
  'practice.q': 'Q %d / %d',
  'practice.miss': 'Miss %d / %d',
  'practice.fixing': 'Practice · fixing misses',
  'practice.meaningQ': 'What does this word mean?',
  'practice.recallQ': 'Which word means this?',
  'practice.gapQ': 'Which word fills the gap?',
  'practice.tagMeaning': 'meaning',
  'practice.tagRecall': 'recall',
  'practice.tagContext': 'in context',
  'practice.correct': 'Correct',
  'practice.notQuite': 'Not quite',
  'practice.comesBack': 'This one comes back at the end.',
  'practice.checkpoint': 'Checkpoint',
  'practice.roundDone': 'Round done',
  'practice.allCorrect': 'All correct',
  'practice.gotOf': '%d of %d',
  'practice.answered': '%d answered',
  'practice.firstTime': '%d / %d first time',
  'practice.progress': 'Progress',
  'practice.nothingLeft': 'Nothing left to fix',
  'practice.stillToGet': '%d still to get right',
  'practice.retestMissed': 'Retest the %d I missed',
  'practice.seeResult': 'See the result',
  'practice.keepGoing': 'Keep going',
  'practice.complete': 'Practice complete',
  'practice.everyCorrect': 'Every word answered correctly',
  'practice.extraTries': 'You needed %d extra tries to clear the ones you missed.',
  'practice.straightThrough': 'Straight through, no retries.',
  'practice.again': 'Practise again',
  'practice.againCaption': 'Same list, questions reshuffled.',

  // --- test --------------------------------------------------------------
  'test.setup': 'Set up your test',
  'test.howMany': 'How many questions?',
  'test.ten': '10 questions',
  'test.twenty': '20 questions',
  'test.all': 'All %d words',
  'test.lengthHelp': 'You need %d%% to pass. You will not see any answers until you finish.',
  'test.begin': 'Start the test',
  'test.q': 'Question %d of %d',
  'test.answered': '%d answered',
  'test.noAnswersYet': 'No answers until you finish',
  'test.previousWord': '← Previous Word',
  'test.nextWord': 'Next Word →',
  'test.findUnanswered': 'Answer every word before finishing',
  'test.finish': 'Complete test',
  'test.finishAsk': 'Finish and see your score?',
  'test.finishBody': 'You have answered %d of %d. Unanswered questions count as wrong.',
  'test.result': 'Test result',
  'test.passedMsg': 'Congratulations %s, you passed!',
  'test.failedMsg': 'You failed %s, try harder next time!',
  'test.scoreOf': '%d / %d correct',
  'test.gotWrong': 'Words you got wrong',
  'test.allRight': 'You got every word right',
  'test.retestWrong': 'Retest the %d I got wrong',
  'test.retestCaption': 'Only the words you missed.',
  'test.takeAgain': 'Take the test again',
  'test.takeAgainCaption': 'New questions from the whole unit.',
  'test.retestTitle': 'Test · retest',

  // --- cloze tests -------------------------------------------------------
  'cloze.title': 'Cloze Reading',
  'cloze.reading': 'Reading',
  'cloze.kicker': 'Beijing exam passage collection',
  'cloze.loading': 'Loading cloze passages…',
  'cloze.loadError': 'The cloze passages could not be loaded. Check your connection and try again.',
  'cloze.chooseGrade': 'Choose your grade',
  'cloze.grade7': 'Grade 7',
  'cloze.grade8': 'Grade 8',
  'cloze.grade9': 'Grade 9',
  'cloze.passages': '%d passages',
  'cloze.studyMode': 'Study',
  'cloze.studyCaption': 'Choose a passage. See whether you are right after every answer.',
  'cloze.testMode': 'Test',
  'cloze.testCaption': 'Get a different random passage. Results stay hidden until the end.',
  'cloze.record': 'Your cloze record',
  'cloze.noRecord': 'No cloze tests yet',
  'cloze.redo': 'Redo',
  'cloze.perfect': 'Perfect',
  'cloze.choosePassage': 'Choose a passage',
  'cloze.search': 'Search title, year or area',
  'cloze.passagesLabel': 'Passages',
  'cloze.shown': '%d shown',
  'cloze.noMatches': 'No passages match that search',
  'cloze.attempts': '%d tries',
  'cloze.blanks': 'blanks',
  'cloze.tapBlank': 'Tap a blank to unfold its choices',
  'cloze.hiddenUntilEnd': 'Answers stay hidden until the end',
  'cloze.answered': '%d / %d answered',
  'cloze.blankLabel': 'Blank %d: %s',
  'cloze.chooseAnswer': 'Blank %d · choose one',
  'cloze.correct': 'Correct',
  'cloze.notQuite': 'Not quite',
  'cloze.answerIs': 'Answer: %s',
  'cloze.answerAll': 'Answer every blank to complete this passage.',
  'cloze.finish': 'Finish and see result',
  'cloze.finishAsk': 'Finish this cloze test?',
  'cloze.finishBody': 'You have answered %d of %d blanks. Unanswered blanks count as wrong.',
  'cloze.leaveBody': 'Your answers are saved on this device. You can return to this passage later.',
  'cloze.result': 'Cloze result',
  'cloze.score': '%d / %d correct',
  'cloze.review': 'Answers to review',
  'cloze.everyRight': 'Every blank is correct',
  'cloze.wellDone': 'Well done, %s!',
  'cloze.tryAgain': 'Do this passage again',
  'cloze.tryAgainCaption': 'Clear these answers and start a fresh attempt.',

  // --- settings ----------------------------------------------------------
  'set.title': 'Settings',
  'set.kicker': 'your app, your way',
  'set.name': 'Your name',
  'set.nameChange': 'Change name',
  'set.language': 'Language',
  'set.display': 'Display',
  'set.invert': 'Invert colours',
  'set.invertHelp': 'White becomes black. Right stays green, wrong stays red.',
  'set.cards': 'Flashcard',
  'set.reverse': 'Show Chinese first',
  'set.reverseHelp': 'The card starts on the Chinese side and you recall the English word.',
  'set.on': 'On',
  'set.off': 'Off',
  'set.audio': 'Pronunciation',
  'set.audioClips': 'Built-in recordings',
  'set.audioTts': "Your phone's voice",
  'set.audioNone': 'Not available on this phone',
  'set.about': 'About',
  'set.version': 'Version %s',

  // --- audio warning -----------------------------------------------------
  'audio.noEngine': 'No speech engine on this phone',
  'audio.noEngineBody': 'Tapping a word will be silent. Install a text-to-speech engine in Settings → Accessibility, or ask your teacher for the version with built-in audio.',

  // === PWA-ONLY keys (not in the Android table) ==========================
  // The web client bundles audio as downloadable clips, so it has an
  // offline-download affordance the APK does not. These strings are NEW and
  // Peter has not proofed the Chinese -- flagged in the handover notes.
  'pwa.offlineAudio': 'Offline audio',
  'pwa.downloadAll': 'Download all pronunciation (24 MB)',
  'pwa.allClips': 'All %d clips on this device',
  'pwa.someClipsAll': '%d of %d clips downloaded',
  'pwa.downloading': 'Downloading… %d/%d',
  'pwa.download': 'Download for offline',
  'pwa.pronunciation': 'Pronunciation',
  'pwa.readyOffline': 'Ready offline · %d clips',
  'pwa.someClips': '%d of %d clips on this device',
  'pwa.noClips': 'No clips for this unit — your phone will read the words',
  'pwa.searchHint': 'word or meaning',

  // Install / tab-storage warning (PWA-only). Shown in a browser tab; rendered
  // in the student's chosen language, defaulting to English on first launch.
  'install.title': 'Add this to your home screen',
  'install.lead': 'You are using this in a browser tab. ',
  'install.bold': 'iPhone deletes browser data after a week',
  'install.tail': ' — your progress will disappear.',
  'install.step1': 'Tap Share',
  'install.step2': 'Add to Home Screen',
  'install.fine': 'Then open it from the icon, not from here.',

  // === v1.02 ============================================================
  'common.close': 'Close',
  'common.retry': 'Retry',

  // library continue shortcut
  'lib.continue': 'Continue %s',
  'lib.continueKick': 'Pick up where you left off',

  // study master/detail + details control
  'study.details': 'Details',
  'study.hide': 'Hide',
  'study.chooseWord': 'Choose a word',
  'study.chooseWordHelp': 'Pick a word on the left to see its meaning, example and pronunciation.',
  'study.synonym': 'Same meaning',
  'study.antonym': 'Opposite',

  // session recovery
  'session.resumeTitle': 'Resume where you left off?',
  'session.resumePractice': 'You have an unfinished practice in this unit.',
  'session.resumeTest': 'You have an unfinished test in this unit.',
  'session.resume': 'Resume',
  'session.startOver': 'Start over',
  'session.leaveTitle': 'Leave this unfinished?',
  'session.leaveBody': 'Your answers so far will be saved so you can resume.',
  'session.leave': 'Leave',
  'session.stay': 'Keep going',

  // practice progress separation
  'practice.firstPass': '%d / %d first pass',
  'practice.retriesDone': '%d retries',

  // settings: data / backup
  'set.data': 'Progress & backup',
  'set.backup': 'Back up progress',
  'set.restore': 'Restore progress',
  'set.lastBackup': 'Last backup: %s',
  'set.neverBackedUp': 'Not backed up yet',
  'set.shareReport': 'Share progress report',
  'set.dataHelp': 'Progress lives only on this device. Back it up before reinstalling or switching phones.',
  'backup.restoreAsk': 'Replace all progress?',
  'backup.restoreBody': 'This overwrites your current progress with the backup file. It cannot be undone.',
  'backup.replace': 'Replace',
  'backup.saved': 'Backup saved.',
  'backup.restored': 'Progress restored.',
  'backup.shared': 'Report ready.',
  'backup.invalid': 'That file is not a valid backup.',
  'backup.readFail': 'Could not read the file.',

  // progress report
  'report.title': 'Progress report',
  'report.for': 'Progress report — %s',
  'report.generated': 'Generated %s',
  'report.unitsStarted': 'Units started',
  'report.unitsComplete': 'Units completed',
  'report.wordsKnown': 'Words known',
  'report.topMissed': 'Most missed words',
  'report.bestScores': 'Best test scores',
  'report.none': 'No activity recorded yet.',

  // audio recovery / cache management
  'audio.downloadedN': '%d downloaded',
  'audio.failedN': '%d failed',
  'audio.remainingN': '%d remaining',
  'audio.retryFailed': 'Retry failed downloads',
  'audio.someFailed': 'Some clips did not download. Check your connection and retry.',
  'audio.cacheLine': '%d clips · about %s',
  'audio.clear': 'Clear downloaded audio',
  'audio.clearAsk': 'Clear downloaded audio?',
  'audio.clearBody': 'You can download it again later over Wi-Fi.',
  'audio.cleared': 'Downloaded audio cleared.',
  'audio.srcClip': 'Built-in recordings',
  'audio.srcVoice': "Your phone's voice",
  'audio.srcNone': 'Not available',

  // essential-data load error
  'error.loadTitle': 'Could not load the word lists',
  'error.loadBody': 'The app could not read its vocabulary. If you are offline, connect to the internet once so it can finish setting up, then retry.',

  // accessible names
  'a11y.prevQuestion': 'Previous question',
  'a11y.nextQuestion': 'Next question',
  'a11y.playWord': 'Play pronunciation',
  'a11y.progress': 'Progress',
  'a11y.settings': 'Settings',
  'a11y.expandDetails': 'Show details',

  // === v1.03: remote vocabulary updates ================================
  'update.checking': 'Checking for vocabulary updates…',
  'update.upToDate': 'Vocabulary is up to date.',
  'update.updated': 'Vocabulary updated.',
  'update.downloaded': 'Update downloaded. It will be applied after this activity.',
  'update.failed': "Couldn't check for updates. Your saved vocabulary is still available.",
  'set.vocab': 'Vocabulary',
  'set.checkUpdates': 'Check for vocabulary updates',
  'set.contentVersion': 'Content version: %s',
  'set.contentBundled': 'Content version: built-in',
  'set.lastChecked': 'Last checked: %s',
  'set.neverChecked': 'Not checked yet',

  // === v1.03.1: update bar =============================================
  'update.appReady': 'New app version ready.',
  'update.vocabReady': 'New vocabulary ready.',
  'update.reload': 'Reload',
  'update.dismiss': 'Dismiss',
};

const ZH_TABLE = {
  // --- app ---------------------------------------------------------------
  'app.title': 'Inspired English',
  'app.kicker': '学生版 · 可离线使用',
  'common.back': '← 返回',
  'common.done': '完成',
  'common.cancel': '取消',
  'common.continue': '继续',
  'common.start': '开始',
  'common.save': '保存',
  'common.of': '/',

  // --- onboarding --------------------------------------------------------
  'onboard.kicker': '欢迎',
  'onboard.title': '开始之前',
  'onboard.nameLabel': '你叫什么名字？',
  'onboard.nameHint': '你的名字',
  'onboard.nameHelp': '如果你给老师看你的学习记录，老师会看到这个名字。',
  'onboard.langLabel': '选择语言',
  'onboard.langHelp': '以后可以在「设置」里更改。',
  'onboard.begin': '开始学习',
  'onboard.needName': '请先输入你的名字。',

  // --- home --------------------------------------------------------------
  'home.vocabulary': '词汇',
  'home.reading': '阅读理解',
  'home.middle': '初中英语',
  'home.high': '高中英语',
  'home.memory': '记忆宫殿',
  'home.comingSoon': '即将推出',

  // --- library -----------------------------------------------------------
  'lib.listType': '列表类型',
  'lib.book': '教材',
  'lib.group': '分组',
  'lib.units': '单元',
  'lib.complete': '已完成 %d / %d',
  'lib.known': '已掌握 %d/%d',
  'lib.best': '最好成绩 %d%%',
  'lib.settings': '设置',
  'lib.empty': '没有找到词表',
  'lib.hello': '你好，%s',
  'lib.cloze': '完形填空',
  'lib.clozeCaption': '阅读完整短文，点击空格，像展开折纸一样查看选项。',

  // --- unit --------------------------------------------------------------
  'unit.notFound': '找不到该单元',
  'unit.words': '%d 个单词',
  'unit.lastUsed': '上次 %s',
  'unit.notStarted': '尚未开始',
  'unit.record': '你的记录',
  'unit.knownOf': '已掌握 %d / %d',
  'unit.bestTest': '最好成绩',
  'unit.lastTest': '上次成绩',
  'unit.testsDone': '测验次数',
  'unit.cardRuns': '闪卡次数',
  'unit.reset': '清除本单元记录',
  'unit.resetAsk': '清除本单元记录？',
  'unit.resetBody': '这将清除你在 %s 的所有记录。其他单元不受影响。',
  'unit.missed': '经常做错的单词',
  'unit.missedNone': '暂时没有 — 继续加油',
  'unit.missedTimes': '错 %d 次',
  'unit.history': '测验记录',
  'unit.historyNone': '还没有测验记录',
  'unit.attempt': '第 %d 次',
  'unit.pass': '通过',
  'unit.fail': '未通过',
  'unit.retestTag': '重测',

  // --- modes -------------------------------------------------------------
  'mode.study': '学习',
  'mode.studyCaption': '完整词表。点击单词即可听发音。',
  'mode.practice': '练习',
  'mode.practiceCaption': '选择题，每五题一组。每题作答后立即看到答案。',
  'mode.advanced': '高级练习',
  'mode.advancedCaption': '本套高中英语词汇资料中的考试型选择题。',
  'mode.cards': '闪卡',
  'mode.cardsCaption': '认识就右滑，不认识就左滑。点击卡片翻面。',
  'mode.test': '测验',
  'mode.testCaption': '做完之前不显示答案。需要 %d%% 才能通过。',

  // --- study -------------------------------------------------------------
  'study.find': '查找',
  'study.wordList': '单词表',
  'study.shown': '显示 %d 个',
  'study.example': '例句',
  'study.same': '近义词',
  'study.opposite': '反义词',
  'study.noExample': '这个单词还没有例句',
  'study.tapToHear': '点击单词听发音',

  // --- cards -------------------------------------------------------------
  'cards.tapToFlip': '点击翻面',
  'cards.sayIt': '▶  读一遍',
  'cards.dontKnow': '✗  不认识',
  'cards.know': '✓  我认识',
  'cards.flip': '↻  翻面',
  'cards.hint': '左滑＝不认识 · 右滑＝认识 · 点击翻面',
  'cards.finished': '闪卡完成',
  'cards.knownOf': '认识 %d / %d',
  'cards.stillToLearn': '还需要学习',
  'cards.drillMissed': '重练这 %d 个',
  'cards.drillMissedCaption': '只练你左滑的单词。',
  'cards.again': '打乱后再来一次',
  'cards.againCaption': '完整词表，重新排序。',
  'cards.allKnown': '全部认识',
  'cards.empty': '这个词表是空的',
  'cards.retry': '闪卡 · 重练',

  // --- HSE advanced practice --------------------------------------------
  'advanced.loading': '正在加载高级练习…',
  'advanced.empty': '本套资料暂时没有高级练习题。',
  'advanced.question': '第 %d / %d 题',
  'advanced.reading': '阅读语境',
  'advanced.correct': '正确',
  'advanced.notQuite': '不正确',
  'advanced.answer': '答案：%s',
  'advanced.next': '下一题',
  'advanced.seeResult': '查看结果',
  'advanced.complete': '高级练习完成',
  'advanced.score': '答对 %d / %d',
  'advanced.again': '再练一次',

  // --- practice ----------------------------------------------------------
  'practice.tooShort': '这个词表太短，无法测验',
  'practice.q': '第 %d / %d 题',
  'practice.miss': '错题 %d / %d',
  'practice.fixing': '练习 · 订正错题',
  'practice.meaningQ': '这个单词是什么意思？',
  'practice.recallQ': '哪个单词是这个意思？',
  'practice.gapQ': '哪个单词填入空格？',
  'practice.tagMeaning': '词义',
  'practice.tagRecall': '回忆',
  'practice.tagContext': '语境',
  'practice.correct': '正确',
  'practice.notQuite': '不对',
  'practice.comesBack': '这题最后会再出现一次。',
  'practice.checkpoint': '阶段小结',
  'practice.roundDone': '本组完成',
  'practice.allCorrect': '全部正确',
  'practice.gotOf': '答对 %d / %d',
  'practice.answered': '已答 %d 题',
  'practice.firstTime': '一次答对 %d / %d',
  'practice.progress': '进度',
  'practice.nothingLeft': '没有需要订正的了',
  'practice.stillToGet': '还有 %d 个要答对',
  'practice.retestMissed': '重做错的 %d 题',
  'practice.seeResult': '查看结果',
  'practice.keepGoing': '继续',
  'practice.complete': '练习完成',
  'practice.everyCorrect': '所有单词都答对了',
  'practice.extraTries': '你多用了 %d 次机会订正错题。',
  'practice.straightThrough': '一次通过，没有重做。',
  'practice.again': '再练一次',
  'practice.againCaption': '同一词表，题目重新排列。',

  // --- test --------------------------------------------------------------
  'test.setup': '设置测验',
  'test.howMany': '测验多少题？',
  'test.ten': '10 题',
  'test.twenty': '20 题',
  'test.all': '全部 %d 个单词',
  'test.lengthHelp': '需要 %d%% 才能通过。做完之前不会显示任何答案。',
  'test.begin': '开始测验',
  'test.q': '第 %d 题，共 %d 题',
  'test.answered': '已答 %d 题',
  'test.noAnswersYet': '做完之后才显示答案',
  'test.previousWord': '← 上一个单词',
  'test.nextWord': '下一个单词 →',
  'test.findUnanswered': '答完所有单词后才能交卷',
  'test.finish': '交卷',
  'test.finishAsk': '交卷并查看成绩？',
  'test.finishBody': '你已作答 %d / %d 题。未作答的题目按错误计算。',
  'test.result': '测验结果',
  'test.passedMsg': '恭喜 %s，你通过了！',
  'test.failedMsg': '%s，你没有通过，下次要更努力！',
  'test.scoreOf': '答对 %d / %d',
  'test.gotWrong': '做错的单词',
  'test.allRight': '所有单词都答对了',
  'test.retestWrong': '重测错的 %d 个',
  'test.retestCaption': '只测你做错的单词。',
  'test.takeAgain': '再测一次',
  'test.takeAgainCaption': '从整个单元重新出题。',
  'test.retestTitle': '测验 · 重测',

  // --- cloze tests -------------------------------------------------------
  'cloze.title': '完形填空',
  'cloze.reading': '阅读',
  'cloze.kicker': '北京英语真题短文库',
  'cloze.loading': '正在加载完形填空…',
  'cloze.loadError': '无法加载完形填空题库。请检查网络后重试。',
  'cloze.chooseGrade': '选择年级',
  'cloze.grade7': '初一',
  'cloze.grade8': '初二',
  'cloze.grade9': '初三',
  'cloze.passages': '%d 篇短文',
  'cloze.studyMode': '学习',
  'cloze.studyCaption': '自己选择短文。每次作答后立即查看对错。',
  'cloze.testMode': '测试',
  'cloze.testCaption': '随机抽取不同短文，完成前不显示答案。',
  'cloze.record': '完形填空记录',
  'cloze.noRecord': '还没有完形填空记录',
  'cloze.redo': '重做',
  'cloze.perfect': '全对',
  'cloze.choosePassage': '选择短文',
  'cloze.search': '搜索标题、年份或地区',
  'cloze.passagesLabel': '短文',
  'cloze.shown': '显示 %d 篇',
  'cloze.noMatches': '没有符合搜索条件的短文',
  'cloze.attempts': '%d 次',
  'cloze.blanks': '个空',
  'cloze.tapBlank': '点击空格展开选项',
  'cloze.hiddenUntilEnd': '完成前不显示答案',
  'cloze.answered': '已答 %d / %d',
  'cloze.blankLabel': '第 %d 空：%s',
  'cloze.chooseAnswer': '第 %d 空 · 选择答案',
  'cloze.correct': '正确',
  'cloze.notQuite': '不正确',
  'cloze.answerIs': '答案：%s',
  'cloze.answerAll': '答完所有空格即可完成本篇。',
  'cloze.finish': '完成并查看结果',
  'cloze.finishAsk': '完成这次完形填空吗？',
  'cloze.finishBody': '你已回答 %d / %d 个空。未作答的空格将计为错误。',
  'cloze.leaveBody': '答案已保存在本设备上，稍后可继续作答。',
  'cloze.result': '完形填空结果',
  'cloze.score': '答对 %d / %d',
  'cloze.review': '需要复习的答案',
  'cloze.everyRight': '所有空格都答对了',
  'cloze.wellDone': '做得好，%s！',
  'cloze.tryAgain': '再做一次',
  'cloze.tryAgainCaption': '清除本次答案，重新开始。',

  // --- settings ----------------------------------------------------------
  'set.title': '设置',
  'set.kicker': '按你的习惯来',
  'set.name': '你的名字',
  'set.nameChange': '修改名字',
  'set.language': '语言',
  'set.display': '显示',
  'set.invert': '反色显示',
  'set.invertHelp': '白底变黑底。正确仍然是绿色，错误仍然是红色。',
  'set.cards': '闪卡',
  'set.reverse': '先显示中文',
  'set.reverseHelp': '卡片正面显示中文，你来回忆英文单词。',
  'set.on': '开',
  'set.off': '关',
  'set.audio': '发音',
  'set.audioClips': '内置录音',
  'set.audioTts': '手机语音',
  'set.audioNone': '此手机不支持',
  'set.about': '关于',
  'set.version': '版本 %s',

  // --- audio warning -----------------------------------------------------
  'audio.noEngine': '此手机没有语音引擎',
  'audio.noEngineBody': '点击单词不会有声音。可以在「设置 → 无障碍」中安装语音引擎，或者向老师索取内置录音的版本。',

  // === PWA-ONLY keys (NEW -- not proofed by Peter) =======================
  'pwa.offlineAudio': '离线发音',
  'pwa.downloadAll': '下载全部发音（24 MB）',
  'pwa.allClips': '全部 %d 个录音已在本机',
  'pwa.someClipsAll': '已下载 %d / %d 个录音',
  'pwa.downloading': '下载中… %d/%d',
  'pwa.download': '下载以便离线使用',
  'pwa.pronunciation': '发音',
  'pwa.readyOffline': '已可离线 · %d 个录音',
  'pwa.someClips': '本机已有 %d / %d 个录音',
  'pwa.noClips': '本单元没有录音 — 将由手机朗读',
  'pwa.searchHint': '单词或释义',

  // Install / tab-storage warning (PWA-only, NEW -- not proofed by Peter).
  'install.title': '把它添加到主屏幕',
  'install.lead': '你正在浏览器标签页中使用。',
  'install.bold': 'iPhone 会在一周后删除浏览器数据',
  'install.tail': '，你的学习记录会消失。',
  'install.step1': '点击「分享」',
  'install.step2': '选择「添加到主屏幕」',
  'install.fine': '以后请从图标打开，而不是从这里。',

  // === v1.02 ============================================================
  'common.close': '关闭',
  'common.retry': '重试',

  'lib.continue': '继续 %s',
  'lib.continueKick': '继续上次的学习',

  'study.details': '详情',
  'study.hide': '收起',
  'study.chooseWord': '选择一个单词',
  'study.chooseWordHelp': '在左侧选择一个单词，查看它的释义、例句和发音。',
  'study.synonym': '近义词',
  'study.antonym': '反义词',

  'session.resumeTitle': '从上次的地方继续？',
  'session.resumePractice': '本单元有一个未完成的练习。',
  'session.resumeTest': '本单元有一个未完成的测验。',
  'session.resume': '继续',
  'session.startOver': '重新开始',
  'session.leaveTitle': '要离开未完成的练习吗？',
  'session.leaveBody': '你目前的作答会被保存，方便你稍后继续。',
  'session.leave': '离开',
  'session.stay': '继续做',

  'practice.firstPass': '首轮 %d / %d',
  'practice.retriesDone': '订正 %d 次',

  'set.data': '进度与备份',
  'set.backup': '备份进度',
  'set.restore': '恢复进度',
  'set.lastBackup': '上次备份：%s',
  'set.neverBackedUp': '尚未备份',
  'set.shareReport': '分享学习报告',
  'set.dataHelp': '进度只保存在本机。重装或换手机前请先备份。',
  'backup.restoreAsk': '替换全部进度？',
  'backup.restoreBody': '这将用备份文件覆盖你当前的进度，无法撤销。',
  'backup.replace': '替换',
  'backup.saved': '备份已保存。',
  'backup.restored': '进度已恢复。',
  'backup.shared': '报告已生成。',
  'backup.invalid': '该文件不是有效的备份。',
  'backup.readFail': '无法读取文件。',

  'report.title': '学习报告',
  'report.for': '学习报告 — %s',
  'report.generated': '生成于 %s',
  'report.unitsStarted': '已开始单元',
  'report.unitsComplete': '已完成单元',
  'report.wordsKnown': '已掌握单词',
  'report.topMissed': '最常做错的单词',
  'report.bestScores': '最好测验成绩',
  'report.none': '暂无学习记录。',

  'audio.downloadedN': '已下载 %d',
  'audio.failedN': '%d 个失败',
  'audio.remainingN': '剩余 %d',
  'audio.retryFailed': '重试失败的下载',
  'audio.someFailed': '部分录音下载失败。请检查网络后重试。',
  'audio.cacheLine': '%d 个录音 · 约 %s',
  'audio.clear': '清除已下载的发音',
  'audio.clearAsk': '清除已下载的发音？',
  'audio.clearBody': '以后可以再通过 Wi-Fi 下载。',
  'audio.cleared': '已清除下载的发音。',
  'audio.srcClip': '内置录音',
  'audio.srcVoice': '手机语音',
  'audio.srcNone': '不可用',

  'error.loadTitle': '无法加载词表',
  'error.loadBody': '应用无法读取词库。如果你处于离线状态，请先联网一次以完成初始化，然后重试。',

  'a11y.prevQuestion': '上一题',
  'a11y.nextQuestion': '下一题',
  'a11y.playWord': '播放发音',
  'a11y.progress': '进度',
  'a11y.settings': '设置',
  'a11y.expandDetails': '显示详情',

  // === v1.03: remote vocabulary updates ================================
  'update.checking': '正在检查词库更新…',
  'update.upToDate': '词库已是最新。',
  'update.updated': '词库已更新。',
  'update.downloaded': '更新已下载，将在本次练习结束后应用。',
  'update.failed': '无法检查更新。你已保存的词库仍可使用。',
  'set.vocab': '词库',
  'set.checkUpdates': '检查词库更新',
  'set.contentVersion': '词库版本：%s',
  'set.contentBundled': '词库版本：内置',
  'set.lastChecked': '上次检查：%s',
  'set.neverChecked': '尚未检查',

  // === v1.03.1: update bar =============================================
  'update.appReady': '有新版本应用。',
  'update.vocabReady': '新词库已就绪。',
  'update.reload': '刷新',
  'update.dismiss': '关闭',
};

// Now that the tables exist, set the default language.
current = new Strings(EN_TABLE);
