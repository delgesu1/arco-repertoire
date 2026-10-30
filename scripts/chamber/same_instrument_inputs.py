#!/usr/bin/env python3
"""Produce a compact ordinary extraction batch from the existing IMSLP cache."""
import argparse
import json
from pathlib import Path
import re
import sys
import urllib.parse

ROOT = Path(__file__).resolve().parents[2]
RUN = ROOT / "data/chamber/same-instrument"
sys.path.insert(0, str(ROOT / "scripts/expand"))
from imslp_harvest_all import arrangements, work_info  # noqa: E402


def prepare(batch, count, kind):
    target = RUN / "inputs" / f"{batch}.json"
    if target.exists():
        raise ValueError("Batch input exists; choose another name to preserve worker inputs")
    excluded = json.loads((ROOT / "data/chamber/excluded-composers.json").read_text())
    chamber = json.loads((ROOT / "data/chamber/works.json").read_text())
    violin = json.loads((ROOT / "data/build/catalogue.json").read_text())["pieces"]
    known_composers = {w["composer"] for w in chamber + violin}
    def normalize(name):
        return urllib.parse.unquote(name.split("/wiki/")[-1]).replace("_", " ").casefold().strip()

    def telemann_number(title):
        match = re.search(r"\bTWV\s*(\d+)\s*:\s*(\d+)(?!\d|\s*[-–])", title, re.I)
        return tuple(match.groups()) if match else None

    known_telemann = {telemann_number(w["title"]) for w in chamber
                      if w["composer"] == "Telemann, Georg Philipp" and not w.get("arranger")}
    known_telemann.discard(None)
    known_pages = {normalize(w.get("imslpPage", "")) for w in chamber}
    known_pages.update(normalize(w.get("imslpPage", "")) for w in violin if len(w.get("instruments", {})) == 1 and sum(w.get("instruments", {}).values()) >= 3)
    processed = set()
    for result_path in (RUN / "discovery").glob("triage-*.json"):
        result = json.loads(result_path.read_text())
        input_path = RUN / "inputs" / result_path.name
        old_input = json.loads(input_path.read_text()) if input_path.exists() else {}
        old_kind = result.get("kind") or old_input.get("kind", "original")
        if kind == "any" or old_kind in (kind, "any"):
            processed.update(p["pageId"] for p in result.get("pages", []))
    rows = []
    for row in json.loads((RUN / "census.json").read_text())["pages"]:
        if row["pageId"] in processed:
            continue
        original = any(not c.endswith("(arr)") for c in row["categories"])
        arranged = any(c.endswith("(arr)") for c in row["categories"])
        if (kind == "original" and not original) or (kind == "arrangement" and not arranged):
            continue
        match = re.search(r"\(([^()]*)\)$", row["title"])
        composer = match.group(1) if match else ""
        if composer in excluded or composer == "Various":
            continue
        if kind == "original" and normalize(row["title"]) in known_pages:
            continue
        # IMSLP has both collection and individual pages for the four-violin concertos.
        if kind == "original" and composer == "Telemann, Georg Philipp" and telemann_number(row["title"]) in known_telemann:
            continue
        cache = ROOT / "data/cache/same-instrument-imslp/pages" / f"{row['pageId']}.json"
        page = json.loads(cache.read_text())["page"]
        revision = page.get("revisions", [{}])[0]
        text = revision.get("*") or revision.get("slots", {}).get("main", {}).get("*", "")
        headings = arrangements(text)
        score_at = text.find("==Sheet Music==")
        cats = [c["title"] for c in page.get("categories", [])]
        rows.append({"pageId": row["pageId"], "title": row["title"], "composer": composer,
                     "url": "https://imslp.org/wiki/" + urllib.parse.quote(row["title"].replace(" ", "_"), safe=""),
                     "rawCache": str(cache.relative_to(ROOT)), "discoveryCategories": row["categories"],
                     "workInfo": work_info(text), "knownComposer": composer in known_composers,
                     "recordingSignal": any("commercial recording" in c.lower() for c in cats),
                     "performanceSectionExcerpt": (text[:score_at] if score_at >= 0 else text)[:1500],
                     "scoreExcerpt": text[score_at:score_at + 2500] if score_at >= 0 else text[:2500],
                     "arrangementHeadings": headings[:20]})
    rows.sort(key=lambda r: (not r["knownComposer"], not r["recordingSignal"], r["composer"], r["title"]))
    # Round-robin composers avoids spending a whole batch on one arranger-heavy Bach catalogue.
    groups = {}
    for row in rows:
        groups.setdefault(row["composer"], []).append(row)
    items = []
    while len(items) < count and groups:
        for composer in list(groups):
            items.append(groups[composer].pop(0))
            if not groups[composer]:
                del groups[composer]
            if len(items) == count:
                break
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps({"batch": batch, "kind": kind, "items": items}, ensure_ascii=False, indent=1) + "\n")
    print(json.dumps({"batch": batch, "pages": len(items), "remainingEligibleCachePages": len(rows), "inputBytes": target.stat().st_size}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--batch", required=True)
    parser.add_argument("--count", type=int, default=20)
    parser.add_argument("--kind", choices=["original", "arrangement", "any"], default="original")
    args = parser.parse_args()
    if not re.fullmatch(r"[a-z0-9-]+", args.batch) or not 1 <= args.count <= 40:
        parser.error("Use a lowercase batch name and1–40 pages")
    prepare(args.batch, args.count, args.kind)
