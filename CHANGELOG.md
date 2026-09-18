---
title: Inspired English App — Changelog
tags:
  - inspired-english
  - app
  - changelog
updated: 2026-09-18
---

# Changelog

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
