#!/usr/bin/env python3
"""Build the neutral v1.09 reading and middle-school content bundles."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
READING_ROOT = ROOT.parent / "Reading Explorer Extracts"
MIDDLE_ROOT = Path("/Users/pshen2p/Desktop/Inspired Education/Beijing Middle School English/北京英语_整理版/AI提取_分类_含解析")

READING_FILES = [
    ("foundation", "Foundation", READING_ROOT / "Reading Explorer Foundations - Articles and Practice.md"),
    *[(f"level-{n}", f"Level {n}", READING_ROOT / f"Reading Explorer {n} - Articles and Practice.md") for n in range(1, 6)],
]
MIDDLE_SECTIONS = [
    ("mcq", "语法选择"),
    ("reading-a", "阅读理解_A"),
    ("reading-b", "阅读理解_B"),
    ("reading-c", "阅读理解_C"),
    ("reading-d", "阅读理解_D"),
    ("reading-e", "阅读理解_E"),
    ("reading-response", "阅读表达"),
]
GRADE_FILES = {"7": "七年级.md", "8": "八年级.md", "9": "九年级.md"}

# A handful of source pages were extracted column-by-column instead of in
# reading order. Keep their repairs small, explicit, and reviewable rather than
# applying a heuristic reorder to the remaining articles.
ARTICLE_COLUMN_ORDER = {
    "rc-level-4-u05-b": (["BC", "E", "F", "G", "H", "I"], {"I": "distant voyages."}),
    "rc-level-4-u06-a": (["ABCDE", "FGH", "IJ", "KL", "MN"], {"KL": "cover all the notes"}),
    "rc-level-5-u04-b": (
        ["AB", "CD", "EF", "GH", "I#2", "J", "KLM", "NO"],
        {"EF": "Coas t lines at Ris k", "I#2": "Netherlands for guidance", "KLM": "Dutch Lessons"},
    ),
    "rc-level-5-u12-b": (
        ["ABCDEF", "GHIJK", "LMNOP", "QR", "ST"],
        {"QR": "deposits have a relatively high magnesium content."},
    ),
}

ARTICLE_REMOVE_RANGES = {
    "rc-level-2-u10-a": [("TROPIC OF CAPRICORN", "Drying Out")],
    "rc-level-4-u11-a": [
        ("SO U T H", "On arriving at the Indian village"),
        ("GLOBAL WATER SCARCITY", "they will maintain it"),
    ],
    "rc-level-5-u03-b": [("100%", "infected.")],
}

# These endings are the final words of the main prose. Text after them in the
# extracted Markdown is page furniture (captions, maps, diagrams, or glossary
# fragments) and must not enter the learner-facing article or narration.
ARTICLE_ENDINGS = {
    "rc-level-1-u01-b": "hide from predators.",
    "rc-level-1-u03-a": "treat depression.",
    "rc-level-1-u12-a": "early mountaineering heroes.",
    "rc-level-3-u02-a": "in the eye of the beholder.",
    "rc-level-3-u06-b": "interacting with nature.’”",
    "rc-level-3-u08-b": "only time will tell.",
    "rc-level-3-u09-a": "I, for one, am glad of that.",
    "rc-level-4-u05-b": "over the horiz on.",
    "rc-level-4-u06-a": "powerful influence upon us all.",
    "rc-level-4-u11-a": "world’s water concerns.",
    "rc-level-5-u04-b": "We need to adapt.”",
    "rc-level-5-u12-b": "but in fact, cannot.",
}

ARTICLE_STARTS = {
    "rc-level-1-u11-a": "On a boat near Costa Rica",
    "rc-level-1-u12-b": "On July 2, 1937",
    "rc-level-2-u10-a": "The Chacaltaya ski area",
    "rc-level-4-u11-a": "In the Castilla-La Mancha region of Spain",
}


def plain(text: str) -> str:
    text = re.sub(r"!\[[^]]*]\([^)]*\)", "", text)
    text = re.sub(r"\[([^]]+)]\([^)]*\)", r"\1", text)
    text = re.sub(r"[*_`]", "", text)
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def join_lines(text: str) -> str:
    out: list[str] = []
    for block in re.split(r"\n\s*\n", text):
        line = " ".join(plain(x) for x in block.splitlines() if plain(x))
        if line:
            out.append(line)
    return "\n\n".join(out)


def footnote_start(line: str) -> bool:
    """Recognize definition footnotes without mistaking numbered word wraps."""
    return bool(re.match(
        r"^\d(?:\s*\d)?\s+(?:A\s|An\s|If\s|The\s|To\s|When\s|"
        r"[A-Z][A-Za-z’'\-]*(?:\s+[A-Za-z’'\-]+){0,3}\s+(?:is|are|means|refers)\b)",
        line,
    ))


def question_records(text: str, prefix: str) -> list[dict]:
    """Extract numbered prompts without throwing away the complete source text."""
    normalized = "\n".join(plain(line) for line in text.splitlines())
    starts = list(re.finditer(r"^\s*(\d{1,2})\s*[.)]\s*", normalized, re.M))
    questions: list[dict] = []
    for index, match in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(normalized)
        chunk = join_lines(normalized[match.end():end])
        if not chunk or chunk.lower().startswith("if ") and len(chunk) < 25:
            continue
        answer_cut = re.search(r"\bAnswers?\s*:", chunk, re.I)
        answer_text = chunk[answer_cut.end():].strip() if answer_cut else ""
        if answer_cut:
            chunk = chunk[:answer_cut.start()].strip()
        option_hits = list(re.finditer(r"(?:^|\s)([A-Da-d])[.)]\s+", chunk))
        choices: list[dict] = []
        prompt = chunk
        if len(option_hits) >= 2:
            prompt = chunk[:option_hits[0].start()].strip()
            for oi, hit in enumerate(option_hits):
                option_end = option_hits[oi + 1].start() if oi + 1 < len(option_hits) else len(chunk)
                choices.append({
                    "id": hit.group(1).lower(),
                    "label": hit.group(1).upper(),
                    "text": chunk[hit.end():option_end].strip(),
                })
        if len(prompt) < 2:
            continue
        key = None
        key_hit = re.search(r"\b([A-D])\b", answer_text, re.I)
        if key_hit and choices:
            candidate = key_hit.group(1).lower()
            if any(c["id"] == candidate for c in choices):
                key = candidate
        questions.append({
            "id": f"{prefix}-q{len(questions) + 1:02d}",
            "number": match.group(1),
            "prompt": prompt,
            "choices": choices,
            "answer": key,
            "answerText": answer_text or None,
            "explanation": None,
        })
    answer_map: dict[str, str] = {}
    for block in re.finditer(r"^Answers?\s*:\s*(.*?)(?=\n\s*\n|\Z)", normalized, re.I | re.M | re.S):
        for hit in re.finditer(r"(\d{1,2})\s*[.)]?\s*([A-D])\b", block.group(1), re.I):
            answer_map[hit.group(1)] = hit.group(2).lower()
    for question in questions:
        candidate = answer_map.get(question["number"])
        if candidate and any(choice["id"] == candidate for choice in question["choices"]):
            question["answer"] = candidate
    return questions


def clean_reading_exercise(text: str) -> str:
    """Remove publisher navigation/footer artifacts before learner parsing."""
    text = re.sub(r"Review\s+this\s+reading\s+skill\s+in\s+Unit\s+\d+[AB]", "", text, flags=re.I)
    text = re.sub(r"\b\d{1,3}\s+Unit\s+\d+[AB]\b", "", text, flags=re.I)
    text = re.sub(r"\bUnit\s+\d+[AB]\s+\d{1,3}\b", "", text, flags=re.I)
    return text


def reorder_article_columns(text: str, article_id: str) -> str:
    repair = ARTICLE_COLUMN_ORDER.get(article_id)
    if not repair:
        return text
    order, starts = repair
    marker_pattern = re.compile(r"(?m)(?:^\*\*Paragraph ([A-Z])\*\*\s*\n?)+")
    markers = list(marker_pattern.finditer(text))
    chunks: dict[str, str] = {}
    occurrences: dict[str, int] = {}
    previous_end = 0
    for marker in markers:
        label = "".join(re.findall(r"Paragraph ([A-Z])", marker.group()))
        occurrences[label] = occurrences.get(label, 0) + 1
        key = label if occurrences[label] == 1 else f"{label}#{occurrences[label]}"
        chunks[key] = text[previous_end:marker.start()]
        previous_end = marker.end()
    missing = [label for label in order if label not in chunks]
    if missing:
        raise ValueError(f"Missing column markers for {article_id}: {missing}")
    arranged: list[str] = []
    for label in order:
        chunk = chunks[label]
        if label in starts:
            anchor = re.search(re.escape(starts[label]).replace(r"\ ", r"\s+"), chunk)
            if not anchor:
                raise ValueError(f"Missing repaired column start for {article_id}: {starts[label]}")
            chunk = chunk[anchor.start():]
        arranged.append(chunk)
    return "\n".join(arranged)


def remove_article_furniture(text: str, article_id: str) -> str:
    for start, end in ARTICLE_REMOVE_RANGES.get(article_id, []):
        start_match = re.search(re.escape(start).replace(r"\ ", r"\s+"), text)
        if not start_match:
            raise ValueError(f"Missing furniture start for {article_id}: {start}")
        end_match = re.search(re.escape(end).replace(r"\ ", r"\s+"), text[start_match.end():])
        if not end_match:
            raise ValueError(f"Missing furniture end for {article_id}: {end}")
        end_position = start_match.end() + end_match.start()
        text = text[:start_match.start()] + text[end_position:]
    return text


def clean_article(text: str, title: str, article_id: str) -> list[str]:
    text = remove_article_furniture(text, article_id)
    text = reorder_article_columns(text, article_id)
    title_words = re.sub(r"[^A-Z0-9]", "", title.upper())

    def complete_prose_tail(candidate: str) -> bool:
        tail = ""
        in_footnote = False
        for raw_line in candidate.splitlines():
            line = plain(raw_line)
            if footnote_start(line):
                in_footnote = True
            if in_footnote:
                if re.search(r"[.!?][\"'’”)]?\s*$", line):
                    in_footnote = False
                continue
            if not line or re.fullmatch(r"Paragraph [A-Z]", line, re.I):
                continue
            compact = re.sub(r"[^A-Z0-9]", "", line.upper())
            if compact == title_words or (re.fullmatch(r"[A-Z][A-Z\s!?&:'’\-0-9]{2,}", line) and len(line.split()) <= 8):
                continue
            tail = line
        return bool(re.search(r"[.!?][\"'’”)]?$", tail))

    # Paragraph-letter overlays occur after each page of prose. The final real
    # sequence marks the end of the main article; later non-consecutive markers
    # (for example diagram compass points) belong to page furniture. Truncating
    # at the last consecutive sequence retains multi-page articles while
    # excluding captions, diagrams, repeated display titles and image labels.
    if article_id not in ARTICLE_ENDINGS:
        cuts: list[int] = []
        previous_letter: str | None = None
        marker_pattern = r"(?m)(?:^\*\*Paragraph ([A-Z])\*\*\s*\n?)+"
        for group in re.finditer(marker_pattern, text):
            letters = re.findall(r"Paragraph ([A-Z])", group.group())
            consecutive = 1
            while consecutive < len(letters) and ord(letters[consecutive]) == ord(letters[consecutive - 1]) + 1:
                consecutive += 1
            continues_previous = (len(letters) == 1 and previous_letter is not None
                                  and ord(letters[0]) == ord(previous_letter) + 1)
            if consecutive >= 2 or continues_previous:
                cuts.append(group.start())
                previous_letter = letters[consecutive - 1]
        if cuts:
            candidate = text[:cuts[-1]].rstrip()
            # Some PDF pages place their overlay marker in the middle of a wrapped
            # sentence. Such a boundary cannot be the end of the article; keeping
            # the full extract is safer than clipping real prose.
            if complete_prose_tail(candidate):
                text = candidate
    lines: list[str] = []
    footnote = False
    for raw in text.splitlines():
        line = plain(raw)
        if footnote_start(line):
            footnote = True
        if footnote:
            if re.search(r"[.!?][\"'’”)]?\s*$", line):
                footnote = False
            continue
        if not line:
            lines.append("")
            continue
        if re.fullmatch(r"Paragraph [A-Z]", line, re.I):
            continue
        compact = re.sub(r"[^A-Z0-9]", "", line.upper())
        if compact and compact == title_words:
            continue
        if re.fullmatch(r"[A-Z][A-Z\s!?&:'’\-0-9]{2,}", line) and len(line.split()) <= 8:
            continue
        line = re.sub(r"(?<=[A-Za-z])\d{1,2}\b", "", line)
        lines.append(re.sub(r"\s+\d\s+\d(?=\s)", " ", line))

    joined = " ".join(lines)
    joined = re.sub(r"\s+\d\s+\d(?=\s)", " ", joined)
    joined = re.sub(r"\s+", " ", joined).strip()
    start = ARTICLE_STARTS.get(article_id)
    if start:
        position = joined.find(start)
        if position < 0:
            raise ValueError(f"Missing article start for {article_id}: {start}")
        joined = joined[position:]
    ending = ARTICLE_ENDINGS.get(article_id)
    if ending:
        position = joined.find(ending)
        if position < 0:
            raise ValueError(f"Missing article ending for {article_id}: {ending}")
        joined = joined[:position + len(ending)]
    joined = re.sub(r"\bNational Geographic(?: \(NG\))?:", "Interviewer:", joined)
    joined = re.sub(r"\b\d{1,3}\s+Unit\s+\d+\s*[AB]\b", "", joined, flags=re.I)
    joined = re.sub(r"\bUnit\s+\d+\s*[AB](?:\s+Unit\s+\d+\s*[AB])?\b", "", joined, flags=re.I)
    joined = re.sub(r"See\s+reading passage\.?", "", joined, flags=re.I)
    joined = joined.replace("T o survive", "To survive").replace("over the horiz on", "over the horizon")
    sentence_ends = list(re.finditer(r"[.!?][\"'’”)]?(?=\s|$)", joined))
    if sentence_ends:
        joined = joined[:sentence_ends[-1].end()]
    # PDF extraction rarely retains paragraph breaks. Sentence groups produce a
    # comfortable reading page without inventing or reordering any wording.
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z‘“'\d])", joined)
    paragraphs = [" ".join(sentences[i:i + 4]).strip() for i in range(0, len(sentences), 4)]
    return [p for p in paragraphs if p]


def reading_bundle() -> dict:
    levels = []
    all_articles = []
    for level_id, label, path in READING_FILES:
        source = path.read_text(encoding="utf-8")
        matches = list(re.finditer(r"^## Unit (\d+)([AB]):\s*(.+?)\s*$", source, re.M))
        articles = []
        for i, match in enumerate(matches):
            end = matches[i + 1].start() if i + 1 < len(matches) else len(source)
            body = source[match.end():end]
            unit, letter, title = int(match.group(1)), match.group(2), plain(match.group(3))
            theme_hit = re.search(r"\*\*Unit theme:\*\*\s*(.+)", body)
            article_hit = re.search(r"### Reading Article\s*(.*?)(?=\n### Reading Comprehension)", body, re.S)
            comp_hit = re.search(r"### Reading Comprehension\s*(.*?)(?=\n### Vocabulary Practice)", body, re.S)
            vocab_hit = re.search(r"### Vocabulary Practice\s*(.*?)(?=\n---|\Z)", body, re.S)
            if not (article_hit and comp_hit and vocab_hit):
                raise ValueError(f"Incomplete reading set: {path.name} unit {unit}{letter}")
            article_id = f"rc-{level_id}-u{unit:02d}-{letter.lower()}"
            paragraphs = clean_article(article_hit.group(1), title, article_id)
            spoken_title = title if title.endswith((".", "?", "!")) else f"{title}."
            narration = f"{spoken_title}\n\n" + "\n\n".join(paragraphs)
            word_count = len(re.findall(r"[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*", narration))
            comprehension_text = clean_reading_exercise(comp_hit.group(1))
            vocabulary_text = clean_reading_exercise(vocab_hit.group(1))
            article = {
                "id": article_id,
                "levelId": level_id,
                "level": label,
                "unit": unit,
                "reading": letter,
                "title": title,
                "theme": plain(theme_hit.group(1)) if theme_hit else "",
                "paragraphs": paragraphs,
                "narration": narration,
                "narrationHash": hashlib.sha256(narration.encode()).hexdigest(),
                "wordCount": word_count,
                "readingMinutes": max(1, round(word_count / 180)),
                "comprehension": {
                    "id": f"{article_id}-comprehension",
                    "sourceText": join_lines(comprehension_text),
                    "questions": question_records(comprehension_text, f"{article_id}-c"),
                },
                "vocabulary": {
                    "id": f"{article_id}-vocabulary",
                    "sourceText": join_lines(vocabulary_text),
                    "questions": question_records(vocabulary_text, f"{article_id}-v"),
                },
                "audio": {"path": f"audio/readings/{article_id}.m4a"},
            }
            articles.append(article)
            all_articles.append(article)
        levels.append({"id": level_id, "label": label, "articles": [a["id"] for a in articles]})
    return {"schemaVersion": 1, "contentVersion": "1.09", "levels": levels, "articles": all_articles}


def middle_bundle() -> dict:
    grades = {}
    duplicates_skipped = 0
    rejected_records = 0
    for grade, filename in GRADE_FILES.items():
        sections = {}
        for section_id, folder in MIDDLE_SECTIONS:
            path = MIDDLE_ROOT / folder / filename
            source = path.read_text(encoding="utf-8")
            matches = list(re.finditer(r"^## (\d+)\s*$", source, re.M))
            records = []
            seen_records: set[str] = set()
            for i, match in enumerate(matches):
                end = matches[i + 1].start() if i + 1 < len(matches) else len(source)
                body = source[match.end():end].strip()
                body = re.sub(r"^Sources:\s*(?:\n- .+)+\s*", "", body, flags=re.M)
                raw_content = join_lines(body)
                if len(raw_content) < 20:
                    rejected_records += 1
                    continue
                number = int(match.group(1))
                record_id = f"ms-g{grade}-{section_id}-{number:03d}"
                questions = question_records(body, record_id)
                if not questions:
                    rejected_records += 1
                    continue
                learner_body = "" if section_id == "mcq" else re.split(r"^Answers?\s*:", body, maxsplit=1, flags=re.I | re.M)[0]
                learner_content = join_lines(learner_body)
                signature = hashlib.sha256(json.dumps({
                    "content": learner_content,
                    "questions": [(q["prompt"], [(c["id"], c["text"]) for c in q["choices"]]) for q in questions],
                }, ensure_ascii=False, sort_keys=True).encode()).hexdigest()
                if signature in seen_records:
                    duplicates_skipped += 1
                    continue
                seen_records.add(signature)
                records.append({
                    "id": record_id,
                    "number": number,
                    "title": f"Exercise {number:03d}",
                    "content": learner_content,
                    "questions": questions,
                    "graded": any(q["answer"] or q["answerText"] for q in questions),
                })
            sections[section_id] = records
        grades[grade] = sections
    return {
        "schemaVersion": 1,
        "contentVersion": "1.09",
        "grades": grades,
        "importAudit": {"duplicatesSkippedOrMerged": duplicates_skipped, "rejectedRecords": rejected_records},
    }


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def main() -> None:
    reading = reading_bundle()
    middle = middle_bundle()
    if len(reading["articles"]) != 144:
        raise SystemExit(f"Expected 144 articles, got {len(reading['articles'])}")
    write_json(ROOT / "reading-content.json", reading)
    write_json(ROOT / "middle-school.json", middle)
    print(f"reading articles: {len(reading['articles'])}")
    for level in reading["levels"]:
        print(f"  {level['label']}: {len(level['articles'])}")
    for grade, sections in middle["grades"].items():
        print("grade", grade, " ".join(f"{name}={len(rows)}" for name, rows in sections.items()))


if __name__ == "__main__":
    main()
