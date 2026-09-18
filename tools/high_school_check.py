"""Validate published high-school questions, source decisions and figure references."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parent.parent
bank=json.loads((root/'high-school.json').read_text())
audit=json.loads((root/'high-school-audit.json').read_text())
notes=json.loads((root/'tools/high-school-source-notes.json').read_text())
assert bank['contentVersion']=='1.11'
assert audit['sourcePapers']==len(audit['papers'])==176
assert all(p['published'] for p in audit['papers'])
for p in audit['papers']:
 if p['issues']:assert notes[p['source']]['excludedGroups']==p['issues'],p['source']
ids=set();count=0;unkeyed=[];figures=set()
for grade,sections in bank['grades'].items():
 for section,rows in sections.items():
  for row in rows:
   assert row['id'] not in ids;ids.add(row['id'])
   assert row['packageNumber'] and row['district'] and row['year'] and row['highlightOnly']
   assert row['questions']
   assert len({q['number'] for q in row['questions']})==len(row['questions']),row['id']
   for q in row['questions']:
    count+=1
    assert q['prompt'] and '【答案】' not in q['prompt'],q['id']
    if section=='word-form':
     assert not q['choices'] and q['acceptedAnswers'],q['id']
     assert all(len(a)<120 and not re.search(r'[\u4e00-\u9fff]',a) for a in q['acceptedAnswers']),q['id']
    else:
     assert len(q['choices'])>=2 and all(c['text'] for c in q['choices']),q['id']
     if q['answer']:assert q['answer'] in [c['id'] for c in q['choices']],q['id']
     else:unkeyed.append(q['id']);assert q['answerText'] is None
   for path in re.findall(r'\[\[image:([^]]+)]]',json.dumps(row)):
    assert (root/path).is_file(),path;figures.add(path)
assert len(unkeyed)==4 and all('monthly-24-mcq-1' in q for q in unkeyed)
assert len(figures)==audit['images']
assert count==sum(audit['questionsBySection'].values())
print(f'PASS: {len(ids)} exercises, {count} questions, 176 source papers, {len(figures)} figures; 4 explicitly ungraded novel questions with no source key; all excluded groups reviewed.')
