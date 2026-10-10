#!/usr/bin/env python3
"""Writes docs/technical-materials-2026-10.md from the run's files (run after regen.sh)."""
import json, collections, glob
from pathlib import Path
ROOT = Path(__file__).resolve().parents[3]
T = ROOT / "data/expansion/tech"
added = json.loads((T / "final/added.json").read_text())
changes = json.loads((T / "final/changes.json").read_text())
skipped = json.loads((T / "final/skipped.json").read_text())
dec = json.loads((T / "decisions.json").read_text())
matches = json.loads((T / "final/matches.json").read_text())
cat = json.loads((ROOT / "public/data/catalogue.json").read_text())
opus = {g["key"]: g["level"] for g in json.loads((T / "grades/opus.json").read_text())["grades"]}
sonn = {g["key"]: g["level"] for g in json.loads((T / "grades/sonnet.json").read_text())["grades"]}

groups = {}
for f in sorted(glob.glob(str(T / "web/*.json"))):
    d = json.loads(Path(f).read_text())
    groups[d["group"]] = d
n_works = sum(len(d["works"]) for d in groups.values())
n_skipped = sum(len(d.get("skipped", [])) for d in groups.values())

both = [k for k in (a["key"] for a in added) if k in opus and k in sonn]
exact = sum(opus[k] == sonn[k] for k in both)
within1 = sum(abs(opus[k] - sonn[k]) <= 1 for k in both)
unchanged = sum(a["level"] == a["level_guess"] for a in added)
conf = collections.Counter(a["confidence"] for a in added)
cats = collections.Counter(a["category"] for a in added)
lv = collections.Counter(a["level"] for a in added)
per_author = collections.Counter(a["author"] for a in added)
big5 = {"Kreutzer, Rodolphe": "42 Études ou Caprices", "Rode, Pierre": "24 Caprices", "Dont, Jakob": "24 Études and Caprices, Op. 35",
        "Gaviniès, Pierre": "24 Matinées", "Fiorillo, Federigo": "36 Études or Caprices"}
sets = collections.Counter((p["composer"], p["set"]) for p in cat["pieces"] if p["set"])

out = []
w = out.append
w("# Technical materials, October 2026\n")
w(f"The catalogue grew from **3167** to **{len(cat['pieces'])}** works: **{len(added)} technical books and studies** were added (scale systems, exercise and technique books, étude and caprice books, concert études, from many traditions), and {len(changes)} cells in {len(set(c['id'] for c in changes))} existing rows were corrected.\n")
w("## What counts, what does not")
w("- **In:** published (in print, on IMSLP or digitised by a national library) violin material whose purpose is technical or étude-based: scale and arpeggio systems, daily-practice and exercise books (shifting, double stops, trills, harmonics, bow technique, vibrato, left-hand pizzicato), technique \"schools\" and exam-board scale books, books of studies/études/caprices of every kind (preparatory to virtuoso), analytical studies on concertos, concert études, solo caprice sets. One entry per separately published book, part or volume (Ševčík Op. 1 has four, Schradieck three…).")
w("- **Individual studies** of the five standard sets are rows of their own, each graded separately and grouped under the book's name: Kreutzer 42, Rode 24, Dont Op. 35 (24), Gaviniès 24 Matinées and Fiorillo 36. The whole-book rows stay and now end in \"(complete)\", like Paganini's caprices.")
w("- **Floor:** the catalogue still starts at level 1 (ABRSM 3–4 / RCM 4–5). First-position primers, beginner tutors and pre-grade-3 exam books were left out (researchers listed them as skipped; two graders could also mark a book \"below the floor\").")
w("- **Out:** prose treatises (Flesch, Galamian, Auer…), orchestral-excerpt books, sight-reading/ear-training, repertoire pieces, anthologies of other people's pieces, unpublished/manuscript or self-published uploads, arrangements for other instruments, and entries whose only evidence was a catalogue record without any description of the contents.\n")
w("## How it was done (no API spend: everything ran through Claude Code subagents)")
w(f"- **{len(groups)} research slices** by tradition and topic ({', '.join(sorted(groups))}). Each researcher read IMSLP (author categories and work pages through its API), Wikipedia, publisher catalogues (Schott, Peters, Bärenreiter, Henle, Carl Fischer, Hal Leonard, Shar…), national-library records (BnF, DNB, LoC, NB, LIBRIS…) and syllabi (RCM, ABRSM, AMEB, ASTA, Trinity), and reported structured entries with a source URL, an edition and a confidence. Together they reported {n_works} works and {n_skipped} deliberate skips with reasons; after merging duplicates between researchers and removing what the catalogue already had, **{len(added)}** were new.")
w("- A cross-check **by technique topic** (the `topics` slice) and a sweep of IMSLP's study/method/exercise/caprice categories caught books the author-by-author researchers had missed.")
w(f"- **Levels** are the median of three independent judgements: the researcher's, and two *blind* graders (Claude Opus 5.5 and Sonnet 5.5) who saw only titles, contents and the catalogue's own anchors. The two graders agreed exactly on {exact/len(both):.0%} of items and within one level on {within1/len(both):.0%}; {unchanged/len(added):.0%} of the final levels equal the researcher's first guess. {len(dec.get('final_level', {}))} single studies with a documented syllabus placement are set by hand to the researcher's level instead of the median (Kreutzer Nos. 2, 3, 5, 7 and 13, Gaviniès Matinées Nos. 4, 13, 14 and 17, Rode Caprice No. 8; `final_level` in `decisions.json`). Fiorillo No. 4 keeps the median (5): its researcher level (3) was an estimate and both graders said 5.")
w("- **Checks:** every IMSLP page named by a researcher exists (API check, 0 missing of 283); opus numbers agree with the IMSLP page titles (5 differences of 668, all explained); books listed twice by different researchers under different languages or titles were found by a title/opus/part comparison and merged. In all, {} researcher entries were left out after review (duplicates and weakly sourced ones, see below).".format(len(dec['drop'])))
w("- Ids 3305–4198 are new and permanent (`data/expansion/id-registry.json`). Renamed pieces keep their addresses through `data/slug-redirects.json`.\n")
w("## Result")
w(f"- {cats['Études & Caprices']} entries in *Études & Caprices*, {cats['Technique & Scales']} in *Technique & Scales*; levels 1–9 (counts by level: " + ", ".join(f"{l}: {lv[l]}" for l in sorted(lv)) + ").")
w(f"- Evidence quality: {conf['high']} high, {conf['medium']} medium, {conf['low']} low confidence (low = the book exists and is documented, but its contents or level rest on its title and series position).")
w("- Sets (the site groups them): " + "; ".join(f"{k[1]} ({v})" for k, v in sets.items() if k[0] in big5 and k[1] == big5[k[0]]) + ".")
w(f"- The advisor's cached prompt is unchanged in size: technical rows rank below repertoire there (`techPenalty` in `scripts/build-data.ts`; individual studies −4, other technical books −1), and the advisor reaches all of them through its search tool.\n")
w("## Entries by author (top 40)\n")
w("| Author | Entries |\n|---|---:|")
for a, n in per_author.most_common(40):
    w(f"| {a} | {n} |")
