"use client";

import type { ChamberFacts, ChamberPiece } from "@/lib/chamber/types";
import { formationSingular, hardestPartTitle, instrumentParts } from "@/lib/chamber/vocab";
import { LevelBadge, memberTitle, pieceHref, tagList } from "../pieces";
import { isPlainClick } from "../Row";

/** "clarinet (or violin), viola, piano": the alternatives and ad lib. parts set off from the parts themselves */
export function Scoring({ c }: { c: ChamberFacts }) {
  return (
    <>
      {instrumentParts(c.instruments, c).map((x, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {x.name}
          {x.note && <em> {x.note}</em>}
        </span>
      ))}
    </>
  );
}

/** The level pebble with the part that sets it underneath ("violin 1", "piano", "balanced"). */
export function LevelPart({ piece: p }: { piece: ChamberPiece }) {
  return (
    <span className="lvpart" title={hardestPartTitle(p.level, p.chamber.hardestPart)}>
      <LevelBadge level={p.level} />
      <small>{p.chamber.hardestPart}</small>
    </span>
  );
}

/**
 * A chamber work in a list (design/chamber-options.html, row B): the Ensemble column names the formation and the scoring,
 * and the level names its part. On narrow screens the scoring moves under the composer.
 */
export function ChamberRow({
  piece: p,
  onOpen,
  onPlay,
  showComposer = true,
  maxTags = 3,
  member = false,
}: {
  piece: ChamberPiece;
  onOpen?: (p: ChamberPiece) => void;
  onPlay?: (p: ChamberPiece) => void;
  showComposer?: boolean;
  maxTags?: number;
  /** an entry inside an opened set: short name, compact */
  member?: boolean;
}) {
  const tags = tagList(p);
  const visible = [...tags.filter((t) => !t.pop).slice(0, maxTags - (tags.some((t) => t.pop) ? 1 : 0)), ...tags.filter((t) => t.pop)];
  return (
    <div
      className={`row${member ? " member" : ""}`}
      onClick={(e) => {
        if (!onOpen || !isPlainClick(e)) return;
        if ((e.target as HTMLElement).closest("button")) return;
        e.preventDefault();
        onOpen(p);
      }}
    >
      <div>
        <a className="ttl" href={pieceHref(p)} onClick={(e) => onOpen && isPlainClick(e) && e.preventDefault()}>
          {member ? memberTitle(p) : p.title}
        </a>
        {showComposer && <div className="cmp">{p.composerName}</div>}
        {!member && (
          <div className="scoring">
            <Scoring c={p.chamber} />
          </div>
        )}
      </div>
      <div className="meta">
        {!member && (
          <>
            <b>{formationSingular(p.chamber.formation)}</b>
            <Scoring c={p.chamber} />
          </>
        )}
      </div>
      <div className="dur">
        {p.minutes ? (
          <>
            {p.minutes}
            <small> min</small>
          </>
        ) : null}
      </div>
      <div className="tags">
        {!member &&
          visible.map((t) => (
            <span key={t.label} className={`tag${t.pop ? " pop" : ""}`}>
              {t.label}
            </span>
          ))}
      </div>
      <div className="lvcell">
        <LevelPart piece={p} />
      </div>
      {onPlay ? (
        <button
          className={`play${p.recording ? "" : " none"}`}
          aria-label={p.recording ? `Listen to ${p.title}` : `Find recordings of ${p.title}`}
          title={p.recording ? "Listen" : "Search recordings"}
          onClick={() => onPlay(p)}
        >
          <i />
        </button>
      ) : (
        <a className={`play${p.recording ? "" : " none"}`} href={`${pieceHref(p)}#listen`} aria-label={`Listen to ${p.title}`}>
          <i />
        </a>
      )}
    </div>
  );
}
