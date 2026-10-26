/**
 * Three options for the site's link-preview card, rendered with the same engine as app/opengraph-image.tsx (next/og),
 * so each PNG is what would ship.
 *     npx tsx design/og-options/render.tsx   → design/og-options/{a,b,c}.png
 */
import { ImageResponse } from "next/og";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";

const ROOT = join(__dirname, "../..");
const OUT = __dirname;
const W = 1200;
const H = 630;

const UA = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
async function font(query: string) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?${query}`, { headers: { "User-Agent": UA } })).text();
  const urls = [...css.matchAll(/src: url\(([^)]+)\) format\('truetype'\)/g)].map((m) => m[1]);
  return (await fetch(urls[urls.length - 1])).arrayBuffer();
}

const LINEN = "#F2EDE3";
const INK = "#1B1A17";
const MUTED = "#6B655B";
const NIGHT = "#171613";
const NIGHT_INK = "#ECE6DA";
const NIGHT_MUTED = "#A39B8D";
const COBALT = "#30508F";
const SAGE = "#3F5F48";
const TERRA = "#B4492F";
const OCHRE = "#C99A3F";

// ---- the catalogue: both sections, a duo listed in both counted once
type P = { id: number; composerName: string; dates?: string; era?: string };
const pieces: P[] = [
  ...JSON.parse(readFileSync(join(ROOT, "public/data/catalogue.json"), "utf8")).pieces,
  ...JSON.parse(readFileSync(join(ROOT, "public/data/chamber.json"), "utf8")).pieces,
];
const unique = [...new Map(pieces.map((p) => [p.id, p])).values()];
const WORKS = unique.length.toLocaleString("en");
const COMPOSERS = new Set(unique.map((p) => p.composerName)).size.toLocaleString("en");

const logo = (name: "light" | "dark") =>
  `data:image/png;base64,${readFileSync(join(ROOT, `public/brand/arco-logo-${name}.png`)).toString("base64")}`;
const svg = (s: string) => `data:image/svg+xml;base64,${Buffer.from(s).toString("base64")}`;

const HEADLINE = "A free and open catalogue of classical music";

function Wordmark({
  size,
  color,
  by,
  logoSrc,
  byScale = 0.2,
  stack = false,
}: {
  size: number;
  color: string;
  by: string;
  logoSrc: string;
  byScale?: number;
  /** "by arco" under the name, towards its right end and hanging a little past it, instead of beside it */
  stack?: boolean;
}) {
  const logoH = Math.round(size * byScale);
  if (stack)
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", alignSelf: "flex-start" }}>
        <div style={{ fontFamily: "Archivo", fontSize: size, lineHeight: 0.8, letterSpacing: -size * 0.035, color }}>Atlas</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: size * 0.07, marginRight: -size * BY_HANG, color: by, fontSize: logoH * 0.62 }}>
          by
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} height={logoH} width={Math.round((logoH * 480) / 229)} style={{ marginLeft: logoH * 0.35 }} alt="" />
        </div>
      </div>
    );
  return (
    <div style={{ display: "flex", alignItems: "flex-end" }}>
      <div style={{ fontFamily: "Archivo", fontSize: size, lineHeight: 0.8, letterSpacing: -size * 0.035, color }}>Atlas</div>
      <div style={{ display: "flex", alignItems: "center", marginLeft: size * (byScale > 0.2 ? 0.1 : 0.12), marginBottom: size * 0.01, color: by, fontSize: logoH * 0.62 }}>
        by
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} height={logoH} width={Math.round((logoH * 480) / 229)} style={{ marginLeft: logoH * 0.35 }} alt="" />
      </div>
    </div>
  );
}

function Chip({ label, bg }: { label: string; bg: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        background: bg,
        color: "#FFFAF2",
        fontFamily: "Archivo",
        fontSize: 21,
        letterSpacing: 1.6,
        padding: "9px 15px 8px",
        marginRight: 12,
        borderTopLeftRadius: 4,
        borderTopRightRadius: 10,
        borderBottomRightRadius: 5,
        borderBottomLeftRadius: 9,
      }}
    >
      {label}
    </div>
  );
}

// ---- A: the wordmark, with the finder's own menus as the ways to search
function A() {
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", justifyContent: "space-between", background: LINEN, padding: "62px 76px 64px", fontFamily: "Instrument Sans" }}>
      <Wordmark size={250} color={INK} by={MUTED} logoSrc={logo("light")} />
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Archivo", fontSize: 60, lineHeight: 1.04, letterSpacing: -1.5, color: INK, maxWidth: 900 }}>{HEADLINE}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 34, fontSize: 25, color: MUTED }}>
          <div style={{ marginRight: 16 }}>Search by</div>
          <Chip label="COMPOSER" bg={COBALT} />
          <Chip label="INSTRUMENTS" bg={SAGE} />
          <Chip label="LEVEL" bg={TERRA} />
          <Chip label="LENGTH" bg={OCHRE} />
          <Chip label="MOOD" bg={INK} />
        </div>
      </div>
      <div style={{ position: "absolute", right: 76, top: 92, display: "flex", flexDirection: "column", alignItems: "flex-end", color: MUTED, fontSize: 24, lineHeight: 1.35 }}>
        <div style={{ display: "flex" }}>
          <span style={{ fontFamily: "Archivo", color: INK, marginRight: 9 }}>{WORKS}</span> works
        </div>
        <div style={{ display: "flex" }}>
          <span style={{ fontFamily: "Archivo", color: INK, marginRight: 9 }}>{COMPOSERS}</span> composers
        </div>
      </div>
    </div>
  );
}

// ---- B: night, a globe whose latitudes are a staff, works placed on it like cities
function globe() {
  const r = 250;
  const c = 270;
  const lines: string[] = [];
  for (const rx of [r, r * 0.82, r * 0.56, r * 0.22]) lines.push(`<ellipse cx="${c}" cy="${c}" rx="${rx}" ry="${r}" fill="none" stroke="rgba(236,230,218,.16)" stroke-width="1.5"/>`);
  // the staff: five latitudes across the middle
  const gap = 34;
  for (let i = -2; i <= 2; i++) {
    const y = c + i * gap;
    const half = Math.sqrt(r * r - (y - c) ** 2);
    lines.push(`<line x1="${c - half}" y1="${y}" x2="${c + half}" y2="${y}" stroke="rgba(236,230,218,.55)" stroke-width="2"/>`);
  }
  for (const y of [c - 170, c + 170]) {
    const half = Math.sqrt(r * r - (y - c) ** 2);
    lines.push(`<line x1="${c - half}" y1="${y}" x2="${c + half}" y2="${y}" stroke="rgba(236,230,218,.16)" stroke-width="1.5"/>`);
  }
  // notes as cities, joined by a route
  const notes: [number, number, string][] = [
    [c - 170, c + gap, "#D9714F"],
    [c - 85, c - gap * 0.5, "#C99A3F"],
    [c + 5, c + gap * 1.5, "#6F8FD0"],
    [c + 95, c - gap, "#8FA77E"],
    [c + 175, c, "#D9714F"],
  ];
  const route = notes.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
  lines.push(`<path d="${route}" fill="none" stroke="rgba(236,230,218,.45)" stroke-width="1.6" stroke-dasharray="5 7"/>`);
  for (const [x, y, col] of notes) {
    lines.push(`<ellipse cx="${x}" cy="${y}" rx="19" ry="14" transform="rotate(-22 ${x} ${y})" fill="${col}"/>`);
    lines.push(`<circle cx="${x}" cy="${y}" r="32" fill="none" stroke="${col}" stroke-opacity=".35" stroke-width="1.5"/>`);
  }
  lines.unshift(`<circle cx="${c}" cy="${c}" r="${r}" fill="#1F1E1A" stroke="rgba(236,230,218,.3)" stroke-width="2"/>`);
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${c * 2}" height="${c * 2}" viewBox="0 0 ${c * 2} ${c * 2}">${lines.join("")}</svg>`);
}

