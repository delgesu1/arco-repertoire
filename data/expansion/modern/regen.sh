#!/bin/sh
# Rebuilds the modern/contemporary snapshot from the pre-modern Sheet snapshot (the 4,061-row state at commit c3dad39)
# after any change to the researcher files, grades or decisions. Ids stay sticky through data/expansion/id-registry.json.
set -e
cd "$(dirname "$0")/../../.."
[ -f data/cache/all-repertoire.before-modern.json ] || git show c3dad39:data/source/all-repertoire.json > data/cache/all-repertoire.before-modern.json
cp data/cache/all-repertoire.before-modern.json data/source/all-repertoire.json
python3 data/expansion/modern/make_decisions.py
npx tsx scripts/expand/modern_merge.ts --write | sed -n 1,6p
python3 - <<'PY'
import json
n = json.load(open("data/expansion/modern/final/all-repertoire.next.json"))
n["range"] = "'All Repertoire'!A1:U%d" % len(n["values"])
json.dump(n, open("data/source/all-repertoire.json", "w"), ensure_ascii=False)
print(len(n["values"]) - 1, "rows in data/source/all-repertoire.json")
PY
npx tsx scripts/build-data.ts | tail -3
npx tsx scripts/expand/redirects.ts | tail -2
