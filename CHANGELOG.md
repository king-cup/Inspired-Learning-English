---
title: Inspired English App — Changelog
tags:
  - inspired-english
  - app
  - changelog
updated: 2026-09-18
---

# Changelog

## 1.10.2-preview — non-production checkpoint — 2026-09-19

The user chose a checkpoint branch and a separately installed preview APK, **not** publication to students. See [[PREVIEW-1.10.2]] for limitations, checks and reproducible Android source. Production `main` is not updated by this checkpoint.

- Refreshed `PRODUCT.md`, `DESIGN.md` and the component-preview sidecar from the implemented interface. Original monochrome paper/Courier styling is unchanged.
- Labelled the web shell and bilingual Settings/update notice `1.10.2-preview`. The notice explicitly identifies unfinished reading content, examples and translations.
- Android preview uses a separate package ID and **Inspired Preview** launcher label, so it does not replace the student app or share its storage.
- Built with existing recordings and no bundled reading narration or duplicate packs. The unpublished reading-answer draft remains excluded.

中文：本次仅保存非正式 Git 检查点并提供独立安装的安卓预览版，不更新正式学生版本。设计文档已刷新，保留原黑白配色和字体。预览版清楚说明阅读审核、例句和整句翻译尚未完成；不替换原应用或其学习记录。

## 1.10.2 — verification in progress, NOT RELEASED — 2026-09-18

Publishing and an Android build are now authorized **after** the release checks pass. This supersedes the historical 1.10.1 hold below, but no push or new Android build has occurred.

- Added guided plans to progress backups (schema 3). Older backups remain readable and do not erase existing guided plans. Failed storage writes during restore roll back changes; this is not a crash-atomic database transaction.
- Added visible English/Chinese saving-failure messages and a guided-plan retry path. Unreadable guided plans are preserved rather than silently replaced. Progress is flushed when the app goes into the background.
- Fixed spelling-test progress while typing. One-word lists can use spelling tests; unavailable multiple-choice formats explain why they are disabled.
- Included the guided-learning and activity modules in the offline app cache. Existing audio files and the audio cache are unchanged.
- Expanded local timestamps for school/cloze submissions, selected answers, advanced practice, word-audio requests and vocabulary highlights. Audio requests are not evidence that a student listened. The history remains local and uses an unverified device clock.
- Corrected draft article word counts and reading-time estimates after passage restoration. The Reading Explorer answer-key draft is **not yet published**; final prose/evidence review is still required.

### 中文摘要（尚未发布）

- 进度备份现包含引导学习计划；仍可读取旧版备份。恢复时如保存失败，会尝试回退已写入的数据。
- 增加保存失败提示及引导学习重试入口，不再静默覆盖无法读取的学习计划。应用进入后台时立即保存当前词汇进度。
- 修复填空测试输入时进度条不更新的问题。只有一个词的词表仍可进行拼写测试。
- 补齐引导学习和学习记录所需的离线文件，保留现有音频。
- 扩充带设备时间戳的本地学习记录；记录不代表防篡改出勤证明，也不证明学生实际听完录音。
- 阅读理解答案草稿仍在审核中，尚未发布。完成最终检查后才推送网页版本及构建安卓安装包。

Verification details: [[../Verification Checkpoint — 1.10.2 Learning and Recovery]].

## 1.10.1 — local implementation, NOT RELEASED — 2026-09-18

**Release hold:** the user requested no Git push, deployment or Android build. None has started for this version. Existing audio is retained; narrator replacement is cancelled.

- Reused the Cloze fold for Study passage meanings across Reading Explorer and all published middle-school Reading A–E passages. Added eligible-word lookup to Cloze passages and options; option letters answer, word lookups do not select answers.
- Reading and Cloze Test screens render plain text: no definition buttons, saved highlights or lookup toolbar.
- Reading books and school MCQ/Reading A–E sections now offer Study/Test first. Study browses a list; Test and Next Test share the balanced Cloze selection rule: unseen first, least drawn next, no immediate repeat when another exercise exists. Separate scopes prevent one section affecting another.
- Reading Explorer Study and Test answers are stored separately. Next Test clears only the newly selected test draft, not Study progress.
- Settings offers nine persistent highlight colours, with contrasting text (including white on black). Original monochrome interface and fonts are unchanged.
- Every vocabulary book's visible lesson titles include its name and unit, including active Cards, Practice and Test plus results/continue links. HSE package titles remain unchanged. Reading Explorer articles explicitly show the series, level and unit.
- Added an English/Chinese one-time 1.10.1 update notice and a permanent bilingual Settings update/fix log, covering known history from 1.04. Notice is tied to running this shell version, not merely detecting an available update. It remembers dismissal locally; clearing app storage or reinstalling without retained data can show it again.
- Updated the bilingual tutorial and local [[USER GUIDE — 1.10.1]]. The same release-note catalogue renders both the notice and Settings log.
- Expanded explicit glossary lists to 3,132 published exercises/readings, reusing authored definitions and keeping stop words excluded. No fabricated definitions or high-school reading corpus was added.
- Preserved curriculum IDs, vocabulary scoring contracts, backup data and existing recordings. Shell cache bumped; audio cache unchanged.

