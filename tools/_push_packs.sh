#!/bin/sh
set -e
cd "$HOME/Documents/Obsidian Notes/Teaching Vault/Vocab Drill Web"
LOG=/tmp/vd_push.log
: > "$LOG"
rm -f .git/index.lock
{
  echo "== branch: $(git rev-parse --abbrev-ref HEAD)"
  rm -f tools/_packtest.mjs tools/_push_vocab_update.sh
  git add -A
  git commit -q -F - <<'MSG'
v1.04: bundle audio into per-unit and per-book packs

Downloading the clip library was 5,363 HTTP requests. The bytes were never the
problem -- per-request overhead was. Opening a unit now costs ONE request of
~120-350 KB, a whole book ONE request of ~2.5 MB, and the entire library 13
requests instead of 5,363.

Format (tools/build_audio_packs.py):
- A pack is the original .m4a files concatenated with NO framing, plus a JSON
  index of [offset, length] per slug. Each .m4a is already a complete MP4, so a
  slice at the recorded offset is byte-identical to the standalone file. That is
  what lets the client file each slice into the normal per-clip cache entry and
  keeps packs entirely invisible to the playback path on both clients.
- 277 unit packs + 12 book packs. A one-unit book reuses its unit pack rather
  than publishing a byte-identical copy.
- Verified: 688 slices byte-identical to their originals, every slice a valid
  MP4 (ftyp box at offset 4).

Client (js/audio.js): prefetch() is now pack-aware behind an unchanged
signature, so every existing call site improved without being touched. Greedy
set cover picks the pack covering the most still-wanted clips, tiebreaking on
SMALLER bytes -- that one rule is what makes a unit request take the 120 KB unit
pack and a book request take the 2.5 MB book pack, with no special casing. A
reverse slug->pack map keeps planning the full library at 7 ms instead of 900 ms
of blocked main thread. MAX_BYTES_PER_NEW_CLIP rejects a pack that is mostly
waste, so three stray new words fetch three files rather than a 2.6 MB book pack.

Packs carry the audioVersion query suffix: /audio/* is immutable for a year, so
a pack rebuilt at the same path would otherwise be served stale. The pack index
does not need it -- its filename already carries the content version.

Publishing: audio-packs.json is frozen per content version and referenced by an
OPTIONAL manifest key. schemaVersion stays 1 on purpose -- clients validate it
with an exact ==1, so bumping it would make every v1.03 phone reject the
manifest and sit on old content forever. v1.03 ignores the unknown key and keeps
fetching clips one at a time.

Also: iCloud left 708 "<slug> 2.m4a" duplicates in audio/ after the last
transcode. They were never committed, but build_audio_packs.py now takes
audio-index.json as the source of truth rather than the directory listing, and
warns loudly if the two disagree.
MSG
  echo "== committed"; git log --oneline -1
  git push origin main
  echo "== pushed"
  git status -sb | head -2
  echo PUSH-OK
} >> "$LOG" 2>&1 || echo PUSH-FAILED >> "$LOG"
