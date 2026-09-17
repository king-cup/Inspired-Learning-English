---
title: Inspired English App — Reading and Middle School Content Audit
aliases:
  - Reading Content Audit
  - Middle School Content Audit
tags:
  - inspired-english
  - content-audit
  - reading
status: completed-first-pass
updated: 2026-09-17
---

# Content Audit — Reading and Middle School

## Completed first pass — 2026-09-17

The source-backed cleanup is now applied to the learner bundles. The original source bank was not edited.

| Corpus | Published result | Held outside learner app |
|---|---:|---:|
| Middle School MCQ | 506 records / 5,780 keyed questions | 34 unresolved records |
| Cloze | 608 passages; 5 corrected boundaries | 0 |
| Reading A–E | 1,874 source-separated records | 277 unresolved records |
| 阅读表达 | 518 cleaned future records | 14 quarantined; feature not active |
| Writing | 192 clean single-task future records | 391 merged/malformed records quarantined; feature not active |
| Reading Explorer | 144 individually audited articles / 2,239 retained questions | 173 malformed or page-dependent questions |

Reading Explorer no longer renders its 288 raw extraction blocks above the structured exercises. Visible footnote markers, page headers, glossary asides and chart-axis debris were cleaned in 95 articles. The existing narration text remains unchanged so the current audio files keep their verified hashes; it should be regenerated when narration moves to the optional download pack.

Machine-readable evidence is in `middle-school-cleaning-audit.json` and `reading-explorer-audit.json`. Re-run the process with `tools/clean_middle_school.py` and `tools/audit_reading_content.py`.

## Why this is necessary

The v1.09 validator says the curriculum has no errors, but its checks are mostly structural: files exist, IDs are unique at the top level, audio matches narration, and answers do not point to missing choices. It does not determine whether a passage contains question text, whether two exercises were merged, whether choices belong to the right prompt, or whether a test can actually be graded.

A visible example occurs in `rc-foundation-u01-a`: comprehension question 5 has eight choices. The first three belong to that question; the remaining entries are the following summary exercise, including repeated option IDs. The same article's full exercise source is also displayed above the parsed question fields, so questions and answers appear bunched together even when parsing partially succeeds.

## Baseline inventory — 2026-09-17

### Reading curriculum

| Measure | Count |
|---|---:|
| Articles | 144 |
| Parsed questions | 2,412 |
| Questions without an answer key | 2,412 |
| Questions with no choices | 1,439 |
| Questions with more than four choices | 77 |
| Questions with duplicate choice IDs | 134 |
| Article word-count range | 210–2,469 |
| Average article word count | 722 |

### Middle-school curriculum

| Measure | Count |
|---|---:|
| Records | 3,218 |
| Parsed questions | 17,683 |
| Questions without an answer key | 4,838 |
| Questions with no choices | 5,085 |
| Questions with more than four choices | 95 |
| Questions with duplicate choice IDs | 96 |
| Passage word-count range | 8–1,796 |
| Average passage word count | 384 |
| Records rejected by the current importer | 152 |

These are screening counts. Some empty-choice records are legitimate written responses, and some ungraded activities may be deliberately included. The audit must classify them explicitly instead of treating ambiguity as success.

## Scope

Audit all learner-facing fields in:

- `reading-content.json` and its six Markdown source extracts;
- `middle-school.json` and the original middle-school source bank;
- question and answer-key associations;
- titles, passage boundaries, instructions, choice lists and grading behavior;
- IDs and migration impact on existing student progress.

Audio narration text should be regenerated only after the corrected article body is approved.

## Correct content contract

Each published record should contain distinct fields for:

- source/provenance and page or exercise location;
- title and learner-facing instructions;
- passage paragraphs with stable sentence IDs;
- question type;
- one prompt per question;
- ordered choices with unique IDs, when applicable;
- correct answer or an explicit `ungraded/open-response` status;
- optional explanation/evidence;
- audit status, reviewer, review date and source checksum.

Do not use one raw `sourceText` field as both a preservation copy and learner-facing content. Keep raw extraction evidence in staging or audit artifacts; publish only reviewed structured fields.

## Automated quarantine rules

A record must not ship when any of the following is unresolved:

- duplicate question or choice IDs within a record;
- a multiple-choice question has fewer than two or unexpectedly more than four choices;
- option labels repeat or jump sequence;
- instruction phrases, answer banks or the next exercise appear inside the final choice;
- passage text contains answer labels, answer-key markers, page furniture or a second unrelated title;
- implausible passage length or sudden typography/section-marker changes suggest a bad split/merge;
- a test-mode item lacks a valid answer key;
- an open-response item is not explicitly typed as open response;
- answer text does not match the referenced choice;
- source and normalized checksums changed without renewed review;
- a record has no provenance link back to the extraction source.

Quarantine should produce a machine-readable ledger with record ID, source, failure codes and a short preview.

## Human review checklist

For every record marked approved:

- [ ] Title belongs to the passage.
- [ ] Passage begins and ends at the correct boundary.
- [ ] Paragraph order is natural and no column/page ordering is scrambled.
- [ ] No questions, answer bank, captions, credits or page furniture remain in the passage.
- [ ] Instructions are separated from prompts.
- [ ] Each question is complete and belongs to this passage.
- [ ] Choices are complete, ordered and attached to the correct question.
- [ ] Answer key is correct, or the item is explicitly ungraded/open response.
- [ ] Learner display matches the normalized record on a phone-sized screen.
- [ ] Stable IDs and any legacy aliases are recorded.

## Audit workflow

### Stage 1 — Preserve and inventory

1. Tag/archive the v1.09 generated bundles and record their hashes.
2. Export a defect ledger from the current bundles.
3. Back up representative v1.09 progress so migration tests use real data shapes.

### Stage 2 — Representative pilot

Manually correct a small matrix before bulk work:

- Reading: one A and one B lesson from Foundation, Level 2 and Level 5.
- Middle School: one record from each section type across Grades 7–9, including MCQ, ordinary reading and open response.
- Include known clean, merged, split and missing-answer examples.

Use this pilot to finalize the schema and extraction rules. Do not bulk-regenerate until the app renders the pilot correctly.

### Stage 3 — Rebuild into staging

Generate normalized staging files plus a review queue. Never overwrite the last approved learner bundle directly. Corrections should live as source-specific parser rules or explicit reviewed overrides, not ad hoc edits to generated JSON.

### Stage 4 — Human approval batches

Review in bounded batches with coverage visible by level/grade and section. Suggested batch size: 25–50 records for dense middle-school material and 12–24 for Reading lessons. Approved and quarantined counts must be recorded after every batch.

### Stage 5 — Publish gate

The publishing command should build learner JSON only from records with `auditStatus: approved`. Quarantined or merely parsed records remain unavailable in the app.

## Release gates

- Zero duplicate choice IDs.
- Zero unclassified empty-choice questions.
- Zero test-mode questions without valid answer keys.
- Zero passage/exercise boundary flags.
- All 144 Reading articles reviewed against their source before the complete set is re-enabled.
- Every middle-school record exposed in the release is approved; unreviewed sections may ship hidden rather than mixed with approved material.
- Random visual samples from each level/grade/section pass on mobile.
- A second reviewer or answer-key cross-check covers graded material where practical.

## Decisions still needed

- Whether Reading source exercises without official answer keys should be hidden, shown as ungraded practice, or held until keys are authored.
- Whether the first clean release should temporarily reduce the corpus to a smaller approved subset.
- Which middle-school source files are authoritative when extracted text and answer-key files disagree.
- Whether corrected record IDs should remain stable through aliases or be replaced when a formerly merged record becomes two records.
