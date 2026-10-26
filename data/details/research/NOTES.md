# Work details: how to continue

1. IMSLP (done): `python3 scripts/fetch_imslp_details.py` then `python3 scripts/parse_imslp_details.py` → `data/details/imslp.json`.
2. Research (Haiku subagents, brief `BRIEF.md`): `python3 scripts/details_prep.py export` writes `to-research/rNNN.json` (40 works each,
   best-known first; it skips works already exported or done). Each agent reads one chunk and writes `done/rNNN.json`.
   Launch at most 3 at a time; check the 5-hour and weekly usage after each finishes; stop new launches near 90% (weekly) / 92% (5-hour).
   The pilot (`p001`, scored with `python3 scripts/details_score.py p001`) matched IMSLP on 21 of 23 movement lists; years differ
   only by convention (ranges vs end year).
3. Merge: `python3 scripts/details_merge.py`, then `npx vitest run --exclude '.claude/**'`; commit only `data/details/**`,
   `public/data/details.json` and `scripts/details_*.py`. While the duos work is under way, the "Music section organization
   strategy" session owns the rebuilds (`build-data.ts`, `build-chamber.ts`, `data/build/*`, the other `public/data/*`) and the
   single push: message it when the research is finished for good. Ask the owner before anything is pushed.
