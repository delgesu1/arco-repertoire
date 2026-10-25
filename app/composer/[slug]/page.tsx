import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChamberRow } from "@/components/chamber/ChamberRow";
import { Row } from "@/components/Row";
import { composers, getComposer } from "@/lib/catalogue";
import { chamberOnly, chamberWorksBy } from "@/lib/chamber/catalogue";
import { CHAMBER_LIVE } from "@/lib/chamber/launch";
import { compareTitle } from "@/lib/filter";
import { typeLabel } from "@/lib/vocab";
import type { TypeKey } from "@/lib/types";

export const dynamicParams = false;

// from the chamber section's launch (lib/chamber/launch.ts) a composer's page lists their chamber works too, and composers
// with chamber works only get a page; before it, composer pages are the violin catalogue's alone
const chamberBy = (slug: string) => (CHAMBER_LIVE ? chamberWorksBy(slug) : []);

export function generateStaticParams() {
  const slugs = new Set(composers.map((c) => c.slug));
  if (CHAMBER_LIVE) for (const p of chamberOnly) slugs.add(p.composerSlug);
  return [...slugs].map((slug) => ({ slug }));
}

type Props = { params: Promise<{ slug: string }> };

/** "1 violin work", "253 chamber works" */
const works = (n: number, kind: string) => `${n} ${kind} ${n === 1 ? "work" : "works"}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const c = getComposer(slug);
  const ch = chamberBy(slug);
  if (!c) {
    if (!ch.length) return {};
    const name = ch[0].composerName;
    return {
      title: `${name} — chamber music`,
      description: `${works(ch.length, "chamber")} by ${name}${ch[0].dates ? ` (${ch[0].dates})` : ""}, graded 1–10 for players and teachers.`,
      alternates: { canonical: `/composer/${slug}` },
    };
  }
  return {
    title: `${c.name} — ${ch.length ? "violin and chamber works" : "violin works"}`,
    description: `${works(c.pieces.length, "violin")}${ch.length ? ` and ${works(ch.length, "chamber")}` : ""} by ${c.name}${c.dates ? ` (${c.dates})` : ""}, graded 1–10 for teachers and players.`,
    alternates: { canonical: `/composer/${c.slug}` },
  };
}

export default async function ComposerPage({ params }: Props) {
  const { slug } = await params;
  const c = getComposer(slug);
  const ch = chamberBy(slug);
  if (!c) {
    if (!ch.length) notFound();
    return <ChamberOnlyComposer slug={slug} />;
  }
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
          {ch.length > 0 && ` · ${ch.length} chamber ${ch.length === 1 ? "work" : "works"}`}
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
      <ChamberWorks pieces={ch} />
    </main>
  );
}

function ChamberWorks({ pieces }: { pieces: ReturnType<typeof chamberWorksBy> }) {
  if (!pieces.length) return null;
  return (
    <section style={{ marginTop: 30 }}>
      <div className="rhead">
        <h2>
          Chamber music <span>· {pieces.length}</span>
        </h2>
      </div>
      <div className="list ch">
        {pieces.map((p) => (
          <ChamberRow key={p.id} piece={p} showComposer={false} />
        ))}
      </div>
    </section>
  );
}

function ChamberOnlyComposer({ slug }: { slug: string }) {
  const ch = chamberBy(slug);
  const p = ch[0];
  const lo = Math.min(...ch.map((x) => x.level));
  const hi = Math.max(...ch.map((x) => x.level));
  return (
    <main className="wrap">
      <div className="page-head">
        <a className="label" href="/composers">
          ← All composers
        </a>
        <h1 style={{ marginTop: 14 }}>{p.composerName}</h1>
        <p>
          {[p.dates, p.nationality].filter(Boolean).join(" · ")} — {ch.length} chamber {ch.length === 1 ? "work" : "works"}
          {lo === hi ? `, level ${lo}` : `, levels ${lo}–${hi}`}
        </p>
      </div>
      <ChamberWorks pieces={ch} />
    </main>
  );
}
