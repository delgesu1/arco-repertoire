import type { Metadata } from "next";
import { Suspense } from "react";
import { Explorer } from "@/components/Explorer";
import { smartBanner } from "@/lib/arco";
import { SITE_URL, catalogue } from "@/lib/catalogue";

export const metadata: Metadata = { other: smartBanner(SITE_URL) };

export default function Home() {
  return (
    <main className="wrap">
      <h1 className="sr-only">Arco Repertoire: graded violin repertoire</h1>
      <Suspense fallback={<HomeSkeleton />}>
        <Explorer version={catalogue.version} levels={catalogue.levels} total={catalogue.pieces.length} />
      </Suspense>
    </main>
  );
}

function HomeSkeleton() {
  return (
    <>
      <section className="hero">
        <div className="intro">
          <div className="big">{catalogue.pieces.length.toLocaleString("en")}</div>
          <p>graded works for the violin, sorted by setting, level and character.</p>
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
