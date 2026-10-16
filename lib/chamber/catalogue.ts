import data from "../../data/build/chamber.json";
import type { ChamberCatalogue, ChamberPiece } from "./types";

/** Server-side access to the chamber catalogue (static JSON import, used for prerendered pages). */
export const chamberCatalogue = data as unknown as ChamberCatalogue;
export const chamberPieces: ChamberPiece[] = chamberCatalogue.pieces;

const byId = new Map(chamberPieces.map((p) => [p.id, p]));
export const getChamberPiece = (id: number | string) => byId.get(Number(id)) ?? null;

/** the chamber works with no violin entry: they get their own piece pages (the others keep their violin page) */
export const chamberOnly = chamberPieces.filter((p) => !p.sections.includes("violin"));

/** a composer's chamber works, easiest first */
export const chamberWorksBy = (slug: string) =>
  chamberPieces.filter((p) => p.composerSlug === slug).sort((a, b) => a.level - b.level || a.title.localeCompare(b.title));
