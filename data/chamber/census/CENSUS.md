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
| … outside the scope rules | 5,280 | – |
| … in scope (candidates) | 14,571 | 21,053 |
| … instrumental, viol consorts aside | 13,791 | 20,333 |
| … viol consorts | 588 | 529 |
| … chamber vocal works | 192 | 191 |
| … IMSLP links a commercial recording | 2,218 | 3,122 |

The 2,538 works for 3–9 players that the plan counted in the composer harvest grow to **21,053 in-scope works on 14,571 IMSLP pages** by 3,971 composers. Most will not pass the floor: a checked sample puts the instrumental works that do at about 7,600 (95% range 6,000–9,300), and the viol consorts and chamber vocal works add about 300 more (the sample's rates applied to them). The plan's guess of 4,000–5,000 works for the whole section is too low: with phase 3 adding perhaps 1,000–2,000 modern works (its plan has 287 composers, say four to seven works each), expect roughly 9,400, unless the floor is applied more strictly than "recorded".

## Outside the scope rules
5,280 pages have a string part in an original scoring but no scoring that the rules admit (`out-of-scope.jsonl`):

| reason | pages |
|---|---:|
| string orchestra | 1,991 |
| voice with continuo (cantata, sacred concerto): vocal repertoire | 1,214 |
| unspecified instruments | 550 |
| composer excluded (data/chamber/excluded-composers.json) | 543 |
| voice with fewer than three instruments (a song): vocal repertoire | 426 |
| orchestra | 139 |
| violins alone (violin section) | 115 |
| baryton (Haydn's baryton works are out, decision 3) | 111 |
| fewer than 3 players | 57 |
| no string part | 38 |
| more than 9 players | 20 |
| chorus | 19 |
| folk-song settings with voice: vocal repertoire | 14 |
| instrument not in the vocabulary (synthesizer 12, musette (bagpipe) 5, theremin 5, shakuhachi 3, ocarina 3, zither 3, hurdy-gurdy (French 'vielle') 2, erhu 2, sitar 2, tanpura 1, harmonichord 1, ondes Martenot 1, xiao 1, oud 1, shamisen 1) | 43 |

## By formation
| formation | works | of them with voice | recorded |
|---|---:|---:|---:|
| String trio | 1,643 | 0 | 102 |
| String quartet | 5,683 | 0 | 703 |
| String quintet | 871 | 0 | 160 |
| String sextet or larger | 189 | 0 | 34 |
| Viol consort | 529 | 0 | 82 |
| Piano trio | 1,925 | 0 | 286 |
| Piano quartet | 377 | 0 | 68 |
| Piano quintet | 428 | 0 | 69 |
| Piano & strings | 488 | 0 | 40 |
| Strings & winds | 3,590 | 3 | 398 |
| With continuo | 4,353 | 0 | 1,026 |
| Other ensemble | 977 | 188 | 154 |

Viol consorts (three or more viols, with or without organ or harpsichord) have their own formation; a viol with violins, or two viols with continuo, keeps the usual one. Works with voice are in only as chamber music (decisions below), mostly under "Other ensemble".

## By era
Era is the composer's era in the violin catalogue (or `data/chamber/composers.json`); for the others, IMSLP's piece style and the year.

| era | works | recorded |
|---|---:|---:|
| Before 1600 | 421 | 82 |
| Baroque | 4,043 | 1,053 |
| Classical | 7,506 | 1,007 |
| Early Romantic | 1,303 | 277 |
| Late Romantic | 3,287 | 437 |
| 20th century | 1,750 | 263 |
| Contemporary | 2,719 | 3 |
| Unknown | 24 | 0 |

Formation × era (works):

| formation | Before 1600 | Baroque | Classical | Early Romantic | Late Romantic | 20th century | Contemporary | Unknown |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| String trio | 1 | 81 | 1,076 | 65 | 137 | 103 | 178 | 2 |
| String quartet | 4 | 32 | 2,245 | 558 | 1,054 | 798 | 980 | 12 |
| String quintet | 0 | 17 | 382 | 143 | 175 | 40 | 107 | 7 |
| String sextet or larger | 0 | 2 | 16 | 22 | 65 | 26 | 58 | 0 |
| Viol consort | 353 | 125 | 0 | 0 | 0 | 3 | 48 | 0 |
| Piano trio | 0 | 1 | 627 | 195 | 743 | 198 | 161 | 0 |
| Piano quartet | 0 | 0 | 49 | 63 | 188 | 32 | 45 | 0 |
| Piano quintet | 0 | 0 | 27 | 40 | 208 | 84 | 69 | 0 |
| Piano & strings | 0 | 1 | 134 | 36 | 194 | 57 | 65 | 1 |
| Strings & winds | 9 | 117 | 1,848 | 145 | 388 | 299 | 784 | 0 |
| With continuo | 13 | 3,530 | 751 | 0 | 0 | 1 | 58 | 0 |
| Other ensemble | 41 | 137 | 351 | 36 | 135 | 109 | 166 | 2 |

By number of players (works): 3: 9,095 · 4: 8,589 · 5: 2,444 · 6: 527 · 7: 189 · 8: 134 · 9: 75.

## By composer
3,971 composers; 1,799 have a single work. The top 5 hold 5% of all works, the top 20 13%, the top 100 29%.

| composer | works | recorded | published | main formations |
|---|---:|---:|---:|---:|
| Boccherini, Luigi | 317 | 132 | 210 | string quintet 123, string quartet 85, string trio 54 |
| Haydn, Joseph | 257 | 148 | 215 | string quartet 87, strings & winds 60, piano trio 53 |
| Pleyel, Ignaz | 190 | 50 | 176 | string quartet 80, piano trio 37, string quintet 26 |
| Telemann, Georg Philipp | 187 | 124 | 64 | with continuo 178, strings & winds 9 |
| Hoffmeister, Franz Anton | 181 | 4 | 52 | strings & winds 119, string quartet 30, string trio 15 |
| Cambini, Giuseppe Maria | 167 | 18 | 105 | string quartet 88, string trio 39, strings & winds 37 |
| Mozart, Wolfgang Amadeus | 148 | 89 | 67 | string quartet 57, strings & winds 31, piano trio 16 |
| Anonymous | 137 | 1 | 15 | with continuo 113, viol consort 11, strings & winds 6 |
| Krommer, Franz | 123 | 3 | 81 | string quartet 67, string quintet 27, strings & winds 24 |
| Various | 122 | 26 | 26 | with continuo 83, string trio 22, strings & winds 7 |
| Vanhal, Johann Baptist | 113 | 14 | 55 | string trio 35, strings & winds 26, string quartet 22 |
| Gyrowetz, Adalbert | 113 | 1 | 90 | string quartet 46, strings & winds 43, piano trio 23 |
| Wranitzky, Paul | 95 | 6 | 48 | string quartet 51, string quintet 18, strings & winds 13 |
| Anzoletti, Marco | 92 | 0 | 0 | piano trio 37, string quartet 18, piano & strings 13 |
| Onslow, George | 86 | 25 | 72 | string quartet 36, string quintet 34, piano trio 10 |
| Coperario, John | 82 | 0 | 1 | viol consort 79, other ensemble 2, string trio 1 |
| Reicha, Anton | 81 | 19 | 35 | string quartet 49, strings & winds 16, piano trio 7 |
| Quentin I, Jean-Baptiste | 80 | 19 | 6 | with continuo 80 |
| Legrenzi, Giovanni | 70 | 61 | 54 | with continuo 70 |
| Sammartini, Giovanni Battista | 70 | 12 | 31 | with continuo 62, string trio 5, strings & winds 3 |
| Spohr, Louis | 67 | 52 | 60 | string quartet 41, string quintet 8, piano trio 6 |
| Campioni, Carlo Antonio | 65 | 0 | 14 | with continuo 50, string trio 14, string quartet 1 |
| Viotti, Giovanni Battista | 65 | 3 | 25 | string quartet 23, strings & winds 21, string trio 18 |
| Hänsel, Peter | 64 | 0 | 52 | string quartet 49, string trio 6, strings & winds 5 |
| Purcell, Henry | 63 | 52 | 57 | with continuo 47, viol consort 15, string quartet 1 |
| Abel, Carl Friedrich | 61 | 21 | 55 | strings & winds 25, string quartet 18, with continuo 6 |
| Kammel, Antonín | 60 | 0 | 16 | with continuo 29, string quartet 13, piano trio 6 |
| Sterkel, Johann Franz Xaver | 60 | 0 | 36 | piano trio 28, other ensemble 17, string trio 12 |
| Bruni, Antonio Bartolomeo | 60 | 0 | 24 | string trio 30, string quartet 30 |
| Schneider, Georg Abraham | 59 | 0 | 35 | strings & winds 44, string quartet 12, string quintet 3 |
| Harrington, Jeffrey Michael | 56 | 0 | 40 | strings & winds 28, string quartet 14, string trio 6 |
| Corelli, Arcangelo | 56 | 29 | 54 | with continuo 44, other ensemble 12 |
| Stamitz, Carl | 56 | 12 | 37 | strings & winds 24, string quartet 21, piano & strings 6 |
| Albrechtsberger, Johann Georg | 55 | 13 | 35 | string quartet 40, string trio 7, string sextet or larger 6 |
| Stamitz, Anton | 55 | 0 | 20 | string quartet 37, string trio 12, strings & winds 6 |
| Bach, Johann Christian | 54 | 13 | 44 | strings & winds 32, string trio 14, piano trio 4 |
| Vivaldi, Antonio | 53 | 36 | 18 | with continuo 51, strings & winds 2 |
| Bach, Carl Philipp Emanuel | 53 | 28 | 34 | piano trio 26, with continuo 24, strings & winds 3 |
| Beethoven, Ludwig van | 53 | 49 | 50 | string quartet 18, piano trio 13, string trio 8 |
| Küffner, Joseph | 53 | 0 | 18 | strings & winds 35, string quartet 10, other ensemble 7 |

**The swamping risk.** Composers with 80 or more instrumental works of which fewer than a fifth are recorded: Hoffmeister, Franz Anton (181, 4 recorded), Cambini, Giuseppe Maria (167, 18 recorded), Krommer, Franz (123, 3 recorded), Gyrowetz, Adalbert (113, 1 recorded), Vanhal, Johann Baptist (112, 14 recorded), Wranitzky, Paul (95, 6 recorded), Anzoletti, Marco (92, 0 recorded). Together they hold 883 instrumental works. Under the floor most of their works drop out; the ones that stay are `lesser-known` (decision 3), and the default sort must not list them by count. The big names are large too, but much of their output is recorded: Boccherini, Luigi (317, 42% recorded), Haydn, Joseph (256, 57% recorded), Pleyel, Ignaz (190, 26% recorded), Telemann, Georg Philipp (187, 66% recorded), Mozart, Wolfgang Amadeus (131, 65% recorded), Onslow, George (86, 29% recorded), Reicha, Anton (81, 23% recorded), Quentin I, Jean-Baptiste (80, 24% recorded). Even after the floor they will fill the first pages of an unsorted list of their formations.

## The floor: how many pass
The sampled pool is the 20,029 instrumental works other than viol consorts (pedagogical and fragment flags left out), in tiers by IMSLP's evidence:

| tier | works | sample pages | recorded | unsure | modern edition | pass rate (95%) | estimated pass (95%) |
|---|---:|---:|---:|---:|---:|---:|---:|
| A recorded | 3,001 | 40 | 38 | 0 | 35 | 93% (80–98%) | 2,798 (2,407–2,954) |
| B published, no recording found | 7,176 | 40 | 12 | 2 | 25 | 33% (20–48%) | 2,332 (1,441–3,451) |
| C not public domain (recent uploads), no recording found | 2,744 | 8 | 0 | 0 | 0 | 0% (0–38%) | 0 (0–1,036) |
| D manuscript only | 1,678 | 10 | 1 | 0 | 0 | 10% (0–43%) | 168 (0–720) |
| E no publication data | 5,430 | 20 | 9 | 0 | 9 | 43% (24–64%) | 2,308 (1,298–3,453) |

**Estimate: about 7,600 public-domain instrumental works pass the floor** (95% range 6,000–9,300), against the 3,001 that carry IMSLP's recording signal: the signal is precise but misses most recordings of lesser works, and many pages with no publication data on IMSLP are recorded (Boccherini's quartets among them). The 716 viol-consort and chamber vocal works were not sampled; at the same rates about 300 of them pass (98 carry the signal). 118 randomly drawn pages, stratified by tier, were checked for a commercial recording by three subagents (floor-sample/BRIEF.md). Each tier's pass rate (the mean share of a page's works that are recorded) times its works gives the estimate; the range is a 95% interval (Agresti–Coull per tier, variances added). A recorded work can still fail for other reasons (an arrangement, a fragment), and a performed but unrecorded work passes, so the two errors partly cancel.

