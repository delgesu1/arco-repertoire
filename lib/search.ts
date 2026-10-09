import type { Piece } from "./types";
import { eraLabel, settingLabel, typeLabel, typeSingular } from "./vocab";

/**
 * Search rules ported from the Sheet's "Finder calc" formula:
 * accents ignored, every word must match (any order), and catalogue numbers, keys and exam grades
 * are joined into single tokens ("op 35" → op35, "e minor" → eminor, "abrsm grade 7" → abrsmgr7).
 * Added for the site: prefix matching while typing, and title/composer hits rank first.
 */
export function fold(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[łŁ]/g, "l")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .toLowerCase();
}

const CATALOGUE =
  /\b(op|no|nos|k|kv|bwv|rv|hwv|hob|sz|woo|ms|d|s|h|l|m|p|b|c|g|z|fp|jw|twv|gr|rcm|cap|nyssma|henle|book|vol|vwv|mwv)\.? ?(\d)/g;

export function normalize(s: string): string {
  return (
    " " +
    fold(s)
      .replace(/[’'`"“”()[\]{},;:!?/·•|]+/g, " ")
      .replace(/\bopus\b/g, "op")
      .replace(/\bgrade\b/g, "gr")
      .replace(/\bnumber\b/g, "no")
      .replace(/\bflat\b/g, "-flat")
      .replace(/\bsharp\b/g, "-sharp")
      .replace(/ -(flat|sharp)/g, "-$1")
      .replace(CATALOGUE, "$1$2")
      .replace(/\b(abrsm|trinity|ameb|uil|asta) (gr|cap)/g, "$1$2")
      .replace(/\b([a-g](?:-flat|-sharp)?) (major|minor)\b/g, "$1$2")
      .replace(/\./g, " ")
      .replace(/\s+/g, " ")
      .trim() +
    " "
  );
}

const FIELD_WEIGHTS = { title: 4, composer: 4, set: 2, rest: 1 } as const;

export interface IndexedPiece {
  piece: Piece;
  fields: { title: string; composer: string; set: string; rest: string };
}

export function indexPieces(pieces: Piece[]): IndexedPiece[] {
  return pieces.map((p) => {
    const hyphenless = (s: string) => s + s.replace(/-/g, " ");
    return {
      piece: p,
      fields: {
        title: hyphenless(normalize(p.title)),
        composer: hyphenless(normalize(`${p.composer} ${p.composerName}`)),
        set: p.set ? normalize(p.set) : " ",
        rest: hyphenless(
          normalize(
            [
              typeLabel(p.type),
              typeSingular(p.type),
              eraLabel(p.era),
              ...p.settings.map(settingLabel),
              p.accompaniment,
              p.nationality,
              p.mode ?? "",
              p.pace ?? "",
              ...p.character,
              p.popularity ?? "",
              p.notes,
              p.exams,
            ].join(" "),
          ),
        ),
      },
    };
  }) as IndexedPiece[];
}

/** Does the normalized haystack contain the token at a word start? Tokens ending in a digit must match whole. */
function hit(hay: string, tok: string, prefix: boolean): boolean {
  let from = 0;
  for (;;) {
    const i = hay.indexOf(" " + tok, from);
    if (i < 0) return false;
    const next = hay[i + 1 + tok.length];
    if (/\d$/.test(tok) ? !/\d/.test(next) : !prefix ? next === " " : true) return true;
    from = i + 1;
  }
}

export function queryTokens(q: string): string[] {
  return normalize(q).trim().split(" ").filter(Boolean);
}

/** Returns score > 0 when every token matches somewhere; higher scores rank first. */
export function scorePiece(ix: IndexedPiece, tokens: string[]): number {
  if (!tokens.length) return 1;
  let score = 0;
  tokens.forEach((tok, i) => {
    if (score < 0) return;
    const isLast = i === tokens.length - 1;
    let best = 0;
    for (const [k, w] of Object.entries(FIELD_WEIGHTS) as [keyof IndexedPiece["fields"], number][]) {
      if (hit(ix.fields[k], tok, isLast) || (tok.length >= 3 && hit(ix.fields[k], tok, true))) {
        best = Math.max(best, w);
      }
    }
    if (best === 0) score = -1;
    else score += best;
  });
  return score;
}

export function search(index: IndexedPiece[], q: string): { piece: Piece; score: number }[] {
  const tokens = queryTokens(q);
  const out: { piece: Piece; score: number }[] = [];
  for (const ix of index) {
    const s = scorePiece(ix, tokens);
    if (s > 0) out.push({ piece: ix.piece, score: s });
  }
  return out;
}
