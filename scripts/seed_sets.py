"""One-off: seed the Sheet's "Set" column (R) from the current All Repertoire rows.

Input:  data/source/all-repertoire.json (Sheets get_values dump, header + rows)
Output: data/source/set-column.json  -> list of set names (or "") in sheet row order
"""
import json
import re
import sys
import unicodedata
from collections import Counter

rows = json.load(open("data/source/all-repertoire.json"))["values"][1:]


def fold(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()


# (composer prefix, catalogue key) -> set name. Catalogue key is matched as "<key> No. N" in the title.
OPUS = {
    ("Paganini", "Op. 1"): "24 Caprices, Op. 1",
    ("Paganini", "MS 112"): "Centone di sonate, MS 112",
    ("Cui", "Op. 50"): "Kaléidoscope, Op. 50",
    ("David, Ferdinand", "Op. 30"): "Bunte Reihe, Op. 30",
    ("Brahms", "WoO 1"): "Hungarian Dances (arr. Joachim)",
    ("Shostakovich", "Op. 34"): "24 Preludes, Op. 34 (arr. Tsyganov)",
    ("Locatelli", "Op. 3"): "L'arte del violino, Op. 3",
    ("Leclair", "Op. 1"): "Violin Sonatas, Op. 1",
    ("Leclair", "Op. 2"): "Violin Sonatas, Op. 2",
    ("Leclair", "Op. 5"): "Violin Sonatas, Op. 5",
    ("Leclair", "Op. 9"): "Violin Sonatas, Op. 9",
    ("Alberti", "Op. 2"): "Sonatas, Op. 2",
    ("Albinoni", "Op. 6"): "Trattenimenti armonici per camera, Op. 6",
    ("Corelli", "Op. 5"): "Violin Sonatas, Op. 5",
    ("Geminiani", "Op. 1"): "Violin Sonatas, Op. 1",
    ("Geminiani", "Op. 4"): "Violin Sonatas, Op. 4",
    ("Tartini", "Op. 1"): "Violin Sonatas, Op. 1",
    ("Tartini", "Op. 2"): "Violin Sonatas, Op. 2",
    ("Veracini", "Op. 2"): "Sonate accademiche, Op. 2",
    ("Vivaldi", "Op. 2"): "Violin Sonatas, Op. 2",
    ("Vivaldi", "Op. 5"): "Sonatas, Op. 5",
    ("Vivaldi", "Op. 3"): "L'estro armonico, Op. 3",
    ("Vivaldi", "Op. 8"): "Il cimento dell'armonia e dell'inventione, Op. 8",
    ("Bonporti", "Op. 10"): "Inventions, Op. 10",
    ("Reger", "Op. 117"): "Preludes and Fugues, Op. 117",
    ("Reger", "Op. 91"): "Seven Sonatas for Solo Violin, Op. 91",
    ("Reger", "Op. 131a"): "Six Preludes and Fugues, Op. 131a",
    ("Reger", "Op. 42"): "Four Sonatas for Solo Violin, Op. 42",
    ("Handel", "Op. 1"): "Violin Sonatas",
    ("Dancla", "Op. 89"): "Six Petits Airs variés, Op. 89",
    ("Dancla", "Op. 118"): "Airs variés on Opera Themes, Op. 118",
    ("Sibelius", "Op. 79"): "Six Pieces, Op. 79",
    ("Sibelius", "Op. 81"): "Five Pieces, Op. 81",
    ("Sibelius", "Op. 106"): "Danses champêtres, Op. 106",
    ("Sibelius", "Op. 87"): "Humoresques, Op. 87 & 89",
    ("Sibelius", "Op. 89"): "Humoresques, Op. 87 & 89",
    ("Viardot", "VWV 3003"): "Six Morceaux, VWV 3003",
    ("Ysaÿe", "Op. 27"): "Six Sonatas for Solo Violin, Op. 27",
    ("Ysaÿe", "Op. 10"): "Two Mazurkas de salon, Op. 10",
    ("Weber", "Op. 10b"): "Six Progressive Sonatas, Op. 10b",
    ("Aulin", "Op. 23"): "Gotland Dances, Op. 23",
    ("Burleigh, Cecil", "Op. 40"): "Five Indian Sketches, Op. 40",
    ("Burleigh, Cecil", "Op. 13"): "Four Prairie Sketches, Op. 13",
    ("Moszkowski", "Op. 12"): "Spanish Dances, Op. 12 (arr. Scharwenka)",
    ("Respighi", "P. 62"): "Cinque pezzi, P. 62",
    ("Bridge", "H. 104"): "Four Short Pieces, H. 104",
    ("Coleridge-Taylor", "Op. 58"): "African Dances, Op. 58",
    ("Coleridge-Taylor", "Op. 16"): "Hiawathan Sketches, Op. 16",
    ("Coleridge-Taylor", "Op. 9"): "Two Romantic Pieces, Op. 9",
    ("Dvořák", "Op. 75"): "Romantic Pieces, Op. 75",
    ("Suk", "Op. 17"): "Four Pieces, Op. 17",
    ("White, Clarence", "Op. 12"): "Bandanna Sketches, Op. 12",
    ("White, Clarence", "Op. 18"): "From the Cotton Fields, Op. 18",
    ("Schumann, Clara", "Op. 22"): "Three Romances, Op. 22",
    ("Schumann, Robert", "Op. 94"): "Three Romances, Op. 94",
    ("Tchaikovsky", "Op. 42"): "Souvenir d'un lieu cher, Op. 42",
    ("Vieuxtemps", "Op. 7"): "Romances sans paroles, Op. 7",
    ("Hindemith", "Op. 11"): "Sonatas, Op. 11",
    ("Hindemith", "Op. 31"): "Two Sonatas for Solo Violin, Op. 31",
    ("Beethoven", "Op. 12"): "Three Sonatas, Op. 12",
    ("Beethoven", "Op. 30"): "Three Sonatas, Op. 30",
    ("Saint-Georges", "Op. 1a"): "Three Sonatas, Op. 1a",
    ("Schubert", "Op. 137"): "Three Sonatinas, Op. 137",
    ("Szymanowski", "Op. 40"): "Three Paganini Caprices, Op. 40",
    ("Stenhammar", "Op. 28"): "Two Sentimental Romances, Op. 28",
}

# (composer prefix, title regex) -> set name, for sets without "<opus> No. N" titles.
# Also catches the complete-set rows that were kept alongside their pieces.
TITLE = [
    ("Biber", r"Rosary", "Rosary (Mystery) Sonatas"),
    ("Westhoff", r"Suite for Solo Violin No\.", "Six Suites for Solo Violin"),
    ("Telemann", r"TWV 41:", "Six Sonatas (1715)"),
    ("Locatelli", r"L'arte del violino|Op\. 3 No\.", "L'arte del violino, Op. 3"),
    ("Weinberg", r"Sonata for Solo Violin No\.", "Three Sonatas for Solo Violin"),
    ("Bloch", r"Suite for Solo Violin No\.", "Two Suites for Solo Violin"),
    ("García Abril", r"^Partita No\.", "Six Partitas ('Hilary')"),
    ("Hubay", r"Scène de la csárda", "Scènes de la csárda"),
    ("Sibelius", r"Humoresques", "Humoresques, Op. 87 & 89"),
    ("Sibelius", r"Danses champêtres, Op\. 106$", "Danses champêtres, Op. 106"),
    ("Stenhammar", r"Two Sentimental Romances", "Two Sentimental Romances, Op. 28"),
    ("Suk", r"Four Pieces, Op\. 17", "Four Pieces, Op. 17"),
    ("Dvořák", r"Four Romantic Pieces", "Romantic Pieces, Op. 75"),
    ("Schumann, Clara", r"Three Romances", "Three Romances, Op. 22"),
    ("Schumann, Robert", r"Three Romances", "Three Romances, Op. 94"),
    ("Coleridge-Taylor", r"^African Dances", "African Dances, Op. 58"),
    ("Coleridge-Taylor", r"^Hiawathan Sketches", "Hiawathan Sketches, Op. 16"),
    ("Coleridge-Taylor", r"^Two Romantic Pieces", "Two Romantic Pieces, Op. 9"),
    ("Ben-Haim", r"Three Songs Without Words", "Three Songs Without Words"),
    ("Aulin", r"Gotland Dances", "Gotland Dances, Op. 23"),
    ("Copland", r"Two Pieces|from Two Pieces", "Two Pieces"),
    ("Halvorsen", r"^Norwegian Dance", "Norwegian Dances"),
    ("Gershwin", r"Prelude", "Three Preludes (arr. Heifetz)"),
    ("Szymanowski", r"Three Paganini Caprices", "Three Paganini Caprices, Op. 40"),
    ("Foss", r"Three American Pieces", "Three American Pieces"),
    ("Fetler", r"Three Pieces", "Three Pieces"),
    ("Walton", r"Two Pieces", "Two Pieces"),
    ("Andrée", r"Two Romances", "Two Romances"),
    ("Silvestrov", r"Two Pieces", "Two Pieces"),
    ("Maier", r"Six Pieces", "Six Pieces"),
    ("Toldrà", r"Sis sonets|Six Sonnets", "Six Sonnets"),
    ("Portnoff", r"Russian Fantasia", "Russian Fantasias"),
    ("Prokofiev", r"Cinderella", "Cinderella (arr. Fichtenholz)"),
    ("Thomson", r"Portrait", "Portraits for Solo Violin"),
    ("Bach, Johann Sebastian", r"^Cello Suite No\.", "Cello Suites (trans. for violin)"),
    ("Bach, Johann Sebastian", r"Concerto .*BWV 10(41|42|52R|56R)", None),
]

BACH_SOLO = {  # BWV -> name of the complete work (movements group under it)
    "1001": "Sonata No. 1 in G minor, BWV 1001",
    "1002": "Partita No. 1 in B minor, BWV 1002",
    "1003": "Sonata No. 2 in A minor, BWV 1003",
    "1004": "Partita No. 2 in D minor, BWV 1004",
    "1005": "Sonata No. 3 in C major, BWV 1005",
    "1006": "Partita No. 3 in E major, BWV 1006",
}

out, unmatched_keys = [], Counter()
for comp, title, *_ in rows:
    name = ""
    if comp.startswith("Bach, Johann Sebastian"):
        m = re.search(r"BWV (100[1-6])\b", title)
        if m:
            name = BACH_SOLO[m.group(1)]
    if not name:
        for cpre, rx, nm in TITLE:
            if comp.startswith(cpre) and re.search(rx, title):
                name = nm or ""
                break
    if not name:
        m = re.search(r"\b(Op\.\s*\d+[a-z]?|WoO\s*\d+|MS\s*\d+|H\.\s*\d+|P\.\s*\d+|VWV\s*\d+)\s*No\.\s*\d+", title)
        if m:
            key = re.sub(r"\s+", " ", m.group(1))
            for (cpre, k), nm in OPUS.items():
                if comp.startswith(cpre) and k == key:
                    name = nm
                    break
            else:
                unmatched_keys[(comp, key)] += 1
    out.append(name)

sizes = Counter((rows[i][0], n) for i, n in enumerate(out) if n)
singletons = [k for k, c in sizes.items() if c < 2]
print("rows in a set:", sum(1 for n in out if n), "sets:", len(sizes))
print("singleton sets (check):", singletons)
print("opus+No groups with >=3 rows not mapped:", [(k, c) for k, c in unmatched_keys.items() if c >= 3])
if "-v" in sys.argv:
    for (c, n), k in sorted(sizes.items()):
        print(f"{k:3} {c[:28]:28} {n}")
json.dump(out, open("data/source/set-column.json", "w"), ensure_ascii=False)