Of the sampled works without the signal, 10 of 17 by composers with five or more recorded works on IMSLP, 4 of 12 by composers with one to four recorded works on IMSLP, 8 of 49 by composers with no recorded work on IMSLP turned out to be recorded. So a composer with no recorded work on IMSLP is not a composer with no recordings (Piano Quartet, Op.37 (Scharwenka); Pythagorische Schmids-Fuencklein (Mayr); String Quartet in A major (Maier); Guitar Quintet, Op.143 (Castelnuovo-Tedesco); Sonata for Violin, Cello and Piano, Op.20 (Sabaneyev)): the tail triage has to look each composer up.

The recording signal finds 107 of the 115 benchmarks that are IMSLP candidates (93%), but the benchmarks are standard works; for minor works it finds far fewer, which is what the sample measures.

Phase 3 adds the twentieth-century and living composers IMSLP lacks (`data/chamber/curation/groups-modern.json`), so the section's total is this estimate plus phase 3.

## Benchmarks
116 of the 135 benchmarks have an IMSLP page (through the fact-check's links, following redirects); 116 were harvested and 115 are candidates. The one harvested but not a candidate is Turina's *La oración del torero*, whose string-quartet version IMSLP files as an arrangement of the lute-quartet original: the composer's own versions listed as arrangements are a gap the census cannot see (the curators' gap check covers them for core composers). The other 19 are not on IMSLP, most of them under copyright (Barber, Britten, Glass, Pärt …): phase 3. Each benchmark's page is in `benchmark-matches.json`.

