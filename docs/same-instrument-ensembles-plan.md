# Same-instrument string ensembles: expansion plan

Written 2026-10-27. Research setup for the owner's request for three, four, eight and other numbers of violins, violas, cellos and basses, including transcriptions. Follows `new-instrument-playbook.md`, with Sol agents replacing the historical Claude research/grading roles. This expands `/chamber`; it does not need another instrument section.

**Status:** finished and published, 30 October 2026: 129 same-instrument ensembles of 3–12 parts (66 cello, 34 violin, 16 double bass, 13 viola), 96 new works and one cross-listing. Not exhaustive: the search deliberately stopped short of endless expansion, and known gaps remain (Françaix *Aubade*, Gubaidulina *Mirage*, Reich *Violin Phase*, Piazzolla and Casals arrangements). Totals and holds are in `data/chamber/same-instrument/progress.json` and `RESUME.md`.

## Starting point before the implementation

The original rules systematically hid this repertoire:

- `scripts/chamber/check.ts` excludes three or more violins alone, limits every ensemble to nine parts and admits duos only if cross-listed in violin. The historical chamber plan explicitly keeps violin-only ensembles in violin.
- `scripts/chamber/imslp_harvest.py` and `imslp_census.ts` discard scoring categories ending in `(arr)`. The old curation brief also rejects third-party arrangements. The current request authorizes researching those arrangements for this expansion.
- `formationFor()` called four cellos or four violas a `string-quartet`. Instrument counts were already stored correctly and `fitGroup()` could match them, but the formation menu and labels did not make them easy to find. Fixed 2026-10-31: they have their own formation, `same-instrument` ("Same instrument" in the ensemble menu), and are labelled "Cello quartet", "Violin trio" and so on. Choosing it shows the four instruments and the sizes that exist as chips (`?ens=same-instrument&with=cello&parts=4`), and a search for "4 cellos" or "cello quartet" means that scoring (`parseScoring` in `lib/chamber/search.ts`).
- `ChamberWork` previously had no structured arranger field. `imslpPage` links to a shared work page, so the researcher still needs to verify the exact arrangement there; keep that evidence in the research output.
- `merge_curation.ts` rebuilds from benchmarks and the old slice outputs. **Do not rerun it to append this expansion:** it is not an incremental importer and could discard later curation.

Local JSON audit, 2026-10-27 (counts describe stored entries, not independently reverified scoring):

| Instrument | Three parts | Four parts | Seven parts | Eight parts | Total, 3+ |
|---|---:|---:|---:|---:|---:|
| Violin, chamber | 0 | 0 | 0 | 0 | 0 |
| Viola, chamber | 0 | 2 | 0 | 0 | 2 |
| Cello, chamber | 10 | 7 | 1 | 12 | 30 |
| Double bass, chamber | 0 | 0 | 0 | 0 | 0 |

Violin also has Telemann's TWV 40:201, public id **568**, for four unaccompanied violins. Cross-list it with its existing public id rather than adding a duplicate. The 129 two-violin entries already in chamber are outside the principal expansion; preserve them.

Live IMSLP `categoryinfo` API census of **3–12 parts**, originals and arrangements separately:

| Instrument | Original category memberships | Arrangement category memberships |
|---|---:|---:|
| Violins | 134 | 42 |
| Violas | 41 | 88 |
| Cellos | 117 | 227 |
| Double basses | 12 | 24 |
| **Total** | **304** | **381** |

