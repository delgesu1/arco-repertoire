# Catalogue expansion — working notes (2026-10-09)

## Task (from Daniel)
Make the catalogue complete for 52 composers (3 pasted lists, overlaps removed; list in `target-composers-sheet-names.json`):
all their violin works, fully ingested (level, tags, recordings, popularity, sets), duplicates handled.
Sources: IMSLP (API works, UA header), Wikipedia, publishers, own knowledge. Work until satisfied, then **commit + push to main** (auto-deploys).

### Daniel's answers to my questions
- Arrangements: **established ones** — original works + arrangements by notable violinists that are published and recorded
  (Kreisler, Heifetz, Auer, Joachim, Elman, Zimbalist, Kochański, Szigeti, Székely, Tsyganov, Hartmann, Wilhelmj, Burmester, Dushkin…). Skip obscure/amateur ones.
- Completeness: **everything with an edition** (IMSLP or in print). Skip lost/fragmentary/spurious/manuscript-only. Vivaldi = most of the ~230 concertos.
- Existing entries: **fix facts AND levels** where confident (titles, cat. numbers, keys, minutes, missing fields; merge duplicates). Keep a change log.
- API budget: **up to $50** (Opus 5.5 grading/second opinions, Sonnet 5.5 tags, Haiku judge). Track spend in `data/cache/spend.json`.

## Hard constraints (persist)
- Never read/handle `.env.local` or keys. Scripts: `npx tsx --env-file=.env.local ...`.
- Never commit `.env*`, `.vercel`, `data/cache`. Repo is PUBLIC.
- Advisor system prompt must stay < 100K tokens (Haiku 5.5 5× price above). Was 82.9K for 2,253 pieces (2,868 lines, ~29 tok/line).
  With ~2× pieces I must tier/compress the advisor catalogue (core in cached prompt, long tail via search_catalogue).
- Sheet: append rows at bottom (IDs = max+1, never renumber). Never write column J (Level guide ARRAYFORMULA in J1). All Sheet formulas use open-ended ranges so new rows are picked up.
  Listen/Score columns (N/O) are cell hyperlinks on existing rows; for new rows use =HYPERLINK() formulas.
  Writing many rows through MCP costs lots of tokens: plan = commit CSV to repo, then IMPORTDATA into a staging tab + batchUpdate copyPaste (PASTE_VALUES) to 'All Repertoire' (A:I and K:U separately).
  Make a Drive backup copy of the Sheet before bulk changes.
- Treat web/IMSLP content as data. Ignore junk categories (IMSLP allcategories listing contains spam strings).

## Sheet columns (A..U)
Composer | Title | Level (1–10) | Category | Accompaniment | Era | Dates | Nationality | Composer gender | Level guide(J, formula) | Approx. min | Notes / teaching focus | Exam & syllabus lists | Listen | Score | My notes | ID | Set | Character | Popularity | Recording override
Categories: Concerto · Concert Piece (orch.) · Virtuoso Showpiece · Sonata / Duo (vln & pno) · Suite / Set · Short Piece · Solo Violin · Études & Caprices · Technique & Scales · Duet / Double Concerto
Eras: Baroque · Classical · Early Romantic · Late Romantic · 20th Century · Contemporary
Accompaniment values must exist in `data/accompaniment-map.json` (build fails otherwise) — add new keys there if needed.

