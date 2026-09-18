# Inspired English

<!-- impeccable:product-schema 1 -->

## Platform

web

The Android build wraps the same web interface; it does not use a separate native visual language.

## Users and Purpose

An offline-first English learning app for Peter's students, using the vocabulary lists and reading material assigned in class. Learners need clear book/unit identity, short understandable activities, useful correction, and saved progress between lessons.

The same vanilla JavaScript web interface runs as an iOS PWA and in the Android WebView app, on phones and tablets. Preserve existing offline audio, progress, backups, and the original paper/Courier aesthetic.

## Capabilities and Constraints

Approved 1.10.2 work adds spelling practice, selectable vocabulary test formats, passage-supported comprehension keys, and guided study scheduled around an actual class deadline. Guided plans must support one day as well as multiple days. Pronunciation repetition is self-confirmed, without microphone recording or speech recognition.

Reading comprehension must contain selectable questions, not written-answer fields. Test mode must not expose word lookup or answers before submission. Correctness must be grounded in the available passage; uncertain or incomplete source questions are recorded for repair, not guessed.

Activity history is local and timestamped using the device clock, not a teacher monitoring service or tamper-proof attendance record. No new backend is assumed.

Guided learning, five-word spelling practice, full-list MCQ/spelling/mixed tests, local activity history, and guided-plan backup/recovery are implemented locally. The Reading Explorer answer-key restoration remains an unpublished editorial draft. Some English examples and whole-sentence Chinese translations are missing; a word gloss must not be presented as a translated sentence.

## Brand Commitments

Preserve the supplied multicolour leaf and the user-restored monochrome paper/Courier interface. Do not revive the rejected colourful navigation redesign. English and Chinese instructions must describe the same behavior. Narrator replacement remains cancelled; existing audio stays intact.

## Release Boundary

On 19 September 2026 Peter explicitly chose a non-live Git checkpoint and a preview APK, not publication to students with the remaining limitations. The preview has a separate Android application identity and does not replace the installed student app. Production publication still requires the unfinished content and platform checks. Do not describe a preview build or passing structural checks as a completed content audit.
