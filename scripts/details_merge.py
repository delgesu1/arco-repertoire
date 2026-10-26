#!/usr/bin/env python3
"""Merges IMSLP's details (data/details/imslp.json) and the research agents' answers (data/details/research/done/r*.json)
into the details the site shows: movements, year of composition, dedication, first performance, other titles.

IMSLP's answer wins where both have one; research fills the gaps and its sources are kept. A research answer is used only
when it has a source URL. Pilot chunks (p*.json) are for scoring and are not merged.

Writes  data/details/works.json        (server: piece pages and the advisor)
        public/data/details.json       (client: the piece sheet; the same, without sources)
    python3 scripts/details_merge.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FIELDS = ("movements", "kind", "composed", "dedication", "firstPerformance", "published", "otherTitles")


def main():
    imslp = json.loads((ROOT / "data/details/imslp.json").read_text())
    research = {}
    for f in sorted((ROOT / "data/details/research/done").glob("r*.json")):
        research.update(json.loads(f.read_text()))
    out = {}
    counts = {"imslp": 0, "research": 0}
    for pid in sorted(set(imslp) | set(research), key=int):
        i, r = imslp.get(pid, {}), research.get(pid, {})
        d, src = {}, {}
        # other titles are for search: names and nicknames, not a print's whole title page ("Elaborate Studies and Analysis …")
        for x in (i, r):
            if x.get("otherTitles"):
                x["otherTitles"] = [t for t in x["otherTitles"] if len(t) <= 70]
        for k in FIELDS:
            if k == "kind":
                continue
            if i.get(k):
                d[k], src[k] = i[k], "imslp"
                if k == "movements" and i.get("kind"):
                    d["kind"] = i["kind"]
            elif r.get(k) and r.get("sources"):
                d[k], src[k] = r[k], "research"
                if k == "movements":
                    d["kind"] = r.get("kind") or "movements"
        # one movement, said so by research: worth keeping, so the site doesn't ask again
        if "movements" not in d and r.get("kind") == "single" and r.get("sources"):
            d["kind"], src["kind"] = "single", "research"
        if not d:
            continue
        d["source"] = src
        if "research" in src.values():
            d["researchSources"] = r.get("sources", [])[:4]
        if i.get("page"):
            d["imslpPage"] = i["page"]
        out[pid] = d
        for s in set(src.values()):
            counts[s] += 1
    (ROOT / "data/details/works.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
    client = {pid: {k: v for k, v in d.items() if k in FIELDS} for pid, d in out.items()}
    (ROOT / "public/data/details.json").write_text(json.dumps(client, ensure_ascii=False, separators=(",", ":")))
    print(f"{len(out)} works with details ({counts['imslp']} from IMSLP, {counts['research']} with researched fields)")


if __name__ == "__main__":
    main()
