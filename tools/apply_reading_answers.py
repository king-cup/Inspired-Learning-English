#!/usr/bin/env python3
"""Validate explicit editorial decisions; publish only after all articles reviewed.

No model/API calls and no answer inference. --check reports progress without edits.
Every existing comprehension question must be answered or explicitly excluded.
The resulting audit preserves excluded questions in full for subsequent repair.
"""
import argparse
import copy
import hashlib
import json
import re
import subprocess
from pathlib import Path
from reading_passage_cleanup import cleanup, typography

ROOT = Path(__file__).resolve().parents[1]


def load_source():
    data = json.loads((ROOT / 'reading-content.json').read_text())
    if data.get('answerAuditVersion'):
        # Keep the audit reproducible after publication without duplicating the corpus.
        scope = json.loads((ROOT / 'tools/reading-release-scope.json').read_text())
        data = json.loads(subprocess.check_output(['git', 'show', scope['inputCommit'] + ':reading-content.json'], cwd=ROOT))
    return data


def load_review():
    review = json.loads((ROOT / 'tools/reading-answer-review.json').read_text())
    restorations = ROOT / 'tools/reading-source-restorations.json'
    if restorations.exists():
        # A full source restoration replaces that article's earlier decisions:
        # old paragraph indices and missing-source exclusions must not leak in.
        review['articles'].update(json.loads(restorations.read_text())['articles'])
    followup = ROOT / 'tools/reading-source-followup.json'
    if followup.exists():
        for ident, update in json.loads(followup.read_text())['articles'].items():
            decision = review['articles'][ident]
            for key, value in update.items():
                if isinstance(value, dict):
                    decision.setdefault(key, {}).update(value)
                elif isinstance(value, list):
                    decision.setdefault(key, []).extend(value)
                else:
                    decision[key] = value
    scope_path = ROOT / 'tools/reading-release-scope.json'
    if scope_path.exists():
        scope = json.loads(scope_path.read_text())
        review['passageCleanupComplete'] = scope['passageCleanupComplete']
        for ident, record in scope['articles'].items():
            decision = review['articles'][ident]
            decision['figures'] = []
            for number, reason in record.get('withheld', {}).items():
                decision.get('answers', {}).pop(number, None)
                decision.get('additionalAnswers', {}).pop(number, None)
                decision.setdefault('excluded', {})[number] = reason
            decision.setdefault('textRepairs', []).extend(record.get('textRepairs', []))
            if record.get('omitExtraParagraphs'):
                decision['extraParagraphs'] = []
            decision['sourceVerification'] = record
    return review


def publication_blockers(review):
    """Answer coverage alone cannot certify that the extracted passages are clean."""
    blockers = [f'{article_id}: {note}'
                for article_id, decision in review['articles'].items()
                for note in decision.get('notes', []) if note.startswith('BLOCKER:')]
    if review.get('passageCleanupComplete') is not True:
        blockers.append('Final passage cleanup and evidence-location recheck are not complete.')
    return blockers


