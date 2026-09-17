---
title: Inspired English App — Project Index
aliases:
  - Vocab App Project Index
tags:
  - inspired-english
  - app
  - project-index
status: active
updated: 2026-09-17
---

# Inspired English App — Project Index

> [!summary]
> `Vocab Drill Web` is the canonical learner app. The iPhone/iPad PWA runs it directly, and Android v1.09 packages the same web release inside a WebView shell. Product work normally starts here; Android-only packaging work lives in `../Vocab Drill Student App/`.

## Current release

| Item | Current state |
|---|---|
| Learner release | v1.09, released 2026-09-15 |
| Web source | `Inspired Vocab Development/Vocab Drill Web/` |
| Android shell | `Inspired Vocab Development/Vocab Drill Student App/` |
| Android APK | `VocabDrill-1.09-20260915.apk`, approximately 450 MB |
| App data model | Local-first; browser storage / WebView storage; no accounts or server-side student record |
| Canonical curriculum build | `tools/build_curriculum.py` |
| Current structural audit | `tools/validate_curriculum.py` → `curriculum-audit.json` |

The repository was clean and matched `origin/main` when this index was prepared.

## Which folder does what

| Folder | Status | Purpose |
|---|---|---|
| `Vocab Drill Web/` | **Active source** | Shared UI, routes, local data, learning logic, curriculum bundles, web audio, validation and browser checks |
| `Vocab Drill Student App/` | **Active Android shell** | Packages an audited web release, provides WebView behavior, Android signing and legacy-data migration |
| `Vocab Drill Board/` | Live separate product | Teacher's classroom board; do not change as part of learner-app work |
| `Reading Explorer Extracts/` | Source material | Markdown extraction inputs used to build the 144 reading lessons |
| `VocabDrill/` and `Vocab Drill.html` | Legacy | Earlier implementations; reference only unless a task explicitly targets them |
| `Inspire Vocab/` | Separate web product | Teacher/studio system backed by Supabase; not the v1.09 learner app |

## Product map

The home screen currently routes to five learning areas:

1. **Vocabulary** — Study, Practice, Cards and Test across book units and HSE packages.
2. **Reading Comprehension** — 144 lessons across Foundation and Levels 1–5, with article audio, source exercises, selected vocabulary and completion history.
3. **Middle School English** — Grades 7–9, organized into MCQ and reading sections.
4. **Advanced Practice** — HSE worksheet-derived selectable-answer questions.
5. **Memory Palace** — selected reading vocabulary, a spaced-review queue, detail/context pages and review history.

Settings also contains language, name, colour inversion, reversed cards, audio management, update checks and local backup/restore.

## Source layout

```text
index.html                       app shell and persistent audio element
app.css                          shared design system
js/main.js                       boot and hash router
js/profile.js                    onboarding and preferences
js/store.js                      core vocabulary progress
js/curriculum-store.js           reading progress, selections and Memory Palace
js/screens/                      one module per learner screen
reading-content.json             144 extracted reading lessons
middle-school.json               3,218 extracted middle-school records
advanced-practice.json           HSE advanced-practice bank
cloze.json                       cloze bank
vocab.json                       vocabulary corpus
audio/readings/                  144 reading recordings
audio/                           word audio and downloadable audio packs
tools/build_curriculum.py        reading and middle-school extraction
tools/validate_curriculum.py     current structural/audio validator
tools/browser_smoke.py           browser-level release checks
```

The Android packaging path is:

```text
Vocab Drill Web
  → tools/validate_curriculum.py
  → Vocab Drill Student App/tools/sync_web_release.py
  → app/src/main/assets/web/
  → Android WebView at https://app.local
  → release APK
```

## Health snapshot — 2026-09-17

The current audit reports zero errors, but it verifies structure and audio integrity rather than the educational correctness of extracted content. A direct inventory found:

| Corpus | Inventory | Extraction indicators requiring review |
|---|---:|---:|
| Reading lessons | 144 articles; 2,412 parsed exercise questions | 2,412 questions have no answer key; 1,439 have no choices; 77 have more than four choices; 134 contain duplicate choice IDs |
| Middle-school bank | 3,218 records; 17,683 questions | 4,838 questions have no answer key; 5,085 have no choices; 95 have more than four choices; 96 contain duplicate choice IDs |
| Reading article length | 210–2,469 words; average 722 | Large outliers need review for page/exercise leakage |
| Middle-school passage length | 8–1,796 words; average 384 | Both very short and very long outliers need review for split/merge errors |
| Reading audio | 144 files; 343.9 MiB | Bundled into Android and is the main APK-size problem |
| Word audio | 5,364 individual files; 20.8 MiB | Separate from reading narration; retain for now |

These counts are triage signals, not automatic verdicts. Open-response exercises can legitimately have no choices, for example, but they need an explicit question type and an intentional grading rule.

## Known architectural constraints

- Preserve vocabulary progress keys, audio slugs and MCQ construction rules documented in `CLAUDE.md`.
- Preserve existing student progress across curriculum corrections. Content IDs need a migration/alias policy before records are merged or split.
- iOS and Android share the learner code, but asset delivery differs. The PWA may fetch and cache media; the Android shell currently copies the entire web tree into the APK.
- The learner app is offline-first. Optional audio must degrade clearly when unavailable and must not make text lessons depend on a network connection.
- The teacher board is a separate live application and is outside this roadmap.

## Working documents

- [[ROADMAP — App Quality, Tutorial and Download Size]]
- [[CONTENT AUDIT — Reading and Middle School]]
- [[CHANGELOG]]
- [[README|Developer README]]
- [[PUBLISHING|Vocabulary publishing workflow]]

