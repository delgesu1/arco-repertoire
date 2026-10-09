"""Harvest every IMSLP work page of the target composers, with each page's categories.

Reads   data/expansion/imslp-categories.json   {catalogue composer name: IMSLP category name}
Writes  data/cache/imslp/<n>.json              {"composer", "category", "pages": {title: {"pageid", "cats": [...]}}}
Resumable: composers with a cache file are skipped (delete the file to refresh).
Polite: two workers, a short pause between calls, a descriptive User-Agent.
"""
import json
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data" / "cache" / "imslp"
OUT.mkdir(parents=True, exist_ok=True)
UA = "ArcoRepertoire/1.0 (+https://repertoire.arco.app) catalogue research"


def api(**kw):
    kw["format"] = "json"
    url = "https://imslp.org/api.php?" + urllib.parse.urlencode(kw)
    for attempt in range(5):
        try:
            time.sleep(0.4)
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r:
                return json.load(r)
        except Exception as e:  # noqa: BLE001
            time.sleep(3 * (attempt + 1))
            err = e
    raise RuntimeError(f"api failed: {err}")


def members(category):
    titles, cont = [], None
    while True:
        kw = dict(action="query", list="categorymembers", cmtitle=f"Category:{category}", cmlimit=500, cmtype="page")
        if cont:
            kw["cmcontinue"] = cont
        d = api(**kw)
        titles += [(m["title"], m["pageid"]) for m in d["query"]["categorymembers"]]
        cont = d.get("query-continue", {}).get("categorymembers", {}).get("cmcontinue")
        if not cont:
            return titles


def categories(batch):
    """categories of up to 20 pages, following continuation"""
    got = {}
    cont = None
    while True:
        kw = dict(action="query", titles="|".join(t for t, _ in batch), prop="categories", cllimit=500)
        if cont:
            kw["clcontinue"] = cont
        d = api(**kw)
        for p in d["query"]["pages"].values():
            got.setdefault(p["title"], []).extend(c["title"].removeprefix("Category:") for c in p.get("categories", []))
        cont = d.get("query-continue", {}).get("categories", {}).get("clcontinue")
        if not cont:
            return got


def harvest(name, category):
    safe = category.replace(", ", "_").replace(" ", "_").replace("/", "_")
    out = OUT / f"{safe}.json"
    if out.exists():
        return name, "cached"
    mem = members(category)
    pages = {t: {"pageid": pid, "cats": []} for t, pid in mem}
    for i in range(0, len(mem), 20):
        for t, cats in categories(mem[i : i + 20]).items():
            if t in pages:
                pages[t]["cats"] = cats
    out.write_text(json.dumps({"composer": name, "category": category, "pages": pages}, ensure_ascii=False))
    return name, f"{len(pages)} pages"


def main():
    cats = json.load(open(ROOT / "data" / "expansion" / "imslp-categories.json"))
    only = set(sys.argv[1:])
    todo = [(k, v) for k, v in cats.items() if v and (not only or k in only)]
    with ThreadPoolExecutor(2) as ex:
        for name, status in ex.map(lambda a: harvest(*a), todo):
            print(name, status, flush=True)


if __name__ == "__main__":
    main()
