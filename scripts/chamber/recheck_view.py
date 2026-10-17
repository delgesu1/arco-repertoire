#!/usr/bin/env python3
"""
A compact view of one curation output file for a recheck agent (data/chamber/curation/RECHECK_BRIEF.md).

  python3 scripts/chamber/recheck_view.py <slice>            # e.g. c49_dvorak-saint-saens-dohnanyi
  python3 scripts/chamber/recheck_view.py <slice> --sample   # also prints one kept work in full (the shape to copy)

The output files are large (100 to 300 KB); reading one whole costs a recheck agent most of its budget. This prints what a
recheck needs: the note, the composers marked partial, the skipped lines that can be reopened (reason "not checked ..." or
"not performed or recorded", with their evidence), and the titles already kept (so that nothing is researched twice).
Edit the file with your own short Python script: load it with json, change it, write it back with
json.dumps(d, ensure_ascii=False, indent=1) + "\n".
"""
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        sys.exit(__doc__)
    path = ROOT / "data/chamber/curation/out" / (args[0] + ".json")
    d = json.loads(path.read_text(encoding="utf-8"))
    works, skipped = d["works"], d["skipped"]
    print("SLICE %s: %d works kept, %d skipped lines (%d works)" % (d["slice"], len(works), len(skipped), sum(s.get("works") or 1 for s in skipped)))
    print("kept by confidence:", dict(Counter(w.get("confidence") for w in works)))
    print("skipped by reason:", dict(Counter((s.get("reason") or "").split(":")[0] for s in skipped)))
    print("\n== NOTE ==\n" + (d.get("note") or ""))
    print("\n== COMPOSERS CHECKED (partial first) ==")
    cc = sorted(d.get("composers_checked", []), key=lambda c: (c.get("coverage") != "partial", c["name"]))
    for c in cc:
        print("- %s | kept %s skipped %s gap %s | %s | %s" % (c["name"], c.get("kept"), c.get("skipped"), c.get("added_not_on_imslp"), c.get("coverage"), (c.get("note") or "")[:300]))
    print("\n== SKIPPED LINES THAT CAN BE REOPENED (index | composer | title | works | reason | evidence) ==")
    for i, s in enumerate(skipped):
        r = (s.get("reason") or "").lower()
        if r.startswith("not checked") or r.startswith("not performed or recorded"):
            print("%d | %s | %s | %s | %s | %s" % (i, s.get("composer"), s.get("title"), s.get("works"), s.get("reason"), (s.get("evidence") or "")[:220]))
    print("\n== KEPT WORKS (composer | title | confidence | gap) ==")
    for w in works:
        print("%s | %s | %s | %s" % (w["composer"], w["title"], w.get("confidence"), "gap" if w.get("gap") else ""))
    if "--sample" in sys.argv:
        gap = [w for w in works if w.get("gap")]
        print("\n== ONE KEPT WORK IN FULL (the shape to copy) ==")
        print(json.dumps((gap or works)[0], ensure_ascii=False, indent=1))
        print("\n== ONE SKIPPED LINE IN FULL ==")
        print(json.dumps(skipped[0], ensure_ascii=False, indent=1) if skipped else "{}")


if __name__ == "__main__":
    main()
