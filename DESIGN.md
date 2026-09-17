---
name: Inspired English
description: The implemented v1.10 learner interface, extending Inspire's leaf identity and reading paper.
colors:
  accent: "#176447"
  blue: "#245d8c"
  amber: "#835600"
  highlight: "#ffe57a"
  highlight-ink: "#243321"
  ink: "#183329"
  paper: "#fff"
  hover: "#e2eee8"
  rule: "#8ba499"
  shade: "#f0f5f2"
  rt: "#e9f5ec"
  rt-edge: "#1c7a3e"
  wr: "#fdeceb"
  wr-edge: "#b3261e"
  glass: "rgba(255, 255, 255, .78)"
  vocabulary-bg: "#e4f2e9"
  vocabulary-ink: "#175035"
  reading-bg: "#e8f1fa"
  reading-ink: "#204e78"
  middle-bg: "#fff1d6"
  middle-ink: "#684900"
  high-bg: "#edeefa"
  high-ink: "#444b80"
  memory-bg: "#f4eaf0"
  memory-ink: "#773651"
typography:
  headline:
    fontFamily: "Georgia, 'Times New Roman', 'Songti SC', 'Songti TC', 'PingFang SC', serif"
    fontSize: "27px"
    fontWeight: 900
    lineHeight: "29px"
    letterSpacing: "1px"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Georgia, 'Times New Roman', 'Songti SC', 'Songti TC', 'PingFang SC', serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
  passage:
    fontFamily: "Georgia, 'Times New Roman', 'Songti SC', 'Songti TC', 'PingFang SC', serif"
    fontSize: "18px"
    fontWeight: 400
    lineHeight: 1.72
  passage-phone:
    fontFamily: "Georgia, 'Times New Roman', 'Songti SC', 'Songti TC', 'PingFang SC', serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.68
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "1.5px"
  area-title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "2.5px"
  definition:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  chinese:
    fontFamily: "'TT SongTi', 'Songti SC', 'Songti TC', 'STSong', 'Noto Serif CJK SC', 'Songti', serif"
    fontWeight: 700
    letterSpacing: "normal"
rounded:
  square: "0px"
spacing:
  stack-sm: "6px"
  stack: "10px"
  section: "12px"
  home-gap: "13px"
  pad: "14px"
  book-gap: "16px"
  section-lg: "18px"
  area-pad: "20px"
  book-pad: "24px"
  tablet-pad: "26px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "10px 15px"
  button-ruled:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.square}"
    padding: "10px 15px"
  button-thin-small:
    backgroundColor: "{colors.glass}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "8px 11px"
  home-vocabulary:
    backgroundColor: "{colors.vocabulary-bg}"
    textColor: "{colors.vocabulary-ink}"
    typography: "{typography.area-title}"
    rounded: "{rounded.square}"
    padding: "20px"
    width: "100%"
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
    width: "100%"
  inline-definition:
    backgroundColor: "{colors.shade}"
    textColor: "{colors.ink}"
    typography: "{typography.definition}"
    rounded: "{rounded.square}"
    padding: "18px"
---

# Design System: Inspired English

## Overview

**Creative North Star: "Leaf and reading paper"**

The learner app extends the existing Inspire company leaf identity with evergreen ink, lightly coloured learning choices and plain reading paper. Serif passages retain the feel of printed study material; native interface text keeps navigation distinct from the material being learned.

This records the implemented v1.10 system in `app.css`, followed by the overrides in `reader.css`, and the shared components in `js/ui.js`. [README](README.md) and [PROJECT INDEX](PROJECT%20INDEX.md) remain product truth; the [release plan](../Release%201.10%20Plan.md) carries this release's surface direction. Values below describe the finished implementation, not a replacement brand.

**Key Characteristics:**

- White reading paper, evergreen structure and restrained area colours.
- Square corners, precise rules and compact interface labels.
- Serif reading, native sans interface text and local Chinese serif fallbacks.
- Inline meanings and persistent yellow word highlights.

## Colors

The palette separates the quiet paper surface from navigation, selected vocabulary and answer feedback. The frontmatter is the normative light-theme palette; `app.css` supplies the existing dark-theme overrides.

### Primary

- **Evergreen** (`accent`) marks the outer header rule, definition headings and tutorial progress.
- **Reading blue** (`blue`) identifies book and unit headings and the default keyboard focus ring.
- **Study amber** (`amber`) is the shared amber accent; the middle-school home choice uses its own matching background/ink pair.
- **Marker yellow** (`highlight`) with `highlight-ink` marks saved passage words.

### Secondary

- The vocabulary, reading, middle, high and memory background/ink pairs distinguish the five home choices. These are navigation colours, not answer correctness signals.
- `rt`/`rt-edge` and `wr`/`wr-edge` carry known/correct and unknown/incorrect feedback, with accompanying text or state.

### Neutral

- `paper` and `ink` provide the reading canvas and text; `rule` separates paragraphs, cards and fields.
- `shade` supports inline definitions and book choices; `hover` is an existing interaction tint. `glass` provides the shared translucent control surface.

**The Paper Rule.** Reading prose stays on the paper surface; area colours belong to navigation and highlights belong to selected words.

Dark mode changes paper, ink, structural colours and feedback pairs through custom properties. Home choices become the shared shade and ink colours; they do not retain the five light-theme fills. The leaf asset is unchanged.

## Typography

