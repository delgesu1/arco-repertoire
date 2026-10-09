import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { PieceDetail } from "@/components/PieceDetail";
import { catalogue, getPiece, levelInfo, pieceUrl, pieces, SITE_URL } from "@/lib/catalogue";
import { settingLabel, typeSingular } from "@/lib/vocab";

export const dynamicParams = false;

export function generateStaticParams() {
  return pieces.map((p) => ({ id: String(p.id), slug: p.slug }));
}

type Props = { params: Promise<{ id: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = getPiece(id);
  if (!p) return {};
  const l = levelInfo(p.level);
  const description = `${p.composerName}: ${p.title}. ${typeSingular(p.type)}, ${settingLabel(p.settings[0]).toLowerCase()}. Level ${p.level} (${l.name}, about ${l.exam})${p.minutes ? `, about ${p.minutes} minutes` : ""}.${p.notes ? ` ${p.notes}` : ""}`;
  return {
    title: `${p.title} — ${p.composerName}`,
    description,
    alternates: { canonical: pieceUrl(p) },
    openGraph: { title: `${p.composerName}: ${p.title}`, description },
  };
}

export default async function PiecePage({ params }: Props) {
  const { id, slug } = await params;
  const p = getPiece(id);
  if (!p) notFound();
  if (slug !== p.slug) permanentRedirect(pieceUrl(p));

  const ld = {
    "@context": "https://schema.org",
    "@type": "MusicComposition",
    name: p.title,
    composer: { "@type": "Person", name: p.composerName },
    url: `${SITE_URL}${pieceUrl(p)}`,
    genre: typeSingular(p.type),
    ...(p.minutes ? { timeRequired: `PT${p.minutes}M` } : {}),
    ...(p.mode && /\bin [A-G]/.test(p.title) ? { musicalKey: p.title.match(/in ([A-G](?:-flat|-sharp)? (?:major|minor))/)?.[1] } : {}),
  };

  return (
    <main className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="page-detail">
        <Link className="label" href="/">
          ← All repertoire
        </Link>
        <PieceDetail piece={p} all={pieces} levels={catalogue.levels} />
      </div>
    </main>
  );
}
