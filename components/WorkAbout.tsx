"use client";

import { useEffect, useState } from "react";
import { isMovementList, loadDetails, programText, type WorkDetails } from "@/lib/details";
import type { PieceBase } from "@/lib/types";

type Work = PieceBase & { type?: string; settings?: string[] };

/** the work's details: given by a piece page (prerendered), or fetched once by the sheet */
function useDetails(id: number, given?: WorkDetails | null) {
  const [loaded, setLoaded] = useState<{ id: number; d: WorkDetails | null } | null>(null);
  useEffect(() => {
    if (given !== undefined) return;
    let live = true;
    loadDetails().then((all) => live && setLoaded({ id, d: all[String(id)] ?? null }));
    return () => {
      live = false;
    };
  }, [id, given]);
  return given !== undefined ? given : loaded?.id === id ? loaded.d : undefined;
}

/** When the work was composed, its dedication and first performance, and its movements (or a set's pieces), when known. */
export function WorkAbout({ piece, details }: { piece: Work; details?: WorkDetails | null }) {
  const d = useDetails(piece.id, details);
  if (!d) return null;
  const facts = (
    [
      ["Composed", d.composed],
      ["Dedicated to", d.dedication],
      ["First performed", d.firstPerformance],
    ] as const
  ).filter(([, v]) => v);
  const movements = d.movements?.length ? d.movements : null;
  if (!facts.length && !movements) return null;
  return (
    <section className="section about-work">
      <h2>About this work</h2>
      {facts.length > 0 && (
        <dl className="about-facts">
          {facts.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {movements && (
        <ol className={`movements${isMovementList(d) ? " roman" : ""}`} aria-label={isMovementList(d) ? "Movements" : "Pieces"}>
          {movements.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Copies the composer, the title as a program prints it, and the movements, ready to paste into a concert program. */
export function CopyProgram({ piece, details }: { piece: Work; details?: WorkDetails | null }) {
  const d = useDetails(piece.id, details);
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="link-underline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(programText(piece, d));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard refused (an old browser or no permission): nothing to undo
        }
      }}
    >
      {copied ? "Copied" : "Copy for program"}
    </button>
  );
}
