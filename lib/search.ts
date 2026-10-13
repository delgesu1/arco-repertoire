import type { Piece } from "./types";
import { eraLabel, settingLabel, typeLabel, typeSingular } from "./vocab";

/**
 * Search rules ported from the Sheet's "Finder calc" formula:
 * accents ignored, every word must match (any order), and catalogue numbers, keys and exam grades
 * are joined into single tokens ("op 35" → op35, "e minor" → eminor, "abrsm grade 7" → abrsmgr7).
 * Added for the site: prefix matching while typing, title/composer hits rank first, a bare number
 * finds a catalogue number ("brahms 78" → Op. 78), and "violin" and filler words are optional.
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

const PREFIXES =
  "op|no|nos|k|kv|bwv|rv|hwv|hob|sz|woo|ms|d|s|h|l|m|p|b|c|g|z|fp|jw|twv|gr|rcm|cap|nyssma|henle|book|vol|vwv|mwv";
const CATALOGUE = new RegExp(`\\b(${PREFIXES})\\.? ?(\\d)`, "g");
const JOINED = new RegExp(` (?:${PREFIXES})(\\d+)`, "g");

/** Appends the bare number of every catalogue token (" op78 no1 " → " op78 no1 78 1 "). */
function withBareNumbers(s: string): string {
  const nums = new Set([...s.matchAll(JOINED)].map((m) => m[1]));
  return nums.size ? `${s}${[...nums].join(" ")} ` : s;
}

/** Every work here is for violin, so these words never rule a piece out (unless they're all you typed). */
const OPTIONAL = new Set(["violin", "for", "and", "&", "the", "of", "in", "with", "by"]);

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

// composer outranks title so "brahms violin concerto" puts his concerto above studies on it
const FIELD_WEIGHTS = { title: 4, composer: 5, set: 2, rest: 1 } as const;

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
        title: withBareNumbers(hyphenless(normalize(p.title))),
        composer: hyphenless(normalize(`${p.composer} ${p.composerName}`)),
        set: p.set ? withBareNumbers(normalize(p.set)) : " ",
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
  const all = normalize(q).trim().split(" ").filter(Boolean);
  const required = all.filter((t) => !OPTIONAL.has(t));
  return required.length ? required : all;
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
