# Technical materials, October 2026

The catalogue grew from **3167** to **4061** works: **894 technical books and studies** were added (scale systems, exercise and technique books, étude and caprice books, concert études, from many traditions), and 45 cells in 29 existing rows were corrected.

## What counts, what does not
- **In:** published (in print, on IMSLP or digitised by a national library) violin material whose purpose is technical or étude-based: scale and arpeggio systems, daily-practice and exercise books (shifting, double stops, trills, harmonics, bow technique, vibrato, left-hand pizzicato), technique "schools" and exam-board scale books, books of studies/études/caprices of every kind (preparatory to virtuoso), analytical studies on concertos, concert études, solo caprice sets. One entry per separately published book, part or volume (Ševčík Op. 1 has four, Schradieck three…).
- **Individual studies** of the five standard sets are rows of their own, each graded separately and grouped under the book's name: Kreutzer 42, Rode 24, Dont Op. 35 (24), Gaviniès 24 Matinées and Fiorillo 36. The whole-book rows stay and now end in "(complete)", like Paganini's caprices.
- **Floor:** the catalogue still starts at level 1 (ABRSM 3–4 / RCM 4–5). First-position primers, beginner tutors and pre-grade-3 exam books were left out (researchers listed them as skipped; two graders could also mark a book "below the floor").
- **Out:** prose treatises (Flesch, Galamian, Auer…), orchestral-excerpt books, sight-reading/ear-training, repertoire pieces, anthologies of other people's pieces, unpublished/manuscript or self-published uploads, arrangements for other instruments, and entries whose only evidence was a catalogue record without any description of the contents.

## How it was done (no API spend: everything ran through Claude Code subagents)
- **18 research slices** by tradition and topic (american_modern, central_european, concert_etudes, dont35, exam_boards, fiorillo, franco_a, franco_b, gavinies, german_a, german_b, italian_baroque, kreutzer, rode, russian_soviet, sevcik, topics, world_other). Each researcher read IMSLP (author categories and work pages through its API), Wikipedia, publisher catalogues (Schott, Peters, Bärenreiter, Henle, Carl Fischer, Hal Leonard, Shar…), national-library records (BnF, DNB, LoC, NB, LIBRIS…) and syllabi (RCM, ABRSM, AMEB, ASTA, Trinity), and reported structured entries with a source URL, an edition and a confidence. Together they reported 1062 works and 746 deliberate skips with reasons; after merging duplicates between researchers and removing what the catalogue already had, **894** were new.
- A cross-check **by technique topic** (the `topics` slice) and a sweep of IMSLP's study/method/exercise/caprice categories caught books the author-by-author researchers had missed.
- **Levels** are the median of three independent judgements: the researcher's, and two *blind* graders (Claude Opus 5.5 and Sonnet 5.5) who saw only titles, contents and the catalogue's own anchors. The two graders agreed exactly on 58% of items and within one level on 96%; 71% of the final levels equal the researcher's first guess. 10 single studies with a documented syllabus placement are set by hand to the researcher's level instead of the median (Kreutzer Nos. 2, 3, 5, 7 and 13, Gaviniès Matinées Nos. 4, 13, 14 and 17, Rode Caprice No. 8; `final_level` in `decisions.json`). Fiorillo No. 4 keeps the median (5): its researcher level (3) was an estimate and both graders said 5.
- **Checks:** every IMSLP page named by a researcher exists (API check, 0 missing of 283); opus numbers agree with the IMSLP page titles (5 differences of 668, all explained); books listed twice by different researchers under different languages or titles were found by a title/opus/part comparison and merged. In all, 76 researcher entries were left out after review (duplicates and weakly sourced ones, see below).
- Ids 3305–4198 are new and permanent (`data/expansion/id-registry.json`). Renamed pieces keep their addresses through `data/slug-redirects.json`.

