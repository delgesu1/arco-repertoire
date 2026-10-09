"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import type { Piece } from "@/lib/types";
import { writeUrl } from "@/lib/url-state";

type UiEvent =
  | { kind: "results"; title: string; items: { id: number; reason: string }[] }
  | { kind: "filters"; params: Record<string, string> }
  | { kind: "question"; question: string; options: string[] };

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; thinking: string; status: string[]; question?: { question: string; options: string[] }; error?: string; done: boolean };

const STORE = "advisor-v1";
const STARTERS = [
  "My student just finished the Accolay concerto. What next?",
  "Something lyrical and unaccompanied around level 6",
  "A recital opener under 4 minutes, not too hard",
  "Lesser-known pieces by women composers, level 3–5",
];

export interface AskRequest {
  text: string;
  nonce: number;
}

export function AskPanel({
  byId,
  request,
  getContext,
  onResults,
  onFilters,
  onOpenPiece,
}: {
  byId: Map<number, Piece>;
  request: AskRequest | null;
  getContext: () => string;
  onResults: (r: { title: string; items: { piece: Piece; reason: string }[] }) => void;
  onFilters: (params: Record<string, string>) => void;
  onOpenPiece: (p: Piece) => void;
}) {
  // a conversation from this browser session (the panel only mounts client-side, after the catalogue loads)
  const [saved] = useState<{ turns?: Turn[]; history?: { history: string; sig: string } | null } | null>(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORE) ?? "null");
    } catch {
      return null;
    }
  });
  // "/?ask=1" comes from the header's Ask button on other pages
  const [open, setOpen] = useState(() => new URLSearchParams(window.location.search).has("ask"));
  const [dockInput, setDockInput] = useState("");
  // once the list is scrolled, the dock shrinks to a pill so it doesn't cover the rows
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const onScroll = () => setCompact(window.scrollY > 520);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [turns, setTurns] = useState<Turn[]>(saved?.turns ?? []);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const [nearLimit, setNearLimit] = useState(false);
  const history = useRef<{ history: string; sig: string } | null>(saved?.history ?? null);
  const scroller = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const handled = useRef<number | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ turns: turns.filter((t) => t.role === "user" || t.done), history: history.current }));
    } catch {}
  }, [turns]);
  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const patchLast = (fn: (t: Extract<Turn, { role: "assistant" }>) => Extract<Turn, { role: "assistant" }>) =>
    setTurns((ts) => {
      const last = ts[ts.length - 1];
      if (!last || last.role !== "assistant") return ts;
      return [...ts.slice(0, -1), fn(last)];
    });

  const reset = () => {
    abort.current?.abort();
    history.current = null;
    setTurns([]);
    setNearLimit(false);
    setBusy(false);
  };

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      setOpen(true);
      setInput("");
      setBusy(true);
      setTurns((ts) => [...ts, { role: "user", text: t }, { role: "assistant", text: "", thinking: "", status: [], done: false }]);
      const ctrl = new AbortController();
      abort.current = ctrl;
      try {
        const res = await fetch("/api/advisor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: t, context: getContext(), ...(history.current ?? {}) }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => ({}));
          if (j.error === "reset") history.current = null;
          patchLast((a) => ({ ...a, error: j.message ?? j.error ?? "The advisor isn't available right now.", done: true }));
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = chunk.match(/^event: (.+)$/m)?.[1];
            const data = chunk.match(/^data: (.+)$/m)?.[1];
            if (!ev || !data) continue;
            const d = JSON.parse(data);
            if (ev === "text") patchLast((a) => ({ ...a, text: a.text + d.delta }));
            else if (ev === "thinking") patchLast((a) => ({ ...a, thinking: a.thinking + d.delta }));
            else if (ev === "status") patchLast((a) => ({ ...a, status: [...a.status, d.text] }));
            else if (ev === "error") {
              if (d.reset) history.current = null;
              patchLast((a) => ({ ...a, error: d.message }));
            } else if (ev === "ui") {
              const u = d as UiEvent;
              if (u.kind === "results") {
                const items = u.items.map((x) => ({ piece: byId.get(x.id)!, reason: x.reason })).filter((x) => x.piece);
                onResults({ title: u.title, items });
              } else if (u.kind === "filters") onFilters(u.params);
              else if (u.kind === "question") patchLast((a) => ({ ...a, question: { question: u.question, options: u.options } }));
            } else if (ev === "done") {
              history.current = { history: d.history, sig: d.sig };
              setNearLimit(Boolean(d.nearLimit));
            }
          }
        }
        patchLast((a) => ({ ...a, done: true }));
      } catch (e) {
        if ((e as Error).name !== "AbortError") patchLast((a) => ({ ...a, error: "Connection lost — please try again.", done: true }));
      } finally {
        setBusy(false);
      }
    },
    [busy, byId, getContext, onFilters, onResults],
  );

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has("ask")) {
      p.delete("ask");
      writeUrl(p);
    }
    const onOpen = () => setOpen(true);
    window.addEventListener("advisor:open", onOpen);
    return () => window.removeEventListener("advisor:open", onOpen);
  }, []);

  // external requests ("Ask about this piece")
  useEffect(() => {
    if (request && handled.current !== request.nonce) {
      handled.current = request.nonce;
      send(request.text);
    }
  }, [request, send]);

  const lastAssistant = [...turns].reverse().find((t) => t.role === "assistant") as Extract<Turn, { role: "assistant" }> | undefined;

  return (
    <>
      {!open && (
        <aside className={`ask-dock${compact ? " compact" : ""}`} aria-label="Ask the advisor">
          <button className="ask-title" onClick={() => setOpen(true)}>
            Ask
          </button>
          <p>
            {turns.length
              ? "Pick up where you left off, or ask something new."
              : "Tell me what you’ve played or what kind of vibe you’re looking for, and I’ll suggest some pieces!"}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (dockInput.trim()) {
                send(dockInput);
                setDockInput("");
              } else setOpen(true);
            }}
          >
            <input
              value={dockInput}
              onChange={(e) => setDockInput(e.target.value)}
              maxLength={1200}
              placeholder="I just finished the Accolay concerto…"
              aria-label="Ask the advisor"
              enterKeyHint="send"
            />
          </form>
        </aside>
      )}
      {open && (
        <aside className="ask-panel" aria-label="Advisor">
          <div className="ask-top">
            <b>Ask</b>
            <span>
              {turns.length > 0 && (
                <button onClick={reset} className="ask-new">
                  New conversation
                </button>
              )}
              <button className="close" onClick={() => setOpen(false)} aria-label="Close the advisor">
                ×
              </button>
            </span>
          </div>
          <div className="ask-body" ref={scroller}>
            {turns.length === 0 && (
              <div className="ask-intro">
                <p>
                  Tell me what you or your student has played, what you’re looking for, or ask anything about the
                  repertoire. My picks appear in the main list.
                </p>
                <div className="ask-starters">
                  {STARTERS.map((s) => (
                    <button key={s} onClick={() => send(s)}>
                      {s}
                    </button>
                  ))}
                </div>
                <p className="ask-fine">
                  Suggestions are AI-generated from this catalogue. Please don’t share personal details.
                </p>
              </div>
            )}
            {turns.map((t, i) =>
              t.role === "user" ? (
                <div key={i} className="msg user">
                  {t.text}
                </div>
              ) : (
                <div key={i} className="msg bot">
                  {t.thinking && (
                    <details className="thinking">
                      <summary>{t.done ? "How I thought about it" : "Thinking…"}</summary>
                      <p>{t.thinking}</p>
                    </details>
                  )}
                  {!t.done && !t.text && !t.thinking && <div className="dots" aria-label="Thinking"><i /><i /><i /></div>}
                  {t.status.length > 0 && !t.done && <div className="status">{t.status[t.status.length - 1]}</div>}
                  {t.text && <RichText text={t.text} byId={byId} onOpenPiece={onOpenPiece} />}
                  {t.question && (
                    <div className="question">
                      <p>{t.question.question}</p>
                      <div>
                        {t.question.options.map((o) => (
                          <button key={o} disabled={busy || t !== lastAssistant} onClick={() => send(o)}>
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {t.error && <div className="ask-error">{t.error}</div>}
                </div>
              ),
            )}
            {nearLimit && (
              <div className="ask-error">
                This conversation is getting long. <button onClick={reset}>Start a fresh one</button> for best results.
              </div>
            )}
          </div>
          <form
            className="ask-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <textarea
              value={input}
              rows={2}
              maxLength={1200}
              placeholder={busy ? "Working on it…" : "Ask about repertoire…"}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              aria-label="Your question"
            />
            <button className="btn-ink" disabled={busy || !input.trim()}>
              Send
            </button>
          </form>
        </aside>
      )}
    </>
  );
}

/** Paragraphs, simple bullets, **bold**, and [[id]] markers rendered as piece links. */
function RichText({ text, byId, onOpenPiece }: { text: string; byId: Map<number, Piece>; onOpenPiece: (p: Piece) => void }) {
  const blocks = text.trim().split(/\n{2,}/);
  const inline = (s: string, key: string) =>
    s.split(/(\[\[\d+\]\]|\*\*[^*]+\*\*)/g).map((part, j) => {
      const m = part.match(/^\[\[(\d+)\]\]$/);
      if (m) {
        const p = byId.get(Number(m[1]));
        if (!p) return null;
        return (
          <button key={`${key}-${j}`} className="piece-chip" onClick={() => onOpenPiece(p)}>
            <span className={`dot l${p.level}`} />
            {p.composerName.split(" ").pop()}: {p.title}
          </button>
        );
      }
      if (part.startsWith("**") && part.endsWith("**")) return <b key={`${key}-${j}`}>{part.slice(2, -2)}</b>;
      return <Fragment key={`${key}-${j}`}>{part}</Fragment>;
    });
  return (
    <div className="rich">
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        if (lines.every((l) => /^\s*[-•*] /.test(l))) {
          return (
            <ul key={i}>
              {lines.map((l, k) => (
                <li key={k}>{inline(l.replace(/^\s*[-•*] /, ""), `${i}-${k}`)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}{inline(l, `${i}-${k}`)}</Fragment>)}</p>;
      })}
    </div>
  );
}
