"use client";

import { useEffect, useRef, useState } from "react";

const SOON = ["Viola", "Cello", "Double bass", "Piano", "Flute", "Guitar"];

/** Violin today; the other instruments are listed but not selectable yet. */
export function InstrumentSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
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
        Violin
      </button>
      {open && (
        <div className="instrument-menu" role="menu" aria-label="Instrument">
          <div className="instrument-item current" role="menuitemradio" aria-checked="true">
            <span>Violin</span>
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
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
