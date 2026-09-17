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

## Unreleased

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

### Planned

- Add a versioned, replayable tutorial covering the app's new and non-obvious functions.
- Replace transient reading selection with persistent highlights backed by stable text anchors.
- Separate removable highlights from the immutable vocabulary encounter log.
- Remove Reading narration from the base Android APK and make it an optional, verified download.
- Hold the Memory Palace redesign as a discovery item until its purpose and review interaction are agreed.

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
