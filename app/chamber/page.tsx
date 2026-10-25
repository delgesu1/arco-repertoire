import type { Metadata } from "next";
import { Suspense } from "react";
import { ChamberExplorer } from "@/components/chamber/ChamberExplorer";
import { composers } from "@/lib/catalogue";
import { chamberCatalogue, chamberPieces } from "@/lib/chamber/catalogue";
import { CHAMBER_LIVE } from "@/lib/chamber/launch";
import { CHAMBER_INTRO } from "@/lib/chamber/vocab";

const TOTAL = chamberPieces.length.toLocaleString("en");

export const metadata: Metadata = {
  title: "Chamber music",
  description: `${TOTAL} graded chamber works for three to nine players, from string trios to octets, sorted by ensemble, level and character.`,
  alternates: { canonical: "/chamber" },
  // a link to /chamber previews as chamber music (the image is app/chamber/opengraph-image.tsx), not with the violin text the
  // root layout gives every page
  openGraph: {
    type: "website",
    siteName: "Arco Repertoire",
    title: `Arco Repertoire: an interactive library of ${TOTAL} graded chamber works`,
    description:
      "From string trios to octets, organized by ensemble, level and character. Tell the AI advisor who’s in your group, and it finds music you can all play.",
  },
  // hidden until launch (lib/chamber/launch.ts)
  ...(CHAMBER_LIVE ? {} : { robots: { index: false, follow: false } }),
};

// composer pages exist for the violin catalogue's composers; at launch they list chamber works too, and chamber-only composers get one
const violinComposers = new Set(composers.map((c) => c.slug));
const composerPages = [...new Set(chamberPieces.map((p) => p.composerSlug))].filter((s) => CHAMBER_LIVE || violinComposers.has(s));

export default function ChamberHome() {
  return (
    <main className="wrap">
      <h1 className="sr-only">Arco Repertoire: graded chamber music</h1>
      <Suspense fallback={<ChamberSkeleton />}>
        <ChamberExplorer
          version={chamberCatalogue.version}
          levels={chamberCatalogue.levels}
          total={chamberPieces.length}
          composerPages={composerPages}
        />
      </Suspense>
    </main>
  );
}

function ChamberSkeleton() {
  return (
    <>
      <section className="hero">
        <div className="intro">
          <div className="big">{TOTAL}</div>
          <p>{CHAMBER_INTRO}</p>
        </div>
        <div className="finder" />
      </section>
      <div className="list" style={{ marginTop: 60 }}>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton-row" />
        ))}
      </div>
    </>
  );
}
