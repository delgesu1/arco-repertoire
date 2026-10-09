#!/bin/bash
# Incremental refresh while the web researchers deliver: grade their gaps, assign ids, then tags / popularity / recordings
# for whatever is new. Safe to re-run; every step only does the work that is missing.
set -e
cd "$(dirname "$0")/../.."
NEXT=data/expansion/final/all-repertoire.next.json
PREV=data/expansion/preview/catalogue.json
npx tsx --env-file=.env.local scripts/expand/pass4.ts
npx tsx scripts/expand/merge.ts --keep-unverified --write
npx tsx --env-file=.env.local scripts/expand/pass5.ts            # blind level grade for entries not graded yet
npx tsx scripts/expand/merge.ts --keep-unverified --write        # blend the new grades
SNAPSHOT=$NEXT PREVIEW=1 npx tsx scripts/build-data.ts
CATALOGUE_JSON=$PREV npx tsx --env-file=.env.local scripts/tag-pieces.ts direct
CATALOGUE_JSON=$PREV npx tsx --env-file=.env.local scripts/popularity.ts
SNAPSHOT=$NEXT python3 scripts/collect_recordings.py
CATALOGUE_JSON=$PREV npx tsx --env-file=.env.local scripts/judge-recordings.ts direct
SNAPSHOT=$NEXT PREVIEW=1 npx tsx scripts/build-data.ts
