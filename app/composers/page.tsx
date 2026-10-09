import type { Metadata } from "next";
import { composers } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "Composers",
  description: "Every composer in Arco Repertoire, with their graded violin works.",
  alternates: { canonical: "/composers" },
};

export default function ComposersPage() {
  const byLetter = new Map<string, typeof composers>();
  for (const c of composers) {
    const k = c.sortName.normalize("NFKD").charAt(0).toUpperCase();
    byLetter.set(k, [...(byLetter.get(k) ?? []), c]);
  }
  return (
    <main className="wrap">
      <div className="page-head">
        <h1>Composers</h1>
        <p>
          {composers.length} composers, {composers.filter((c) => c.gender === "F").length} of them women.
        </p>
      </div>
      <div className="composer-index">
        {[...byLetter.entries()].map(([letter, cs]) => (
          <section key={letter}>
            <h2 className="label">{letter}</h2>
            <ul>
              {cs.map((c) => {
                const lo = Math.min(...c.pieces.map((p) => p.level));
                const hi = Math.max(...c.pieces.map((p) => p.level));
                return (
                  <li key={c.slug}>
                    <a href={`/composer/${c.slug}`}>{c.sortName}</a>
                    <span>
                      {c.pieces.length} · {lo === hi ? `L${lo}` : `L${lo}–${hi}`}
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
