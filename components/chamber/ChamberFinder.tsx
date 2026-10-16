"use client";

import { useState } from "react";
import type { ChamberFilters } from "@/lib/chamber/filter";
import type { InstrumentKey } from "@/lib/chamber/types";
import { FORMATIONS, FORMATION_GROUPS, FORMS, formPhrase, formationPhrase, instrumentName } from "@/lib/chamber/vocab";
import type { LevelInfo } from "@/lib/types";
import { levelPhrase } from "@/lib/vocab";
import type { Counts } from "../Explorer";
import { LevelPicker, Pick } from "../Finder";

/** instrument chips shown before "more" (design/chamber-options.html, filter option 2) */
const FIRST_CHIPS = 9;

/**
 * The chamber finder: "Show me [short pieces] for [string quartet] around [level 3]", the level bars, and the instruments a
 * work must include (several mean all of them).
 */
export function ChamberFinder({
  f,
  update,
  levels,
  counts,
  instruments,
}: {
  f: ChamberFilters;
  update: (p: Partial<ChamberFilters>) => void;
  levels: LevelInfo[];
  counts: { form: Counts; formation: Counts; level: Counts; instruments: Map<InstrumentKey, number> };
  /** every instrument in the section, most used first */
  instruments: InstrumentKey[];
}) {
  const [more, setMore] = useState(false);
  const ep = formationPhrase(f.formation);
  const lp = levelPhrase(f.level, f.exact);
  const totalForms = [...counts.form.values()].reduce((a, b) => a + b, 0);
  const shown = more ? instruments : instruments.filter((k, i) => i < FIRST_CHIPS || f.instruments.includes(k));
  const hidden = instruments.length - shown.length;
  const toggle = (k: InstrumentKey) =>
    update({ instruments: f.instruments.includes(k) ? f.instruments.filter((x) => x !== k) : [...f.instruments, k] });

  return (
    <section className="finder" aria-label="Find chamber music">
      <div className="sentence">
        Show me{" "}
        <Pick
          tone="a"
          label={formPhrase(f.form)}
          value={f.form}
          onChange={(v) => update({ form: v as ChamberFilters["form"] })}
          options={[
            { value: null, label: "Any piece", count: totalForms },
            ...FORMS.map((x) => ({ value: x.key, label: x.label, count: counts.form.get(x.key) ?? 0 })),
          ]}
        />{" "}
        {ep.lead}{" "}
        <Pick
          tone="b"
          label={ep.noun}
          value={f.formation}
          onChange={(v) => update({ formation: v as ChamberFilters["formation"] })}
          options={[
            { value: null, label: "Any ensemble" },
            ...FORMATION_GROUPS.flatMap((g) => [
              { heading: g.label },
              ...g.keys.map((k) => ({
                value: k,
                label: FORMATIONS.find((x) => x.key === k)!.label,
                count: counts.formation.get(k) ?? 0,
              })),
            ]),
          ]}
        />{" "}
        {lp.lead}{" "}
        <Pick
          tone="c"
          label={lp.noun}
          value={f.level ? String(f.level) : null}
          onChange={(v) => update({ level: v ? Number(v) : null })}
          options={[
            { value: null, label: "Any level" },
            ...levels.map((l) => ({
              value: String(l.level),
              label: `${l.level} · ${l.name}`,
              count: counts.level.get(String(l.level)) ?? 0,
            })),
          ]}
        />
      </div>

      <LevelPicker f={f} update={update} levels={levels} counts={counts.level} />

      <div className="incl" role="group" aria-label="Includes a part for">
        <span>Includes</span>
        <div className="chips">
          {shown.map((k) => {
            const on = f.instruments.includes(k);
            const n = counts.instruments.get(k) ?? 0;
            return (
              <button key={k} className="chip" aria-pressed={on} disabled={!on && n === 0} onClick={() => toggle(k)}>
                {instrumentName(k)}
                {!on && n > 0 && <span className="n">{n}</span>}
              </button>
            );
          })}
          {(hidden > 0 || more) && (
            <button className="chip more" onClick={() => setMore(!more)} aria-expanded={more}>
              {more ? "Fewer" : `${hidden} more`}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
