# Technical-materials expansion (Oct 2026): status and how to resume

Scope (Daniel, 2026-10-09): all violin technical materials (scale systems, exercise/technique books, étude books, Ševčík, Schradieck, from every tradition).
Decisions: keep the current floor (level 1 = ABRSM 3–4; no beginner tutors); one entry per published book/part plus INDIVIDUAL studies for the big five
(Kreutzer 42, Rode 24, Dont Op. 35, Fiorillo 36, Gaviniès 24); NO API spend: all research/grading through Claude Code subagents (his subscription),
never run scripts with `--env-file`. Existing entries: fix facts and levels as before. Brief for researchers: AGENT_BRIEF.md.

## Done (files in data/expansion/tech/web/, all valid JSON)
sevcik (42 works), rode (25), gavinies (24), kreutzer (44), dont35 (24), franco_a (60), franco_b (153), german_a (103), german_b (120),
italian_baroque (66), american_modern (127), exam_boards (42), central_european (92)  → about 920 candidate works before de-duplication.
Several files are partly "low" confidence (list-only entries): those need a second look (existence check) before they go live.

## NOT done (agents were stopped on 2026-10-09 ~22:20 when the 5-hour plan limit reached 95%)
- fiorillo: 36 individual studies (the agent had reached No. 11 but saved nothing)
- russian_soviet (Auer Graded Course, Yampolsky, Mostras, Yankelevich…), topics (cross-check by technique), concert_etudes, world_other (Nordic/Iberian/Latin/Asian/fiddle/jazz)
Re-run them with the same briefs (see the task prompts in the session transcript; the group names are the file names) in small batches AFTER the limit resets
(5-hour window resets ≈ 02:30 local on 2026-10-10; weekly usage was 22–24%). Each agent used 350–800K tokens; run at most 3–4 at once.

## Next steps (cheap → expensive)
1. `npx tsx scripts/expand/tech_merge.ts` (dry run, no API): consolidates the files, writes review files in data/expansion/tech/final/
   (added.json, matches.json, near-matches.txt, skipped.json, existing-issues.json, duplicates-between-researchers.txt, problems.txt) and data/expansion/tech/to-grade.json.
2. Review: low-confidence entries, overlaps (german_a/german_b/franco_a/franco_b), existing_issues → write data/expansion/tech/decisions.json
   (existing-row corrections, drops, overrides; format in the header of scripts/expand/tech_merge.ts).
3. Blind level grading by two independent subagents (Opus + Sonnet) reading data/expansion/tech/to-grade.json (no researcher levels), writing
   data/expansion/tech/grades/<name>.json as {"grades":[{"key","level","confidence"}]}; final level = median(researcher, grader 1, grader 2).
4. `npx tsx scripts/expand/tech_merge.ts --write` → data/expansion/tech/final/all-repertoire.next.json (+ id registry, data/imslp-pages.json), copy to
   data/source/all-repertoire.json, `npx tsx scripts/build-data.ts` (no tags/recordings for these rows; popularity comes from `well_known`), `node scripts/expand/redirects.ts`
   if titles of existing rows changed, vitest + tsc + eslint + trial build, commit and push.
5. Sheet sync as on 2026-10-09 (scripts/expand/sheet_sync.ts --before=<current snapshot> --after=<tech next>), verify with sheet_verify.ts, docs report.
6. Consider lowering the advisor-prompt importance of individual studies (build-data.ts `importance`) so they do not displace repertoire.

## Findings by the researchers worth remembering
- scripts/expand/imslp_author.py now also lists `Category:<author>/Collections`; IMSLP also files methods under Category:Methods and "/Books" (not covered).
- Ševčík Op. 4, 5, 12–15, 22–24 were never published; Op. 1 = 4 parts, Op. 2 = 6, Op. 11 = Parts V–XIV above the floor.
- Kreutzer: IMSLP uses the old 40-study numbering; the entries use the standard numbering (keys of Nos. 21 and 24 disagree between IMSLP and Wikipedia/Henle: medium confidence).
- Dont Op. 35: numbering follows the 1880 Leuckart/Henle revision. Gaviniès' 24 matinées use only 16 distinct keys.
- Existing-row fixes proposed (to be decided): id 2116 title, id 656 → "24 Caprices, Op. 22", id 654 Polo level 5 → 3?, id 606 Campagnoli note, id 614 add RCM 10 (mvt), id 2113 Schradieck title/set.

## 2026-10-10 (session resumed after the limit reset)
- ~11:55 EDT: relaunched 4 research agents (briefs now have a 'Working rules' section: ~90 tool calls, save early): fiorillo (uses scratchpad/fiorillo_notes.md + winn_djvu.txt),
  russian_soviet, concert_etudes (uses scratchpad/cand1_violin.txt, cand2_solo.txt, cand2_other.txt), world_other. `topics` still to run LAST (after the others), against the full set.
