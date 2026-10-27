#!/usr/bin/env python3
"""Finds the IMSLP page ("Score on IMSLP") for works that have none, and writes it where the builds read it:
data/chamber/works.json (imslpPage) for chamber works, data/imslp-pages.json for violin works.

1. The chamber benchmarks: the census found their pages (data/chamber/census/benchmark-matches.json) but never wrote them
   into works.json.
2. Chamber works added by the curators: matched against the census's IMSLP chamber pages (candidates.jsonl) by composer
   and catalogue number, or by composer, genre, number and key when there is no catalogue number.
3. What is left, if it could be on IMSLP (chamber: composed by 1930 or undated; violin: the composer died by 1960, not an
   arrangement): every work page in the composer's IMSLP category (the violin harvest's cached lists, data/cache/imslp-all,
   or the category itself, cached in data/cache/imslp-composer-pages/), linked when exactly one page passes the same check.
   (IMSLP's text search finds nothing for a full title, so it is not used.)

A match needs the composer and either the catalogue number (a set's page counts for a work in the set) or, without one,
the genre, number and key. Anything less stays unlinked. The report (data/cache/imslp-links-report.json) lists every
link and how it was found.
    python3 scripts/imslp_links.py [--no-search]
"""
import hashlib
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data/cache/imslp-composer-pages"
UA = "ArcoAtlas/1.0 (+https://atlas.arco.app) catalogue research"


def fold(s):
    return unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()


FILLER = {"in", "a", "for", "and", "the", "of", "major", "minor", "flat", "sharp", "with", "de", "et", "la", "le", "von", "and"}
KEY = re.compile(r"\bin ([a-g](?:[- ](?:flat|sharp))? (?:major|minor))")
SET = re.compile(r"^\s*(\d+|two|three|four|five|six|twelve)\b|\b(quartets|quintets|trios|sonatas|duets|duos|pieces|sextets|divertimenti|serenades|sonatinas|partitas|suites|concertos|variations)\b")


def norm_title(t):
    """folded, nicknames and notes in brackets dropped, "Op. 7 No. 4" glued into "op7 no4" """
    t = re.sub(r"\(.*?\)|\[.*?\]", " ", fold(t))
    # a catalogue prefix and its number become one token: "hob. xv:c1" → "hobxv:c1", "twv 43:b3" → "twv43:b3"
    t = re.sub(r"\b([a-z]{1,8})\.?\s*(?=[a-z]{0,4}:?[a-z]?\d)", lambda m: m.group(1) if m.group(1) not in FILLER - {"a"} else m.group(0), t)
    return t


def ids(t):
    """catalogue numbers and numbers ("op44", "no4", "k581", "a5"), without a set's leading count ("6 String Quartets")"""
    t = re.sub(r"^\s*\d+\s+(?=[a-z])", "", t)
    return {x.replace(".", "") for x in re.findall(r"[a-z:]*\d[\w:.\-/]*", t)} - {""}


def words(t):
    return {w.rstrip("s") if len(w) > 4 else w for w in re.findall(r"[a-z]{3,}", re.sub(r"[a-z:]*\d[\w:.\-/]*", " ", t))} - FILLER - {"divertimenti"} | (
        {"divertimento"} if "divertimenti" in t else set()
    )


def page_parts(page):
    """'String Quartet in C major, Op.7 No.4 (Albrechtsberger, Johann Georg)' → (title, composer)"""
    m = re.match(r"^(.*)\s+\(([^()]*)\)\s*$", page)
    return (m.group(1), m.group(2)) if m else (page, "")


def person(composer):
    """'Last, First' or 'First Last' → ('last', 'f')"""
    c = re.sub(r"\b(jr|sr|the younger|the elder)\b\.?", "", fold(composer)).strip(" ,")
    if "," in c:
        last, first = c.split(",", 1)
    else:
        parts = c.split()
        last, first = (parts[-1], " ".join(parts[:-1])) if parts else ("", "")
    return last.strip(), first.strip()[:1]


