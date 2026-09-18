#!/usr/bin/env python3
"""Extract numbered high-school papers with source keys and paragraph boundaries.

Only printed keys are used. The audit records unsupported sections and questions
without keys. Source files remain untouched; .doc conversion uses a temp folder.
"""
from pathlib import Path
from zipfile import ZipFile
from xml.etree import ElementTree as ET
import argparse, collections, hashlib, json, re, subprocess, tempfile, shutil
ROOT=Path(__file__).resolve().parent.parent
SOURCE=Path.home()/'Desktop/Inspired Education/Beijing Highschool English'
NS={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main','a':'http://schemas.openxmlformats.org/drawingml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships','v':'urn:schemas-microsoft-com:vml'}
NUM=re.compile(r'^\s*(\d{1,3})(?:\s*[.．、]\s*|\s+(?=[A-Za-z_—“\"\']))')
OPT=re.compile(r'([A-G])[.．、]\s*')
BLANK=re.compile(r'[_＿]{2,}\s*(\d{1,3})\s*[_＿]{2,}')
HEADER=re.compile(r'^(?:第[一二三四五六七八九十]+(?:部分|节|题)|[一二三四五六七八九十]+[、．.]|Part\s+[IVX]+|Section\s+[A-D]|[IVX]+[.．])')
FIG=ROOT/'high-school-figures'

def document(path, images=True):
    actual=path
    if path.suffix=='.doc':
        out=Path('/tmp/high111-docx')/hashlib.sha256(path.read_bytes()).hexdigest()[:16]
        out.mkdir(parents=True,exist_ok=True)
        if not (out/(path.stem+'.docx')).exists(): subprocess.run(['soffice','-env:UserInstallation=file://'+str(out/'profile'),'--headless','--convert-to','docx','--outdir',str(out),str(path)],check=True,capture_output=True)
        actual=out/(path.stem+'.docx')
    with ZipFile(actual) as z:
        root=ET.fromstring(z.read('word/document.xml'))
        rels={r.attrib['Id']:r.attrib.get('Target','') for r in ET.fromstring(z.read('word/_rels/document.xml.rels'))} if 'word/_rels/document.xml.rels' in z.namelist() else {}
        def paragraph(p):
            chunks=[]
            for run in p.findall('.//w:r',NS):
                value=''.join((n.text or '') if n.tag.endswith('}t') else '\t' if n.tag.endswith('}tab') else '\n' for n in run if n.tag.rsplit('}',1)[-1] in ('t','tab','br'))
                if run.find('w:rPr/w:u',NS) is not None and re.fullmatch(r'\s*\d{1,2}\s*',value):value=' __'+value.strip()+'__ '
                chunks.append(value)
                if images:
                    for n in [*run.findall('.//a:blip',NS),*run.findall('.//v:imagedata',NS)]:
                        rid=n.get('{'+NS['r']+'}embed') or n.get('{'+NS['r']+'}id')
                        chunks.append('[[rid:'+str(rid)+']]')
            text=''.join(chunks)
            text=re.sub(r'__(\d)__\s+__(\d)__',r'__\1\2__',text)
            text=re.sub(r'[ \t\xa0]+',' ',text).strip()
            figures={}
            for n in ([*p.findall('.//a:blip',NS),*p.findall('.//v:imagedata',NS)] if images else []):
                rid=n.get('{'+NS['r']+'}embed') or n.get('{'+NS['r']+'}id');target=rels.get(rid,'')
                if not target or '://' in target:continue
                name='word/'+target.lstrip('/') if not target.startswith('/') else target.lstrip('/')
                if name not in z.namelist():continue
                raw=z.read(name);ext=Path(name).suffix.lower();digest=hashlib.sha256(raw).hexdigest()[:16]
                if ext in ('.wmf','.emf'):
                    status=json.loads((ROOT/'tools/high-school-vector-audit.json').read_text()).get(digest, {})
                    # Verified raster renders: blank placeholders or 1px vertical separators.
                    if status.get('kind') in ('blank','separator'):figures[rid]='';continue
                    if status.get('kind')=='image':raw=(ROOT/'tools/high-school-vector-images'/(digest+'.png')).read_bytes();ext='.png'
                    else:figures[rid]='[[unsupported-image:'+ext+']]';continue
                elif ext not in ('.png','.jpg','.jpeg','.gif','.webp'):
                    figures[rid]='[[unsupported-image:'+ext+']]';continue
                FIG.mkdir(exist_ok=True);(FIG/(digest+ext)).write_bytes(raw)
                figures[rid]='[[image:high-school-figures/'+digest+ext+']]'
            text=re.sub(r'\[\[rid:([^]]+)]]',lambda m:('\n'+figures[m[1]]+'\n') if figures.get(m[1]) else '',text).strip()
            return [line.strip() for line in text.splitlines() if line.strip()]
        lines=[]
        for child in root.find('w:body',NS):
            if child.tag.endswith('}p'):lines.extend(paragraph(child))
            elif child.tag.endswith('}tbl'):
                for row in child.findall('w:tr',NS):
                    cells=[' / '.join(v for p in cell.findall('.//w:p',NS) for v in paragraph(p)) for cell in row.findall('w:tc',NS)]
                    lines.append(' | '.join(cells))
        return lines

def answers(lines):
    result={};last=None
    for i,line in enumerate(lines):
        m=NUM.match(line)
        if m:last=m[1]
        if '【答案】' not in line:continue
        text=line.split('【答案】',1)[1]
        j=i+1
        while j<len(lines) and not lines[j].startswith('【') and not HEADER.match(lines[j]) :
            text+='\n'+lines[j];j+=1
        text=re.sub(r'\[\[[^]]+]]', '', text)
        hits=list(re.finditer(r'(?:^|\s)(\d{1,3})[.．、]\s*|^(\d{1,3})\s+(?=[A-Za-z])',text,re.M))
        if hits:
            for k,h in enumerate(hits):
                value=text[h.end():hits[k+1].start() if k+1<len(hits) else len(text)].strip()
                result.setdefault(h[1] or h[2],value)
        elif last and last not in result and len(text)<120:result[last]=text.strip()
    if not result:
        # Compact teacher answer sheets: numbered keys and letter ranges.
        text='\n'.join(lines)
        text=re.split(r'阅表|阅读表达|书面表达',text)[0]
        for m in re.finditer(r'(\d{1,3})\s*[-—–]\s*\d{1,3}[.．:：]?\s*([A-G](?:[ \t]*[A-G]){2,})',text):
            for k,c in enumerate(re.sub(r'\s+','',m[2])):result[str(int(m[1])+k)]=c
        for line in text.splitlines():
            hits=list(re.finditer(r'(\d{1,3})[.．、]\s*',line))
            for i,m in enumerate(hits):
                value=line[m.end():hits[i+1].start() if i+1<len(hits) else len(line)].strip()
                if value and not re.search(r'[\u4e00-\u9fff]',value):result.setdefault(m[1],value)
        if re.search(r'^D\s+2[．.]',text,re.M):result['1']='D'
    return result

def index():
    records={};grade=kind=None
    for line in (SOURCE/'00_INDEX.md').read_text().splitlines():
        m=re.match(r'## (G\d+) / (\w+)',line)
        if m:grade,kind=m.groups()
        m=re.match(r'\| (\d+) \| ([^|]+) \| ([^|]+) \|',line)
        if m:records[(grade,kind,m[1])]=(m[2].strip(),m[3].strip())
    return records

def parse(lines):
    groups=[];kind='skip';label='';content=[];questions=[];current=None
    def flushq():
        nonlocal current
        if current:
            text='\n'.join(current['lines'])
            if kind in ('reading','cloze') and len(option_hits(text))<2:
                content.append(current['number']+'. '+text)
            else: questions.append(current)
            current=None
    def flush():
        nonlocal content,questions,label
        flushq()
        if content or questions:groups.append(dict(kind=kind,label=label,content=content,rawQuestions=questions))
        content=[];questions=[];label=''
    def switch(nextkind):
        nonlocal kind
        flush();kind=nextkind
    for line in lines:
        compact=re.sub(r'\s+','',line)
        if line.startswith('从') and '选出单词的正确释义' in line:switch('mcq');continue
        if line=='短篇小说':switch('matching');continue
        if line.startswith('前5个小题'):continue
        if 'proper form of the words or phrases in the boxes' in line:switch('word-form');continue
        if re.match(r'^[IVX]+[.．]\s*(Grammar|Cloze|Reading|Vocabulary|Writing)',line,re.I):
            switch('cloze' if 'Cloze' in line else 'reading' if 'Reading' in line else 'mcq' if 'Grammar' in line else 'auto');continue
        heading=bool(HEADER.match(line)) and (not re.match(r'^[IVX]+[.．]',line) or bool(re.match(r'^[IVX]+[.．]\s*[\u4e00-\u9fff]',line)))
        instruction=line.startswith(('阅读','从每题','在未给','根据','从所给','用括号','用方框')) and len(line)<200
        if heading or instruction or line in ['选词填空','语法填空','单项选择','阅读理解']:
            if '完形填空' in line or ('掌握其大意' in compact and '选项' in line):switch('cloze')
            elif '语法填空' in line or ('填空' in line and ('提示词' in line or '括号' in line or '词性' in line or '适当形式' in line)) or '所给词的正确形式' in line:switch('word-form')
            elif '小说' in line and heading:switch('mcq')
            elif re.search(r'单项(?:选择|填空)|语法选择|词义单选|词汇选择',line):switch('mcq')
            elif re.search(r'七选五|七个选项|两项为多余|两项多余',line):switch('reading-gap')
            elif re.search(r'选词填空|书面表达|阅读表达|写作|听力|翻译|单词拼写|首字母|回答问题|写单词|方框|词组填空|汉译英|完成句子',line):switch('skip')
            elif '阅读理解' in line or ('阅读' in line and heading and '表达' not in line):switch('reading')
            elif instruction and '短文' in line and '选项' in line:
                switch('reading-gap' if ('五个' in line or '五道' in line or '七个' in line or '最佳选项补全' in line) else 'reading')
            elif heading and kind=='reading' and re.search(r'共\s*5\s*小题',line):switch('reading-gap')
            elif heading:
                flush()
                if '部分' in line:kind='auto'
            elif instruction and '单词' in line and ('形式' in line or '填空' in line):switch('word-form')
            continue
        if kind=='skip':continue
        if (re.fullmatch(r'[A-E]',line) or (not current and re.fullmatch(r'[A-E][.．]',line))) and kind in ('reading','word-form'):
            flush();label=line[0];continue
        if line=='词义选择' or (line.startswith('从下列') and '汉语释义' in line):switch('mcq');continue
        m=NUM.match(line) if kind!='reading-gap' else None
        if m:
            flushq();current={'number':m[1],'lines':[line[m.end():]]};continue
        if current:current['lines'].append(line)
        else:content.append(line)
    flush();return groups

def option_hits(text):
    hits=list(re.finditer(r'([A-G])[.．、]\s*|^([A-G])\s+(?=[A-Za-z0-9])',text,re.M))
    chosen=[]
    for h in hits:
        letter=h[1] or h[2]
        if letter=='A' and len(chosen)<2:chosen=[(h,letter)]
        elif chosen and ord(letter)==ord(chosen[-1][1])+1:chosen.append((h,letter))
    return chosen

def questions(group,keys,prefix):
    out=[];kind=group['kind'];content='\n\n'.join(group['content']);raw=group['rawQuestions']
    if kind=='word-form' and not raw:
        raw=[dict(number=m[1],lines=['____'+(' ('+hint[1]+')' if (hint:=re.match(r'\s*\(([^)]+)\)',content[m.end():])) else '')]) for m in BLANK.finditer(content)]
    if kind=='matching':
        opts=option_hits(content)
        shared_matching=[dict(id=letter.lower(),label=letter,text=content[m.end():opts[i+1][0].start() if i+1<len(opts) else len(content)].strip()) for i,(m,letter) in enumerate(opts)]
        if opts:content=content[:opts[0][0].start()].strip()
        for q in raw:
            q['choices']=([dict(id='a',label='A',text='True'),dict(id='b',label='B',text='False')] if int(q['number'])<=41 else shared_matching)
        raw=[q for q in raw if int(q['number'])<=46]
    if kind=='reading-gap' and not raw:
        opts=option_hits(content);choices=[dict(id=letter.lower(),label=letter,text=content[m.end():opts[i+1][0].start() if i+1<len(opts) else len(content)].strip()) for i,(m,letter) in enumerate(opts)]
        if choices:content=content[:opts[0][0].start()].strip()
        raw=[dict(number=m[1],lines=['____'],choices=choices) for m in BLANK.finditer(content)]
    shared=option_hits(content) if kind=='mcq' else []
    shared_choices=[dict(id=letter.lower(),label=letter,text=content[m.end():shared[i+1][0].start() if i+1<len(shared) else len(content)].strip()) for i,(m,letter) in enumerate(shared)]
    if shared_choices:content=''
    for q in raw:
        text='\n'.join(q['lines']).strip();opts=option_hits(text) if kind!='word-form' else []
        choices=q.get('choices', [dict(id=letter.lower(),label=letter,text=text[m.end():opts[i+1][0].start() if i+1<len(opts) else len(text)].strip()) for i,(m,letter) in enumerate(opts)])
        if not choices and shared_choices:choices=shared_choices
        prompt=text[:opts[0][0].start()].strip() if opts else text
        if not prompt:prompt='Blank '+q['number']
        prompt=re.sub(r'[（(](?:用|所给|根据|单词|词汇|语法)[^()（）]*填空[)）]','',prompt).strip()
        key=keys.get(q['number'],'').strip()
        alternatives=[v.strip() for v in re.split(r'\s*(?:##|/|或)\s*',key) if v.strip()]
        answer=key.lower() if re.fullmatch('[A-G]',key) and choices else None
        out.append(dict(id=prefix+'-q'+q['number'],number=q['number'],prompt=prompt,choices=choices,answer=answer,answerText=(key if kind=='word-form' or answer else None),acceptedAnswers=alternatives if kind=='word-form' else [],explanation=None))
    return content,out

def main():
    records=index();grades={'11':{},'12':{}};audit=[];total=collections.Counter();used_images=set()
    paths=sorted(p for p in SOURCE.glob('G*/**/Papers/*') if p.suffix in ('.docx','.doc'))
    for p in paths:
        grade,kind=p.relative_to(SOURCE).parts[:2];number=p.stem.split('_')[0];year,name=records.get((grade,kind,number),('',p.stem))
        district=re.search(r'(东城|西城|海淀|朝阳|丰台|石景山|通州|顺义|昌平|大兴|房山|门头沟|怀柔|平谷|密云|延庆)区?',name)
        district=district[0] if district else re.split(r'20\d{2}',name)[0].strip() or '北京'
        if re.fullmatch(r'\d\d-\d\d',year):year='20'+year[:2]+'–20'+year[3:]
        ap=p.parent.parent/'Answers'/p.name
        source_audit=dict(source=str(p.relative_to(SOURCE)),sha256=hashlib.sha256(p.read_bytes()).hexdigest(),answerSource=str(ap.relative_to(SOURCE)),answerSha256=hashlib.sha256(ap.read_bytes()).hexdigest(),published=[],issues=[])
        lines=document(p);keys=answers(document(ap, images=False))
        if str(p.relative_to(SOURCE))=='G11/Midterms/Papers/02_G11_Midterm_25-26.docx':
            # Scan pages 3-8 match package 14, whose non-listening questions restart at 1.
            donor=p.with_name('14_G11_Midterm_25-26.docx')
            lines=document(donor)
            start=next(i for i,l in enumerate(lines) if '完形填空' in l)
            lines=lines[start:]
            lines=[re.sub(r'(?P<blank>[_＿]{2,})(\d{1,2})(?=[_＿]{2,})',lambda m:m['blank']+str(int(m[2])+18),l) for l in lines]
            lines=[re.sub(r'^(\d{1,2})([.．、])',lambda m:str(int(m[1])+18)+m[2],l) for l in lines]
            source_audit['transcriptionSource']=str(donor.relative_to(SOURCE))
            source_audit['transcriptionSha256']=hashlib.sha256(donor.read_bytes()).hexdigest()
            source_audit['transcriptionNote']='Verified duplicate of scanned pages 3-8; restored original question numbers (+18); keys from the original answer file.'
        groups=parse(lines)
        counts=collections.Counter()
        for group in groups:
            section=group['kind']
            if section=='reading' and not group['rawQuestions'] and BLANK.search(' '.join(group['content'])) and len(option_hits('\n'.join(group['content'])))>=5:section=group['kind']='reading-gap'
            if section=='word-form' and group['rawQuestions'] and any(len(option_hits('\n'.join(q['lines'])))>=4 for q in group['rawQuestions']):section=group['kind']='reading' if len(' '.join(group['content']))>100 else 'mcq'
            if section=='auto':
                joined=' '.join(' '.join(q['lines']) for q in group['rawQuestions'])
                if len(OPT.findall(joined))>=4:section=group['kind']='mcq'
                elif re.search(r'[_＿]{2,}.*?[（(][A-Za-z]+[)）]',joined):section=group['kind']='word-form'
                else:continue
            if section=='matching':section='reading-e'
            if section=='reading':section='reading-'+(group['label'].lower() or 'a')
            counts[section]+=1;ident=f'hs-{grade.lower()}-{kind.lower()}-{number}-{section}-{counts[section]}'
            content,qs=questions(group,keys,ident)
            if section=='word-form':qs=[q for q in qs if re.search(r'[_＿]{2,}',q['prompt']) and not re.match(r'^[\u4e00-\u9fff]',q['prompt'])]
            if not qs:
                if group['rawQuestions'] or len(content)>100:source_audit['issues'].append(dict(section=section,reason='No supported numbered questions',sample=content[:120]))
                continue
            if section!='word-form' and any(len(q['choices'])<2 or len({c['id'] for c in q['choices']})!=len(q['choices']) for q in qs):
                source_audit['issues'].append(dict(section=section,reason='Incomplete choices',numbers=[q['number'] for q in qs]));continue
            if section.startswith(('reading','cloze')) and len(content)<40:
                source_audit['issues'].append(dict(section=section,reason='Missing passage',numbers=[q['number'] for q in qs]));continue
            if '[[unsupported-image:' in content or any('[[unsupported-image:' in q['prompt'] or any('[[unsupported-image:' in c['text'] for c in q['choices']) for q in qs):
                source_audit['issues'].append(dict(section=section,reason='Unsupported question image',numbers=[q['number'] for q in qs]));continue
            item=dict(id=ident,number=int(number),packageNumber=number,year=year,sourceName=name,district=district,examType=kind,part=group['label'] or (str(counts[section]) if section=='word-form' else ''),title=f'Package {number} · {district} · {year}',content=content,questions=qs,sources=[str(p.relative_to(SOURCE))],highlightOnly=True,graded=all(q['answer'] or (section=='word-form' and q['acceptedAnswers']) for q in qs))
            grades[grade[1:]].setdefault(section,[]).append(item);total[section]+=len(qs)
            source_audit['published'].append(dict(id=ident,section=section,numbers=[q['number'] for q in qs],unkeyed=[q['number'] for q in qs if not q['answer'] and not q['acceptedAnswers']]))
            used_images.update(re.findall(r'\[\[image:([^]]+)]]',content+json.dumps(qs)))
        audit.append(source_audit)
    result=dict(schemaVersion=1,contentVersion='1.11',grades=grades)
    (ROOT/'high-school.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    (ROOT/'high-school-audit.json').write_text(json.dumps(dict(sourcePapers=len(paths),questionsBySection=total,images=len(used_images),papers=audit),ensure_ascii=False,indent=2)+'\n')
    for path in FIG.glob('*'):
        if 'high-school-figures/'+path.name not in used_images:path.unlink()
    print(json.dumps(dict(papers=len(paths),exercises=sum(len(rows) for sections in grades.values() for rows in sections.values()),questions=total,issues=sum(len(a['issues']) for a in audit),unkeyed=sum(len(g['unkeyed']) for a in audit for g in a['published'])),indent=2))
if __name__=='__main__':main()
