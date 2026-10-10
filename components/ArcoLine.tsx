import type { Piece } from "@/lib/types";
import { arcoUrl } from "@/lib/arco";
import { ExternalIcon } from "./icons";

// the sets whose studies are listed one by one
const STUDY_SETS: Record<string, string> = {
  kreutzer: "Kreutzer",
  rode: "Rode",
  dont: "Dont",
  gavinies: "Gaviniès",
  fiorillo: "Fiorillo",
};

/** One quiet line under a piece: Arco begins after the choice of piece, with the lessons on it. */
export function ArcoLine({ piece }: { piece: Piece }) {
  const n = piece.title.match(/^(?:Étude|Caprice|Matinée) No\. (\d+)/)?.[1];
  const who = n && piece.set ? STUDY_SETS[piece.composerSlug.split("-")[0]] : undefined;
  return (
    <aside className="arco-line" aria-label="About Arco">
      <div>
        <span className="label">Arco</span>
        {who ? (
          <>
            <p className="head">
              Your teacher’s comments on {who} No. {n}, kept in Arco.
            </p>
            <p className="sub">Record the lesson and Arco writes the notes you practise from.</p>
          </>
        ) : (
          <>
            <p className="head">Working on this with a teacher?</p>
            <p className="sub">Arco turns the lesson into notes you can practise from.</p>
          </>
        )}
      </div>
      <div className="act">
        <a className="link-underline" href={arcoUrl("piece")} target="_blank" rel="noopener">
          Try Arco for free <ExternalIcon />
        </a>
      </div>
    </aside>
  );
}
