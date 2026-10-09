"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Catalogue, LevelInfo, Piece } from "@/lib/types";
import { SETTINGS, TYPES } from "@/lib/vocab";
import { facetCounts, groupResults, matches, sortPieces, type Filters } from "@/lib/filter";
import { indexPieces, search, type IndexedPiece } from "@/lib/search";
import { filtersFromParams, paramsFromFilters, writeUrl } from "@/lib/url-state";
import { Finder } from "./Finder";
import { Toolbar } from "./Toolbar";
import { LevelsInfo } from "./LevelsInfo";
import { Results } from "./Results";
import { Sheet } from "./Sheet";
import { AskPanel, type AskRequest } from "./AskPanel";
import { Row } from "./Row";

const PAGE = 80;

let cache: Promise<Catalogue> | null = null;
const loadCatalogue = (version: string) =>
  (cache ??= fetch(`/data/catalogue.json?v=${version}`).then((r) => r.json() as Promise<Catalogue>));

export type Counts = Map<string, number>;

export function Explorer({ version, levels, total }: { version: string; levels: LevelInfo[]; total: number }) {
  const sp = useSearchParams();
  const [data, setData] = useState<{ pieces: Piece[]; index: IndexedPiece[] } | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [autoplay, setAutoplay] = useState(false);
  const pushedSheet = useRef(false);
  const [picks, setPicks] = useState<{ title: string; items: { piece: Piece; reason: string }[] } | null>(null);
  const [askRequest, setAskRequest] = useState<AskRequest | null>(null);
  const ask = useCallback((text: string) => setAskRequest({ text, nonce: Date.now() }), []);

  useEffect(() => {
    loadCatalogue(version).then((c) => setData({ pieces: c.pieces, index: indexPieces(c.pieces) }));
  }, [version]);

  const f = useMemo(() => filtersFromParams(new URLSearchParams(sp.toString())), [sp]);
  const sortExplicit = sp.has("sort");
  const openId = Number(sp.get("piece")) || null;

  const update = useCallback((patch: Partial<Filters>) => {
    const cur = new URLSearchParams(window.location.search);
    writeUrl(paramsFromFilters({ ...filtersFromParams(cur), ...patch }, cur));
    setShown(PAGE);
  }, []);

  const openPiece = useCallback((p: Piece, play = false) => {
    setAutoplay(play);
    const params = new URLSearchParams(window.location.search);
    const alreadyOpen = params.has("piece");
    params.set("piece", String(p.id));
    writeUrl(params, !alreadyOpen);
    if (!alreadyOpen) pushedSheet.current = true;
  }, []);
  const closePiece = useCallback(() => {
    if (pushedSheet.current) {
      pushedSheet.current = false;
      window.history.back();
    } else {
      const p = new URLSearchParams(window.location.search);
      p.delete("piece");
      writeUrl(p);
    }
  }, []);

  // ── derived data ────────────────────────────────────────────────────
  const all = useMemo(() => data?.pieces ?? [], [data]);
  const queried = useMemo(() => (data ? search(data.index, f.q) : []), [data, f.q]);
  const filtered = useMemo(() => queried.filter((r) => matches(r.piece, f)), [queried, f]);
  const sorted = useMemo(
    () => sortPieces([...filtered], f.q && !sortExplicit ? "relevance" : f.sort).map((r) => r.piece),
    [filtered, f.sort, f.q, sortExplicit],
  );
  const setTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of all) if (p.setKey) m.set(p.setKey, (m.get(p.setKey) ?? 0) + 1);
    return m;
  }, [all]);
  const rows = useMemo(() => groupResults(sorted, setTotals), [sorted, setTotals]);
  const composerTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of all) m.set(p.composer, (m.get(p.composer) ?? 0) + 1);
    return m;
  }, [all]);
  const activeSort = f.q && !sortExplicit ? "relevance" : f.sort;
  const grouping = activeSort === "composer" ? "composer" : activeSort === "level" ? "level" : null;
  const qPieces = useMemo(() => queried.map((r) => r.piece), [queried]);
  const counts = useMemo(
    () => ({
      type: facetCounts(qPieces, f, "type", (p) => p.type) as Counts,
      setting: facetCounts(qPieces, f, "setting", (p) => p.settings) as Counts,
      level: facetCounts(qPieces, f, "level", (p) => String(p.level)) as Counts,
      mode: facetCounts(qPieces, f, "mode", (p) => p.mode) as Counts,
      pace: facetCounts(qPieces, f, "pace", (p) => p.pace) as Counts,
      popularity: facetCounts(qPieces, f, "popularity", (p) => p.popularity) as Counts,
      era: facetCounts(qPieces, f, "era", (p) => p.era) as Counts,
      gender: facetCounts(qPieces, f, "gender", (p) => p.gender || null) as Counts,
      board: facetCounts(qPieces, f, "board", (p) => p.examBoards) as Counts,
      character: (() => {
        const m: Counts = new Map();
        for (const r of filtered) for (const c of r.piece.character) m.set(c, (m.get(c) ?? 0) + 1);
        return m;
      })(),
    }),
    [qPieces, f, filtered],
  );
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const openPieceData = openId ? byId.get(openId) ?? null : null;

  const getContext = useCallback(() => {
    const cur = filtersFromParams(new URLSearchParams(window.location.search));
    const bits = [
      cur.q && `search "${cur.q}"`,
      cur.type && `type ${cur.type}`,
      cur.setting && `setting ${cur.setting}`,
      cur.level != null && `level ${cur.exact ? "" : "around "}${cur.level}`,
      cur.mode,
      cur.pace,
      ...cur.character,
      cur.popularity,
    ].filter(Boolean);
    const open = Number(new URLSearchParams(window.location.search).get("piece"));
    const op = open ? byId.get(open) : null;
    return [bits.length ? `filters: ${bits.join(", ")}` : "", op ? `viewing [[${op.id}]] ${op.composerName}: ${op.title}` : ""]
      .filter(Boolean)
      .join("; ");
  }, [byId]);
  const applyAdvisorFilters = useCallback((params: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) p.set(k, v);
    writeUrl(p);
    setPicks(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const showPicks = useCallback((r: { title: string; items: { piece: Piece; reason: string }[] }) => {
    setPicks(r);
    requestAnimationFrame(() => document.getElementById("advisor-picks")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const clearAll = () => {
    const p = new URLSearchParams(window.location.search);
    for (const k of ["q", "type", "set", "lv", "exact", "mode", "pace", "ch", "pop", "min", "max", "era", "g", "board"]) p.delete(k);
    writeUrl(p);
  };

  return (
    <>
      <section className="hero">
        <div className="intro">
          <div className="big">{(all.length || total).toLocaleString("en")}</div>
          <p>graded works for the violin, sorted by setting, level and character.</p>
          <LevelsInfo levels={levels} onPick={(level) => update({ level })} />
          <a className="intro-byline" href="https://www.kurganov.org" target="_blank" rel="noopener">
            Created by <b>Daniel Kurganov</b>
          </a>
        </div>
        <Finder f={f} update={update} levels={levels} counts={counts} />
      </section>

      <Toolbar f={f} update={update} counts={counts} total={sorted.length} sortExplicit={sortExplicit} clearAll={clearAll} />

      {picks && (
        <section id="advisor-picks" className="picks" aria-label="Suggested by the advisor">
          <div className="rhead">
            <h2>
              {picks.title} <span>· suggested by the advisor</span>
            </h2>
            <button className="clear-all" onClick={() => setPicks(null)}>
              Clear suggestions
            </button>
          </div>
          <div className="list">
            {picks.items.map(({ piece, reason }) => (
              <Row key={piece.id} piece={piece} note={reason} onOpen={openPiece} onPlay={(x) => openPiece(x, true)} />
            ))}
          </div>
        </section>
      )}

      <Results
        loading={!data}
        rows={rows}
        total={sorted.length}
        shown={shown}
        more={() => setShown((n) => n + PAGE)}
        f={f}
        grouping={grouping}
        levels={levels}
        composerTotals={composerTotals}
        onOpen={openPiece}
        typeLabel={f.type ? TYPES.find((t) => t.key === f.type)!.label : null}
        settingLabel={f.setting ? SETTINGS.find((s) => s.key === f.setting)!.label : null}
      />

      {openPieceData && (
        <Sheet
          piece={openPieceData}
          all={all}
          levels={levels}
          autoplay={autoplay}
          onClose={closePiece}
          onOpen={openPiece}
          onAsk={(p) => ask(`Tell me about [[${p.id}]] ${p.composerName}: ${p.title}. What does it develop, and what could come before and after it?`)}
        />
      )}

      {data && (
        <AskPanel
          byId={byId}
          request={askRequest}
          getContext={getContext}
          onResults={showPicks}
          onFilters={applyAdvisorFilters}
          onOpenPiece={(p) => openPiece(p)}
        />
      )}
    </>
  );
}
