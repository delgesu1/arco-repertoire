import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Row } from "@/components/Row";
import { composers, getComposer } from "@/lib/catalogue";
import { compareTitle } from "@/lib/filter";
import { typeLabel } from "@/lib/vocab";
import type { TypeKey } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  return composers.map((c) => ({ slug: c.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = getComposer(slug);
  if (!c) return {};
  return {
    title: `${c.name} — violin works`,
    description: `${c.pieces.length} violin works by ${c.name}${c.dates ? ` (${c.dates})` : ""}, graded 1–10 for teachers and players.`,
    alternates: { canonical: `/composer/${c.slug}` },
  };
}

export default async function ComposerPage({ params }: Props) {
  const { slug } = await params;
  const c = getComposer(slug);
  if (!c) notFound();
  const groups = new Map<TypeKey, typeof c.pieces>();
  for (const p of [...c.pieces].sort((a, b) => a.level - b.level || compareTitle(a.title, b.title))) {
    groups.set(p.type, [...(groups.get(p.type) ?? []), p]);
  }
  const lo = Math.min(...c.pieces.map((p) => p.level));
  const hi = Math.max(...c.pieces.map((p) => p.level));
  return (
    <main className="wrap">
      <div className="page-head">
        <a className="label" href="/composers">
          ← All composers
        </a>
        <h1 style={{ marginTop: 14 }}>{c.name}</h1>
        <p>
          {[c.dates, c.nationality].filter(Boolean).join(" · ")} — {c.pieces.length} {c.pieces.length === 1 ? "work" : "works"}
          {lo === hi ? `, level ${lo}` : `, levels ${lo}–${hi}`}
        </p>
      </div>
      {[...groups.entries()].map(([type, ps]) => (
        <section key={type} style={{ marginTop: 30 }}>
          <div className="rhead">
            <h2>
              {typeLabel(type)} <span>· {ps.length}</span>
            </h2>
          </div>
          <div className="list">
            {ps.map((p) => (
              <Row key={p.id} piece={p} showComposer={false} />
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}
