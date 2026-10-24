#!/usr/bin/env python3
"""Phase 6: collect YouTube candidates for every chamber work with yt-dlp (metadata only, no downloads).

The violin collector (scripts/collect_recordings.py) reads the old Sheet dump and adds "violin" to each query; chamber
works are searched as "<Given Surname> <title>", without the nickname brackets and with the first `aka` when the title
is in another language. Works also in the violin catalogue are skipped (they keep their violin recording).

Reads   data/chamber/works.json
Writes  data/cache/yt-chamber/<id>.json   {"query": ..., "entries": [...]} (git-ignored cache; resumable)
    python3 scripts/chamber/collect_recordings.py [--limit N]
"""
import json
import random
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "yt-chamber"
CACHE.mkdir(parents=True, exist_ok=True)
N_RESULTS = 8
WORKERS = 3
KEEP = ("id", "title", "duration", "view_count", "channel", "channel_is_verified", "timestamp", "description", "live_status")


def first_last(name):
    last, _, first = name.partition(", ")
    return f"{first} {last}".strip() if first else last


def query_for(w):
    # the nickname in ("…") helps YouTube find the work, the catalogue number keeps it to the right one; quotes do not
    title = re.sub(r'[“”"]', "", w["title"])
    return f"{first_last(w['composer'])} {title}"


def fetch(w):
    out = CACHE / f"{w['id']}.json"
    if out.exists():
        return w["id"], "cached"
    q = query_for(w)
    p = None
    for attempt in range(3):
        time.sleep(random.uniform(0.6, 1.6))
        p = subprocess.run(
            ["yt-dlp", f"ytsearch{N_RESULTS}:{q}", "--flat-playlist", "-J", "--no-warnings"],
            capture_output=True, text=True, timeout=90,
        )
        if p.returncode == 0 and p.stdout.strip():
            data = json.loads(p.stdout)
            entries = [{k: e.get(k) for k in KEEP} for e in data.get("entries") or []]
            for e in entries:
                if e.get("description"):
                    e["description"] = e["description"][:200]
            out.write_text(json.dumps({"query": q, "entries": entries}, ensure_ascii=False))
            return w["id"], "ok"
        time.sleep(5 * (attempt + 1))
    return w["id"], "failed: " + ((p.stderr if p else "") or "")[:200]


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    works = [w for w in json.loads((ROOT / "data/chamber/works.json").read_text()) if not w.get("violinId")]
    todo = [w for w in works if not (CACHE / f"{w['id']}.json").exists()][:limit]
    print(f"{len(works)} works, {len(works) - len(todo) if limit is None else '?'} cached, {len(todo)} to search", flush=True)
    done = failed = 0
    with ThreadPoolExecutor(WORKERS) as ex:
        for f in as_completed([ex.submit(fetch, w) for w in todo]):
            pid, status = f.result()
            done += 1
            if status.startswith("failed"):
                failed += 1
                print(f"{pid}: {status}", flush=True)
            if done % 100 == 0:
                print(f"{done}/{len(todo)} ({failed} failed)", flush=True)
    print(f"done: {done}, failed: {failed}", flush=True)


if __name__ == "__main__":
    main()
