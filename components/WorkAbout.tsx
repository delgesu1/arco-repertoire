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

/**
 * About this work: the note on it, when it was composed, its dedication and first performance, and its movements (or a set's
 * pieces), when known, then "Copy for program" for what is above. A work with none of these still gets the button.
 */
export function WorkAbout({ piece, details, notes }: { piece: Work; details?: WorkDetails | null; notes?: string }) {
  const d = useDetails(piece.id, details);
  const facts = (
    [
      ["Composed", d?.composed],
      ["Dedicated to", d?.dedication],
      ["First performed", d?.firstPerformance],
    ] as const
  ).filter(([, v]) => v);
  const movements = d?.movements?.length ? d.movements : null;
  return (
    <section className="section about-work">
      {(notes || facts.length > 0 || movements) && <h2>About this work</h2>}
      {notes && <p>{notes}</p>}
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
      {movements && d && (
        <ol className={`movements${isMovementList(d) ? " roman" : ""}`} aria-label={isMovementList(d) ? "Movements" : "Pieces"}>
          {movements.map((m, i) => (
            <li key={i}>{m}</li>
          ))}
        </ol>
      )}
      <div className="copy-program">
        <CopyProgram piece={piece} details={details} />
        <span>Composer, title and movements, ready to paste into a program.</span>
      </div>
    </section>
  );
}

/** Copies the composer, the title as a program prints it, and the movements, ready to paste into a concert program. */
export function CopyProgram({ piece, details }: { piece: Work; details?: WorkDetails | null }) {
  const d = useDetails(piece.id, details);
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="dbtn small"
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
      <svg className="copy-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="5.5" y="5.5" width="8" height="8.5" rx="1.4" />
        <path d="M10.5 3.5v-.4A1.1 1.1 0 0 0 9.4 2H3.6A1.1 1.1 0 0 0 2.5 3.1v6.8A1.1 1.1 0 0 0 3.6 11H4" />
      </svg>
      {copied ? "Copied" : "Copy for program"}
    </button>
  );
}
