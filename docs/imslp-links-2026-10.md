# IMSLP links, October 2026

Every work that has a page on IMSLP now links to that page, and nothing links to an IMSLP search any more. **3,092 of 4,880 works (63%) link to their own IMSLP page**, up from 1,905 (39%). The other 1,788 get no IMSLP link: the old search fallback is gone from `components/pieces.tsx`, and `Piece.imslpPage` is the only field (`imslp: boolean` was dropped; the Sheet's "Score" column is no longer read by the build).

| | before | after |
|---|---|---|
| exact IMSLP page | 1,905 (1,837 shown + 68 hidden by a bug) | 3,092 |
| link was an IMSLP *search* | 978 | 0 |
| no IMSLP link | 1,997 | 1,788 |

By era, now: baroque 97%, classical 95%, early romantic 94%, late romantic 91%, 20th century 47%, contemporary 0.3% (`npx tsx scripts/check-imslp.ts`).

## Why the rest have none
- **1,391 works by 449 composers whose names IMSLP does not hold at all** (Britten, Barber, Berio, Boulez, Schnittke, Saariaho, Glass and so on). IMSLP is hosted in Canada and can only offer what is public domain there (in practice composers who died before 1972) or what the rights holder uploads, so recent and living composers are mostly absent, and some later composers have only a few pages. 982 of the unlinked works are contemporary, 619 are 20th century.
- **385 works by 153 composers IMSLP does cover but where the piece has no page**: mostly études and method books, 20th-century pieces, and a few earlier pieces that IMSLP does not list.
- **23 low-confidence guesses left out on purpose**, listed in `data/expansion/imslp/report.json` (`lowConfidenceList`; for example Alberti's Op. 2 "sonatas", which IMSLP files as sinfonie), and 3 pages that exist but hold no scans (Giazotto's Adagio, Finzi's Violin Concerto, a Shostakovich arrangement). They stay unlinked so "Score on IMSLP" is never a page without a score.
- 12 rows are syllabus lists (ABRSM, AMEB …), which have no composer.

## What a link means
- One IMSLP page covers every edition and arrangement of a work, so a numbered piece, a movement or a set member links to its set's page (the Paganini Caprices, Bunte Reihe Op. 30, Tartini's Op. 2 sonatas), and an arrangement ("arr. Heifetz") links to the original work's page, where IMSLP lists the violin arrangement. Where IMSLP only has a redirect, the link goes to the page it redirects to.
- Links are stored in `data/imslp-pages.json` (piece id → IMSLP page title) and rebuilt into `public/data/catalogue.json` by `scripts/build-data.ts`. The Sheet is not involved; its Score column still holds the old search hyperlinks and was left untouched.

## How it was done (`scripts/expand/imslp_*`)
1. `imslp_resolve.py`, `imslp_resolve2.py`: which IMSLP category belongs to each of the 841 composers with an unlinked work (exact name, then accent/variant/transliteration matching: Sergei/Sergey, Karl/Carl, Henryk/Henri; a few mismatches removed by hand). 383 resolved.
2. `imslp_harvest_all.py`: every work page of those composers with its work info (catalogue number, instrumentation), the violin arrangements it lists and its scan count. about 30,000 pages. (IMSLP pages long lists with the old `query-continue` format; an early version only handled `continue` and stopped at 500 members, which hid Haydn's concertos, Telemann's TWV 51:a1 and others until fixed.)
3. `imslp_match.ts` (Sonnet 5.5, per composer, in chunks): shortlist by catalogue numbers and title words, then the model chooses a candidate it was shown, or none, with a confidence and a reason.
4. `imslp_search.py`, `imslp_surname.py`: IMSLP's category lists turned out to be incomplete (pages under spelling variants such as "Hubay, Jenö" / "Jenő"), so every still-unlinked work was also searched by title and by composer surname, and re-matched. This found, for example, Vieuxtemps' six operatic duos, Wieniawski Op. 2 and Op. 8, Sarasate Op. 2, Bach BWV 1024.
5. `imslp_hydrate.py`, `imslp_redirects.py`: scan counts for pages found by search, redirects resolved to their real pages (Flight of the Bumblebee → the Tsar Saltan page).
6. `imslp_verify.ts` (Opus 5.5): a second opinion that sees only the catalogue entry and the chosen page's metadata, on every medium-confidence match plus a random sample of the high ones. It flagged 1 of 660 (Mondonville, retracted); it caught 40 of 40 deliberately wrong pairings in a calibration run. The last 23 matches (mostly redirect targets) were checked by hand against the target page's own arrangement list; one (Gershwin "Short Story") was rejected (`data/expansion/imslp/manual-rejected.json`).
7. `imslp_apply.ts --write` merges high/medium matches into `data/imslp-pages.json` (existing entries are never changed). 1,187 links were added; one old link was replaced by its redirect target.

Per-composer answers (`data/expansion/imslp/matches/`) keep the model's reason for each match; `report.json` lists what is still unlinked.

## Checks
`npx tsx scripts/check-imslp.ts --live` asks IMSLP whether every linked page exists (2,162 distinct titles: none missing) and fetches a sample of the final URLs, including titles with apostrophes and ampersands (61, all load). The existing 1,905 links were audited the same way before the pass; the low-overlap ones were all legitimate (set pages, translated titles, alternate catalogue numbers).

## Adding works later
After a catalogue expansion run `resolve` → `harvest_all` → `match` → `verify` → `apply --write` → `build-data` (the harvest is resumable; delete a composer's file in `data/cache/imslp-all/pages/` to refresh it) and finish with `check-imslp.ts --live`. API cost of this pass: about $6 (matching $5.40 with Sonnet, verification and calibration $0.62 with Opus).
