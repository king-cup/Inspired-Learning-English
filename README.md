# Inspired English — learner app

Current release: **1.10.2**. See [release notes and known limits](RELEASE-1.10.2.md). Reading comprehension is passage-only: 144 articles and 891 supported keys, without diagrams. The full Android package uses the original application ID and signing key.

This folder is the canonical learner application. iPhone and iPad run it as an
installable PWA; Android v1.10 packages the same audited web release inside the
WebView shell in `../Vocab Drill Student App/`.

**Why this exists:** the App Store's China storefront requires an ICP filing
number, which requires a Chinese business licence. A PWA sidesteps that
entirely — Add to Home Screen, full-screen, offline after first load, updated by
republishing. No store, no review, no $99, no filing.

Start with [[PROJECT INDEX]] for the current architecture and health snapshot.
Planned work is in [[ROADMAP — App Quality, Tutorial and Download Size]], the
curriculum cleanup is in [[CONTENT AUDIT — Reading and Middle School]], and
learner-facing release history is in [[CHANGELOG]].

## What's in it

**Flashcard** — swipe right for known, left for unknown, tap to flip. The ✗ / Flip /
✓ buttons do the same thing for anyone who dislikes swiping.
**Study** — the whole list, searchable, tap a word to hear it, `+` opens the
example sentence with the word bolded plus synonym/antonym.
**Practice** — MCQ in rounds of five with a checkpoint after each. Three question
shapes, distractors drawn from the same unit preferring the same part of speech.
Wrong answers come back at the end and keep coming back until they're right; the
saved score is the first-attempt percentage.
**Advanced Practice** — HSE-only selectable-answer questions from Packages 1–8,
taken from each package's source worksheet. Written-response exercises are excluded.
**Cloze reading** — 608 complete Beijing exam passages across Grades 7–9. Study
mode gives immediate feedback; Test mode draws a non-repeating passage from the
chosen grade and hides all results until submission. Each blank unfolds its
choices inside the article, and scores plus perfect runs are saved on-device.
**Reading Comprehension** — 144 lessons across Foundation and Levels 1–5, with
optional article narration, comprehension exercises, inline vocabulary meanings,
persistent highlights, completion history and next-article navigation.
**Middle School English** — Grades 7–9 organized into MCQ and reading sections.
**Memory Palace** — vocabulary encountered in Reading, with context, review
history and a spaced-review queue. Its product model is under review.

## Layout

```
index.html            iOS meta block, app root, the one <audio> element
app.css               the whole design system
js/data.js            word lists; port of VocabRepository.kt
js/store.js           progress; port of Progress.kt + ProgressStore.kt
js/learn-engine.js    MCQ construction; literal port of LearnEngine.kt
js/cloze-data.js      lazy cloze corpus loader and grade pools
js/cloze-store.js     cloze history, sessions, and balanced random draws
js/curriculum-data.js lazy Reading and Middle School loaders
js/curriculum-store.js Reading progress, vocabulary encounters and Memory Palace
js/audio.js           pronunciation; port of Speaker.kt
js/ui.js              the component vocabulary from Components.kt
js/screens/*.js       one file per screen
sw.js                 app shell cache only — audio is handled by the page
cloze.json            608 de-duplicated, answer-keyed cloze passages
advanced-practice.json HSE worksheet multiple-choice bank
reading-content.json  144 audited Reading lessons
reading-explorer-audit.json Per-article Reading review and quarantine ledger
middle-school.json    Approved Grades 7–9 MCQ and Reading A–E bank
middle-school-future.json Cleaned 阅读表达 and Writing material, not learner-facing
middle-school-cleaning-audit.json Per-record source matching and quarantine ledger
reading-audio-manifest.json Reading narration metadata
vocab.json            copied from the Android app's assets
audio-index.json      the 5,364 slugs that have a clip
audio/*.m4a           5,364 clips, 20.8 MiB
audio/packs/all-vocabulary.pack Single-download vocabulary pack for the PWA
tools/transcode_audio.sh
tools/rebuild_learning_content.py rebuilds the cloze and advanced-practice banks
tools/build_curriculum.py builds Reading and Middle School bundles
tools/clean_middle_school.py source-matches and publishes approved middle-school sections
tools/audit_reading_content.py removes learner-page debris and malformed Reading exercises
tools/validate_curriculum.py validates structure and reading audio integrity
```

