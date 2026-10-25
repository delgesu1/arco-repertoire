# Gap slices g01 and g02: recorded works the fact-checkers found missing

During the fact-check (phase 5) the checkers noticed recorded works that have no entry in `data/chamber/works.json`. The owner ruled (2026-10-24): research them and add the ones that pass the floor. Each gap slice is a short, named list instead of an IMSLP input file; everything else follows `data/chamber/curation/AGENT_BRIEF.md` (scope, floor, one entry per work, fields, house style, levels, sources and method, output format, working rules). There is no `input/<slice>.json`, so ignore what the brief says about covering input pages; list every candidate below as kept or skipped.

Before adding a work, search `data/chamber/works.json` for it (by composer and by title words): if it is already there under another title, skip it with the reason "already in the catalogue as <id>". A version of a work already in the catalogue gets its own entry only when the brief's rule on versions allows it (a different scoring by the composer that is recorded and performed as such).

## g01: earlier repertoire
- Lawes, William: Harp Consorts Nos. 3, 5, 6 and 9 (recorded complete on ATMA, Eilander and others); the Royall Consort in its earlier version for four viols and theorbo (Phantasm, Linn 2015), if the brief's version rule allows it beside the existing Royall Consort entries
- Byrd, William: Ground a 5 ("The Queen's Goodnight"), if it is a consort piece and not keyboard music
- Brewer, Thomas: Fantasias VdGS 1–3 (on the same Ricercar Consort album as the catalogued VdGS 4)
- Avitrano, Giuseppe Antonio: Op. 1 Nos. 7 (A major) and 9 (A minor) (Capriccio album)
- Naudot, Jacques-Christophe: Op. 17 Nos. 4 and 6 (recorded by Kossenko)
- Schein, Johann Hermann: Banchetto musicale suites 4, 5, 9, 11, 12 and 17
- Sammartini, Giuseppe: the 12 Sonatas for two flutes or violins (Walsh 1727), No. 6 in D minor (check how the other entries of the set are scored and match them)
- Peter, Johann Friedrich: String Quintets Nos. 2–5 (New World Records 80507-2, 1997, records all six)
- Titz, Anton Ferdinand: Op. 1 No. 1 in C major (Profil, Vol. 3)
- Fossa, François de: Op. 19 No. 3 in A major (Stradivarius)
- Kirnberger, Johann Philipp: Trio No. 4 in D minor (IMSLP "Trio Sonata in D minor"; NeoBarock CD)
- Eberl, Anton: Piano Quartets Op. 18 and Op. 25

## g02: later repertoire
- Gibbs, Cecil Armstrong: String Quartet in E minor (1958; Atchison, Convivium CR083)
- Nyman, Michael: String Quartet No. 5 (2011)
- Silvestrov, Valentin: String Quartet No. 3 (2011)
- Suk, Josef: Elegy Op. 23 in his own version for piano trio (widely recorded)
- Simpson, Robert: Trio for violin, cello and piano (1988–89)
- Saint-Saëns, Camille: Barcarolle Op. 108, the version recorded most often (entry 103325 has the harmonium scoring; a checker found only recordings of a piano-quartet version, said to date from 1909)
- Lavista, Mario: String Quartets Nos. 7 (2015) and 8 "Toque de silencio" (2017)
- Larcher, Thomas: String Quartet No. 4 "lucid dreams" (2015) and A Padmore Cycle (tenor and piano trio; in scope only if the brief's rule on voice with instruments allows it)
- Finnis, Michael: String Quartet No. 3 "Devotions" (Solem Quartet)
- Perger, Richard von: String Trio Op. 12 in D minor (it was entered under Zellner and rejected as Perger's work)
- Berio, Luciano: Upon Silence, the 1991 version for mezzo-soprano and seven strings (Faber; recorded on Nimbus), if the voice rule allows it
- Kagel, Mauricio: Piano Trio No. 3 (Trio Imàge)
- Rimsky-Korsakov, Nikolai: String Quartet in G major (1897)
- Fitzenhagen, Wilhelm: Concert-Walzer for four cellos, Op. 31 (Naxos 8.574301)

## Notes
- Give `level_guess`, `level_basis` and `hardest_part_guess` exactly as the brief asks; blind graders will grade the new works afterwards.
- Check your file with `npx tsx scripts/chamber/curation_check.ts <slice>` until it reports no errors.
