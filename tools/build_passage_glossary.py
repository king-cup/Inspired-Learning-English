#!/usr/bin/env python3
"""Build explicit per-passage word/phrase lists from the authored offline corpus.

Longest phrases win. No guessed definitions and no arbitrary selection lookup.
The index is shared across passages, keeping repeated definitions out of the APK.
"""
import json
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STOP = set('a an the and but or nor so yet for of to in on at by as if is am are was were be been being it its this that these those i me my mine we us our you your he him his she her they them their who whom whose which what when where why how do does did done have has had can could will would shall should may might must not no yes very also just all any some each every many much more most other another than then there here from with without into out up down over under again only even about after before between both either neither such too'.split())

def load(name):
    return json.loads((ROOT / name).read_text())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reading-only', action='store_true', help='Refresh changed reading lists while retaining unchanged school and Cloze lists.')
    reading_only = parser.parse_args().reading_only
    entries = {}
    for rows in load('vocab.json')['data'].values():
        for row in rows:
            word = row['w'].strip().lower()
            if word in STOP or len(word) < 3 or not row.get('c') or not re.fullmatch(r"[a-z]+(?:[ '\-][a-z]+)*", word):
                continue
            entries.setdefault(word, {key: row.get(key, '') for key in ('w', 'p', 'c', 'e', 's', 'a')})
    # Authored reading-specific additions, not generated dictionary placeholders.
    for word, pos, meaning in [('astronomer','n.','天文学家'), ('asteroid','n.','小行星'), ('orbit','n./v.','轨道；沿轨道运行'), ('spacecraft','n.','航天器'), ('comet','n.','彗星')]:
        entries.setdefault(word, dict(w=word,p=pos,c=meaning,e='',s='',a=''))
    forms = dict((word, word) for word in entries)
    for word in entries:
        if ' ' in word or '-' in word:
            continue
        variants = [word + 's']
        pos = entries[word]['p'].lower()
        if word.endswith(('s', 'x', 'ch', 'sh')): variants.append(word + 'es')
        if word.endswith('y') and len(word) > 2 and word[-2] not in 'aeiou': variants.append(word[:-1] + 'ies')
        if 'v' in pos:
            variants += [word + 'ed', word + 'ing']
            if word.endswith('e'): variants += [word + 'd', word[:-1] + 'ing']
            if word.endswith('y'): variants.append(word[:-1] + 'ied')
        for form in variants: forms.setdefault(form, word)
    pattern = re.compile(r"(?<![A-Za-z])(?:" + '|'.join(re.escape(word) for word in sorted(forms, key=len, reverse=True)) + r")(?![A-Za-z])", re.I)
    passages = {}
    for row in load('reading-content.json')['articles']:
        passages[row['id']] = '\n\n'.join(row['paragraphs']) + '\n' + json.dumps(row['comprehension'], ensure_ascii=False)
    for sections in ([] if reading_only else load('middle-school.json')['grades'].values()):
        for section, rows in sections.items():
            for row in rows: passages[row['id']] = row.get('content', '') + '\n' + json.dumps(row.get('questions', []), ensure_ascii=False)
    for row in ([] if reading_only else load('cloze.json')):
        passages['cloze-' + row['id']] = row['text'] + '\n' + '\n'.join(option for blank in row['blanks'] for option in blank['opts'])
    lists = load('passage-glossary.json')['passages'] if reading_only else {}
    used = {key for ident, rows in lists.items() if ident not in passages for key in rows.values()}
    for ident, text in passages.items():
        hits = sorted({match.group().lower() for match in pattern.finditer(text)})
        lists[ident] = {form: forms[form] for form in hits}
        used.update(lists[ident].values())
    result = dict(schemaVersion=1, contentVersion='1.10.2', entries={word: entries[word] for word in sorted(used)}, passages=lists)
    (ROOT / 'passage-glossary.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
    assert all(form not in STOP and key in result['entries'] for rows in lists.values() for form, key in rows.items())
    print(f'{len(lists)} passage lists; {len(used)} definitions; {sum(map(len, lists.values()))} passage terms')

if __name__ == '__main__': main()
