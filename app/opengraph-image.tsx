import { OG_SIZE, atlasCard } from "@/components/OgCard";
import { OG_ALT } from "@/lib/catalogue";

// every page's preview card: the root segment's image applies to the whole site
export const alt = OG_ALT;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return atlasCard();
}
