import type { ReactNode } from "react";
import type { LevelInfo, PieceBase } from "@/lib/types";
import { ExternalIcon } from "./icons";
import { LevelBadge, imslpLink, tagList } from "./pieces";

/**
 * The top of a piece's sheet and page: a quiet line for the level (a small pebble, its name and the exam it is about),
 * then the title and the composer. A violin work and a chamber work pass their own composer name and extra lines.
 */
export function DetailHead({
  piece: p,
  lvl,
  levelNote,
  composer,
  dates,
  children,
}: {
  piece: PieceBase;
  lvl?: LevelInfo;
  /** after "about <exam>": ", for the clarinet part" */
  levelNote?: string;
  composer: ReactNode;
  dates?: string;
  children?: ReactNode;
}) {
  return (
    <header className="detail-head">
      <div className="levelline">
        <LevelBadge level={p.level} size="xs" />
        <b>
          Level {p.level}
          {lvl && ` · ${lvl.name}`}
        </b>
        {lvl && (
          <span className="exam">
            about {lvl.exam}
            {levelNote}
          </span>
        )}
      </div>
      <h1>{p.title}</h1>
      <div className="composer">
        {composer}
        {dates && (
          <span className="dates">
            <i>·</i> {dates}
          </span>
        )}
      </div>
      {children}
    </header>
  );
}

/** The two things to do with a work, right under the recording: its score, and asking the advisor about it. */
export function DetailActions<P extends PieceBase>({ piece: p, onAsk }: { piece: P; onAsk?: (p: P) => void }) {
  if (!p.imslpPage && !onAsk) return null;
  return (
    <div className="detail-actions">
      {p.imslpPage && (
        <a className="dbtn pri" href={imslpLink(p.imslpPage)} target="_blank" rel="noreferrer">
          Score on IMSLP <ExternalIcon />
        </a>
      )}
      {onAsk && (
        <button className="dbtn" onClick={() => onAsk(p)}>
          Ask about this piece
        </button>
      )}
    </div>
  );
}

/** The work's mood and pace as tags, after what the work is about. */
export function Character({ piece: p }: { piece: PieceBase }) {
  const tags = tagList(p);
  if (!tags.length) return null;
  return (
    <section className="section">
      <h2>Character</h2>
      <div className="tags">
        {tags.map((t) => (
          <span key={t.label} className={`tag${t.pop ? " pop" : ""}`}>
            {t.label}
          </span>
        ))}
      </div>
    </section>
  );
}
