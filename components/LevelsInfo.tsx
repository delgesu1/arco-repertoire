"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelInfo } from "@/lib/types";
import { LevelBadge } from "./pieces";
import { isPlainClick } from "./Row";

const NOTE =
  "Each work is graded as a whole, from early intermediate to extreme virtuoso. Levels are teaching estimates, cross-checked against exam syllabi; single movements often sit lower than the complete work.";

/** "How the 10 levels work": a small popover with the scale; picking a level filters to it. A section may say what a level means there. */
export function LevelsInfo({ levels, onPick, note = NOTE }: { levels: LevelInfo[]; onPick: (level: number) => void; note?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <span className="levels-info" ref={ref}>
      <a
        className="link-underline"
        href="/levels"
        aria-expanded={open}
        onClick={(e) => {
          if (!isPlainClick(e)) return;
          e.preventDefault();
          setOpen(!open);
        }}
      >
        How the 10 levels work
      </a>
      {open && (
        <div className="levels-pop" role="dialog" aria-label="How the levels work">
          <p>{note}</p>
          <ol>
            {levels.map((l) => (
              <li key={l.level}>
                <button
                  onClick={() => {
                    onPick(l.level);
                    setOpen(false);
                  }}
                >
                  <LevelBadge level={l.level} size="sm" />
                  <b>{l.name}</b>
                  <span className="exam">{l.exam}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </span>
  );
}
