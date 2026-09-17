#!/usr/bin/env python3
"""
Bundle the per-word audio clips into per-unit and per-book packs.

    python3 tools/build_audio_packs.py

WHY: 5,363 clips at ~5 KB each means 5,363 HTTP round trips to fetch the
library. The bytes are trivial; the per-request overhead is what students
actually wait through. One pack per unit turns "open a unit and have audio"
into a single ~123 KB request.

FORMAT: a pack is the ORIGINAL .m4a files concatenated with no framing at all,
plus a JSON index of [offset, length] per slug. Each .m4a is already a complete,
self-contained MP4, so slicing the concatenation at those offsets returns bytes
that are byte-identical to the original file. That is the whole trick: the
client can drop each slice straight into its normal per-clip cache under the
normal per-clip URL, and NOTHING in the playback path has to know packs exist.

Do not "improve" this into a zip. Store-only zip would add a parser on both
clients for no gain -- AAC is already compressed and does not shrink.

Writes:
    audio/packs/u-<unitId>.pack     one per unit  (277)
    audio/packs/b-<book-slug>.pack  one per book  (13, deduped within the book)
    audio-packs.json                the index, published with the content version
"""
import json
import hashlib
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
AUDIO = os.path.join(WEB, "audio")
PACKS = os.path.join(AUDIO, "packs")
EXT = ".m4a"


def slug(word):
    s = re.sub(r"[^a-z0-9]+", "_", str(word).strip().lower())
    return s.strip("_") or "x"


def book_slug(name):
    s = re.sub(r"[^a-z0-9]+", "-", name.strip().lower())
    return s.strip("-") or "x"


def build_pack(path, slugs, sizes):
    """Concatenate in a stable order and record where each clip landed."""
    index = {}
    offset = 0
    with open(path, "wb") as out:
        for s in sorted(slugs):
            src = os.path.join(AUDIO, s + EXT)
            with open(src, "rb") as fh:
                data = fh.read()
            if len(data) != sizes[s]:
                sys.exit("size mismatch reading %s" % src)
            out.write(data)
            index[s] = [offset, len(data)]
            offset += len(data)
    return index, offset


def main():
    vocab = json.load(open(os.path.join(WEB, "vocab.json"), encoding="utf-8"))
    have = set(json.load(open(os.path.join(WEB, "audio-index.json"), encoding="utf-8")))
    manifest = json.load(open(os.path.join(WEB, "content", "manifest.json"), encoding="utf-8"))
    audio_version = manifest.get("audioVersion", "1")

    # audio-index.json is the source of truth for what exists, NOT the
    # directory listing. This folder lives under an iCloud-synced Documents
    # tree, and a burst of writes there can leave "<slug> 2.m4a" duplicates
    # behind. Packing the listing once silently produced 6,071 "clips" out of
    # 5,363 real ones and a 70 MB pack set.
    on_disk = {f[: -len(EXT)] for f in os.listdir(AUDIO) if f.endswith(EXT)}
    strays = on_disk - have
    if strays:
        print("WARNING: %d .m4a files on disk are not in audio-index.json and are "
              "being ignored. Check for iCloud ' 2' duplicates:" % len(strays))
        for x in sorted(strays)[:5]:
            print("   %s%s" % (x, EXT))
    sizes = {}
    for s in have:
        f = os.path.join(AUDIO, s + EXT)
        if os.path.exists(f):
            sizes[s] = os.path.getsize(f)
        else:
            sys.exit("audio-index.json lists %s but %s is missing" % (s, f))

    os.makedirs(PACKS, exist_ok=True)
    # A stale pack from a previous run would be served to students; the index
    # would not reference it, but it would sit there confusing the next person.
    for f in os.listdir(PACKS):
        if f.endswith(".pack"):
            os.remove(os.path.join(PACKS, f))

    packs = {}
    units_map = {}
    books_map = {}
    missing = set()

    data = vocab.get("data", {})

    for t in vocab.get("types", []):
        for g in t.get("groups", []):
            book_slugs = set()
            for u in g.get("units", []):
                uid = u.get("id", "")
                entries = data.get(uid, [])
                s = set()
                for e in entries:
                    k = slug(e.get("w", ""))
                    if k in have and k in sizes:
                        s.add(k)
                    elif k:
                        missing.add(k)
                if not s:
                    continue
                pid = "u-" + uid
                idx, total = build_pack(os.path.join(PACKS, pid + ".pack"), s, sizes)
                packs[pid] = {"url": "audio/packs/%s.pack" % pid, "bytes": total, "clips": idx}
                units_map[uid] = pid
                book_slugs |= s

            # A one-unit book's pack would be a byte-identical copy of that
            # unit's pack -- dead weight in the published set, and a pointless
            # tiebreak for the client's planner.
            unit_ids = [u.get("id", "") for u in g.get("units", []) if units_map.get(u.get("id", ""))]
            if book_slugs and len(unit_ids) == 1:
                books_map[g.get("name", "")] = units_map[unit_ids[0]]
            elif book_slugs:
                pid = "b-" + book_slug(g.get("name", ""))
                idx, total = build_pack(os.path.join(PACKS, pid + ".pack"), book_slugs, sizes)
                packs[pid] = {"url": "audio/packs/%s.pack" % pid, "bytes": total, "clips": idx}
                books_map[g.get("name", "")] = pid

    out = {
        "version": 1,
        # Carried so a client can tell that a pack index belongs to the audio it
        # already has. A pack fetched under audioVersion 1 is wrong after a bump.
        "audioVersion": audio_version,
        "ext": EXT,
        "packs": packs,
        "units": units_map,
        "books": books_map,
    }
    idx, total = build_pack(os.path.join(PACKS, 'all-vocabulary.pack'), have, sizes)
    with open(os.path.join(PACKS, 'all-vocabulary.pack'), 'rb') as handle:
        checksum = hashlib.sha256(handle.read()).hexdigest()
    out['all'] = {"url": "audio/packs/all-vocabulary.pack", "bytes": total, "clips": idx, "sha256": checksum}
    with open(os.path.join(WEB, "audio-packs.json"), "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))

    unit_packs = [p for p in packs if p.startswith("u-")]
    book_packs = [p for p in packs if p.startswith("b-")]
    total_bytes = sum(p["bytes"] for p in packs.values())
    print("unit packs   %d" % len(unit_packs))
    print("book packs   %d" % len(book_packs))
    print("clips packed %d unique" % len(sizes))
    print("on disk      %.1f MB across %d packs" % (total_bytes / 1048576.0, len(packs)))
    print("audioVersion %s" % audio_version)
    if missing:
        print("WARNING: %d words have no clip and are not in any pack" % len(missing))
        for m in sorted(missing)[:10]:
            print("   %s" % m)
    print("wrote audio-packs.json")


if __name__ == "__main__":
    main()
