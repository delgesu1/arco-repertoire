import { ImageResponse } from "next/og";
import { createElement } from "react";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** The site's link-preview card (app/opengraph-image.tsx for the violin list, app/chamber/opengraph-image.tsx for chamber). */
export const OG_SIZE = { width: 1200, height: 630 };

// An old Safari user agent makes Google Fonts serve TrueType, which the image renderer needs.
const UA = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
async function font(query: string) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}`, { headers: { "User-Agent": UA } })).text();
  const urls = [...css.matchAll(/src: url\(([^)]+)\) format\('truetype'\)/g)].map((m) => m[1]);
  return (await fetch(urls[urls.length - 1])).arrayBuffer();
}

const INK = "#1B1A17";
const MUTED = "#6B655B";

function Pick({ label, bg }: { label: string; bg: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: bg,
        color: "#fff",
        fontFamily: "Archivo",
        fontSize: 24,
        letterSpacing: 1.5,
        padding: "9px 16px",
        margin: "0 12px",
        borderTopLeftRadius: 4,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 5,
        borderBottomLeftRadius: 9,
      }}
    >
      {label}
      <div
        style={{
          width: 9,
          height: 9,
          marginLeft: 12,
          marginTop: -5,
          borderRight: "2.5px solid rgba(255,255,255,.85)",
          borderBottom: "2.5px solid rgba(255,255,255,.85)",
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

/** a word of the finder sentence, or one of its menus ("CONCERTOS" on blue) */
export type SentencePart = string | { pick: string; bg: string };

/** The card: logo, headline, a line about the catalogue, and the finder sentence as the page shows it. */
export async function ogCard({
  headline,
  headlineSize = 92,
  line,
  sentence,
}: {
  headline: string;
  /** smaller for a longer headline, so it stays on two lines */
  headlineSize?: number;
  line: string;
  sentence: SentencePart[];
}) {
  const [archivo, instrument, logo] = await Promise.all([
    font("family=Archivo:wdth,wght@112,800"),
    font("family=Instrument+Sans:wght@500"),
    readFile(join(process.cwd(), "public/brand/arco-logo-light.png")),
  ]);
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F2EDE3",
          padding: "60px 72px 64px",
          fontFamily: "Instrument Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={126} height={60} alt="" />
          <div style={{ width: 1.5, height: 34, background: "rgba(27,26,23,.3)", margin: "6px 20px 0" }} />
          <div style={{ fontFamily: "Archivo", fontSize: 19, letterSpacing: 4.5, color: MUTED, marginTop: 6 }}>REPERTOIRE</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "Archivo", fontSize: headlineSize, lineHeight: 1, letterSpacing: -2, color: INK }}>{headline}</div>
          <div style={{ fontSize: 33, lineHeight: 1.35, color: MUTED, marginTop: 26, maxWidth: 980 }}>{line}</div>
        </div>

        {/* flat children, words as plain text: the renderer wraps "Show me" if they come as an array or in their own elements */}
        {createElement(
          "div",
          { style: { display: "flex", alignItems: "center", fontSize: 34, color: INK } },
          ...sentence.map((s, i) => (typeof s === "string" ? s : <Pick key={i} label={s.pick} bg={s.bg} />)),
        )}
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Archivo", data: archivo, weight: 800, style: "normal" },
        { name: "Instrument Sans", data: instrument, weight: 500, style: "normal" },
      ],
    },
  );
}
