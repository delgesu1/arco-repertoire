import { ogCard } from "@/components/OgCard";
import { chamberPieces } from "@/lib/chamber/catalogue";

export const alt = "Arco Atlas: find the perfect piece of chamber music";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    headline: "Find the perfect piece of chamber music",
    headlineSize: 80,
    headlineWidth: 980,
    line: `${chamberPieces.length.toLocaleString("en")} graded chamber works for three to nine players, with recordings, and an AI advisor that matches music to your group.`,
    sentence: [
      "Show me",
      { pick: "FULL WORKS", bg: "#30508f" },
      "for",
      { pick: "PIANO TRIO", bg: "#3f5f48" },
      "around",
      { pick: "LEVEL 5", bg: "#b4492f" },
    ],
  });
}
