# Vocab Drill — project instructions

Put this file at:
`/Users/pshen2p/Documents/Obsidian Notes/Teaching Vault/Vocab Drill Web/CLAUDE.md`
and start Claude Code from that directory. It is auto-loaded as project context.

---

## 1. What this is and who it's for

Peter is an ESL teacher in Beijing. He has ~20–60 students across group classes
and one-to-one lessons. He maintains a 6,978-entry English/Chinese vocabulary
corpus and wants students practising it on their own phones at home.

There are **three separate programs** in this vault. Know which is which:

| Program | Path | Role |
|---|---|---|
| **Vocab Drill Board** | `../Vocab Drill Board/` | Teacher's in-class tool, macOS app + browser. **DO NOT MODIFY.** It is live and used every lesson. |
| **Vocab Drill Student App** | `../Vocab Drill Student App/` | Android client, Kotlin + Compose. **Shipped to students at v1.01.** Read-only reference for this work. |
| **Vocab Drill Web** | `.` (this folder) | The PWA. iPhone/iPad client. **Currently at v1.00, English only. This is what you are building.** |

### The job

**Bring the PWA from v1.00 to v1.01 feature parity with the Android app.**

Peter shipped Android v1.01 to students today and is waiting on feedback. He
now wants the iOS side brought up to the same version. Every v1.01 change is
specified in section 6 and already implemented in Kotlin — your job is a
faithful port, not a redesign.

### Why a PWA and not an App Store app

The Apple App Store's China storefront requires an **App ICP Filing Number**,
which requires a Chinese business licence Peter does not have. His students have
Chinese Apple IDs so "publish everywhere except China" does not reach them.
Google Play is blocked in mainland China entirely. A PWA installs from Safari
via Add to Home Screen with no store, no review, no $99/yr and no filing.

Do not suggest the App Store, TestFlight or Capacitor. This was researched at
length and the routes are closed.

---

## 2. Current state

**Android (reference, do not edit):** v1.01, versionCode 2, signed and
distributed via WeChat sideload. Compiles clean. **Has never been run on a
physical phone** — Peter is testing now.

**PWA (your target):** v1.00, English only, three modes (Cards, Study, Learn).
Written, smoke-tested in headless Chromium at iPhone viewport with zero JS
errors. **Never run on a real iPhone. Deployment to Netlify was prepared but
not confirmed completed.** Check whether it is live before assuming.

### PWA file layout

```
index.html              iOS meta block, app root, the single <audio> element
app.css                 the whole design system
js/main.js              boot, hash router (#/, #/u/<id>, #/u/<id>/cards)
js/data.js              word lists; port of VocabRepository.kt; slug()
js/store.js             progress; port of Progress.kt + ProgressStore.kt
js/learn-engine.js      MCQ construction; literal port of LearnEngine.kt
js/audio.js             pronunciation; port of Speaker.kt
js/ui.js                h(), press(), the components from Components.kt
js/screens/{library,unit,study,cards,learn}.js
sw.js                   app shell cache ONLY — never touches audio
manifest.webmanifest
vocab.json              758,628 bytes — copied from the Android assets
audio-index.json        the 4,321 slugs that have a clip
audio/*.m4a             4,321 clips, 24 MB, AAC-LC in MP4
icons/                  180 / 192 / 512 / 512-maskable, all OPAQUE
_headers, netlify.toml, robots.txt
tools/transcode_audio.sh
README.md
```

### Android files you will port from

```
../Vocab Drill Student App/app/src/main/java/com/vocabdrill/student/
  i18n/Strings.kt          158 keys, EN + ZH   ** the big one **
  data/Profile.kt          profile model + store
  data/Progress.kt         TestRun, UnitStat, PASS_PCT
  data/ProgressStore.kt    recordTestAnswer, finishTest
  data/VocabRepository.kt  TYPE_ORDER / GROUP_ORDER
  ui/Theme.kt              the light and dark palettes
  ui/OnboardingScreen.kt
  ui/SettingsScreen.kt
  ui/TestScreen.kt         the new mode
  ui/UnitScreen.kt         mode order, test history, most-missed panel
  ui/LibraryScreen.kt      dropdowns, header
  ui/FlashcardsScreen.kt   card faces + reversed direction
```

