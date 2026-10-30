# Adding an instrument: playbook

How to build the next section of Arco Atlas (viola, cello, double bass, piano, flute, guitar … are "Coming soon" in
`components/InstrumentSwitcher.tsx`), distilled from how the violin catalogue (2026-10-09 to 13) and the chamber section
(2026-10-15 to 26) were built. This is the map; `docs/chamber-music-plan.md` is the worked example with every detail, and
the October 2026 write-ups (`docs/*-2026-10.md`) show each technique in use.

**How to use it.** When the owner asks for a new instrument, read this file and the chamber plan, then write
`docs/<instrument>-plan.md` in the chamber plan's shape: starting point, decisions, schema, phases (each with a dated
*Status* line as it finishes), cost and risks. Keep that file current: it is what a later session resumes from.

For the proposed expansion of the existing chamber section to same-instrument string ensembles (including
third-party arrangements), use [same-instrument-ensembles-plan.md](same-instrument-ensembles-plan.md) and the Sol briefs
in `data/chamber/same-instrument/`. That plan records the expanded scope and the minimal arranger-credit support
(including program copy). Publisher links and new ensemble filters are not part of that implementation; research/import
progress is tracked in the plan.

## What exists (October 2026)

| | Violin | Chamber music |
|---|---|---|
| Size | 4,883 works, 951 composers | 9,062 works (665 duos also in violin), 1,797 composers in all |
| Origin | the owner's Google Sheet (2,253 works), then four expansions: 52 composers, technical materials, modern and contemporary, IMSLP links | built from nothing: benchmarks, IMSLP census, curation, grading, verification |
| Data | `data/source/all-repertoire.json` + overrides → `data/build/catalogue.json` (`scripts/build-data.ts`) | `data/chamber/works.json` → `data/build/chamber.json` (`scripts/build-chamber.ts`) |
| Code | `lib/{types,vocab,search,filter,url-state}.ts`, `components/{Explorer,Finder,Row,PieceDetail}.tsx` | the same, parallel, in `lib/chamber/*` and `components/chamber/*` |
| Address | `/violin` (ids 1–99,999) | `/chamber` (chamber-only ids from 100,001); `/` redirects here (`app/page.tsx`) |
| Advisor | `lib/advisor/{prompt,tools,catalogue-text}.ts` | `lib/advisor/chamber-{prompt,tools,catalogue-text}.ts` |

Shared already: piece pages `/piece/[id]/[slug]`, composer pages (both sections), `/composers`, `/levels`, the 1–10 level
scale (`data/source/levels.json`, level 1 ≈ ABRSM 3–4), the mode, pace and character tags, the preview card
(`components/OgCard.tsx`, general on purpose), work details (`data/details/`, movements, years, dedications), recordings
(`data/recordings-judged.json`, `data/chamber/recordings-judged.json`), and `instruments` (the full scoring) on every work:
the start of one catalogue for all instruments. A work in two sections is **one entry with one id** (`sections`,
`partLevels`: the duos carry `{"violin": 7, "piano": 8}`).

## Phase 0: decisions to settle with the owner first

Write them into the plan before any research. Each one cost rework when it was settled late.

1. **Scope.** Which works belong: solo, with piano, with orchestra, duos, arrangements and transcriptions (viola, double
   bass and guitar lean on them heavily). Where the boundary with existing sections runs, and which works are cross-listed.
2. **The floor.** Violin and chamber list only repertoire that is performed or recorded, plus published technical
   material for violin (above beginner primers). Say what the new section's floor is, and that level 1 may be thin.
