# Active enrichment/import pilot

The owner authorized continuing research, verification and ingestion until the current five-hour usage window is nearly exhausted, then safely pausing. Use Sol. No commits, pushes, branches, paid model APIs or new publisher-link UI. Read `AGENT_BRIEF.md`; this file supplies the exact pilot output contract.

Check `data/chamber/same-instrument/PAUSE` before each new entry and after each group of web calls. If it exists, finish saving the current entry, set status `partial`, add a precise resume note, and return. The coordinator monitors live usage. Save after **each entry**, using a temporary file and atomic rename. Do not launch child agents or unsupervised background research.

Write only the assigned `research/pilot-<name>.json` and your scratch directory. Do not edit canonical JSON, generated files, other agents' outputs, or research briefs. Read the existing catalogue/composer/recording files narrowly for duplicate matching and metadata. Existing works may be enriched but not rewritten by a worker. Do not guess factual fields to make an entry importable.

## Output

Use this envelope, with no extra fields on `work` beyond the current ChamberWork schema:

```json
{
  "chunk": "pilot-name",
  "role": "enrichment",
  "status": "partial",
  "entries": [
    {
      "key": "stable-readable-temporary-key",
      "existingPublicId": null,
      "decision": "include",
      "reason": "Why the exact version passes the floor",
      "work": {
        "composer": "Surname, Given names",
        "title": "Title specifying this scoring or version",
        "instruments": {"violin": 4},
        "players": 4,
        "formation": "string-quartet",
        "form": "work",
        "level": 4,
        "hardestPart": "violin 1",
        "year": "",
        "minutes": null,
        "set": null,
        "notes": "At most 120 characters",
        "popularity": "lesser-known",
        "mode": null,
        "pace": null,
        "character": []
      },
      "composerMetadata": null,
      "details": {},
      "evidence": {
        "sources": [],
        "scoring": {"url": "inspected source", "locator": "page or heading", "finding": "exact parts and no required accompaniment"},
        "floor": {"url": "inspected source", "finding": "actual performance or released human recording of this version"},
        "version": {"kind": "original", "arranger": null, "extent": "whole-work", "selection": null},
        "score": {"url": "inspected source", "finding": "published score/parts availability"},
        "fieldSources": {},
        "unknowns": {}
      },
      "researcherGrade": {"basis": "reason from the actual parts", "confidence": "medium"},
      "recordingResearch": {"status": "not-found", "queries": [], "candidates": []}
    }
  ],
  "unresolved": [],
  "resume": {"nextKey": null}
}
```

`decision` is `include`, `hold` or `reject`. No placeholder URLs or fake metadata. If a required claim cannot be established, use hold with the real partial record and reason. `existingPublicId` is an exact duplicate/enrichment match; `work.violinId` may be set for a genuine cross-list such as Telemann public id 568. Do not allocate `work.id`. The coordinator allocates it after verification. For an existing work copy its ordinary fields, then propose only sourced amendments; the coordinator reviews changes individually.

`work.arranger` is optional, in display order (e.g. `Klaus Trumpf`). Omit for originals without a credited arranger. The `version` evidence explains original/composer-version/arrangement/transcription and whole-work/complete-set/selection. Titles should distinguish the actual version without repeating a separate arranger-credit phrase. The original composition date and arrangement date must not be conflated.

`composerMetadata` is null for a composer already in the existing catalogues. For a genuinely new composer it contains the existing schema (`dates`, `nationality`, `gender`: `F|M|""`, `era` from lib/vocab.ts), with URLs in fieldSources. Do not infer demographics from names. Era, dates and nationality can be copied from an existing matching composer.

`details` uses WorkDetails fields only: movements, kind, composed, dedication, firstPerformance, published, otherTitles. Every populated fact needs field evidence; unknown optional details stay omitted. IMSLP work-page data about a different original scoring must not be applied to a transcription's movements/premiere/duration automatically. `work.imslpPage` is the verified canonical IMSLP page **title**, not URL or a category. Leave absent when there is none.

`work.level` and `hardestPart` are the researcher's estimates on the existing 1–10 scale. Read `data/chamber/grading/anchors.json`; use the scale and score-supported parallels. A separate reviewer receives the facts without those estimates and grades independently. Do not fill partLevels unless all parts have been individually graded. Character tags must be in lib/vocab.ts.

YouTube: use actual search results and inspected metadata. For each candidate save id, title, channel, seconds, URL, full relevant performer credits/description, exact-version/completeness evidence, and embed check if performed. Never Ray Chen, Sarah Chang, Joshua Bell or Stefan Jackiw, even in an ensemble or alternate. Do not approve based on title/count alone for arrangements. A complete human recording on IMSLP or a professional concert programme can pass the repertoire floor even if YouTube remains missing; leave an explicit searched/blocked/unverified status. Candidate judgement is separate from research.

Aim for the assigned six or eight entries; do not exceed roughly 45 web/tool lookups without checkpointing and reporting a partial result. A held item counts as researched. Fewer well-supported candidates are preferable to invented or weak entries. Finish with a short count and the saved output path.
