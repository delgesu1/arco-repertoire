# Chamber music census (IMSLP)

Generated 2026-10-16 by `npx tsx scripts/chamber/imslp_census.ts` from the harvest of `python3 scripts/chamber/imslp_harvest.py` (cache in `data/cache/imslp-chamber/`, not in git). Phase 2 of `docs/chamber-music-plan.md`.

## Method
- **Harvest by scoring category.** Every page in IMSLP's "For 3 players" … "For 9 players" and "For 2 players with continuo" … "For 8 players with continuo" (continuo counts as one player), 21,196 pages; then a sweep of the scoring categories those pages use ("For 2 violins, viola, cello" …) added 3,995 pages that IMSLP files under a scoring but not under a player count (mostly works with voice, which IMSLP does not count as a player). 19,883 pages with a string part were read in full (title, work info, categories); 3,558 of them came from the earlier composer harvest.
- **Originals only.** Only scoring categories without "(arr)" count. A page's scorings are parsed through `data/chamber/imslp-instruments.json` (IMSLP name → `InstrumentKey`; the census stops on a name it does not know), the formation is `formationFor()` of `lib/chamber/vocab.ts`, and the smallest in-scope scoring is the work's (others are kept as `alsoScored`, often published alternatives). A violone beside a continuo in trio texture is counted as part of the continuo.
- **Works, not pages.** A page for a whole opus ("6 String Quartets, Op.18") counts as the works it holds; a page for an opus or a complete edition whose works also have pages of their own adds nothing.
- **Floor evidence** comes from IMSLP's own categories: "Pages with commercial recordings" (mostly Naxos Music Library matches), "Pages with First Editions", Hofmeister's Monatsbericht, audio on the page, and "Works not in public domain" (recent uploads, mostly by living composers).

## Headline
|  | pages | works |
|---|---:|---:|
| Pages found | 25,191 | – |
| … with an original string scoring | 19,851 | – |
| … outside the scope rules | 3,061 | – |
| … in scope (candidates) | 16,790 | 23,230 |
| Candidates without voice or viol consort | 14,314 | 20,853 |
| … IMSLP links a commercial recording | 2,093 | 3,016 |

The guess in the plan (2,538 works for 3–9 players from the composer harvest) is replaced by **23,230 in-scope works on 16,790 IMSLP pages** by 4,397 composers. Most will not pass the floor: see the estimate below.

## Outside the scope rules
3,061 pages have a string part in an original scoring but no scoring that the rules admit (`out-of-scope.jsonl`):