w("")
w("## Corrections to existing entries\n")
w("Found by the researchers and checked against sources (RCM Violin Syllabus 2021, IMSLP, publishers); decided in `data/expansion/tech/make_decisions.py`.\n")
w("| id | Field | Before | After |\n|---:|---|---|---|")
for c in changes:
    b = str(c["before"]).replace("|", "/")[:70]
    a = str(c["after"]).replace("|", "/")[:110]
    w(f"| {c['id']} | {c['field']} | {b} | {a} |")
w("")
w("## Left out after review (decisions)\n")
w("Duplicates (same book listed twice) and weakly sourced entries, each with its reason (full list in `data/expansion/tech/decisions.json`):\n")
reasons = collections.Counter(dec["drop"].values())
for r, n in reasons.most_common(60):
    w(f"- {n}× {r}")
w("")
fl = [x for x in skipped if "below the catalogue floor" in x.get("reason", "")]
if fl:
    w("Below the floor by the graders: " + "; ".join(f"{x['author'].split(',')[0]}, {x['title']}" for x in fl) + ".\n")
w("## Caveats")
w("- AMEB and ASTA pages were unreachable for the researchers (AMEB is behind a bot check, the ASTA CAP handbook is members-only), so exam-list entries for those boards were not re-checked; RCM entries follow the 2021 syllabus.")
w("- Levels of low-confidence entries (and of single études whose key could not be confirmed on a scan: Fiorillo Nos. 4, 12, 23, 26 and 33 carry no key in their title) are estimates.")
w("- Left-hand pizzicato and quarter-tone playing have no standard published book beyond Zeikel (1936); Soviet teaching literature is thinly documented outside the Russian State Library (unreachable).")
w("- Folk and jazz material was kept only where a publisher or library describes exercises or études (Huebner, Lockwood); improvisation methods and transcription books were left out.")
w("- Anything the researchers could not confirm was left out rather than guessed, so gaps are possible; `data/expansion/tech/NOTES.md` explains how to re-run a slice.\n")
(ROOT / "docs/technical-materials-2026-10.md").write_text("\n".join(out))
print("written", len(out), "lines")
