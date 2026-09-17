#!/usr/bin/env python3
"""Rebuild learner-facing middle-school sections from the source exam files.

The v1.09 bundle was parsed from lossy consolidated Markdown. In particular,
underscores used for answer blanks were removed before JSON generation. This
tool treats the consolidated files as an index only and matches every app
question back to its named analysis/test source before publishing it.

Run one section at a time. A record is published only when every question in
that record is matched to source text and (for graded sections) has an answer.
Unresolved records are left out of the learner bundle and recorded in
middle-school-cleaning-audit.json.
"""

from __future__ import annotations

import argparse
import difflib
import json
import re
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path


PROJECT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path(
    "/Users/petershen/Desktop/Inspired Education/Beijing Middle School English/北京英语_整理版"
)
GRADE_NAMES = {"7": "七年级", "8": "八年级", "9": "九年级"}
SECTION_FOLDERS = {
    "mcq": "语法选择",
    "reading-a": "阅读理解_A",
    "reading-b": "阅读理解_B",
    "reading-c": "阅读理解_C",
    "reading-d": "阅读理解_D",
    "reading-e": "阅读理解_E",
    "reading-response": "阅读表达",
    "writing": "书面表达",
}

QUESTION_START = re.compile(
    r"(?m)^\s*(\d{1,2})(?:[.．、)]|\s+(?=[A-Z“”'‘’—_]))\s*"
)
OPTION = re.compile(r"(?:^|[\s\t])([A-Fa-f])[.．、)]\s*", re.M)
INLINE_ANSWER = re.compile(r"【答案】\s*([A-Fa-f])\b")
PLAIN_ANSWER = re.compile(r"(?im)^\s*(?:答案|Answers?)\s*[：:]\s*([A-Fa-f])\b")
SOURCE_LINE = re.compile(r"^- `(.+?)`\s*$", re.M)


@dataclass
class SourceQuestion:
    number: str
    prompt: str
    choices: list[dict]
    answer: str | None
    explanation: str | None
    source: str


def normalize(value: str) -> str:
    value = value.lower().replace("﹣", "-").replace("–", "-").replace("—", "-")
    value = re.sub(r"_+", " ", value)
    return re.sub(r"[^a-z0-9]+", "", value)


def clean_space(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\u200b", "")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\s*\n\s*", " ", value)
    value = re.sub(r"_{2,}", " ______ ", value)
    value = re.sub(r"\s+([,.;:?!])", r"\1", value)
    return value.strip()


