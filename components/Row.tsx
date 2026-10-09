"use client";

import type { MouseEvent } from "react";
import type { Piece } from "@/lib/types";
import { settingLabel, typeSingular } from "@/lib/vocab";
import { LevelBadge, memberTitle, pieceHref, tagList } from "./pieces";

/** True for a plain left click (let modified clicks open links normally). */
export const isPlainClick = (e: MouseEvent) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

export function Row({
  piece: p,
  onOpen,
  onPlay,
  showComposer = true,
  maxTags = 3,
  note,
  member = false,
}: {
  piece: Piece;
  onOpen?: (p: Piece) => void;
  onPlay?: (p: Piece) => void;
  showComposer?: boolean;
  maxTags?: number;
  note?: string;
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
        {note && <div className="note">{note}</div>}
      </div>
      <div className="meta">
        {!member && (
          <>
            <b>{typeSingular(p.type)}</b>
            {settingLabel(p.settings[0])}
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
        <LevelBadge level={p.level} />
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

