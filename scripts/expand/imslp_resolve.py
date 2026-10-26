#!/usr/bin/env python3
"""Step 1 of the IMSLP link pass: which catalogue composers have an IMSLP category, under which name?

Reads   public/data/catalogue.json   (composers that still have a piece without an exact page)
Writes  data/cache/imslp-all/resolve.json   {composer: {"category": name|null, "size": n, "tried": [...]}}
Exact "Category:<catalogue name>" first (50 per call, prop=categoryinfo); the misses get name variants
(accent-stripped, given name dropped, "de"/"van" particles moved) and then an IMSLP category search for the surname.
Run again to resume: composers already resolved are kept.
"""
import json, re, sys, time, unicodedata, urllib.parse, urllib.request
from pathlib import Path

UA = "ArcoAtlas/1.0 (+https://atlas.arco.app) catalogue research"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data/cache/imslp-all/resolve.json"


def call(params):
    params["format"] = "json"
    url = "https://imslp.org/api.php?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r:
                d = json.load(r)
            time.sleep(0.7)
            return d
        except Exception:  # noqa: BLE001
            time.sleep(2 + 3 * attempt)
    raise SystemExit("IMSLP request failed: " + url)


def info(names):
    """{category name: size in pages} for the names that exist (size counts pages, not subcategories/files)"""
    out = {}
    for i in range(0, len(names), 50):
        chunk = names[i:i + 50]
        d = call({"action": "query", "titles": "|".join("Category:" + n for n in chunk), "prop": "categoryinfo"})
        q = d.get("query", {})
        norm = {n["to"]: n["from"] for n in q.get("normalized", [])}
        for p in q.get("pages", {}).values():
            if "missing" in p and "categoryinfo" not in p:
                continue
            ci = p.get("categoryinfo")
            if ci is None:
                continue
            name = p["title"].removeprefix("Category:")
            out[norm.get("Category:" + name, "Category:" + name).removeprefix("Category:")] = ci.get("pages", 0)
    return out


def strip_accents(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def variants(name):
    v = [name, strip_accents(name)]
    if "," in name:
        sur, given = [x.strip() for x in name.split(",", 1)]
        v += [f"{sur}, {given.split()[0]}", f"{strip_accents(sur)}, {strip_accents(given.split()[0])}"]
        # "de Bériot" style particles: IMSLP files "Bériot, Charles de"; catalogue may already match
    return list(dict.fromkeys(v))


def main():
    cat = json.load(open(ROOT / "public/data/catalogue.json"))["pieces"]
    need = sorted({p["composer"] for p in cat if not p.get("imslpPage")})
    res = json.load(open(OUT)) if OUT.exists() else {}
    todo = [c for c in need if c not in res]
    print(f"{len(need)} composers with unlinked pieces, {len(todo)} to resolve")
    exact = info(todo)
    for c in todo:
        if exact.get(c, 0) > 0:
            res[c] = {"category": c, "size": exact[c], "tried": [c]}
    miss = [c for c in todo if c not in res]
    print(f"exact hits {len(todo) - len(miss)}, misses {len(miss)}")
    allv = {c: variants(c) for c in miss}
    found = info(sorted({x for vs in allv.values() for x in vs}))
    for c in miss:
        hit = next((x for x in allv[c] if found.get(x, 0) > 0), None)
        if hit:
            res[c] = {"category": hit, "size": found[hit], "tried": allv[c]}
    miss = [c for c in miss if c not in res]
    print(f"after variants, misses {len(miss)}")
    for c in miss:
        sur = c.split(",")[0]
        cands = []
        d = call({"action": "query", "list": "allcategories", "acprefix": sur, "aclimit": 50})
        cands += [x["*"] for x in d.get("query", {}).get("allcategories", [])]
        if strip_accents(sur) != sur:
            d = call({"action": "query", "list": "allcategories", "acprefix": strip_accents(sur), "aclimit": 50})
            cands += [x["*"] for x in d.get("query", {}).get("allcategories", [])]
        # keep person-like categories ("Surname, Given"), not "Surname/Collections" or topical ones
        cands = [x for x in dict.fromkeys(cands) if "," in x and "/" not in x and x.split(",")[0].strip().lower() == sur.lower() or strip_accents(x.split(",")[0]).lower() == strip_accents(sur).lower() and "," in x and "/" not in x]
        sizes = info(cands) if cands else {}
        res[c] = {"category": None, "size": 0, "tried": variants(c), "candidates": {k: sizes.get(k, 0) for k in cands if sizes.get(k, 0) > 0}}
    OUT.write_text(json.dumps(res, ensure_ascii=False, indent=1))
    ok = sum(1 for v in res.values() if v["category"])
    amb = sum(1 for v in res.values() if not v["category"] and v.get("candidates"))
    print(f"resolved {ok}, unresolved with candidates {amb}, unresolved with none {len(res) - ok - amb}")


if __name__ == "__main__":
    main()
