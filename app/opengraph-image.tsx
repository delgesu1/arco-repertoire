import { ogCard } from "@/components/OgCard";
import { catalogue } from "@/lib/catalogue";

export const alt = "Arco Atlas: what should you play next?";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return ogCard({
    headline: "What should you play next?",
    line: `${catalogue.pieces.length.toLocaleString("en")} graded violin works, with recordings, and an AI advisor that knows every one of them.`,
    sentence: [
      "Show me",
      { pick: "CONCERTOS", bg: "#30508f" },
      "for",
      { pick: "ANY SETTING", bg: "#3f5f48" },
      "around",
      { pick: "LEVEL 5", bg: "#b4492f" },
    ],
  });
}