## Result
- 468 entries in *Études & Caprices*, 426 in *Technique & Scales*; levels 1–9 (counts by level: 1: 76, 2: 132, 3: 154, 4: 135, 5: 114, 6: 138, 7: 92, 8: 47, 9: 6).
- Evidence quality: 319 high, 324 medium, 251 low confidence (low = the book exists and is documented, but its contents or level rest on its title and series position).
- Sets (the site groups them): 24 Études and Caprices, Op. 35 (24); 36 Études or Caprices (36); 24 Matinées (24); 42 Études ou Caprices (42); 24 Caprices (24).
- The advisor's cached prompt is unchanged in size: technical rows rank below repertoire there (`techPenalty` in `scripts/build-data.ts`; individual studies −4, other technical books −1), and the advisor reaches all of them through its search tool.

## Entries by author (top 40)

| Author | Entries |
|---|---:|
| Kreutzer, Rodolphe | 43 |
| Ševčík, Otakar | 39 |
| Fiorillo, Federigo | 36 |
| Dont, Jakob | 29 |
| Rode, Pierre | 25 |
| Gaviniès, Pierre | 24 |
| Sitt, Hans | 19 |
| Dounis, Demetrius Constantine | 18 |
| Crickboom, Mathieu | 14 |
| Doukan, Pierre | 14 |
| Dancla, Charles | 12 |
| Bériot, Charles de | 11 |
| Henley, William | 11 |
| Jacobsen, Maxim | 11 |
| Hoya, Amadeo von der | 10 |
| Seybold, Arthur | 10 |
| Heim, Ernst | 9 |
| Yost, Gaylord | 9 |
| Eberhardt, Goby | 8 |
| Hermann, Friedrich | 8 |
| Herrmann, Eduard | 8 |
| Cohen, Mary | 7 |
| ABRSM | 6 |
| Carse, Adam | 6 |
| David, Ferdinand | 6 |
| Eichberg, Julius | 6 |
| Kross, Emil | 6 |
| Küchler, Ferdinand | 6 |
| Panofka, Heinrich | 6 |
| Sauret, Émile | 6 |
| Zehetmair, Helmut | 6 |
| Abel, Ludwig | 5 |
| Bloch, József | 5 |
| Campagnoli, Bartolomeo | 5 |
| Casorti, August | 5 |
| Fischer, Simon | 5 |
| Kayser, Heinrich Ernst | 5 |
| Klasinc, Walter | 5 |
| Pestel, Édouard | 5 |
| Alard, Jean-Delphin | 4 |

## Corrections to existing entries

Found by the researchers and checked against sources (RCM Violin Syllabus 2021, IMSLP, publishers); decided in `data/expansion/tech/make_decisions.py`.

