"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CHAMBER_LIVE, isChamberPath } from "@/lib/chamber/launch";

const SOON = ["Viola", "Cello", "Double bass", "Piano", "Flute", "Guitar"];

const Check = () => (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * One list: chamber music first, then violin and the instruments still to come. Until the chamber section launches
 * (lib/chamber/launch.ts) the violin pages keep the menu without it; the chamber pages already show it.
 */
export function InstrumentSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const chamber = isChamberPath(usePathname() ?? "/");
  const showChamber = CHAMBER_LIVE || chamber;
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
    <div className="instrument" ref={ref}>
      <button className="instrument-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
        {chamber ? (
          <span>
            Chamber<span className="instrument-full"> music</span>
          </span>
        ) : (
          "Violin"
        )}
      </button>
      {open && (
        <div className="instrument-menu" role="menu" aria-label="Instrument">
          {showChamber &&
            (chamber ? (
              <div className="instrument-item current" role="menuitemradio" aria-checked="true">
                <span>Chamber music</span>
                <Check />
              </div>
            ) : (
              <Link className="instrument-item link" href="/chamber" role="menuitemradio" aria-checked="false" onClick={() => setOpen(false)}>
                <span>Chamber music</span>
                <small>2–9 players</small>
              </Link>
            ))}
          {chamber ? (
            <Link className="instrument-item link" href="/violin" role="menuitemradio" aria-checked="false" onClick={() => setOpen(false)}>
              <span>Violin</span>
            </Link>
          ) : (
            <div className="instrument-item current" role="menuitemradio" aria-checked="true">
              <span>Violin</span>
              <Check />
            </div>
          )}
          {SOON.map((name) => (
            <div key={name} className="instrument-item" role="menuitemradio" aria-checked="false" aria-disabled="true">
              <span>{name}</span>
              <small>Coming soon</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
