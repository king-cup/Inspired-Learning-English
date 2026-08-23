#!/bin/sh
set -e
cd "$HOME/Documents/Obsidian Notes/Teaching Vault/Vocab Drill Web"
LOG=/tmp/vd_push.log
: > "$LOG"
{
  echo "== branch: $(git rev-parse --abbrev-ref HEAD)"
  git add -A
  git commit -q -F - <<'MSG'
Vocabulary update 2026-08-23-01: Reading Explorer + Prepare Level 5, all audio regenerated with Kokoro

Content:
- 277 units / 10,219 entries (was 127 / 6,978). Adds Reading Explorer
  Foundations/1/2/3 (65 A/B sections) and Prepare Level 5 (20 units).
- Published as content/vocab-2026-08-23-01.json + audio-index-2026-08-23-01.json.
  publish_content.py reported no PROGRESS warnings: purely additive, no existing
  word identity or unit id changed, so no student loses progress.

Audio:
- All 5,363 clips regenerated with Kokoro (mlx-audio, af_heart, speed 0.9),
  replacing the macOS `say` compact-voice clips. 0 failures.
- audioVersion bumped 1 -> 2 because existing filenames now carry new sound;
  without it phones would keep the year-cached old clips.
- 30 MB of AAC-LC/MP4 at 24 kHz mono.

Code:
- js/data.js GROUP_ORDER gains Prepare Level 5 and the four Reading Explorer
  books so they sort in teaching order rather than falling to the end.
- sw.js SHELL v6 -> v7 so installed clients pick up the new data.js.
MSG
  echo "== committed"
  git log --oneline -1
  git checkout main
  git merge --ff-only v1.03.1-update-bar
  echo "== merged into main"
  git log --oneline -3
  git push origin main
  git push origin v1.03.1-update-bar
  echo "== pushed"
  git status -sb | head -3
  echo PUSH-OK
} >> "$LOG" 2>&1 || echo PUSH-FAILED >> "$LOG"