### The data

127 units · 6,978 entries · 4,322 unique words · 4,321 audio slugs (one benign
collision: "Shall we" / "Shall we...?"). 48 entries have no example sentence —
`LearnEngine` already guards for this. No unit has fewer than 4 words, so MCQ
distractors never starve. Zero duplicate `word|pos` inside any unit.

`vocab.json` shape:
```json
{ "types":[{"type","groupLabel","groups":[{"name","units":[{"id","label"}]}]}],
  "data": { "<unitId>": [ {"w","p","c","e","s","a"} ] } }
```
`w`=word `p`=part of speech `c`=Chinese `e`=example `s`=synonym `a`=antonym

---

## 3. Three contracts that must not drift

The Android and web clients share these. A mismatch is a **silent** bug — no
crash, just wrong data.

**1. Progress key.** `js/store.js` must produce byte-identical keys to
`Progress.wordKey` + `Entry.key`:

```js
`${unitId}|${e.w.trim().toLowerCase()}|${(e.p||'').trim().toLowerCase()}`
```

Use `toLowerCase()`, **never** `toLocaleLowerCase()` — Kotlin's `lowercase()` is
locale-invariant and a Turkish-locale device would fork every key containing an
I. Keyed by the **word**, never by index in the list: index-keying silently
re-points a student's whole history when a list is regenerated in a different
order, which is a documented failure in this project's past.

**2. Audio slug.** Must match `Speaker.slug()` and `tools/generate_audio.py`:

```js
w.trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'x'
```

Verified to agree including on accented input (`Café` → `caf`).

**3. MCQ construction.** `js/learn-engine.js` is a literal port of
`LearnEngine.kt`: three question types, distractors from the **same unit**
preferring the **same part of speech**, lowercased dedup, `" ______ "` gap
constant. **These rules are the pedagogy, not an implementation detail.** Do
not "improve" them.

---

## 4. iOS constraints — read before writing any code

These were expensive to find. Each one has a specific mitigation already in the
v1.00 code. Do not simplify them away.

**Audio must never be fetched by the `<audio>` element.** Safari opens media
with `Range: bytes=0-1`; a service worker answering that from Cache Storage
stalls or fails silently. The flow is `fetch()` (no Range header) →
`cache.put()` → `URL.createObjectURL(blob)` → `el.src`. Consequence: **the
service worker has no responsibility for audio at all**, and `sw.js` explicitly
skips any path containing `/audio/`.

**Force the blob MIME type to `audio/mp4`.** Some hosts label `.m4a` as
`audio/mp4a-latm` (a different, LATM-framed format) and Safari refuses a blob
typed that way.

**One `<audio>` element for the app's whole life**, unlocked once inside a real
user gesture with a silent WAV data URI. iOS unlocks the *element*, not the call
site, so every later `play()` works even after an `await`. Re-arm the unlock on
`visibilitychange → visible` — an audio-session interruption drops it.

**`speechSynthesis` needs a LIVE gesture and an `await` spends it.** The
has-a-clip decision is therefore made **synchronously** from an in-memory `Set`
before any async work. Clip coverage is 100%, so this path is a genuine last
resort.

**Storage: two separate buckets.** iOS caps script-writable storage at 7 days of
non-interaction for Safari **tabs**; installed home-screen apps are exempt. And
a tab and an installed app have **different storage**, so anything practised
before installing is invisible after. The app shows a permanent, non-dismissible
red banner until installed. There is no `beforeinstallprompt` on iOS — that
hand-written sheet is the only install affordance available.

