# The Vocab Drill — student web app (PWA)

The iPhone/iPad half of the student app. Same word lists, same three modes and
the same black-and-white paper as the Android APK, delivered as a website that
installs from Safari instead of an app store.

**Why this exists:** the App Store's China storefront requires an ICP filing
number, which requires a Chinese business licence. A PWA sidesteps that
entirely — Add to Home Screen, full-screen, offline after first load, updated by
republishing. No store, no review, no $99, no filing.

Android students keep using the native APK; this is a second client, not a
replacement.

## What's in it

**Cards** — swipe right for known, left for unknown, tap to flip. The ✗ / Flip /
✓ buttons do the same thing for anyone who dislikes swiping.
**Study** — the whole list, searchable, tap a word to hear it, `+` opens the
example sentence with the word bolded plus synonym/antonym.
**Learn** — MCQ in rounds of five with a checkpoint after each. Three question
shapes, distractors drawn from the same unit preferring the same part of speech.
Wrong answers come back at the end and keep coming back until they're right; the
saved score is the first-attempt percentage.
**Cloze tests** — 306 complete Beijing exam passages across Grades 7–9. Study
mode gives immediate feedback; Test mode draws a non-repeating passage from the
chosen grade and hides all results until submission. Each blank unfolds its
choices inside the article, and scores plus perfect runs are saved on-device.

## Layout

```
index.html            iOS meta block, app root, the one <audio> element
app.css               the whole design system
js/data.js            word lists; port of VocabRepository.kt
js/store.js           progress; port of Progress.kt + ProgressStore.kt
js/learn-engine.js    MCQ construction; literal port of LearnEngine.kt
js/cloze-data.js      lazy cloze corpus loader and grade pools
js/cloze-store.js     cloze history, sessions, and balanced random draws
js/audio.js           pronunciation; port of Speaker.kt
js/ui.js              the component vocabulary from Components.kt
js/screens/*.js       one file per screen
sw.js                 app shell cache only — audio is handled by the page
cloze.json            306 de-duplicated, answer-keyed cloze passages
vocab.json            copied from the Android app's assets
audio-index.json      the 4,321 slugs that have a clip
audio/*.m4a           4,321 clips, 24 MB
tools/transcode_audio.sh
```

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
- **Progress is per device and per install.** Deleting the icon or clearing
  Safari data destroys it. `toJSON`/`fromJSON` exist in `store.js`; the
  export/import UI is not built yet.
- **Audio needs network on first use** of each unit (median 106 KB), unless the
  student uses "Download all pronunciation" on the library screen first.
