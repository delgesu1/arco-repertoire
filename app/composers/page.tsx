import type { Metadata } from "next";
import { composers } from "@/lib/catalogue";
import { chamberOnly } from "@/lib/chamber/catalogue";
import { CHAMBER_LIVE } from "@/lib/chamber/launch";

export const metadata: Metadata = {
  title: "Composers",
  description: "Every composer in Arco Atlas, with their graded violin works.",
  alternates: { canonical: "/composers" },
};

type Entry = { slug: string; sortName: string; gender: string; violin: number; chamber: number };

/** the violin catalogue's composers; from the chamber section's launch, its works and composers too */
function entries(): Entry[] {
  const m = new Map<string, Entry>(
    composers.map((c) => [
      c.slug,
      { slug: c.slug, sortName: c.sortName, gender: c.gender, violin: c.pieces.length, chamber: 0 },
    ]),
  );
  if (CHAMBER_LIVE)
    for (const p of chamberOnly) {
      const e = m.get(p.composerSlug) ?? { slug: p.composerSlug, sortName: p.composer, gender: p.gender, violin: 0, chamber: 0 };
      e.chamber++;
      m.set(e.slug, e);
    }
  return [...m.values()].sort((a, b) => a.sortName.localeCompare(b.sortName));
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** "12 violin · 3 chamber": what the composer has in each section */
const counts = (e: Entry) =>
  [e.violin && `${e.violin} violin`, e.chamber && `${e.chamber} chamber`].filter(Boolean).join(" · ");

export default function ComposersPage() {
  const all = entries();
  const byLetter = new Map<string, Entry[]>();
  for (const c of all) {
    const k = c.sortName.normalize("NFKD").charAt(0).toUpperCase();
    byLetter.set(k, [...(byLetter.get(k) ?? []), c]);
  }
  // A to Z, each linked when someone starts with it; a name beginning with anything else gets its own stop at the end
  const jump = [...ALPHABET, ...[...byLetter.keys()].filter((k) => !ALPHABET.includes(k))];
  return (
    <main className="wrap">
      <div className="page-head">
        <h1>Composers</h1>
        <p>
          {all.length} composers, {all.filter((c) => c.gender === "F").length} of them women.
        </p>
      </div>
      <nav className="letter-jump" aria-label="Jump to a letter">
        {jump.map((k) =>
          byLetter.has(k) ? (
            <a key={k} href={`#letter-${k}`}>
              {k}
            </a>
          ) : (
            <span key={k} aria-hidden="true">
              {k}
            </span>
          ),
        )}
      </nav>
      <div className="composer-index">
        {[...byLetter.entries()].map(([letter, cs]) => (
          <section key={letter} id={`letter-${letter}`}>
            <h2 className="label">{letter}</h2>
            <ul>
              {cs.map((c) => (
                <li key={c.slug}>
                  <a href={`/composer/${c.slug}`}>{c.sortName}</a>
                  <span>{counts(c)}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
