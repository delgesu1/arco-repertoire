import type { LevelInfo, Piece } from "@/lib/types";
import { eraLabel, settingLabel, typeSingular } from "@/lib/vocab";
import { compareTitle, ladder } from "@/lib/filter";
import { LevelBadge, imslpLink, tagList } from "./pieces";
import { Row } from "./Row";
import { ExternalIcon } from "./icons";
import { YouTube } from "./YouTube";

// Daniel's Google Form, pre-filled with the piece ("{id}" / "{piece}" are replaced per piece)
export const CORRECTION_FORM =
  process.env.NEXT_PUBLIC_CORRECTION_FORM ??
  "https://docs.google.com/forms/d/e/1FAIpQLScB_jFobdua9buNeAHamNBGlBNYyhpgI08cRYYYExH_IvlSgg/viewform?usp=pp_url&entry.1265343379={id}&entry.1865410765={piece}";

function correctionUrl(p: Piece) {
  if (!CORRECTION_FORM) return null;
  return CORRECTION_FORM.replace("{id}", encodeURIComponent(String(p.id))).replace(
    "{piece}",
    encodeURIComponent(`${p.composerName} — ${p.title}`),
  );
}

export function PieceDetail({
  piece: p,
  all,
  levels,
  onOpen,
  onAsk,
  autoplay,
}: {
  piece: Piece;
  all: Piece[];
  levels: LevelInfo[];
  onOpen?: (p: Piece) => void;
  onAsk?: (p: Piece) => void;
  autoplay?: boolean;
}) {
  const lvl = levels.find((l) => l.level === p.level);
  const tags = tagList(p);
  const setMembers = p.setKey
    ? all.filter((x) => x.setKey === p.setKey && x.id !== p.id).sort((a, b) => compareTitle(a.title, b.title))
    : [];
  const down = ladder(all, p, -1);
  const up = ladder(all, p, 1);
  const byComposer = all
    .filter((x) => x.composerSlug === p.composerSlug && x.id !== p.id && x.setKey !== p.setKey)
    .sort((a, b) => Math.abs(a.level - p.level) - Math.abs(b.level - p.level) || a.level - b.level)
    .slice(0, 6);
  const fix = correctionUrl(p);

  return (
    <article className="detail">
      <div className="detail-head">
        <LevelBadge level={p.level} size="lg" />
        <div>
          <h1>{p.title}</h1>
          <div className="composer">
            <a href={`/composer/${p.composerSlug}`}>{p.composerName}</a>
            {p.dates && ` · ${p.dates}`}
          </div>
          {lvl && (
            <div className="levelname">
              <b>
                Level {p.level} · {lvl.name}
              </b>{" "}
              — about {lvl.exam}
            </div>
          )}
        </div>
      </div>

      {tags.length > 0 && (
        <div className="tags" style={{ marginTop: 16 }}>
          {tags.map((t) => (
            <span key={t.label} className={`tag${t.pop ? " pop" : ""}`}>
              {t.label}
            </span>
          ))}
        </div>
      )}

      <section className="section" id="listen">
        <h2>Listen</h2>
        <YouTube key={`${p.id}-${autoplay}`} piece={p} autoplay={autoplay} />
      </section>

      <dl className="facts">
        <div>
          <dt>Type</dt>
          <dd>{typeSingular(p.type)}</dd>
        </div>
        <div>
          <dt>Setting</dt>
          <dd>{p.accompaniment || p.settings.map(settingLabel).join(", ")}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{p.minutes ? `About ${p.minutes} min` : "—"}</dd>
        </div>
        <div>
          <dt>Era</dt>
          <dd>{eraLabel(p.era)}</dd>
        </div>
        <div>
          <dt>Nationality</dt>
          <dd>{[p.nationality, p.gender === "F" ? "woman composer" : ""].filter(Boolean).join(" · ") || "—"}</dd>
        </div>
        <div>
          <dt>Exam lists</dt>
          <dd>{p.examBoards.length ? p.examBoards.join(", ") : "—"}</dd>
        </div>
      </dl>

      {p.notes && (
        <section className="section">
          <h2>Notes</h2>
          <p>{p.notes}</p>
        </section>
      )}
      {p.exams && (
        <section className="section">
          <h2>Exam &amp; syllabus listings</h2>
          <p>{p.exams}</p>
        </section>
      )}

      <div className="links">
        {p.imslp && (
          <a className="link-underline" href={imslpLink(p)} target="_blank" rel="noreferrer">
            Score on IMSLP <ExternalIcon />
          </a>
        )}
        {onAsk && (
          <button className="link-underline" onClick={() => onAsk(p)}>
            Ask about this piece
          </button>
        )}
        {fix && (
          <a className="link-underline" href={fix} target="_blank" rel="noreferrer">
            Suggest a correction <ExternalIcon />
          </a>
        )}
      </div>

      {setMembers.length > 0 && (
        <section className="section mini-list">
          <h2>Also in {p.set}</h2>
          <div className="list">
            {setMembers.map((x) => (
              <Row key={x.id} piece={x} onOpen={onOpen} showComposer={false} />
            ))}
          </div>
        </section>
      )}

      {(down.length > 0 || up.length > 0) && (
        <section className="section">
          <div className="ladder mini-list">
            <div>
              <h2>A step before · level {p.level - 1}</h2>
              <div className="list">
                {down.length ? down.map((x) => <Row key={x.id} piece={x} onOpen={onOpen} />) : <p className="cmp">—</p>}
              </div>
            </div>
            <div>
              <h2>A step after · level {p.level + 1}</h2>
              <div className="list">
                {up.length ? up.map((x) => <Row key={x.id} piece={x} onOpen={onOpen} />) : <p className="cmp">—</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {byComposer.length > 0 && (
        <section className="section mini-list">
          <h2>More by {p.composerName}</h2>
          <div className="list">
            {byComposer.map((x) => (
              <Row key={x.id} piece={x} onOpen={onOpen} showComposer={false} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
