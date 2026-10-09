/**
 * Prepares everything needed to bring the Google Sheet in line with the expanded snapshot, as files to paste into the
 * Sheets connector calls (the connector takes values as tool parameters, so this keeps the pasting mechanical):
 *
 *   data/expansion/sheet-sync/edits.json            batchUpdate requests: changed cells of existing rows (row numbers = current Sheet rows)
 *   data/expansion/sheet-sync/delete-rows.json      rows to delete (merged duplicates), highest first — run AFTER the edits
 *   data/expansion/sheet-sync/chunk-<n>-AI.json     values for A:I of the new rows            (range printed in index.json)
 *   data/expansion/sheet-sync/chunk-<n>-KU.json     values for K:U of the new rows
 *   data/expansion/sheet-sync/chunk-<n>-O.json      HYPERLINK formulas for column O (IMSLP: the work's own page, else a search), "" where there is none
 *   data/expansion/sheet-sync/index.json            ranges, row counts, grid sizes
 *
 * Run order that worked on 2026-10-09 (see data/expansion/NOTES.md): guarded batchUpdate of edits.json (split in batches of ~70; take a
 * fresh revisionId from get_spreadsheet before each), delete-rows.json, insert_dimension at the end (inheritFromBefore), then the chunks
 * (update_values for AI and KU, update_formulas for O), then ONE formula in N<firstNewRow>
 *   =HYPERLINK("https://www.youtube.com/results?search_query="&ENCODEURL(A<r>&" "&B<r>&" violin"),"▶ Listen")
 * copied down with a copyPaste (PASTE_FORMULA) request, setBasicFilter over the new row count, and a full read-back through sheet_verify.ts.
 *
 *   npx tsx scripts/expand/sheet_sync.ts [--before=<snapshot>] [--after=<snapshot>] [--chunk=100]
 */
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { HEADER, ROOT, read } from "./common";

const arg = (n: string, d: string) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const before: string[][] = read(arg("before", "data/cache/all-repertoire.before-expansion.json")).values;
const after: string[][] = read(arg("after", "data/expansion/final/all-repertoire.next.json")).values;
const CHUNK = Number(arg("chunk", "100"));
const SHEET_ID = 558311820; // 'All Repertoire'
const ix = (n: string) => HEADER.indexOf(n);
const ID = ix("ID");
const pad = (r: string[]) => [...r, ...Array(HEADER.length - r.length).fill("")];

const afterById = new Map(after.slice(1).map((r) => [r[ID], pad(r)]));
const outDir = join(ROOT, "data/expansion/sheet-sync");
mkdirSync(outDir, { recursive: true });

// 1. changed cells in existing rows (columns the expansion may touch)
const EDIT_COLS = ["Title", "Level (1–10)", "Category", "Accompaniment", "Approx. min", "Notes / teaching focus", "Exam & syllabus lists", "Set"];
const requests: unknown[] = [];
const deleted: number[] = [];
let editedCells = 0;
before.slice(1).forEach((b, i) => {
  const row = i + 2; // 1-based sheet row
  const br = pad(b);
  const a = afterById.get(br[ID]);
  if (!a) {
    deleted.push(row);
    return;
  }
  for (const name of EDIT_COLS) {
    const c = ix(name);
    if (br[c] === a[c]) continue;
    const v = a[c];
    const isNum = (name === "Level (1–10)" || name === "Approx. min") && v !== "" && !Number.isNaN(Number(v));
    requests.push({
      updateCells: {
        range: { sheetId: SHEET_ID, startRowIndex: row - 1, endRowIndex: row, startColumnIndex: c, endColumnIndex: c + 1 },
        rows: [{ values: [{ userEnteredValue: isNum ? { numberValue: Number(v) } : { stringValue: v } }] }],
        fields: "userEnteredValue",
      },
    });
    editedCells++;
  }
});
writeFileSync(join(outDir, "edits.json"), JSON.stringify(requests));
writeFileSync(
  join(outDir, "delete-rows.json"),
  JSON.stringify([...deleted].sort((x, y) => y - x).map((row) => ({ deleteDimension: { range: { sheetId: SHEET_ID, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }))),
);

// 2. new rows, in chunks. Column J (Level guide) is an array formula and N/O are formulas: never written here.
const beforeIds = new Set(before.slice(1).map((r) => pad(r)[ID]));
const fresh = after.slice(1).map(pad).filter((r) => !beforeIds.has(r[ID]));
const numeric = new Set(["Level (1–10)", "Approx. min", "ID"]);
const cell = (name: string, v: string) => (numeric.has(name) && v !== "" ? Number(v) : v);
const J = ix("Level guide");
const AI = HEADER.slice(0, J);
const KU = HEADER.slice(J + 1);
const SCORE = ix("Score");
const pages: Record<string, string> = existsSync(join(ROOT, "data/imslp-pages.json")) ? read("data/imslp-pages.json") : {};
const oFormula = (r: string[]) => {
  if (r[SCORE] !== "IMSLP") return "";
  const page = pages[r[ID]];
  const url = page
    ? `https://imslp.org/wiki/${encodeURIComponent(page.replace(/ /g, "_"))}`
    : `https://imslp.org/index.php?title=Special:Search&search=${encodeURIComponent(`${r[0].split(",")[0]} ${r[1]}`)}`;
  return `=HYPERLINK("${url}","IMSLP")`;
};
const firstNewRow = before.length + 1 - deleted.length; // first empty row once the merged rows are gone
const index: Record<string, unknown> = { editedCells, deletedRows: deleted, newRows: fresh.length, firstNewRow, chunks: [] as unknown[] };
for (let s = 0, n = 0; s < fresh.length; s += CHUNK, n++) {
  const part = fresh.slice(s, s + CHUNK);
  const r0 = firstNewRow + s;
  const r1 = r0 + part.length - 1;
  writeFileSync(join(outDir, `chunk-${n}-AI.json`), JSON.stringify(part.map((r) => AI.map((h, k) => cell(h, r[k])))));
  writeFileSync(join(outDir, `chunk-${n}-KU.json`), JSON.stringify(part.map((r) => KU.map((h, k) => cell(h, r[J + 1 + k])))));
  writeFileSync(join(outDir, `chunk-${n}-O.json`), JSON.stringify(part.map((r) => [oFormula(r)])));
  (index.chunks as unknown[]).push({
    n,
    rows: part.length,
    rangeAI: `'All Repertoire'!A${r0}:I${r1}`,
    rangeKU: `'All Repertoire'!K${r0}:U${r1}`,
    rangeO: `'All Repertoire'!O${r0}:O${r1}`,
  });
}
index.totalRowsAfter = firstNewRow + fresh.length - 1;
writeFileSync(join(outDir, "index.json"), JSON.stringify(index, null, 1));
console.log(`edited cells ${editedCells}, rows to delete ${deleted.join(",") || "none"}, new rows ${fresh.length} in ${(index.chunks as unknown[]).length} chunks; sheet will have ${index.totalRowsAfter} rows`);
