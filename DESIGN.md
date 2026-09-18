---
name: Inspired English
description: Original monochrome paper and Courier interface, retaining v1.10 functionality.
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
rounded:
  square: "0px"
spacing:
  pad: "14px"
  tablet-pad: "26px"
  home-gap: "13px"
  book-gap: "16px"
components:
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

The user explicitly restored the pre-1.10 colours, aesthetic and UI fonts while retaining all functional updates. The visual source of truth is the shared stylesheet at checkpoint `5edfb9f`, with the flash fix and left-positioned Settings preserved. This supersedes the earlier evergreen/native-sans direction.

White paper, black ink, square ruled controls and Courier-style interface labels frame serif learning content. Existing coloured answer feedback and yellow selected-word highlights have functional meaning; they are not navigation themes.

## Colors

The frontmatter records the original light palette. The existing dark palette remains in `app.css`. Home choices, book/unit navigation and definition headings use the shared monochrome ink, paper and grey surfaces, not the rejected green/blue/amber/pastel palette.

Yellow remains reserved for persistent passage highlights. Correct/incorrect feedback retains its existing green/red colours and text cues. The original multicolour company leaf is unchanged.

## Typography

Interface controls and labels use the original Courier New / system monospace stack. Learning prose and paper titles retain Georgia/Times/Songti; dedicated Chinese spans retain their original local serif fallback. No fonts are downloaded.

Large unit identifiers remain prominent at 22–23px because that is a requested functional improvement. Passage text remains 18px/1.72, reducing to 17px/1.68 on phones. New tutorial and definition controls inherit the restored interface font.

## Layout

Keep the v1.10 book-to-article menus, in-flow definitions, left-positioned home Settings, and responsive phone/tablet layouts. The shell remains 720px, expanding to 960px from 760px; reading measure is capped at 75ch. New layouts do not justify a new colour or font system.

## Elevation & Depth

Restore the original translucent control surfaces, backdrop blur and hard offset button shadows from the checkpoint. Pressed buttons move inward with the original release feedback. These are explicitly requested incumbent aesthetics, not invitations to restyle.

Page-level opacity entrances stay disabled: never restore the navigation flash. Reduced-motion rules remain intact.

## Shapes

Square corners and the original black ruled headers, two-pixel reading frames and framed home buttons. No replacement rounded-card system.

## Components

- Home and book choices use the original monochrome button treatment.
- Inline word meanings split the passage in place and use a neutral grey panel.
- Yellow highlights persist; single tap toggles meanings, and Undo retains encounter history.
- Tutorial, next-exercise actions, book/unit persistence and Android banner suppression remain unchanged.
- The company leaf assets under `icons/` are preexisting supplied assets, not newly generated images. Keep their original pixels; the small home-link affordance remains functional.

## Do's and Don'ts

- Do inherit the original palette and fonts through `app.css`; load functional `reader.css` additions after it.
- Do preserve keyboard focus, tablet layout, readable passages and all v1.10 functions.
- Don't reintroduce coloured learning-area fills or native-sans UI typography.
- Don't undo content/audio corrections, student data, navigation changes or the no-flash fix when restoring appearance.
