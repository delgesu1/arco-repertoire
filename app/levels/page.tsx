import type { Metadata } from "next";
import { LevelBadge } from "@/components/pieces";
import { catalogue, pieces } from "@/lib/catalogue";

export const metadata: Metadata = {
  title: "How the levels work",
  description: "The 10 difficulty levels used in Arco Repertoire and their approximate exam equivalents.",
  alternates: { canonical: "/levels" },
};

export default function LevelsPage() {
  const counts = new Map<number, number>();
  for (const p of pieces) counts.set(p.level, (counts.get(p.level) ?? 0) + 1);
  return (
    <main className="wrap">
      <div className="page-head">
        <h1>How the levels work</h1>
        <p style={{ maxWidth: "62ch" }}>
          Every work is graded from 1 (early intermediate) to 10 (extreme virtuoso). {catalogue.levelNote} Beginner
          material and method books are not included.
        </p>
      </div>
      <div className="level-table">
        {catalogue.levels.map((l) => (
          <div key={l.level}>
            <LevelBadge level={l.level} />
            <b>{l.name}</b>
            <span>About {l.exam}</span>
            <a className="link-underline" href={`/?lv=${l.level}&exact=1`}>
              {counts.get(l.level) ?? 0} works
            </a>
          </div>
        ))}
      </div>
    </main>
  );
}
