#!/usr/bin/env python3
"""Builds data/expansion/modern/decisions.json from the researchers' existing_issues plus the hand decisions below.
Rule: a duration suggested by a publisher / composer / IMSLP is applied; titles, levels, accompaniments, categories and sets only where listed in MANUAL
(everything else the researchers flagged stays as it is and is listed in final/existing-issues.json for a later look)."""
import json, glob, os
os.chdir(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
ACC = {k for k in json.load(open("data/accompaniment-map.json")) if k != "_settings"}

# issues whose suggested duration is not trustworthy / not wanted
SKIP_MINUTES = {711, 362, 1019, 1462}  # Bates (site says 15, likely error), Turnage (conflicting), Kernis (unverified), Marsalis Fiddle Dance (recorded timing, not the score)
# fields applied by hand: id -> {field: value}
MANUAL = {
    1122: {"title": "Passacaglia (version for violin & piano)"},
    1728: {"title": "Sonata for Violin and Piano"},
    532: {"title": "Duet for Two Violins and Strings"},
    441: {"title": "Die letzten Tage"},
    1156: {"title": "Aria (Air)"},
    600: {"title": "Apophthegms"},
    472: {"title": "Fanfares and Reflection"},
    735: {"title": "Graceful Ghost Rag (Concert Variation)"},
    703: {"title": "Canzone, Op. 38a"},
    232: {"title": "Concerto No. 1"},
    317: {"title": "Concerto Grosso No. 5", "accompaniment": "Orchestra (piano reduction)"},
    539: {"accompaniment": "2 violins"},
    1475: {"title": "Cadenza (solo violin version by Christiane Edinger)"},
    2103: {"title": "Suite on Estonian Dance Tunes"},
    477: {"title": "Kanonisches Vortragsstück und Kanonische Variationen for Two Violins (1931)"},
    1449: {"title": "Sonata for Solo Violin, Op. 11 No. 6"},
    1115: {"title": "Romance in D major, CNW 61"},
    2168: {"title": "Cinéma-fantaisie, Op. 58b (Le Bœuf sur le toit)", "accompaniment": "Piano"},
    49: {"title": "Poema autunnale, P. 146"},
    284: {"title": "Concerto gregoriano, P. 135"},
    444: {"accompaniment": "2 violins & strings"},
    76: {"accompaniment": "String orchestra"},
    1312: {"set": "Seven Pint-sized Pieces"},
    2068: {"category": "Sonata / Duo (vln & pno)"},
    1640: {"level": 8},
    533: {"level": 3},
    417: {"level": 4},
    1120: {"level": 5},
    489: {"title": "Ballad and Dance (Baladă și joc)"},
    434: {"title": "Duetti per due violini (34)"},
    1369: {"title": "Prayer (T'filah), Op. 33"},
}

existing = {}
for f in sorted(glob.glob("data/expansion/modern/web/*.json")):
    for i in json.load(open(f)).get("existing_issues", []):
        mins = int(i.get("suggested_minutes") or 0)
        if mins and int(i["id"]) not in SKIP_MINUTES:
            existing.setdefault(str(i["id"]), {})["minutes"] = mins
for sid, d in MANUAL.items():
    if "accompaniment" in d: assert d["accompaniment"] in ACC, d
    existing.setdefault(str(sid), {}).update(d)

decisions = {
    "existing": existing,
    "drop": {},
    "override": {
        "hailstork-adolphus:baroque suite": {"accompaniment": "Harpsichord or piano"},
    },
    "author_alias": {},
    "author_meta": {},
}
# hand decisions on researcher entries are appended here by later steps (drops / overrides)
extra = "data/expansion/modern/decisions_extra.json"
if os.path.exists(extra):
    x = json.load(open(extra))
    for k in ("drop", "override", "author_alias", "author_meta"):
        decisions[k].update(x.get(k, {}))
    for sid, d in x.get("existing", {}).items():
        decisions["existing"].setdefault(sid, {}).update(d)
json.dump(decisions, open("data/expansion/modern/decisions.json", "w"), ensure_ascii=False, indent=1)
print(len(decisions["existing"]), "existing-row decisions;", len(decisions["drop"]), "drops;", len(decisions["override"]), "overrides")
