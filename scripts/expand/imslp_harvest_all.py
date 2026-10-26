#!/usr/bin/env python3
"""Step 2 of the IMSLP link pass: list every work page of the resolved composers, with the facts the matcher needs.

Reads   data/cache/imslp-all/resolve.json          (from imslp_resolve.py)
Writes  data/cache/imslp-all/pages/<slug>.json     [{title, pageid, info{Work Title, Opus/Catalogue Number, Instrumentation, ...},
                                                      nfiles, arrs[{heading, arrangers}], cats[...]}]
Resumable (existing files are skipped; --refresh redoes them). Polite: 2 workers, a pause per call, a descriptive User-Agent.
Pages come in batches of 10 titles; for very large catalogues (> BIG members) only pages in a violin-ish category are fetched in full.
"""
import json, re, sys, time, unicodedata, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

UA = "ArcoAtlas/1.0 (+https://atlas.arco.app) catalogue research"
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "data/cache/imslp-all/pages"
OUT.mkdir(parents=True, exist_ok=True)
BIG = 4000
FIELDS = [
    "Work Title", "Alternative Title", "Opus/Catalogue Number", "Key", "Number of Movements/Sections", "Year/Date of Composition",
    "Year of First Publication", "Piece Style", "Average Duration", "Instrumentation", "InstrDetail", "Tags",
]
NOISE = re.compile(r"^(Scores (from|published by|contributed)|Works first published|.*/Editor$|.*/Arranger$|.*/Translator$|.*/Librettist$|WorkNonPD|Pages with|Pending)", re.I)


def slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def call(params):
    params["format"] = "json"
    url = "https://imslp.org/api.php?" + urllib.parse.urlencode(params)
    for attempt in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=120) as r:
                d = json.load(r)
            time.sleep(0.7)
            return d
        except Exception:  # noqa: BLE001
            time.sleep(3 * (attempt + 1))
    raise RuntimeError("IMSLP request failed: " + url)


def next_cont(d):
    """IMSLP's API pages with the old 'query-continue' format (not 'continue'): handle both"""
    if "continue" in d:
        return d["continue"]
    qc = d.get("query-continue")
    if qc:
        out = {}
        for v in qc.values():
            out.update(v)
        return out
    return None


def members(cat):
    out, cont = [], {}
    while True:
        d = call({"action": "query", "list": "categorymembers", "cmtitle": cat, "cmlimit": 500, "cmnamespace": 0, **cont})
        out += [(m["title"], m["pageid"]) for m in d.get("query", {}).get("categorymembers", [])]
        cont = next_cont(d)
        if not cont:
            return out


def clean(v):
    v = re.sub(r"<br\s*/?>", "; ", v)
    v = re.sub(r"\{\{[^{}|]*\|([^{}]*)\}\}", r"\1", v)
    v = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", v)
    v = re.sub(r"\{\{[^{}]*\}\}", "", v)
    v = re.sub(r"'''?", "", v)
    return re.sub(r"\s+", " ", v).strip()


def work_info(text):
    m = re.search(r"\*{5}WORK INFO\*{5}(.*?)(?:\*{5}COMMENTS\*{5}|\Z)", text, re.S)
    if not m:
        return {}
    parts = re.split(r"\n\|([A-Za-z/ ]+)=", "\n" + m.group(1))
    info = {}
    for i in range(1, len(parts) - 1, 2):
        k, v = parts[i].strip(), clean(parts[i + 1])
        if k in FIELDS and v:
            info[k] = v[:300]
    return info


def arrangements(text):
    m = re.search(r"===\s*Arrangements and Transcriptions\s*===(.*)", text, re.S)
    if not m:
        return []
    sect = re.split(r"\n\| \*{5}WORK INFO", m.group(1))[0]
    out = []
    for h in re.finditer(r"\n={3,6}\s*([^=\n]+?)\s*={3,6}\s*\n(.*?)(?=\n={3,6}\s*[^=\n]+?\s*={3,6}\s*\n|\Z)", "\n" + sect, re.S):
        title, body = h.group(1), h.group(2)
        arrs = [clean(a) for a in re.findall(r"\|Arranger=([^\n]*)", body)]
        out.append({"heading": clean(title), "arrangers": sorted(set(re.sub(r"\(\d{4}[^)]*\)", "", a).strip() for a in arrs if a))[:4],
                    "nfiles": len(re.findall(r"\|File Name \d+=", body))})
    return out


def fetch(batch):
    titles = [t for t, _ in batch]
    pages = {}
    cont = {}
    while True:
        d = call({"action": "query", "titles": "|".join(titles), "prop": "revisions|categories", "rvprop": "content", "cllimit": "max", **cont})
        for p in d.get("query", {}).get("pages", {}).values():
            rec = pages.setdefault(p["title"], {"pageid": p.get("pageid"), "text": "", "cats": []})
            if p.get("revisions"):
                rec["text"] = p["revisions"][0].get("*", "")
            rec["cats"] += [c["title"].removeprefix("Category:") for c in p.get("categories", [])]
        cont = next_cont(d)
        if not cont:
            break
    out = []
    for t, pid in batch:
        rec = pages.get(t)
        if rec is None:
            continue
        text = rec["text"]
        out.append({
            "title": t, "pageid": pid, "info": work_info(text),
            "nfiles": len(re.findall(r"\|File Name \d+=", text)),
            "arrs": arrangements(text),
            "cats": [c for c in rec["cats"] if not NOISE.search(c)],
        })
    return out


def violinish(cats):
    return any(re.search(r"violin|For 2 players|duets", c, re.I) for c in cats)


def harvest(composer, category):
    f = OUT / f"{slug(category)}.json"
    if f.exists() and "--refresh" not in sys.argv:
        return 0
    cat = "Category:" + category
    mem = members(cat)
    sur = category.split(",")[0]
    mem += [(t, i) for t, i in members(cat + "/Collections") if f"({category})" in t or f"({sur}" in t]
    mem = sorted(set(mem))
    if len(mem) > BIG:  # pre-filter by category membership only (cheap), then fetch just the violin-ish pages
        keep = []
        for i in range(0, len(mem), 50):
            chunk = mem[i:i + 50]
            cats, cont = {}, {}
            while True:
                d = call({"action": "query", "titles": "|".join(t for t, _ in chunk), "prop": "categories", "cllimit": "max", **cont})
                for p in d.get("query", {}).get("pages", {}).values():
                    cats.setdefault(p["title"], []).extend(c["title"] for c in p.get("categories", []))
                cont = next_cont(d)
                if not cont:
                    break
            keep += [(t, pid) for t, pid in chunk if violinish(cats.get(t, []))]
        mem = keep
    rows = []
    for i in range(0, len(mem), 10):
        rows += fetch(mem[i:i + 10])
    f.write_text(json.dumps({"composer": composer, "category": category, "rows": rows}, ensure_ascii=False))
    return len(rows)


def main():
    res = json.load(open(ROOT / "data/cache/imslp-all/resolve.json"))
    only = [a for a in sys.argv[1:] if not a.startswith("--")]
    todo = [(c, v["category"]) for c, v in res.items() if v.get("category") and (not only or c in only)]
    todo.sort(key=lambda x: res[x[0]]["size"])  # small catalogues first
    print(f"{len(todo)} composers", flush=True)
    total = 0
    def one(item):
        c, cat = item
        n = harvest(c, cat)
        print(f"{c}: {n} pages", flush=True)
        return n
    with ThreadPoolExecutor(2) as ex:
        for n in ex.map(one, todo):
            total += n
    print("done", total, flush=True)


if __name__ == "__main__":
    main()
