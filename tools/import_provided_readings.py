"""Restore three supplied textbook readings using visually checked page boundaries.

Run with the bundled Python (pypdf). Does not change the source PDFs or publish
the app bundle; emits a reviewable source-restoration file for the audit generator.
"""
import hashlib
import json
import re
import subprocess
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/petershen/Desktop')


def clean(text):
    # Standalone letters are printed paragraph labels, not narrative text.
    text = re.sub(r'(?m)^\s*[A-R]{1,3}\s*$', '', text)
    text = re.sub(r'(?m)^\s*\d*\s*Unit\s+\d+[AB]\s*\d*\s*$', '', text)
    text = re.sub(r'(?m)^\d{3}-\d{3}_.*$', '', text)
    text = re.sub(r'(?<=[A-Za-z])!(?=[A-Za-z0-9])', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'\s*—\s*', '—', text)
    return text.replace('self- sustaining', 'self-sustaining').replace('you’ d', 'you’d').replace('CO2', 'CO₂')


def between(text, start, end=None):
    assert text.count(start) == 1, start
    text = text[text.index(start):]
    if end:
        assert end in text, end
        text = text[:text.index(end)]
    return text


def paragraphs(text, starts):
    text = clean(text)
    positions = []
    for start in starts:
        positions.append(text.index(start, positions[-1] + 1 if positions else 0))
    assert positions == sorted(positions) and positions[0] == 0
    positions.append(len(text))
    return [text[a:b].strip() for a, b in zip(positions, positions[1:])]


def source(name, pages):
    path = SOURCE / name
    reader = PdfReader(path)
    return [p.extract_text() for p in reader.pages], {
        'file': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        'pdfPages': pages, 'review': 'Text extraction compared against rendered textbook pages.'}


def question(article, number, prompt, choices):
    return {'id': f'{article}-c-q{number:02}', 'number': str(number), 'prompt': prompt,
            'choices': [{'id': k, 'label': k.upper(), 'text': v} for k, v in choices.items()],
            'answer': None, 'answerText': None, 'explanation': None}


def figure(file, page, ident, title):
    directory = ROOT / 'reading-figures'
    directory.mkdir(exist_ok=True)
    prefix = directory / ident
    subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-singlefile',
                    '-scale-to', '2000', '-jpeg', '-jpegopt', 'quality=85',
                    str(SOURCE / file), str(prefix)], check=True)
    origin = {'source': file, 'pdfPage': page, 'operation': 'Direct PDF page rendering; not AI-generated.'}
    prefix.with_suffix('.source.json').write_text(json.dumps(origin, indent=2) + '\n')
    return {'id': ident, 'path': 'reading-figures/' + ident + '.jpg', 'title': title,
            'alt': title + ' — source textbook infographic. Open full size to inspect details.', 'source': origin}


