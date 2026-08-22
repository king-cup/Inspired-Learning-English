#!/bin/sh
# Transcode the Android app's Ogg/Opus clips to AAC-LC in MP4 for WebKit.
#
#   sh tools/transcode_audio.sh
#
# WebKit has no Ogg CONTAINER support, so every .ogg clip is silent on iPhone
# and iPad, in a Safari tab and on the home screen alike. Android works because
# MediaPlayer handles Ogg natively. The .ogg originals are left untouched --
# they remain the Android build's asset.
#
# Also writes audio-index.json: the array of slugs that have a clip, so the
# client can decide SYNCHRONOUSLY whether one exists (which matters, because an
# await would spend the user gesture that iOS requires to start audio).
#
# Backgrounded; progress in /tmp/vd_transcode.log, last line reads DONE.

LOG=/tmp/vd_transcode.log
WEB=$(cd "$(dirname "$0")/.." && pwd)
SRC="$HOME/Documents/Obsidian Notes/Teaching Vault/Vocab Drill Student App/app/src/main/assets/audio"
OUT="$WEB/audio"
JOBS=8
export OUT

rm -f "$LOG"
{
  command -v ffmpeg >/dev/null || { echo "FAILED: ffmpeg not on PATH"; exit 1; }
  [ -d "$SRC" ] || { echo "FAILED: source not found: $SRC"; exit 1; }

  mkdir -p "$OUT"
  TOTAL=$(find "$SRC" -name '*.ogg' | wc -l | tr -d ' ')
  echo "source: $SRC"
  echo "out:    $OUT"
  echo "clips:  $TOTAL   jobs: $JOBS"
  START=$(date +%s)

  # NOTE: not `xargs -I{}`. On macOS that assembles one huge command line per
  # item and dies with "command line cannot be assembled, too long" once the
  # paths are this long. `-n1 sh -c '...' _` passes the filename as $1 instead.
  find "$SRC" -name '*.ogg' -print0 | xargs -0 -P "$JOBS" -n 1 sh -c '
    f="$1"
    b=$(basename "$f" .ogg)
    d="$OUT/$b.m4a"
    [ -f "$d" ] && exit 0
    ffmpeg -y -loglevel error -i "$f" \
      -c:a aac -profile:a aac_low -b:a 32k -ar 24000 -ac 1 \
      -movflags +faststart "$d" 2>/dev/null || echo "FAILED $b"
  ' _

  MADE=$(find "$OUT" -name '*.m4a' | wc -l | tr -d ' ')
  echo "--- results ---"
  echo "m4a written: $MADE / $TOTAL   in $(( $(date +%s) - START ))s"
  echo "size: $(du -sh "$OUT" | cut -f1)"
  echo "zero-byte: $(find "$OUT" -name '*.m4a' -size 0 | wc -l | tr -d ' ')"

  # audio-index.json -- one JSON array of slugs, no whitespace
  find "$OUT" -name '*.m4a' -exec basename {} .m4a \; | sort | awk '
    BEGIN { printf "[" }
    { printf "%s\"%s\"", (NR>1 ? "," : ""), $0 }
    END { print "]" }
  ' > "$WEB/audio-index.json"
  echo "audio-index.json: $(wc -c < "$WEB/audio-index.json" | tr -d ' ') bytes"

  echo "--- ffprobe spot check ---"
  SAMPLE=$(find "$OUT" -name 'guidance.m4a' | head -1)
  [ -n "$SAMPLE" ] || SAMPLE=$(find "$OUT" -name '*.m4a' | head -1)
  ffprobe -v error -show_entries stream=codec_name,sample_rate,channels \
          -show_entries format=format_name,duration,bit_rate \
          -of default=noprint_wrappers=1 "$SAMPLE"
  echo DONE
} > "$LOG" 2>&1 &

echo "launched pid $! - progress in $LOG"
