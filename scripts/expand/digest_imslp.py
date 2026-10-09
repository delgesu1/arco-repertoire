"""Reduce the harvested IMSLP pages to the ones that involve the violin.

Reads   data/cache/imslp/*.json
Writes  data/cache/imslp-digest.json   {composer: {"orig": [...], "arr": [...], "other": [...]}}

  orig   the work itself is for violin as a solo/duo/concerto instrument (shape rules below)
  arr    no original violin version, but IMSLP lists a violin arrangement (candidates for "established arrangements")
  other  mentions the violin somewhere (e.g. "Scores featuring the violin") but the shape rules rejected it (chamber music etc.)
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "cache" / "imslp"
OUT = ROOT / "data" / "cache" / "imslp-digest.json"

ACCOMP = {"piano", "harpsichord", "organ", "continuo", "keyboard", "guitar", "harp", "bass instrument", "basso continuo"}
ORCH = {"orchestra", "strings", "string orchestra", "chamber orchestra", "small orchestra", "string quartet"}
KEYBOARDISH = {"piano", "harpsichord", "organ", "continuo", "keyboard", "guitar", "harp", "basso continuo", "bass instrument"}

# categories worth showing to the model besides the instrumentation ones
KEY_RX = re.compile(r"^[A-G](-flat|-sharp)? (major|minor)$")
GENRE = {
    "Concertos", "Sonatas", "Suites", "Variations", "Fantasias", "Rondos", "Romances", "Dances", "Waltzes", "Mazurkas",
    "Polonaises", "Etudes", "Caprices", "Preludes", "Fugues", "Serenades", "Nocturnes", "Berceuses", "Legends", "Rhapsodies",
    "Scherzos", "Tarantellas", "Transcriptions", "Arrangements", "Duets", "Songs", "Marches", "Gavottes", "Minuets", "Sonatinas",
    "Divertimentos", "Capriccios", "Ballades", "Intermezzi", "Meditations", "Elegies", "Airs", "Pieces", "Studies", "Cadenzas",
}
PERIOD = {"Baroque", "Classical", "Romantic", "Early 20th century", "20th century", "Late Romantic", "Renaissance", "21st century"}
DIFFICULTY = re.compile(r"^(Easy|Intermediate|Advanced|Difficult) Works for Violin")


def parse_for(cat):
    if not cat.startswith("For "):
        return None
    s = cat[4:]
    arr = bool(re.search(r"\(arr\)\s*$", s))
    s = re.sub(r"\s*\(arr\)\s*$", "", s)
    return arr, [p.strip() for p in s.split(", ")]


def violins(parts):
    n = 0
    for p in parts:
        m = re.fullmatch(r"(\d+ )?violins?", p)
        if m:
            n += int(m.group(1)) if m.group(1) else 1
    return n


def shape_ok(parts):
    """is the violin a soloist / duo partner in this scoring?"""
    nv = violins(parts)
    if not nv:
        return False
    rest = [p for p in parts if not re.fullmatch(r"(\d+ )?violins?", p)]
    has_orch = any(p in ORCH for p in rest)
    others = [p for p in rest if p not in ORCH and p not in KEYBOARDISH]
    keys = [p for p in rest if p in KEYBOARDISH]
    if has_orch:
        solo = nv + len(others) + (1 if any(k in ("piano",) for k in keys) else 0)
        if nv >= 2 and len(others) <= 1 and not any(k in ("piano",) for k in keys):
            return nv <= 4  # concertos for 2–4 violins (+ cello)
        return solo <= 3
    if others and keys:
        return False  # trio with a keyboard (violin, cello, piano)
    return nv + len(others) <= 2 and len(others) <= 1 and nv <= 3


def split_title(title):
    m = re.match(r"^(.*) \(([^()]*)\)$", title)
    return (m.group(1), m.group(2)) if m else (title, "")


def main():
    out = {}
    for f in sorted(SRC.glob("*.json")):
        d = json.load(open(f))
        res = {"orig": [], "arr": [], "other": []}
        for title, p in d["pages"].items():
            cats = p["cats"]
            fors = [parse_for(c) for c in cats]
            fors = [(c, x) for c, x in zip(cats, fors) if x]
            orig = [c for c, (arr, parts) in fors if not arr and shape_ok(parts)]
            arr = [c for c, (a, parts) in fors if a and shape_ok(parts)]
            feat = "Scores featuring the violin" in cats
            work, _ = split_title(title)
            info = {
                "title": title,
                "work": work,
                "pageid": p["pageid"],
                "orig": orig,
                "arr": arr,
                "keys": [c for c in cats if KEY_RX.match(c)],
                "genre": [c for c in cats if c in GENRE],
                "period": [c for c in cats if c in PERIOD],
                "difficulty": [c for c in cats if DIFFICULTY.match(c)],
                "arrangers": [c[: -len("/Arranger")] for c in cats if c.endswith("/Arranger")],
                "dedicatees": [c[: -len("/Dedicatee")] for c in cats if c.endswith("/Dedicatee")][:2],
            }
            if orig:
                res["orig"].append(info)
            elif arr:
                res["arr"].append(info)
            elif feat or any("violin" in c.lower() for c in cats if c.startswith("For ")):
                info["violin_cats"] = [c for c in cats if "violin" in c.lower()][:6]
                res["other"].append(info)
        out[d["composer"]] = res
        print(f"{d['composer']:32} pages={len(d['pages']):5} orig={len(res['orig']):4} arr={len(res['arr']):4} other={len(res['other']):4}")
    OUT.write_text(json.dumps(out, ensure_ascii=False))


if __name__ == "__main__":
    main()
