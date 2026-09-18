---
name: Inspired English
description: User-restored monochrome paper and Courier interface, documented for the 1.10.2 preview.
colors:
  ink: "#000"
  paper: "#fff"
  hover: "#e8e8e8"
  rule: "#999"
  shade: "#eee"
  highlight: "#ffe57a"
  rt: "#e9f5ec"
  rt-edge: "#1c7a3e"
  wr: "#fdeceb"
  wr-edge: "#b3261e"
  glass: "rgba(255, 255, 255, .78)"
typography:
  headline:
    fontFamily: "Georgia, 'Times New Roman', 'Songti SC', 'Songti TC', 'PingFang SC', serif"
    fontSize: "27px"
    fontWeight: 900
    lineHeight: "29px"
  label:
    fontFamily: "'Courier New', ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "1.5px"
  passage:
    fontFamily: "Georgia, 'Times New Roman', 'Songti SC', 'Songti TC', 'PingFang SC', serif"
    fontSize: "18px"
    lineHeight: 1.72
  spelling:
    fontFamily: "Georgia, 'Times New Roman', 'Songti SC', 'Songti TC', 'PingFang SC', serif"
    fontSize: "20px"
  guided-prompt:
    fontFamily: "Georgia, 'Times New Roman', 'Songti SC', 'Songti TC', 'PingFang SC', serif"
    fontSize: "22px"
    lineHeight: 1.5
rounded:
  square: "0px"
spacing:
  pad: "14px"
  tablet-pad: "26px"
  home-gap: "13px"
  book-gap: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "10px 15px"
  button-thin-small:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "8px 11px"
  search-input:
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "11px"
  tag:
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "2px 6px"
  navigation-row:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "11px 13px"
  spelling-input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.spelling}"
    rounded: "{rounded.square}"
    padding: "12px"
  recovery-note:
    backgroundColor: "{colors.wr}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
  button-ruled:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "10px 15px"
  home-vocabulary:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "14px 16px"
  inline-definition:
    backgroundColor: "{colors.shade}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "18px"
---

# Design System: Inspired English

## Overview

**Creative North Star: "Monochrome reading paper"**

The user explicitly restored the pre-1.10 colours, aesthetic and UI fonts while retaining all functional updates. The current source of truth is `app.css` followed by `reader.css`, preserving the restoration recorded in commit `4d7791b`. This supersedes the earlier evergreen/native-sans direction. Refreshed 19 September 2026 from the implemented interface; this document is not production-release approval.

White paper, black ink, square ruled controls and Courier-style interface labels frame serif learning content. Existing coloured answer feedback and yellow selected-word highlights have functional meaning; they are not navigation themes.

**Key Characteristics:**

- Black ink and white paper, with functional feedback colours.
- Courier interface labels and serif learning content.
- Square framed controls, hard offset shadows and in-place folds.
- Book/unit identity visible during learning, not only in the menu.

## Colors

The frontmatter records the original light palette. The existing dark palette remains in `app.css`. Home choices, book/unit navigation and definition headings use the shared monochrome ink, paper and grey surfaces, not the rejected green/blue/amber/pastel palette.

Yellow is the default persistent passage highlight. Students may choose red, green, blue, yellow, purple, dark pink, brown, black or teal in Settings; dark choices use white text. Correct/incorrect feedback retains its existing green/red colours and text cues. The original multicolour company leaf is unchanged.

## Typography

Interface controls and labels use the original Courier New / system monospace stack. Learning prose and paper titles retain Georgia/Times/Songti; dedicated Chinese spans retain their original local serif fallback. No fonts are downloaded.

Large unit identifiers remain prominent at 22–23px because that is a requested functional improvement. Passage text remains 18px/1.72, reducing to 17px/1.68 on phones. New tutorial and definition controls inherit the restored interface font.

Spelling entry uses the `spelling` role; guided question prompts use `guided-prompt`. Labels remain separate, visible text rather than placeholder-only instructions. Chinese word glosses are labelled as meanings, not whole-sentence translations. Missing examples remain explicit, not fabricated.

