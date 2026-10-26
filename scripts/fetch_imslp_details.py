#!/usr/bin/env python3
"""Fetch the IMSLP "work info" block of every catalogue work that has an IMSLP page (violin and chamber).

The block holds the movements, dedication, first performance, years of composition and publication, average
duration and other titles; scripts/parse_imslp_details.py turns it into data/details/imslp.json. The raw block is
kept, so the parsing can change without fetching again. No AI, only IMSLP's public API (20 pages a request,
one request every 1.2 s).

Reads   data/build/catalogue.json, data/build/chamber.json (each work's imslpPage)
Writes  data/cache/imslp-work/<sha1 of the page title>.json   {"title", "page", "info"}   (git-ignored; resumable)
    python3 scripts/fetch_imslp_details.py
"""
import hashlib
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "cache" / "imslp-work"
OUT.mkdir(parents=True, exist_ok=True)
UA = "ArcoAtlas/1.0 (+https://atlas.arco.app) catalogue research"
BATCH = 20


def key(title):
    return hashlib.sha1(title.encode()).hexdigest()


def api(**kw):
    kw["format"] = "json"
    url = "https://imslp.org/api.php?" + urllib.parse.urlencode(kw)
    err = None
    for attempt in range(5):
        try:
            time.sleep(1.2)
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            err = e
            time.sleep(20 * (attempt + 1))
    raise RuntimeError(f"api failed: {err}")


def work_info(text):
    """the raw lines between WORK INFO and COMMENTS (wikitext, templates and all)"""
    start = text.find("*****WORK INFO*****")
    end = text.find("*****COMMENTS*****")
    return text[start + 19 : end] if start >= 0 and end > start else ""


def main():
    titles = set()
    for f in ("data/build/catalogue.json", "data/build/chamber.json"):
        for p in json.loads((ROOT / f).read_text())["pieces"]:
            if p.get("imslpPage"):
                titles.add(p["imslpPage"])
    todo = sorted(t for t in titles if not (OUT / f"{key(t)}.json").exists())
    print(f"{len(titles)} IMSLP pages, {len(todo)} to fetch", flush=True)
    done = missing = 0
    for i in range(0, len(todo), BATCH):
        batch = todo[i : i + BATCH]
        d = api(action="query", titles="|".join(batch), prop="revisions", rvprop="content", redirects=1)
        q = d.get("query", {})
        # the API answers under the normalised, redirected title: map it back to the title we asked for
        back = {t: t for t in batch}
        for n in q.get("normalized", []):
            back[n["to"]] = back.get(n["from"], n["from"])
        for r in q.get("redirects", []):
            back[r["to"]] = back.get(r["from"], r["from"])
        seen = set()
        for p in q.get("pages", {}).values():
            asked = back.get(p["title"], p["title"])
            seen.add(asked)
            info = work_info(p["revisions"][0]["*"]) if "revisions" in p else ""
            if not info:
                missing += 1
            (OUT / f"{key(asked)}.json").write_text(json.dumps({"title": asked, "page": p["title"], "info": info}, ensure_ascii=False))
        for t in batch:
            if t not in seen:  # no page came back for it: record that, so it is not asked again
                missing += 1
                (OUT / f"{key(t)}.json").write_text(json.dumps({"title": t, "page": None, "info": ""}))
        done += len(batch)
        if done % 500 < BATCH:
            print(f"{done}/{len(todo)} ({missing} without a work-info block)", flush=True)
    print(f"done: {done}, {missing} without a work-info block", flush=True)


if __name__ == "__main__":
    main()
