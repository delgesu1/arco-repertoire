#!/usr/bin/env python3
"""Hand decisions for the technical-materials merge -> data/expansion/tech/decisions.json

Run from the repo root:  python3 data/expansion/tech/make_decisions.py
It resolves (author, exact title) pairs to merge keys through data/expansion/tech/final/added.json (written by the
dry run of scripts/expand/tech_merge.ts), so run the dry run first when researcher files changed.
Everything here is a decision by the catalogue owner's assistant after reading the researchers' files; the reasons are kept in the JSON.
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TECH = ROOT / "data/expansion/tech"
added = json.loads((TECH / "final/added.json").read_text())
# every researcher row (also those already dropped/matched), so keys resolve even after a decision removed them from added.json
sys.path.insert(0, str(TECH))
rows_by_title = {}
for x in added:
    rows_by_title[(x["author"], x["title"])] = x["key"]

def slug(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

known = json.loads((TECH / "final/keys.json").read_text()) if (TECH / "final/keys.json").exists() else {}
for x in added:
    known[f"{x['author']}|{x['title']}"] = x["key"]
(TECH / "final/keys.json").write_text(json.dumps(known, ensure_ascii=False, indent=0))

author_alias = {
    "Halir, Carl": "Halíř, Karel",
    "Hellmesberger Jr., Joseph": "Hellmesberger, Joseph Jr.",
    "Hellmesberger, Joseph": "Hellmesberger, Joseph Jr.",
}

def K(author, title):
    author = author_alias.get(author, author)
    k = known.get(f"{author}|{title}")
    if not k:
        raise SystemExit(f"no row for {author!r} / {title!r}")
    return k

drop, override = {}, {}

def DP(author, prefix, why):
    """drop every row of `author` whose title starts with `prefix`"""
    author = author_alias.get(author, author)
    hits = [k for name, k in known.items() if name.startswith(f"{author}|{prefix}")]
    if not hits:
        raise SystemExit(f"no row for {author!r} / {prefix!r}")
    for k in hits:
        drop[k] = why

def OK(key, **kw):
    """override by raw merge key (for rows that are not in added.json, e.g. researcher entries matched to an existing id)"""
    override[key] = kw

def D(author, title, why):
    drop[K(author, title)] = why

def O(author, orig_title, **kw):
    override[K(author, orig_title)] = kw

# ----------------------------------------------------------------- the same book listed twice (language variants / two researchers)
D("Casorti, August", "Exercises in Double-Stopping, Op. 61 (Übungen in Doppelgriffen)", "same book as 'Double-Stopping Exercises, Op. 61'")
D("Casorti, August", "The Techniques of Bowing, Op. 50 (Technik des Bogens)", "same book as 'Technique of the Bow, Op. 50'")
for t in ["L'École de la Vélocité, Vol. 5 (special exercises for changing positions)",
          "The School of Velocity (L'École de la vélocité) Vol. 1 (finger exercises)",
          "The School of Velocity (L'École de la vélocité) Vol. 2 (scales and chords)",
          "The School of Velocity (L'École de la vélocité) Vol. 5 (changes of position)"]:
    D("Courvoisier, Carl", t, "same volume listed under another title (French titles kept)")
D("Dounis, Demetrius Constantine", "Change of Position Studies, Op. 36", "same book as 'Change of Position Studies, Op. 36 (The Development of Flexibility, Book 2)'")
D("Dounis, Demetrius Constantine", "The Dounis Violin Players' Daily Dozen, Op. 20", "same book (spelling variant)")
D("Dounis, Demetrius Constantine", "Preparatory Studies in Thirds and Fingered Octaves, Op. 16", "published as Book 1 and Book 2, which are listed separately")
D("Eberhardt, Siegfried", "Absolute Treffsicherheit auf der Violine (Absolute Accuracy of Intonation)", "same book, German-first title")
for t in ["10 Etüden, Op. 15 (Nos. 1-10)", "10 Etüden, Op. 17 (Nos. 11-20)", "20 Études, Opp. 15 & 17"]:
    D("Essek, Paul", t, "kept as the single entry '20 Etüden, Opp. 15 and 17'")
D("Fischer, Simon", "Scales: Scales and Scale Studies for the Violin", "same book as 'Scales and Scale Studies for the Violin' (Edition Peters title)")
D("Halíř, Karel", "Neue Tonleiterstudien (New Scale Studies)", "same book as 'New Scale Studies (Neue Tonleiterstudien)'")
for b in range(3, 11):
    D("Heim, Ernst", f"Gradus ad Parnassum, Book {b}", "same book as the entry that names its contents")
D("Hellmesberger, Joseph", "Scale Studies (Tonleiterstudien)", "attribution (Sr. or Jr.) and contents unresolved")
D("Hellmesberger, Joseph", "Tonleiterstudien", "attribution (Sr. or Jr.) and contents unresolved")
D("Hellmesberger Jr., Joseph", "Übungen in Tonleiterform, Op. 219 Book 3", "same book as 'Book 3 (all positions)'")
D("Hofmann, Richard", "Melodische Doppelgriff-Etüden, Op. 96 Part 1", "same book, German title")
D("Hofmann, Richard", "Melodische Doppelgriff-Etüden, Op. 96 Part 2", "same book, German title")
D("Kross, Emil", "Die Kunst der Bogenführung, Op. 40 (The Art of Bowing)", "same book, German-first title")
D("Kross, Emil", "Systematische Skalen-Studien, Op. 18 (3 books)", "listed as Books 1-3")
D("Küchler, Ferdinand", "Intonations- und Triller-Studien, Op. 13", "same book, German title")
D("Marteau, Henri", "24 Caprices, Op. 25", "same book as '24 Caprices (d'exécution transcendante), Op. 25'")
D("Marteau, Henri", "Bogenstudien (Études d'archet), Op. 14", "same book as 'Bogenstudien (Bowing Studies), Op. 14'")
D("Marteau, Henri", "Études de gammes (Tägliche Tonleiterstudien), Op. 19", "same book as 'Tägliche Tonleiterstudien (Études de gammes), Op. 19'")
# (raw key: the kept entry's title is overridden to this very title, so a title lookup would hit the wrong row)
drop["nowotny-karl:study chromatic scale das studium der chromatischen tonleiter 7"] = "same book; title carried over to the kept entry"
D("Nowotny, Karl", "Diatonic Scales in Major and Minor (Diatonische Tonleitern), Op. 17", "same book; title carried over to the kept entry")
O("Nowotny, Karl", "Das Studium der chromatischen Tonleiter, Op. 7", title="The Study of the Chromatic Scale (Das Studium der chromatischen Tonleiter), Op. 7")
O("Nowotny, Karl", "Diatonische Tonleitern in Dur und Moll, Op. 17", title="Diatonic Scales in Major and Minor (Diatonische Tonleitern in Dur und Moll), Op. 17")
D("Pichl, Václav", "12 Caprices, Op. 46 (Étude pour le violon)", "same book as '12 Caprices, Op. 46'")
D("Rau, Fritz", "Das Vibrato auf der Geige", "same book, German title")
D("Scharwenka-Stresow, Marianne", "Violinstudien für Technik und Vortrag, Op. 6", "same book, German title")
D("Scholz, Richard", "Das Staccato-Studium, Op. 11", "same book, German-only title")
D("Scholz, Richard", "Dynamische Studien, Op. 18", "same book, German-only title")
D("Scholz, Richard", "Schule des Flageoletspiels, Op. 23", "same book, German-only title")
D("Scholz, Richard", "Schule des Lagenspiels, Op. 3", "same book, German-only title")
D("Seybold, Arthur", "Neue Violin-Etüden-Schule, Op. 182 Book 3 (difficult first-position studies)", "same book as the 'more difficult studies in 1st position' entry")
D("Seybold, Arthur", "Neue Violin-Etüden-Schule, Op. 182 Book 6 (3rd position; 1st–3rd connected)", "same book as the other Book 6 entry")
D("Seybold, Arthur", "Neue Violin-Etüden-Schule, Op. 182 Book 12 (artist études)", "same book as 'Book 12 (Künstleretüden)'")
D("Singer, Edmund", "Tägliche Übungen (Daily Exercises for flexibility and independence of the fingers)", "same book, German-first title")
D("The Royal Conservatory", "Violin Technique and Etudes, Levels 5–8 (2013 Edition)", "superseded by the 2021 edition, which is kept")
D("Dont, Jakob", "6 Studies and 6 Caprices, Opp. 54 and 55 (Gradus ad Parnassum supplements to Op. 35)", "listed as Op. 54 and Op. 55 separately")
D("Kreisler, Fritz", "Study on a Choral in the Style of Johann Stamitz", "already in the catalogue (id 2595)")
D("Various", "Scales and Arpeggios for Violin (Novello)", "no named author or edition details")
for g in range(3, 9):
    O("ABRSM", f"Violin Scales & Arpeggios, Grade {g} (from 2012)", title=f"Violin Scales & Arpeggios, Grade {g}", set="Violin Scales & Arpeggios")

# ----------------------------------------------------------------- world_other: what to keep (rule: verified existence on IMSLP/a publisher/a library WITH contents or a scan,
# a book of exercises/etudes/caprices rather than a tutor or transcriptions, not a self-published upload)
LANGE = "Lange, Gustav Frederik"
DP(LANGE, "Études for Violin, Op. 6", "national-library record only (copies restricted), contents unseen, levels guessed from the numbering")
DP(LANGE, "Technical Studies for Violin", "national-library record only, contents unseen")
DP(LANGE, "Practical Violin School", "national-library record only; part of a beginner school")
D("Brodal, Jon H. Hjellum", "Technique Book for Hardanger Fiddle (Teknikkbok for hardingfele)", "level and contents not seen")
D("Honeyman, William Crawford", "The Strathspey, Reel and Hornpipe Tutor", "tutor and tune collection, at or below the floor")
D("Giray, Selim", "4-Octave Scales and Arpeggios for Violin", "self-published upload, not a published edition")
D("Alıcıoğlu, Şafak", "Concert Etudes, Op. 39 (10 Turkish folk songs)", "self-published upload, not a published edition")
D("Iversen, Niels Johannes Legarth", "12 Violin Etudes in Romantic Style, Op. 8", "composer's own manuscript upload, not a published edition")
DP("Glaser, Matt", "Jazz Violin", "transcribed jazz solos, not exercises")
DP("Lieberman, Julie Lyonn", "Improvising Violin", "improvisation method without exercises")
DP("Vaidel, Marino", "Five Études for Violin", "national-library record only, contents unseen")
D("Bang, Maia", "Violin Method, Part VII", "no contents listing found")

# ----------------------------------------------------------------- russian_soviet: Open Library/LC records only (no contents, no scan) are left out
for a, t in [("Sapozhnikov, S.", "Études on Complex Intonation"), ("Sapozhnikov, S.", "Études by Russian and Soviet Composers"),
             ("Karpachevsky, Zinovy", "Virtuoso Études"), ("Zakarian, Suren", "Études for Violin"),
             ("Sagaev, Dimitar", "Caprices for Solo Violin"), ("Stetsenko, Vadym", "Études for Violin")]:
    DP(a, t, "catalogue record only (Open Library/LC): contents not seen, level unknown")
# ----------------------------------------------------------------- topics: keep what has a publisher/IMSLP/library description of its contents; leave out tune books, self-published and weakly sourced ones
D("Sammons, Albert", "Virtuosic Studies, Op. 21 Book II (18 studies)", "edition details not seen (only a CD-retailer page)")
DP("Agopian, Edmond", "The No Time to Practice Technique Companion", "self-published, retailer listing only")
DP("Grissen, Carl", "Learn With Tunes, Book 3", "tune book for learning the positions, at or below the floor")
DP("Barmas, Issay", "Die Lösung des geigentechnischen Problems", "a technique treatise with music examples rather than a book of exercises (russian_soviet and IMSLP wording); scan incomplete")


# the american_modern researcher matched both volumes of two Rubank sets to the merged rows 665/2117: Vol. 2 of each becomes a row of its own
OK("whistler-harvey-s:preparing kreutzer 2", existing_id=None, set="Preparing for Kreutzer", title="Preparing for Kreutzer, Vol. 2")
OK("whistler-harvey-s:introducing positions 2 2nd 4th 6th 7th positions", existing_id=None, set="Introducing the Positions", title="Introducing the Positions, Vol. 2 (2nd, 4th, 6th and 7th positions)")

# ----------------------------------------------------------------- corrections to rows already in the catalogue
snap = json.loads((ROOT / "data/source/all-repertoire.json").read_text())["values"]
hdr = snap[0]
ci = {n: i for i, n in enumerate(hdr)}
cur = {}
for r in snap[1:]:
    g = lambda n: r[ci[n]] if ci[n] < len(r) else ""
    if g("ID"):
        cur[int(g("ID"))] = {"exams": g("Exam & syllabus lists")}

BOARD = {"ABRSM": 0, "Trinity": 1, "RCM": 2, "AMEB": 3, "ASTA": 4, "Henle": 5}
def board(t):
    return BOARD.get(t.split(" ")[0], 9)
def rcm_n(t):
    m = re.match(r"RCM (\d+)", t)
    return int(m.group(1)) if m else 0
def tok_n(t):
    if "CertPerf" in t:
        return 20
    if "LMusA" in t:
        return 21
    m = re.search(r"(\d+)", t)
    return int(m.group(1)) if m else 0
def add_exams(id_, *new):
    toks = [t for t in cur[id_]["exams"].split(" · ") if t]
    for t in new:
        if t in toks:
            continue
        pos = len(toks)
        for i, x in enumerate(toks):
            if board(x) > board(t) or (board(x) == board(t) and tok_n(x) > tok_n(t)):
                pos = i
                break
        toks.insert(pos, t)
    return " · ".join(toks)

existing = {
    # the big five: whole-book rows get '(complete)' like Paganini (id 629); the individual studies carry the book name as their set
    "614": {"title": "24 Études and Caprices, Op. 35 (complete)", "exams": add_exams(614, "RCM 10 (mvt)")},
    "622": {"title": "42 Études ou Caprices (complete)", "exams": add_exams(622, "RCM 4 (mvt)", "RCM 10 (mvt)")},
    "656": {"title": "24 Caprices (complete)", "exams": cur[656]["exams"].replace("Henle 4–7", "Henle 4–6")},
    "618": {"title": "24 Matinées (complete)", "notes": "Bowing-led études: varied bowings, double stops, trills, shifts", "exams": add_exams(618, "RCM 10 (mvt)")},
    "617": {"title": "36 Études or Caprices (complete)", "notes": "Graded bowing, double-stop and cantabile études, each flowing into the next", "exams": add_exams(617, "AMEB Gr 4 (mvt)")},
    # exam lists (RCM Violin Syllabus 2021, checked by the exam_boards/dont35/gavinies researchers)
    "611": {"title": "20 Études brillantes et caractéristiques, Op. 73", "exams": add_exams(611, "RCM 10 (mvt)")},
    "626": {"exams": "RCM 10 (mvt)"},
    "657": {"exams": "RCM 10 (mvt)"},
    "621": {"exams": add_exams(621, "RCM 4 (mvt)")},
    "669": {"exams": add_exams(669, "RCM 4 (mvt)")},
    "661": {"exams": add_exams(661, "RCM 4 (mvt)")},
    "662": {"exams": "RCM 6 (mvt)"},
    # titles, sets, notes
    "610": {"title": "15 Études faciles et caractéristiques (with 2nd violin), Op. 68", "accompaniment": "2 violins"},
    "604": {"title": "60 Études de concert (École transcendante), Op. 123"},
    "623": {"set": "École Léonard"},
    "627": {"set": "Études mélodiques et progressives, Op. 36"},
    "628": {"set": "Études mélodiques et progressives, Op. 36"},
    "667": {"notes": "Études-caprices between didactic and concert works, with second violin"},
    "3139": {"category": "Études & Caprices"},
    "2595": {"category": "Études & Caprices"},   # Kreisler, Study on a Choral: IMSLP files it under Studies (concert_etudes)
    "2806": {"category": "Études & Caprices"},   # Strauss, Daphne-Etude (concert_etudes)
    "2113": {"title": "School of Violin Technics, Book 1 (dexterity in the positions)", "set": "School of Violin Technics"},
    "606": {"notes": "Written for viola (or violin); Classical-era caprices on bowing, shifting and double stops"},
    "2116": {"title": "School of Violin Technique, Op. 1 Part 4 (double stops)", "set": "School of Violin Technique, Op. 1", "notes": "Double stops, chords, left-hand pizzicato and harmonics"},
    # levels
    "654": {"level": "3"},
    "608": {"level": "7"},   # Christoskov Op. 1: 'fairly simple in style' (russian_soviet, LSU dissertation 2006)
    "2112": {"level": "4"},
    # Rubank volumes that were merged in one row each: Vol. 1 stays here, Vol. 2 is added (web/manual.json)
    "665": {"title": "Preparing for Kreutzer, Vol. 1", "level": "2", "set": "Preparing for Kreutzer"},
    "2117": {"title": "Introducing the Positions, Vol. 1", "notes": "3rd and 5th positions", "set": "Introducing the Positions"},
}

out = {
    "existing": existing,
    "drop": drop,
    "override": override,
    "author_alias": author_alias,
    "author_meta": {
        "Balfoort, Dirk J.": {"era": "20th Century"},
        "Lindroth, Adolf Fredrik": {"era": "Late Romantic"},   # Swedish, undated 19th-century print
        "Hildebrandt, Merrick": {"era": "20th Century"},        # Schott Frères reprint, no dates found
    },
    "imslp_pages": {"656": "24 Caprices for Solo Violin, Op.22 (Rode, Pierre)"},
}
(TECH / "decisions.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(f"decisions.json: {len(existing)} existing-row corrections, {len(drop)} drops, {len(override)} overrides, {len(author_alias)} author aliases")
