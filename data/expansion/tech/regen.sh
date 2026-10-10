#!/bin/sh
# Rebuilds the technical-materials snapshot from the pre-technical Sheet snapshot (data/cache/all-repertoire.before-tech.json = the 3,167-row Sheet state of 2026-10-10)
# after any change to the researcher files, grades or make_decisions.py. Ids stay sticky through data/expansion/id-registry.json.
set -e
cd "$(dirname "$0")/../../.."
[ -f data/cache/all-repertoire.before-tech.json ] || git show HEAD:data/source/all-repertoire.json > data/cache/all-repertoire.before-tech.json
cp data/cache/all-repertoire.before-tech.json data/source/all-repertoire.json
python3 data/expansion/tech/make_decisions.py
npx tsx scripts/expand/tech_merge.ts --write | sed -n 1,5p
python3 - <<'PY'
import json
n = json.load(open("data/expansion/tech/final/all-repertoire.next.json"))
n["range"] = "'All Repertoire'!A1:U%d" % len(n["values"])
json.dump(n, open("data/source/all-repertoire.json", "w"), ensure_ascii=False)
print(len(n["values"]) - 1, "rows in data/source/all-repertoire.json")
PY
npx tsx scripts/build-data.ts | tail -3
npx tsx scripts/expand/redirects.ts | tail -2
