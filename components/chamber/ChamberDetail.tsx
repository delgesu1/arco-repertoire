import type { ChamberPiece } from "@/lib/chamber/types";
import { chamberLadder } from "@/lib/chamber/filter";
import { formSingular, formationSingular } from "@/lib/chamber/vocab";
import type { LevelInfo } from "@/lib/types";
import { compareTitle } from "@/lib/filter";
import { eraLabel } from "@/lib/vocab";
import { ArcoLine } from "../ArcoLine";
import { correctionUrl } from "../PieceDetail";
import { ExternalIcon } from "../icons";
import { LevelBadge, imslpLink, tagList } from "../pieces";
import { YouTube } from "../YouTube";
import { ChamberRow, Scoring } from "./ChamberRow";

/** A chamber work's page and side sheet: PieceDetail for the chamber section, with the scoring and the part that sets the level. */
export function ChamberDetail({
  piece: p,
  all,
  levels,
  composerLink,
  onOpen,
  autoplay,
}: {
  piece: ChamberPiece;
  all: ChamberPiece[];
  levels: LevelInfo[];
  /** whether the composer has a page that lists this work */
  composerLink: boolean;
  onOpen?: (p: ChamberPiece) => void;
  autoplay?: boolean;
}) {
  const c = p.chamber;
  const lvl = levels.find((l) => l.level === p.level);
  const tags = tagList(p);
  const setMembers = p.setKey
    ? all.filter((x) => x.setKey === p.setKey && x.id !== p.id).sort((a, b) => compareTitle(a.title, b.title))
    : [];
  const down = chamberLadder(all, p, -1);
  const up = chamberLadder(all, p, 1);
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
            {composerLink ? <a href={`/composer/${p.composerSlug}`}>{p.composerName}</a> : <b>{p.composerName}</b>}
            {[p.dates, p.nationality].filter(Boolean).map((x) => ` · ${x}`)}
          </div>
          <div className="scoring-line">
            For <Scoring c={c} />
          </div>
          {c.aka?.length ? <div className="aka">Also known as {c.aka.join(" · ")}</div> : null}
          {lvl && (
            <div className="levelname">
              <b>
                Level {p.level} · {lvl.name}
              </b>{" "}
              — about {lvl.exam}
              {c.hardestPart === "balanced" ? ", with the parts evenly matched" : `, for the ${c.hardestPart} part`}
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
          <dt>Ensemble</dt>
          <dd>{formationSingular(c.formation)}</dd>
        </div>
        <div>
          <dt>Hardest part</dt>
          <dd>{c.hardestPart === "balanced" ? "Balanced" : c.hardestPart.charAt(0).toUpperCase() + c.hardestPart.slice(1)}</dd>
        </div>
        <div>
          <dt>Form</dt>
          <dd>{formSingular(c.form)}</dd>
        </div>
        <div>
          <dt>Length</dt>
          <dd>{p.minutes ? `About ${p.minutes} min` : "—"}</dd>
        </div>
        <div>
          <dt>Composed</dt>
          <dd>{c.year || "—"}</dd>
        </div>
        <div>
          <dt>Era</dt>
          <dd>{[eraLabel(p.era), p.gender === "F" ? "woman composer" : ""].filter(Boolean).join(" · ")}</dd>
        </div>
      </dl>

      {p.notes && (
        <section className="section">
          <h2>Notes</h2>
          <p>{p.notes}</p>
        </section>
      )}

      <div className="links">
        {p.imslpPage && (
          <a className="link-underline" href={imslpLink(p.imslpPage)} target="_blank" rel="noreferrer">
            Score on IMSLP <ExternalIcon />
          </a>
        )}
        {fix && (
          <a className="link-underline" href={fix} target="_blank" rel="noreferrer">
            Suggest a correction <ExternalIcon />
          </a>
        )}
      </div>

      <ArcoLine piece={p} />

      {setMembers.length > 0 && (
        <section className="section mini-list">
          <h2>Also in {p.set}</h2>
          <div className="list ch">
            {setMembers.map((x) => (
              <ChamberRow key={x.id} piece={x} onOpen={onOpen} showComposer={false} />
            ))}
          </div>
        </section>
      )}

      {(down.length > 0 || up.length > 0) && (
        <section className="section">
          <div className="ladder mini-list">
            <div>
              <h2>A step before · level {p.level - 1}</h2>
              <div className="list ch">
                {down.length ? down.map((x) => <ChamberRow key={x.id} piece={x} onOpen={onOpen} />) : <p className="cmp">—</p>}
              </div>
            </div>
            <div>
              <h2>A step after · level {p.level + 1}</h2>
              <div className="list ch">
                {up.length ? up.map((x) => <ChamberRow key={x.id} piece={x} onOpen={onOpen} />) : <p className="cmp">—</p>}
              </div>
            </div>
          </div>
        </section>
      )}

      {byComposer.length > 0 && (
        <section className="section mini-list">
          <h2>More chamber music by {p.composerName}</h2>
          <div className="list ch">
            {byComposer.map((x) => (
              <ChamberRow key={x.id} piece={x} onOpen={onOpen} showComposer={false} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
