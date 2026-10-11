#!/usr/bin/env python3
"""Step 4d of the IMSLP link pass: follow IMSLP redirects.

Many IMSLP titles are only redirects ("Flight of the Bumblebee (Rimsky-Korsakov, Nikolay)" -> "The Tale of Tsar Saltan (opera) ..."): the redirect
page itself has no scans, the page it points to does. For every matched page (and every entry already in data/imslp-pages.json) this resolves the
redirect, fetches the target's record, and rewrites the entry to the target title with the target's scan count.

Reads/updates  data/expansion/imslp/matches/*.json, data/imslp-pages.json (only redirect entries change)
Writes         data/cache/imslp-all/pages/hydrated--picked.json (the target records, for the verifier)
"""
import json, sys, time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from imslp_harvest_all import call, fetch, ROOT  # noqa: E402

M = ROOT / "data/expansion/imslp/matches"
HYD = ROOT / "data/cache/imslp-all/pages/hydrated--picked.json"
PAGES = ROOT / "data/imslp-pages.json"


def resolve(titles):
    """{title: target} for titles that are redirects (single hop and chains, as the API resolves them)"""
    out = {}
    for i in range(0, len(titles), 40):
        chunk = titles[i:i + 40]
        d = call({"action": "query", "titles": "|".join(chunk), "redirects": 1})
        q = d.get("query", {})
        norm = {n["from"]: n["to"] for n in q.get("normalized", [])}
        redir = {r["from"]: r["to"] for r in q.get("redirects", [])}
        for t in chunk:
            n = norm.get(t, t)
            hop = n
            seen = 0
            while hop in redir and seen < 5:
                hop = redir[hop]
                seen += 1
            if hop != n:
                out[t] = hop
    return out


def main():
    files = {f: json.load(open(f)) for f in sorted(M.glob("*.json"))}
    pages = json.load(open(PAGES))
    titles = sorted({m["page"] for ms in files.values() for m in ms if m.get("page")} | set(pages.values()))
    print(len(titles), "titles to check", flush=True)
    red = resolve(titles)
    print(len(red), "are redirects", flush=True)
    have = {r["title"]: r for r in (json.load(open(HYD))["rows"] if HYD.exists() else [])}
    targets = sorted({t for t in red.values() if t not in have})
    for i in range(0, len(targets), 10):
        for r in fetch([(t, 0) for t in targets[i:i + 10]]):
            have[r["title"]] = r
    HYD.write_text(json.dumps({"rows": list(have.values())}, ensure_ascii=False))
    n_match = n_pages = 0
    for f, ms in files.items():
        dirty = False
        for m in ms:
            t = m.get("page")
            if t in red:
                tgt = red[t]
                r = have.get(tgt)
                m["redirected_from"] = t
                m["page"] = tgt
                m["nfiles"] = r["nfiles"] if r else -1
                dirty = True
                n_match += 1
        if dirty:
            f.write_text(json.dumps(ms, ensure_ascii=False, indent=1))
    for k, t in list(pages.items()):
        if t in red:
            pages[k] = red[t]
            n_pages += 1
    if n_pages:
        PAGES.write_text(json.dumps(pages, ensure_ascii=False, indent=1) + "\n")
    print(f"rewrote {n_match} matches and {n_pages} imslp-pages entries; targets without scans: {sum(1 for r in have.values() if r['nfiles'] == 0)}", flush=True)


if __name__ == "__main__":
    main()
