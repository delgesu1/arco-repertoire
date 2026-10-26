import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/Explorer";
import { smartBanner } from "@/lib/arco";
import { SITE_URL, catalogue } from "@/lib/catalogue";
import { Ledger } from "@/components/Ledger";
import { INTRO } from "@/lib/vocab";

const COMPOSERS = new Set(catalogue.pieces.map((p) => p.composer)).size;
const TOTAL = catalogue.pieces.length.toLocaleString("en");

// the violin list (the site's address, /, opens the chamber section)
export const metadata: Metadata = {
  title: { absolute: `Arco Atlas · An interactive library of ${TOTAL} graded violin works` },
  description:
    "Organized by level, character, instrumentation and more. An AI advisor helps you discover your next piece based on what you’re already working on.",
  alternates: { canonical: "/violin" },
  other: smartBanner(`${SITE_URL}/violin`),
};

export default function Home() {
  return (
    <main className="wrap">
      <h1 className="sr-only">Arco Atlas: graded violin repertoire</h1>
      <Suspense fallback={<HomeSkeleton />}>
        <Explorer version={catalogue.version} levels={catalogue.levels} total={catalogue.pieces.length} composers={COMPOSERS} />
      </Suspense>
    </main>
  );
}

function HomeSkeleton() {
  return (
    <>
      <section className="hero">
        <Ledger works={catalogue.pieces.length} label="graded works" composers={COMPOSERS} intro={INTRO} />
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
