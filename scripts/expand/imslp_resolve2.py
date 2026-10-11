#!/usr/bin/env python3
"""Second resolver for composers imslp_resolve.py could not place: IMSLP spells people differently
(Sergei/Sergey, Karl/Carl, Henryk/Henri, 'Biber, ... von'). Lists "Category:<Surname>, *" (the trailing ', ' skips the spam names that
pollute IMSLP's category list), keeps real-looking names with pages, and picks the one whose given name is closest to the catalogue's.
Updates data/cache/imslp-all/resolve.json in place (method: "fuzzy"). Resumable: entries with "fuzzy_done" are skipped.
"""
import difflib, json, re, sys, time, unicodedata, urllib.parse, urllib.request
from pathlib import Path

UA = "ArcoRepertoire/1.0 (+https://repertoire.arco.app) catalogue research"
ROOT = Path(__file__).resolve().parents[2]
F = ROOT / "data/cache/imslp-all/resolve.json"
ALIAS = {  # catalogue name -> IMSLP category, where the given names are too far apart to match by similarity
    "Biber, Heinrich Ignaz Franz": "Biber, Heinrich Ignaz Franz von",
    "Drdla, Franz": "Drdla, František Alois",
    "Stojowski, Zygmunt": "Stojowski, Sigismond",
    "Conus, Jules": "Conus, Julius",
}


def call(params):
    params["format"] = "json"
    url = "https://imslp.org/api.php?" + urllib.parse.urlencode(params)
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r:
                d = json.load(r)
            time.sleep(0.7)
            return d
        except Exception:  # noqa: BLE001
            time.sleep(2 + 3 * attempt)
    raise SystemExit("IMSLP request failed")


def strip(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


def tokens(s):
    return re.sub(r"[^a-z ]", " ", strip(s).replace("-", " ")).split()


SANE = re.compile(r"^[^\W\d_][\w'’.\- ]*, [^\W\d_][\w'’.\-, ]*$", re.U)


def sizes(names):
    out = {}
    for i in range(0, len(names), 50):
        d = call({"action": "query", "titles": "|".join("Category:" + n for n in names[i:i + 50]), "prop": "categoryinfo"})
        for p in d.get("query", {}).get("pages", {}).values():
            if "categoryinfo" in p:
                out[p["title"].removeprefix("Category:")] = p["categoryinfo"].get("pages", 0)
    return out


def main():
    res = json.load(open(F))
    todo = [c for c, v in res.items() if not v["category"] and not v.get("fuzzy_done") and not re.match(r"^(ABRSM|AMEB|The Royal|Royal Irish|Trinity|Traditional)", c)]
    print(len(todo), "to try", flush=True)
    for n, c in enumerate(todo):
        sur, _, given = c.partition(",")
        if c in ALIAS:
            s = sizes([ALIAS[c]])
            if s.get(ALIAS[c], 0) > 0:
                res[c].update({"category": ALIAS[c], "size": s[ALIAS[c]], "method": "alias"})
        else:
            cands = []
            for pre in dict.fromkeys([sur.strip() + ", ", unicodedata.normalize("NFKD", sur).encode("ascii", "ignore").decode().strip() + ", "]):
                d = call({"action": "query", "list": "allcategories", "acprefix": pre, "aclimit": 200})
                cands += [x["*"] for x in d.get("query", {}).get("allcategories", [])]
            cands = [x for x in dict.fromkeys(cands) if "/" not in x and SANE.match(x) and tokens(x.split(",")[0]) == tokens(sur)]
            if cands:
                sz = sizes(cands)
                g = tokens(given)
                best = None
                for x in cands:
                    if sz.get(x, 0) <= 0:
                        continue
                    xg = tokens(x.split(",", 1)[1])
                    if not g or not xg:
                        continue
                    a, b = g[0], xg[0]
                    sim = difflib.SequenceMatcher(None, a, b).ratio()
                    if a[0] == b[0] and (len(a) == 1 or len(b) == 1):
                        sim = max(sim, 0.7)  # initial vs full name
                    if a[:3] == b[:3]:
                        sim = max(sim, 0.75)
                    if sim >= 0.7 and (best is None or (sim, sz[x]) > best[:2]):
                        best = (sim, sz[x], x)
                if best:
                    res[c].update({"category": best[2], "size": best[1], "method": "fuzzy", "sim": round(best[0], 2)})
        res[c]["fuzzy_done"] = True
        if n % 25 == 0:
            F.write_text(json.dumps(res, ensure_ascii=False, indent=1))
            print(n, c, "->", res[c].get("category"), flush=True)
    F.write_text(json.dumps(res, ensure_ascii=False, indent=1))
    ok = [(c, v["category"], v["size"]) for c, v in res.items() if v.get("method") in ("fuzzy", "alias")]
    print("fuzzy/alias resolved:", len(ok), flush=True)
    for x in ok:
        print(x, flush=True)


if __name__ == "__main__":
    main()