**Edge-swipe-back fights the card deck.** A drag starting within ~20px of the
left edge is claimed by iOS and `preventDefault` does not reliably stop it.
Mitigations already in place: cards inset ≥20px, transparent 24px `.edge-guard`
strips in Cards mode only, deck state persisted to `sessionStorage` so an
escaped back-swipe costs nothing, and the ✗/Flip/✓ buttons as the real interface
with swipe as the flourish.

**`:active` does not fire on iOS.** The entire invert-on-press button language is
driven from `pointerdown`/`pointerup`/`pointercancel` via `.is-pressed`.

**The card flip renders front OR back, never both.** `backface-visibility`
combined with a nested scrollable element is a known WebKit trouble spot; faces
swap at the 160ms animation midpoint.

**The Cards screen must not use `100dvh`.** It does not own the viewport — the
install warning sits above it, and `100dvh` pushed the controls off-screen. It
uses a fixed-height deck block in normal flow. This bug was found and fixed
once; do not reintroduce it.

**Inputs must be ≥16px** or Safari zooms the page on focus. Do not reach for
`user-scalable=no`.

**`<meta name="color-scheme" content="light">` is required** or Dark Mode
inverts the paper. Note this interacts with the new invert-colours setting —
see section 6.7.

**iPad and landscape.** The manifest's `orientation` is ignored on iOS. Layout
is fluid with `max-width: 720px`. Android is portrait-locked and never had to
handle this.

**Icons must be opaque.** A transparent `apple-touch-icon` renders solid black
on the home screen, which for a black-and-white identity is invisible until
someone complains.

---

## 5. Design system

Brutalist black-and-white exam paper, shared with the desktop board and Peter's
printed homework. It is deliberate and non-negotiable.

- Serif for content, monospace in wide uppercase for every label
- Hard 2px rules, **no rounded corners, no shadows**
- No colour except the two marking tints
- Buttons invert to solid black while pressed
- No embedded fonts. Serif stack **must** carry a CJK face — iOS has neither
  Noto Serif nor Noto Serif CJK:
  `Georgia,'Times New Roman','Songti SC','PingFang SC',serif`

Light: ink `#000` · paper `#fff` · hover `#e8e8e8` · rule `#999` · shade `#eee`
· right `#e9f5ec`/`#1c7a3e` · wrong `#fdeceb`/`#b3261e`

Compose `sp`/`dp` map 1:1 to CSS px, so values port directly from the Kotlin.

---

## 6. The v1.01 changes to port

All eleven are implemented in Kotlin. Read the Android source for exact
behaviour; this section records the **decisions and the reasoning**, which the
code does not carry.

### 6.1 Header
Unit/word totals removed. The left foot now shows `Hello, <name>` instead —
leaving it empty stranded the version number on a ruled bar and looked broken.

### 6.2 Onboarding
One-time screen collecting **name and language**. Stored in a **separate**
`profile` store from progress, deliberately: resetting a unit's records must
never cost a student their name. The language buttons are labelled in their own
language ("English" / "中文") so a student who cannot read the current one can
still find theirs, and the screen re-translates live as they tap.

Name is capped at 24 characters, must be non-blank, and must accept Chinese
characters.

### 6.3 Dropdowns and ordering
Horizontal tab strips replaced with dropdowns — seven books do not fit on a
phone. Display order is imposed **in the client**, not by editing the drill
board's `BUNDLE`, so Peter's live in-class tool is untouched:

```
TYPE_ORDER  = ["Book Units", "HSE Packages"]
GROUP_ORDER = ["Prepare Level 1","Prepare Level 2","Prepare Level 3",
               "Prepare Level 4","Unlock 3","Unlock 4","Openworld FCE"]
```
Anything unlisted sorts to the end in original order.

Note **Unlock 4 contains exactly one unit** (`U4-U4P1`). It looks broken in a
dropdown. Flagged to Peter; left as-is for now.

### 6.4 Bilingual UI
English + Simplified Chinese, chosen at onboarding, changeable in Settings.
**158 keys** in `i18n/Strings.kt`. Port that table to `js/i18n.js` verbatim.

An in-app table overriding device locale, **not** browser locale detection —
Peter wants the student's explicit choice to win.

