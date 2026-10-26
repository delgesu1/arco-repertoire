#!/usr/bin/env python3
"""Turn the IMSLP work-info blocks fetched by scripts/fetch_imslp_details.py into clean details per catalogue work.

For each work with an IMSLP page: its movements (or, for a set, its pieces) in order, the dedication, the first
performance, the years of composition and first publication, IMSLP's average duration and the other titles it is
known by. A movement list is kept only when it is unambiguous: top-level items with names, in the count the page
itself gives ("3 movements:"), and no grouped books or links to other works; otherwise the work gets only the count.

Reads   data/build/catalogue.json, data/build/chamber.json, data/cache/imslp-work/*.json
Writes  data/details/imslp.json   {"<piece id>": {"page", "movements"?, "kind"?, "count"?, "dedication"?, ...}}
    python3 scripts/parse_imslp_details.py
"""
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / "data" / "cache" / "imslp-work"
OUT = ROOT / "data" / "details" / "imslp.json"

KEYS = {
    **{k: f"{k.upper()} major" for k in "abcdefg"},
    **{k.upper(): f"{k.upper()} major" for k in "abcdefg"},
    **{k: f"{k.upper()} minor" for k in "abcdefg"},
}


def key_name(v):
    """IMSLP's {{Key|e}}: lower case is minor, upper case major; b/s after the letter are flat/sharp"""
    m = re.fullmatch(r"\s*([A-Ga-g])([bs]?)\s*", v)
    if not m:
        return v.strip()
    letter, acc = m.groups()
    mode = "minor" if letter.islower() else "major"
    return f"{letter.upper()}{'-flat' if acc == 'b' else '-sharp' if acc == 's' else ''} {mode}"


def template(m):
    name, *args = [a.strip() for a in m.group(1).split("|")]
    n = name.lower()
    if n in ("key", "k"):
        return key_name(args[0]) if args else ""
    if n.startswith("link"):  # LinkName / LinkDed / LinkComp / LinkWork…: the visible words, not the trailing flags
        words = [a for a in args if a and not re.fullmatch(r"\d+", a)]
        if n.startswith("linkwork"):
            return " ".join(words[:2])
        return " ".join(words)
    if n in ("mwv", "rism"):
        return " ".join([name, *args])
    return ""  # {{EN}}, {{HMBref|…}}, {{More}}, {{MusBrnz|…}} and the like carry nothing for a reader


def clean(v):
    for _ in range(3):  # templates can nest one or two deep
        v = re.sub(r"\{\{(?!#)([^{}]*)\}\}", template, v)
    v = re.sub(r"<br\s*/?>", "; ", v, flags=re.I)
    v = re.sub(r"<[^>]+>", "", v)
    v = re.sub(r"\[\[(?:[^\]|]*\|)?([^\]]*)\]\]", r"\1", v)  # [[Breitkopf und Härtel]] -> Breitkopf und Härtel
    v = re.sub(r"\[https?://\S+\s+([^\]]*)\]", r"\1", v)
    v = re.sub(r"'{2,}", "", v)
    v = re.sub(r"\s+", " ", v)
    return v.strip(" ;:,")


def fields(info):
    """the |Field=value lines (a value runs until the next |Field=), continuation lines kept"""
    out = {}
    for m in re.finditer(r"^\|([A-Za-z/ ]+?)\s*=(.*?)(?=^\|[A-Za-z/ ]+?\s*=|\Z)", info, re.M | re.S):
        out[m.group(1).strip()] = m.group(2).strip()
    return out


BARS = re.compile(r"\s*\((?:[^()]*?,\s*)?\d+\s*(?:bars?|mm\.?|measures?)\)", re.I)
# "(D-flat major)", "(F minor, ends in F major)": a program doesn't print a movement's key
KEY_ONLY = re.compile(r"\s*\([A-G](?:-flat|-sharp)? (?:major|minor)(?:,[^()]*)?\)")


def item_title(t):
    t = BARS.sub("", t)
    t = clean(t)
    t = KEY_ONLY.sub("", t)
    t = re.sub(r"^(?:\d+|[IVXL]+)\.\s+", "", t)  # "1. Allegro", "II. Largo" -> the name alone (the site numbers them)
    return t.strip()


WORKLIKE = re.compile(r"(Sonata|Sonatina|Trio|Quartet|Quintet|Sextet|Concerto|Sinfonia|Symphony|Suite|Partita|Duo|Duet|Divertimento|Serenade|Cassation|Notturno)\b.*\b(in [A-G]|No\.|Op\.)")


def movements(raw):
    """(names, kind, count): names only when the list is unambiguous"""
    # "3 movements:", "6 trios of 2 movements each:", "24 etudes"
    head = re.match(r"\s*(\d+)\s+([A-Za-z][^\n:]*?)\s*:?\s*(?:\n|$)", raw)
    count = int(head.group(1)) if head else None
    kind = head.group(2).split()[0].lower() if head else None
    body = raw[head.end():] if head else raw
    if "LinkWork" in body or re.search(r"^\s*[;*]", body, re.M):
        return None, kind, count  # links to other works, or grouped under books/pieces: not a plain movement list
    items = []
    subitems = re.findall(r"\{\{#subitem:([^\n]*)\}\}", body)
    if subitems:
        levels = []
        for s in subitems:
            lv = re.search(r"level=(\d+)", s)
            title = re.search(r"title=(.*)$", s)
            levels.append((int(lv.group(1)) if lv else 1, title.group(1) if title else ""))
        if any(lv > 1 for lv, _ in levels):
            return None, kind, count
        items = [item_title(t) for _, t in levels]
    else:
        for line in body.splitlines():
            m = re.match(r"^\s*(#|:)\s*(?!#|:)(.*)$", line)  # top level only: "#Allegro" or ":1. Allegro", not "##" / "::"
            if m:
                items.append(item_title(m.group(2)))
    items = [i for i in items if i]
    # items that read as separate works ("Trio in D major", "Sonata No. 3, S.754") make it a set, whatever the header says
    if items and kind is None and all(WORKLIKE.match(i) for i in items):
        kind = "works"
    if len(items) < 2 or (count and len(items) != count):
        return None, kind, count or (len(items) if len(items) > 1 else None)
    return items, kind, count or len(items)