def matches(title, composer, page):
    """Whether an IMSLP page is this work: the composer (surname and first initial), every number the page carries, the
    genre words, and the key where both give one. A set's page ("6 String Quartets, Op.1") counts for a work in it."""
    ptitle, pcomp = page_parts(page)
    (l1, f1), (l2, f2) = person(composer), person(pcomp)
    if not pcomp or l1 != l2 or (f1 and f2 and f1 != f2):
        return False
    a, b = norm_title(title), norm_title(ptitle)
    if re.search(r"\barr\b|\btransc", b) and not re.search(r"\barr\b|\btransc", a):
        return False
    ia, ib = ids(a), ids(b)
    ka, kb = KEY.findall(a), KEY.findall(b)
    if ka and kb and ka[0] != kb[0]:
        return False
    wa, wb = words(a), words(b)
    # the same kind of work: one title's words within the other's ("Concerto" in "Violin Concerto"), or mostly shared
    if not (wa and wb and (wa <= wb or wb <= wa or len(wa & wb) / len(wa | wb) >= 0.5)):
        return False
    if ib:
        if not ib <= ia:
            return False  # the page names a number we do not have
        rest = ia - ib
        if rest and not all(x.startswith("no") for x in rest) and any(x.startswith(("op", "no")) for x in ib) and not any(
            not x.startswith(("op", "no")) for x in ib
        ):
            return False  # "Op.3" against our "Op. 3 No. 5, Hob. …": only a set's page may leave numbers out
        if any(x.startswith("no") for x in rest) and not SET.search(b) and not any(not x.startswith(("op", "no")) for x in ib):
            return False
        return True
    if ia:
        return False  # we have a number the page does not confirm
    return bool(ka and kb)  # no numbers on either side: the key has to agree


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", fold(name)).strip("-")


RESOLVE = json.loads((ROOT / "data/cache/imslp-all/resolve.json").read_text()) if (ROOT / "data/cache/imslp-all/resolve.json").exists() else {}
HOUSE_TO_IMSLP = {v: k for k, v in json.loads((ROOT / "data/chamber/imslp-composers.json").read_text()).items() if not k.startswith("_")}


def fetch_category(category):
    """every work page in IMSLP's category for a composer; [] when there is none"""
    CACHE.mkdir(parents=True, exist_ok=True)
    f = CACHE / f"{slug(category)}.json"
    if f.exists():
        return json.loads(f.read_text())
    titles, cont = [], None
    while True:
        params = {"action": "query", "list": "categorymembers", "cmtitle": f"Category:{category}", "cmnamespace": 0, "cmlimit": 500, "format": "json"}
        if cont:
            params["cmcontinue"] = cont
        url = "https://imslp.org/api.php?" + urllib.parse.urlencode(params)
        for attempt in range(5):
            try:
                with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=30) as r:
                    data = json.load(r)
                break
            except Exception:
                time.sleep(10 * (attempt + 1))  # IMSLP answers a busy moment with an error page
        else:
            return None  # not cached: tried again on the next run
        titles += [m["title"] for m in data.get("query", {}).get("categorymembers", [])]
        time.sleep(1.2)
        cont = data.get("continue", {}).get("cmcontinue")
        if not cont:
            break
    f.write_text(json.dumps(titles, ensure_ascii=False))
    return titles


def composer_pages(composer):
    """IMSLP's work pages for a composer: the violin harvest's cached list when it has the composer, else the category"""
    r = RESOLVE.get(composer)
    if r and r.get("category"):
        cached = ROOT / f"data/cache/imslp-all/pages/{slug(r['category'])}.json"
        if cached.exists():
            return [row["title"] for row in json.loads(cached.read_text()).get("rows", [])]
    pages = fetch_category(HOUSE_TO_IMSLP.get(composer, composer))
    return pages or []


def year_of(s):
    m = re.search(r"\d{4}", str(s or ""))
    return int(m.group()) if m else None