These are **685 page/category memberships**, not 685 unique works or playable versions. A collection can hold several works, a work can occur in several categories, and an arrangement category can hold multiple arrangers or only an excerpt. Category counts do not prove the repertoire floor. Snapshot and query provenance: `data/chamber/same-instrument/category-snapshot.json`. API help: [categorymembers](https://imslp.org/api.php?action=help&querymodules=categorymembers). Web search indexes can show older counts; the saved API response is the dated baseline.

## Scope and recommendations

1. **First expansion: violin, viola, cello and double bass, initially 3–12 independent parts.** Harvest other explicit counts too and retain them as leads; decide larger groups from the census. Twelve is an initial delivery bound, not a claim that larger ensembles are not chamber music. Changing the old nine-part rule should initially apply only to these same-instrument ensembles. Other instrument families can use this workflow later without widening the current string-based catalogue.
2. **Include originals, composer-authorized versions, and identifiable published/performed arrangements and transcriptions.** A composer remains the composer; credit the arranger separately. A new engraving or editor is not a new arrangement. Preserve withdrawn-work, doubtful-attribution and excluded-composer decisions unless new evidence resolves their actual reason. A rejection based solely on the old violin-only scope can be reopened.
3. **Keep the repertoire floor.** A real performance or released recording of the exact version, plus an obtainable published score/parts source. A professional concert programme can establish the floor when there is no YouTube recording. A score upload, MIDI rendering or search-result snippet alone cannot. Easy concert repertoire qualifies; method-book ensemble exercises do not. If the owner later wants teaching ensemble material, make that a separate expansion with an explicit floor.
4. **Count independent parts, not people on stage.** Eight cellists doubling four parts is a four-part version with optional doubling. A group called The 12 Cellists is not evidence of twelve independent parts. A title saying “four violins” may still require orchestra or continuo. Store solo-plus-ensemble roles in notes when all the instruments are the same, e.g. solo cello plus six cellos.
5. **Only the stated ensemble.** Required piano, continuo, percussion, voice or electronics is not an unaccompanied same-instrument version. Flexible instrumentation, optional backing, unison massed groups and multitracked solo performances are logged for separate decisions; do not encode them as exact fixed scorings. A documented arrangement of one movement is eligible as a named excerpt; do not label it the complete parent work.
6. **Use `/chamber` as the canonical ensemble home.** Keep existing violin entries and public ids; cross-list the identical violin-only version when appropriate. New violin ensemble discoveries can enter chamber first. Adding them to violin later must reuse their identity, not create another edition of the same record.

The ensemble size, floor and initial instrument list are recommendations to record before the main run; the user's request already settles inclusion of same-instrument ensembles and research into transcriptions. No new branch: follow the owner's current instructions over the historical branch instructions in the old playbooks.

## Reuse the existing entry structure

One ordinary catalogue entry represents one playable version, using the existing ids, title, instrumentation, levels, recording, `imslpPage` and provenance. Add only **`arranger?: string`**, as a display name such as `Klaus Trumpf`, to the chamber source and shared public piece type. An editor is not an arranger. Composer-authorized versions need an arranger credit only when the sources actually credit one.

The field appears as “Arranged by” in the existing About section and as `arr. Klaus Trumpf` after the title in **Copy for program**. It survives both catalogue builds and cross-listing, is searchable, and is returned by advisor tools. Violin-only source JSON can supply an optional `Arranger` column; a cross-listed chamber entry's credit takes precedence. Do not infer credits by parsing old titles or notes.

Keep source composition, version, extent, arranger, edition and scoring evidence in the research/provenance sidecars for deduplication. A temporary research `versionKey` is not a new public schema or registry requirement. Existing public ids and historical registry keys stay stable. Use distinct descriptive titles for musically different versions, consistent with the existing unique-title check, and avoid embedding a duplicate arranger credit in a new title when the separate field already provides it.

No new section, formation enum, instrument-count filter, publisher button, `scoreLinks` array or version browser is required. Existing formation labels remain; four cellos still uses `string-quartet`, with its exact scoring shown below the title. IMSLP remains the score-link mechanism. Publisher/composer pages are useful **research evidence**, even though their purchase links are not added to the UI.

## Discovery: category first, then the missing modern repertoire

### IMSLP

Use the MediaWiki API through `scripts/chamber/fetch_throttled.py` so every agent shares the host clock and cache. Avoid the older harvest's private `call()` loop for concurrent agents, because it does not share that clock.

1. Enumerate exact scoring categories, including both `For 4 cellos` **and** `For 4 cellos (arr)`. The manifest contains every category for 3–12 parts of the four instruments, including empty ones. Look at the [instrumentation index](https://imslp.org/wiki/MediaWiki:Genres/Instrumentation_-_Chamber-Instrumental) and category search for counts/aliases the fixed range misses. Do not rely only on `For N players` or composer lists.
2. Query `action=query&list=categorymembers&cmtitle=Category:For 4 cellos (arr)&cmnamespace=0&cmlimit=500&format=json`; follow **both** modern `continue` and IMSLP's older `query-continue` format to completion. Namespace-zero results avoid category/file rows. A missing category description page does not necessarily mean it has no members.
3. Cache the deduplicated page ids/titles, categories, revisions/wikitext, revision id/timestamp and fetched date. Resolve title normalization and redirects. Retain the original discovery category and retrieval errors.
4. On arrangement pages, find the **specific heading, arranger, movement scope and file group**. The page-wide Instrumentation field describes the original work and cannot establish the arrangement's scoring. Inspect score/part labels or a reliable exact-edition catalogue record.
5. Retain section anchors or file-permalinks only after verifying them; do not manufacture anchors from a heading. A category is a discovery link, never a sheet-music link. Store publication/license statements as evidence; do not infer worldwide download rights.
6. HTTP 403/429/5xx, API `error`, incomplete continuation or a blocked publisher means `blocked`/`partial`, never “none found”. Save progress before stopping. Use another legitimate source when possible and leave unresolved fields null.

The existing caches (`data/cache/imslp-all/`, `imslp-chamber/`) provide useful leads, but they omitted arrangement data and have no freshness guarantee for this run. Refresh the relevant page revisions rather than treating the old catalogue as proof.

### Publisher, composer and ensemble gap checks

Each instrumentation bucket owns **both** its IMSLP candidates and its web gap check. Search exact count/instrument names in English, German, French and Italian, alongside “arranged”, “transcription”, “quartet”, “octet”, “score and parts” and “rental”. Check composer work lists, exact publisher editions, library records, professional concert programmes, specialist ensemble repertoire lists and recording booklets. Ensemble names generate leads, not automatic scoring claims.

Useful proven routes from the pilots: Schott/EAM for Andrew Norman's eight-violin *Gran Turismo*; Edition Offenburg/Walhall for Kimura's four-violin Bach; Hofmeister for Klaus Trumpf's four-bass Bottesini; Concertgebouw programmes/videos for Gordon Jacob's eight-viola suite. Include contemporary originals and arrangements that IMSLP cannot supply. Record every source section/query checked and remaining gaps; do not promise completeness because a search returned no results.

## Agent workflow

Use Sol for research, independent verification, recording judging and grading. Independent runs must have separate inputs; model agreement is not evidence. Use the user's available execution/account route, with no paid model APIs launched as a side effect of these scripts. At most **three workers concurrently**, one coordinator as sole writer of canonical JSON.

The dispatch manifest is `data/chamber/same-instrument/jobs.json`; every job is still `pending`. It specifies instrument/count ownership, exact categories, existing records, source/output paths and the common brief. The manifest is an execution handoff, not an automatic launcher.

| Stage | Input/output and ownership | Gate |
|---|---|---|
| 0. Minimal product support | Scope checks accept 3–12 parts of one violin-family instrument; optional arranger credit survives builds, detail display, program copy, search and advisor tools. | Verify with normal tests and an isolated build fixture, including an existing cross-listed id. |
| 1. Discovery | 16 instrument/count jobs (3, 4, 5–9, 10–12), originals + arrangements together. Each saves `discovery/<job>.json`, including skipped/held/blocked leads and an exhaustive category cursor log. | Membership pagination complete; page/work/version identity resolved sufficiently to deduplicate. |
| 2. Pilot enrichment | Coordinator chooses 18–24 distinct versions, including originals, arrangements, an excerpt, a missing YouTube, a ten/twelve-part lead, and 5–6 existing records. Sol researchers write only assigned `research/<chunk>.json`, at most 25 versions per chunk. | Validate the proposed ordinary catalogue entries and their evidence before scaling. |
| 3. Full enrichment | Coordinator deduplicates discovery output, assigns stable temporary version keys, then makes 25-version chunks. Each researcher gathers the complete record in the common brief. | Every kept item has exact scoring, real version-specific floor evidence and an obtainable score source; missing optional facts are explicit. |
| 4. Independent verification | Another Sol run receives facts and evidence, with researcher guesses/decisions hidden. Verify **every arrangement**, every scoring, new attribution and existing entry proposed for correction. | Conflicts go to `held`; no unverified bulk import. |
| 5. Grade and tag | Reuse the 10-level scale and approved chamber anchors; add about 12–16 score-backed same-instrument pilot anchors. Researcher estimate + blind Sol grade; a third blind grade only for disagreement/low confidence. Grade the arrangement itself. | Median only when confidence and spread are acceptable; unresolved scores remain held. Keep rating bases out of blind inputs. |
| 6. Recordings | Search composer + catalogue/title + exact scoring + arranger/version. Another run judges candidates; verify selected video's metadata, description, credits, duration and embed availability. | Every primary/alternate is for this version; missing is allowed after documented searches. |
| 7. Import proposal | Coordinator alone creates complete `.next.json` proposals, additions/updates/dedupe/held report and rollback snapshot. | Validate against the **current** catalogue, preserve unrelated work and public ids; a second dry run is a no-op. |
| 8. Build and review | Apply locally, build both catalogues/details, run appropriate checks and inspect pilot pages/search/advisor. | Score links, arranger credits, exact group matching and part counts survive through public JSON and pages. Commit/push only when requested. |

The pilots in `pilot.md` exercise source discovery only; they have not passed stages 2–8. First instrument jobs should include violin/3, cello/4 and viola/5–9 to stress three different source patterns. Large/sparse buckets can finish quickly; do not invent minimum entry quotas.

### What “fully ingested” means

Every approved version has composer metadata, house title and aliases, exact scoring and roles, extent and arranger credit, source-work identity in the provenance, year when known, duration when known, movements when established, notes, set membership, level and basis, hardest part, mode/pace/character where knowable, popularity evidence, a verified IMSLP work page when available, and a judged recording or a documented missing-recording result. Historical details (dedication, premiere, publication) are supplied when sourced. Null plus a reason is complete research; fabricated metadata is not.

Recordings **never** feature Ray Chen, Sarah Chang, Joshua Bell or Stefan Jackiw, including alternates and ensemble appearances. Follow `docs/recording-rules.md`. Unlike the older chamber recording brief's permissive viol/substitute rule, this expansion requires evidence for the same playable version. A complete parent work in another scoring is not a fallback. If only a complete movement is available, it cannot be the primary for a complete multi-movement work. MIDI and synthesized score playback are excluded. A real multitrack performance is flagged for review instead of silently treated as an ensemble performance.

## Minimal implementation

- `lib/chamber/types.ts` / `lib/types.ts`: optional arranger display name on the existing work/piece record.
- `scripts/chamber/check.ts` / `lib/chamber/scope.ts`: admit violin-only ensembles, allow 10–12 parts only for violin, viola, cello or double bass alone, retain existing duo/mixed-ensemble rules, and support hardest-part names such as `cello 12`.
- Both builds preserve the arranger; the old curation mapper also preserves it if used. The warning against rerunning the legacy full rebuild still applies.
- `WorkAbout` / `programText`: arranger appears in the existing facts list and copied program text, including when movements are unavailable.
- Shared search and advisor tools carry arranger credit. Advisor count limits and scope wording support twelve parts. The existing instrument switcher's range is updated; no new finder UI.

Research workers still never edit canonical data or allocate final ids. The coordinator prepares incremental additions/updates against the latest JSON and the existing id registry, checks both catalogues for duplicates, keeps per-version evidence, and reviews complete staged proposals before applying. Do not rerun the historical merger to append this expansion. Preserve manual edits and unrelated data; make a second dry run a no-op. A bespoke public version registry or score-link subsystem is not a prerequisite.

## Validation and acceptance

- Research/import pilot cases must include a four-cello arrangement sharing a parent IMSLP page, two arrangers of the same work/count, two editions of one arrangement, an excerpt, an existing id, eight players on four parts, a twelve-cello scoring, and an unavailable video.
- Type checking, program-copy/arranger-search/scope/group tests, `npx tsx scripts/chamber/check.ts`, isolated catalogue-build fixtures and `npm run build`. Verify existing generated catalogues are unchanged when no new arranger data is supplied.
- Inspect the pilot in actual piece pages and public catalogue JSON. The exact-group advisor must match the eight-viola version; no piano or doubled-four-part inference. Check arranger search, detail credit, program copy, existing IMSLP destination and every selected/alternate recording. New instrument-count filters and word-form scoring aliases are deferred.
- Coverage report by instrument × independent-part count: discovered pages, proposed distinct versions, already present, accepted, held, skipped, research blocked, score available, recording available. Include publisher/modern gaps so a thin bucket is honestly thin.
- First estimate costs/time **after** pilot enrichment. The current 685 memberships are a starting workload, not a promise of 685 additions or a basis for a reliable token estimate. Track accepted versions and tool calls per agent; resume saved outputs instead of redoing searches.

## Resume

Prepared files: this plan; `data/chamber/same-instrument/{AGENT_BRIEF.md,jobs.json,category-snapshot.json,pilot.md}`. The first three independently reviewed pilot entries are imported; the remainder is checkpointed. Read data/chamber/same-instrument/RESUME.md before continuing. Isolated build fixtures confirmed arranger propagation for chamber-only, violin-only and cross-listed works, acceptance of three violins/twelve cellos (including `cello 12` as hardest part), and rejection of thirteen parts. Canonical repertoire and generated catalogues were left unchanged. The production build generated all 15,044 routes successfully; existing OgCard filesystem-tracing warnings remain unrelated to this change.


## Current checkpoint

See `data/chamber/same-instrument/RESUME.md` and `progress.json` for current canonical counts and actual applied reports. Earlier pilot-stage counts above describe historical setup.
