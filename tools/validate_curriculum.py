#!/usr/bin/env python3
"""Fail-fast production validation and v1.09 curriculum audit."""

from __future__ import annotations

import json
import re
import subprocess
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROHIBITED = re.compile(r"reading explorer", re.I)
EXERCISE_ARTIFACT = re.compile(
    r"Review\s+this\s+reading\s+skill|\b\d{1,3}\s+Unit\s+\d+[AB]\b|\bUnit\s+\d+[AB]\s+\d{1,3}\b",
    re.I,
)


def load(name: str):
    return json.loads((ROOT / name).read_text(encoding="utf-8"))


def main() -> None:
    errors: list[str] = []
    reading = load("reading-content.json")
    middle = load("middle-school.json")
    audio = load("reading-audio-manifest.json")
    if reading.get("contentVersion") != "1.09" or middle.get("contentVersion") != "1.09":
        errors.append("curriculum content version is not 1.09")
    articles = reading.get("articles", [])
    article_ids = [row.get("id") for row in articles]
    if len(articles) != 144:
        errors.append(f"expected 144 reading articles, got {len(articles)}")
    if len(article_ids) != len(set(article_ids)):
        errors.append("duplicate reading article IDs")
    expected_levels = {"foundation", "level-1", "level-2", "level-3", "level-4", "level-5"}
    if {row.get("id") for row in reading.get("levels", [])} != expected_levels:
        errors.append("missing or unexpected reading levels")

    answer_keys = 0
    missing_keys = 0
    reading_question_ids = []
    for article in articles:
        if not article.get("paragraphs") or not " ".join(article["paragraphs"]).strip():
            errors.append(f"{article.get('id')}: empty article")
        spoken_title = article.get("title", "")
        if not spoken_title.endswith((".", "?", "!")):
            spoken_title += "."
        expected_narration = spoken_title + "\n\n" + "\n\n".join(article.get("paragraphs", []))
        # Audited display copy intentionally omits page furniture, footnote
        # markers, and chart data still present in the legacy audio narration.
        # The audio pack will be regenerated when it becomes optional.
        if not article.get("displayAuditVersion") and article.get("narration") != expected_narration:
            errors.append(f"{article.get('id')}: narration differs from title plus displayed main text")
        if re.search(r"\bParagraph [A-Z]\b", article.get("narration", ""), re.I):
            errors.append(f"{article.get('id')}: paragraph metadata leaked into narration")
        if len(article.get("paragraphs", [])) != len(set(article.get("paragraphs", []))):
            errors.append(f"{article.get('id')}: duplicated narration paragraph")
        if re.search(r"\b(?:NGM STAFF|ADAPTED WITH PERMISSION)\b|\bUnit\s+\d+\s*[AB]\b", article.get("narration", ""), re.I):
            errors.append(f"{article.get('id')}: source credit or page marker leaked into narration")
        if not re.search(r"[.!?][\"'’”)]?$", " ".join(article.get("paragraphs", []))):
            errors.append(f"{article.get('id')}: article does not end with complete prose")
        if article.get("reading") not in {"A", "B"} or not 1 <= article.get("unit", 0) <= 12:
            errors.append(f"{article.get('id')}: broken ordering")
        for name in ("comprehension", "vocabulary"):
            section = article.get(name, {})
            if EXERCISE_ARTIFACT.search(section.get("sourceText", "")):
                errors.append(f"{article.get('id')} {name}: source navigation artifact leaked")
            questions = section.get("questions", [])
            if not questions:
                errors.append(f"{article.get('id')} {name}: no questions")
            for question in questions:
                reading_question_ids.append(question.get("id"))
                if not question.get("prompt"):
                    errors.append(f"{question.get('id')}: missing question text")
                if EXERCISE_ARTIFACT.search(question.get("prompt", "")):
                    errors.append(f"{question.get('id')}: source navigation artifact leaked")
                choices = question.get("choices", [])
                if any(not choice.get("id") or not choice.get("text") for choice in choices):
                    errors.append(f"{question.get('id')}: malformed choices")
                answer = question.get("answer")
                if answer and answer not in {choice["id"] for choice in choices}:
                    errors.append(f"{question.get('id')}: answer points to missing choice")
                if answer or question.get("answerText"):
                    answer_keys += 1
                else:
                    missing_keys += 1
    if len(reading_question_ids) != len(set(reading_question_ids)):
        errors.append("duplicate reading question IDs")

    middle_counts = {}
    middle_ids = []
    middle_question_ids = []
    middle_signatures = set()
    for grade in ("7", "8", "9"):
        sections = middle.get("grades", {}).get(grade)
        if not sections:
            errors.append(f"missing grade {grade}")
            continue
        middle_counts[grade] = {name: len(rows) for name, rows in sections.items()}
        for name, rows in sections.items():
            if not rows:
                errors.append(f"grade {grade} {name}: empty learner-facing section")
            for row in rows:
                middle_ids.append(row.get("id"))
                signature = json.dumps({
                    "grade": grade,
                    "section": name,
                    "content": row.get("content", ""),
                    "questions": [(q.get("prompt"), [(c.get("id"), c.get("text")) for c in q.get("choices", [])]) for q in row.get("questions", [])],
                }, ensure_ascii=False, sort_keys=True)
                if signature in middle_signatures:
                    errors.append(f"{row.get('id')}: duplicate imported record")
                middle_signatures.add(signature)
                if (name != "mcq" and not row.get("content")) or not row.get("questions"):
                    errors.append(f"{row.get('id')}: empty passage or detached questions")
                for question in row.get("questions", []):
                    middle_question_ids.append(question.get("id"))
                    if not question.get("prompt"):
                        errors.append(f"{question.get('id')}: missing question text")
                    choices = question.get("choices", [])
                    if any(not choice.get("id") or not choice.get("text") for choice in choices):
                        errors.append(f"{question.get('id')}: malformed choices")
                    answer = question.get("answer")
                    if answer and answer not in {choice["id"] for choice in choices}:
                        errors.append(f"{question.get('id')}: answer points to missing choice")
                    if answer or question.get("answerText"):
                        answer_keys += 1
                    else:
                        missing_keys += 1
    if len(middle_ids) != len(set(middle_ids)):
        errors.append("duplicate middle-school IDs")
    if len(middle_question_ids) != len(set(middle_question_ids)):
        errors.append("duplicate middle-school question IDs")

    recordings = audio.get("recordings", [])
    by_id = {row.get("articleId"): row for row in recordings}
    if len(recordings) != 144 or len(by_id) != 144:
        errors.append(f"expected 144 audio manifest records, got {len(recordings)}")
    wpms = []
    durations = []
    for article in articles:
        row = by_id.get(article["id"])
        if not row:
            errors.append(f"{article['id']}: missing audio manifest record")
            continue
        path = ROOT / row.get("path", "")
        if row.get("status") != "generated":
            errors.append(f"{article['id']}: generation status {row.get('status')}")
        if not path.is_file() or path.stat().st_size == 0:
            errors.append(f"{article['id']}: missing or zero-length audio")
            continue
        if row.get("contentHash") != article.get("narrationHash"):
            errors.append(f"{article['id']}: audio text hash differs")
        try:
            probe = json.loads(subprocess.check_output([
                "ffprobe", "-v", "error", "-select_streams", "a:0",
                "-show_entries", "stream=codec_name,duration", "-of", "json", str(path),
            ], text=True))
            stream = probe.get("streams", [])[0]
            actual_duration = float(stream.get("duration", 0))
            if stream.get("codec_name") != "aac" or actual_duration <= 0:
                errors.append(f"{article['id']}: invalid audio codec or duration")
                continue
            if abs(actual_duration - float(row.get("duration", 0))) > 0.2:
                errors.append(f"{article['id']}: manifest duration differs from audio")
        except (subprocess.SubprocessError, ValueError, IndexError, KeyError, json.JSONDecodeError) as exc:
            errors.append(f"{article['id']}: audio integrity probe failed ({exc})")
            continue
        wpm = float(row.get("spokenWordCount", 0)) * 60 / actual_duration
        if not 140 <= wpm <= 160:
            errors.append(f"{article['id']}: {wpm:.2f} WPM outside target")
        wpms.append(wpm)
        durations.append(actual_duration)

    production = [
        ROOT / "index.html", ROOT / "manifest.webmanifest", ROOT / "sw.js", ROOT / "vocab.json",
        ROOT / "audio-packs.json", ROOT / "reading-content.json", ROOT / "reading-audio-manifest.json",
        ROOT / "middle-school.json", *sorted((ROOT / "js").rglob("*.js")), *sorted((ROOT / "content").glob("*.json")),
    ]
    branded = [str(path.relative_to(ROOT)) for path in production if path.exists() and PROHIBITED.search(path.read_text(encoding="utf-8"))]
    if branded:
        errors.append("prohibited learner-facing phrase in: " + ", ".join(branded))

    level_counts = Counter(row["level"] for row in articles)
    generated = sum(row.get("status") == "generated" for row in recordings)
    audit = {
        "contentVersion": "1.09",
        "readingArticles": len(articles),
        "readingByLevel": dict(level_counts),
        "recordings": generated,
        "missingOrFailedRecordings": 144 - generated,
        "audioFormat": "AAC-LC in M4A",
        "audioIntegrityProbe": "ffprobe codec and duration verified per recording",
        "voice": audio.get("voice"),
        "model": audio.get("model"),
        "audioDurationSeconds": round(sum(durations), 3),
        "wpmMin": min(wpms) if wpms else None,
        "wpmMax": max(wpms) if wpms else None,
        "wpmAverage": round(sum(wpms) / len(wpms), 2) if wpms else None,
        "questionsWithAnswerKeys": answer_keys,
        "questionsWithoutAnswerKeys": missing_keys,
        "middleSchoolByGradeAndSection": middle_counts,
        "duplicatesSkippedOrMerged": middle.get("importAudit", {}).get("duplicatesSkippedOrMerged", 0),
        "rejectedRecords": middle.get("importAudit", {}).get("rejectedRecords", 0),
        "errors": errors,
    }
    (ROOT / "curriculum-audit.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(audit, ensure_ascii=False, indent=2))
    if errors:
        raise SystemExit(f"validation failed with {len(errors)} error(s)")


if __name__ == "__main__":
    main()
