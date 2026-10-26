# Which YouTube recordings the site may embed

**Never embed a recording by Ray Chen, Sarah Chang, Joshua Bell or Stefan Jackiw.** This holds for both sections (violin and chamber), for primary picks and for alternates, and for any video that features one of them, whether as soloist or as a member of the ensemble: a title or channel naming them ("Ray Chen – …", the "Joshua Bell" and "Sarah Chang - Topic" channels), a description crediting them, an orchestra's upload of a concert they played, a fan upload of their recording.

If one of them is the only good recording of a work, pick another performer; if there is no acceptable alternative, the work has no recording (`none`). The owner decides when this list changes; add a name in `scripts/recording-rules.ts` (`EXCLUDED_PERFORMERS` and the pattern under it) and write it here.

## Where the rule is enforced
- `scripts/recording-rules.ts` holds the list and `featuresExcludedPerformer()`.
- `scripts/judge-recordings.ts` (violin) and `scripts/chamber/recordings.ts` (chamber) drop such candidates by title, channel and description before any model or reviewer sees them.
- `scripts/build-data.ts` and `scripts/build-chamber.ts` stop with an error when a picked recording's title or channel names one of them.
- Alternates and sheet overrides carry no title in the build, so they are not caught there. When you hand-pick or swap a video, or take one from a search, check its title, channel and description yourself (`https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=<id>` gives title and uploader without the rate limits of `yt-dlp`; a Topic channel's or label's description names the artists).
- Reviewers and subagents that choose recordings (`data/chamber/recordings/BRIEF.md`, `BRIEF2.md`) are told the rule.

## What was done (October 2026)
All 47 works whose primary pick or alternates featured one of the four were fixed in `data/recordings-judged.json`: 28 primaries replaced (mostly Kreisler miniatures and concertos that had the Joshua Bell, Ray Chen and Sarah Chang channels' uploads), and the banned alternates swapped for others. Replacements were chosen from the search candidates already collected for each work (and four fresh searches), prefer professional performers, and were checked for embedding with oEmbed. The chamber section had no primary pick naming them; a title and uploader scan of all its ~5,000 alternates (oEmbed) found one (a Joshua Bell Fauré trio under Piano Trio Op. 120), removed from `data/chamber/recordings-judged.json`.