MONTHS = "January February March April May June July August September October November December".split()


def prose(v):
    """a free-text field as one line: continuation lines (":…") joined with "; ", ISO dates as "13 March 1845" """
    v = re.sub(r"\n\s*:+\s*", "; ", v)
    v = clean(v)
    v = re.sub(r"\b(1[5-9]\d\d|20\d\d)-(\d\d)-(\d\d)\b", lambda m: f"{int(m.group(3))} {MONTHS[int(m.group(2)) - 1]} {m.group(1)}" if 1 <= int(m.group(2)) <= 12 else m.group(0), v)
    v = re.sub(r"\b(1[5-9]\d\d)-(1[5-9]\d\d)\b", r"\1–\2", v)  # year ranges with an en dash
    return re.sub(r"\s+;", ";", v).strip(" ;")


def minutes(v):
    v = clean(v).lower()
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*min", v)
    if m:
        return round((float(m.group(1)) + float(m.group(2))) / 2)
    h = re.search(r"(\d+)\s*hours?", v)
    mm = re.search(r"(\d+(?:\.\d+)?)\s*min", v)
    total = (int(h.group(1)) * 60 if h else 0) + (float(mm.group(1)) if mm else 0)
    return round(total) if total else None


def year(v):
    m = re.search(r"\b(1[0-9]{3}|20[0-2][0-9])\b", clean(v))
    return m.group(1) if m else None


def is_collection(p):
    """the catalogue entry is itself a set of pieces: a chamber "set", or a violin book or collection ("6 Pieces", "36 Studies")"""
    if p.get("chamber"):
        return p["chamber"]["form"] == "set"
    return not p.get("set") and bool(re.match(r"(\d+|[IVX]+|Six|Twelve|Three|Four|Two)\b", p["title"]))


def main():
    ids = {}
    pieces = {}
    for f in ("data/build/catalogue.json", "data/build/chamber.json"):
        for p in json.loads((ROOT / f).read_text())["pieces"]:
            if p.get("imslpPage"):
                ids.setdefault(p["imslpPage"], set()).add(p["id"])
                pieces[p["id"]] = p
    out = {}
    stats = {"pages": 0, "movements": 0, "count only": 0, "dedication": 0, "first performance": 0, "composed": 0, "published": 0, "minutes": 0, "other titles": 0}
    for title, pids in ids.items():
        f = CACHE / f"{hashlib.sha1(title.encode()).hexdigest()}.json"
        if not f.exists():
            continue
        rec = json.loads(f.read_text())
        if not rec["info"]:
            continue
        stats["pages"] += 1
        fl = fields(rec["info"])
        d = {"page": rec["page"]}
        names, kind, count = movements(fl.get("Number of Movements/Sections", ""))
        if names:
            d["movements"] = names
            stats["movements"] += 1
        elif count:
            stats["count only"] += 1
        if kind:
            d["kind"] = kind
        if count:
            d["count"] = count
        # one dedication per piece of a set comes as a "#" list
        if ded := prose(re.sub(r"(?m)^\s*#\s*", "; ", fl.get("Dedication", ""))):
            d["dedication"] = ded
        if perf := prose(fl.get("First Performance", "")):
            d["firstPerformance"] = perf
        if comp := prose(fl.get("Year/Date of Composition", "")):
            d["composed"] = comp
        if pub := year(fl.get("Year of First Publication", "")):
            d["published"] = pub
        if mins := minutes(fl.get("Average Duration", "")):
            d["minutes"] = mins
        others = [clean(x) for x in re.split(r"<br\s*/?>|;|\n", fl.get("Alternative Title", "") + "\n" + fl.get("Name Translations", "") + "\n" + fl.get("Name Aliases", ""), flags=re.I)]
        for k, label in (("dedication", "dedication"), ("firstPerformance", "first performance"), ("composed", "composed"), ("published", "published"), ("minutes", "minutes")):
            if k in d:
                stats[label] += 1
        # a page about a set ("6 Sonatas") lists its works, not movements: those, the set's length and its other
        # titles belong to a catalogue entry only when the entry is the whole set too
        page_is_set = bool(kind) and not re.match(r"(movement|section|part|tempo|variation)", kind)
        for pid in pids:
            p = pieces[pid]
            whole = not page_is_set or is_collection(p)
            entry = {k: v for k, v in d.items() if whole or k not in ("movements", "kind", "count", "minutes")}
            own = [o for o in others if o and o.lower() != p["title"].lower()] if whole else []
            if own:
                entry["otherTitles"] = sorted(set(own))
            if not whole:
                entry["fromSet"] = True
            out[str(pid)] = entry
        if any(o for o in others):
            stats["other titles"] += 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(dict(sorted(out.items(), key=lambda kv: int(kv[0]))), ensure_ascii=False, indent=1) + "\n")
    print(f"{len(out)} works from {stats['pages']} IMSLP pages: " + ", ".join(f"{k} {v}" for k, v in stats.items() if k != "pages"))


if __name__ == "__main__":
    main()
