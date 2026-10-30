# Same-instrument ensembles: finished, 30 October 2026

**Goal complete and published. Do not resume research or replay any import.** No PAUSE file is set and no workers are running. Local working files (`staging/`, `scratch/`, `evidence/`, `cello_enrichment/`, downloaded scores and images) are git-ignored.

## State
9,159 chamber works; 129 same-instrument ensembles of 3–12 parts: 66 cello, 34 violin, 16 double bass, 13 viola; 74 with YouTube recordings. Latest import is `ensemble-43`, public IDs 109220–109240 (21 works). Report: `imports/window-8-report.json`. Dispositions: `closure/final21-dispositions.json`. Library tests, import tests, chamber check and production build passed; logs are in `data/cache/same-instrument-import/window-8-*.log`. Rollback snapshot: `data/cache/same-instrument-import/ensemble-43`.

## Held, with concrete reasons
Davidson Spiral 1, Fabian Albumblatt, Araya Cello Trio, Schmidt Op.15 (IMSLP has no No.2), Tăutu Da capo. Reasons are in the dispositions file. The earlier permanent holds in `closure-state.json` and `closure/final-proposal-dispositions.json` stand.

## Standing rules
Sheet-music links are always included, whichever library hosts the file. Poradowski's score is hosted only by PML Canada: the entry links its IMSLP page and was graded from public score-video frames, without accepting PML Canada's notice or downloading the PDF. No recordings featuring Ray Chen, Sarah Chang, Joshua Bell or Stefan Jackiw. MIDI and AI playback are excluded.

## Automation
The Codex heartbeat `continue-atlas-ensemble-expansion` is still scheduled for 4 November 2026 07:30 UTC. Its instructions say to delete itself if the goal is complete; `run-state.json` now says complete.
