# Inspired English 1.11

## Learning and interface

- Guided learning offers **Learn all words** first and **Daily study plan** second. Whole-list learning continues through five-word groups automatically. Daily plans spread words across the available days without asking for study minutes.
- Guided retrieval, Practice and unit tests teach definitions in both directions. Ambiguous vocabulary sentence-gap MCQ is removed. Spelling remains a separate optional activity. Existing unfinished guided plans and old practice sessions migrate without discarding completed words.
- Read-aloud confirmation uses a clear, accessible checkbox panel. Titles are smaller; action buttons show only their names. Reading lesson lists use the exam list layout. Home order is Vocabulary, Middle School, High School, Reading Comprehension, Memory Palace.
- Student instructions and tutorial use simpler English and Chinese. Release history remains detailed.
- Any English passage word can be highlighted, including words missing from the glossary. Dictionary coverage no longer creates misleading dotted marks on easy words. Existing definitions remain available in Reading/Middle School; words without definitions say so. High School uses manual highlights with no saved definitions or definition panel. Difficulty prediction is deferred.
- Exam paragraphs are separated and numbered. Exam labels include package, district/school and year; high-school labels also distinguish exam series and passage part.

## High-school content

The bank contains **1,582 exercises / 7,391 questions from 176 source papers** in Grades 11 and 12: 1,706 cloze blanks, 2,045 word-form/grammar blanks, 2,554 separate reading questions, 850 reading sentence choices and 236 MCQ. The bank retains 143 source figures. Word-form responses accept the alternatives printed in the source key.

Keys come from paired answer documents, not generated guesses. Four novel MCQ in G11 Monthly Package 24 have no supplied key: they remain visibly ungraded in Study and are excluded from Test. Other questions have source keys. Listening, writing, written-response reading, Chinese sentence translation and standalone initial-letter spelling are outside this import. Thirteen remaining parser groups were individually reviewed and documented as these exclusions.

`high-school-audit.json` records source/answer hashes, published question numbers and exclusions. `tools/high-school-source-notes.json` records reviewed exclusion decisions. Scanned Midterm Package 02 duplicates text-native Package 14: source pages 3–8 were checked, original numbering restored, and keys taken from Package 02's own answer file. The audit identifies this transcription source explicitly. The importer preserves inline figure positions, and the publication check rejects missing figures, empty choices, invalid keys and duplicate question numbers.

Run `python3 tools/build_high_school.py` against `~/Desktop/Inspired Education/Beijing Highschool English`, then `python3 tools/high_school_check.py`. Legacy `.doc` inputs require LibreOffice; vector-render decisions and required raster copies are under `tools/high-school-vector-*`. Inputs remain unchanged.

## Android and verification

Full student package: `com.vocabdrill.student`, version **1.11**, code **14**, original signing identity. The same web code and high-school content are bundled for offline use; all 5,364 word clips remain bundled. Reading recordings remain optional downloads. High-school figures are also precached for the installed PWA.

Checks: definition-first learning and date-based scheduling; progress/backup recovery; existing 144 Reading lessons and 891 keys; phone/tablet guided and test journeys; high-school grading for all supported types; manual highlights and diagrams; fresh offline tabs. Android release build, lint, asset hashes and signing identity are checked separately. Physical iPhone/Safari/Android-device testing is not claimed.

The existing content limitations from 1.10.2 remain: 118 vocabulary entries lack examples, sentence translations are incomplete, and the Unlock 4 Unit 4 Part 1 synonym/antonym block needs separate source correction. Recordings were not regenerated. No cross-device sync or speech recognition is added.

Android source is preserved in `tools/android-release-source.zip`, excluding signing credentials, generated assets and machine configuration. Rebuild with JDK 17 / SDK 34 after running its `tools/sync_web_release.py` next to this web folder. Install the signed APK over the existing app; do not uninstall it to upgrade.

Final package: **44.36 MiB**, SHA-256 `8076416da65370a35bbeb4d5563a90060507f4864ca43a189a333ff71567c105`. All 5,580 asset hashes verified; certificate matches 1.10.2. Release build/lint passed with zero errors (26 warnings). Emulator upgrade from version code 9 to 14 succeeded; the running WebView reports 1.11 and retains the existing UpgradeStudent profile.