Port the `missingTranslations()` boot check too: it logs any key present in
English but absent in Chinese, so a half-translated build cannot quietly reach a
class.

**Peter has not yet proofed the Chinese.** It is correct Mandarin but he may
change terminology to match what he says in class. Do not treat the current
strings as final; keep them in one file that is easy to edit.

### 6.5 Modes: Study → Practice → Cards → Test

"Learn" is renamed **Practice / 练习**. Test is new.

**Test mode** (`ui/TestScreen.kt`) — summative, deliberately unlike Practice:

- Student **picks the length: 10 / 20 / all**. Only offer lengths the unit can
  fill. Length is recorded in history because a 10-question 80% and a
  60-question 80% are not the same achievement.
- MCQ, **no feedback of any kind** until they press Complete. The selected
  option is shown as selected, never as right or wrong.
- They can move back and forward and change answers before submitting.
- Complete with unanswered questions → confirm dialog; unanswered count as wrong.
- **PASS_PCT = 80.**
- Result: big percentage (green if passed, red if failed), raw score under it,
  then a message with the student's name. Then the wrong-word list, a
  "retest the N I got wrong" button, "take the test again", and Done.
- History on the unit page: attempt number, date, score, length, pass/fail,
  and a `retest` flag so retests are distinguishable from fresh attempts.

**Test scoring rule — Peter's explicit decision.** `recordTestAnswer` **never
promotes** a word to known (a lucky exam guess is not evidence of learning) but
a **wrong answer does demote** it back to the to-learn pile. This differs from
Practice, which does both. Do not unify them.

**The fail message is Peter's own wording** and ships as he wrote it:
`"You failed %s, try harder next time!"`. I advised against attributing failure
to effort; he decided otherwise. It lives in the string table as
`test.failedMsg` so he can change it without a rebuild. **Do not re-litigate
this.**

### 6.6 English names in the Chinese UI
Book and unit names are the publishers' English titles and **stay English in
both interfaces**. Never translate values coming out of `vocab.json`.

### 6.7 Invert colours
A Settings toggle. **Not a naive inversion** — `#e9f5ec` is a near-white green
that reads as a grey smear on black. Dark mode has its own palette:

```
ink #FFFFFF · paper #000000 · hover #2A2A2A · rule #666666 · shade #1A1A1A
right #10301C / #4ADE80        wrong #3A1412 / #FF7A70
```

On Android this works by making the palette Compose snapshot state, so flipping
it recomposes everything with zero call-site changes. **On the web, do this with
CSS custom properties on `:root`** — flip a `data-theme` attribute on `<html>`
and redefine the tokens. Every colour in `app.css` already goes through a
variable, so this should be a small change.

Watch the interaction with `<meta name="color-scheme" content="light">` and with
the `theme-color` meta and status-bar handling.

### 6.8 Change name in Settings
Trivial once 6.2 exists.

### 6.9 App name
In-app title: **Inspired English Vocab App** / **因思博睿英语学习**.

The English title is 25 characters in a 27px black uppercase serif and will wrap
to three lines. Handle it — shrink to fit or allow two lines gracefully. The
Chinese is 8 characters and fits fine.

On Android the launcher label is the shorter **"Inspired Vocab"** because
Android truncates around 12 characters under an icon. For the PWA, set the
manifest `short_name` similarly and keep the full name in `name`.

### 6.10 Card back layout
The Chinese is the **answer**, so it gets the centre of the card at large size
as a direct counterpart to the English on the front — not a caption. The English
word shrinks to a dimmed header line with the POS tag and the speak button. The
example sentence moves to the **foot** of the card, below a rule.

### 6.11 Reversed cards (Settings toggle)
Front shows **Chinese + POS**, back shows the **English word**. No sentence on
the front. Recognition vs production — the harder direction, and the one most
students avoid.

