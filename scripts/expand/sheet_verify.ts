/**
 * Compares a fresh dump of the Sheet ('All Repertoire'!A1:U…, saved from get_values) with the expanded snapshot.
 *   npx tsx scripts/expand/sheet_verify.ts <dump.json> [snapshot.json]
 * Columns J (formula), N and O (link text) are ignored. Prints every differing cell (up to 40) and a summary.
 */
import { readFileSync } from "node:fs";
import { HEADER } from "./common";

const dump: string[][] = JSON.parse(readFileSync(process.argv[2], "utf8")).values;
const snap: string[][] = JSON.parse(readFileSync(process.argv[3] ?? "data/expansion/final/all-repertoire.next.json", "utf8")).values;
const ID = HEADER.indexOf("ID");
const pad = (r: string[]) => [...r, ...Array(HEADER.length - r.length).fill("")];
const skip = new Set(["Level guide", "Listen", "Score"]);
const sheetById = new Map(dump.slice(1).map((r) => [pad(r)[ID], pad(r)]));
let diffs = 0, missing = 0;
const shown: string[] = [];
for (const s of snap.slice(1)) {
  const r = pad(s);
  const d = sheetById.get(r[ID]);
  if (!d) {
    missing++;
    if (shown.length < 40) shown.push(`id ${r[ID]} missing from the Sheet`);
    continue;
  }
  HEADER.forEach((h, c) => {
    if (skip.has(h)) return;
    if ((d[c] ?? "") !== (r[c] ?? "")) {
      diffs++;
      if (shown.length < 40) shown.push(`id ${r[ID]} ${h}: sheet=${JSON.stringify(d[c])} snapshot=${JSON.stringify(r[c])}`);
    }
  });
}
const extra = [...sheetById.keys()].filter((id) => !snap.slice(1).some((s) => pad(s)[ID] === id));
console.log(shown.join("\n"));
console.log(`rows: sheet ${dump.length - 1}, snapshot ${snap.length - 1}; missing from sheet ${missing}; extra in sheet ${extra.length} ${extra.slice(0, 10).join(",")}; differing cells ${diffs}`);
