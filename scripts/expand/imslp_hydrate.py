#!/usr/bin/env python3
"""Step 4c of the IMSLP link pass: scan counts and metadata for matched pages that came from a surname title search (nfiles == -1).

Reads   data/expansion/imslp/matches/*.json
Writes  data/cache/imslp-all/pages/hydrated--picked.json   {"rows": [harvest-format rows]}   (read by imslp_verify.ts for page metadata)
        and sets "nfiles" (and "hydrated": true) on those entries of the match files; imslp_apply.ts skips pages with nfiles 0.
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from imslp_harvest_all import fetch, ROOT  # noqa: E402

M = ROOT / "data/expansion/imslp/matches"
HYD = ROOT / "data/cache/imslp-all/pages/hydrated--picked.json"


def main():
    files = {f: json.load(open(f)) for f in sorted(M.glob("*.json"))}
    have = {r["title"]: r for r in (json.load(open(HYD))["rows"] if HYD.exists() else [])}
    need = sorted({m["page"] for ms in files.values() for m in ms if m.get("page") and m.get("nfiles") == -1 and m["page"] not in have})
    print(len(need), "pages to hydrate", flush=True)
    for i in range(0, len(need), 10):
        for r in fetch([(t, 0) for t in need[i:i + 10]]):
            have[r["title"]] = r
        if i % 100 == 0:
            print(i, flush=True)
    HYD.write_text(json.dumps({"rows": list(have.values())}, ensure_ascii=False))
    changed = 0
    for f, ms in files.items():
        dirty = False
        for m in ms:
            if m.get("page") and m.get("nfiles") == -1:
                r = have.get(m["page"])
                if r is None:  # page vanished from the API: treat as not found
                    m["page"], m["confidence"], m["kind"], m["note"] = None, "high", "none", "page not found when hydrating"
                else:
                    m["nfiles"] = r["nfiles"]
                    m["hydrated"] = True
                dirty = True
                changed += 1
        if dirty:
            f.write_text(json.dumps(ms, ensure_ascii=False, indent=1))
    print("updated", changed, "matches; pages with no scans:", sum(1 for r in have.values() if r["nfiles"] == 0), flush=True)


if __name__ == "__main__":
    main()
