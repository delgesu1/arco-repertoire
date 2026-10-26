import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { ChamberDetail } from "@/components/chamber/ChamberDetail";
import { PieceDetail } from "@/components/PieceDetail";
import { smartBanner } from "@/lib/arco";
import { catalogue, composers, getPiece, levelInfo, OG_ALT, pieceUrl, pieces, SITE_URL } from "@/lib/catalogue";
import { chamberOnly, chamberPieces, getChamberPiece } from "@/lib/chamber/catalogue";
import { CHAMBER_LIVE } from "@/lib/chamber/launch";
import { workDetails } from "@/lib/details-server";
import type { ChamberPiece } from "@/lib/chamber/types";
import { formationSingular, instrumentList } from "@/lib/chamber/vocab";
import { settingLabel, typeSingular } from "@/lib/vocab";

export const dynamicParams = false;

// chamber works that are also violin works keep their violin page; the others (ids from 100001) get one of their own
export function generateStaticParams() {
  return [...pieces, ...chamberOnly].map((p) => ({ id: String(p.id), slug: p.slug }));
}

type Props = { params: Promise<{ id: string; slug: string }> };

const violinComposers = new Set(composers.map((c) => c.slug));
// a page that sets its own openGraph loses the root segment's card, so piece pages name it (app/opengraph-image.tsx)
const OG_IMAGE = { url: "/opengraph-image", width: 1200, height: 630, alt: OG_ALT };

function chamberMetadata(p: ChamberPiece): Metadata {
  const l = levelInfo(p.level);
  const c = p.chamber;
  const part = c.hardestPart === "balanced" ? "" : `, for the ${c.hardestPart} part`;
  const description = `${p.composerName}: ${p.title}. ${formationSingular(c.formation)}: ${instrumentList(c.instruments, c)}. Level ${p.level} (${l.name}, about ${l.exam})${part}${p.minutes ? `, about ${p.minutes} minutes` : ""}.${p.notes ? ` ${p.notes}` : ""}`;
  return {
    title: `${p.title} — ${p.composerName}`,
    description,
    alternates: { canonical: pieceUrl(p) },
    openGraph: { title: `${p.composerName}: ${p.title}`, description, images: [OG_IMAGE] },
    other: smartBanner(`${SITE_URL}${pieceUrl(p)}`),
    // hidden if the section is switched off (lib/chamber/launch.ts)
    ...(CHAMBER_LIVE ? {} : { robots: { index: false, follow: false } }),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = getPiece(id);
  if (!p) {
    const cp = getChamberPiece(id);
    return cp ? chamberMetadata(cp) : {};
  }
  const l = levelInfo(p.level);
  const description = `${p.composerName}: ${p.title}. ${typeSingular(p.type)}, ${settingLabel(p.settings[0]).toLowerCase()}. Level ${p.level} (${l.name}, about ${l.exam})${p.minutes ? `, about ${p.minutes} minutes` : ""}.${p.notes ? ` ${p.notes}` : ""}`;
  return {
    title: `${p.title} — ${p.composerName}`,
    description,
    alternates: { canonical: pieceUrl(p) },
    openGraph: { title: `${p.composerName}: ${p.title}`, description, images: [OG_IMAGE] },
    other: smartBanner(`${SITE_URL}${pieceUrl(p)}`),
  };
}

export default async function PiecePage({ params }: Props) {
  const { id, slug } = await params;
  const p = getPiece(id);
  if (!p) return <ChamberPiecePage id={id} slug={slug} />;
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
        <Link className="label" href="/violin">
          ← All repertoire
        </Link>
        <PieceDetail piece={p} all={pieces} levels={catalogue.levels} details={workDetails(p.id)} />
      </div>
    </main>
  );
}

function ChamberPiecePage({ id, slug }: { id: string; slug: string }) {
  const p = getChamberPiece(id);
  if (!p) notFound();
  if (slug !== p.slug) permanentRedirect(pieceUrl(p));

  const ld = {
    "@context": "https://schema.org",
    "@type": "MusicComposition",
    name: p.title,
    composer: { "@type": "Person", name: p.composerName },
    url: `${SITE_URL}${pieceUrl(p)}`,
    genre: formationSingular(p.chamber.formation),
    ...(p.chamber.aka?.length ? { alternateName: p.chamber.aka } : {}),
    ...(p.minutes ? { timeRequired: `PT${p.minutes}M` } : {}),
    ...(p.mode && /\bin [A-G]/.test(p.title) ? { musicalKey: p.title.match(/in ([A-G](?:-flat|-sharp)? (?:major|minor))/)?.[1] } : {}),
  };

  return (
    <main className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <div className="page-detail">
        <Link className="label" href="/chamber">
          ← Chamber music
        </Link>
        <ChamberDetail
          piece={p}
          all={chamberPieces}
          levels={catalogue.levels}
          composerLink={CHAMBER_LIVE || violinComposers.has(p.composerSlug)}
          details={workDetails(p.id)}
        />
      </div>
    </main>
  );
}