- Their output goes to data/expansion/tech/web/<group>.json (valid JSON, saved incrementally). If a session ends mid-run, check which of those 4 files exist and re-run only the missing ones.
- Usage at start: 5-hour 2%, weekly 24%. Check with get_usage; do not exceed ~85% of the 5-hour window.
- ~12:05 EDT: local merge work done: data/expansion/tech/make_decisions.py -> decisions.json (51 drops of duplicates listed twice by different researchers, 8 overrides, 3 author aliases, 26 corrections of existing rows incl. '(complete)' on the big-five whole-book rows, RCM 2021 exam strings, Whistler vols split via web/manual.json).
  tech_merge.ts now has --preview (writes final/all-repertoire.preview.json, ids not saved), Level guide column, era estimate from publication year, author_meta/author_alias/imslp_pages decisions, grader 0 = below floor.
  build-data.ts: tech rows (id >= 3305) get an importance penalty (-4 individual studies, -1 other) so the advisor prompt keeps its repertoire; preview build with SNAPSHOT=data/expansion/tech/final/all-repertoire.preview.json PREVIEW=1 passes (3951 pieces).
- ~12:05: blind graders launched (GRADER_BRIEF.md): opus -> data/expansion/tech/grades/opus.json, sonnet -> grades/sonnet.json. They grade to-grade.json items (784 at that time). When the 4 research files arrive: re-run decisions + dry run, then send the graders (SendMessage) a note to grade the new keys.
- After grading: tech_merge.ts --write, copy final/all-repertoire.next.json to data/source/all-repertoire.json, build-data, redirects.ts, tests, docs, then Sheet sync (see plan above).
- ~12:35 EDT status: research files now in web/: 13 old + fiorillo (36 studies), russian_soviet (29), concert_etudes (13), world_other (28); `topics` (cross-check) still running. Blind graders: opus.json (784 + delta of ~80 running), sonnet.json (863, complete).
  Decisions after reading the new files are in make_decisions.py (world_other: obscure/self-published/tutor items dropped; russian_soviet: records-only items dropped; Barmas dropped as treatise).
  Sheet drift check done 12:20: live Sheet == data/source/all-repertoire.json (3,167 rows, 0 differences); dump saved as data/cache/sheet-dump-2026-10-10.json.
  tsc and vitest pass. Remaining: topics file + grade its new items (fresh opus/sonnet graders, same output files), final merge --write, build-data, redirects.ts, README count, docs section, Sheet sync, push.

## 2026-10-10 ~14:00 EDT: DONE locally, committed (see git log), live on push
- All 18 research slices are in web/; blind grades in grades/{opus,sonnet}.json cover all 894 added rows; decisions in make_decisions.py -> decisions.json.
- Rebuild everything after any change: `data/expansion/tech/regen.sh` (restores the pre-technical Sheet snapshot data/cache/all-repertoire.before-tech.json, merges, writes data/source/all-repertoire.json, builds data, redirects). Report: `python3 data/expansion/tech/make_report.py`.
- Result: 4,061 works (894 new, ids 3305-4198), 313 sets; trial `next build` = 4,950 pages / 29.8K files in .next/server/app (was 22.8K); advisor prompt lists 2,113 of 4,061 (122.7K chars, ~82K tokens).
- Sheet sync after the push: `scripts/expand/sheet_sync.ts --before=data/cache/all-repertoire.before-tech.json --after=data/source/all-repertoire.json`, then guarded edits, insert rows, chunk writes, N formula + O formulas, setBasicFilter, sheet_verify.ts (see data/expansion/NOTES.md for the order that worked on 2026-10-09).

## 2026-10-10 ~15:30 EDT: COMPLETE (site + Sheet)
- Commit 1b43847 pushed to main; Vercel deployment Ready (3 min); repertoire.arco.app shows 4,061 works, new pages 200, renamed pages redirect, sitemap 4,942 URLs.
- Google Sheet synced: one guarded batch (view tabs 'By Category', 'By Level', 'Find a Piece', 'Finder calc' grown to 4,900 rows; their conditional-format ranges extended to row 4,900; 894 rows inserted in 'All Repertoire' at row 3,169; 45 corrected cells; basic filter A1:U4062), then 9 chunk writes (3 Sonnet agents; the O-formula arrays needed retries when an agent dropped a row), N formula copied down, full read-back = data/source/all-repertoire.json (4,061 rows, 0 differing cells; dump in data/cache/sheet-dump-after-tech.json).
- Usage: the 5-hour window peaked at 80% (about 28 agent runs), weekly 34%, no extra-usage spend, no API spend.
- Not done / ideas: Composers tab's basic filter and level gradients still stop at row 700/514 (pre-existing); technique rows are in 'Any piece' results (a default that hides Études/Technique until chosen would be a UI change); AMEB/ASTA exam lists not re-checked; low-confidence rows (251) have title-based levels.

## 2026-10-10 evening: ten études set to their syllabus level, slug-redirect fix
- `decisions.json` now has `final_level` (`"<author-slug>:<normalised title>": level`), read by `tech_merge.ts` before the median rule. Ten single studies use it: Kreutzer Nos. 2, 3, 5 (2), 7, 13 (3); Gaviniès Matinées Nos. 4, 13, 14, 17 (6); Rode Caprice No. 8 (5). Fiorillo No. 4 keeps the median (researcher 3 was an estimate, both graders 5). Sheet: column C of those ten rows only (Level guide recomputes itself).
- Bug found and fixed: `scripts/expand/redirects.ts` used to overwrite `data/slug-redirects.json` with only the renames of the current run, so commit 1b43847 dropped the 79 redirects from the first expansion (e.g. /piece/26/glazunov-mazurka-oberek returned 404 on the live site until this fix). It now accumulates: it reads the existing file, re-points old entries to the newest slug and keeps them (91 entries now). Never `git checkout` that file back to an older version without re-running `redirects.ts`.
