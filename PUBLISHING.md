# Publishing vocabulary updates (v1.03)

This guide is for **Peter**. No coding required for a normal vocabulary update.

---

## Two kinds of update — know the difference

- **App-code update** — you change the app itself (`js/`, `app.css`, `index.html`,
  `sw.js`). Students get it because the service worker fetches the new code and
  shows a "New version ready — tap to reload" bar. This is rare.
- **Vocabulary-content update** — you change the **words** (`vocab.json`) and/or
  the **audio index** (`audio-index.json`). This is the common case and the whole
  point of v1.03. Students get the new words **automatically on their next
  launch**, with no reload bar and no reinstall.

You edit the same two source files you always have:

```
vocab.json          <- the word lists (edit this)
audio-index.json    <- which words have a recorded clip (edit this)
```

Publishing turns them into a **frozen, versioned release** under `content/`, which
is what the installed app actually downloads.

---

## Normal publishing workflow

1. **Edit** `vocab.json` (and `audio-index.json` if audio changed).
2. **Check it first (nothing is written):**
   ```bash
   python3 tools/publish_content.py --version 2026-08-22-02 --dry-run
   ```
   Read the warnings, especially any line starting with `PROGRESS:`.
3. **Publish** (pick a new version id — the date plus a run number works well):
   ```bash
   python3 tools/publish_content.py --version 2026-08-22-02
   ```
   This creates:
   ```
   content/vocab-2026-08-22-02.json
   content/audio-index-2026-08-22-02.json
   content/manifest.json          <- rewritten to point at the new files
   ```
4. **Commit and push** to GitHub:
   ```bash
   git add content/ vocab.json audio-index.json
   git commit -m "Vocabulary update 2026-08-22-02"
   git push
   ```
5. Netlify sees the push and **deploys automatically** in a minute or two.
6. Students receive the new vocabulary the next time they open the app.

The version id must be new each time (letters, digits, `.`, `-`, `_`). The tool
**refuses to overwrite** an existing version unless you pass `--force`.

---

## Changing audio (`audioVersion`)

Audio files are cached on students' phones for a year, keyed by their URL. If you
**replace** an existing recording (same filename, new sound), that cached copy
would otherwise stick around. To force phones to re-fetch audio, bump the audio
version:

```bash
python3 tools/publish_content.py --version 2026-08-22-03 --audio-version 2
```

- Change `--audio-version` **only when you replace existing audio files.**
- Do **not** bump it just because a definition or example changed — that would
  make every student re-download all 24 MB for nothing.
- Adding brand-new words with brand-new recordings does **not** require bumping
  it (new filenames are fetched normally).
- New words with **no** recording fall back to the phone's built-in voice.

The tool carries the previous `audioVersion` forward automatically, so if you
don't pass `--audio-version`, it stays the same.

---

## Which changes affect student progress?

Progress is stored per word as:

```
unit id  |  English word (lowercased)  |  part of speech (lowercased)
```

**Safe to change freely** (progress is preserved):
Chinese meaning, example sentence, synonym, antonym, unit label, book/group
names, and the display order of words or units.

**Will detach a student's progress for that word** (the tool warns you with
`PROGRESS:` lines):
- Changing the **English word** spelling.
- Changing the **part of speech**.
- Changing or removing a **unit id**.
- Removing a word.

Progress is never silently migrated or erased — a detached word simply starts
fresh. If a `--dry-run` shows `PROGRESS:` warnings you did not intend, fix the
source before publishing.

---

## How offline fallback works

- The app fetches `content/manifest.json` fresh on every launch. If it points to
  a newer version, the app downloads and validates the new files, then switches
  to them — all before showing the word lists on that same launch.
- If the internet is down or the update fails, the app keeps using the **last
  version it successfully downloaded**. A broken or half-finished update can never
  replace or corrupt a working one.
- If a phone has never once been online with the app, it uses the **built-in**
  `vocab.json` / `audio-index.json` bundled with the app code.
- So: one successful online launch, then it works offline indefinitely on that
  content until the next successful check.

---

## Testing an update before students see it

1. `--dry-run` (above) validates everything and shows warnings without writing.
2. To try it in a browser locally before pushing:
   ```bash
   python3 -m http.server 8000
   ```
   then open `http://localhost:8000` — the app will load `content/manifest.json`
   exactly as students will. Open it, confirm the new words appear and Cards /
   Practice / Test / audio all work.
3. Only then commit and push.

---

## Recovering from a bad publication

If you pushed vocabulary that is wrong:

**Fastest (Netlify rollback):** In the Netlify dashboard → your site → **Deploys**
→ click the previous good deploy → **Publish deploy**. The site instantly serves
the old `manifest.json` again, and students go back to the previous content on
their next launch. Nothing on their phones is damaged in the meantime.

**Proper fix (republish):** Correct `vocab.json`, then publish a **new** version
id and push again:
```bash
python3 tools/publish_content.py --version 2026-08-22-04
git add content/ vocab.json audio-index.json && git commit -m "Fix vocab" && git push
```
Never re-use a version id students may already have downloaded — always go
forward with a new one.