## Decisions (owner, 2026-10-16) and how the census applies them
1. **Vocal works: chamber music only.** A work with voice stays a candidate when its instruments form a chamber ensemble of three or more players with no continuo (Respighi's *Il tramonto*, Barber's *Dover Beach*, Vaughan Williams's *On Wenlock Edge*, Schoenberg's Op. 10): 191 works, 17 recorded. Left out as vocal repertoire: 1,214 pages with continuo (cantatas, sacred concertos), 426 songs with one or two instruments, and 14 folk-song collections with voice and piano trio (Beethoven's and George Thomson's; Haydn's are among the continuo pages). The curators still judge each kept work by whether it is programmed as chamber music.
2. **Viol consorts: in.** Three or more viols, alone or with a chamber organ or harpsichord, are a formation of their own, "Viol consort" (`viol-consort` in `lib/chamber/vocab.ts`): 529 works, 82 recorded (Jenkins, Lawes, Coprario, Byrd, Gibbons, Purcell's fantazias …). Works for violins with a bass viol, and sonatas for viols with continuo, keep their usual formation.
3. **Contemporary and living composers: in, when the composer has a track record** of works performed and taken seriously by professional musicians (professional performances, recordings on established labels, an established publisher, commissions). Self-published uploads are not a track record. Stephen W. Beatty is left out entirely (`data/chamber/excluded-composers.json`, 543 pages). The curators apply the same rule to the other recent uploads (2,744 works marked "Works not in public domain"; the largest: Harrington, Jeffrey Michael 46, Hovhannisyan, Gor 42, Gerber, Edward Enrico 37, Tavares, Luciano 37, Turchetto, Andrea 36, Fine, Elaine 34, Plante, Cyril 33, Gardner, Herbert Straus 32) and propose further exclusions.
4. **Glass harmonica: a note, not a new instrument.** IMSLP's "glass harmonica" maps to `celesta`, today's usual substitute, and the work's notes name the glass harmonica (Mozart's Adagio and Rondo, K. 617). The other instruments the vocabulary lacks stay out: synthesizer (12), musette (bagpipe) (5), theremin (5), shakuhachi (3), ocarina (3), zither (3), hurdy-gurdy (French 'vielle') (2), erhu (2), sitar (2), tanpura (1), harmonichord (1), ondes Martenot (1), xiao (1), oud (1), shamisen (1).
5. **Names written family name first** ("Tan Dun", "Chen Yi", as the violin catalogue writes them) are accepted by `scripts/chamber/check.ts`; every other name stays "Surname, Given names".

## Files
- `census.json`: every number above. `candidates.jsonl`: one line per in-scope page (instruments, formation, scoring, opus, key, year, first publication, minutes, works held, era, signals, flags, genre) for the curators. `out-of-scope.jsonl`: the pages the rules leave out, with the reason. `benchmark-matches.json`. `floor-sample/`: the 120-page sample, its brief and the checkers' results.
- Regenerate: `python3 scripts/chamber/imslp_harvest.py` (resumable; about 2,500 polite API calls, an hour, when the cache is empty) then `npx tsx scripts/chamber/imslp_census.ts`.

## Known limits
- IMSLP holds public-domain works: almost nothing by composers who died after about 1950–1970, so modern and contemporary works come from phase 3.
- The recording signal is IMSLP's own match to the Naxos Music Library, by title; it misses recordings on labels Naxos does not carry and sometimes matches another work of the same name (the sample measures both).
- "Works" is an estimate for collection pages; one-entry sets of short pieces ("5 Novelettes") count once, and an opus page with no single-work pages counts the number in its title.
- Pedagogical and fragment flags come from title words and IMSLP categories, and are hints for the curators, not decisions.