3. **What a level means.** The same 1–10 scale, read as the same exam grade on that instrument (check that ABRSM, RCM and
   the instrument's own syllabi line up; piano syllabi are much denser). For duos and accompanied works: whose part sets
   the level (`partLevels`, "for the violin part").
4. **Granularity.** One entry per work; sets grouped (`set`, `setKey`); separate rows for studies only in the standard
   étude sets.
5. **Addresses and ids.** `/<instrument>`, its own id range (the next free block, e.g. from 200,001), recorded in an
   id registry so ids never change. Whether `/` keeps redirecting to `/chamber` or becomes a landing page.
6. **Architecture (recommend, then confirm).** Chamber was built as a parallel copy (`lib/chamber/*`). A third copy would
   triple the code. For a solo instrument, generalize the violin section instead: one solo-section module configured per
   instrument (types, settings, finder sentence, intro line, search filler words), with `isChamberPath`-style routing
   turned into a lookup of section by path and id range. Do this refactor first, behind the violin pages, and prove the
   violin pages render unchanged before adding data.
7. **Working rules.** A local branch, mockups in `design/` for the owner to pick from, nothing on `main` or pushed until
   the owner calls it ready (`lib/<section>/launch.ts`-style switch keeps it hidden and noindexed until then).

## Phases

Each phase has a gate. Pilot first, then the full run, at every phase that uses agents.

1. **Schema, validator, benchmarks.** Types and vocabulary for the instrument; a checker in the shape of
   `scripts/chamber/check.ts` (scope, scoring, levels, cross-listed entries agreeing with their other section).
   About 130 benchmark works spread over eras, forms and levels, with a proposed level and a `basis`. Two blind graders
   (Opus and Sonnet) grade them again (`data/chamber/benchmarks/GRADER_BRIEF.md`); median of three where all are within
   one level; the owner picks the rest on a private review page (an Artifact). Three agents fact-check every benchmark
   (`data/chamber/benchmarks/VERIFY_BRIEF.md`). *Gate:* all benchmarks approved.
2. **Site scaffolding, hidden.** Mockups in `design/` (rows, finder sentence, filters, switcher); the owner picks. Then
   the section's page, finder, rows, search (`aka` and other titles weigh like titles), piece pages, switcher entry, a
   `public/data/<section>.json` of its own. *Gate:* the existing sections' prerendered pages are unchanged.
3. **Census and canon.** Harvest IMSLP by scoring category (`scripts/chamber/imslp_harvest.py`,
   `imslp_census.ts`, cache in `data/cache/`); estimate the real size from a sample checked against recording
   catalogues (chamber's guess was 4–5K, the census said ~9K). Curation by composer slices with a written brief
   (`data/chamber/curation/README.md`): drop arrangements, fragments, unpublished works; set titles in house style,
   nicknames, sets. Pilot three slices, fix the brief, run the rest, merge (`merge_curation.ts`), assign ids
   (`id-registry.json`), keep each work's evidence (`sources.json`). A completeness check against standard work lists for
   the core composers. *Gate:* `check.ts` passes; the owner has seen `CENSUS.md`.
4. **Modern and contemporary.** IMSLP barely covers composers who died after about 1971. Research slices against
   publisher catalogues, composer sites and library catalogues (`data/expansion/modern/AGENT_BRIEF.md`); each entry needs
   a source URL and a confidence. The slowest phase.
5. **Technical material** (if the scope includes it): études, scale systems, exercise books, researched by tradition and
   by technique topic (`docs/technical-materials-2026-10.md`).
6. **Grading and tags.** Researcher estimate plus two blind graders calibrated on the benchmarks, final level the
   median (`scripts/chamber/grading_prep.ts`, `grading_apply.ts`); grader B only where A and the researcher differ. The
   same graders give mode, pace and character. Popularity from the researchers' well-known flag and recording views.
   *Gate:* a ~200-work pilot whose spread is mostly 0–1 levels; if not, fix the benchmarks first.
7. **Verification.** Tiered (`scripts/chamber/verify_prep.ts`, `verify_apply.ts`, `data/chamber/verify/BRIEF.md`): every
   work whose IMSLP page disagrees with it (`imslp_crosscheck.ts`), every low- or medium-confidence or single-source
   entry, and a random sample of the rest. Duplicates merged; doubts listed for the owner, not guessed.
8. **Enrichment.**
   - Recordings: YouTube candidates (`scripts/chamber/collect_recordings.py`; queries need composer and catalogue
     number), Sonnet judges with a brief (`data/chamber/recordings/BRIEF.md`), oEmbed embed check, then a second pass
     for works without one (per set, reworded queries, `BRIEF2.md`). **Never** Ray Chen, Sarah Chang, Joshua Bell or
     Stefan Jackiw (`docs/recording-rules.md`, `scripts/recording-rules.ts`).
   - IMSLP links (`docs/imslp-links-2026-10.md`), work details (`scripts/fetch_imslp_details.py`,
     `parse_imslp_details.py`, then Haiku research chunks per `data/details/research/NOTES.md`), durations.
9. **Advisor.** Its own prompt, tools and cached catalogue text (best-known works under a character budget, kept under
   Haiku's 100K-token price step; `scripts/advisor-tokens.ts`). Open questions lead the dock text, filters second. Test
   with real questions against the API (a few cents; **say so before spending**), and check every id it links.
10. **Launch.** The switch on; sitemap, composer pages and `/composers` include the section; the switcher entry goes
    live; the Ledger line ("Arco Atlas is a free and open catalogue of … works"); Arco touchpoints worded for the
    instrument (`components/ArcoPeek.tsx` says "Teaching or learning violin?"); the preview card stays general; a
    write-up in `docs/`. Merge and push only when the owner says so.

## Things that name an instrument in the code

Search before launch (`grep -rni "violin\|chamber" app components lib`), and at least:
`lib/vocab.ts` (INTRO, settings, finder sentence), `lib/search.ts` (filler words), `lib/advisor/*` (prompts say
"violin works"), `components/Header.tsx` (list paths, Ask routing), `components/InstrumentSwitcher.tsx` (SOON list,
links), `lib/chamber/launch.ts` (`isChamberPath`, id ranges), `app/sitemap.ts`, `app/page.tsx` (root redirect),
`app/composer/[slug]/page.tsx` (counts per section), `app/piece/[id]/[slug]/page.tsx` (which detail view, back link),
`components/ArcoPeek.tsx` and `components/ArcoLine.tsx`, `app/layout.tsx` and the section page's metadata.

## How the work runs

- **Research, grading, judging and checking run on Claude Code subagents**, not the API key: Haiku for lookups with a
  tight brief (about 160–200K tokens and ~3% of a 5-hour window per 40-work chunk), Sonnet for judging and grading
  (heavier: four graders at once moved the 5-hour window about 20 points), Opus for the second-opinion grader and verification. At most three
  agents at a time; every brief asks for a source URL per answer, null when unsure, and saves as it goes.
- **Usage:** check `get_usage` between batches; pause new launches near 90% of the 5-hour window and about 88% of the
  weekly limit (98% when the owner asks to use it up), resume after the reset. Other sessions share the limits: agree a
  split with them.
- **Data is JSON in the repository.** No Google Sheet (it is obsolete). Every phase leaves a brief, its raw outputs and
  a merge script, so a run can be repeated.
- **Commits** stage only the session's own paths; another session may be working in the same checkout (coordinate on
  `data/build/*` and `public/data/*`, which any rebuild rewrites).
- **Scale and time.** Chamber took about ten days from plan to launch, ~9,000 works: benchmarks a day, census and
  curation three to four days, grading, verification and recordings a day or two each, advisor and launch a day.

## First thoughts per instrument (to confirm in each census)

- **Viola:** a small original repertoire and many transcriptions (Bach suites, violin and cello works): the scope
  decision on arrangements matters most. Shares much with violin and chamber (viola parts already graded in duos and
  quartets).
- **Cello:** close to violin in shape (suites, sonatas, concertos, showpieces, a large étude tradition); the violin
  pipeline fits almost unchanged.
- **Double bass:** small and largely 20th century, with many adaptations; expect heavy modern research and a thin IMSLP.
- **Piano:** an order of magnitude larger (Bach to Ligeti, many sets: preludes, études, mazurkas, sonatas by movement?),
  dense exam syllabi, and solo works dominate: granularity and the floor need the most thought, and the census will be
  big.
- **Flute:** baroque sonatas and concertos, French 19th–20th century, a large modern repertoire; IMSLP is good up to
  about 1920.
- **Guitar:** largely 20th century and later, many arrangements and transcriptions (lute, vihuela, Albéniz), publisher
  research over IMSLP.
