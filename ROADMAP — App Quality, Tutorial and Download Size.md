---
title: Inspired English App — Quality and Size Roadmap
aliases:
  - Vocab App Roadmap
tags:
  - inspired-english
  - app
  - roadmap
status: planning
updated: 2026-09-17
---

# Roadmap — App Quality, Tutorial and Download Size

## Outcome

Prepare a trustworthy follow-up to v1.09 by cleaning the learner content, making unfamiliar interactions teach themselves, preserving selected vocabulary visibly, and reducing the Android installer from approximately 450 MB by moving reading narration out of the base APK.

Memory Palace remains a product-discovery placeholder until its learning model is agreed.

## Recommended release sequence

| Phase | Priority | Deliverable | Release gate |
|---|---|---|---|
| 0 | P0 | Freeze and inventory v1.09 | Reproducible baseline, progress backup tested, defect ledger generated |
| 1 | P0 | Content quarantine and audit pipeline | Only approved records can enter learner-facing bundles |
| 2 | P0 | Optional Reading audio on Android | Base APK excludes all 144 narration files and handles offline/failed downloads clearly |
| 3 | P1 | Persistent vocabulary selection | Selection is visible after reload; reset changes the UI without deleting the historical log |
| 4 | P1 | Built-in tutorial | First-run overview plus replayable, contextual help for every non-obvious interaction |
| 5 | P2 | Memory Palace discovery | Agreed mental model and prototype before its scheduling logic is rewritten |
| 6 | P0 | Release candidate audit | Content, upgrade, offline, storage and physical-device checks pass |

Content cleanup and Android audio work can be developed independently, but both should land before the next public APK. The tutorial should describe the corrected interactions, so it follows the selection redesign.

## 1. Built-in tutorial

### Recommendation

Use two layers rather than one long slideshow:

1. A short, skippable first-run orientation after name/language setup: what the five home areas are, where progress lives, and how to find Settings/help.
2. Contextual first-use guidance inside each area. Show it only when the learner reaches that function, and make all guidance replayable from Settings → Help & tutorial.

### Tutorial inventory

- Home: Vocabulary, Reading, Middle School, Advanced Practice and Memory Palace.
- Vocabulary library: books/packages, units and offline pronunciation controls.
- Study: search, expand an entry and play pronunciation.
- Practice: immediate feedback and retry behavior.
- Cards: flip, swipe/buttons, known/unknown and reversed-card setting.
- Test: length choice, navigation, unanswered items, submit, pass mark, retest and history.
- Reading: article audio, reading progress, vocabulary selection, persistent highlight, undo/reset, exercises, submission and completion.
- Middle School and Advanced Practice: section selection, Study versus Test behavior and answer availability.
- Memory Palace: only after its redesign. Until then, label it **Experimental** in help copy rather than explaining a model that may be replaced.
- Settings: local-only progress, backup/restore, language, display, audio storage and updates.

### Acceptance criteria

- Skipping or completing the tutorial is stored separately from learning progress.
- Tutorial versioning allows a new feature tour after an upgrade without replaying every old step.
- Every step has English and Simplified Chinese copy and works with screen readers and keyboard controls.
- No step blocks normal navigation; interrupted tours resume safely or can be restarted.
- Automated checks verify every tutorial target still exists.

## 2. Content audit and extraction repair

This is the largest quality risk and should be treated as a data-production problem, not a series of display patches. See [[CONTENT AUDIT — Reading and Middle School]].

The core change is to separate four layers:

```text
source extraction → normalized staging records → reviewed/approved records → learner bundles
```

The app must render the approved structured fields only. It should not display a full `sourceText` blob above questions, because that recreates the source page and duplicates material already parsed into fields.

Before changing IDs, define aliases or migrations so existing completion records continue to point to the corrected lesson wherever possible.

## 3. Persistent vocabulary selection

### Current problem

The reading screen currently relies on browser text selection after mouse/touch events. It then stores one memory item and shows a temporary lookup panel. Article paragraphs remain plain strings, so there is no stable inline element to highlight after a reload. Choosing **Remove** calls `forget()`, which deletes the saved Memory Palace item and its history.

That behavior conflicts with the desired model: selecting a word should leave a visible mark, and a learner may clear the mark without rewriting what historically happened.

### Proposed data model

Keep three concepts separate:

- **Immutable encounter log** — article ID, stable selection ID, vocabulary ID or normalized text, sentence/offset anchor and timestamp. Append only.
- **Current article marks** — which selections are visibly highlighted now. A learner can deactivate, undo or reset these.
- **Learning item state** — Memory Palace/review state derived from encounters but editable independently.

