#!/usr/bin/env python3
"""Resumable local VoiceStudio narration for the 144 reading articles."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "reading-content.json"
OUT = ROOT / "audio" / "readings"
MANIFEST = ROOT / "reading-audio-manifest.json"
API = "http://localhost:3900/v1/audio/speech"
MODEL = "mlx-audio"
VOICE = "alloy"
TARGET_WPM = 150.0
CONFIG = f"{MODEL}|{VOICE}|aac-64k|{TARGET_WPM:g}|v1"


def words(text: str) -> int:
    return len(re.findall(r"[A-Za-z0-9]+(?:['’\-][A-Za-z0-9]+)*", text))


def chunks(text: str, limit: int = 3600) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+|\n\n+", text.strip())
    out: list[str] = []
    current = ""
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if current and len(current) + len(part) + 1 > limit:
            out.append(current)
            current = part
        else:
            current = f"{current} {part}".strip()
    if current:
        out.append(current)
    return out


def synthesize(text: str, output: Path) -> None:
    payload = json.dumps({
        "model": MODEL,
        "voice": VOICE,
        "input": text,
        "response_format": "wav",
        "speed": 1.0,
        "language": "en",
        "seed": 109,
    }).encode()
    delays = (0, 3, 6, 12, 20, 30)
    last_error: Exception | None = None
    for attempt, delay in enumerate(delays, 1):
        if delay:
            print(f"  VoiceStudio retry {attempt}/{len(delays)} in {delay}s", flush=True)
            time.sleep(delay)
        try:
            request = urllib.request.Request(API, payload, {"Content-Type": "application/json"})
            with urllib.request.urlopen(request, timeout=180) as response:
                data = response.read()
            if len(data) < 1000:
                raise RuntimeError(f"VoiceStudio returned only {len(data)} bytes: {data[:300]!r}")
            output.write_bytes(data)
            return
        except Exception as exc:
            last_error = exc
    raise RuntimeError(f"VoiceStudio failed after {len(delays)} attempts: {last_error}")


def duration(path: Path) -> float:
    value = subprocess.check_output([
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path),
    ], text=True).strip()
    return float(value)


def render(article: dict, output: Path) -> tuple[float, bool]:
    pieces = chunks(article["narration"])
    with tempfile.TemporaryDirectory(prefix="reading-audio-") as tmp_name:
        tmp = Path(tmp_name)
        wavs = []
        for index, text in enumerate(pieces):
            wav = tmp / f"{index:02d}.wav"
            synthesize(text, wav)
            wavs.append(wav)
        inputs: list[str] = []
        for wav in wavs:
            inputs.extend(["-i", str(wav)])
        joined = tmp / "joined.m4a"
        if len(wavs) == 1:
            filter_args: list[str] = []
        else:
            labels = "".join(f"[{i}:a]" for i in range(len(wavs)))
            filter_args = ["-filter_complex", f"{labels}concat=n={len(wavs)}:v=0:a=1[out]", "-map", "[out]"]
        subprocess.run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *inputs,
            *filter_args, "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", str(joined),
        ], check=True)
        raw_duration = duration(joined)
        target_duration = words(article["narration"]) * 60 / TARGET_WPM
        factor = raw_duration / target_duration
        adjusted = not 0.94 <= factor <= 1.06
        if adjusted:
            subprocess.run([
                "ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(joined),
                "-filter:a", f"atempo={factor:.8f}", "-c:a", "aac", "-b:a", "64k",
                "-movflags", "+faststart", str(output),
            ], check=True)
        else:
            joined.replace(output)
    return duration(output), adjusted


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int)
    parser.add_argument("--article")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    with urllib.request.urlopen("http://localhost:3900/health", timeout=5) as response:
        if json.load(response).get("status") != "ok":
            raise SystemExit("VoiceStudio is not healthy")
    content = json.loads(CONTENT.read_text(encoding="utf-8"))
    old = {row["articleId"]: row for row in json.loads(MANIFEST.read_text()).get("recordings", [])} if MANIFEST.exists() else {}
    selected = [a for a in content["articles"] if not args.article or a["id"] == args.article]
    if args.limit:
        selected = selected[:args.limit]
    OUT.mkdir(parents=True, exist_ok=True)
    rows = dict(old)
    generated_count = 0
    skipped_count = 0
    failed_count = 0
    for index, article in enumerate(selected, 1):
        output = ROOT / article["audio"]["path"]
        signature = hashlib.sha256(f"{article['narrationHash']}|{CONFIG}".encode()).hexdigest()
        prior = old.get(article["id"])
        if (not args.force and prior and prior.get("status") == "generated"
                and prior.get("generationHash") == signature
                and output.exists() and output.stat().st_size > 0):
            print(f"[{index}/{len(selected)}] skip {article['id']}")
            skipped_count += 1
            continue
        print(f"[{index}/{len(selected)}] generate {article['id']} · {article['wordCount']} words", flush=True)
        try:
            seconds, adjusted = render(article, output)
            count = words(article["narration"])
            rows[article["id"]] = {
                "articleId": article["id"],
                "title": article["title"],
                "path": article["audio"]["path"],
                "duration": round(seconds, 3),
                "spokenWordCount": count,
                "wpm": round(count * 60 / seconds, 2),
                "voice": VOICE,
                "model": MODEL,
                "status": "generated",
                "speedAdjusted": adjusted,
                "contentHash": article["narrationHash"],
                "generationHash": signature,
                "bytes": output.stat().st_size,
            }
            generated_count += 1
        except Exception as exc:
            rows[article["id"]] = {
                "articleId": article["id"], "title": article["title"],
                "path": article["audio"]["path"], "status": "failed", "error": str(exc),
                "contentHash": article["narrationHash"], "generationHash": signature,
            }
            failed_count += 1
            print(f"FAILED {article['id']}: {exc}", flush=True)
        manifest = {
            "schemaVersion": 1,
            "contentVersion": content["contentVersion"],
            "voice": VOICE,
            "model": MODEL,
            "targetWpm": TARGET_WPM,
            "configHash": hashlib.sha256(CONFIG.encode()).hexdigest(),
            "recordings": [rows[key] for key in sorted(rows)],
        }
        pending = MANIFEST.with_suffix(".json.tmp")
        pending.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        pending.replace(MANIFEST)
    print(f"audio batch: generated={generated_count} skipped={skipped_count} failed={failed_count}")


if __name__ == "__main__":
    main()
