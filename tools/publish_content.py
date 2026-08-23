#!/usr/bin/env python3
"""
publish_content.py — build a validated, versioned vocabulary release for the
Vocab Drill Web PWA (v1.03+).

You edit the root source files:
    vocab.json
    audio-index.json
then run:
    python3 tools/publish_content.py --version 2026-08-22-01

It validates the sources, compares them against the previously published version,
warns about anything that could disturb student progress or audio, and writes:
    content/vocab-<version>.json
    content/audio-index-<version>.json
    content/manifest.json          (written LAST, via temp file + rename)

It NEVER commits, pushes, deploys, or deletes old versions. Review the output,
then commit and push yourself (see PUBLISHING.md).

Progress identity (must match js/store.js wordKey and the Android app):
    unitId | word.trim().lower() | pos.trim().lower()
Changing or removing a Unit ID, English word, or part of speech detaches a
student's saved progress for that word — those changes are reported as warnings.

Exit code 0 = success (warnings allowed). Non-zero = validation error, nothing
written.
"""

import argparse
import datetime
import json
import os
import re
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOCAB_SRC = os.path.join(ROOT, "vocab.json")
AUDIO_SRC = os.path.join(ROOT, "audio-index.json")
PACKS_SRC = os.path.join(ROOT, "audio-packs.json")
CONTENT_DIR = os.path.join(ROOT, "content")
MANIFEST_PATH = os.path.join(CONTENT_DIR, "manifest.json")

VERSION_RE = re.compile(r"^[A-Za-z0-9._-]+$")


# --- helpers ---------------------------------------------------------------

def slug(word):
    """Mirror js/data.js slug() and tools/generate_audio.py exactly."""
    s = re.sub(r"[^a-z0-9]+", "_", str(word).strip().lower())
    s = s.strip("_")
    return s or "x"


def identity(entry):
    """Progress identity within a unit: (word.lower, pos.lower)."""
    return (str(entry.get("w", "")).strip().lower(),
            str(entry.get("p", "")).strip().lower())


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def unit_ids_in_tree(vocab):
    """Every unit id referenced in the types tree, with duplicate detection."""
    seen, dups = set(), []
    for t in vocab.get("types", []):
        for g in t.get("groups", []):
            for u in g.get("units", []):
                uid = u.get("id")
                if uid in seen:
                    dups.append(uid)
                seen.add(uid)
    return seen, dups


# --- validation ------------------------------------------------------------

def validate_vocab(vocab, errors, warnings):
    if not isinstance(vocab, dict):
        errors.append("vocab.json is not a JSON object")
        return
    if not isinstance(vocab.get("types"), list):
        errors.append("vocab.json: 'types' must be an array")
    if not isinstance(vocab.get("data"), dict):
        errors.append("vocab.json: 'data' must be an object")
        return

    data = vocab["data"]

    # malformed word entries + duplicate progress identities within a unit
    for uid, entries in data.items():
        if not isinstance(entries, list):
            errors.append(f"unit '{uid}': entries must be an array")
            continue
        seen_ids = {}
        for i, e in enumerate(entries):
            if not isinstance(e, dict):
                errors.append(f"unit '{uid}' entry {i}: not an object")
                continue
            w = e.get("w")
            if not isinstance(w, str) or not w.strip():
                errors.append(f"unit '{uid}' entry {i}: missing/empty 'w' (word)")
                continue
            if "p" in e and not isinstance(e.get("p"), str):
                errors.append(f"unit '{uid}' word '{w}': 'p' (part of speech) must be a string")
            key = identity(e)
            if key in seen_ids:
                errors.append(f"unit '{uid}': duplicate progress identity {key} "
                              f"(entries {seen_ids[key]} and {i}) — this breaks progress keying")
            else:
                seen_ids[key] = i

    # referenced unit ids exist / duplicates in the tree
    refs, dups = unit_ids_in_tree(vocab)
    for d in sorted(set(dups)):
        warnings.append(f"unit id '{d}' is referenced more than once in the types tree")
    for uid in sorted(refs):
        if uid not in data:
            warnings.append(f"unit '{uid}' is referenced in the types tree but has no words in 'data' "
                            f"(the app will hide it)")
    for uid in sorted(data.keys()):
        if uid not in refs:
            warnings.append(f"unit '{uid}' has words but is not referenced in the types tree "
                            f"(the app will hide it)")


def validate_audio_index(index, errors):
    if not isinstance(index, list):
        errors.append("audio-index.json must be a JSON array")
        return
    for i, s in enumerate(index):
        if not isinstance(s, str):
            errors.append(f"audio-index.json entry {i}: not a string")
            return


# --- progress-critical diff against the previous published version ---------

