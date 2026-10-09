import data from "../data/build/catalogue.json";
import type { Catalogue, Piece } from "./types";

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

export const SITE_URL = "https://repertoire.arco.app";
export const pieceUrl = (p: Piece) => `/piece/${p.id}/${p.slug}`;