### 6.12 Added without being asked — keep it
A **"words you keep missing"** panel on the unit page: words where
`wrong >= 2 && wrong > right`, sorted by wrong count, top 12. Built entirely
from per-word counters the app already collected and never displayed. This is
the thing Quizlet structurally cannot do for Peter's specific students, and it
is the app's real differentiator.

---

## 7. Deployment

Static files, no build step, no npm. **Netlify free tier from a private GitHub
repo** — chosen over GitHub Pages because free Pages requires a *public* repo
and the corpus is Peter's work.

```bash
npx netlify-cli deploy --prod --dir .
```
or drag the folder onto https://app.netlify.com/drop.

Reachability measured from Peter's actual connection in China:
netlify.app **1.3s** · github.io 0.5s · vercel.app 2.1s ·
**Cloudflare pages.dev unreachable** · gitee.io dead.

`_headers` and `netlify.toml` pin `audio/mp4` for `.m4a` and mark clips
immutable for a year. `robots.txt` plus a `noindex` header keep the URL out of
search. **The deployed site is public** — protection is an unlisted random
subdomain. Peter accepted this for a class of 20–60.

After changing shell files, **bump `SHELL` in `sw.js`** (`vd-shell-v1` → `v2`).
Forgetting costs one stale launch, not a bricked cohort: navigation is
network-first with a 3s timeout and assets are stale-while-revalidate.

**Never version the audio cache with the shell.** `vd-audio-v1` must survive a
code update or students re-download 24 MB.

---

## 8. Telling students how to install

The order matters and is not optional:

1. Open the link **in Safari** — not from inside WeChat. **WeChat's in-app
   browser has no Add to Home Screen.**
2. Share → **Add to Home Screen**.
3. Open it from the icon from then on.

Never "try it first, then install" — the two storage buckets mean everything
practised in the tab is lost.

---

## 9. What is deliberately NOT built

**No accounts, no gating, no teacher-side usage tracking.** All three need a
server students in mainland China can reach, which is the ICP wall again. Peter
asked for them, understood the constraint, and dropped them. Do not build them
without him raising it again.

Progress export/import hooks exist in `store.js` (`toJSON`/`fromJSON`) with no
UI. That is the cheapest future path to giving Peter any visibility — a code the
student sends over WeChat — and is the sensible next feature after v1.01.

There is also **no vocabulary editor**. Peter wants one. It is blocked on a
larger refactor: the corpus's source of truth is a hand-maintained 716 KB JSON
literal on line 576 of `../Vocab Drill Board/index.html`, with no generator.
That work is out of scope here.

---

## 10. Verification

There is no test suite. Verify like this:

- Boot assert: every word's slug resolves in `audio-index.json` (expect 4,321).
- Generate a progress key in the browser and compare against `Progress.wordKey`
  for the same entry — must be byte-identical.
- Headless Chromium at 390×844 with `hasTouch` and `isMobile`, walking all
  screens, collecting `pageerror` and non-audio failed requests. v1.00 shipped
  with zero. This caught two real layout bugs before any device saw them.
- **Then a physical iPhone and iPad, installed to the home screen, in aeroplane
  mode.** Roughly half the constraints in section 4 only manifest there: the
  audio gesture unlock, the edge-swipe collision, safe areas, `:active`, input
  zoom. The simulator and desktop responsive mode will all lie to you about at
  least one.

---

## 11. Suggested opening prompt for Claude Code

> Read CLAUDE.md. I want to bring this PWA from v1.00 to v1.01, matching the
> Android app in `../Vocab Drill Student App/`. Start by reading the Android
> source files listed in section 2, then give me a build order before writing
> code. Port `i18n/Strings.kt` first — everything else depends on it.

---

## 12. House rules for working with Peter

- Lead with the hard truth, then the specific steps. He asks for blunt.
- Flag uncertainty explicitly. Never present a guess as a fact.
- Ask rather than assume — but if he has already decided something, do not
  re-argue it.
- Simplest solution first. No unrequested abstractions.
- Do not touch code outside the current task, and **never** touch
  `../Vocab Drill Board/`.
