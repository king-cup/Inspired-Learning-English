"""Verify the preview archive without installing or changing any student data."""
import hashlib
import json
from pathlib import Path
import re
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
apk = Path(sys.argv[1])
with zipfile.ZipFile(apk) as archive:
    names = archive.namelist()
    prefix = 'assets/web/'
    manifest = json.loads(archive.read(prefix + 'android-release-manifest.json'))
    expected = re.search(r"APP_VERSION = '([^']+)'", (root / 'js/data.js').read_text()).group(1)
    assert manifest['release'] == expected
    for item in manifest['assets']:
        data = archive.read(prefix + item['path'])
        assert len(data) == item['bytes'], item['path']
        assert hashlib.sha256(data).hexdigest() == item['sha256'], item['path']
    for module in ['js/activity.js', 'js/guided-plan.js', 'js/screens/guided.js']:
        assert archive.read(prefix + module) == (root / module).read_bytes()
    assert archive.read(prefix + 'js/data.js') == (root / 'js/data.js').read_bytes()
    assert not any(n.startswith(prefix + 'reading-audio/') or n.startswith(prefix + 'audio/packs/') for n in names)
    assert not any(re.search(r' [23]\.pack$', n) for n in names)
    assert not any(n.endswith(('.keystore', 'keystore.properties')) for n in names)
    reading = json.loads(archive.read(prefix + 'reading-content.json'))
    assert reading == json.loads((root / 'reading-content.json').read_text())
    assert not reading.get('editorialDraft')
    assert reading.get('answerAuditVersion') == 1
    assert all(not a.get('figures') for a in reading['articles'])
    assert sum(len(a['comprehension']['questions']) for a in reading['articles']) == 891
    assert json.loads(archive.read(prefix + 'release-policy.json'))['enabled'] is False
    clips = json.loads(archive.read(prefix + 'audio-index.json'))
    assert all(prefix + 'audio/' + slug + '.m4a' in names for slug in clips)
    assert len(clips) == 5364
    assert 'InspiredEnglishAndroid' in archive.read(prefix + 'js/main.js').decode()
    print(f'PASS: {manifest["files"]} asset hashes; {len(clips)} word clips; 891 reading keys; no reading recordings, duplicate packs, signing secrets or draft content.')
print(f'APK: {apk.stat().st_size / 1048576:.2f} MiB; SHA-256 {hashlib.sha256(apk.read_bytes()).hexdigest()}')
