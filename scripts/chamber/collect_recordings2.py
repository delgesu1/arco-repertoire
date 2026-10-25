#!/usr/bin/env python3
"""Phase 6, second pass: new YouTube candidates for the chamber works the first pass left without a video.

The first pass (collect_recordings.py) searched "<Given Surname> <title>" once per work. Here, for every chamber-only work
whose judgement in data/chamber/recordings-judged.json has no high- or medium-confidence video:
  - one search per set the work belongs to ("<Given Surname> <set>"), shared by the set's members, to find complete-set
    uploads (an album that includes the work counts, see data/chamber/recordings/BRIEF.md);
  - one search per work, worded differently: "<Surname> <first aka>" when the work has other names, otherwise
    "<Surname> <title without brackets> <ensemble>" (the ensemble only when the title doesn't already say it).
Metadata only, no downloads.

Reads   data/chamber/works.json, data/chamber/recordings-judged.json
Writes  data/cache/yt-chamber-2/<id>.json      {"queries": [...], "entries": [...]}   (git-ignored cache; resumable)
        data/cache/yt-chamber-2/sets/<key>.json {"query": ..., "entries": [...]}
    python3 scripts/chamber/collect_recordings2.py [--limit N]
"""
import hashlib
import json
import random
import re
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CACHE = ROOT / "data" / "cache" / "yt-chamber-2"
SETS = CACHE / "sets"
SETS.mkdir(parents=True, exist_ok=True)
N_RESULTS = 12
WORKERS = 3
KEEP = ("id", "title", "duration", "view_count", "channel", "channel_is_verified", "timestamp", "description", "live_status")

# how each ensemble is named in a search, when the title doesn't name it already
ENSEMBLE = {
    "string-trio": "string trio",
    "string-quartet": "string quartet",
    "string-quintet": "string quintet",
    "large-strings": "strings",
    "viol-consort": "viols",
    "piano-trio": "piano trio",
    "piano-quartet": "piano quartet",
    "piano-quintet": "piano quintet",
    "piano-strings": "",
    "winds-strings": "",
    "continuo": "trio sonata",
    "other": "",
}


def first_last(name):
    last, _, first = name.partition(", ")
    return f"{first} {last}".strip() if first else last


def surname(name):
    return name.partition(", ")[0]


def search(q):
    p = None
    for attempt in range(3):
        time.sleep(random.uniform(0.6, 1.6))
        p = subprocess.run(
            ["yt-dlp", f"ytsearch{N_RESULTS}:{q}", "--flat-playlist", "-J", "--no-warnings"],
            capture_output=True, text=True, timeout=90,
        )
        if p.returncode == 0 and p.stdout.strip():
            entries = [{k: e.get(k) for k in KEEP} for e in json.loads(p.stdout).get("entries") or []]
            for e in entries:
                if e.get("description"):
                    e["description"] = e["description"][:200]
            return entries
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(((p.stderr if p else "") or "")[:200])


_shared = None


def name_for(composer):
    """the surname alone, unless another composer in the catalogue shares it (Michael and Joseph Haydn)"""
    global _shared
    if _shared is None:
        seen = {}
        for w in json.loads((ROOT / "data/chamber/works.json").read_text()):
            seen.setdefault(surname(w["composer"]), set()).add(w["composer"])
        _shared = {s for s, names in seen.items() if len(names) > 1}
    return first_last(composer) if surname(composer) in _shared else surname(composer)


def work_query(w):
    if w.get("aka"):
        return f"{name_for(w['composer'])} {w['aka'][0]}"
    # no nickname brackets, no key ("in D minor": uploads often leave it out or use another language), no commas
    title = re.sub(r'\s*\("[^"]*"\)|[“”"]', "", w["title"])
    title = re.sub(r"\s+in [A-G](?:-flat|-sharp)? (?:major|minor)\b", "", title)
    title = re.sub(r"\s*,\s*", " ", title).strip()
    ens = ENSEMBLE.get(w["formation"], "")
    if ens and not all(x in title.lower() for x in ens.split()):
        title = f"{title} {ens}"
    return f"{name_for(w['composer'])} {title}"


def set_key(w):
    return hashlib.sha1(f"{w['composer']}|{w['set']}".encode()).hexdigest()[:16]


def fetch_set(key, q):
    out = SETS / f"{key}.json"
    if out.exists():
        return key, "cached"
    try:
        out.write_text(json.dumps({"query": q, "entries": search(q)}, ensure_ascii=False))
        return key, "ok"
    except Exception as e:  # noqa: BLE001
        return key, f"failed: {e}"


def fetch_work(w):
    out = CACHE / f"{w['id']}.json"
    if out.exists():
        return w["id"], "cached"
    q = work_query(w)
    try:
        out.write_text(json.dumps({"queries": [q], "entries": search(q)}, ensure_ascii=False))
        return w["id"], "ok"
    except Exception as e:  # noqa: BLE001
        return w["id"], f"failed: {e}"


def misses():
    judged = json.loads((ROOT / "data/chamber/recordings-judged.json").read_text())
    works = [w for w in json.loads((ROOT / "data/chamber/works.json").read_text()) if not w.get("violinId")]
    ok = lambda j: j and j.get("video") and j.get("confidence") in ("high", "medium")  # noqa: E731
    return [w for w in works if not ok(judged.get(str(w["id"])))]


def run(jobs, label):
    done = failed = 0
    with ThreadPoolExecutor(WORKERS) as ex:
        for f in as_completed([ex.submit(*j) for j in jobs]):
            key, status = f.result()
            done += 1
            if status.startswith("failed"):
                failed += 1
                print(f"{label} {key}: {status}", flush=True)
            if done % 100 == 0:
                print(f"{label}: {done}/{len(jobs)} ({failed} failed)", flush=True)
    print(f"{label} done: {done}, failed: {failed}", flush=True)


def main():
    limit = int(sys.argv[sys.argv.index("--limit") + 1]) if "--limit" in sys.argv else None
    todo = misses()[:limit]
    sets = {}
    for w in todo:
        if w.get("set"):
            sets.setdefault(set_key(w), f"{first_last(w['composer'])} {re.sub(r'[“”\"]', '', w['set'])}")
    print(f"{len(todo)} works without a video, {len(sets)} sets", flush=True)
    run([(fetch_set, k, q) for k, q in sets.items()], "sets")
    run([(fetch_work, w) for w in todo], "works")


if __name__ == "__main__":
    main()
