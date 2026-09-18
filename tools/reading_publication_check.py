"""Small regression check: complete answer counts must not bypass source blockers."""
import json
from pathlib import Path
from apply_reading_answers import apply, load_review, publication_blockers

review = {'articles': {'sample': {'notes': ['BLOCKER: missing source page']}}}
assert len(publication_blockers(review)) == 2
review['passageCleanupComplete'] = True
assert len(publication_blockers(review)) == 1
review['articles']['sample']['notes'] = ['Source restored and evidence rechecked.']
assert publication_blockers(review) == []
root = Path(__file__).resolve().parents[1]
result, reports, errors = apply(json.loads((root / 'reading-content.json').read_text()), load_review())
assert not errors, errors
articles = {a['id']: a for a in result['articles']}
space = articles['rc-level-3-u12-b']
runner = articles['rc-level-5-u02-a']
energy = articles['rc-level-5-u05-a']
assert len(space['paragraphs']) == 6 and space['paragraphs'][0].startswith('Although we have sent')
assert [q['answer'] for q in space['comprehension']['questions']] == ['b', 'c', 'b', 'a', 'd', 'f', 'f', 'ng', 't', 't', 't']
assert len(runner['paragraphs']) == 14 and '166 kilometers!' in runner['paragraphs'][-1]
assert [q['answer'] for q in runner['comprehension']['questions']] == ['b', 'b', 'c', 'a', 'd', 'b', 'c']
assert len(energy['paragraphs']) == 18
assert [q['answer'] for q in energy['comprehension']['questions']] == ['b', 'c', 'a', 'd', 'd', 'd']
for a in [space, energy]:
    for figure in a['figures']:
        assert (root / figure['path']).is_file()
assert '13 kilograms' in energy['paragraphs'][4] and '32 kilograms' in energy['paragraphs'][11]
for a in [space, runner, energy]:
    for p in a['paragraphs']:
        assert '.indd' not in p and 'BEFORE YOU READ' not in p
        assert not any(word in p for word in ['mine1', 'models1', 'grit2', 'kilos1', 'mindset3'])
elements = articles['rc-level-5-u10-b']
assert [q['answer'] for q in elements['comprehension']['questions']] == ['c', 'd', 'a', 'a', 'c', 'd']
text = ' '.join(elements['paragraphs'])
assert text.index('he wrote to Soviet leader') < text.index('For his part in the war effort') < text.index('By 1955') < text.index('Around the time that this new theory')
assert 'HALF/hyphen.capLIVES' not in text and 'Element 105 was named dubnium' in text
sultan = ' '.join(articles['rc-level-5-u11-a']['paragraphs'])
assert sultan.index('As a young man, the future sultan') < sultan.index('A revolt in Syria') < sultan.index('As success followed success')
assert sultan.index('Their descendants would look back') < sultan.index('THE SEARCH FOR THE LOST TOMB')
assert 'races and religions coexisted' in sultan and 'magnanimity, and justice' in sultan
assert 'it is rich in gold, in people' in sultan
moors = ' '.join(articles['rc-level-5-u11-b']['paragraphs'])
assert 'took fair-skinned Galician slaves' in moors
assert 'allowing his kingdom to fall' in moors
assert 'create the brilliant civilization' in moors
gold = articles['rc-level-5-u12-a']
assert [q['answer'] for q in gold['comprehension']['questions']] == ['b', 'd', 'c', 'b', 'b', 'c', 'b']
assert 'especially stressful' in ' '.join(gold['paragraphs'])
assert 'As if in tribute, she has hung' in ' '.join(gold['paragraphs'])
for article in result['articles']:
    for q in article['comprehension']['questions']:
        assert q['choices'] and q['answer'] in {c['id'] for c in q['choices']}
        assert q['evidenceParagraphs'] or q['evidenceFigures']
assert sum(len(a['comprehension']['questions']) for a in result['articles']) == 766
print('Reading publication gate checks passed.')
