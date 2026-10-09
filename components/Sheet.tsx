"use client";

import { useEffect, useRef } from "react";
import type { LevelInfo, Piece } from "@/lib/types";
import { PieceDetail } from "./PieceDetail";
import { ExternalIcon } from "./icons";
import { pieceHref } from "./pieces";

export function Sheet({
  piece,
  all,
  levels,
  autoplay,
  onClose,
  onOpen,
  onAsk,
}: {
  piece: Piece;
  all: Piece[];
  levels: LevelInfo[];
  autoplay: boolean;
  onClose: () => void;
  onOpen: (p: Piece) => void;
  onAsk?: (p: Piece) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    returnTo.current = document.activeElement;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const els = panel.current.querySelectorAll<HTMLElement>("a, button, iframe, input");
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      (returnTo.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);

  useEffect(() => {
    panel.current?.scrollTo({ top: 0 });
  }, [piece.id]);

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={piece.title} ref={panel} tabIndex={-1}>
        <div className="sheet-top">
          <a href={pieceHref(piece)}>Open as a page <ExternalIcon /></a>
          <button className="close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <PieceDetail piece={piece} all={all} levels={levels} onOpen={onOpen} onAsk={onAsk} autoplay={autoplay} />
      </div>
    </>
  );
}
