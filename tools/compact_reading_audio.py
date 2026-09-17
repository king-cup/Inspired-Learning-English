#!/usr/bin/env python3
"""Transcode existing reading masters to 32 kbps AAC without changing the voice.
Git checkpoint retains the 64 kbps sources. New cache URLs prevent stale audio.
This is size optimization, not narration regeneration or a content re-audit.
"""
import hashlib
import json
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

def compact(row):
    path = ROOT / row['path']
    if row.get('encoding') == 'aac-mono-32k-v1.10': return row
    before = path.stat().st_size
    with tempfile.TemporaryDirectory(prefix='inspired-audio-') as folder:
        output = Path(folder) / 'compact.m4a'
        subprocess.run(['ffmpeg','-v','error','-i',str(path),'-c:a','aac','-b:a','32k','-ac','1','-ar','24000','-movflags','+faststart',str(output)], check=True)
        probe = json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(output)], text=True))
        duration = float(probe['format']['duration'])
        assert abs(duration-row['duration']) < .25, row['articleId']
        assert output.stat().st_size < before, row['articleId']
        path.write_bytes(output.read_bytes())
    row.update(bytes=path.stat().st_size, originalBytes=before, duration=round(duration,3), encoding='aac-mono-32k-v1.10', compactPath=row['path']+'?v=1.10', sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    return row

def main():
    path = ROOT / 'reading-audio-manifest.json'
    manifest = json.loads(path.read_text())
    with ThreadPoolExecutor(max_workers=4) as pool: manifest['recordings'] = list(pool.map(compact, manifest['recordings']))
    manifest['delivery'] = 'optional-per-article'
    manifest['encoding'] = 'AAC-LC mono 24kHz 32kbps'
    manifest['voiceReplacement'] = 'Pending Qwen correctness gate; existing narration retained'
    path.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'beforeBytes':sum(r['originalBytes'] for r in manifest['recordings']), 'afterBytes':sum(r['bytes'] for r in manifest['recordings'])}))
if __name__ == '__main__': main()
