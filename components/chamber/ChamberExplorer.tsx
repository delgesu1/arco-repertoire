"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { chamberFacetCounts, instrumentCounts, matchesChamber, type ChamberFilters } from "@/lib/chamber/filter";
import { CHAMBER_LIVE } from "@/lib/chamber/launch";
import { indexChamber, searchChamber } from "@/lib/chamber/search";
import type { ChamberCatalogue, ChamberPiece, InstrumentKey } from "@/lib/chamber/types";
import { chamberFiltersFromParams, paramsFromChamberFilters } from "@/lib/chamber/url-state";
import {
  CHAMBER_INTRO,
  CHAMBER_LEVEL_NOTE,
  FORMATIONS,
  FORMS,
  chamberHeading,
  formationSingular,
  instrumentName,
  instrumentsByUse,
} from "@/lib/chamber/vocab";
import { groupResults, sortPieces } from "@/lib/filter";
import type { IndexedPiece } from "@/lib/search";
import type { LevelInfo } from "@/lib/types";
import { writeUrl } from "@/lib/url-state";
import { AskPanel, type AskCopy, type AskRequest } from "../AskPanel";
import type { Counts } from "../Explorer";
import { LevelsInfo } from "../LevelsInfo";
import { Results, type RowStyle } from "../Results";
import { SheetFrame } from "../Sheet";
import { Toolbar, type ActiveChip } from "../Toolbar";
import { ChamberDetail } from "./ChamberDetail";
import { ChamberFinder } from "./ChamberFinder";
import { ChamberRow, Scoring } from "./ChamberRow";

const PAGE = 80;

let cache: Promise<ChamberCatalogue> | null = null;
const loadCatalogue = (version: string) =>
  (cache ??= fetch(`/data/chamber.json?v=${version}`).then((r) => r.json() as Promise<ChamberCatalogue>));

const FILTER_PARAMS = ["q", "form", "ens", "with", "lv", "exact", "mode", "pace", "ch", "pop", "min", "max", "era", "g"];

const CHAMBER_ASK: AskCopy = {
  section: "chamber",
  store: "advisor-chamber-v1",
  starters: [
    "We’re violin, cello and piano. What could we play, and what if a violist joined?",
    "Something light and sunny for an outdoor summer concert",
    "Something dark and dramatic for a strong amateur piano quintet",
    "Two violins, a cello and a harpsichord: Baroque ideas around level 3",
  ],
  // open questions first (occasions, moods, "what if a violist joined"), which the filters can't answer; filtering second
  dock: "Ask me anything, from a crowd-pleaser for your next concert to what your trio could play if a violist joined.",
  dockPlaceholder: "A lively opener for our quartet’s concert…",
  intro:
    "Ask me about music for a concert or occasion, a mood or your group, what to play next, or anything else you have in mind. My picks appear in the main list.",
};

