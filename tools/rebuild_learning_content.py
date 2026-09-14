#!/usr/bin/env python3
"""Rebuild the cloze, HSE vocabulary, and selectable-answer practice data.

Published cloze keys are preserved by matching passage text and the known
correct answer in every blank. New question-only extracts use a provenance-
tracked key manifest; a passage can never enter the student pool without a
complete key.

HSE worksheet keys for packages 1–7 were checked against the authored papers.
Package 8's authoritative key is parsed from its adjacent answer-key Markdown.
Written-response sections are never emitted.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import html
import json
import re
import unicodedata
from pathlib import Path


CLOZE_ROOT = Path('/Users/pshen2p/Desktop/Inspired Education/Beijing Middle School English/北京英语_整理版')
HSE_ROOT = Path('/Users/pshen2p/Documents/Obsidian Notes/Teaching Vault/Generated Materials/Vocab Worksheets/Beijing High School')
ANSWER_KEYS = Path(__file__).with_name('cloze-answer-keys.json')


KEYS = {
    1: list('BDACBDCABCBACBD'),
    2: list('BCBACABABCADCAA'),
    3: list('BCABCBDBACBDCBB'),
    4: [
        # Definitions 1–44 (item 2 is omitted below: its authored answer is absent).
        *list('ABCBABACACCBBCADBCBCACABCABABCBDACBDCCCACBCB'),
        # Sentence Completion 45–60.
        *list('ACBDBBCBBCDDABCB'),
        # Same Meaning 61–74.
        *list('DCDBBBCBADADBA'),
    ],
    5: [
        *list('BCBCCCDCDDDACDBCDCDBDBDCBCDCBDBACDDD'),
        *list('BBCBDBCCACDCCB'),
        *list('AADADBDBACBB'),
        *list('DCBADCDAADCC'),
    ],
    6: [
        *list('ABADABDACDDBDCBDDCBADBCADBDBADBDDDCB'),
        *list('CABDABCBAABACDBCA'),
        *list('ADCCADAABCDD'),
        *list('DBADDCBCDBAA'),
    ],
    7: [
        *list('ACBACBACDCADCBCCBCABCDCADBCACACACACABCABABDBABADACACACDB'),
        *list('CDCACBACDBACBCBCDCABADCDBACDCA'),
        *list('ACDACABCADCAAA'),
        *list('BACABCDCDBDC'),
    ],
}


def plain(markup: str) -> str:
    text = re.sub(r'<[^>]+>', ' ', markup)
    return re.sub(r'\s+', ' ', html.unescape(text)).strip()


def normalized(text: str) -> str:
    value = unicodedata.normalize('NFKC', text).lower()
    value = re.sub(r'\{\{\d+\}\}|___\d+___', ' ', value)
    return re.sub(r'[^a-z0-9]+', '', value)


def parse_cloze_markdown(path: Path, grade: str) -> list[dict]:
    source = path.read_text(encoding='utf-8')
    passages = []
    pattern = r'^## Cloze (\d+)\s*$([\s\S]*?)(?=^## Cloze \d+\s*$|\Z)'
    for match in re.finditer(pattern, source, re.MULTILINE):
        number, body = int(match.group(1)), match.group(2)
        source_match = re.search(r'^Source:\s*\n([\s\S]*?)\n### Passage\s*\n', body, re.MULTILINE)
        passage_match = re.search(r'^### Passage\s*\n([\s\S]*?)\n### Questions\s*\n', body, re.MULTILINE)
        questions_match = re.search(r'^### Questions\s*\n([\s\S]*)$', body, re.MULTILINE)
        if not (source_match and passage_match and questions_match):
            continue
        sources = re.findall(r'^- `([^`]+)`', source_match.group(1), re.MULTILINE)
        qmap = {}
        qpattern = r'^(\d+)\.\s*\n((?:- [A-D]\. .*\n?)+)'
        for question in re.finditer(qpattern, questions_match.group(1), re.MULTILINE):
            opts = [item[1].strip() for item in re.findall(r'^- ([A-D])\. (.*)$', question.group(2), re.MULTILINE)]
            qmap[int(question.group(1))] = opts
        text = passage_match.group(1).strip()
        blank_numbers = [int(value) for value in re.findall(r'___(\d+)___', text)]
        if not blank_numbers or not all(number in qmap for number in blank_numbers):
            continue
        inline = dict(re.findall(r'___(\d+)___\s*([A-D])(?=\s|[.,，。!?])', text))
        inline_answers = ''.join(inline.get(str(value), '') for value in blank_numbers)
        if len(inline_answers) != len(blank_numbers):
            inline_answers = ''
        # Some source documents contain both the student paper and a solved
        # teacher copy. The Markdown importer retained the inserted answer
        # letters in the latter. Strip them and merge the two copies below.
        text = re.sub(
            r'(___\d+___)\s*[A-D](?=\s|[.,，。!?])', r'\1', text
        )
        passages.append({
            'number': number,
            'grade': grade,
            'sources': sources,
            'text': text,
            'options': [qmap[value] for value in blank_numbers],
            'signature': normalized(text),
            'inlineAnswers': inline_answers,
        })
    return passages


def source_metadata(source_name: str) -> dict[str, str]:
    parts = source_name.split('_')
    return {
        'year': parts[1] if len(parts) > 1 else '',
        'term': parts[2] if len(parts) > 2 else '',
        'area': parts[3] if len(parts) > 3 else '',
    }


def source_key(candidate: dict) -> str:
    return f'{candidate["grade"]}:{candidate["number"]:03d}'


def generated_id(candidate: dict) -> str:
    grade = {'七年级': '7', '八年级': '8', '九年级': '9'}[candidate['grade']]
    digest = hashlib.sha256(candidate['signature'].encode()).hexdigest()[:10]
    return f'C{grade}-{digest}'


def rebuild_cloze(target: Path) -> tuple[int, float, dict[str, str]]:
    current = json.loads(target.read_text(encoding='utf-8'))
    source = []
    for grade in ('七年级', '八年级', '九年级'):
        source.extend(parse_cloze_markdown(CLOZE_ROOT / f'完形填空_{grade}.md', grade))

    unique_source = {}
    for candidate in source:
        identity = (candidate['grade'], candidate['signature'],
                    tuple(tuple(option.strip().casefold() for option in choices)
                          for choices in candidate['options']))
        if identity not in unique_source:
            unique_source[identity] = candidate
            continue
        canonical = unique_source[identity]
        canonical['sources'] = list(dict.fromkeys(canonical['sources'] + candidate['sources']))
        if candidate['inlineAnswers']:
            if canonical['inlineAnswers'] and canonical['inlineAnswers'] != candidate['inlineAnswers']:
                raise RuntimeError(f'Conflicting inline keys for {source_key(canonical)}')
            canonical['inlineAnswers'] = candidate['inlineAnswers']
    source = list(unique_source.values())

    key_manifest = json.loads(ANSWER_KEYS.read_text(encoding='utf-8')) if ANSWER_KEYS.exists() else {}
    manifest_answers = key_manifest.get('answers', {})
    manifest_evidence = key_manifest.get('evidence', {})
    lowest_score = 1.0
    matched: dict[int, list[tuple[dict, list[int]]]] = {}
    for passage in current:
        lines = passage['text'].splitlines()
        old_body = '\n'.join(lines[1:]) if len(lines) > 1 and lines[0].strip() == passage.get('title', '').strip() else passage['text']
        answers = [blank['opts'][blank['key']].strip().casefold() for blank in passage['blanks']]
        candidates = []
        for candidate in source:
            if candidate['grade'] != passage['grade'] or len(candidate['options']) != len(answers):
                continue
            if not all(any(answer == option.strip().casefold() for option in options)
                       for answer, options in zip(answers, candidate['options'])):
                continue
            score = difflib.SequenceMatcher(
                None, normalized(old_body), candidate['signature'], autojunk=False
            ).ratio()
            candidates.append((score, candidate))
        if not candidates:
            raise RuntimeError(f'No safe source match for {passage["id"]}')
        score, candidate = max(candidates, key=lambda item: item[0])
        if score < .95:
            raise RuntimeError(f'Unsafe source match for {passage["id"]}: {score:.3f}')
        lowest_score = min(lowest_score, score)
        candidate_index = source.index(candidate)
        keys = [next(index for index, option in enumerate(options) if option.strip().casefold() == correct)
                for correct, options in zip(answers, candidate['options'])]
        matched.setdefault(candidate_index, []).append((passage, keys))

    rebuilt = []
    aliases = {}
    for candidate_index, candidate in enumerate(source):
        known = matched.get(candidate_index, [])
        if known:
            canonical, keys = known[0]
            for duplicate, _ in known[1:]:
                aliases[duplicate['id']] = canonical['id']
            blank_extras = canonical['blanks']
            answer_source = canonical.get('answerSource', 'published-source')
        else:
            letters = candidate['inlineAnswers'] or manifest_answers.get(source_key(candidate), '')
            if len(letters) != len(candidate['options']) or any(letter not in 'ABCD' for letter in letters):
                raise RuntimeError(f'Missing reviewed answer key for {source_key(candidate)}')
            canonical = {'id': generated_id(candidate)}
            keys = ['ABCD'.index(letter) for letter in letters]
            blank_extras = [{} for _ in keys]
            evidence = manifest_evidence.get(source_key(candidate), [])
            answer_source = ('teacher-copy'
                             if candidate['inlineAnswers'] else
                             ('model-assisted' if any('Qwen' in item for item in evidence)
                              else 'solution-document'))

        new_blanks = [
            {**extra, 'opts': options, 'key': key}
            for extra, options, key in zip(blank_extras, candidate['options'], keys)
        ]
        counter = iter(range(1, len(new_blanks) + 1))
        new_text = re.sub(r'___\d+___', lambda _: '{{' + str(next(counter)) + '}}', candidate['text'])
        source_name = candidate['sources'][0] if candidate['sources'] else canonical['id']
        rebuilt.append({
            **canonical,
            **source_metadata(source_name),
            'number': candidate['number'],
            'grade': candidate['grade'],
            'title': re.sub(r'\.(?:docx?|pdf)$', '', source_name, flags=re.IGNORECASE),
            'source': source_name,
            'sources': candidate['sources'],
            'text': new_text,
            'blanks': new_blanks,
            'answerSource': answer_source,
        })

    if len(rebuilt) != len(source) or len({item['id'] for item in rebuilt}) != len(rebuilt):
        raise RuntimeError('Cloze rebuild did not produce one unique record per source passage')
    target.write_text(json.dumps(rebuilt, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    return len(rebuilt), lowest_score, aliases


def section_for(package: int, source: str, position: int) -> str:
    # Include the heading delimiter so "Part II" does not also match the
    # beginning of "Part III". That prefix collision previously grouped every
    # sentence-completion item into Definitions.
    labels = [('Part II', source.rfind('Part II &middot;', 0, position)),
              ('Part III', source.rfind('Part III &middot;', 0, position)),
              ('Part IV', source.rfind('Part IV &middot;', 0, position)),
              ('Part V', source.rfind('Part V &middot;', 0, position))]
    part = max(labels, key=lambda item: item[1])[0]
    if package <= 3 and part == 'Part II':
        return 'Cloze Reading'
    return {
        'Part II': 'Definitions',
        'Part III': 'Sentence Completion',
        'Part IV': 'Same Meaning, Different Words',
        'Part V': 'Which Sense?',
    }[part]


def parse_package_1_to_7(package: int) -> list[dict]:
    path = HSE_ROOT / f'Package {package}' / f'High School Vocab Package {package}.html'
    source = path.read_text(encoding='utf-8')
    questions = []
    qpattern = r'<div class="q(?:-full)?"><div class="stem">(.*?)</div><div class="opts">(.*?)</div></div>'
    for match in re.finditer(qpattern, source, re.DOTALL):
        stem = plain(match.group(1))
        number_match = re.match(r'(\d+)\.\s*(.*)', stem)
        if not number_match:
            continue
        number = int(number_match.group(1))
        stem = number_match.group(2).strip()
        options = [plain(value) for value in re.findall(
            r'<(?:span|div)><b>\([a-d]\)</b>\s*(.*?)(?:</(?:span|div)>|$)', match.group(2), re.DOTALL
        )]
        if len(options) < 2:
            continue
        section = section_for(package, source, match.start())
        if section not in {'Cloze Reading', 'Definitions', 'Sentence Completion', 'Same Meaning, Different Words', 'Which Sense?'}:
            continue
        if number > len(KEYS[package]):
            raise RuntimeError(f'Package {package} has an unkeyed item {number}')
        if package == 4 and number == 2:
            continue
        questions.append({
            'id': f'P{package}-{number:03d}',
            'sourceTitle': f'High School Vocab Package {package}',
            'section': section,
            'stem': stem,
            'options': options,
            'key': ord(KEYS[package][number - 1]) - ord('A'),
        })

    if package <= 3:
        part = source[source.find('Part II'):source.find('Part III')]
        title_match = re.search(r'<h3>(.*?)</h3>', part, re.DOTALL)
        passage_match = re.search(r'<div class="article">(.*?)</div>\s*<div class="clozegrid">', part, re.DOTALL)
        if not passage_match:
            raise RuntimeError(f'Package {package} cloze passage was not found')
        passage_markup = re.sub(r'<h3>.*?</h3>|<div class="deck">.*?</div>', '', passage_match.group(1), flags=re.DOTALL)
        passage_markup = re.sub(
            r'<span class="blk">(\d+)</span>', lambda match: f'[{match.group(1)}]', passage_markup
        )
        context = plain(passage_markup)
        for question in questions:
            number = int(question['id'].split('-')[-1])
            question['stem'] = f'Choose the best word for blank {number}.'
            question['context'] = context
            if title_match:
                question['sourceTitle'] = plain(title_match.group(1))
    return questions


def parse_package_8() -> list[dict]:
    package = 8
    html_path = HSE_ROOT / 'Package 8' / 'High School Vocab Package 8.html'
    key_path = HSE_ROOT / 'Package 8' / 'Package 8 — Answer Key (GM-260913-04).md'
    source = html_path.read_text(encoding='utf-8')
    key_source = key_path.read_text(encoding='utf-8')
    keys = {int(number): ord(letter) - ord('A') for number, letter in re.findall(
        r'^\| (\d+) \| [^|]+ \| \*\*([A-D])\*\* \|', key_source, re.MULTILINE
    )}
    questions = []
    pattern = r'<div class="q"><div class="stem">(.*?)</div><ol>(.*?)</ol></div>'
    for match in re.finditer(pattern, source, re.DOTALL):
        stem = plain(match.group(1))
        number_match = re.match(r'(\d+)\.\s*(.*)', stem)
        if not number_match:
            continue
        number = int(number_match.group(1))
        options = [plain(value) for value in re.findall(r'<li><b>[A-D]\.</b>\s*(.*?)</li>', match.group(2), re.DOTALL)]
        if number not in keys or len(options) < 2:
            continue
        questions.append({
            'id': f'P8-{number:03d}',
            'sourceTitle': 'High School Vocab Package 8',
            'section': section_for(package, source, match.start()),
            'stem': number_match.group(2).strip(),
            'options': options,
            'key': keys[number],
        })
    return questions


def rebuild_advanced(target: Path) -> dict[str, int]:
    data = {str(package): parse_package_1_to_7(package) for package in range(1, 8)}
    data['8'] = parse_package_8()
    for package, questions in data.items():
        for question in questions:
            if not (0 <= question['key'] < len(question['options'])):
                raise RuntimeError(f'Invalid key for {question["id"]}')
    expected_sections = {
        '1': {'Cloze Reading': 15},
        '2': {'Cloze Reading': 15},
        '3': {'Cloze Reading': 15},
        '4': {'Definitions': 43, 'Sentence Completion': 16,
              'Same Meaning, Different Words': 14},
        '5': {'Definitions': 36, 'Sentence Completion': 14,
              'Same Meaning, Different Words': 12, 'Which Sense?': 12},
        '6': {'Definitions': 36, 'Sentence Completion': 17,
              'Same Meaning, Different Words': 12, 'Which Sense?': 12},
        '7': {'Definitions': 56, 'Sentence Completion': 30,
              'Same Meaning, Different Words': 14, 'Which Sense?': 12},
        '8': {'Definitions': 30, 'Sentence Completion': 19,
              'Same Meaning, Different Words': 10, 'Which Sense?': 10},
    }
    for package, expected in expected_sections.items():
        actual = {}
        for question in data[package]:
            actual[question['section']] = actual.get(question['section'], 0) + 1
        if actual != expected:
            raise RuntimeError(f'Package {package} section mismatch: {actual} != {expected}')
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    return {package: len(questions) for package, questions in data.items()}


def parse_vocab_package(package: int) -> list[dict]:
    path = HSE_ROOT / f'Package {package}' / f'High School Vocab Package {package}.html'
    source = path.read_text(encoding='utf-8')
    entries = []
    if package == 7:
        pattern = (r'<div class="entry"><div class="term">.*?'
                   r'<span class="word">(.*?)</span>'
                   r'<span class="pos">\[(.*?)\]</span>'
                   r'<span class="cn">(.*?)</span>.*?'
                   r'</div><div class="example">(.*?)</div></div>')
    else:
        pattern = (r'<tr><td class="w"><span class="word">(.*?)</span></td>'
                   r'<td class="p">\[(.*?)\]</td><td class="g">(.*?)</td>'
                   r'<td class="n">.*?</td></tr>')
    for match in re.finditer(pattern, source, re.DOTALL):
        values = [plain(value) for value in match.groups()]
        word, pos, chinese = values[:3]
        example = values[3] if len(values) > 3 else ''
        if word and pos and chinese:
            entries.append({
                'w': word, 'p': pos, 'c': chinese, 'e': example,
                's': '', 'a': '',
            })
    expected = {7: 144, 8: 70}[package]
    if len(entries) != expected:
        raise RuntimeError(f'Package {package} vocabulary mismatch: {len(entries)} != {expected}')
    return entries


def rebuild_vocab(target: Path) -> dict[str, int]:
    data = json.loads(target.read_text(encoding='utf-8'))
    hse = next((item for item in data.get('types', []) if item.get('type') == 'HSE Packages'), None)
    if not hse or not hse.get('groups'):
        raise RuntimeError('HSE Packages metadata is missing from vocab.json')
    units = hse['groups'][0].setdefault('units', [])
    known = {str(unit.get('id')) for unit in units}
    counts = {}
    for package in (7, 8):
        package_id = str(package)
        entries = parse_vocab_package(package)
        data.setdefault('data', {})[package_id] = entries
        if package_id not in known:
            units.append({'id': package_id, 'label': f'Package {package}'})
            known.add(package_id)
        counts[package_id] = len(entries)
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    return counts


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    count, lowest, aliases = rebuild_cloze(args.project / 'cloze.json')
    advanced_counts = rebuild_advanced(args.project / 'advanced-practice.json')
    vocab_counts = rebuild_vocab(args.project / 'vocab.json')
    print(f'Cloze: {count} answer-keyed passages rebuilt; lowest match {lowest:.3f}; legacy aliases {aliases}')
    print('Advanced Practice:', ', '.join(f'P{package}={count}' for package, count in advanced_counts.items()))
    print('Vocabulary:', ', '.join(f'P{package}={count}' for package, count in vocab_counts.items()))


if __name__ == '__main__':
    main()