### Remaining release boundaries

- High-school reading remains a placeholder; HSE vocabulary/Advanced Practice remain available. Future school sections should reuse the Study/Test and balanced-random contract.
- Reading Explorer answer keys still require teacher/source verification. Do not claim automatic comprehension scores.
- Android source version is prepared as 1.10.1 (code 11), but no 1.10.1 APK has been built. Browser Android-user-agent checks are not native device verification.
- Prior release history below is historical; earlier pending publishing instructions do not override this release hold.

This file tracks learner-visible releases and significant platform changes. Curriculum-only publication IDs remain recorded in `content/manifest.json` and Git history.

## 1.10 — 2026-09-18

### Local visual revision — original aesthetic restored

- At the user's request, restored the pre-1.10 black/white/grey palette, Courier UI font, original header/reading frames, and translucent, offset-shadow button styling.
- Removed the new pastel home colours and green/blue/amber interface accents. New reading menus, tutorial and inline definitions now inherit the original styling.
- Preserved all functional updates, including yellow persistent highlights, undo/history, audited content, compressed audio, one-pack vocabulary downloads, next exercises, left-positioned Settings, tablet layouts and the no-flash fix.
- Updated the design reference and offline shell version. This revision is local only; publishing and Android build remain stopped at the user's request. The existing local v1.10 tag records the earlier design and must not be pushed as the final revised release without a new reviewed commit.

### Learner experience

- Added inline passage definitions using explicit lists for 2,018 readings. Double-tap a dotted word/phrase to highlight it yellow and open its meaning inside the passage; single-tap to close/reopen. Highlights persist, and Undo keeps the encounter history.
- Reading Explorer now opens through book menus and prominent unit groups. Removed its separate lookup, vocabulary-practice and personal-test sections; retained comprehension. Added next-article/exercise actions after submission.
- Removed redundant Cloze grade selectors and active 阅读表达 routes. Improved matching-letter question grading using source answerText keys.
- Added a bilingual first-use/replayable tutorial, last-page restoration and persistent vocabulary book/unit selections.
- Removed page entrance opacity flashes and top-right text notes. Added restrained area colours and company-leaf home links; moved home Settings to the upper left. Responsive layouts cover phone, portrait tablet and landscape tablet.
- Backup/restore now includes reading, highlights, encounter history and Cloze progress as well as vocabulary. Existing progress keys are unchanged.
- Fixed article playback after word pronunciation uses the shared audio player.

### Audio and Android packaging

- Full vocabulary download is one checksummed 20.8 MiB pack containing 5,364 original clips, then unpacked into the existing offline cache. No 5,000-request fallback during this action.
- Compressed 144 existing reading recordings from 343.9 to 166.4 MiB (51.6% smaller), mono 24 kHz / 32 kbps AAC. Downloads are optional per article and cached for reuse.
- Android 1.10 excludes reading narration and duplicate vocabulary packs from the APK; retains bundled word audio and all text lessons. Uses only current release assets, resource shrinking, a smaller adaptive leaf icon, rotation/resizing, and no iOS installation banner.

### Verification and honest limits

- Structural/content validation: zero errors. Automated browser checks pass at 390×844, 834×1194, 1194×834 and 412×915, including touch/keyboard highlights, persistence/undo, all middle-school section routes, study/test submissions, next actions, vocabulary cards/practice/test, backups, tutorial and offline audio. Full vocabulary download was exactly one audio request.
- Reading Explorer still has no verified comprehension answer keys: submissions are saved for teacher review, never given invented scores. Quarantined items are not silently restored.
- Bedlam/Qwen clone bulk replacement remains deferred. This release's short-word and sentence pilots did not pass transcript checks (including an extra final word in the sentence pilot). Existing narrator audio was compressed, not regenerated against every corrected text. The approved earlier demo remains an experiment, not the production audio bank.
- 128 vocabulary entries lack an authored clip and retain the existing device-voice fallback; this is not 128 missing unique words.
- Encounter history is append-only within the app's local store and backups, not an immutable server log: there is no student backend. Browser/OS storage removal can still erase local progress. Export a backup before reinstalling or downgrading.
- Browser tests are Chromium simulations, not physical iPhone/iPad verification. Android release verification is recorded in the vault release plan after packaging.