def apply(data, review):
    result = copy.deepcopy(data)
    reports = []
    errors = []
    for article in result['articles']:
        decision = review['articles'].get(article['id'])
        if not decision:
            continue
        original = copy.deepcopy(article)
        if 'paragraphs' in decision:
            article['paragraphs'] = list(decision['paragraphs'])
        article['figures'] = copy.deepcopy(decision.get('figures', []))
        if decision.get('editorialNote'):
            article['editorialNote'] = decision['editorialNote']
        paragraphs = article['paragraphs']
        for number, value in decision.get('replaceParagraph', {}).items():
            paragraphs[int(number) - 1] = value
        for number, value in decision.get('prependParagraph', {}).items():
            paragraphs[int(number) - 1] = value + paragraphs[int(number) - 1]
        for number, value in decision.get('appendParagraph', {}).items():
            paragraphs[int(number) - 1] += value
        paragraphs.extend(decision.get('extraParagraphs', []))
        paragraphs, origin_map = cleanup(article['id'], paragraphs, decision.get('textRepairs', []))
        article['paragraphs'] = paragraphs
        article['wordCount'] = len(re.findall(r"\b[\w]+(?:['’-][\w]+)*\b", ' '.join(paragraphs)))
        article['readingMinutes'] = max(1, round(article['wordCount'] / 180))
        kept, excluded = [], []
        answers = decision.get('answers', {}) | decision.get('additionalAnswers', {})
        article['comprehension']['questions'].extend(copy.deepcopy(decision.get('additionalQuestions', [])))
        article['comprehension']['questions'].sort(key=lambda q: q['id'])
        question_ids = [q['id'] for q in article['comprehension']['questions']]
        if len(question_ids) != len(set(question_ids)):
            errors.append(f"{article['id']}: duplicate question IDs")
        question_numbers = {q['id'].rsplit('q', 1)[1] for q in article['comprehension']['questions']}
        for number in set(answers) - question_numbers:
            errors.append(f"{article['id']}: decision for nonexistent question {number}")
        for q in article['comprehension']['questions']:
            number = q['id'].rsplit('q', 1)[1]
            answer = answers.get(number)
            if not answer:
                reason = decision.get('excluded', {}).get(number) or decision.get('excludeRemaining')
                if not reason:
                    errors.append(f"{q['id']}: missing answer or exclusion decision")
                excluded.append({'question': copy.deepcopy(q), 'reason': reason})
                continue
            q['prompt'] = decision.get('prompts', {}).get(number, q['prompt'])
            if number in decision.get('choices', {}):
                q['choices'] = [{'id': key, 'label': key.upper(), 'text': value} for key, value in decision['choices'][number].items()]
            elif number in decision.get('sharedChoiceQuestions', []):
                q['choices'] = [{'id': key, 'label': key.upper(), 'text': value} for key, value in decision['sharedChoices'].items()]
            tf = re.search(r'\bT\s+F(?:\s+NG)?\b', q['prompt'])
            if not q['choices'] and tf:
                has_ng = 'NG' in tf.group()
                # OCR sometimes inserts T/F/NG in the middle of the statement.
                prompt = q['prompt'][:tf.start()] + ' ' + q['prompt'][tf.end():]
                prompt = re.split(r'\b(?:GIST|MAIN IDEA|PURPOSE|DETAIL|VOCABULARY|REFERENCE|INFERENCE|EVALUATING STATEMENTS)\b', prompt)[0]
                q['prompt'] = re.sub(r'\s+', ' ', prompt).strip()
                q['type'] = 'true-false-not-given' if has_ng else 'true-false'
                q['choices'] = [{'id': key, 'label': label, 'text': text}
                                for key, label, text in [('t', 'T', 'True'), ('f', 'F', 'False')] +
                                ([('ng', 'NG', 'Not Given')] if has_ng else [])]
            else:
                q['type'] = 'multiple-choice'
            for choice in q['choices']:
                choice['text'] = typography(decision.get('choiceText', {}).get(number, {}).get(choice['id'], choice['text']))
            q['prompt'] = typography(q['prompt'])
            # These three surviving references point to the printed layout,
            # whose paragraph letters do not match the app's clean paragraphs.
            if q['id'] == 'rc-level-3-u06-a-c-q04':
                q['prompt'] = q['prompt'].replace(' from paragraph G', '')
            elif q['id'] == 'rc-level-4-u05-b-c-q02':
                q['prompt'] = "Who does the phrase 'these amazing voyagers' refer to?"
            elif q['id'] == 'rc-level-4-u06-b-c-q02':
                q['prompt'] = 'Which statement describes the gold and silver Bitcoin images mentioned in the article?'
            key, explanation, evidence = answer
            if any(old not in origin_map for old in evidence):
                errors.append(f"{q['id']}: cleanup removed cited evidence; editorial recheck required")
            evidence = sorted({new for old in evidence for new in origin_map.get(old, [])})
            figure_evidence = decision.get('evidenceFigures', {}).get(number, [])
            if not q['choices'] or key not in {c['id'] for c in q['choices']}:
                errors.append(f"{q['id']}: answer {key} has no selectable choice")
            if not explanation or not (evidence or figure_evidence) or any(p < 1 or p > len(paragraphs) for p in evidence):
                errors.append(f"{q['id']}: missing/invalid passage evidence")
            if any(ident not in {f['id'] for f in article['figures']} for ident in figure_evidence):
                errors.append(f"{q['id']}: missing source figure")
            q.update(answer=key, answerText=None, explanation=explanation,
                     evidenceParagraphs=evidence, evidenceFigures=figure_evidence, answerProvenance='passage-reviewed-generated')
            kept.append(q)
        article['comprehension'].update(questions=kept, instructions='Choose the best answer. For statement questions, select True, False, or Not Given when offered.')
        source_review = decision.get('sourceVerification', {})
        kept_numbers = {q['id'].rsplit('q', 1)[1] for q in kept}
        for number in source_review.get('mainQuestionNumbers', []):
            if number not in kept_numbers and number not in source_review.get('withheld', {}):
                errors.append(f"{article['id']}: source question {number} has no release decision")
        article['answerAuditVersion'] = 1
        reports.append({'id': article['id'], 'title': article['title'], 'keyed': len(kept),
                        'excluded': excluded, 'notes': decision.get('notes', []),
                        'passageChanged': original['paragraphs'] != paragraphs,
                        'sourceRestoration': decision.get('source'),
                        'sourceVerification': decision.get('sourceVerification'),
                        'recoveredQuestions': len(decision.get('additionalQuestions', [])),
                        'sourceSHA256': hashlib.sha256(json.dumps(original, ensure_ascii=False, sort_keys=True).encode()).hexdigest()})
    return result, reports, errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--preview', action='store_true', help='Write an explicitly non-published draft under .impeccable/review for local QA only.')
    args = parser.parse_args()
    data = load_source()
    review = load_review()
    result, reports, errors = apply(data, review)
    pending = [a['id'] for a in data['articles'] if a['id'] not in review['articles']]
    summary = {'reviewed': len(reports), 'total': len(data['articles']),
               'keyed': sum(r['keyed'] for r in reports),
               'excluded': sum(len(r['excluded']) for r in reports),
               'recoveredQuestions': sum(r['recoveredQuestions'] for r in reports),
               'pendingArticles': pending, 'errors': errors,
               'publicationBlockers': publication_blockers(review)}
    print(json.dumps(summary, indent=2))
    if errors:
        raise SystemExit(1)
    if args.check:
        return
    if args.preview:
        preview = ROOT / '.impeccable/review'
        preview.mkdir(parents=True, exist_ok=True)
        result['editorialDraft'] = True
        (preview / 'reading-content-draft.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
        (preview / 'reading-audit-draft.json').write_text(json.dumps({'summary': summary, 'articles': reports}, ensure_ascii=False, indent=2) + '\n')
        return
    if pending:
        raise SystemExit('Refusing partial publication: finish every article review first.')
    if summary['publicationBlockers']:
        raise SystemExit('Refusing publication: resolve the source blockers and finish passage cleanup first.')
    result['answerAuditVersion'] = 1
    (ROOT / 'reading-content.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    (ROOT / 'reading-answer-audit.json').write_text(json.dumps({'summary': summary, 'articles': reports}, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()