def main():
    do_search = "--no-search" not in sys.argv
    works_path = ROOT / "data/chamber/works.json"
    works = json.loads(works_path.read_text())
    pages_path = ROOT / "data/imslp-pages.json"
    violin_pages = json.loads(pages_path.read_text())
    violin = json.loads((ROOT / "data/build/catalogue.json").read_text())["pieces"]
    report = []

    # 1. the benchmarks' pages, from the census
    bench = {m["id"]: m["imslpPage"] for m in json.loads((ROOT / "data/chamber/census/benchmark-matches.json").read_text()) if m.get("imslpPage")}
    for w in works:
        if "imslpPage" not in w and w["id"] in bench:
            w["imslpPage"] = bench[w["id"]]
            report.append({"id": w["id"], "page": w["imslpPage"], "how": "benchmark"})

    # 2. the census's pages, by composer
    by_composer = {}
    for line in (ROOT / "data/chamber/census/candidates.jsonl").open():
        c = json.loads(line)
        by_composer.setdefault(person(c["composer"])[0], []).append(c["title"])
    for w in works:
        if "imslpPage" in w or w.get("violinId"):
            continue
        found = [p for p in by_composer.get(person(w["composer"])[0], []) if matches(w["title"], w["composer"], p)]
        hit = found[0] if len(found) == 1 else None  # two pages that both fit: leave it
        if hit:
            w["imslpPage"] = hit
            report.append({"id": w["id"], "page": hit, "how": "census"})

    # 3. IMSLP's search for what could be there
    todo = []
    for w in works:
        if "imslpPage" in w or w.get("violinId"):
            continue
        y = year_of(w.get("year"))
        if y is None or y <= 1930:
            todo.append(("chamber", w, w["title"], w["composer"]))
    for p in violin:
        if p.get("imslpPage") or str(p["id"]) in violin_pages or re.search(r"\barr\.|transcr", p["title"], re.I):
            continue
        died = [int(x) for x in re.findall(r"\d{4}", p.get("dates") or "")]
        if (len(died) >= 2 and died[1] <= 1960) or (len(died) == 1 and died[0] <= 1885 and not (p.get("dates") or "").startswith("b.")):
            todo.append(("violin", p, p["title"], p["composer"]))
    print(f"benchmarks {sum(r['how'] == 'benchmark' for r in report)}, census {sum(r['how'] == 'census' for r in report)}; {len(todo)} to search")
    unmatched = []
    if do_search:
        for i, (section, item, title, composer) in enumerate(todo):
            found = sorted({p for p in composer_pages(composer) if matches(title, composer, p)})
            if len(found) == 1:
                if section == "chamber":
                    item["imslpPage"] = found[0]
                else:
                    violin_pages[str(item["id"])] = found[0]
                report.append({"id": item["id"], "page": found[0], "how": "composer pages"})
            else:
                unmatched.append({"id": item["id"], "section": section, "title": title, "composer": composer, "candidates": found[:3]})
            if i % 200 == 199:
                print(f"  {i + 1}/{len(todo)} checked, {sum(r['how'] == 'composer pages' for r in report)} found", flush=True)

    # a page that is not a set's, found for two works (or already another work's): neither is sure, so both stay unlinked
    taken = {}
    for w in works:
        if w.get("imslpPage"):
            taken.setdefault(w["imslpPage"], []).append(("chamber", w["id"]))
    for vid, pg in violin_pages.items():
        taken.setdefault(pg, []).append(("violin", int(vid)))
    found_how = {r["id"]: r for r in report}
    drop = {i for pg, users in taken.items() if len(users) > 1 and not SET.search(norm_title(page_parts(pg)[0]))
            for _, i in users if found_how.get(i, {}).get("how") in ("census", "composer pages")}
    for w in works:
        if w["id"] in drop:
            del w["imslpPage"]
    for i in drop:
        violin_pages.pop(str(i), None)
    report = [r for r in report if r["id"] not in drop]
    unmatched += [{"id": i, "dropped": "page shared with another work"} for i in sorted(drop)]

    works_path.write_text(json.dumps(works, ensure_ascii=False, indent=1) + "\n")
    pages_path.write_text(json.dumps(dict(sorted(violin_pages.items(), key=lambda kv: int(kv[0]))), ensure_ascii=False, indent=1) + "\n")
    out = ROOT / "data/cache/imslp-links-report.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps({"linked": report, "unmatched": unmatched}, ensure_ascii=False, indent=1))
    counts = {h: sum(r["how"] == h for r in report) for h in ("benchmark", "census", "composer pages")}
    print(f"linked {len(report)} ({counts}); {len(unmatched)} searched without a confident match; report: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