### Rollback

- Source checkpoint before 1.10 UI/audio work: `checkpoint-v1.10-audited-content` (`5edfb9f`). Original 1.09 source remains `0bdee3023089fb46adaaf2b878bd947848bd2897`.
- Android source snapshot: `../android-source-before-1.10.tar.gz`; previous signed APK is retained. Restore/redeploy a reviewed checkpoint, without deleting student data. Native downgrades may require uninstalling, so export first.

### Included content audit

### Changed

- Rebuilt Middle School MCQ against the named 解析/test sources; 506 source-backed records with 5,780 keyed questions are published and 34 unresolved records are quarantined.
- Corrected five Cloze passage boundaries that had grammar questions prepended; all 608 passages retain valid blank counts and answer keys.
- Separated Reading A–E passages from their question blocks and published 1,874 records with usable source answers. The other 277 remain in the machine-readable quarantine instead of appearing in the app.
- Removed 阅读表达 from active learner navigation. Stored 518 cleaned 阅读表达 records and 192 clean single-task Writing records in `middle-school-future.json`; 405 ambiguous or merged future records are quarantined there.
- Audited all 144 Reading Explorer articles. Removed 288 duplicated raw exercise blocks, quarantined 173 malformed or page-dependent questions, retained 2,239 clean prompts, and removed visible footnote/page/chart debris from 95 articles.
- Replaced the duplicated Reading exercise source dump with one concise instruction above the structured questions.

### Audit artifacts

- Added `middle-school-cleaning-audit.json` with per-record source, status and failure reasons.
- Added `reading-explorer-audit.json` with one review row per article and per-question quarantine reasons.
- Added repeatable cleanup tools for both corpora.
- Added Voicebox/Kokoro and Qwen CustomVoice narration experiments outside the app bundle. Their 150 WPM, 32 kbps AAC-LC samples are approximately 52.5% smaller than the current recording for the same article and duration; batch replacement remains pending listening review.
- Added an authorized audiobook-narrator clone to Voicebox and rendered a paragraph-checked Reading Explorer comparison. The corrected 80.49-second exports are 332,816 bytes at 32 kbps and 250,749 bytes at 24 kbps; the final sentence is complete. Qwen tail repetition in rejected raw takes remains a production concern requiring automatic transcription validation and retry.

### Still planned

- Hold the Memory Palace redesign as a discovery item until its purpose and review interaction are agreed.
- Complete narrated-content regeneration after the clone passes reliability and listening checks; add source-verified Reading Explorer answer keys when available.

### Documentation

- Added [[PROJECT INDEX]] describing the canonical source, Android packaging shell, product modules and current health snapshot.
- Added [[ROADMAP — App Quality, Tutorial and Download Size]].
- Added [[CONTENT AUDIT — Reading and Middle School]].
- Corrected the developer README to reflect the shared v1.09 web codebase on iOS and Android.

## 1.09 — 2026-09-15

- Made the web release the shared learner experience packaged by the Android WebView shell.
- Added 144 Reading lessons across Foundation and Levels 1–5.
- Added 144 matching reading narrations and offline playback support.
- Added Grades 7–9 Middle School English sections.
- Added Memory Palace vocabulary collection and spaced-review state.
- Added reading progress, exercises, personalized vocabulary review and completion history.
- Added a curriculum/audio integrity audit and expanded browser smoke coverage.
- Added Android asset synchronization with a SHA-256 release manifest and legacy native-data migration.

### Known issues identified after release

- The extraction audit does not detect all passage/question boundary and merged-choice failures.
- Reading exercise answer keys are absent from the generated bundle.
- Reading narration adds 343.9 MiB of raw assets to the Android package.
- Reading vocabulary marks are not rendered as persistent inline highlights.
- Memory Palace's product model needs reconsideration.

## 1.07 — 2026-09-13

- Renamed the learner experience to Inspired English.
- Added the motion-led product home screen.
- Added HSE Advanced Practice and stabilized navigation around the expanded product areas.
- Expanded Cloze study/test content and normalized remaining cloze titles.

## 1.04 — 2026-08-23

- Bundled word pronunciation into per-unit and per-book downloadable packs.
- Added Reading vocabulary and Prepare Level 5 content.
- Regenerated word audio with the Kokoro voice pipeline.

## 1.03 — 2026-08-22

- Added versioned vocabulary publication and update handling.
- Added a shared update bar for application and curriculum updates in 1.03.1.
