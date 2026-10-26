#!/usr/bin/env python3
"""Scores a research chunk against IMSLP's answers for the same works (the pilot, data/details/research/done/p001.json).

Movements: "same" when the lists match name for name after normalising case, accents and punctuation; "close" when
the count matches and most names do; otherwise "different". Years: the first four-digit year of each.
    python3 scripts/details_score.py p001
"""
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def first_year(s):
    m = re.search(r"\b(1[0-9]{3}|20[0-2][0-9])\b", s or "")
    return m.group(1) if m else None


def main():
    chunk = sys.argv[1]
    imslp = json.loads((ROOT / "data/details/imslp.json").read_text())
    done = json.loads((ROOT / f"data/details/research/done/{chunk}.json").read_text())
    tally = {"same": 0, "close": 0, "different": 0, "empty": 0}
    years = {"same": 0, "different": 0, "empty": 0, "imslp has none": 0}
    for pid, r in done.items():
        ref = imslp.get(pid, {})
        mine, theirs = r.get("movements"), ref.get("movements") or []
        if not mine:
            tally["empty"] += 1
        else:
            a, b = [norm(x) for x in mine], [norm(x) for x in theirs]
            hits = sum(1 for x, y in zip(a, b) if x == y or x in y or y in x)
            verdict = "same" if a == b else "close" if len(a) == len(b) and hits >= len(b) - 1 else "different"
            tally[verdict] += 1
            if verdict == "different":
                print(f"{pid}: research {mine}\n      imslp    {theirs}")
        ry, iy = first_year(r.get("composed")), first_year(ref.get("composed"))
        years["empty" if not ry else "imslp has none" if not iy else "same" if ry == iy else "different"] += 1
    print("movements:", tally)
    print("years:", years)


if __name__ == "__main__":
    main()
