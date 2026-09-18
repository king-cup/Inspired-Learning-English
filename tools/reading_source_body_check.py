"""Read-only retrieval aid: compare textbook body-font text with the draft.

This is NOT editorial sign-off. Font filtering can omit non-body-font sidebars;
page order and any reported gaps must still be checked against original pages.
"""
import json
import re
from pathlib import Path
import pdfplumber
from apply_reading_answers import ROOT, apply, load_source, load_review


def normalized(text):
    return re.sub(r'[^a-z0-9]', '', text.lower())


def missing_runs(source, target):
    words = source.split()
    missing = []
    for start in range(0, len(words) - 7, 8):
        part = ' '.join(words[start:start + 8])
        if normalized(part) not in target:
            missing.append(part)
    return missing


def main():
    directory = ROOT / '.impeccable/review'
    books = json.loads((directory / 'source-pages.json').read_text())
    candidates = {r['id']: r for r in json.loads((directory / 'source-page-candidates.json').read_text())}
    cache_path = directory / 'source-body-pages.json'
    cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
    data, _, errors = apply(load_source(), load_review())
    assert not errors, errors
    for level, book in books.items():
        if cache.get(level, {}).get('sha256') == book['sha256']:
            continue
        selected = sorted({p for a in data['articles'] if a['levelId'] == level
                           for p in candidates[a['id']]['candidatePages'] if p >= 7})
        pages = {}
        with pdfplumber.open(book['file']) as pdf:
            for number in selected:
                page = pdf.pages[number - 1]
                body = page.filter(lambda char: char.get('object_type') == 'char'
                                   and 'Palatino' in char.get('fontname', '')
                                   and 10 <= char.get('size', 0) <= 13)
                pages[str(number)] = body.dedupe_chars(tolerance=0.8).extract_text(use_text_flow=True) or ''
                page.close()
        cache[level] = {'sha256': book['sha256'], 'pages': pages}
        cache_path.write_text(json.dumps(cache, ensure_ascii=False))
        print(level, len(pages), 'body pages extracted', flush=True)
    reports = []
    for article in data['articles']:
        source = '\n'.join(cache[article['levelId']]['pages'].get(str(p), '') for p in candidates[article['id']]['candidatePages'])
        passage = ' '.join(article['paragraphs'])
        reports.append({'id': article['id'], 'sourceNotMatched': missing_runs(source, normalized(passage)),
                        'draftNotMatched': missing_runs(passage, normalized(source)),
                        'status': 'retrieval-only-not-signoff'})
    (directory / 'source-body-differences.json').write_text(json.dumps(reports, ensure_ascii=False, indent=2) + '\n')
    print('Compared', len(reports), 'articles; no publication flags changed.')


if __name__ == '__main__':
    assert normalized('word-\nwrap') == normalized('wordwrap')
    assert missing_runs('one two three four five six seven eight nine', 'different')
    main()