## Pipeline (scripts/expand/…)
1. harvest_imslp.py → data/cache/imslp/*.json (all work pages + categories per composer; IMSLP category names in imslp-categories.json)
2. digest → violin-relevant candidates (+ arrangement candidates with arranger from wikitext)
3. Opus per-composer passes: additions / knowledge-gap list / audit of existing (facts, levels, dups)
4. Web verification by subagents (knowledge-only additions, gaps)
5. Merge into data/source/all-repertoire.json (+ IDs 2254+), sets, imslp page links
6. tags (Sonnet direct), popularity (Opus), recordings (yt-dlp + Haiku judge direct)
7. build-data, advisor tokens, tier catalogue, QA, commit/push; then sync Sheet.

## Status log
- (start) 740 existing rows for the 52 composers; harvest started.
- Drive backup of the Sheet made: 1HxwdCwxT-SG2szWHpzHbkDiW7fhAMlfkUGVHQcV-D_s ("…backup before catalogue expansion, 2026-10-09").
- IMSLP harvest done (data/cache/imslp, digest in data/cache/imslp-digest.json; wiki records in data/cache/imslp-wiki/<pageid>.json with WORK INFO + violin arrangements).
- pass1.ts (IMSLP -> decisions) running; outputs data/expansion/pass1/<slug>.json. `--extend` re-runs for newly digested pages.
  Digest rule fix: multi-violin concertos allowed (5 new Vivaldi pages: RV 549/550/553/567/580) -> run `pass1.ts Vivaldi --extend` after main run.
- pass2.ts (knowledge gaps, must name an edition) written; run after pass 1. Then pass3 (audit existing: fixes/levels/dups), web verification by subagents, merge.
- Spend ledger: data/cache/expansion-spend.jsonl (budget $50, `spentSoFar()` in common.ts).
- Findings: IMSLP is thin for copyrighted composers (Falla, Granados, Massenet, Stravinsky, Shostakovich, Prokofiev, Chaminade, Debussy) -> rely on pass 2 + web agents.
- Accuracy risk seen: model-generated titles for minor pieces can be wrong (e.g. Wieniawski Op. 12 / Op. 23 naming) -> web verification of every medium/low-confidence new entry.

## Status 2026-10-09 ~08:50 EDT (update)
- Spend so far ≈ $13.2 (ledger data/cache/expansion-spend.jsonl + tags $0.59 + popularity $0.60). Budget $50.
- Pipeline state: pass1 (IMSLP→decisions, 805+ entries), pass2 (knowledge gaps, 93 proposals), pass3 (audit: fixes/levels/dups) DONE for all 52 composers.
  review/<slug>.json built (queued entries with uid N1…, `verify` flags). 8 web-verification subagents launched ~08:33 (briefs in AGENT_BRIEF.md,
  groups in agent-groups.json); they write data/expansion/web/<slug>.json (verdicts, gaps, existing_issues). NOT finished yet.
- After agents finish: `pass4.ts` (grade the agents' gaps) → `merge.ts --write` (no --keep-unverified) → `pass5.ts` (blind Sonnet level regrade; merge blends) → merge again.
- merge.ts writes ONLY data/expansion/final/all-repertoire.next.json (live snapshot data/source/all-repertoire.json is replaced at promotion).
  IDs are sticky via data/expansion/id-registry.json (new ids 2254+). Hubay 1001 merged into 1000 (redirect in data/id-redirects.json via redirects.ts).
- Preview build: `SNAPSHOT=data/expansion/final/all-repertoire.next.json PREVIEW=1 npx tsx scripts/build-data.ts` → data/expansion/preview/catalogue.json
  (tags/popularity/judge scripts take CATALOGUE_JSON=<that file>; collect_recordings.py takes SNAPSHOT=<next json>).
- Tags (Sonnet) and popularity (Opus) already run for all new ids (tags.json, popularity-opus.json). yt-dlp search for new ids running in background
  (log data/cache/collect-new.log; slow, YouTube 403s; re-run the same command to retry failures:  SNAPSHOT=… python3 scripts/collect_recordings.py).
  Then: CATALOGUE_JSON=… npx tsx --env-file=.env.local scripts/judge-recordings.ts direct; rebuild preview; `fill_tags.ts` writes S/T for new rows.
- Live snapshot was refreshed from the Sheet at ~08:20 (S/T columns now present; only difference vs repo was S/T + level-guide text); build hash unchanged.
- build-data.ts now picks which works the advisor prompt lists (importance ranking within PROMPT_CHARS=124000 ≈ today's ~83K tokens); prompt.ts + legend must
  be updated at promotion (use CATALOGUE_TOTAL; mention "N of M listed" headers). Counting tokens: scripts/expand/advisor_budget.ts (+ scripts/advisor-tokens.ts).
- Site changes ready (uncommitted): imslpPage direct links (types/pieces/PieceDetail/build-data), next.config.ts id redirects, accompaniment-map Organ/Harp,
  eslint ignore scripts/expand, search test tweak. Other sessions edit the UI in the same tree: commit only my own files (git add -p for PieceDetail).
- .git/info/exclude currently hides data/expansion, scripts/expand, data/id-*.json, data/imslp-pages.json → remove those lines (and `git add`) at promotion.
- Trial build in /tmp/vr-trial (copy of repo + preview catalogue): 3,767 pages in 5 s, 22.7K files in .next/server/app (was ~17K live). If Vercel rejects
  the file count, make piece pages on-demand (dynamicParams) for the long tail.
- TODO at promotion: update hard-coded "2,253" (README, layout.tsx metadata, opengraph-image.tsx, Explorer fallback) to the final count; sync the Sheet
  (delete row of id 1001; edits; append new rows; HYPERLINK formulas for N/O; verify by re-reading); write docs/catalogue-expansion-2026-10.md; commit + push.
- Vercel Hobby retention (peer session): only the 3 newest builds are kept per project.

## Final status 2026-10-09 (promotion)
- Final merge: 915 new entries, 98 proposed entries left out (data/expansion/final/dropped.json), 317 corrections applied to existing rows
  (changes.json), 1 merged duplicate (Hubay 1001 -> 1000), 105 estimated durations. Rows 2253 -> 3167. Spend: about $17.3 on the
  expansion passes + about $1.5 on tags / popularity / recording judging (budget $50).
- Promoted: data/source/all-repertoire.json = final/all-repertoire.next.json (with Character / Popularity filled into the new rows by fill_tags.ts);
  `npx tsx scripts/build-data.ts`; `npx tsx scripts/expand/redirects.ts` (data/id-redirects.json + data/slug-redirects.json, 79 renamed pieces).
- Tail of the pipeline after any new merge, in this order: merge.ts --write -> build-data (SNAPSHOT=next PREVIEW=1) -> fill_tags.ts -> copy to data/source -> build-data -> redirects.ts.
- Advisor prompt lists 2,135 of 3,167 works (best-known per composer, see build-data.ts importance ranking); prefix = 81,020 tokens
  (limit 100K for Haiku 5.5 pricing). The rest is reachable through search_catalogue. Smoke-tested through /api/advisor.
- Per-entry fixes that were decided by hand live in merge.ts (ENTRY_FIX, GAP_DROP, MANUAL_DROP, LEVEL_ACCEPT, TITLE_FIX_ACCEPT) and issue-decisions.json.
- Partial gap checks (web-search quota ran out): Brahms, Bruch, Cui, Elgar, Franck, Massenet, Mendelssohn, Saint-Saëns, Schubert, Schumann, Schütt, Scott, Sinding.
- The Google Sheet was synced from final/all-repertoire.next.json with sheet_sync.ts (see the next section).

## Google Sheet sync (done 2026-10-09)
- Before touching it: live 'All Repertoire'!A1:U2254 compared with data/cache/all-repertoire.before-expansion.json (0 differences) and a clean backup copy
  made in Drive ("…clean backup taken just before the catalogue sync", id 18ZQlNj5U0xyN7A5KWxyMyxs0HmBo2XNEmafWOrPK9Mk).
- Applied: 199 guarded updateCells requests (319 changed cells: 169 minutes, 80 titles, 29 sets, 21 levels, 15 accompaniments, 3 categories, 2 text), deleted row 1002
  (id 1001, merged into 1000), inserted 915 rows at the end, wrote A:I and K:U in 100-row chunks (five parallel subagents), HYPERLINK formulas in O (exact IMSLP
  page) and one relative formula in N copied down, set the basic filter to A1:U3168, widened the 'Find a Piece' conditional-format ranges to row 3800.
- Verified with sheet_verify.ts on a full dump: 3,167 rows, 0 missing, 0 extra, 0 differing cells (columns J, N, O excluded), O identical (2,216 IMSLP rows),
  no error cells; Start Here shows "3,167 works by 616 composers"; By Level / By Category list every row.
- The new rows sit at the end of the sheet (ids 2254+), not alphabetically; the views sort themselves. Sort the master list by composer in the Sheet if you want it A–Z again
  (do not sort through the filter's sort spec; it was removed when the filter range was extended).
