#!/usr/bin/env python3
"""Create a learner-only Reading Explorer bundle and a per-article audit.

Raw exercise extraction is useful evidence, but it must never be rendered as
page content. This pass removes that duplicate text and publishes only clean,
individually validated question fields. Questions that depend on a missing
infographic/page or contain merged option blocks are quarantined in the audit.
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PAGE_DEPENDENT = re.compile(r"\b(?:infographic|photo|map|chart|diagram)\s+on\s+page\b|\bon page \d+\b", re.I)
EXTRA_TEXT = re.compile(
    r"\b(?:complete the summary|phrases? in the box|one is extra|write short answers?|"
    r"gist|detail|vocabulary|inference|summarizing|scanning|main idea|sequence)\b",
    re.I,
)
PAGE_FURNITURE = re.compile(
    r"\b(?:NGM STAFF|ADAPTED WITH PERMISSION|Review this reading skill|Unit \d+\s*[AB])\b",
    re.I,
)
SPACED_OCR_WORD = re.compile(r"\b(?:[A-Za-z]\s+){2,}[A-Za-z]\b")
NUMBER_CONTEXT = {"in", "between", "from", "over", "under", "about", "around", "than", "aged", "age"}


def clean_article_prose(paragraphs: list[str]) -> tuple[list[str], list[str]]:
    cleaned = []
    notes = []
    for number, raw in enumerate(paragraphs, 1):
        value = re.sub(r"(?<=[.!?])(?=[A-Z“‘])", " ", raw)
        value = re.sub(r"(?<=[.!?])[1-9](?=\s+[A-Z“‘])", "", value)
        value = re.sub(r"(?<=[,;])\s+[1-9]\s+(?=[a-z])", " ", value)
        value = re.sub(r"\s+", " ", value).strip()
        words = re.findall(r"\S+", value)
        numeric = sum(bool(re.fullmatch(r"[\d?./()–—-]+", word)) for word in words)
        if words and numeric >= 12 and numeric / len(words) > 0.15:
            notes.append(f"paragraph-{number}:chart-or-axis-data-removed")
            continue
        # PDF page headers occasionally became part of the first sentence.
        newer = re.sub(r"(?:^|(?<=[.!?])\s+)\d{2,3}\s+U\s*n\s*it\s+\d+\s*[AB]\s+", "", value, flags=re.I)
        if newer != value:
            notes.append(f"paragraph-{number}:page-header-removed")
            value = newer
        sentences = re.split(r"(?<=[.!?])\s+(?=(?:\d+\s+)?[A-Z“‘])", value)
        kept = []
        for sentence in sentences:
            marker = re.match(r"^([1-9])\s+", sentence)
            if marker:
                unmarked = sentence[marker.end():]
                looks_glossary = (SPACED_OCR_WORD.search(unmarked) or
                                  re.match(r"^(?:If |The (?:verb|noun|adjective) )?.{1,70}\b(?:is|are|was|were|means|refers to)\b", unmarked, re.I))
                if looks_glossary:
                    notes.append(f"paragraph-{number}:glossary-note-removed")
                    continue
                sentence = unmarked
                notes.append(f"paragraph-{number}:footnote-marker-removed")
            def strip_inline(match: re.Match) -> str:
                word, digit, following = match.group(1), match.group(2), match.group(3)
                if word.lower() in NUMBER_CONTEXT:
                    return match.group(0)
                notes.append(f"paragraph-{number}:inline-footnote-marker-removed")
                return f"{word} {following}"
            sentence = re.sub(r"\b([A-Za-z][A-Za-z'’\-]{2,})\s+([1-9])\s+(of|to|and|in|for|from|with|that|who|which|is|are|was|were|has|have|can|could|will)\b",
                              strip_inline, sentence)
            kept.append(sentence.strip())
        value = " ".join(filter(None, kept)).strip()
        if value:
            cleaned.append(value)
    return cleaned, sorted(set(notes))


def audit_question(question: dict) -> tuple[dict | None, list[str]]:
    reasons = []
    prompt = re.sub(r"\s+", " ", str(question.get("prompt", ""))).strip()
    choices = question.get("choices", [])
    ids = [str(row.get("id", "")).lower() for row in choices]
    texts = [re.sub(r"\s+", " ", str(row.get("text", ""))).strip() for row in choices]
    if not prompt:
        reasons.append("empty-prompt")
    if PAGE_DEPENDENT.search(prompt):
        reasons.append("missing-page-material")
    if PAGE_FURNITURE.search(prompt):
        reasons.append("page-furniture")
    if choices and len(choices) not in {2, 3, 4, 5}:
        reasons.append("implausible-choice-count")
    if choices and len(ids) != len(set(ids)):
        reasons.append("duplicate-choice-ids")
    if any(not row_id or not text for row_id, text in zip(ids, texts)):
        reasons.append("empty-choice")
    if any(EXTRA_TEXT.search(text) for text in texts):
        reasons.append("instruction-or-skill-label-in-choices")
    if reasons:
        return None, reasons
    cleaned = {**question, "prompt": prompt,
               "choices": [{**row, "id": str(row["id"]).lower(), "text": text}
                           for row, text in zip(choices, texts)]}
    return cleaned, []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=ROOT / "reading-content.json")
    parser.add_argument("--output", type=Path, default=ROOT / "reading-content.json")
    parser.add_argument("--audit", type=Path, default=ROOT / "reading-explorer-audit.json")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    data = json.loads(args.input.read_text(encoding="utf-8"))
    report = {"schemaVersion": 1, "articles": [], "summary": {"articles": 0, "approved": 0,
                                                                 "questionsKept": 0, "questionsQuarantined": 0,
                                                                 "rawExerciseBlocksRemoved": 0}}
    for article in data.get("articles", []):
        row = {"id": article["id"], "title": article.get("title"), "status": "approved",
               "paragraphs": len(article.get("paragraphs", [])), "sections": {}, "flags": []}
        article["paragraphs"], prose_notes = clean_article_prose(article.get("paragraphs", []))
        article["displayAuditVersion"] = 1
        row["proseCorrections"] = prose_notes
        prose = " ".join(article.get("paragraphs", []))
        if PAGE_FURNITURE.search(prose):
            row["flags"].append("page-furniture-in-article")
            row["status"] = "review"
        if len(re.findall(r"[A-Za-z]+", prose)) < 100:
            row["flags"].append("unusually-short-article")
            row["status"] = "review"
        for name in ("comprehension", "vocabulary"):
            section = article.get(name, {})
            raw_present = bool(section.pop("sourceText", None))
            if raw_present:
                report["summary"]["rawExerciseBlocksRemoved"] += 1
            kept = []
            quarantined = []
            for question in section.get("questions", []):
                cleaned, reasons = audit_question(question)
                if cleaned:
                    kept.append(cleaned)
                else:
                    quarantined.append({"id": question.get("id"), "number": question.get("number"),
                                        "prompt": question.get("prompt"), "reasons": reasons})
            section["questions"] = kept
            section["instructions"] = ("Choose the best answer." if any(q.get("choices") for q in kept)
                                       else "Write a short answer.")
            row["sections"][name] = {"questionsKept": len(kept), "questionsQuarantined": quarantined,
                                     "rawDisplayRemoved": raw_present}
            report["summary"]["questionsKept"] += len(kept)
            report["summary"]["questionsQuarantined"] += len(quarantined)
            if not kept:
                row["flags"].append(f"no-clean-{name}-questions")
                row["status"] = "review"
        report["articles"].append(row)
        report["summary"]["articles"] += 1
        if row["status"] == "approved":
            report["summary"]["approved"] += 1
    data["auditVersion"] = 1
    print(json.dumps(report["summary"], indent=2))
    if not args.dry_run:
        args.output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        args.audit.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
