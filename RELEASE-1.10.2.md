# Inspired English 1.10.2

Release scope confirmed by Peter on 19 September 2026: clean reading passages with a small set of passage-based selectable questions; no textbook diagrams or extra exercises. Full student Android package, not a separate preview. Audio replacement remains cancelled. Original monochrome/Courier styling is unchanged.

## Reading content

- All 144 Reading Explorer articles included; 891 passage-supported editorial answer keys.
- MCQ and selectable True / False / Not Given only. No written-response comprehension.
- 290 extracted questions are explicitly excluded; additionally, source questions missing from the original extraction have a per-source release decision. Diagram/sidebar-dependent questions and ambiguous printed questions are not scored.
- Source-ledger file: `tools/reading-release-scope.json`, including book hashes, source comprehension page and question numbers. `reading-answer-audit.json` preserves exclusions and editorial evidence.
- Corrections include missing source sentences/questions, passage/question boundaries, OCR debris, reading order, quoted question references and answer evidence locations. The three supplied replacement PDFs are incorporated.
- Answers are generated editorial judgments supported by the source passages, not a publisher answer sheet. Historical claims retain the textbook's time frame.
- Reproducible audit input is Git commit `8e4b083793e772baec8befbd8f00bbbfb30d576b`. The publication check rejects disappearing source questions, invalid answer choices and missing evidence.

## Learning and delivery

Five-word spelling practice; whole-list MCQ/spelling/mixed tests; variable-deadline guided plans including one-day schedules; four retrieval rounds; local timestamps; resumable sessions and guided-plan backups; bilingual tutorial, once-per-version notice and Settings history.

Android: `com.vocabdrill.student`, version `1.10.2`, code **13**, original signing key. Word audio remains bundled. Reading audio is optional; no duplicate audio packs or diagrams are packaged. Existing word and reading recordings are unchanged and may not exactly match newly corrected display copy.

The Android upgrade test exposed an older installed service worker serving the 1.09 interface after APK replacement. The native shell now unregisters that worker and removes only `vd-shell-*` app caches once per version. It does not clear progress, profiles, plans, IndexedDB or downloaded audio. This lets the APK immediately supply the correct interface and suppresses the obsolete iOS reminder.

## Explicit limitations

- 118 vocabulary entries lack English examples; whole-sentence Chinese translations are still pending. The guided interface identifies missing examples and labels Chinese word meanings as meanings, not translations.
- A known shifted synonym/antonym block in Unlock 4 Unit 4 Part 1 still needs a separate vocabulary-source correction. This is not part of the Reading Explorer source sign-off.
- No speech recognition, server-verified attendance or cross-device sync. Back up before changing devices or reinstalling.
- High-school reading content and the Memory Palace redesign remain future work.
- Responsive Chromium checks and Android emulator checks do not replace physical Safari/iPhone/Android-device testing.

## Verification commands

Release checks passed: all 144 reading pages / 891 keys; learning logic and storage recovery; phone/tablet student journeys; once-only bilingual notice/history; single-pack vocabulary audio and offline playback. Full Android build/lint passed with zero errors and 26 warnings. APK assets/signature verified; tablet-emulator upgrade retained the existing student profile and loaded the current interface. Physical-device verification is not claimed.

APK SHA-256: `e19656c06d86b2fc0e04324a175276c67a0a3d2a9da84b85fa28323c0e289d52` (29.55 MiB).

`python3 tools/reading_publication_check.py`; `python3 tools/validate_curriculum.py`; `node tools/learning_logic_check.mjs`; `node tools/storage_recovery_check.mjs`; browser checks `reading_release_check.cjs`, `learning_browser_check.cjs`, `offline_learning_check.cjs`, `release_smoke.cjs`, `release_1101.cjs` (Playwright required).

Android: synchronize with `python3 tools/sync_web_release.py`, then run `assembleRelease lintRelease` using JDK 17 / Android SDK 34. `tools/android_preview_check.py` now validates the current full release despite its historical filename. The Android source archive omits local signing credentials and generated assets.

The previous preview commit remains a rollback point. Do not uninstall the student application to update it; install the matching signed APK over it. A web rollback must use a new service-worker cache identifier so installed PWAs receive it.