def previous_vocab():
    """Load the vocab of the currently published manifest, if any."""
    if not os.path.exists(MANIFEST_PATH):
        return None, None
    try:
        m = load_json(MANIFEST_PATH)
        vurl = m.get("vocabUrl")
        if not vurl:
            return None, m
        p = os.path.join(ROOT, vurl)
        if not os.path.exists(p):
            return None, m
        return load_json(p), m
    except Exception as e:  # noqa: BLE001
        return None, None


def diff_progress(prev_vocab, new_vocab, warnings):
    if not prev_vocab:
        return
    prev_data = prev_vocab.get("data", {})
    new_data = new_vocab.get("data", {})

    removed_units = [u for u in prev_data if u not in new_data]
    for u in sorted(removed_units):
        warnings.append(f"PROGRESS: unit '{u}' was removed — students lose all saved progress for it")

    removed_words = 0
    samples = []
    for uid, prev_entries in prev_data.items():
        if uid not in new_data:
            continue
        prev_ids = {identity(e) for e in prev_entries if isinstance(e, dict)}
        new_ids = {identity(e) for e in new_data[uid] if isinstance(e, dict)}
        gone = prev_ids - new_ids
        for g in gone:
            removed_words += 1
            if len(samples) < 12:
                samples.append(f"{uid}: {g[0]!r} ({g[1] or 'no pos'})")
    if removed_words:
        warnings.append(f"PROGRESS: {removed_words} word identit{'y' if removed_words == 1 else 'ies'} "
                        f"changed or removed (word/pos edited) — their saved progress will detach:")
        for s in samples:
            warnings.append(f"    - {s}")
        if removed_words > len(samples):
            warnings.append(f"    …and {removed_words - len(samples)} more")


def audio_consistency(vocab, index, warnings):
    have = set(index)
    missing = 0
    sample = []
    for uid, entries in vocab.get("data", {}).items():
        for e in entries:
            if not isinstance(e, dict):
                continue
            w = e.get("w")
            if not isinstance(w, str) or not w.strip():
                continue
            if slug(w) not in have:
                missing += 1
                if len(sample) < 10:
                    sample.append(f"{w} -> {slug(w)}")
    if missing:
        warnings.append(f"AUDIO: {missing} word(s) have no clip in audio-index "
                        f"(device voice will be used — this is only a warning):")
        for s in sample:
            warnings.append(f"    - {s}")
        if missing > len(sample):
            warnings.append(f"    …and {missing - len(sample)} more")
    return missing


# --- write -----------------------------------------------------------------

