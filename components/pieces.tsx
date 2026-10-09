import type { Piece } from "@/lib/types";

export const pieceHref = (p: Piece) => `/piece/${p.id}/${p.slug}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function tagList(p: Piece): { label: string; pop?: boolean }[] {
  const t: { label: string; pop?: boolean }[] = [];
  if (p.mode) t.push({ label: cap(p.mode) });
  if (p.pace && p.pace !== "moderate") t.push({ label: cap(p.pace) });
  for (const c of p.character) t.push({ label: cap(c) });
  if (p.popularity) t.push({ label: p.popularity === "well-known" ? "Well-known" : "Lesser-known", pop: true });
  return t;
}

export function LevelBadge({ level, size }: { level: number; size?: "sm" | "lg" }) {
  return (
    <span className={`lv l${level} s${level % 3}${size ? ` ${size}` : ""}`} aria-label={`Level ${level}`}>
      {level}
    </span>
  );
}

/** One pebble for a single level; a set spanning levels shows its lowest and highest as an overlapping pair. */
export function LevelPebbles({ levels }: { levels: number[] }) {
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  if (lo === hi) return <LevelBadge level={lo} />;
  return (
    <span className="pair" aria-label={`Levels ${lo} to ${hi}`}>
      <LevelBadge level={lo} />
      <LevelBadge level={hi} />
    </span>
  );
}

/** A set member's name without the set's title, key and catalogue number ("Partita No. 2: Allemanda in D minor, BWV 1004" → "Allemanda"). */
export function memberTitle(p: Piece): string {
  if (/\(complete\)/i.test(p.title)) return "Complete work";
  const i = p.title.indexOf(": ");
  if (i < 0) return p.title;
  return p.title
    .slice(i + 2)
    .replace(/\s+in [A-G](?:-flat|-sharp)? (?:major|minor)\b/, "")
    .replace(/,\s*(?:BWV|Op\.|K\.|RV|Hob\.|MS|WoO|TWV|Sz\.|D\.|S\.|L\.)\s?[^()]*/, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function durationRange(ps: Piece[]): string {
  const m = ps.map((p) => p.minutes).filter((x): x is number => x != null);
  if (!m.length) return "";
  const lo = Math.min(...m);
  const hi = Math.max(...m);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
}

export function levelRange(ps: Piece[]): string {
  const lo = Math.min(...ps.map((p) => p.level));
  const hi = Math.max(...ps.map((p) => p.level));
  return lo === hi ? `level ${lo}` : `levels ${lo}–${hi}`;
}

export const youtubeSearch = (p: Piece) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${p.composerName} ${p.title}${/violin/i.test(p.title) ? "" : " violin"}`)}`;

export const imslpSearch = (p: Piece) =>
  `https://imslp.org/index.php?title=Special:Search&search=${encodeURIComponent(`${p.composer.split(",")[0]} ${p.title}`)}`;

/** the work's own IMSLP page when we know it, otherwise a search */
export const imslpLink = (p: Piece) => (p.imslpPage ? `https://imslp.org/wiki/${encodeURIComponent(p.imslpPage.replace(/ /g, "_"))}` : imslpSearch(p));
