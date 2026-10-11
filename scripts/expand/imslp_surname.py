#!/usr/bin/env python3
"""Step 4b of the IMSLP link pass: every IMSLP work page with the composer's surname in its title.

IMSLP's category lists are incomplete (pages sit under spelling variants such as "Hubay, Jenö" / "Hubay, Jenő", or in no composer category at all),
but page titles always end in "(Surname, Given)". A title search for the surname lists them all, 500 per call.

Reads   data/cache/imslp-all/resolve.json, public/data/catalogue.json
Writes  data/cache/imslp-all/surname/<composer slug>.json   {"composer", "titles": [...]}   (titles only; the matcher judges them like any candidate list)
Only composers that still have a work without a page are searched. Titles whose "(Surname, Given)" does not start with the catalogue's given-name
initial are dropped (other people with the same surname). Usage: python3 imslp_surname.py [--redo] [--reverse] [composer substring ...]
"""
import json, re, sys, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from imslp_harvest_all import call, next_cont, slug, ROOT  # noqa: E402

OUT = ROOT / "data/cache/imslp-all/surname"
OUT.mkdir(parents=True, exist_ok=True)
SKIP = re.compile(r"^(ABRSM|AMEB|The Royal|Royal Irish|Trinity|Traditional|Various)")


def strip(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def surname_of(composer):
    return composer.split(",")[0].strip()


def titles_for(sur):
    out, off = [], 0
    while True:
        d = call({"action": "query", "list": "search", "srsearch": sur, "srnamespace": 0, "srlimit": 500, "sroffset": off, "srwhat": "title"})
        hits = d.get("query", {}).get("search", [])
        out += [h["title"] for h in hits]
        nxt = next_cont(d)
        if not nxt or not hits or off > 6000:
            return out
        off = nxt.get("sroffset", off + 500)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    cat = json.load(open(ROOT / "public/data/catalogue.json"))["pieces"]
    comps = sorted({p["composer"] for p in cat if not p.get("imslpPage") and not SKIP.match(p["composer"])})
    comps = [c for c in comps if not args or any(a.lower() in c.lower() for a in args)]
    if "--reverse" in sys.argv:
        comps.reverse()
    print(len(comps), "composers", flush=True)
    for n, c in enumerate(comps):
        f = OUT / f"{slug(c)}.json"
        if f.exists() and "--redo" not in sys.argv:
            continue
        sur = surname_of(c)
        given = c.partition(",")[2].strip()
        initial = strip(given)[:1]
        queries = list(dict.fromkeys([sur, unicodedata.normalize("NFKD", sur).encode("ascii", "ignore").decode()]))
        titles = []
        for q in queries:
            if q:
                titles += titles_for(q)
        keep = []
        pat = strip(sur)
        for t in dict.fromkeys(titles):
            m = re.search(r"\(([^()]*)\)\s*$", t)
            if not m:
                continue
            who = strip(m.group(1))
            if not who.startswith(pat):
                continue
            g = who[len(pat):].lstrip(", ").strip()
            if initial and g and g[:1] != initial:
                continue
            keep.append(t)
        f.write_text(json.dumps({"composer": c, "titles": keep}, ensure_ascii=False))
        if n % 25 == 0 or len(keep) > 300:
            print(f"{n}/{len(comps)} {c}: {len(keep)} titles", flush=True)
    print("done", flush=True)


if __name__ == "__main__":
    main()