The headline, body and passage roles use the local Georgia/Times/Songti stack. Interface roles use the native sans stack, despite its historical CSS variable name `--mono`. No fonts are downloaded. Chinese spans use the separate bold Songti fallback stack and remove Latin uppercase/tracking treatment.

The token roles distinguish the paper headline, blue unit title, compact action label, wide-tracked area title and longer passage text. The paper headline becomes smaller on the narrowest screens (23px/26px at 360px and below). Passage text uses `passage-phone` at 520px and below. Book choices use larger native titles (26px), and inline meaning headings and translations increase to 22px and 20px respectively. Search fields use 16px text to avoid iOS focus zoom.

**The Two Voices Rule.** Keep serif learning content and native sans navigation distinct; preserve the Chinese serif fallback where the component supplies it.

## Layout

The app is centred in a single shell with safe-area padding. The default maximum shell width is 720px with the `pad` inset. At 760px and wider, the final stylesheet sets a 960px shell with `tablet-pad`; this overrides the older 940px/1060px shell declarations in `app.css`.

Home choices form one column on phones. At 760px they form two columns, with vocabulary spanning both. Book choices also form two columns at that breakpoint. Existing library, unit and Study master/detail layouts start at 768px; focused screens retain a 640px maximum column. Passage paper is limited to 75ch and uses responsive inner padding (`clamp(18px, 5vw, 34px)`).

The spacing tokens capture recurring gaps and padding rather than imposing a new mathematical scale. Passage tools and definition headings wrap; the definition panel appears inside the paragraph flow, followed by the remaining text.

## Elevation & Depth

The reviewed reading and home surfaces use borders and pale fills for separation. Their resting buttons, area choices, options and navigation rows have no box shadow. The paper header has a strong evergreen outer border (3px), an inset ink rule (1px) and an ink divider (2px). Passage paper and inline meanings use quieter rules (1px).

**The Ruled Surface Rule.** Carry hierarchy with border weight and tonal fill; do not add shadow elevation to the documented reading and home components.

Some older exercise controls retain separate feedback animations and hover styles in `app.css`; these are legacy implementation details, not a shadow vocabulary for new surfaces. The sidecar records only the shared flat resting treatment.

## Shapes

All elements have square corners, enforced by the global zero-radius rule. Buttons, tags, reading paper and meaning panels share this rectangular silhouette. Keep native text and control wrapping rather than clipping a label to preserve a rigid width.

## Components

### Buttons

Ruled and thin buttons use translucent paper, ink labels and square corners. The selected/pressed solid-ink variant is the primary emphasis treatment. Standard, small and large buttons have distinct padding and label sizes; use the existing shared helpers. Pointer press adds a subtle scale (0.99), and release introduces no bounce. Disabled controls lower opacity (0.3).

Default keyboard focus uses a blue outline (3px) offset from the control (3px). Existing solid-ink selected/pressed controls use a paper-coloured outline. Touch-oriented topbar/dialog controls have a minimum height of 44px; the home choices have a minimum height of 68px.

### Tags

Tags are small rectangular labels with an ink border (1px), not rounded pills. Ordinary tags use compact uppercase text (10px); part-of-speech tags have their own larger English and Chinese variants.

### Cards / Containers

Learning-area choices use the dedicated background/ink pairs and a thin border. Book choices use shade, blue text and larger padding. The paper header keeps the supplied company mark next to the title; the reusable header does not render its old kicker or right-side version parameter.

### Inputs / Fields

Search combines an ink label block and a flexible 16px field inside a strong ink rule (2px). Keep the field shrinkable within the row and preserve the visible focus outline. Carets use evergreen.

### Navigation

Settings sits at the left of the home screen. Other screens use the existing topbar and linked leaf mark to return home. Library rows span the available width, align text to the left and use a shade fill while pressed. Reading rows group beneath blue unit headings and have a minimum height of 76px.

### Passage meanings

Dotted underlines identify available meanings. Double-tap an unmarked term, or activate it with the keyboard, to highlight it and open its definition. A highlighted term reopens on a single tap. The meaning panel follows the selected term within the paragraph flow, uses the shade fill and horizontal rules, and includes Listen and Close meaning actions. Undo highlight remains visible above the passage and is disabled when there are no highlights.

### Assets and motion

The shipping `icons/icon-180-inspire.png` and `icons/icon-192-inspire.png` are supplied, preexisting company leaf assets. The shared leaf component uses the latter; no imagery was generated for this release's design work. Preserve their provenance and proportions.

Routes and primary choices appear immediately: the former entrance animation is disabled. Shared press transitions are brief; existing answer feedback and completion effects remain contextual. Reduced-motion rules suppress the existing feedback, flourish and lesson-breathing animations.

## Do's and Don'ts

### Do:

- **Do** use the existing paper and leaf identity and the supplied company assets.
- **Do** load `reader.css` after `app.css` and check the final cascade before copying a value.
- **Do** keep meanings inline, preserve the passage continuation and expose Undo highlight.
- **Do** preserve keyboard focus, safe-area padding, readable input sizes and reduced-motion behavior.

### Don't:

- **Don't** introduce rounded cards or replace the company mark with new artwork.
- **Don't** turn home area colours into correctness signals or colour entire reading passages.
- **Don't** restore page entrance flashes or add downloaded fonts to this local-font system.
- **Don't** promote legacy glyph icons, unused kickers or leftover hover shadows into new component rules.
