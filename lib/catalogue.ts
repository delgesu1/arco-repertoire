import data from "../data/build/catalogue.json";
import type { Catalogue, Piece, PieceBase } from "./types";

/** Server-side access to the catalogue (static JSON import, used for prerendered pages). */
export const catalogue = data as unknown as Catalogue;
export const pieces: Piece[] = catalogue.pieces;

const byId = new Map(pieces.map((p) => [p.id, p]));
export const getPiece = (id: number | string) => byId.get(Number(id)) ?? null;

export interface ComposerInfo {
  slug: string;
  name: string; // "First Last"
  sortName: string; // "Last, First"
  dates: string;
  nationality: string;
  gender: "F" | "M" | "";
  pieces: Piece[];
}

const composerMap = new Map<string, ComposerInfo>();
for (const p of pieces) {
  let c = composerMap.get(p.composerSlug);
  if (!c) {
    c = {
      slug: p.composerSlug,
      name: p.composerName,
      sortName: p.composer,
      dates: p.dates,
      nationality: p.nationality,
      gender: p.gender,
      pieces: [],
    };
    composerMap.set(p.composerSlug, c);
  }
  c.pieces.push(p);
}
export const composers = [...composerMap.values()].sort((a, b) => a.sortName.localeCompare(b.sortName));
export const getComposer = (slug: string) => composerMap.get(slug) ?? null;

export const levelInfo = (n: number) => catalogue.levels.find((l) => l.level === n)!;

export const SITE_URL = "https://atlas.arco.app";

/** How a link to any page previews: the card (components/OgCard.tsx) and its text speak for the whole site. */
export const OG_TITLE = "Arco Atlas: a free and open catalogue of classical music";
export const OG_ALT = OG_TITLE;
export const OG_DESCRIPTION =
  "Arco Atlas is a free and open catalogue of classical music, searchable every way you’d want: by composer, level, instruments, length and character.";
export const pieceUrl = (p: PieceBase) => `/piece/${p.id}/${p.slug}`;
