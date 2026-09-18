# Inspired English 1.10.2 preview checkpoint

Historical checkpoint. Superseded by the later passage-only 1.10.2 release described in [RELEASE-1.10.2.md](RELEASE-1.10.2.md). The old preview limitations and delivery status below describe that checkpoint, not the current build.

Peter explicitly chose **checkpoint push + preview APK** on 19 September 2026. This is not a student release and must not be merged into the production branch as if the remaining audit were complete.

## Delivery boundary

- Checkpoint branch: `checkpoint/v1.10.2-preview-2026-09-19`.
- Production `main` is not updated by this checkpoint.
- Android: `com.vocabdrill.student.preview`, version `1.10.2-preview`, code 12, launcher label **Inspired Preview**. It installs alongside `com.vocabdrill.student`, with separate progress/storage.
- Existing word recordings remain bundled; reading recordings are optional, not inside the APK. Duplicate audio packs are excluded.
- Existing `reading-content.json` is packaged unchanged. The 766-key editorial restoration draft remains outside the shipped assets. Its final prose/evidence gate is still closed.

## Implemented and checked

Guided learning supports class deadlines, one-day and multiday schedules, self-confirmed pronunciation, interleaved retrieval, difficult-word retries and resumable blocks. Spelling practice gives five-word checkpoints; vocabulary tests use the whole selected list with MCQ, spelling or mixed formats. Typed answers update progress. Backup schema 3 includes guided plans, keeps compatibility with older backups and handles synchronous storage failures with rollback. A failed guided save retains the step in memory and offers retry; unreadable plans are not overwritten.

The design notes and component-preview sidecar now describe these implemented states while preserving the user-restored monochrome/Courier design. The preview notice and Settings log explain the unfinished work in English and Chinese.

Local checks:

- `node tools/learning_logic_check.mjs`
- `node tools/storage_recovery_check.mjs`
- `node tools/learning_browser_check.cjs` with Playwright available: 390px English, 834px Chinese and 1440px English; five real Prepare entries in isolated test profiles.
- `node tools/offline_learning_check.cjs`: cold offline tab, new learning modes and local journal export.
- `python3 tools/reading_publication_check.py`: validates the draft and confirms its publication gate. Passing does not publish it.
- `python3 tools/android_preview_check.py /absolute/path/to/preview.apk`: all package asset hashes, word-clip coverage, excluded recordings/packs/secrets, and unchanged production reading data.
- Android `assemblePreview` and `lintPreview`: zero lint errors, 26 warnings. Warnings include existing dependency age, legacy native components, and the WebView JavaScript setting; no dependency upgrades were mixed into this checkpoint.

## Rebuilding the Android preview

`tools/android-preview-source.zip` preserves the small Android source project used for this checkpoint: Gradle configuration/wrapper, Kotlin sources, resources, manifest and asset-sync script. It excludes signing keys/passwords, local SDK paths, generated build output and the old duplicated assets. The web content is this repository, not a second copy in the archive.

Extract the archive into a sibling folder named `Vocab Drill Student App`, next to this checkout named `Vocab Drill Web`. Configure JDK 17 and Android SDK 34 on the build machine. Keep the original signing files private and reuse them locally if a matching signature is needed; they are never in Git.

From the Android project:

```sh
python3 tools/sync_web_release.py
./gradlew -PpreviewVersion=1.10.2 assemblePreview lintPreview
```

APK output: `app/build/outputs/apk/preview/app-preview.apk`. Without the private signing configuration the existing build falls back to a debug certificate, so it will not have the same signature as the delivered preview. Never replace the original keystore to resolve an installation mismatch.

## Not complete / not promised

- Final Reading Explorer prose/evidence review and source-draft publication.
- 118 missing English examples and missing whole-sentence Chinese translations. A Chinese word gloss is explicitly not a sentence translation.
- The overall tutorial and production-release regression/update documentation still need completion.
- A preview notice or a successful APK build does not establish physical-device compatibility or a completed content audit. Browser checks and limited emulator checks are not a full physical iOS/Android test matrix.
- Preview progress is separate. Do not uninstall the student app to try this APK; export backups before any later migration.

No audio replacement or visual redesign was performed for this checkpoint.