def main():
    out = {'schemaVersion': 1, 'articles': {}}
    article = 'rc-level-3-u12-b'
    pages, provenance = source('re3 unit 12B.pdf', [1, 2, 5])
    text = between(pages[0], 'Although we have sent', 'THEULTIMATE') + ' ' + between(pages[1], 'a metal so rare', '1 When people mine')
    # Plain extraction of page 195 is left column then right column; the
    # "risked..." continuation is already after "merchants", unlike layout mode.
    ps = paragraphs(text, ['Although we have sent', 'Astronauts and supplies', 'Another company called',
                            'For centuries, economics', 'Entrepreneur Elon Musk', 'For Musk, creating'])
    ps = [p.replace('mine1', 'mine').replace('asteroids2', 'asteroids').replace('cargo3', 'cargo') for p in ps]
    assert len(ps) == 6 and ps[3].startswith('For centuries, economics has driven exploration. A thousand years ago, merchants risked')
    out['articles'][article] = {
        'source': provenance, 'paragraphs': ps,
        'answers': {
            '01': ['b', 'The opening says humans had not ventured more than 650 kilometres from Earth since 1973 at the time of this historical article.', [1]],
            '02': ['c', 'One refers to one of the precious metals; the next word identifies platinum.', [3]],
            '03': ['b', 'Energy here describes enthusiasm and economic motivation, not rocket fuel.', [3]],
            '04': ['a', 'The Silk Road and European voyages illustrate how economic incentives have driven exploration.', [4]],
            '05': ['d', 'Musk wants SpaceX to establish a human colony on Mars.', [6]],
            '06': ['f', 'The chart shows Apollo Moon missions continuing into the early 1970s.', []],
            '07': ['f', 'The first lunar landing is labelled Apollo 11, not Mercury.', []],
            '08': ['ng', 'The chart does not compare the total costs of the space programmes.', []],
            '09': ['t', 'Most mission-height bars remain below the low-Earth-orbit boundary.', []],
            '10': ['t', 'The first flight lasting over 100 days is labelled Salyut 6, a U.S.S.R. programme.', []],
            '11': ['t', 'In the 1995–2005 portion of the chart, the US mission bars outnumber those for the other individual countries.', []]},
        'prompts': {'01': 'According to this historical article, which statement about space exploration is NOT true?',
                    '02': 'In “One that the company hopes to find is platinum”, what does “One” refer to?',
                    '03': 'In “The energy we see now—the economic motivation to go into space”, what could replace “energy”?',
                    '04': 'What is the main idea of the paragraph beginning “For centuries, economics has driven exploration”?'},
        'choiceText': {'01': {'d': 'More and more private companies are beginning to explore space.'}},
        'additionalQuestions': [question(article, 5, 'What does SpaceX want to do?', {
            'a': 'build a space station that can replace the ISS',
            'b': 'get the government’s approval to transport astronauts to the ISS',
            'c': 'partner with Planetary Resources to mine asteroids for platinum',
            'd': 'send a manned spacecraft to Mars in order to colonize it'})],
        'figures': [figure('re3 unit 12B.pdf', 3, 're3-12b-missions-1', 'Charting the Missions · 1961–1990s'),
                    figure('re3 unit 12B.pdf', 4, 're3-12b-missions-2', 'Charting the Missions · 1990s–2008')],
        'evidenceFigures': {str(n).zfill(2): ['re3-12b-missions-1', 're3-12b-missions-2'] for n in range(6, 12)},
        'notes': ['Restored the complete A–F narrative and missing MCQ 5 from supplied PDF pages 194–195 and 198. Date-sensitive predictions remain historical source statements.',
                  'Restored the six infographic T/F/NG items with their actual two-page source chart, separate from the narrative.']}

    article = 'rc-level-5-u02-a'
    pages, provenance = source('re5 unit 2A.pdf', [2, 4, 5, 6, 7])
    p4 = between(pages[3], 'Today, the running world', '1 A role model') + ' ' + between(pages[3], 'Rai, however', 'Eastern Nepal is home')
    text = between(pages[1], 'Growing up in a village', '30Unit') + ' ' + p4 + ' ' + between(pages[4], 'chores at home', 'Unit 2A33') + ' ' + between(pages[5], 'Running has helped you see', '029-050_')
    ps = paragraphs(text, ['Growing up in a village', '“As a girl,”', 'Several years ago,', 'Today, the running world',
                           'Wasfia Nazreen,', '“It’s hard to find good role models', 'Rai, however,', 'Interviewer:',
                           'What advice do you have', 'You stopped going to school', 'Running has helped you see',
                           'What work are you doing', 'We have realized that Nepal', 'Is there a personal challenge'])
    ps = [p.replace('models1', 'models').replace('grit2', 'grit').replace('mindset3', 'mindset') for p in ps]
    assert len(ps) == 14 and '166 kilometers!' in ps[-1] and 'chores at home' in ps[7]
    out['articles'][article] = {
        'source': provenance, 'paragraphs': ps,
        'answers': {
            '01': ['b', 'The article traces a village girl’s journey to international racing and her support for others.', [1, 3, 4, 12, 13]],
            '02': ['b', 'By twelve she no longer attended school regularly; she did not first start school then.', [1, 10]],
            '03': ['c', 'Nazreen praises gender equality, encouraging runners and resilience; housing improvements are not attributed to Rai.', [6]],
            '04': ['a', 'Rai is describing the struggle of acting outside conventional expectations, especially for women.', [8]],
            '05': ['d', 'Long barefoot walks over difficult terrain with heavy loads are tiring.', [9]],
            '06': ['b', 'The added sentence comments on the difficult childhood walks before the answer moves on to professional training.', [9]],
            '07': ['c', 'The village account covers lighting, the annual festival visit and road access, but says nothing about improvements in village education.', [11]]},
        'prompts': {'03': 'In Nazreen’s description, what is NOT given as a reason that Rai is a good role model?',
                    '04': 'When Rai says “it becomes a struggle, not merely a challenge”, what is she referring to?',
                    '05': 'In Rai’s description of walking over “grueling terrain”, what does “grueling” mean?',
                    '06': 'Where should “It wasn’t much fun, but it definitely helped me develop my stamina” be inserted in Rai’s answer about becoming a stronger runner?'},
        'choiceText': {'03': {'a': 'She works to promote gender equality in her country.'}},
        'choices': {'06': {'a': 'After “It was a matter of chance and luck that I became a runner.”',
                           'b': 'After the sentence describing childhood walks with heavy loads.',
                           'c': 'After the sentence about professional training and determination.',
                           'd': 'After the sentence about diet, rest, confidence and support.'}},
        'additionalQuestions': [question(article, 7, 'Which question about Rai’s home village cannot be answered by information in the passage?', {
            'a': 'How did people light their homes there in the past?',
            'b': 'When does Mira Rai make her annual visit there?',
            'c': 'Has education in the village improved?',
            'd': 'How can people living there now get to other towns?'})],
        'notes': ['Restored all fourteen A–N paragraphs, including both the missing opening and missing final interview page; recovered MCQ 7. Removed captions, repeated page labels and footnotes from the narrative.']}

    article = 'rc-level-5-u05-a'
    pages, provenance = source('re5 unit 5A.pdf', [3, 4, 6, 8])
    p6 = between(pages[5], 'The Results', '  8  A') + ' ' + between(pages[5], 'Yet efficiency,', '095-116_')
    text = between(pages[2], 'Not long ago', '1 Kilo is') + ' ' + between(pages[3], 'Antarctica.', '98Unit') + ' ' + p6
    for heading in ['The Experiment', 'The Diagnosis', 'The Results', 'The Future']:
        text = text.replace(heading, '')
    ps = paragraphs(text, ['Not long ago,', 'We decided to try', 'The average U.S.', 'I checked with Tim',
                           'It seemed unlikely', 'To get a rough idea', 'We got some help', 'Our house,',
                           'Everywhere I looked,', '“You can go nuts', 'By the last week', 'Our numbers were',
                           'We can do more,', 'What we really wanted', 'Yet efficiency,', 'Not that there won’t',
                           'The rest of the world', 'Change starts at home'])
    for i, p in enumerate(ps):
        for original, replacement in [('kilos1', 'kilos'), ('points,2', 'points,'), ('flattering.3', 'flattering.'), ('seep4', 'seep'),
                                      ('spots5', 'spots'), ('nuts6', 'nuts'), ('agonize7', 'agonize'), ('outlays,8', 'outlays,'),
                                      ('guru9', 'guru'), ('up10', 'up')]:
            p = p.replace(original, replacement)
        ps[i] = p
    assert len(ps) == 18 and 'West Antarctica.' in ps[3] and '13 kilograms' in ps[4] and '32 kilograms' in ps[11]
    out['articles'][article] = {
        'source': provenance, 'paragraphs': ps,
        'answers': {'01': ['b', 'The central story is one family’s experiment in reducing its carbon emissions.', [1, 2, 11, 12]],
                    '02': ['c', 'The question asks what individuals can do about climate change.', [1]],
                    '03': ['a', 'The passage gives about 80 kg for a US household, more than twice the European average; 40 kg is the closest offered estimate.', [3]],
                    '04': ['d', '“It seemed unlikely to me, too” expresses the author’s initial lack of confidence.', [4, 5]],
                    '05': ['d', 'The cited study says standby electronics may account for up to 25 percent of the electricity bill.', [9]],
                    '07': ['d', 'The infographic gives 84.3 kg CO₂ per train passenger versus 75.3 kg per plane passenger; the plane is not highest.', []]},
        'prompts': {'01': 'Which is the best alternative title for this reading?',
                    '02': 'In “But what can we do about it as individuals?”, what does “it” refer to?',
                    '03': 'Which is the closest estimate offered for average daily European household CO₂ emissions in this historical passage?',
                    '04': 'How does the author initially feel about reducing his family’s CO₂ production by 80 percent?',
                    '05': 'What does the author say about electronics in standby mode?'},
        'choiceText': {'01': {'b': 'One Family’s Energy Diet'}},
        'choices': {'04': {'a': 'fairly agreeable to it', 'b': 'enthusiastic about it', 'c': 'not very interested in it', 'd': 'not confident about it'}},
        'excluded': {'06': 'The supplied textbook itself prints an 80 kg average, 13 kg target and 32 kg result alongside inconsistent half/double comparisons. Preserve the original figures but do not score this contradictory numerical paraphrase.'},
        'figures': [figure('re5 unit 5A.pdf', 7, 're5-5a-traveler', 'A Traveler’s Footprint')],
        'evidenceFigures': {'07': ['re5-5a-traveler']},
        'additionalQuestions': [question(article, 7, 'According to “A Traveler’s Footprint”, which statement about the journey from Toronto to New York is NOT true?', {
            'a': 'The longest journey is by train.', 'b': 'The passenger miles per gallon is higher for a train than an SUV.',
            'c': 'Driving an electric car is the most fuel efficient mode of transport.', 'd': 'The total CO₂ per passenger is highest on a plane.'})],
        'editorialNote': {'en': 'The original textbook contains inconsistent comparisons between its emissions figures. The figures are preserved here, but the conflicting numerical question is not scored.',
                          'zh': '原教材中部分排放数据的比较不一致。此处保留原始数字，但不对存在矛盾的数字题计分。'},
        'notes': ['Verified the numerical inconsistency against supplied PDF pages 97, 98, 100 and 102; it is not merely extraction damage. Original figures retained, Q6 withheld. Restored the two missing Q4 options and repaired paragraph/column order and CO₂ formatting.',
                  'Recovered the missing infographic question 7 and its supporting chart.']}

    target = ROOT / 'tools/reading-source-restorations.json'
    target.write_text(json.dumps(out, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: {'paragraphs': len(value['paragraphs']), 'keyed': len(value['answers']), 'source': value['source']['file']}
                      for key, value in out['articles'].items()}, indent=2))


if __name__ == '__main__':
    main()
