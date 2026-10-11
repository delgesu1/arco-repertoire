#!/usr/bin/env python3
"""Step 4 of the IMSLP link pass: a title search for works whose composer has no IMSLP category (or no usable one).

Reads   data/cache/imslp-all/resolve.json, public/data/catalogue.json
Writes  data/cache/imslp-all/pages/search--<composer slug>.json   same row format as imslp_harvest_all.py, built from search hits
IMSLP page titles end in "(Surname, Given)", so a title search for "<surname> <title words>" finds a work even when the composer's
category is under another spelling. The matcher (imslp_match.ts) then judges the hits like any other candidate list.
Usage: python3 imslp_search.py [--redo] [--all] [--reverse] [composer substring ...]
  --all   also search for the unlinked works of composers that do have a category (a second chance for pages filed elsewhere)
"""
import json, re, sys, time, unicodedata, urllib.parse, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from imslp_harvest_all import call, fetch, slug, OUT, ROOT  # noqa: E402

STOP = set("a an and the of in for to from with by on at no nos op opus major minor flat sharp violin violins piano orchestra solo arr arranged transcribed et und di de la le der die das des".split())


def strip(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def terms(title):
    t = re.sub(r"\(.*?\)", " ", title)
    nums = re.findall(r"(?:Op|BWV|RV|K|Hob|Sz|H|L|B|D|WoO|MS)\.?\s*(\d+[a-z]?)", t)
    ws = [w for w in re.sub(r"[^\w]+", " ", strip(t)).split() if w not in STOP and not w.isdigit() and len(w) > 2]
    return ws[:3], nums[:1]


def search(query):
    d = call({"action": "query", "list": "search", "srsearch": query, "srnamespace": 0, "srlimit": 8, "srwhat": "title"})
    return [(x["title"], x.get("pageid")) for x in d.get("query", {}).get("search", [])]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    redo = "--redo" in sys.argv
    res = json.load(open(ROOT / "data/cache/imslp-all/resolve.json"))
    cat = json.load(open(ROOT / "public/data/catalogue.json"))["pieces"]
    by = {}
    for p in cat:
        if p.get("imslpPage") or (res.get(p["composer"], {}).get("category") and "--all" not in sys.argv):
            continue
        if re.match(r"^(ABRSM|AMEB|The Royal|Royal Irish|Trinity|Traditional|Various)", p["composer"]):
            continue
        by.setdefault(p["composer"], []).append(p)
    todo = [c for c in by if not args or any(a.lower() in c.lower() for a in args)]
    if "--reverse" in sys.argv:
        todo.reverse()  # a second instance can work from the other end; finished composers are skipped
    print(len(todo), "composers,", sum(len(by[c]) for c in todo), "works", flush=True)
    for n, c in enumerate(todo):
        f = OUT / f"search--{slug(c)}.json"
        if f.exists() and not redo:
            continue
        sur = strip(c.split(",")[0])
        sur = re.sub(r"[^a-z ]", " ", sur).split()
        sur = sur[-1] if sur else ""
        hits = {}
        for p in by[c]:
            ws, nums = terms(p["title"])
            for q in dict.fromkeys([" ".join([sur] + ws[:2]), " ".join([sur] + ws[:1] + nums)] if ws else [sur + " " + " ".join(nums)]):
                if not q.strip() or q.strip() == sur:
                    continue
                for t, pid in search(q):
                    if sur and sur in strip(t):
                        hits[t] = pid
        rows = []
        items = sorted(hits.items())
        for i in range(0, len(items), 10):
            rows += fetch(items[i:i + 10])
        f.write_text(json.dumps({"composer": c, "category": None, "rows": rows}, ensure_ascii=False))
        if rows or n % 40 == 0:
            print(f"{n}/{len(todo)} {c}: {len(rows)} candidate pages", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
