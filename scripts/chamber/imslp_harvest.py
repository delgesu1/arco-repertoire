#!/usr/bin/env python3
"""Phase 2 census, step 1 (docs/chamber-music-plan.md): harvest IMSLP by scoring category, not by composer.

Lists every page in "For 3 players" … "For 9 players" and "For 2 players with continuo" … "For 8 players with continuo"
(continuo counts as one player), sweeps the scoring categories those pages use ("For 2 violins, viola, cello",
"For violin, cello, piano" …) for pages that lack the player-count category, and keeps the full facts of every page
whose original scoring (a category without "(arr)") includes a string instrument.

Reuses  data/cache/imslp-all/pages/*.json            rows already fetched by composer (scripts/expand/imslp_harvest_all.py)
Writes  data/cache/imslp-chamber/members/<cat>.json  [[title, pageid], …] per category
        data/cache/imslp-chamber/cats.jsonl          {title, pageid, cats}: categories only, for every page found
        data/cache/imslp-chamber/pages.jsonl         {title, pageid, info, nfiles, arrs, cats}: full rows of the string candidates
        data/cache/imslp-chamber/sweep.json          scoring categories checked, with their size and how many were already known
        data/cache/imslp-chamber/sweep-members.json  [[title, pageid], …] the sweep (and the benchmark links) added
        data/cache/imslp-chamber/signals/<cat>.json  titles in the floor-evidence categories (commercial recordings, first editions …)
        data/cache/imslp-chamber/benchmark-links.json  the benchmark fact-check's IMSLP links → the pages they resolve to

  python3 scripts/chamber/imslp_harvest.py [members|cats|sweep|benchmarks|pages|signals]   (no argument: all six in order)

Every step is resumable: members files are kept, and titles already in cats.jsonl / pages.jsonl / the composer cache are
skipped. Polite as the composer harvest: two workers, a pause after every call, a descriptive User-Agent.
"""
import json, re, sys, urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "expand"))
from imslp_harvest_all import NOISE, ROOT, call, fetch, members, next_cont, slug  # noqa: E402

CACHE = ROOT / "data/cache/imslp-chamber"
OLD = ROOT / "data/cache/imslp-all/pages"
TOP = [f"For {n} players" for n in range(3, 10)] + [f"For {n} players with continuo" for n in range(2, 9)]
STRING = re.compile(r"violin|viola|cello|double bass|contrabass|violone|\bviols?\b|gamba|baryton|arpeggione|\bstrings?\b|bass instrument|kit\b|pochette|lirone|lira", re.I)
SCORING = re.compile(r"^For (?!\d+ players)(.+)$")  # "For 2 violins, viola, cello" (not "For 4 players")
ENSEMBLE = re.compile(r"\bstrings\b|orchestra|chorus|\bwith\b", re.I)  # not one player to a part: the sweep skips these


def original_scorings(cats):
    """the page's original scoring categories: "For …" without "(arr)", not the player-count ones"""
    return [m.group(1) for c in cats if not c.endswith("(arr)") and (m := SCORING.match(c))]


def stringy(cats):
    return any(STRING.search(s) for s in original_scorings(cats))


def rough_parts(scoring):
    """parts in a scoring category name, counting continuo as one ("2 violins, continuo" → 3); for the sweep only"""
    n = 0
    for p in re.split(r",\s*|\s+and\s+", scoring):
        m = re.match(r"(\d+)\s", p.strip())
        n += int(m.group(1)) if m else 1
    return n


def jsonl(path):
    return [json.loads(l) for l in path.read_text().splitlines() if l.strip()] if path.exists() else []


def old_rows():
    rows = {}
    for f in sorted(OLD.glob("*.json")):
        for r in json.loads(f.read_text())["rows"]:
            rows.setdefault(r["title"], r)
    return rows


def member_file(cat):
    return CACHE / "members" / f"{slug(cat)}.json"


def step_members():
    (CACHE / "members").mkdir(parents=True, exist_ok=True)
    for cat in TOP:
        f = member_file(cat)
        if f.exists():
            continue
        mem = members("Category:" + cat)
        f.write_text(json.dumps(mem, ensure_ascii=False))
        print(f"{cat}: {len(mem)} pages", flush=True)


