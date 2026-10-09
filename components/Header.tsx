"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { writeUrl } from "@/lib/url-state";
import { InstrumentSwitcher } from "./InstrumentSwitcher";

/** Arco logo + "Repertoire": the companion-site lockup (logo swaps for dark mode). */
export function Brand() {
  return (
    <>
      <Image
        className="logo logo-light"
        src="/brand/arco-logo-light.png"
        alt="Arco"
        width={80}
        height={38}
        priority
      />
      <Image
        className="logo logo-dark"
        src="/brand/arco-logo-dark.png"
        alt=""
        aria-hidden
        width={80}
        height={38}
        priority
      />
      <span className="word">Repertoire</span>
    </>
  );
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const sp = useSearchParams();
  const onHome = pathname === "/";
  const urlQ = onHome ? (sp.get("q") ?? "") : "";
  const [q, setQ] = useState(urlQ);
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  const input = useRef<HTMLInputElement>(null);

  // keep the box in sync when the URL changes elsewhere (e.g. "Clear all")
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setQ(urlQ);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        e.key === "/" &&
        !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) &&
        !t.isContentEditable
      ) {
        e.preventDefault();
        // on the home page the results toolbar owns search
        (document.getElementById("q-input") ?? input.current)?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const change = (v: string) => {
    setQ(v);
    if (onHome) {
      const p = new URLSearchParams(window.location.search);
      if (v.trim()) p.set("q", v);
      else p.delete("q");
      p.delete("piece");
      writeUrl(p);
    }
  };

  return (
    <header className="site-header">
      <div className="wrap bar">
        <div className="brand">
          <Link className="mark" href="/" aria-label="Arco Repertoire — home">
            <Brand />
          </Link>
          <InstrumentSwitcher />
        </div>
        {onHome ? (
          <div className="search-spacer" />
        ) : (
          <form
            className="search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              if (!onHome)
                router.push(
                  q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : "/",
                );
              else input.current?.blur();
            }}
          >
            <svg className="icon" viewBox="0 0 16 16" aria-hidden="true">
              <circle
                cx="7"
                cy="7"
                r="5.2"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
              />
              <path
                d="M11 11l3.6 3.6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              ref={input}
              value={q}
              onChange={(e) => change(e.target.value)}
              placeholder="Search composer or title…"
              aria-label="Search the repertoire"
              type="search"
              enterKeyHint="search"
            />
            {q ? (
              <button
                type="button"
                className="clear"
                onClick={() => change("")}
                aria-label="Clear search"
              >
                Clear
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </form>
        )}
        <div className="actions">
          <a className="byline" href="https://www.kurganov.org" target="_blank" rel="noopener">
            Created by <b>Daniel Kurganov</b>
          </a>
          <button
            className="btn-ink ask-btn"
            onClick={() =>
              onHome
                ? window.dispatchEvent(new Event("advisor:open"))
                : router.push("/?ask=1")
            }
          >
            Ask
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="Switch light/dark theme"
    >
      <i />
    </button>
  );
}