> [!warning]
> [!note]
> `curriculum-audit.json` proves structural and audio integrity. Editorial
> publication decisions and quarantined records are tracked separately in
> `middle-school-cleaning-audit.json` and `reading-explorer-audit.json`; see
> [[CONTENT AUDIT — Reading and Middle School]].

## Three contracts shared with the Android app

Break any of these and the failure is silent, not loud.

1. **Progress key** is `unitId|word|pos`, lowercased, produced identically in
   `js/store.js` and `data/Progress.kt`. Keyed by the word, never by position in
   the list — index-keying silently re-points a student's history whenever a
   list is regenerated in a different order.
2. **Audio slug** — lowercase, runs of non-alphanumerics to one `_`, trimmed.
   Must match `Speaker.slug()` and `tools/generate_audio.py`.
3. **MCQ rules** in `learn-engine.js` are a literal port of `LearnEngine.kt`.
   They are the pedagogy; drift is a defect.

## Audio

The Android clips are **Ogg/Opus, which WebKit cannot play at all** — no Ogg
container support, in a tab or on the home screen. `tools/transcode_audio.sh`
converts them to AAC-LC in MP4. The `.ogg` originals stay untouched for the APK.

Re-run it whenever new words are added:

```bash
sh tools/transcode_audio.sh     # ~16 seconds for 4,321 clips
tail -5 /tmp/vd_transcode.log
```

Clips are never fetched by the `<audio>` element directly. Safari opens media
with `Range: bytes=0-1`, which a service worker answering from Cache Storage
mishandles. Instead `js/audio.js` does `fetch()` (no Range header), caches the
response, and hands the element a blob URL. The service worker therefore never
touches audio at all, and the audio cache is **never versioned with the shell** —
a code update must not throw away 24 MB the student already downloaded.

## Deploying

Static files, no build step. Netlify serves them as-is.

```bash
npx netlify-cli deploy --prod --dir .
```

Or drag this folder onto https://app.netlify.com/drop.

`_headers` and `netlify.toml` pin `audio/mp4` for `.m4a` and mark the clips
immutable for a year. `robots.txt` and the `noindex` header keep the URL out of
search results — the corpus is fetchable by anyone with the link, so the link is
the only thing protecting it.

After a change, bump `SHELL` in `sw.js` (`vd-shell-v1` → `v2`) so installed apps
pick it up. Forgetting costs one stale launch, not a bricked cohort: navigation
requests are network-first with a 3-second timeout and assets are
stale-while-revalidate.

## Telling students how to install it

The order matters. iOS keeps **separate storage** for a Safari tab and an
installed home-screen app, so anything practised before installing is invisible
afterwards.

1. Open the link **in Safari** — not from inside WeChat. WeChat's browser has no
   Add to Home Screen.
2. Tap **Share** → **Add to Home Screen**.
3. Open it from the new icon from then on.

The app shows a permanent red banner until it is installed, because a student
practising in a tab loses everything after a week of not opening it and there is
no way to get it back.

## Known limits

- **No accounts, no gating, no teacher-side tracking.** All three need a server
  students in mainland China can reach, which is the ICP wall again.
- **Progress is per device and per install.** Deleting the icon/app or clearing
  its storage destroys it. Settings includes local backup/restore; students must
  make a backup before destructive device changes.
- **Audio needs network on first use** of each unit (median 106 KB), unless the
  student uses "Download all pronunciation" on the library screen first.
- **Android v1.09 is oversized.** The APK bundles all 144 Reading narrations;
  moving those 343.9 MiB of raw assets to optional downloads is planned.
