"""Index original textbook pages for editorial review; never certifies or publishes.

Uses the existing pypdf runtime. Candidate pages are retrieved by shared word
sequences, not assumed to prove completeness or answer correctness.
"""
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from pypdf import PdfReader
from apply_reading_answers import ROOT, apply, load_review


def grams(text):
    words = re.findall(r"[a-z]+", text.lower())
    return set(zip(words, words[1:], words[2:], words[3:]))


def mcq_blocks(text):
    """Candidate source blocks only: OCR and answers still need human review."""
    section = re.split(r'(?m)^B\.\s', text)[0]
    matches = list(re.finditer(r'(?m)^\s*(\d+)\.\s+', section))
    return {m[1].zfill(2): section[m.end():matches[i + 1].start() if i + 1 < len(matches) else len(section)].strip()
            for i, m in enumerate(matches)}


def main():
    sources = ROOT.parents[1] / 'Reference Material/Books/Reading Explorer Third Edition'
    cache = ROOT / '.impeccable/review/source-pages.json'
    cached = json.loads(cache.read_text()) if cache.exists() else {}
    books = {}
    for path in sorted(sources.glob('*.pdf')):
        level = re.search(r'Reading Explorer (Foundations|[1-5])', path.name)[1]
        key = 'foundation' if level == 'Foundations' else f'level-{level}'
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        books[key] = cached.get(key, {})
        if books[key].get('sha256') != digest:
            books[key] = {'file': str(path), 'sha256': digest,
                          'pages': [p.extract_text() or '' for p in PdfReader(path).pages]}
        print(key, len(books[key]['pages']), 'pages', flush=True)
    cache.write_text(json.dumps(books, ensure_ascii=False))
    articles, _, errors = apply(json.loads((ROOT / 'reading-content.json').read_text()), load_review())
    assert not errors, errors
    index = {}
    for level, book in books.items():
        index[level] = defaultdict(set)
        for page, text in enumerate(book['pages'], 1):
            for gram in grams(text):
                index[level][gram].add(page)
    rows = []
    questions = {}
    for level, book in books.items():
        # Printed footers can be OCR-spaced; review-skill callouts also name
        # OTHER units. Use the verified A/B book sequence, never those callouts.
        question_pages = [(page, text) for page, text in enumerate(book['pages'], 1)
                          if page >= 7 and 'READINGCOMPREHENSION' in re.sub(r'\s+', '', text)]
        assert len(question_pages) == 24, (level, 'source question-page sequence changed')
        for ordinal, (page, text) in enumerate(question_pages):
            ident = f'rc-{level}-u{ordinal // 2 + 1:02}-{"ab"[ordinal % 2]}'
            questions[ident] = {'page': page, 'blocks': mcq_blocks(text)}
    for article in articles['articles']:
        hits = Counter()
        for gram in grams(' '.join(article['paragraphs'])):
            hits.update(index[article['levelId']].get(gram, []))
        candidates = sorted(p for p, count in hits.items() if count >= 12)
        rows.append({'id': article['id'], 'title': article['title'],
                     'candidatePages': candidates, 'status': 'requires-editorial-verification',
                     'missingMainQuestionIds': sorted(set(questions.get(article['id'], {}).get('blocks', {}))
                        - {q['id'].rsplit('q', 1)[1] for q in article['comprehension']['questions']})})
    (cache.parent / 'source-page-candidates.json').write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')
    (cache.parent / 'source-question-candidates.json').write_text(json.dumps(questions, ensure_ascii=False, indent=2) + '\n')
    print('Indexed', len(rows), 'articles; no publication flags changed.')


if __name__ == '__main__':
    assert list(mcq_blocks('1. First?\na. One\nb. Two\n2. Next?\na. A\nb. B\nB. Summary')) == ['01', '02']
    main()