// the sphere: five-line staves wound into a globe, works on it like cities (the owner's artwork)
const SPHERE = `data:image/png;base64,${readFileSync(join(ROOT, "public/brand/atlas-sphere.png")).toString("base64")}`;
const TAIL = Number(process.env.TAIL ?? 37.69);
const HEAD = Number(process.env.HEAD ?? 52.36);
// the counts line under the headline; the last line is sized (TAIL) to end under its comma
const SUB = Number(process.env.SUB ?? 33);
// the bottom margin: a bigger counts line takes it from here, so the headline keeps its place under "by arco"
const PAD_B = Number(process.env.PAD_B ?? 44);
const ATLAS = Number(process.env.ATLAS ?? 150);
// "by arco" hangs past the name, to end where the headline and the lines under it end
const BY_HANG = 25 / ATLAS;
const GOLD = process.env.GOLD ?? "#C99A3F";

function B() {
  return (
    <div style={{ width: W, height: H, display: "flex", background: NIGHT, fontFamily: "Instrument Sans", position: "relative" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/* a faint warm light behind the sphere */}
      <div style={{ position: "absolute", left: 616, top: -20, width: 720, height: 670, display: "flex", backgroundImage: "radial-gradient(circle at 50% 50%, rgba(201,154,63,.13), rgba(201,154,63,0) 62%)" }} />
      <img src={SPHERE} width={604} height={604} style={{ position: "absolute", right: -74, top: 13 }} alt="" />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: `70px 0 ${PAD_B}px 70px`, width: 760 }}>
        {/* "by arco" keeps its size (the logo 48px high) as the name shrinks */}
        <Wordmark size={ATLAS} color={NIGHT_INK} by={NIGHT_MUTED} logoSrc={logo("dark")} byScale={48 / ATLAS} stack />
        <div style={{ display: "flex", flexDirection: "column" }}>
          {/* sized so its longest line ends with the lines under it */}
          <div style={{ display: "flex", flexDirection: "column", fontFamily: "Archivo", fontSize: HEAD, lineHeight: 1.05, letterSpacing: -HEAD * 0.025, color: NIGHT_INK }}>
            <div>A free and open</div>
            <div>catalogue of</div>
            {/* gold, from the sphere's staves */}
            <div style={{ color: GOLD }}>classical music</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 26, fontSize: SUB, lineHeight: 1.4, color: NIGHT_MUTED }}>
            <div style={{ display: "flex" }}>
              <span style={{ fontFamily: "Archivo", color: NIGHT_INK, marginRight: SUB * 0.32 }}>{WORKS}</span>works by
              <span style={{ fontFamily: "Archivo", color: NIGHT_INK, margin: `0 ${SUB * 0.32}px` }}>{COMPOSERS}</span>composers,
            </div>
            {/* sized so it ends under the comma after "composers" */}
            <div style={{ display: "flex", fontSize: TAIL }}>searchable every way you’d want</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- C: the catalogue's skyline, every work by its composer's birth year
