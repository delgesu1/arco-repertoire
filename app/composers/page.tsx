import type { Metadata } from "next";
import { composers } from "@/lib/catalogue";
import { chamberOnly } from "@/lib/chamber/catalogue";
import { CHAMBER_LIVE } from "@/lib/chamber/launch";

export const metadata: Metadata = {
  title: "Composers",
  description: "Every composer in Arco Repertoire, with their graded violin works.",
  alternates: { canonical: "/composers" },
};

type Entry = { slug: string; sortName: string; gender: string; levels: number[] };

/** the violin catalogue's composers; from the chamber section's launch, its works and composers too */
function entries(): Entry[] {
  const m = new Map<string, Entry>(
    composers.map((c) => [c.slug, { slug: c.slug, sortName: c.sortName, gender: c.gender, levels: c.pieces.map((p) => p.level) }]),
  );
  if (CHAMBER_LIVE)
    for (const p of chamberOnly) {
      const e = m.get(p.composerSlug) ?? { slug: p.composerSlug, sortName: p.composer, gender: p.gender, levels: [] };
      e.levels.push(p.level);
      m.set(e.slug, e);
    }
  return [...m.values()].sort((a, b) => a.sortName.localeCompare(b.sortName));
}

export default function ComposersPage() {
  const all = entries();
  const byLetter = new Map<string, Entry[]>();
  for (const c of all) {
    const k = c.sortName.normalize("NFKD").charAt(0).toUpperCase();
    byLetter.set(k, [...(byLetter.get(k) ?? []), c]);
  }
  return (
    <main className="wrap">
      <div className="page-head">
        <h1>Composers</h1>
        <p>
          {all.length} composers, {all.filter((c) => c.gender === "F").length} of them women.
        </p>
      </div>
      <div className="composer-index">
        {[...byLetter.entries()].map(([letter, cs]) => (
          <section key={letter}>
            <h2 className="label">{letter}</h2>
            <ul>
              {cs.map((c) => {
                const lo = Math.min(...c.levels);
                const hi = Math.max(...c.levels);
                return (
                  <li key={c.slug}>
                    <a href={`/composer/${c.slug}`}>{c.sortName}</a>
                    <span>
                      {c.levels.length} · {lo === hi ? `L${lo}` : `L${lo}–${hi}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