| id | Field | Before | After |
|---:|---|---|---|
| 604 | title | 60 Études, Op. 123 | 60 Études de concert (École transcendante), Op. 123 |
| 606 | notes | Classical-era caprices (also used by violists) | Written for viola (or violin); Classical-era caprices on bowing, shifting and double stops |
| 608 | level | 8 | 7 |
| 610 | title | 15 Études (with 2nd violin), Op. 68 | 15 Études faciles et caractéristiques (with 2nd violin), Op. 68 |
| 610 | accompaniment | Unaccompanied | 2 violins |
| 611 | title | 20 Études brillantes, Op. 73 | 20 Études brillantes et caractéristiques, Op. 73 |
| 611 | exams | RCM 9 (mvt) · AMEB Gr 5 · AMEB Gr 8 (mvt) · AMEB CertPerf (mvt) · ASTA | RCM 9 (mvt) · RCM 10 (mvt) · AMEB Gr 5 · AMEB Gr 8 (mvt) · AMEB CertPerf (mvt) · ASTA CAP 6 · ASTA CAP 7 (mvt) |
| 614 | title | 24 Études and Caprices, Op. 35 | 24 Études and Caprices, Op. 35 (complete) |
| 614 | exams | AMEB Gr 8 (mvt) · AMEB CertPerf (mvt) · ASTA CAP 9 · ASTA CAP 10 · Hen | RCM 10 (mvt) · AMEB Gr 8 (mvt) · AMEB CertPerf (mvt) · ASTA CAP 9 · ASTA CAP 10 · Henle 4–6 |
| 617 | title | 36 Études or Caprices | 36 Études or Caprices (complete) |
| 617 | notes | Bridges Kreutzer and Rode; trills & bowing | Graded bowing, double-stop and cantabile études, each flowing into the next |
| 617 | exams | RCM 8 (mvt) · RCM 9 (mvt) · AMEB Gr 6 · AMEB Gr 7 · AMEB Gr 8 (mvt) ·  | RCM 8 (mvt) · RCM 9 (mvt) · AMEB Gr 4 (mvt) · AMEB Gr 6 · AMEB Gr 7 · AMEB Gr 8 (mvt) · AMEB CertPerf (mvt) ·  |
| 618 | title | 24 Matinées | 24 Matinées (complete) |
| 618 | notes | Advanced classical études; high positions | Bowing-led études: varied bowings, double stops, trills, shifts |
| 618 | exams | AMEB CertPerf (mvt) · ASTA CAP 10 | RCM 10 (mvt) · AMEB CertPerf (mvt) · ASTA CAP 10 |
| 621 | exams | RCM 5 (mvt) · RCM 6 (mvt) · RCM 7 (mvt) · AMEB Gr 4 (mvt) · AMEB Gr 5  | RCM 4 (mvt) · RCM 5 (mvt) · RCM 6 (mvt) · RCM 7 (mvt) · AMEB Gr 4 (mvt) · AMEB Gr 5 · AMEB Gr 6 · AMEB Gr 7 ·  |
| 622 | title | 42 Études ou Caprices | 42 Études ou Caprices (complete) |
| 622 | exams | ABRSM ARSM (mvt) · RCM 6 (mvt) · RCM 7 (mvt) · RCM 8 (mvt) · RCM 9 (mv | ABRSM ARSM (mvt) · RCM 4 (mvt) · RCM 6 (mvt) · RCM 7 (mvt) · RCM 8 (mvt) · RCM 9 (mvt) · RCM 10 (mvt) · AMEB G |
| 623 | set |  | École Léonard |
| 626 | exams |  | RCM 10 (mvt) |
| 627 | set |  | Études mélodiques et progressives, Op. 36 |
| 628 | set |  | Études mélodiques et progressives, Op. 36 |
| 654 | level | 5 | 3 |
| 656 | title | 24 Caprices | 24 Caprices (complete) |
| 656 | exams | RCM 9 (mvt) · RCM 10 (mvt) · AMEB Gr 7 · AMEB Gr 8 (mvt) · ASTA CAP 9  | RCM 9 (mvt) · RCM 10 (mvt) · AMEB Gr 7 · AMEB Gr 8 (mvt) · ASTA CAP 9 · ASTA CAP 10 · Henle 4–6 |
| 657 | exams |  | RCM 10 (mvt) |
| 661 | exams | RCM 5 (mvt) · RCM 6 (mvt) · RCM 7 (mvt) · ASTA CAP 6 | RCM 4 (mvt) · RCM 5 (mvt) · RCM 6 (mvt) · RCM 7 (mvt) · ASTA CAP 6 |
| 662 | exams |  | RCM 6 (mvt) |
| 665 | title | Preparing for Kreutzer, Vols. 1–2 | Preparing for Kreutzer, Vol. 1 |
| 665 | level | 3 | 2 |
| 665 | set |  | Preparing for Kreutzer |
| 667 | notes | 2 violins | Études-caprices between didactic and concert works, with second violin |
| 669 | exams | RCM 5 (mvt) · RCM 6 (mvt) · AMEB Gr 4 (mvt) · AMEB Gr 5 (mvt) · ASTA C | RCM 4 (mvt) · RCM 5 (mvt) · RCM 6 (mvt) · AMEB Gr 4 (mvt) · AMEB Gr 5 (mvt) · ASTA CAP 5 |
| 2112 | level | 3 | 4 |
| 2113 | title | School of Violin Technique, Book 1 | School of Violin Technics, Book 1 (dexterity in the positions) |
| 2113 | set |  | School of Violin Technics |
| 2116 | title | School of Violin Technique, Book 1 Part 4, Op. 1 (double stops) | School of Violin Technique, Op. 1 Part 4 (double stops) |
| 2116 | set |  | School of Violin Technique, Op. 1 |
| 2116 | notes | Advanced double-stop exercises | Double stops, chords, left-hand pizzicato and harmonics |
| 2117 | title | Introducing the Positions, Vols. 1–2 | Introducing the Positions, Vol. 1 |
| 2117 | notes | Vol. 1: 3rd and 5th positions; Vol. 2: 2nd, 4th, 6th and 7th | 3rd and 5th positions |
| 2117 | set |  | Introducing the Positions |
| 2595 | category | Solo Violin | Études & Caprices |
| 2806 | category | Solo Violin | Études & Caprices |
| 3139 | category | Solo Violin | Études & Caprices |

## Left out after review (decisions)

Duplicates (same book listed twice) and weakly sourced entries, each with its reason (full list in `data/expansion/tech/decisions.json`):

- 8× same book as the entry that names its contents
- 6× catalogue record only (Open Library/LC): contents not seen, level unknown
- 5× same book, German title
- 4× same volume listed under another title (French titles kept)
- 4× same book, German-only title
- 4× national-library record only (copies restricted), contents unseen, levels guessed from the numbering
- 3× same book, German-first title
- 3× kept as the single entry '20 Etüden, Opp. 15 and 17'
- 2× attribution (Sr. or Jr.) and contents unresolved
- 2× same book; title carried over to the kept entry
- 2× national-library record only, contents unseen
- 2× self-published upload, not a published edition
- 1× same book as 'Double-Stopping Exercises, Op. 61'
- 1× same book as 'Technique of the Bow, Op. 50'
- 1× same book as 'Change of Position Studies, Op. 36 (The Development of Flexibility, Book 2)'
- 1× same book (spelling variant)
- 1× published as Book 1 and Book 2, which are listed separately
- 1× same book as 'Scales and Scale Studies for the Violin' (Edition Peters title)
- 1× same book as 'New Scale Studies (Neue Tonleiterstudien)'
- 1× same book as 'Book 3 (all positions)'
- 1× listed as Books 1-3
- 1× same book as '24 Caprices (d'exécution transcendante), Op. 25'
- 1× same book as 'Bogenstudien (Bowing Studies), Op. 14'
- 1× same book as 'Tägliche Tonleiterstudien (Études de gammes), Op. 19'
- 1× same book as '12 Caprices, Op. 46'
- 1× same book as the 'more difficult studies in 1st position' entry
- 1× same book as the other Book 6 entry
- 1× same book as 'Book 12 (Künstleretüden)'
- 1× superseded by the 2021 edition, which is kept
- 1× listed as Op. 54 and Op. 55 separately
- 1× already in the catalogue (id 2595)
- 1× no named author or edition details
- 1× national-library record only; part of a beginner school
- 1× level and contents not seen
- 1× tutor and tune collection, at or below the floor
- 1× composer's own manuscript upload, not a published edition
- 1× transcribed jazz solos, not exercises
- 1× improvisation method without exercises
- 1× no contents listing found
- 1× edition details not seen (only a CD-retailer page)
- 1× self-published, retailer listing only
- 1× tune book for learning the positions, at or below the floor
- 1× a technique treatise with music examples rather than a book of exercises (russian_soviet and IMSLP wording); scan incomplete

Below the floor by the graders: Crickboom, La Technique du violon, Vol. 1 (scales and arpeggios in first position); Dancla, 36 Études mélodiques et très faciles, Op. 84; Sitt, 100 Studies, Op. 32 Book 1 (first position).

## Caveats
- AMEB and ASTA pages were unreachable for the researchers (AMEB is behind a bot check, the ASTA CAP handbook is members-only), so exam-list entries for those boards were not re-checked; RCM entries follow the 2021 syllabus.
- Levels of low-confidence entries (and of single études whose key could not be confirmed on a scan: Fiorillo Nos. 4, 12, 23, 26 and 33 carry no key in their title) are estimates.
- Left-hand pizzicato and quarter-tone playing have no standard published book beyond Zeikel (1936); Soviet teaching literature is thinly documented outside the Russian State Library (unreachable).
- Folk and jazz material was kept only where a publisher or library describes exercises or études (Huebner, Lockwood); improvisation methods and transcription books were left out.
- Anything the researchers could not confirm was left out rather than guessed, so gaps are possible; `data/expansion/tech/NOTES.md` explains how to re-run a slice.