def write_json_atomic(path, obj):
    d = os.path.dirname(path)
    fd, tmp = tempfile.mkstemp(dir=d, prefix=".tmp-", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
        os.replace(tmp, path)
    except BaseException:
        try:
            os.remove(tmp)
        except OSError:
            pass
        raise


# --- main ------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Publish a versioned vocabulary release.")
    ap.add_argument("--version", required=True,
                    help="content version id, e.g. 2026-08-22-01 (letters/digits/.-_ only)")
    ap.add_argument("--audio-version",
                    help="audio cache-busting version. Change ONLY when you replace existing audio "
                         "files. Defaults to the previous manifest's value (or '1').")
    ap.add_argument("--published-at",
                    help="ISO timestamp; defaults to now (UTC).")
    ap.add_argument("--force", action="store_true",
                    help="overwrite an existing version of the same id")
    ap.add_argument("--dry-run", action="store_true",
                    help="validate and report, but write nothing")
    args = ap.parse_args()

    if not VERSION_RE.match(args.version):
        print(f"ERROR: --version '{args.version}' may only contain letters, digits, dot, dash, underscore",
              file=sys.stderr)
        return 2

    errors, warnings = [], []

    # 1. parse sources
    try:
        vocab = load_json(VOCAB_SRC)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: could not read/parse vocab.json: {e}", file=sys.stderr)
        return 2
    try:
        index = load_json(AUDIO_SRC)
    except Exception as e:  # noqa: BLE001
        print(f"ERROR: could not read/parse audio-index.json: {e}", file=sys.stderr)
        return 2

    # 2-7. validate
    validate_vocab(vocab, errors, warnings)
    validate_audio_index(index, errors)

    # 8-9. diff against previous published version
    prev_vocab, prev_manifest = previous_vocab()
    if not errors:
        diff_progress(prev_vocab, vocab, warnings)

    # 10. audio consistency (warnings only)
    clip_count = len(index) if isinstance(index, list) else 0
    if not errors:
        audio_consistency(vocab, index, warnings)

    # audio packs are OPTIONAL: an older publish has none, and a client that
    # does not understand them ignores the manifest field and falls back to
    # fetching clips one at a time. Build them with tools/build_audio_packs.py.
    packs = None
    packs_problem = None
    if os.path.exists(PACKS_SRC):
        try:
            packs = load_json(PACKS_SRC)
        except Exception as e:  # noqa: BLE001
            errors.append(f"could not read/parse audio-packs.json: {e}")
        else:
            if not isinstance(packs, dict) or not isinstance(packs.get("packs"), dict):
                errors.append("audio-packs.json is not a pack index")
                packs = None
    else:
        packs_problem = "audio-packs.json not found — publishing without packs"

    # output paths
    vocab_name = f"vocab-{args.version}.json"
    index_name = f"audio-index-{args.version}.json"
    packs_name = f"audio-packs-{args.version}.json"
    vocab_out = os.path.join(CONTENT_DIR, vocab_name)
    index_out = os.path.join(CONTENT_DIR, index_name)
    packs_out = os.path.join(CONTENT_DIR, packs_name)

    # 14. refuse to overwrite
    if not args.force and not args.dry_run:
        outs = [vocab_out, index_out] + ([packs_out] if packs else [])
        for p in outs:
            if os.path.exists(p):
                errors.append(f"{os.path.relpath(p, ROOT)} already exists — bump --version or pass --force")

    # audioVersion default: carry over, or 1
    audio_version = args.audio_version
    if audio_version is None:
        audio_version = (prev_manifest or {}).get("audioVersion", "1")
    audio_version = str(audio_version)

    unit_count = sum(1 for u, e in vocab.get("data", {}).items() if isinstance(e, list) and e) \
        if isinstance(vocab.get("data"), dict) else 0
    word_count = sum(len(e) for e in vocab.get("data", {}).values() if isinstance(e, list)) \
        if isinstance(vocab.get("data"), dict) else 0

    # 15. stop on errors
    if errors:
        print("VALIDATION FAILED — nothing was written:\n", file=sys.stderr)
        for e in errors:
            print(f"  ERROR: {e}", file=sys.stderr)
        if warnings:
            print("", file=sys.stderr)
            for w in warnings:
                print(f"  warning: {w}", file=sys.stderr)
        return 1

    published_at = args.published_at or (
        datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))

    manifest = {
        "schemaVersion": 1,
        "contentVersion": args.version,
        "vocabUrl": f"content/{vocab_name}",
        "audioIndexUrl": f"content/{index_name}",
        "audioVersion": audio_version,
        "publishedAt": published_at,
    }
    # NOT a schemaVersion bump. Clients validate schemaVersion with an exact
    # ==1, so raising it would make every v1.03 phone reject this manifest and
    # sit on its old content forever. An unknown extra KEY is ignored by them
    # and used by v1.04+, which is exactly the behaviour wanted.
    if packs:
        manifest["audioPacksUrl"] = f"content/{packs_name}"

    # 11-13. write versioned files, then the manifest LAST
    if not args.dry_run:
        os.makedirs(CONTENT_DIR, exist_ok=True)
        write_json_atomic(vocab_out, vocab)
        write_json_atomic(index_out, index)
        if packs:
            write_json_atomic(packs_out, packs)
        write_json_atomic(MANIFEST_PATH, manifest)

    # 16. summary
    print("=" * 60)
    print(f"{'DRY RUN — nothing written' if args.dry_run else 'PUBLISHED'}")
    print("=" * 60)
    print(f"  content version : {args.version}")
    print(f"  audio version   : {audio_version}"
          + ("  (carried over)" if args.audio_version is None else "  (set explicitly)"))
    print(f"  units           : {unit_count}")
    print(f"  words           : {word_count}")
    print(f"  audio clips     : {clip_count}")
    if packs:
        n_unit = sum(1 for k in packs.get("units", {}))
        n_book = sum(1 for k in packs.get("books", {}))
        total = sum(p.get("bytes", 0) for p in packs["packs"].values())
        print(f"  audio packs     : {len(packs['packs'])} ({n_unit} unit, {n_book} book), "
              f"{total / 1048576.0:.1f} MB")
        if str(packs.get("audioVersion")) != audio_version:
            print(f"  ** WARNING: audio-packs.json was built against audioVersion "
                  f"{packs.get('audioVersion')} but this publish is {audio_version}. "
                  f"Re-run tools/build_audio_packs.py or students will slice stale packs. **")
    elif packs_problem:
        print(f"  audio packs     : none  ({packs_problem})")
    if prev_manifest:
        print(f"  previous version: {prev_manifest.get('contentVersion')}")
    print(f"  published at    : {published_at}")
    print("  files:")
    for p in ([vocab_out, index_out] + ([packs_out] if packs else []) + [MANIFEST_PATH]):
        print(f"    {'(would write) ' if args.dry_run else ''}{os.path.relpath(p, ROOT)}")
    if warnings:
        print(f"\n  {len(warnings)} warning(s):")
        for w in warnings:
            print(f"    warning: {w}")
    else:
        print("\n  no warnings.")
    if not args.dry_run:
        print("\nNext: review, then `git add content/ vocab.json audio-index.json`, commit and push.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