| reason | pages |
|---|---:|
| string orchestra | 2,001 |
| unspecified instruments | 550 |
| orchestra | 140 |
| violins alone (violin section) | 121 |
| baryton (Haydn's baryton works are out, decision 3) | 113 |
| no string part | 40 |
| fewer than 3 players | 29 |
| chorus | 19 |
| more than 9 players | 3 |
| instrument not in the vocabulary (synthesizer 12, musette (bagpipe) 5, theremin 5, shakuhachi 3, ocarina 3, zither 3, hurdy-gurdy (French 'vielle') 2, erhu 2, glass harmonica 2, sitar 2, tanpura 1, harmonichord 1, ondes Martenot 1, xiao 1, oud 1, shamisen 1) | 45 |

## By formation
| formation | works | with voice | viol consort | recorded (instrumental) |
|---|---:|---:|---:|---:|
| String trio | 1,857 | 0 | 177 | 102 |
| String quartet | 5,863 | 0 | 121 | 703 |
| String quintet | 1,084 | 0 | 211 | 160 |
| String sextet or larger | 237 | 0 | 48 | 34 |
| Piano trio | 1,941 | 0 | 0 | 286 |
| Piano quartet | 377 | 0 | 0 | 68 |
| Piano quintet | 429 | 0 | 0 | 69 |
| Piano & strings | 491 | 0 | 0 | 40 |
| Strings & winds | 3,962 | 3 | 0 | 396 |
| With continuo | 5,529 | 1,186 | 0 | 1,021 |
| Other ensemble | 1,460 | 631 | 0 | 137 |

Viol consorts count as string ensembles by `formationFor()` (four viols are a "string quartet"); vocal works with continuo count as "with continuo". Both wait for a decision (below).

## By era
Era is the composer's era in the violin catalogue (or `data/chamber/composers.json`); for the others, IMSLP's piece style and the year.

| era | works | recorded |
|---|---:|---:|
| Before 1600 | 523 | 105 |
| Baroque | 5,133 | 1,208 |
| Classical | 7,991 | 1,105 |
| Early Romantic | 1,360 | 288 |
| Late Romantic | 3,686 | 458 |
| 20th century | 4,005 | 269 |
| Contemporary | 462 | 3 |
| Unknown | 70 | 0 |

Formation × era (works):

| formation | Before 1600 | Baroque | Classical | Early Romantic | Late Romantic | 20th century | Contemporary | Unknown |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| String trio | 114 | 153 | 1,099 | 65 | 146 | 242 | 35 | 3 |
| String quartet | 96 | 77 | 2,358 | 558 | 1,127 | 1,490 | 141 | 16 |
| String quintet | 170 | 64 | 389 | 143 | 190 | 103 | 16 | 9 |
| String sextet or larger | 35 | 14 | 21 | 22 | 70 | 64 | 11 | 0 |
| Piano trio | 0 | 1 | 641 | 195 | 763 | 313 | 25 | 3 |
| Piano quartet | 0 | 0 | 52 | 63 | 193 | 64 | 5 | 0 |
| Piano quintet | 0 | 0 | 30 | 40 | 216 | 135 | 7 | 1 |
| Piano & strings | 0 | 3 | 145 | 36 | 203 | 89 | 9 | 6 |
| Strings & winds | 10 | 128 | 1,895 | 146 | 422 | 1,170 | 172 | 19 |
| With continuo | 18 | 4,539 | 966 | 0 | 0 | 6 | 0 | 0 |
| Other ensemble | 80 | 154 | 395 | 92 | 356 | 329 | 41 | 13 |

By number of players (works): 3: 10,168 · 4: 9,141 · 5: 2,657 · 6: 719 · 7: 268 · 8: 195 · 9: 82.

## By composer
4,397 composers; 2,069 have a single work. The top 5 hold 7% of all works, the top 20 15%, the top 100 30%.

| composer | works | recorded | published | main formations |
|---|---:|---:|---:|---:|
| Beatty, Stephen W. | 506 | 0 | 504 | strings & winds 370, string quartet 47, string trio 35 |
| Haydn, Joseph | 408 | 241 | 366 | with continuo 156, string quartet 87, strings & winds 60 |
| Boccherini, Luigi | 317 | 132 | 210 | string quintet 123, string quartet 85, string trio 54 |
| Telemann, Georg Philipp | 262 | 146 | 129 | with continuo 253, strings & winds 9 |
| Pleyel, Ignaz | 191 | 50 | 177 | string quartet 80, piano trio 37, string quintet 26 |
| Hoffmeister, Franz Anton | 181 | 4 | 52 | strings & winds 119, string quartet 30, string trio 15 |
| Cambini, Giuseppe Maria | 167 | 18 | 105 | string quartet 88, string trio 39, strings & winds 37 |
| Anonymous | 159 | 1 | 16 | with continuo 136, string trio 8, strings & winds 6 |
| Mozart, Wolfgang Amadeus | 147 | 88 | 66 | string quartet 57, strings & winds 30, piano trio 16 |
| Various | 141 | 26 | 34 | with continuo 100, string trio 22, other ensemble 8 |
| Krommer, Franz | 123 | 3 | 81 | string quartet 67, string quintet 27, strings & winds 24 |
| Vanhal, Johann Baptist | 114 | 14 | 55 | string trio 35, strings & winds 26, string quartet 22 |
| Gyrowetz, Adalbert | 113 | 1 | 90 | string quartet 46, strings & winds 43, piano trio 23 |
| Charpentier, Marc-Antoine | 97 | 12 | 2 | with continuo 95, string quartet 1, strings & winds 1 |
| Wranitzky, Paul | 95 | 6 | 48 | string quartet 51, string quintet 18, strings & winds 13 |
| Anzoletti, Marco | 92 | 0 | 0 | piano trio 37, string quartet 18, piano & strings 13 |
| Onslow, George | 86 | 25 | 72 | string quartet 36, string quintet 34, piano trio 10 |
| Coperario, John | 82 | 0 | 1 | string quintet 48, string trio 19, string quartet 9 |
| Reicha, Anton | 81 | 19 | 35 | string quartet 49, strings & winds 16, piano trio 7 |
| Quentin I, Jean-Baptiste | 80 | 19 | 6 | with continuo 80 |
| Legrenzi, Giovanni | 71 | 61 | 55 | with continuo 71 |
| Sammartini, Giovanni Battista | 70 | 12 | 31 | with continuo 62, string trio 5, strings & winds 3 |
| Spohr, Louis | 69 | 54 | 61 | string quartet 41, string quintet 8, piano trio 6 |
| Purcell, Henry | 68 | 52 | 57 | with continuo 52, string quartet 10, string trio 3 |
| Campioni, Carlo Antonio | 65 | 0 | 14 | with continuo 50, string trio 14, string quartet 1 |
| Viotti, Giovanni Battista | 65 | 3 | 25 | string quartet 23, strings & winds 21, string trio 18 |
| Hänsel, Peter | 64 | 0 | 52 | string quartet 49, string trio 6, strings & winds 5 |
| Abel, Carl Friedrich | 61 | 21 | 55 | strings & winds 25, string quartet 18, with continuo 6 |
| Kammel, Antonín | 60 | 0 | 16 | with continuo 29, string quartet 13, piano trio 6 |
| Sterkel, Johann Franz Xaver | 60 | 0 | 36 | piano trio 28, other ensemble 17, string trio 12 |
| Bruni, Antonio Bartolomeo | 60 | 0 | 24 | string trio 30, string quartet 30 |
| Schneider, Georg Abraham | 59 | 0 | 35 | strings & winds 44, string quartet 12, string quintet 3 |
| Beethoven, Ludwig van | 57 | 53 | 53 | string quartet 18, piano trio 13, string trio 8 |
| Harrington, Jeffrey Michael | 56 | 0 | 40 | strings & winds 28, string quartet 14, string trio 6 |
| Corelli, Arcangelo | 56 | 29 | 54 | with continuo 44, other ensemble 12 |
| Stamitz, Carl | 56 | 12 | 37 | strings & winds 24, string quartet 21, piano & strings 6 |
| Vivaldi, Antonio | 55 | 37 | 18 | with continuo 53, strings & winds 2 |
| Albrechtsberger, Johann Georg | 55 | 13 | 35 | string quartet 40, string trio 7, string sextet or larger 6 |
| Stamitz, Anton | 55 | 0 | 20 | string quartet 37, string trio 12, strings & winds 6 |
| Bach, Johann Christian | 54 | 13 | 44 | strings & winds 32, string trio 14, piano trio 4 |

**The swamping risk.** Composers with 80 or more instrumental works of which fewer than a fifth are recorded: Beatty, Stephen W. (500, 0 recorded), Hoffmeister, Franz Anton (181, 4 recorded), Cambini, Giuseppe Maria (167, 18 recorded), Krommer, Franz (123, 3 recorded), Gyrowetz, Adalbert (113, 1 recorded), Vanhal, Johann Baptist (112, 14 recorded), Wranitzky, Paul (95, 6 recorded), Anzoletti, Marco (92, 0 recorded). Together they hold 1,383 instrumental works. Under the floor most of their works drop out; the ones that stay are `lesser-known` (decision 3), and the default sort must not list them by count. The big names are large too, but much of their output is recorded: Boccherini, Luigi (317, 42% recorded), Haydn, Joseph (256, 57% recorded), Pleyel, Ignaz (190, 26% recorded), Telemann, Georg Philipp (187, 66% recorded), Mozart, Wolfgang Amadeus (130, 65% recorded), Onslow, George (86, 29% recorded), Reicha, Anton (81, 23% recorded), Quentin I, Jean-Baptiste (80, 24% recorded). Even after the floor they will fill the first pages of an unsorted list of their formations.

## The floor: how many pass
The pool is the 20,548 instrumental works (vocal and viol-consort works, pedagogical and fragment flags left out), in tiers by IMSLP's evidence:

| tier | works |
|---|---:|
| A recorded | 2,994 |
| B published, no recording found | 7,172 |
| C not public domain (recent uploads), no recording found | 3,263 |
| D manuscript only | 1,676 |
| E no publication data | 5,443 |

Recall-based estimate (no sample yet): about 3,218; upper bound 10,166. Recall-based: recorded tier plus recorded × (1/recall − 1) from the benchmarks; upperBound = recorded + published.

The recording signal finds 107 of the 115 benchmarks that are IMSLP candidates (93%), but the benchmarks are standard works; for minor works it finds far fewer, which is what the sample measures.

Phase 3 adds the twentieth-century and living composers IMSLP lacks (`data/chamber/curation/groups-modern.json`), so the section's total is this estimate plus phase 3.

## Benchmarks
116 of the 135 benchmarks have an IMSLP page (through the fact-check's links, following redirects); 116 were harvested and 115 are candidates. The one harvested but not a candidate is Turina's *La oración del torero*, whose string-quartet version IMSLP files as an arrangement of the lute-quartet original: the composer's own versions listed as arrangements are a gap the census cannot see (the curators' gap check covers them for core composers). The other 19 are not on IMSLP, most of them under copyright (Barber, Britten, Glass, Pärt …): phase 3. Each benchmark's page is in `benchmark-matches.json`.

## Open questions for the owner
1. **Vocal works with strings** (1,820 works, 324 recorded): songs with one obbligato instrument (voice, violin, piano), baroque solo and ensemble cantatas with two violins and continuo, Haydn's 151 Scottish song settings. The scope admits "strings with voice" and the benchmarks hold *Il tramonto*, *Dover Beach* and Schoenberg's Op. 10. Proposal: keep vocal works only with a string quartet or larger ensemble that are programmed as chamber music; leave songs with obbligato and cantatas to a future vocal section.
2. **Viol consort music** (557 works for 3–6 viols, 96 recorded: Jenkins, Lawes, Coprario, Purcell's fantazias …). Viols are string instruments, so the rules admit them, but `formationFor()` calls four viols a string quartet. Proposal: in, with a `formationNote` (or a new formation "Viol consort"), only when recorded.
3. **Recent uploads** (3,263 works marked "Works not in public domain", led by Stephen W. Beatty's 506): living composers' own uploads, almost never recorded. Proposal: the tail triage drops them unless a recording or a performance by a professional ensemble turns up.
4. **Instruments the vocabulary lacks**: synthesizer (12), musette (bagpipe) (5), theremin (5), shakuhachi (3), ocarina (3), zither (3), hurdy-gurdy (French 'vielle') (2), erhu (2), glass harmonica (2), sitar (2), tanpura (1), harmonichord (1), ondes Martenot (1), xiao (1), oud (1), shamisen (1). Only the glass harmonica matters (Mozart's Adagio and Rondo, K. 617); add `glass-harmonica` to `lib/chamber/vocab.ts`, or list K. 617 with celesta as a published alternative.
5. **Composer names without a comma.** The violin catalogue spells some names without one ("Tan Dun", "Chen Yi"); `scripts/chamber/check.ts` requires "Surname, Given names" and would reject them. Relax the check for those names, or respell them in both sections.

## Files
- `census.json`: every number above. `candidates.jsonl`: one line per in-scope page (instruments, formation, scoring, opus, key, year, first publication, minutes, works held, era, signals, flags, genre) for the curators. `out-of-scope.jsonl`: the pages the rules leave out, with the reason. `benchmark-matches.json`. `floor-sample/`: the 120-page sample, its brief and the checkers' results.
- Regenerate: `python3 scripts/chamber/imslp_harvest.py` (resumable; about 2,500 polite API calls, an hour, when the cache is empty) then `npx tsx scripts/chamber/imslp_census.ts`.

## Known limits
- IMSLP holds public-domain works: almost nothing by composers who died after about 1950–1970, so modern and contemporary works come from phase 3.
- The recording signal is IMSLP's own match to the Naxos Music Library, by title; it misses recordings on labels Naxos does not carry and sometimes matches another work of the same name (the sample measures both).
- "Works" is an estimate for collection pages; one-entry sets of short pieces ("5 Novelettes") count once, and an opus page with no single-work pages counts the number in its title.
- Pedagogical and fragment flags come from title words and IMSLP categories, and are hints for the curators, not decisions.