def read_source(path: Path) -> str:
    if path.suffix.lower() in {".doc", ".docx"}:
        proc = subprocess.run(
            ["/usr/bin/textutil", "-convert", "txt", "-stdout", str(path)],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if proc.returncode == 0:
            return proc.stdout.decode("utf-8", errors="replace")
    if path.suffix.lower() == ".pdf":
        converter = shutil.which("pdftotext")
        if not converter:
            return ""
        proc = subprocess.run(
            [converter, "-layout", str(path), "-"],
            check=False,
            text=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if proc.returncode == 0:
            return proc.stdout
    return ""


def source_questions(text: str, source_name: str) -> list[SourceQuestion]:
    """Extract every answerable multiple-choice block in a source document.

    We deliberately scan the complete document. The consolidated record is
    then used to match the intended section, which is more reliable than the
    inconsistent Chinese section headings found across the source bank.
    """
    text = text.replace("\r", "\n")
    starts = list(QUESTION_START.finditer(text))
    out: list[SourceQuestion] = []
    for index, start in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(text)
        chunk = text[start.end():end]
        answer_hit = INLINE_ANSWER.search(chunk) or PLAIN_ANSWER.search(chunk)
        cuts = [hit.start() for hit in (
            answer_hit,
            re.search(r"【解析】|【详解】|【导语】", chunk),
        ) if hit]
        question_part = chunk[: min(cuts)] if cuts else chunk
        hits = list(OPTION.finditer(question_part))
        if not 2 <= len(hits) <= 6:
            continue
        prompt = clean_space(question_part[: hits[0].start()])
        if len(normalize(prompt)) < 2:
            continue
        choices = []
        for pos, hit in enumerate(hits):
            choice_end = hits[pos + 1].start() if pos + 1 < len(hits) else len(question_part)
            choice_text = clean_space(question_part[hit.end():choice_end])
            if not choice_text:
                choices = []
                break
            choices.append({
                "id": hit.group(1).lower(),
                "label": hit.group(1).upper(),
                "text": choice_text,
            })
        if len(choices) < 2 or len({row["id"] for row in choices}) != len(choices):
            continue
        answer = answer_hit.group(1).lower() if answer_hit else None
        if answer and answer not in {row["id"] for row in choices}:
            answer = None
        explanation = None
        if answer_hit:
            detail = re.search(r"【详解】\s*(.*)", chunk[answer_hit.end():], re.S)
            if detail:
                explanation = clean_space(detail.group(1)) or None
        out.append(SourceQuestion(
            number=start.group(1), prompt=prompt, choices=choices,
            answer=answer, explanation=explanation, source=source_name,
        ))
    return out


def indexed_records(path: Path) -> dict[int, dict]:
    text = path.read_text(encoding="utf-8")
    starts = list(re.finditer(r"(?m)^## (\d+)\s*$", text))
    records: dict[int, dict] = {}
    for index, start in enumerate(starts):
        end = starts[index + 1].start() if index + 1 < len(starts) else len(text)
        body = text[start.end():end].strip()
        sources = []
        for raw in SOURCE_LINE.findall(body):
            paper_fallback = raw.endswith(" [paper fallback]")
            name = re.sub(r"\s*\[paper fallback\]\s*$", "", raw)
            sources.append({"name": name, "paperFallback": paper_fallback})
        records[int(start.group(1))] = {
            "sources": sources,
            "body": body,
        }
    return records


def indexed_content(record: dict) -> str:
    """Return an index record without its provenance header."""
    body = record.get("body", "")
    body = re.sub(r"^Sources:\s*\n(?:- `.+?`\s*\n)+\s*", "", body)
    return body.strip()


def answer_map(body: str) -> dict[str, str]:
    match = re.search(r"(?im)^Answers?\s*:\s*", body)
    if not match:
        return {}
    tail = body[match.end():]
    hits = list(re.finditer(r"(?m)(?:^|\s)(\d{1,2})[.．、)]\s*", tail))
    answers: dict[str, str] = {}
    for pos, hit in enumerate(hits):
        end = hits[pos + 1].start() if pos + 1 < len(hits) else len(tail)
        value = clean_space(tail[hit.end():end]).strip("# ")
        if value:
            answers[hit.group(1)] = value
    return answers


def question_boundary(body: str, questions: list[dict]) -> int | None:
    """Find the first learner question, leaving only the passage before it."""
    before_answers = re.split(r"(?im)^Answers?\s*:", body, maxsplit=1)[0]
    candidates = []
    for question in questions[:3]:
        number = re.escape(str(question.get("number", "")))
        if not number:
            continue
        hit = re.search(rf"(?m)^\s*{number}[.．、)]\s*", before_answers)
        if hit:
            candidates.append(hit.start())
    if candidates:
        return min(candidates)
    if questions:
        needle = normalize(questions[0].get("prompt", ""))[:36]
        if needle:
            for hit in QUESTION_START.finditer(before_answers):
                if normalize(before_answers[hit.end():])[:36].startswith(needle[:24]):
                    return hit.start()
    return None


def clean_passage(value: str) -> str:
    value = value.replace("\r", "\n").strip()
    value = re.sub(r"\n{3,}", "\n\n", value)
    value = re.sub(r"[ \t]+\n", "\n", value)
    return value


def locate_sources(source_root: Path, grade: str, name: str, paper_fallback: bool = False) -> list[Path]:
    folders = ("全部试卷", "全部解析") if paper_fallback else ("全部解析", "全部试卷")
    found: list[Path] = []
    for subfolder in folders:
        exact = source_root / GRADE_NAMES[grade] / subfolder / name
        if exact.is_file():
            found.append(exact)
    # Consolidation sometimes records an alternate suffix after the base exam
    # filename. Prefer an exact stem prefix over a broad filesystem search.
    prefix = name.split("_解析", 1)[0].split("_试卷", 1)[0]
    for subfolder in folders:
        folder = source_root / GRADE_NAMES[grade] / subfolder
        matches = sorted(folder.glob(prefix + "*"))
        for path in matches:
            if path.suffix.lower() in {".doc", ".docx", ".pdf"} and path not in found:
                found.append(path)
    return found


def question_score(draft: dict, source: SourceQuestion) -> float:
    dp = normalize(draft.get("prompt", ""))
    sp = normalize(source.prompt)
    prompt_score = difflib.SequenceMatcher(None, dp, sp).ratio()
    dc = normalize(" ".join(row.get("text", "") for row in draft.get("choices", [])))
    sc = normalize(" ".join(row.get("text", "") for row in source.choices))
    choice_score = difflib.SequenceMatcher(None, dc, sc).ratio()
    number_bonus = 0.04 if str(draft.get("number")) == source.number else 0.0
    count_penalty = 0.08 * abs(len(draft.get("choices", [])) - len(source.choices))
    return 0.58 * prompt_score + 0.42 * choice_score + number_bonus - count_penalty


def clean_mcq(source_root: Path, bundle: dict) -> tuple[dict, dict]:
    audit = {"section": "mcq", "grades": {}, "records": []}
    question_cache: dict[Path, list[SourceQuestion]] = {}
    for grade, filename in {"7": "七年级.md", "8": "八年级.md", "9": "九年级.md"}.items():
        index_path = source_root / "AI提取_分类_含解析" / SECTION_FOLDERS["mcq"] / filename
        index = indexed_records(index_path)
        old_records = bundle["grades"][grade]["mcq"]
        published = []
        grade_stats = {"inputRecords": len(old_records), "approvedRecords": 0, "quarantinedRecords": 0,
                       "inputQuestions": 0, "matchedQuestions": 0, "unmatchedQuestions": 0,
                       "missingAnswers": 0}
        for record in old_records:
            number = int(record["number"])
            indexed = index.get(number, {"sources": [], "body": ""})
            candidates: list[SourceQuestion] = []
            missing_sources = []
            for source_ref in indexed["sources"]:
                source_name = source_ref["name"]
                paths = locate_sources(source_root, grade, source_name, source_ref["paperFallback"])
                if not paths:
                    missing_sources.append(source_name)
                    continue
                for path in paths:
                    if path not in question_cache:
                        question_cache[path] = source_questions(read_source(path), path.name)
                    candidates.extend(question_cache[path])
            cleaned_questions = []
            used: set[int] = set()
            problems = []
            grade_stats["inputQuestions"] += len(record["questions"])
            for draft in record["questions"]:
                ranked = sorted(
                    ((question_score(draft, candidate), pos, candidate)
                     for pos, candidate in enumerate(candidates) if pos not in used),
                    reverse=True,
                    key=lambda row: row[0],
                )
                if not ranked or ranked[0][0] < 0.72:
                    problems.append({"question": draft.get("id"), "reason": "no-source-match",
                                     "bestScore": round(ranked[0][0], 3) if ranked else None})
                    grade_stats["unmatchedQuestions"] += 1
                    continue
                score, pos, matched = ranked[0]
                used.add(pos)
                answer = matched.answer or draft.get("answer")
                if not answer or answer not in {row["id"] for row in matched.choices}:
                    problems.append({"question": draft.get("id"), "reason": "missing-answer",
                                     "source": matched.source, "matchScore": round(score, 3)})
                    grade_stats["missingAnswers"] += 1
                    continue
                cleaned_questions.append({
                    "id": draft["id"],
                    "number": matched.number,
                    "prompt": matched.prompt,
                    "choices": matched.choices,
                    "answer": answer,
                    "answerText": answer.upper(),
                    "explanation": matched.explanation,
                })
                grade_stats["matchedQuestions"] += 1
            # The v1.09 importer sometimes appended later sections to an MCQ
            # record. Source-matched questions are canonical; unmatched draft
            # questions are intentionally dropped instead of preserving the
            # contamination. Very small matches remain quarantined.
            complete_small_set = len(cleaned_questions) >= 2 and len(cleaned_questions) == len(record["questions"])
            status = "approved" if len(cleaned_questions) >= 6 or complete_small_set else "quarantined"
            audit["records"].append({
                "id": record["id"], "grade": grade, "number": number, "status": status,
                "sources": [row["name"] for row in indexed["sources"]], "missingSources": missing_sources,
                "inputQuestions": len(record["questions"]), "cleanedQuestions": len(cleaned_questions),
                "droppedDraftQuestions": len(record["questions"]) - len(cleaned_questions),
                "problems": problems,
            })
            if status == "approved":
                published.append({
                    **record,
                    "questions": cleaned_questions,
                    "graded": True,
                    "sources": [row["name"] for row in indexed["sources"]],
                    "auditStatus": "source-matched",
                })
                grade_stats["approvedRecords"] += 1
            else:
                grade_stats["quarantinedRecords"] += 1
        bundle["grades"][grade]["mcq"] = published
        audit["grades"][grade] = grade_stats
    return bundle, audit


def clean_reading(source_root: Path, bundle: dict, section: str) -> tuple[dict, dict]:
    audit = {"section": section, "grades": {}, "records": []}
    for grade, filename in {"7": "七年级.md", "8": "八年级.md", "9": "九年级.md"}.items():
        index_path = source_root / "AI提取_分类_含解析" / SECTION_FOLDERS[section] / filename
        index = indexed_records(index_path)
        old_records = bundle["grades"][grade].get(section, [])
        published = []
        stats = {"inputRecords": len(old_records), "approvedRecords": 0,
                 "quarantinedRecords": 0, "passagesSeparated": 0,
                 "questions": 0, "missingAnswers": 0}
        for record in old_records:
            source_record = index.get(int(record["number"]))
            problems = []
            body = indexed_content(source_record) if source_record else ""
            if not source_record:
                problems.append("missing-index-record")
            boundary = question_boundary(body, record.get("questions", [])) if body else None
            passage = clean_passage(body[:boundary]) if boundary is not None else ""
            if not passage or len(normalize(passage)) < 30:
                problems.append("question-boundary-not-found-or-short-passage")
            else:
                stats["passagesSeparated"] += 1
            source_candidates = source_questions(body, "consolidated-index") if body else []
            answers = answer_map(body)
            cleaned_questions = []
            for draft in record.get("questions", []):
                number = str(draft.get("number", ""))
                choices = draft.get("choices", [])
                prompt = clean_space(draft.get("prompt", ""))
                source_match = None
                ranked = sorted(((question_score(draft, candidate), candidate) for candidate in source_candidates),
                                key=lambda row: row[0], reverse=True)
                if ranked and ranked[0][0] >= 0.72:
                    source_match = ranked[0][1]
                    prompt, choices = source_match.prompt, source_match.choices
                raw_answer = answers.get(number, "")
                answer = (source_match.answer if source_match else None) or draft.get("answer")
                answer_text = draft.get("answerText")
                if raw_answer:
                    letter = re.match(r"\s*([A-Fa-f])(?:\b|[.．、)])", raw_answer)
                    if choices and letter:
                        answer = letter.group(1).lower()
                    elif not choices:
                        answer_text = raw_answer
                if choices and (not answer or answer not in {row["id"] for row in choices}):
                    stats["missingAnswers"] += 1
                    problems.append(f"missing-answer:{number}")
                choice_ids = [row.get("id") for row in choices]
                if choices and len(choice_ids) != len(set(choice_ids)):
                    problems.append(f"duplicate-choice-ids:{number}")
                if len(choices) > 5:
                    problems.append(f"implausible-choice-count:{number}")
                cleaned_questions.append({**draft, "number": number, "prompt": prompt, "choices": choices,
                                          "answer": answer, "answerText": answer_text,
                                          "explanation": source_match.explanation if source_match and source_match.explanation else draft.get("explanation")})
            stats["questions"] += len(cleaned_questions)
            status = "approved" if passage and not any(
                p.startswith(("missing-answer:", "duplicate-choice-ids:", "implausible-choice-count:"))
                for p in problems
            ) else "quarantined"
            audit["records"].append({"id": record["id"], "grade": grade, "number": record["number"],
                                     "status": status,
                                     "sources": [row["name"] for row in (source_record or {}).get("sources", [])],
                                     "passageCharacters": len(passage), "questions": len(cleaned_questions),
                                     "problems": problems})
            if status == "approved":
                published.append({**record, "content": passage, "questions": cleaned_questions,
                                  "sources": [row["name"] for row in source_record["sources"]],
                                  "auditStatus": "source-separated"})
                stats["approvedRecords"] += 1
            else:
                stats["quarantinedRecords"] += 1
        bundle["grades"][grade][section] = published
        audit["grades"][grade] = stats
    return bundle, audit


def clean_cloze(input_path: Path) -> tuple[list[dict], dict]:
    records = json.loads(input_path.read_text(encoding="utf-8"))
    starts = {"C7-eaf4835ac3": "“Are you listening, Simon”", "C8-f9a433e8f6": "May 17th, 2022",
              "C9-97e1dbf027": "Last Dance", "C9-045bc52592": "Meeting a polar bear",
              "C9-a6ac7147ac": "Anna’s Talent Show"}
    audit = {"section": "cloze", "records": [],
             "summary": {"inputRecords": len(records), "approvedRecords": 0,
                         "correctedBoundaries": 0, "quarantinedRecords": 0}}
    published = []
    for record in records:
        problems = []
        if record["id"] in starts:
            position = record.get("text", "").find(starts[record["id"]])
            if position < 0:
                problems.append("confirmed-boundary-not-found")
            else:
                record = {**record, "text": record["text"][position:].strip(),
                          "auditStatus": "source-boundary-corrected"}
                audit["summary"]["correctedBoundaries"] += 1
        expected = len(record.get("blanks", []))
        actual = len(re.findall(r"\{\{\d+\}\}", record.get("text", "")))
        invalid = [pos + 1 for pos, blank in enumerate(record.get("blanks", []))
                   if not isinstance(blank.get("key"), int) or blank["key"] >= len(blank.get("opts", []))]
        if expected != actual:
            problems.append(f"blank-count:{actual}/{expected}")
        if invalid:
            problems.append("invalid-keys:" + ",".join(map(str, invalid)))
        status = "approved" if not problems else "quarantined"
        audit["records"].append({"id": record["id"], "source": record.get("source"),
                                 "status": status, "problems": problems})
        if status == "approved":
            published.append(record)
            audit["summary"]["approvedRecords"] += 1
        else:
            audit["summary"]["quarantinedRecords"] += 1
    return published, audit


def future_content(source_root: Path) -> dict:
    output = {"schemaVersion": 1, "status": "future-only", "grades": {}, "quarantine": []}
    response_start = re.compile(
        r"(?m)^\s*(?:\((\d{1,2})\)|(\d{1,2})[.．、)])\s*"
        r"(?=(?:Who|What|When|Where|Why|How|Is|Are|Do|Does|Did|Would|Could|Can|Which)\b)", re.I
    )
    for grade, filename in {"7": "七年级.md", "8": "八年级.md", "9": "九年级.md"}.items():
        output["grades"][grade] = {"reading-response": [], "writing": []}
        for section in ("reading-response", "writing"):
            path = source_root / "AI提取_分类_含解析" / SECTION_FOLDERS[section] / filename
            for number, source_record in indexed_records(path).items():
                body = indexed_content(source_record)
                row = {"id": f"future-g{grade}-{section}-{number:03d}", "number": number,
                       "sources": [item["name"] for item in source_record["sources"]],
                       "auditStatus": "source-cleaned"}
                if section == "reading-response":
                    before_answers = re.split(r"(?im)^Answers?\s*:", body, maxsplit=1)[0]
                    hits = list(response_start.finditer(before_answers))
                    boundary = hits[0].start() if hits else None
                    row["content"] = clean_passage(body[:boundary] if boundary is not None else body)
                    row["questions"] = []
                    answers = answer_map(body)
                    if boundary is not None:
                        area = before_answers[boundary:]
                        qhits = list(response_start.finditer(area))
                        for pos, hit in enumerate(qhits):
                            end = qhits[pos + 1].start() if pos + 1 < len(qhits) else len(area)
                            qnumber = hit.group(1) or hit.group(2)
                            row["questions"].append({"number": qnumber,
                                                     "prompt": clean_space(area[hit.end():end]),
                                                     "sampleAnswers": answers.get(qnumber, "").split("##") if answers.get(qnumber) else []})
                    valid = bool(row["content"] and row["questions"])
                    reason = "missing-passage-or-question-boundary"
                else:
                    samples = list(re.finditer(r"(?im)^(?:Sample answer|Answers?)\s*:\s*", body))
                    valid = len(samples) == 1 and "\x07" not in body
                    sample = samples[0] if len(samples) == 1 else None
                    row["prompt"] = clean_passage(body[:sample.start()] if sample else body)
                    row["sampleAnswer"] = clean_passage(body[sample.end():]) if sample else None
                    valid = valid and bool(row["prompt"] and row["sampleAnswer"])
                    reason = "merged-or-malformed-writing-source"
                if valid:
                    output["grades"][grade][section].append(row)
                else:
                    output["quarantine"].append({"id": row["id"], "grade": grade, "section": section,
                                                 "sources": row["sources"], "reason": reason})
    return output


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--section", choices=["mcq", "cloze", "reading-a", "reading-b", "reading-c",
                                              "reading-d", "reading-e", "future"], required=True)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--input", type=Path, default=PROJECT / "middle-school.json")
    parser.add_argument("--output", type=Path, default=PROJECT / "middle-school.json")
    parser.add_argument("--audit", type=Path, default=PROJECT / "middle-school-cleaning-audit.json")
    parser.add_argument("--cloze", type=Path, default=PROJECT / "cloze.json")
    parser.add_argument("--future-output", type=Path, default=PROJECT / "middle-school-future.json")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    bundle = json.loads(args.input.read_text(encoding="utf-8"))
    if args.section == "mcq":
        bundle, section_audit = clean_mcq(args.source_root, bundle)
    elif args.section.startswith("reading-"):
        bundle, section_audit = clean_reading(args.source_root, bundle, args.section)
    elif args.section == "cloze":
        cloze, section_audit = clean_cloze(args.cloze)
    else:
        future = future_content(args.source_root)
        for grade in bundle["grades"].values():
            grade.pop("reading-response", None)
        section_audit = {"section": "future", "grades": {
            grade: {name: len(rows) for name, rows in sections.items()}
            for grade, sections in future["grades"].items()
        }, "quarantinedRecords": len(future["quarantine"])}

    if args.audit.exists():
        report = json.loads(args.audit.read_text(encoding="utf-8"))
    else:
        report = {"schemaVersion": 1, "sourceRoot": str(args.source_root), "sections": {}}
    report["sections"][args.section] = section_audit
    print(json.dumps(section_audit.get("grades", section_audit.get("summary", {})), ensure_ascii=False, indent=2))
    if not args.dry_run:
        if args.section in {"mcq", "reading-a", "reading-b", "reading-c", "reading-d", "reading-e"}:
            args.output.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        elif args.section == "cloze":
            args.cloze.write_text(json.dumps(cloze, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        else:
            args.future_output.write_text(json.dumps(future, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
            args.output.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        args.audit.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