/** The /chamber page below the header: the violin home page's Explorer for the chamber catalogue, with its own advisor. */
export function ChamberExplorer({
  version,
  levels,
  total,
  composerPages,
}: {
  version: string;
  levels: LevelInfo[];
  total: number;
  /** composers whose page exists (the others' names are not links) */
  composerPages: string[];
}) {
  const sp = useSearchParams();
  const [data, setData] = useState<{ pieces: ChamberPiece[]; index: IndexedPiece<ChamberPiece>[] } | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [autoplay, setAutoplay] = useState(false);
  const pushedSheet = useRef(false);
  const hasPage = useMemo(() => new Set(composerPages), [composerPages]);
  const [picks, setPicks] = useState<{ title: string; items: { piece: ChamberPiece; reason: string }[] } | null>(null);
  const [askRequest, setAskRequest] = useState<AskRequest | null>(null);
  const ask = useCallback((text: string) => setAskRequest({ text, nonce: Date.now() }), []);

  useEffect(() => {
    loadCatalogue(version).then((c) => setData({ pieces: c.pieces, index: indexChamber(c.pieces) }));
  }, [version]);

  const f = useMemo(() => chamberFiltersFromParams(new URLSearchParams(sp.toString())), [sp]);
  const openId = Number(sp.get("piece")) || null;

  const update = useCallback((patch: Partial<ChamberFilters>) => {
    const cur = new URLSearchParams(window.location.search);
    writeUrl(paramsFromChamberFilters({ ...chamberFiltersFromParams(cur), ...patch }, cur));
    setShown(PAGE);
  }, []);

  const openPiece = useCallback((p: ChamberPiece, play = false) => {
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
  const queried = useMemo(() => (data ? searchChamber(data.index, f.q) : []), [data, f.q]);
  const filtered = useMemo(() => queried.filter((r) => matchesChamber(r.piece, f)), [queried, f]);
  const sorted = useMemo(() => sortPieces([...filtered], f.sort).map((r) => r.piece), [filtered, f.sort]);
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
  const instruments = useMemo(() => instrumentsByUse(all).map((x) => x.key), [all]);
  const grouping = f.sort === "composer" ? "composer" : f.sort === "level" ? "level" : null;
  const qPieces = useMemo(() => queried.map((r) => r.piece), [queried]);
  const counts = useMemo(
    () => ({
      form: chamberFacetCounts(qPieces, f, "form", (p) => p.chamber.form) as Counts,
      formation: chamberFacetCounts(qPieces, f, "formation", (p) => p.chamber.formation) as Counts,
      level: chamberFacetCounts(qPieces, f, "level", (p) => String(p.level)) as Counts,
      instruments: instrumentCounts(qPieces, f),
      mode: chamberFacetCounts(qPieces, f, "mode", (p) => p.mode) as Counts,
      pace: chamberFacetCounts(qPieces, f, "pace", (p) => p.pace) as Counts,
      popularity: chamberFacetCounts(qPieces, f, "popularity", (p) => p.popularity) as Counts,
      era: chamberFacetCounts(qPieces, f, "era", (p) => p.era) as Counts,
      gender: chamberFacetCounts(qPieces, f, "gender", (p) => p.gender || null) as Counts,
      character: (() => {
        const m: Counts = new Map();
        for (const r of filtered) for (const c of r.piece.character) m.set(c, (m.get(c) ?? 0) + 1);
        return m;
      })(),
    }),
    [qPieces, f, filtered],
  );
  const byId = useMemo(() => new Map(all.map((p) => [p.id, p])), [all]);
  const openPieceData = openId ? (byId.get(openId) ?? null) : null;

  // what the user is looking at, for the advisor ("filters: string quartets, around level 4; viewing [[100021]] …")
  const getContext = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const cur = chamberFiltersFromParams(params);
    const bits = [
      cur.q && `search "${cur.q}"`,
      cur.form && FORMS.find((x) => x.key === cur.form)?.label.toLowerCase(),
      cur.formation && FORMATIONS.find((x) => x.key === cur.formation)?.label.toLowerCase(),
      ...cur.instruments.map((k) => `includes ${instrumentName(k).toLowerCase()}`),
      cur.level != null && `level ${cur.exact ? "" : "around "}${cur.level}`,
      cur.mode,
      cur.pace,
      ...cur.character,
      cur.popularity,
      cur.era,
    ].filter(Boolean);
    const op = byId.get(Number(params.get("piece")));
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
  const showPicks = useCallback((r: { title: string; items: { piece: ChamberPiece; reason: string }[] }) => {
    setPicks(r);
    requestAnimationFrame(() => document.getElementById("advisor-picks")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, []);

  const rowStyle = useMemo<RowStyle<ChamberPiece>>(
    () => ({
      className: "ch",
      columns: ["Work", "Ensemble", "Length", "Character", "Level", ""],
      row: (p, o) => (
        <ChamberRow piece={p} onOpen={o.onOpen} onPlay={(x) => o.onOpen(x, true)} showComposer={o.showComposer} member={o.member} />
      ),
      setMeta: (ps) => {
        const same = ps.every((p) => p.chamber.formation === ps[0].chamber.formation);
        return same ? (
          <>
            <b>{formationSingular(ps[0].chamber.formation)}</b>
            <Scoring c={ps[0].chamber} />
          </>
        ) : (
          <b>Mixed ensembles</b>
        );
      },
      // composer pages list chamber works only from launch, so before it "See all" would not show what it counts
      composerHref: (p) => (CHAMBER_LIVE ? `/composer/${p.composerSlug}` : null),
    }),
    [],
  );

  const sectionChips: ActiveChip[] = [
    ...(f.form
      ? [{ key: "form", label: FORMS.find((x) => x.key === f.form)!.label, remove: () => update({ form: null }) }]
      : []),
    ...(f.formation
      ? [{ key: "ens", label: FORMATIONS.find((x) => x.key === f.formation)!.label, remove: () => update({ formation: null }) }]
      : []),
    ...f.instruments.map((k: InstrumentKey) => ({
      key: `with-${k}`,
      label: `Includes ${instrumentName(k).toLowerCase()}`,
      remove: () => update({ instruments: f.instruments.filter((x) => x !== k) }),
    })),
  ];

  const clearAll = () => {
    const p = new URLSearchParams(window.location.search);
    for (const k of FILTER_PARAMS) p.delete(k);
    writeUrl(p);
  };

  return (
    <>
      <section className="hero">
        <div className="intro">
          <div className="big">{(all.length || total).toLocaleString("en")}</div>
          <p>{CHAMBER_INTRO}</p>
          <LevelsInfo levels={levels} onPick={(level) => update({ level })} note={CHAMBER_LEVEL_NOTE} />
          <a className="intro-byline" href="https://www.kurganov.org" target="_blank" rel="noopener">
            Created by <b>Daniel Kurganov</b>
          </a>
        </div>
        <ChamberFinder f={f} update={update} levels={levels} counts={counts} instruments={instruments} />
      </section>

      <Toolbar
        f={f}
        update={update}
        counts={counts}
        total={sorted.length}
        clearAll={clearAll}
        sectionChips={sectionChips}
        examBoards={false}
        example="“Trout”"
      />

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
          <div className="list ch">
            {picks.items.map(({ piece, reason }) => (
              <ChamberRow key={piece.id} piece={piece} note={reason} onOpen={openPiece} onPlay={(x) => openPiece(x, true)} />
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
        heading={chamberHeading(f.form, f.formation)}
        rowStyle={rowStyle}
        grouping={grouping}
        levels={levels}
        composerTotals={composerTotals}
        onOpen={openPiece}
      />

      {openPieceData && (
        <SheetFrame piece={openPieceData} onClose={closePiece}>
          <ChamberDetail
            piece={openPieceData}
            all={all}
            levels={levels}
            composerLink={hasPage.has(openPieceData.composerSlug)}
            onOpen={openPiece}
            // the sheet closes so the advisor panel (and the picks in the main list) aren't hidden behind it
            onAsk={(p) => {
              closePiece();
              ask(
                `Tell me about [[${p.id}]] ${p.composerName}: ${p.title}. Background, movements, where it fits in a concert program, what it's like to play, and similar pieces.`,
              );
            }}
            autoplay={autoplay}
          />
        </SheetFrame>
      )}

      {data && (
        <AskPanel
          copy={CHAMBER_ASK}
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