def all_members():
    out = {}
    for f in sorted((CACHE / "members").glob("*.json")):
        for t, pid in json.loads(f.read_text()):
            out.setdefault(t, pid)
    return out


def categories_of(batch):
    """categories only (cheap): 50 titles a call"""
    cats, cont = {}, {}
    while True:
        d = call({"action": "query", "titles": "|".join(t for t, _ in batch), "prop": "categories", "cllimit": "max", **cont})
        for p in d.get("query", {}).get("pages", {}).values():
            cats.setdefault(p["title"], []).extend(c["title"].removeprefix("Category:") for c in p.get("categories", []))
        cont = next_cont(d)
        if not cont:
            break
    return [{"title": t, "pageid": pid, "cats": [c for c in cats.get(t, []) if not NOISE.search(c)]} for t, pid in batch]


def run_batches(todo, size, fn, out_path, label):
    batches = [todo[i:i + size] for i in range(0, len(todo), size)]
    print(f"{label}: {len(todo)} pages in {len(batches)} batches", flush=True)
    done = 0
    with ThreadPoolExecutor(2) as ex, open(out_path, "a") as out:
        for rows in ex.map(fn, batches):
            for r in rows:
                out.write(json.dumps(r, ensure_ascii=False) + "\n")
            out.flush()
            done += 1
            if done % 25 == 0:
                print(f"  {label} {done}/{len(batches)}", flush=True)


def step_cats():
    known = {r["title"] for r in jsonl(CACHE / "cats.jsonl")} | {t for t, r in old_rows().items() if r["cats"]}
    mem = all_members()
    extra = CACHE / "sweep-members.json"  # pages the sweep found outside the player-count categories
    if extra.exists():
        for t, pid in json.loads(extra.read_text()):
            mem.setdefault(t, pid)
    todo = sorted((t, pid) for t, pid in mem.items() if t not in known)
    run_batches(todo, 50, categories_of, CACHE / "cats.jsonl", "cats")


def page_cats():
    """title → categories for every page found so far (the composer cache, then the category harvest)"""
    cats = {t: r["cats"] for t, r in old_rows().items() if r["cats"]}
    for r in jsonl(CACHE / "cats.jsonl"):
        cats[r["title"]] = r["cats"]
    return cats


def step_sweep():
    """scoring categories used by the string candidates, for 3–9 parts: fetch the members of any category that holds
    pages the player-count categories missed"""
    cats = page_cats()
    mem = all_members()
    extra_file = CACHE / "sweep-members.json"
    extra = dict(json.loads(extra_file.read_text())) if extra_file.exists() else {}
    found = set(mem) | set(extra)
    count = {}
    for t in found:
        for s in original_scorings(cats.get(t, [])):
            if STRING.search(s) and not ENSEMBLE.search(s) and 3 <= rough_parts(s) <= 9:
                count[s] = count.get(s, 0) + 1
    names = sorted(count)
    sizes = {}
    for i in range(0, len(names), 50):
        d = call({"action": "query", "prop": "categoryinfo", "titles": "|".join("Category:For " + s for s in names[i:i + 50])})
        for p in d.get("query", {}).get("pages", {}).values():
            sizes[p["title"].removeprefix("Category:For ")] = p.get("categoryinfo", {}).get("pages", 0)
    short = [s for s in names if sizes.get(s, 0) > count[s]]
    print(f"sweep: {len(names)} scoring categories, {len(short)} hold pages not yet found", flush=True)
    added = 0
    for s in short:
        for t, pid in members("Category:For " + s):
            if t not in found:
                extra[t] = pid
                found.add(t)
                added += 1
    extra_file.write_text(json.dumps(sorted(extra.items()), ensure_ascii=False))
    (CACHE / "sweep.json").write_text(json.dumps(
        {s: {"size": sizes.get(s, 0), "known": count[s]} for s in names}, ensure_ascii=False, indent=0))
    print(f"sweep: {added} more pages (now {len(extra)} outside the player-count categories)", flush=True)
    if added:
        step_cats()


