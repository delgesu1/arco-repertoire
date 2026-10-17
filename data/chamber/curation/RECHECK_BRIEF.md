# Recheck brief: filling the gaps a curation agent admitted

You recheck one slice that a first agent curated (`data/chamber/curation/out/<slice>.json`). That agent ran out of tool calls, was blocked by a service, or was cut short by the usage limit, and its file says where. Your job is to turn "not checked" and weak "none found" into answers, in the same file. Read `AGENT_BRIEF.md` first: the floor, the fields, the house style and the sources apply unchanged.

## What you edit
- Only `data/chamber/curation/out/<slice>.json`, in place. Load it with Python, change it and write it back with `json.dumps(d, ensure_ascii=False, indent=1) + "\n"` (the files use one-space indentation). Never run a git command.
- Do not change a kept work unless you find an error in it (then say so in `note`). Benchmarks (`benchmark_id`) stay as they are.

## What to recheck, in this order
1. `skipped` lines whose reason starts "not checked" (budget, usage limit, lookups blocked, unconfirmed scoring): nobody has looked.
2. Works the file's `note` or a `composers_checked` note says were left out, unreached or not found in the lookups ("Left out (not entered)", "NOT CHECKED", "published, no recording found"), and the composers marked `partial`.
3. `skipped` lines "not performed or recorded" whose `evidence` shows a weak lookup (one Apple or Deezer search, MusicBrainz blocked, a common surname, a FetchError, no search for performances). Start with the best-known composers and the most famous works.
4. In a core slice whose kept works rest on IMSLP's "recorded" signal alone (medium confidence): confirm each with a real recording (Deezer, Apple or MusicBrainz album with performers and label) and put it in `floor.recorded`; leave the work as it is when you find none.

Never reopen a line decided on a rule: out of scope, arrangement, fragment, lost, doubtful, duplicate, vocal repertoire, pedagogical.

## How
- One lookup pass per composer, not per work: MusicBrainz `work?artist=<mbid>&inc=recording-rels` (browse), a Deezer album search with the composer and a distinctive word of the title, an Apple `attribute=composerTerm` song search (do not filter its hits by surname: a hit often lists the performer or a spelling variant). Then open the album (Deezer `album/<id>`) for label, year, timings and tracks. Send every request through `scripts/chamber/fetch_throttled.py`; a FetchError is a failed lookup, never "none found".
- A concert performance counts as floor evidence for a published work: look for an ensemble's or festival's programme page or the composer's own calendar when a published work has no recording. An own-label album counts when it names the work and its scoring and can be played.
- A work passes when you hold one source for its existence and scoring and one for the floor, exactly as in the brief. Do not guess; leave a year or duration blank and lower `confidence` when you cannot confirm it.
- **Leave off what raises flags** (owner, 2026-10-17): add a work only at `high` or `medium` confidence. A lesser-known work you can support only at `low` confidence (scoring, identity or recording unconfirmed) stays a skipped line with the reason "doubtful: low confidence"; do not add it. The 186 works earlier agents kept at low confidence were moved out the same way (`parked-low-confidence.json`).

## What to write
- A work that now passes: add a full entry to `works` in the shape of its neighbours (`gap: true` and `imslpPage: null` when IMSLP has no page; the page's name when a skipped line named it); remove its `skipped` line, or lower the line's `works` count and say which works left it in `evidence`; update the composer's line in `composers_checked` (`kept`, `skipped`, `added_not_on_imslp`, and `coverage`, which is "complete" only when every work of the composer has been checked); add the composer to `authors` when new.
- A work still without evidence after a sound lookup: set the reason to "not performed or recorded" and replace `evidence` with what you searched this time (services, query terms), so the next reader knows it was checked.
- A lookup that failed: leave or set "not checked (lookups blocked)" and say so.
- Append to `note`, never replace it: "RECHECK <date>: <N> works added (<composers or titles>); <M> lines settled as not performed or recorded; <K> still not checked; hand edits: …". Say every hand edit.
- Before you finish, run `npx tsx scripts/chamber/curation_check.ts <slice>` and fix every error it reports.

## Budget and rules
About 25 tool calls (40 for a slice with more than 100 unchecked works). At 20 (35) stop researching and finalise; leave the rest as "not checked (budget)". At most about 5 WebSearch calls. No scripts that use API keys; never read `.env` files; never use `pkill`, `killall` or a name pattern to stop a process (stop only your own process, by PID).

Final reply, at most 80 words: works added, lines settled, still unchecked, problems. The file is the deliverable.
