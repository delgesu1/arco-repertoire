#!/usr/bin/env python3
"""
Lists everything IMSLP holds under one author's category, with the work-info facts that matter for catalogue research.

  python3 scripts/expand/imslp_author.py "Ševčík, Otakar"            # prints a table, caches data/cache/imslp-authors/<slug>.json
  python3 scripts/expand/imslp_author.py --search "Sevcik"            # finds category names containing the text
  python3 scripts/expand/imslp_author.py "Ševčík, Otakar" --grep "Violin|School"   # only titles matching the regex

Polite: one request at a time, a pause between calls, descriptive User-Agent (no personal data).
"""
import json, re, sys, time, urllib.parse, urllib.request, unicodedata
from pathlib import Path

UA = "ArcoRepertoire/1.0 (+https://repertoire.arco.app) catalogue research"
API = "https://imslp.org/api.php"
ROOT = Path(__file__).resolve().parents[2]

def call(params):
    url = API + "?" + urllib.parse.urlencode(params)
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r:
                data = json.load(r)
            time.sleep(0.8)
            return data
        except Exception as e:  # noqa
            time.sleep(2 + attempt * 3)
    raise SystemExit(f"IMSLP request failed: {url}")

def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def search_categories(text):
    out = []
    d = call({"action": "query", "list": "search", "srsearch": f"intitle:{text}", "srnamespace": 14, "srlimit": 30, "format": "json"})
    for x in d.get("query", {}).get("search", []):
        out.append(x["title"])
    d = call({"action": "query", "list": "allcategories", "acprefix": text[:1].upper() + text[1:], "aclimit": 30, "format": "json"})
    out += ["Category:" + x["*"] for x in d.get("query", {}).get("allcategories", [])]
    return sorted(set(out))

FIELDS = ["Work Title", "Alternative Title", "Opus/Catalogue Number", "Instrumentation", "Number of Movements/Sections", "Year/Date of Composition", "Year of First Publication", "Piece Style", "Tags", "Average Duration"]

def info(wikitext):
    out = {}
    for f in FIELDS:
        m = re.search(r"\|" + re.escape(f) + r"=([^\n]*(?:\n(?!\|)[^\n]*)*)", wikitext)
        if m:
            v = re.sub(r"\{\{[^}]*\}\}", "", m.group(1)).strip()
            out[f] = re.sub(r"\s+", " ", v)[:300]
    return out

def members_of(cat):
    out, cont = [], {}
    while True:
        d = call({"action": "query", "list": "categorymembers", "cmtitle": cat, "cmlimit": 500, "cmnamespace": 0, "format": "json", **cont})
        out += [m["title"] for m in d.get("query", {}).get("categorymembers", [])]
        if "continue" in d: cont = d["continue"]
        else: break
    return out

def author(name, grep=None):
    cat = "Category:" + name
    members = members_of(cat)
    # IMSLP files an author's collections (étude books, caprice sets, methods) in "Category:<name>/Collections"; keep only the author's own pages
    surname = name.split(",")[0]
    members += [t for t in members_of(cat + "/Collections") if f"({name})" in t or f"({surname}" in t]
    members = sorted(set(members))
    if not members:
        return None
    rows = []
    for i in range(0, len(members), 20):
        chunk = members[i:i + 20]
        d = call({"action": "query", "titles": "|".join(chunk), "prop": "revisions|categories", "rvprop": "content", "cllimit": "max", "format": "json"})
        for p in d.get("query", {}).get("pages", {}).values():
            rev = (p.get("revisions") or [{}])[0].get("*", "")
            cats = [c["title"].replace("Category:", "") for c in p.get("categories", [])]
            rows.append({"title": p["title"], "info": info(rev), "categories": cats})
    return sorted(rows, key=lambda r: r["title"])

if __name__ == "__main__":
    a = sys.argv[1:]
    if not a: raise SystemExit(__doc__)
    if a[0] == "--search":
        print("\n".join(search_categories(a[1]))); sys.exit()
    name = a[0]
    grep = re.compile(a[a.index("--grep") + 1], re.I) if "--grep" in a else None
    rows = author(name)
    if rows is None:
        print(f"No category 'Category:{name}'. Try: --search \"{name.split(',')[0]}\""); sys.exit(1)
    (ROOT / "data/cache/imslp-authors").mkdir(parents=True, exist_ok=True)
    (ROOT / f"data/cache/imslp-authors/{slug(name)}.json").write_text(json.dumps(rows, ensure_ascii=False, indent=1))
    for r in rows:
        if grep and not grep.search(r["title"]): continue
        i = r["info"]
        gen = [c for c in r["categories"] if re.search(r"etude|exercise|stud|scale|method|school|technique|violin|for 2 violins|for violin", c, re.I)]
        print(f"{r['title']}\n    opus: {i.get('Opus/Catalogue Number','')} | instr: {i.get('Instrumentation','')} | published: {i.get('Year of First Publication','')} | mvts: {i.get('Number of Movements/Sections','')[:120]}\n    cats: {', '.join(gen[:6])}")
    print(f"\n{len(rows)} pages (cached in data/cache/imslp-authors/{slug(name)}.json)")
