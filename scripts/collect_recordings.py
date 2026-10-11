"""Collect YouTube candidates for every piece with yt-dlp (metadata only, no downloads).

Reads   data/source/all-repertoire.json   (Sheets dump: header + rows, column Q = ID)
Writes  data/cache/yt/<id>.json           one file per piece: {"query": ..., "entries": [...]}
Resumable: pieces that already have a cache file are skipped.
"""
import json
import random
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
import os
CACHE = ROOT / "data" / "cache" / os.environ.get("CACHE_NAME", "yt")  # CACHE_NAME=yt2 + PLAIN=1: second, plainer query (no "violin" appended) for pieces whose first search found nothing usable
CACHE.mkdir(parents=True, exist_ok=True)
N_RESULTS = 8
WORKERS = 3

KEEP = ("id", "title", "duration", "view_count", "channel", "channel_is_verified", "timestamp", "description", "live_status")


def first_last(name):
    last, _, first = name.partition(", ")
    return f"{first} {last}".strip() if first else last


def query_for(composer, title):
    q = f"{first_last(composer)} {title}"
    if "violin" not in title.lower() and not os.environ.get("PLAIN"):
        q += " violin"
    return q


def fetch(pid, composer, title):
    out = CACHE / f"{pid}.json"
    if out.exists():
        return pid, "cached"
    q = query_for(composer, title)
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
            return pid, "ok"
        time.sleep(5 * (attempt + 1))
    return pid, "failed: " + (p.stderr or "")[:200]


def main():
    import os
    snap = os.environ.get("SNAPSHOT", "data/source/all-repertoire.json")
    rows = json.load(open(ROOT / snap))["values"][1:]
    only = set(open(ROOT / os.environ["IDS_FILE"]).read().split()) if os.environ.get("IDS_FILE") else None
    todo = [(r[16], r[0], r[1]) for r in rows if not (CACHE / f"{r[16]}.json").exists() and (only is None or r[16] in only)]
    if os.environ.get("REVERSE"):
        todo.reverse()  # a second instance can work from the other end
    if len(sys.argv) > 1:
        todo = todo[: int(sys.argv[1])]
    print(f"{len(todo)} to fetch", flush=True)
    done = 0
    with ThreadPoolExecutor(WORKERS) as ex:
        futs = [ex.submit(fetch, *t) for t in todo]
        for f in as_completed(futs):
            pid, status = f.result()
            done += 1
            if status != "ok" or done % 50 == 0:
                print(f"{done}/{len(todo)} {pid} {status}", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
