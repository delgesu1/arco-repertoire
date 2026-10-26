#!/usr/bin/env python3
"""Lists what each catalogue work still needs after IMSLP (movement names, year of composition, other titles) and writes
it in chunks for the research agents (brief: data/details/research/BRIEF.md).

  python3 scripts/details_prep.py pilot    # 40 works IMSLP already answers, to score the agents (to-research/p001.json)
  python3 scripts/details_prep.py export   # the rest, best-known first, in chunks of 40 (to-research/rNNN.json)

Needs: movements for multi-movement works without IMSLP movement names (violin concertos, sonatas, suites, solo works,
duets; chamber works and sets, not short pieces); the year of composition for violin works (chamber works have one);
other titles for well-known works. Works already exported or researched are skipped, so export can run again.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "data" / "details" / "research"
TODO = DIR / "to-research"
DONE = DIR / "done"
CHUNK = 40
MULTI_TYPES = {"concerto", "sonata", "suite", "solo", "duet"}


def load():
    violin = json.loads((ROOT / "data/build/catalogue.json").read_text())["pieces"]
    chamber = [p for p in json.loads((ROOT / "data/build/chamber.json").read_text())["pieces"] if "violin" not in p["sections"]]
    imslp = json.loads((ROOT / "data/details/imslp.json").read_text())
    text = (ROOT / "lib/advisor/chamber-catalogue-text.ts").read_text()
    renown = json.loads(re.search(r"CHAMBER_BY_RENOWN: number\[\] = (\[[^\]]*\])", text).group(1))
    return violin, chamber, imslp, {pid: i for i, pid in enumerate(renown)}


def item(p, needs):
    c = p.get("chamber")
    out = {"id": p["id"], "composer": p["composerName"], "title": p["title"]}
    if c:
        out.update({"scoring": c["formation"] + ": " + ", ".join(f"{n} {k}" if n > 1 else k for k, n in c["instruments"].items()), "form": c["form"]})
        if c.get("aka"):
            out["aka"] = c["aka"]
        if c.get("year"):
            out["year"] = c["year"]
    else:
        out.update({"setting": "+".join(p["settings"]), "type": p["type"]})
    out["needs"] = needs
    return out


def needs_of(p, d):
    c = p.get("chamber")
    multi = (c["form"] != "short") if c else (p["type"] in MULTI_TYPES)
    n = []
    if multi and not d.get("movements"):
        n.append("movements")
    if not c and not d.get("composed"):
        n.append("composed")
    if p.get("popularity") == "well-known" and not d.get("otherTitles") and not (c and c.get("aka")):
        n.append("otherTitles")
    return n


def seen_ids():
    ids = set()
    for d in (TODO, DONE):
        if d.exists():
            for f in d.glob("*.json"):
                data = json.loads(f.read_text())
                ids |= {str(i["id"]) for i in data["items"]} if "items" in data else set(data)
    return ids


def write(prefix, items):
    TODO.mkdir(parents=True, exist_ok=True)
    DONE.mkdir(parents=True, exist_ok=True)
    start = len(list(TODO.glob(f"{prefix}*.json")))
    n = 0
    for i in range(0, len(items), CHUNK):
        name = f"{prefix}{start + n + 1:03d}"
        (TODO / f"{name}.json").write_text(json.dumps({"chunk": name, "items": items[i : i + CHUNK]}, ensure_ascii=False, indent=1) + "\n")
        n += 1
    return n


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    violin, chamber, imslp, rank = load()
    if mode == "pilot":
        # well-known-ish works with an unambiguous IMSLP movement list: half violin, half chamber
        def ok(p):
            d = imslp.get(str(p["id"]), {})
            return d.get("movements") and d.get("kind") in (None, "movements") and not d.get("fromSet")
        v = [p for p in violin if ok(p) and p["type"] in MULTI_TYPES][:20]
        c = sorted((p for p in chamber if ok(p) and p["chamber"]["form"] == "work"), key=lambda p: rank.get(p["id"], 1e9))[:20]
        n = write("p", [item(p, ["movements", "composed"]) for p in v + c])
        print(f"pilot: {n} chunk of {len(v) + len(c)} works")
        return
    if mode != "export":
        raise SystemExit("usage: details_prep.py pilot|export")
    seen = seen_ids()
    todo = []
    for p in violin + chamber:
        if str(p["id"]) in seen:
            continue
        n = needs_of(p, imslp.get(str(p["id"]), {}))
        if n:
            # best-known first: well-known, then works with a recording, then the chamber renown order
            score = (0 if p.get("popularity") == "well-known" else 1, 0 if p.get("recording") else 1, rank.get(p["id"], 1e9 if p.get("chamber") else 5e5), p["id"])
            todo.append((score, item(p, n)))
    todo.sort(key=lambda x: x[0])
    n = write("r", [it for _, it in todo])
    counts = {k: sum(1 for _, it in todo if k in it["needs"]) for k in ("movements", "composed", "otherTitles")}
    print(f"export: {len(todo)} works in {n} chunks; needs {counts}")


if __name__ == "__main__":
    main()