def step_pages():
    old = {t: r for t, r in old_rows().items() if r["cats"] and r.get("info")}  # reuse only complete rows
    have = {r["title"] for r in jsonl(CACHE / "pages.jsonl")}
    cats = page_cats()
    pids = all_members()
    extra_file = CACHE / "sweep-members.json"
    if extra_file.exists():
        pids.update(dict(json.loads(extra_file.read_text())))
    cand = sorted(t for t in pids if stringy(cats.get(t, [])))
    reuse = [t for t in cand if t in old and t not in have]
    with open(CACHE / "pages.jsonl", "a") as out:
        for t in reuse:
            out.write(json.dumps({**old[t], "pageid": old[t].get("pageid") or pids.get(t), "from": "imslp-all"}, ensure_ascii=False) + "\n")
    print(f"pages: {len(cand)} string candidates, {len(reuse)} reused from the composer cache", flush=True)
    todo = [(t, pids[t]) for t in cand if t not in old and t not in have]
    run_batches(todo, 20, fetch, CACHE / "pages.jsonl", "pages")


def step_benchmarks():
    """the IMSLP pages the benchmark fact-check linked to (data/chamber/benchmarks/verify/), through redirects; a linked
    page that the category harvest did not find is added to the sweep's extra pages"""
    links = set()
    for f in sorted((ROOT / "data/chamber/benchmarks/verify").glob("*.json")):
        for r in json.loads(f.read_text()).get("results", []):
            for u in r.get("sources", []):
                if "imslp.org/wiki/" in u:
                    t = urllib.parse.unquote(u.split("/wiki/", 1)[1].split("#")[0]).replace("_", " ")
                    if not t.startswith("Category:"):
                        links.add(t)
    links = sorted(links)
    target, pids = {}, {}
    for i in range(0, len(links), 50):
        d = call({"action": "query", "titles": "|".join(links[i:i + 50]), "redirects": 1})
        q = d.get("query", {})
        norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
        red = {r["from"]: r["to"] for r in q.get("redirects", [])}
        ok = {p["title"]: p.get("pageid") for p in q.get("pages", {}).values() if "missing" not in p}
        for t in links[i:i + 50]:
            u = norm.get(t, t)
            u = red.get(u, u)
            if u in ok:
                target[t], pids[u] = u, ok[u]
    (CACHE / "benchmark-links.json").write_text(json.dumps(target, ensure_ascii=False, indent=0))
    found = set(all_members())
    extra_file = CACHE / "sweep-members.json"
    extra = dict(json.loads(extra_file.read_text())) if extra_file.exists() else {}
    new = {u: pids[u] for u in set(target.values()) if u not in found and u not in extra}
    extra.update(new)
    extra_file.write_text(json.dumps(sorted(extra.items()), ensure_ascii=False))
    print(f"benchmarks: {len(links)} IMSLP links, {len(target)} resolved, {len(new)} pages added", flush=True)
    if new:
        step_cats()


SIGNALS = [  # evidence for the floor (published, recorded); the page harvest drops "Pages with …" categories as noise
    "Pages with commercial recordings",  # IMSLP matched a commercial recording (mostly the Naxos Music Library)
    "Pages with First Editions",
    "Pages with References to Hofmeister's Monatsbericht",  # listed in the 19th-century German trade catalogue
    "Recordings",  # an audio file on the page itself
]


def step_signals():
    (CACHE / "signals").mkdir(parents=True, exist_ok=True)
    for cat in SIGNALS:
        f = CACHE / "signals" / f"{slug(cat)}.json"
        if f.exists():
            continue
        mem = members("Category:" + cat)
        f.write_text(json.dumps(sorted(t for t, _ in mem), ensure_ascii=False))
        print(f"{cat}: {len(mem)} pages", flush=True)


def main():
    CACHE.mkdir(parents=True, exist_ok=True)
    steps = {"members": step_members, "cats": step_cats, "sweep": step_sweep, "benchmarks": step_benchmarks, "pages": step_pages,
             "signals": step_signals}
    chosen = [a for a in sys.argv[1:] if a in steps] or list(steps)
    for s in chosen:
        steps[s]()
    print("done", flush=True)


if __name__ == "__main__":
    main()
