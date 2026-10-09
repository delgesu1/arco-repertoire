import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { catalogue } from "@/lib/catalogue";

export const alt = "Arco Repertoire: what should you play next?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

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

export default async function Image() {
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
          <div style={{ fontFamily: "Archivo", fontSize: 92, lineHeight: 1, letterSpacing: -2, color: INK }}>
            What should you play next?
          </div>
          <div style={{ fontSize: 33, lineHeight: 1.35, color: MUTED, marginTop: 26, maxWidth: 980 }}>
            {`${catalogue.pieces.length.toLocaleString("en")} graded violin works, with recordings, and an AI advisor that knows every one of them.`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", fontSize: 34, color: INK }}>
          Show me
          <Pick label="CONCERTOS" bg="#30508f" />
          for
          <Pick label="ANY SETTING" bg="#3f5f48" />
          around
          <Pick label="LEVEL 5" bg="#b4492f" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Archivo", data: archivo, weight: 800, style: "normal" },
        { name: "Instrument Sans", data: instrument, weight: 500, style: "normal" },
      ],
    },
  );
}
