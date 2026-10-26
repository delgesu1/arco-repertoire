import data from "../data/details/works.json";
import type { WorkDetails } from "./details";

const all = data as unknown as Record<string, WorkDetails & { source?: unknown; researchSources?: string[]; imslpPage?: string }>;

/** A work's details for a prerendered piece page or the advisor: null when nothing is known (the page then doesn't fetch). */
export function workDetails(id: number | string): WorkDetails | null {
  const d = all[String(id)];
  if (!d) return null;
  const { movements, kind, composed, dedication, firstPerformance, published, otherTitles } = d;
  return { movements, kind, composed, dedication, firstPerformance, published, otherTitles };
}
