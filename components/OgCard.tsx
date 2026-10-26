import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { catalogue } from "@/lib/catalogue";
import { chamberPieces } from "@/lib/chamber/catalogue";

/**
 * The site's link-preview card, one for every page (app/opengraph-image.tsx): "Atlas by arco", the headline, the catalogue's
 * counts, and the staff sphere on night. The owner's pick from design/og-options (option B, revised); render.tsx there
 * draws the same card and measures it.
 */
export const OG_SIZE = { width: 1200, height: 630 };

// An old Safari user agent makes Google Fonts serve TrueType, which the image renderer needs.
const UA = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
async function font(query: string) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}`, { headers: { "User-Agent": UA } })).text();
  const urls = [...css.matchAll(/src: url\(([^)]+)\) format\('truetype'\)/g)].map((m) => m[1]);
  return (await fetch(urls[urls.length - 1])).arrayBuffer();
}

const NIGHT = "#171613";
const INK = "#ECE6DA";
const MUTED = "#A39B8D";
const GOLD = "#C99A3F";

// both sections; a duo listed in both is one work
const works = new Map([...catalogue.pieces, ...chamberPieces].map((p) => [p.id, p]));
const WORKS = works.size.toLocaleString("en");
const COMPOSERS = new Set([...works.values()].map((p) => p.composerSlug)).size.toLocaleString("en");

// Sizes measured on the rendered card (design/og-options/render.tsx): the headline's first line, "by arco" and both lines
// under the headline end on one right edge. The last line is sized to end under the comma after "composers", for counts
// of this length ("13,234 … 1,797"); a different count moves that comma by a few pixels.
const ATLAS = 150;
const LOGO_H = 48;
const HEAD = 52.36;
const TAIL = 28.6;

const dataUrl = async (path: string) => `data:image/png;base64,${(await readFile(join(process.cwd(), path))).toString("base64")}`;

export async function atlasCard() {
  const [archivo, instrument, logo, sphere] = await Promise.all([
    font("family=Archivo:wdth,wght@112,800"),
    font("family=Instrument+Sans:wght@500"),
    dataUrl("public/brand/arco-logo-dark.png"),
    dataUrl("public/brand/atlas-sphere.png"),
  ]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: NIGHT, fontFamily: "Instrument Sans", position: "relative" }}>
        {/* a faint warm light behind the sphere */}
        <div
          style={{
            position: "absolute",
            left: 616,
            top: -20,
            width: 720,
            height: 670,
            display: "flex",
            backgroundImage: "radial-gradient(circle at 50% 50%, rgba(201,154,63,.13), rgba(201,154,63,0) 62%)",
          }}
        />
        {/* the owner's artwork: five-line staves wound into a globe, works on it like cities */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sphere} width={604} height={604} style={{ position: "absolute", right: -74, top: 13 }} alt="" />

        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 0 66px 70px", width: 760 }}>
          {/* "Atlas", and "by arco" under it, hanging past the "s" to the column's right edge */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", alignSelf: "flex-start" }}>
            <div style={{ fontFamily: "Archivo", fontSize: ATLAS, lineHeight: 0.8, letterSpacing: -ATLAS * 0.035, color: INK }}>Atlas</div>
            <div style={{ display: "flex", alignItems: "center", marginTop: ATLAS * 0.07, marginRight: -25, color: MUTED, fontSize: LOGO_H * 0.62 }}>
              by
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} height={LOGO_H} width={Math.round((LOGO_H * 480) / 229)} style={{ marginLeft: LOGO_H * 0.35 }} alt="" />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", flexDirection: "column", fontFamily: "Archivo", fontSize: HEAD, lineHeight: 1.05, letterSpacing: -HEAD * 0.025, color: INK }}>
              <div>A free and open</div>
              <div>catalogue of</div>
              {/* gold, from the sphere's staves */}
              <div style={{ color: GOLD }}>classical music</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontSize: 25, lineHeight: 1.4, color: MUTED }}>
              <div style={{ display: "flex" }}>
                <span style={{ fontFamily: "Archivo", color: INK, marginRight: 8 }}>{WORKS}</span>works by
                <span style={{ fontFamily: "Archivo", color: INK, margin: "0 8px" }}>{COMPOSERS}</span>composers,
              </div>
              <div style={{ display: "flex", fontSize: TAIL }}>searchable every way you’d want</div>
            </div>
          </div>
        </div>
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