## Layout

Keep the v1.10 book-to-article menus, in-flow definitions, left-positioned home Settings, and responsive phone/tablet layouts. The shell remains 720px, expanding to 960px from 760px; reading measure is capped at 75ch. New layouts do not justify a new colour or font system.

Guided sessions and spelling reuse the shared header, ruled progress bar, action buttons and feedback notes. Spelling fields fill the available width and have a minimum height of 48px. Plan dates use native date/time controls, not a custom calendar. Long titles and bilingual recovery copy wrap within the screen.

The 1.10.2 release uses passage-only comprehension. No diagrams or source charts are shown or downloaded; questions needing those visuals are explicitly excluded. Keep the page focused on prose and selectable comprehension questions. The earlier chart renderer is dormant, not a requirement to add diagrams back.

## Elevation & Depth

Restore the original translucent control surfaces, backdrop blur and hard offset button shadows from the checkpoint. Pressed buttons move inward with the original release feedback. These are explicitly requested incumbent aesthetics, not invitations to restyle.

Page-level opacity entrances stay disabled: never restore the navigation flash. Reduced-motion rules remain intact.

## Shapes

Square corners and the original black ruled headers, two-pixel reading frames and framed home buttons. No replacement rounded-card system.

## Components

- Home and book choices use the original monochrome button treatment.
- Inline word meanings split the passage in place and use a neutral grey panel.
- Highlights persist in the selected colour; single tap toggles meanings, and Undo retains encounter history. Test renders plain text without highlights or meaning controls.
- Meanings reuse the existing Cloze 360ms grid/hinge fold in place. Reduced-motion removes the transition, and no page entrance is added.
- Named vocabulary books include the book name and unit in visible headings, including active practice/card/test screens. HSE package labels stay unchanged.
- The requested once-only bilingual release notice reuses the existing focus-managed dialog. Its content is also available in a native details section in Settings; no new modal framework.
- Tutorial, next-exercise actions, book/unit persistence and Android banner suppression remain unchanged.
- Guided learning identifies the list and step, introduces audio and self-confirmed repetition, then provides four interleaved retrieval rounds. Use the existing feedback surfaces; completion is not a claim of permanent mastery.
- Spelling practice shows a five-word checkpoint. Vocabulary Test offers MCQ, spelling or mixed across the selected list; answers stay unmarked until submission. A one-word list disables formats that need distractors and explains why.
- Recovery notes use the existing error tint and `role="alert"`. A failed guided save offers **Retry saving progress** while keeping the current step in memory; unreadable plans offer **Retry opening plan** without overwriting stored data. Do not show a saved/completed state when saving has failed.
- Only passage-supported MCQ and selectable True / False / Not Given questions are graded. Diagram-dependent and ambiguous questions remain in the editorial audit, not on the student page.
- Global focus uses an ink outline with offset; spelling fields and chart viewports use their existing two-pixel focus variant. State changes also use text and disabled/pressed semantics, not colour alone.
- The 1.10.2 notice and permanent bilingual Settings log describe the published reading keys and learning functions. Missing example sentences/translations remain identified honestly. The full Android release uses the existing student package and signing key; the earlier preview remains separate. Android suppresses the iOS Home Screen reminder.
- The company leaf assets under `icons/` are preexisting supplied assets, not newly generated images. Keep their original pixels; the small home-link affordance remains functional.

## Do's and Don'ts

- Do inherit the original palette and fonts through `app.css`; load functional `reader.css` additions after it.
- Do preserve keyboard focus, tablet layout, readable passages and all v1.10 functions.
- Don't reintroduce coloured learning-area fills or native-sans UI typography.
- Don't undo content/audio corrections, student data, navigation changes or the no-flash fix when restoring appearance.
- Don't confuse browser viewport checks with physical iOS/Android verification, or a documented component with a published content audit.