const ERA_COLOR: Record<string, string> = {
  baroque: TERRA,
  classical: OCHRE,
  "early-romantic": "#6E7F5E",
  "late-romantic": SAGE,
  "20th-century": COBALT,
  contemporary: INK,
};
function skyline(width: number, height: number) {
  const from = 1600;
  const to = 1995;
  const step = 5;
  const bins = new Map<number, { n: number; eras: Map<string, number> }>();
  for (const p of unique) {
    const y = Number(/(\d{4})/.exec(p.dates ?? "")?.[1]);
    if (!y || y < from || y >= to + step) continue;
    const k = Math.floor(y / step) * step;
    const b = bins.get(k) ?? { n: 0, eras: new Map() };
    b.n++;
    if (p.era) b.eras.set(p.era, (b.eras.get(p.era) ?? 0) + 1);
    bins.set(k, b);
  }
  const keys = [];
  for (let k = from; k <= to; k += step) keys.push(k);
  const max = Math.max(...keys.map((k) => bins.get(k)?.n ?? 0));
  const slot = width / keys.length;
  const bars = keys.map((k, i) => {
    const b = bins.get(k);
    const h = b ? Math.max(3, (b.n / max) * height) : 0;
    const era = b ? [...b.eras].sort((x, y) => y[1] - x[1])[0]?.[0] : "";
    return `<rect x="${(i * slot + 1.5).toFixed(1)}" y="${(height - h).toFixed(1)}" width="${(slot - 3).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${ERA_COLOR[era ?? ""] ?? MUTED}"/>`;
  });
  return svg(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars.join("")}</svg>`);
}

function C() {
  const chartW = 1048;
  const years = ["1600", "1700", "1800", "1900", "2000"];
  return (
    <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: LINEN, padding: "64px 76px 40px", fontFamily: "Instrument Sans" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Wordmark size={176} color={INK} by={MUTED} logoSrc={logo("light")} />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", color: MUTED, fontSize: 24, lineHeight: 1.35, marginTop: 10 }}>
          <div style={{ display: "flex" }}>
            <span style={{ fontFamily: "Archivo", color: INK, marginRight: 9 }}>{WORKS}</span> works
          </div>
          <div style={{ display: "flex" }}>
            <span style={{ fontFamily: "Archivo", color: INK, marginRight: 9 }}>{COMPOSERS}</span> composers
          </div>
        </div>
      </div>
      <div style={{ fontFamily: "Archivo", fontSize: 52, lineHeight: 1.05, letterSpacing: -1.3, color: INK, marginTop: 30, maxWidth: 1000 }}>{HEADLINE}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <div style={{ display: "flex", fontSize: 18, color: MUTED, marginBottom: 10 }}>Every work in Atlas, by the year its composer was born</div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={skyline(chartW, 150)} width={chartW} height={150} alt="" />
        <div style={{ height: 2, background: INK, opacity: 0.8 }} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 18, color: MUTED }}>
          {years.map((y) => (
            <div key={y}>{y}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

async function main() {
  const [archivo, instrument] = await Promise.all([font("family=Archivo:wdth,wght@112,800"), font("family=Instrument+Sans:wght@500")]);
  const fonts = [
    { name: "Archivo", data: archivo, weight: 800 as const, style: "normal" as const },
    { name: "Instrument Sans", data: instrument, weight: 500 as const, style: "normal" as const },
  ];
  const options: [string, () => ReactElement][] = [
    ["a", A],
    ["b", B],
    ["c", C],
  ];
  // ONLY=b renders one option; NAME=b2 writes it under another name (a variant beside the chosen card)
  for (const [name, el] of options.filter(([n]) => !process.env.ONLY || n === process.env.ONLY)) {
    const res = new ImageResponse(el(), { width: W, height: H, fonts });
    writeFileSync(join(OUT, `${process.env.NAME ?? name}.png`), Buffer.from(await res.arrayBuffer()));
    console.log(`${name}.png`);
  }
  console.log(`${WORKS} works, ${COMPOSERS} composers`);
}

main();