An undo/reset operation updates current marks; it does not delete encounter events. If auditability requires recording the reset, append a separate reset event rather than modifying the original encounter.

### Interaction recommendation

- Double-tap remains the primary touch gesture.
- Selected words/phrases receive a restrained persistent highlight that survives route changes and reloads.
- Tapping a highlighted item reopens its definition and offers **Remove highlight**.
- Provide an accessible alternative: select text and use an explicit **Save vocabulary** action, plus keyboard focus/activation for authored token spans.
- Add **Undo last selection** and **Reset highlights for this article**. Both require clear copy that review history is retained.
- Prefer phrase matches over single words when authored phrase boundaries exist.

### Technical prerequisite

Plain paragraph strings are not enough for reliable highlights. The published schema needs stable sentence IDs and either authored token/phrase spans or normalized character offsets. Highlights should bind to these stable anchors, not fragile DOM ranges.

### Acceptance criteria

- Double-tap does not zoom the page or break scrolling/text selection on iOS.
- Highlight state survives reload, app restart and content updates that retain the same stable anchor.
- Reset removes visible marks but the encounter log remains unchanged.
- Repeated selection of the same item is defined and tested: one active mark, multiple encounter events only when product rules say they count.
- Existing v1.09 `tapped` and Memory Palace data migrates without loss.

## 4. Memory Palace placeholder

Do not rewrite the scheduler yet. First answer these product questions with a small prototype:

- Is the purpose to remember vocabulary from reading, all vocabulary across the app, or both?
- Does an item enter automatically when looked up, or only after an explicit **Save** action?
- What is the student's task during review: self-rating, English→Chinese recall, Chinese→English production, contextual cloze, or a mix?
- What makes the feature a “palace”? The current screen is a spaced-review list; the name promises a spatial mnemonic model it does not provide.
- Should “already know,” removing a highlight and removing an item from review be separate actions?
- What evidence moves an item between New, Learning, Review, Difficult and Mastered?
- How should reading context, multiple meanings and repeated encounters affect scheduling?

Until these are settled:

- preserve current data and routes;
- fix only defects that risk loss or corruption;
- avoid adding tutorial claims about how the system is meant to work;
- consider an **Experimental** label and a short plain-language description.

## 5. Optional Reading audio and Android size

### Current state

`sync_web_release.py` copies the entire `audio/` directory into `app/src/main/assets/web/`. The 144 reading recordings total **343.9 MiB** before APK packaging and dominate the approximately **450 MB** release APK. They are served from the local `https://app.local` asset origin.

### Recommended v1 solution

- Exclude `audio/readings/` from the Android sync step.
- Keep the narration manifest in the APK, but give each recording a remote URL, byte size, content hash and duration.
- Download on first play into persistent app/WebView storage and show progress, failure and retry states.
- Offer explicit **Download this article**, **Download this level**, and **Remove downloaded reading audio** controls.
- Text, exercises and progress remain completely usable without audio.
- Verify remote hosting and CORS from Android WebView and from real mainland-China connections before release.

The expected first-order saving is approximately 344 MiB of raw bundled assets. The rebuilt APK size must be measured; do not promise a final number until packaging is complete. A later size pass can examine duplicated word clips/audio packs, but that is outside this specific requirement.

### Android-specific work

- Change the sync allowlist so reading recordings cannot accidentally re-enter the APK.
- Make missing local reading audio fall through to the declared remote source instead of returning a terminal `app.local` 404.
- Decide whether Cache Storage is sufficient for durable downloads on supported Android versions. If not, add a minimal native download/file-serving bridge.
- Preserve partial-download safety with temporary files/cache entries and hash verification before marking a track available.
- Add storage reporting, Wi-Fi/size copy, retry and clear controls.

### Acceptance criteria

- The release manifest and APK contain zero `assets/web/audio/readings/*.m4a` files.
- Fresh install can open and complete all 144 text lessons offline.
- A downloaded recording plays offline after app restart.
- Interrupted or corrupt downloads are not presented as complete.
- Clearing reading audio does not affect word audio or learning progress.
- Upgrade from v1.09 preserves local progress and does not require uninstalling the signed app.

## Release definition of done

- Approved-content gate passes and the learner bundles contain no quarantined record.
- Representative records from every level, grade and exercise type receive human review.
- Content IDs and progress migrations are tested against a v1.09 backup.
- Tutorial, persistent highlights and optional audio pass iPhone and physical Android walkthroughs.
- Android APK composition and size are recorded in the changelog.
- A clean build, curriculum validation, browser smoke test, Android unit/lint checks and upgrade installation all pass.

