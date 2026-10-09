"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { LevelInfo, Piece } from "@/lib/types";
import type { Filters, ResultRow } from "@/lib/filter";
import { settingLabel as settingName, typeSingular } from "@/lib/vocab";
import { LevelPebbles, durationRange } from "./pieces";
import { Row } from "./Row";

export type Grouping = "composer" | "level" | null;

const firstPiece = (r: ResultRow) => (r.kind === "piece" ? r.piece : r.pieces[0]);
const rowLevel = (r: ResultRow) => (r.kind === "piece" ? r.piece.level : Math.min(...r.pieces.map((p) => p.level)));
const groupKey = (r: ResultRow, g: Grouping) => (g === "composer" ? firstPiece(r).composer : g === "level" ? String(rowLevel(r)) : "");

export function Results({
  loading,
  rows,
  total,
  shown,
  more,
  f,
  onOpen,
  grouping,
  levels,
  composerTotals,
  typeLabel,
  settingLabel,
}: {
  loading: boolean;
  rows: ResultRow[];
  total: number;
  shown: number;
  more: () => void;
  f: Filters;
  grouping: Grouping;
  levels: LevelInfo[];
  composerTotals: Map<string, number>;
  onOpen: (p: Piece, play?: boolean) => void;
  typeLabel: string | null;
  settingLabel: string | null;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const sentinel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((es) => es[0].isIntersecting && more(), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [more, rows.length, shown]);

  const phrase = !settingLabel
    ? ""
    : settingLabel === "Unaccompanied"
      ? " for solo violin"
      : settingLabel.startsWith("With")
        ? ` ${settingLabel.toLowerCase()}`
        : ` for ${settingLabel.toLowerCase()}`;
  const heading = typeLabel || settingLabel ? `${typeLabel ?? "Pieces"}${phrase}` : "";

  const groupCounts = new Map<string, number>();
  if (grouping)
    for (const r of rows) {
      const k = groupKey(r, grouping);
      groupCounts.set(k, (groupCounts.get(k) ?? 0) + (r.kind === "piece" ? 1 : r.pieces.length));
    }
  const visible = rows.slice(0, shown);

  return (
    <section aria-label="Results">
      <div className="rhead">
        <h2 aria-live="polite">
          {heading || "Results"} <span>· {loading ? "…" : `${total.toLocaleString("en")} works`}</span>
        </h2>
      </div>

      {!loading && rows.length > 0 && (
        <div className="colhead" aria-hidden="true">
          <span>Work</span>
          <span>Type</span>
          <span>Length</span>
          <span>Character</span>
          <span>Level</span>
          <span />
        </div>
      )}
      <div className={`list${grouping ? " grouped" : ""}`}>
        {loading &&
          Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton-row" />)}
        {!loading && rows.length === 0 && (
          <div className="empty">
            <b>Nothing matches all of that.</b>
            Try removing a filter{f.q ? ", or check the spelling" : ""}.
          </div>
        )}
        {visible.map((r, i) => {
          const key = r.kind === "piece" ? r.piece.id : r.key;
          const k = groupKey(r, grouping);
          const head = grouping && (i === 0 || groupKey(visible[i - 1], grouping) !== k);
          return (
            <Fragment key={key}>
              {head && (
                <GroupHead
                  grouping={grouping}
                  piece={firstPiece(r)}
                  level={levels.find((l) => String(l.level) === k)}
                  count={groupCounts.get(k) ?? 0}
                  composerTotal={composerTotals.get(firstPiece(r).composer) ?? 0}
                />
              )}
              {r.kind === "piece" ? (
                <Row piece={r.piece} onOpen={onOpen} onPlay={(p) => onOpen(p, true)} showComposer={grouping !== "composer"} />
              ) : (
                <SetRow
                  row={r}
                  showComposer={grouping !== "composer"}
                  open={expanded.has(r.key)}
                  toggle={() => {
                    const n = new Set(expanded);
                    if (n.has(r.key)) n.delete(r.key);
                    else n.add(r.key);
                    setExpanded(n);
                  }}
                  onOpen={onOpen}
                />
              )}
            </Fragment>
          );
        })}
      </div>
      {rows.length > shown && (
        <div className="more-results" ref={sentinel}>
          <button className="btn-ink" onClick={more}>
            Show more
          </button>
        </div>
      )}
    </section>
  );
}

function GroupHead({
  grouping,
  piece,
  level,
  count,
  composerTotal,
}: {
  grouping: Grouping;
  piece: Piece;
  level?: LevelInfo;
  count: number;
  composerTotal: number;
}) {
  if (grouping === "level" && level) {
    return (
      <div className="ghead">
        <h3>
          Level {level.level} · {level.name}
        </h3>
        <span>
          about {level.exam} · {count} {count === 1 ? "work" : "works"}
        </span>
      </div>
    );
  }
  return (
    <div className="ghead">
      <h3>{piece.composer}</h3>
      <span>{[piece.dates, piece.nationality, composerTotal > count ? `${count} of ${composerTotal} works` : `${count} ${count === 1 ? "work" : "works"}`].filter(Boolean).join(" · ")}</span>
      {composerTotal > count && (
        <a className="link-underline" href={`/composer/${piece.composerSlug}`}>
          See all {composerTotal}
        </a>
      )}
    </div>
  );
}

function SetRow({
  row,
  open,
  toggle,
  onOpen,
  showComposer,
}: {
  row: Extract<ResultRow, { kind: "set" }>;
  open: boolean;
  toggle: () => void;
  onOpen: (p: Piece, play?: boolean) => void;
  showComposer: boolean;
}) {
  const ps = row.pieces;
  const mins = durationRange(ps);
  const tags = [...new Set(ps.flatMap((p) => p.character))].slice(0, 3);
  const movements = ps.filter((p) => p.title.includes(": ")).length;
  const complete = ps.some((p) => /\(complete\)/i.test(p.title));
  const count = ps.length < row.total ? `${ps.length} of ${row.total} entries match` : `${ps.length} entries`;
  const what =
    ps.length === row.total && complete && movements
      ? `the complete work and ${movements} ${movements === 1 ? "movement" : "movements"}`
      : "";
  return (
    <div className={`set${open ? " open" : ""}`}>
      <div className="row setrow" onClick={toggle}>
        <div>
          <button className="ttl" aria-expanded={open}>
            {row.name}
          </button>
          <div className="sub">
            <b>{count}</b>
            {what && ` · ${what}`}
            {showComposer && ` · ${row.composer}`}
          </div>
        </div>
        <div className="meta">
          <b>{typeSingular(ps[0].type)}</b>
          {settingName(ps[0].settings[0])}
        </div>
        <div className="dur">
          {mins ? (
            <>
              {mins}
              <small> min</small>
            </>
          ) : null}
        </div>
        <div className="tags">
          {tags.map((t) => (
            <span className="tag" key={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </span>
          ))}
        </div>
        <div className="lvcell">
          <LevelPebbles levels={ps.map((p) => p.level)} />
        </div>
        <button
          className="chev"
          aria-label={open ? `Close ${row.name}` : `Open ${row.name}`}
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
        >
          <i />
        </button>
      </div>
      {open &&
        ps.map((p) => <Row key={p.id} piece={p} onOpen={onOpen} onPlay={(x) => onOpen(x, true)} showComposer={false} member />)}
    </div>
  );
}
