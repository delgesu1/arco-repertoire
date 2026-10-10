"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { arcoUrl } from "@/lib/arco";
import { ExternalIcon } from "./icons";

/**
 * Return-visit card: one slim line in the corner, never a modal.
 * Shown only after real engagement: the visitor is back for a second visit (after 15 s on the page), or has opened a
 * third piece in this session (after 1.5 s). Never on a first visit, never on iPhone/iPad (Safari's smart banner does
 * that job), never over the Ask panel or a piece sheet. A dismissal silences it for 30 days; a click, for good.
 * "?promo=peek" shows it for review.
 */
const KEY = "arco-peek-v1";
const DAY = 864e5;

type State = { visits: number; until: number; clicked?: boolean };

const read = (): State => {
  try {
    return { visits: 0, until: 0, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { visits: 0, until: 0 };
  }
};
const write = (s: State) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
};
const allowed = (s: State) => s.until < Date.now() && !s.clicked && document.documentElement.dataset.platform !== "ios";

export function ArcoPeek() {
  const [show, setShow] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  const piece = params.get("piece") ?? (pathname.startsWith("/piece/") ? pathname.split("/")[2] : null);

  // second (or later) visit: count it once per browser session
  useEffect(() => {
    let t: number | undefined;
    try {
      if (new URLSearchParams(window.location.search).get("promo") === "peek") {
        t = window.setTimeout(() => setShow(true), 0);
      } else {
        const s = read();
        if (!sessionStorage.getItem("arco-peek-counted")) {
          sessionStorage.setItem("arco-peek-counted", "1");
          s.visits += 1;
          write(s);
        }
        if (s.visits >= 2 && allowed(s)) t = window.setTimeout(() => setShow(true), 15000);
      }
    } catch {}
    return () => window.clearTimeout(t);
  }, []);

  // third piece opened in this session
  useEffect(() => {
    if (!piece) return;
    let t: number | undefined;
    try {
      const seen = new Set<string>(JSON.parse(sessionStorage.getItem("arco-peek-seen") ?? "[]"));
      seen.add(piece);
      sessionStorage.setItem("arco-peek-seen", JSON.stringify([...seen]));
      if (seen.size >= 3 && allowed(read())) t = window.setTimeout(() => setShow(true), 1500);
    } catch {}
    return () => window.clearTimeout(t);
  }, [piece]);

  // step aside while the Ask panel or a piece sheet is open
  useEffect(() => {
    if (!show) return;
    const id = window.setInterval(() => setBlocked(!!document.querySelector(".ask-panel, .sheet")), 600);
    return () => window.clearInterval(id);
  }, [show]);

  if (!show || blocked) return null;
  const close = (clicked = false) => {
    setShow(false);
    write({ ...read(), until: Date.now() + 30 * DAY, clicked: clicked || read().clicked });
  };
  return (
    <aside className="arco-peek" aria-label="Arco">
      <p>
        <b>Teaching or learning violin?</b> Arco turns every lesson into notes.
      </p>
      <a className="link-underline" href={arcoUrl("peek")} target="_blank" rel="noopener" onClick={() => close(true)}>
        Try Arco for free <ExternalIcon />
      </a>
      <button className="close" onClick={() => close()} aria-label="Dismiss">
        ×
      </button>
    </aside>
  );
}
