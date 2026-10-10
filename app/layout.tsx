import type { Metadata, Viewport } from "next";
import { Archivo, Instrument_Sans } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Link from "next/link";
import { Suspense } from "react";
import { Brand, Header } from "@/components/Header";
import { ArcoFooter } from "@/components/ArcoFooter";
import { ArcoPeek } from "@/components/ArcoPeek";
import { InstrumentSwitcher } from "@/components/InstrumentSwitcher";
import { SITE_URL, catalogue } from "@/lib/catalogue";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-instrument", display: "swap" });

const TOTAL = catalogue.pieces.length.toLocaleString("en");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `Arco Repertoire · An interactive library of ${TOTAL} graded violin works`, template: "%s · Arco Repertoire" },
  description:
    "Organized by level, character, instrumentation and more. An AI advisor helps you discover your next piece based on what you’re already working on.",
  openGraph: {
    type: "website",
    siteName: "Arco Repertoire",
    title: `Arco Repertoire: an interactive library of ${TOTAL} graded violin works`,
    description:
      "Organized by level, character, instrumentation and more. An AI advisor helps you discover your next piece based on what you’re already working on.",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2ede3" },
    { media: "(prefers-color-scheme: dark)", color: "#171613" },
  ],
};

// theme, and the device class the Arco footer and return-visit card key off (iPad reports itself as a Mac, hence maxTouchPoints)
const themeScript = `try{var t=localStorage.getItem("theme");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=t}catch(e){}try{var u=navigator.userAgent,p="desktop";if(/iPhone|iPad|iPod/.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1))p="ios";else if(/Android/.test(u))p="android";document.documentElement.dataset.platform=p}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${instrument.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Suspense fallback={<StaticHeader />}>
          <Header />
        </Suspense>
        {children}
        <footer className="footer">
          <div className="wrap">
            <ArcoFooter />
            <nav aria-label="More">
              <Link href="/composers">Composers</Link>
              <Link href="/levels">How the levels work</Link>
            </nav>
            <p>
              Created by{" "}
              <a href="https://www.kurganov.org" target="_blank" rel="noopener">
                Daniel Kurganov
              </a>
              . Levels are teaching estimates, cross-checked against exam syllabi where a work appears on one. Recordings
              link to YouTube; scores to IMSLP.
            </p>
          </div>
        </footer>
        <Suspense fallback={null}>
          <ArcoPeek />
        </Suspense>
        <Analytics />
      </body>
    </html>
  );
}

function StaticHeader() {
  return (
    <header className="site-header">
      <div className="wrap bar">
        <div className="brand">
          <Link className="mark" href="/" aria-label="Arco Repertoire — home">
            <Brand />
          </Link>
          <InstrumentSwitcher />
        </div>
        <div className="search" />
        <div className="actions" />
      </div>
    </header>
  );
}
