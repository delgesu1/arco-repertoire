"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Filters } from "@/lib/filter";
import {
  CHARACTER,
  ERAS,
  EXAM_BOARDS,
  PACE,
  SETTINGS,
  TYPES,
  eraLabel,
} from "@/lib/vocab";
import { writeUrl } from "@/lib/url-state";
import type { Counts } from "./Explorer";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type ToolbarCounts = {
  mode: Counts;
  pace: Counts;
  character: Counts;
  popularity: Counts;
  era: Counts;
  gender: Counts;
  board: Counts;
};
type Update = (p: Partial<Filters>) => void;

function Chip({
  on,
  count,
  onClick,
  children,
}: {
  on: boolean;
  count?: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className="chip"
      aria-pressed={on}
      disabled={!on && count === 0}
      onClick={onClick}
    >
      {children}
      {!on && count !== undefined && count > 0 && (
        <span className="n">{count}</span>
      )}
    </button>
  );
}

/** Button + floating panel; closes on outside click or Escape. */
function Popover({
  label,
  badge,
  align = "right",
  children,
}: {
  label: string;
  badge?: number;
  align?: "left" | "right";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div className="pop" ref={ref}>
      <button
        className={`fbtn${badge ? " on" : ""}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {label}
        {badge ? <em>{badge}</em> : null}
      </button>
      {open && (
        <div className={`popover ${align}`} role="dialog" aria-label={label}>
          {children}
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grp">
      <span>{label}</span>
      <div className="chips">{children}</div>
    </div>
  );
}

function CharacterPanel({
  f,
  update,
  counts,
}: {
  f: Filters;
  update: Update;
  counts: ToolbarCounts;
}) {
  return (
    <>
      <Group label="Key">
        {(["major", "minor"] as const).map((m) => (
          <Chip
            key={m}
            on={f.mode === m}
            count={counts.mode.get(m) ?? 0}
            onClick={() => update({ mode: f.mode === m ? null : m })}
          >
            {cap(m)}
          </Chip>
        ))}
      </Group>
      <Group label="Pace">
        {PACE.map((m) => (
          <Chip
            key={m}
            on={f.pace === m}
            count={counts.pace.get(m) ?? 0}
            onClick={() => update({ pace: f.pace === m ? null : m })}
          >
            {cap(m)}
          </Chip>
        ))}
      </Group>
      <Group label="Character">
        {CHARACTER.map((c) => {
          const on = f.character.includes(c);
          return (
            <Chip
              key={c}
              on={on}
              count={counts.character.get(c) ?? 0}
              onClick={() =>
                update({
                  character: on
                    ? f.character.filter((x) => x !== c)
                    : [...f.character, c],
                })
              }
            >
              {cap(c)}
            </Chip>
          );
        })}
      </Group>
      <Group label="Known">
        {(["well-known", "lesser-known"] as const).map((m) => (
          <Chip
            key={m}
            on={f.popularity === m}
            count={counts.popularity.get(m) ?? 0}
            onClick={() =>
              update({ popularity: f.popularity === m ? null : m })
            }
          >
            {cap(m)}
          </Chip>
        ))}
      </Group>
    </>
  );
}

const LENGTHS: { label: string; min: number | null; max: number | null }[] = [
  { label: "Under 3 min", min: null, max: 3 },
  { label: "3–6 min", min: 3, max: 6 },
  { label: "6–15 min", min: 6, max: 15 },
  { label: "Over 15 min", min: 15, max: null },
];

function LengthPanel({ f, update }: { f: Filters; update: Update }) {
  const num = (v: string) => (v === "" ? null : Math.max(0, Number(v)));
  return (
    <>
      <Group label="Length">
        {LENGTHS.map((l) => {
          const on = f.minMin === l.min && f.maxMin === l.max;
          return (
            <Chip
              key={l.label}
              on={on}
              onClick={() =>
                update(
                  on
                    ? { minMin: null, maxMin: null }
                    : { minMin: l.min, maxMin: l.max },
                )
              }
            >
              {l.label}
            </Chip>
          );
        })}
      </Group>
      <Group label="Or exactly">
        <div className="range">
          <input
            type="number"
            min={0}
            placeholder="min"
            value={f.minMin ?? ""}
            onChange={(e) => update({ minMin: num(e.target.value) })}
            aria-label="Shortest, minutes"
          />
          to
          <input
            type="number"
            min={0}
            placeholder="max"
            value={f.maxMin ?? ""}
            onChange={(e) => update({ maxMin: num(e.target.value) })}
            aria-label="Longest, minutes"
          />
          minutes
        </div>
      </Group>
    </>
  );
}

function MorePanel({
  f,
  update,
  counts,
}: {
  f: Filters;
  update: Update;
  counts: ToolbarCounts;
}) {
  return (
    <>
      <Group label="Era">
        {ERAS.map((e) => (
          <Chip
            key={e.key}
            on={f.era === e.key}
            count={counts.era.get(e.key) ?? 0}
            onClick={() => update({ era: f.era === e.key ? null : e.key })}
          >
            {e.label}
          </Chip>
        ))}
      </Group>
      <Group label="Composer">
        <Chip
          on={f.gender === "F"}
          count={counts.gender.get("F") ?? 0}
          onClick={() => update({ gender: f.gender === "F" ? null : "F" })}
        >
          Women composers
        </Chip>
        <Chip
          on={f.gender === "M"}
          count={counts.gender.get("M") ?? 0}
          onClick={() => update({ gender: f.gender === "M" ? null : "M" })}
        >
          Men composers
        </Chip>
      </Group>
      <Group label="Exam lists">
        {EXAM_BOARDS.map((b) => (
          <Chip
            key={b}
            on={f.board === b}
            count={counts.board.get(b) ?? 0}
            onClick={() => update({ board: f.board === b ? null : b })}
          >
            {b}
          </Chip>
        ))}
      </Group>
    </>
  );
}

/** Every active filter as a removable chip, so the list's state is always visible. */
function activeChips(
  f: Filters,
  update: Update,
  clearQ: () => void,
): { key: string; label: string; remove: () => void }[] {
  const out: { key: string; label: string; remove: () => void }[] = [];
  if (f.q.trim())
    out.push({ key: "q", label: `“${f.q.trim()}”`, remove: clearQ });
  if (f.type)
    out.push({
      key: "type",
      label: TYPES.find((t) => t.key === f.type)!.label,
      remove: () => update({ type: null }),
    });
  if (f.setting)
    out.push({
      key: "set",
      label: SETTINGS.find((s) => s.key === f.setting)!.label,
      remove: () => update({ setting: null }),
    });
  if (f.level != null) {
    const label = f.exact
      ? `Level ${f.level}`
      : `Levels ${Math.max(1, f.level - 1)}–${Math.min(10, f.level + 1)}`;
    out.push({ key: "lv", label, remove: () => update({ level: null }) });
  }
  if (f.mode)
    out.push({
      key: "mode",
      label: cap(f.mode),
      remove: () => update({ mode: null }),
    });
  if (f.pace)
    out.push({
      key: "pace",
      label: cap(f.pace),
      remove: () => update({ pace: null }),
    });
  for (const c of f.character)
    out.push({
      key: `ch-${c}`,
      label: cap(c),
      remove: () => update({ character: f.character.filter((x) => x !== c) }),
    });
  if (f.popularity)
    out.push({
      key: "pop",
      label: cap(f.popularity),
      remove: () => update({ popularity: null }),
    });
  if (f.minMin != null || f.maxMin != null) {
    const label =
      f.minMin != null && f.maxMin != null
        ? `${f.minMin}–${f.maxMin} min`
        : f.maxMin != null
          ? `Under ${f.maxMin} min`
          : `Over ${f.minMin} min`;
    out.push({
      key: "len",
      label,
      remove: () => update({ minMin: null, maxMin: null }),
    });
  }
  if (f.era)
    out.push({
      key: "era",
      label: eraLabel(f.era),
      remove: () => update({ era: null }),
    });
  if (f.gender)
    out.push({
      key: "g",
      label: f.gender === "F" ? "Women composers" : "Men composers",
      remove: () => update({ gender: null }),
    });
  if (f.board)
    out.push({
      key: "board",
      label: `On ${f.board} lists`,
      remove: () => update({ board: null }),
    });
  return out;
}

// phones get a shorter search placeholder so it isn't cut off
const NARROW = "(max-width: 720px)";
const subscribeNarrow = (cb: () => void) => {
  const m = matchMedia(NARROW);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};

export function Toolbar({
  f,
  update,
  counts,
  total,
  sortExplicit,
  clearAll,
}: {
  f: Filters;
  update: Update;
  counts: ToolbarCounts;
  total: number;
  sortExplicit: boolean;
  clearAll: () => void;
}) {
  // the box keeps its own text (so spaces survive while typing); the URL holds the query
  const [q, setQ] = useState(f.q);
  const [lastQ, setLastQ] = useState(f.q);
  if (f.q !== lastQ) {
    setLastQ(f.q);
    if (f.q.trim() !== q.trim()) setQ(f.q);
  }
  const [sheet, setSheet] = useState(false);
  const narrow = useSyncExternalStore(subscribeNarrow, () => matchMedia(NARROW).matches, () => false);

  const search = (v: string) => {
    setQ(v);
    const p = new URLSearchParams(window.location.search);
    if (v.trim()) p.set("q", v);
    else p.delete("q");
    writeUrl(p);
  };

  const characterCount =
    (f.mode ? 1 : 0) +
    (f.pace ? 1 : 0) +
    f.character.length +
    (f.popularity ? 1 : 0);
  const lengthCount = f.minMin != null || f.maxMin != null ? 1 : 0;
  const moreCount = (f.era ? 1 : 0) + (f.gender ? 1 : 0) + (f.board ? 1 : 0);
  const chips = activeChips(f, update, () => search(""));
  const narrowing = chips.some((c) => c.key !== "q");

  const activeSort = f.q && !sortExplicit ? "relevance" : f.sort;
  const sorts: { key: Filters["sort"]; label: string }[] = [
    ...(f.q ? [{ key: "relevance" as const, label: "Best match" }] : []),
    { key: "composer", label: "Composer" },
    { key: "level", label: "Level" },
    { key: "length", label: "Length" },
  ];

  return (
    <>
      <div className="toolbar-wrap">
        <div className="toolbar">
          <label className="fsearch">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <circle
                cx="7"
                cy="7"
                r="5.2"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
              />
              <path
                d="M11 11l3.6 3.6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            <input
              id="q-input"
              type="search"
              enterKeyHint="search"
              value={q}
              onChange={(e) => search(e.target.value)}
              placeholder={
                narrowing
                  ? narrow
                    ? `Search these ${total.toLocaleString("en")}…`
                    : `Search within these ${total.toLocaleString("en")} works…`
                  : narrow
                    ? "Search composer, title…"
                    : "Search composer, title, “op 35”…"
              }
              aria-label="Search the repertoire"
            />
            {q ? (
              <button
                className="clear"
                onClick={() => search("")}
                aria-label="Clear search"
              >
                ×
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>
          <div className="fbtns">
            <Popover label="Character" badge={characterCount}>
              <CharacterPanel f={f} update={update} counts={counts} />
            </Popover>
            <Popover label="Length" badge={lengthCount}>
              <LengthPanel f={f} update={update} />
            </Popover>
            <Popover label="More" badge={moreCount} align="right">
              <MorePanel f={f} update={update} counts={counts} />
            </Popover>
          </div>
          <button
            className="fbtn filters-btn"
            aria-expanded={sheet}
            onClick={() => setSheet(true)}
          >
            Filters
            {characterCount + lengthCount + moreCount ? (
              <em>{characterCount + lengthCount + moreCount}</em>
            ) : null}
          </button>
          <SortMenu
            sorts={sorts}
            active={activeSort}
            onPick={(s) => update({ sort: s })}
          />
        </div>
        {chips.length > 0 && (
          <div className="active" aria-label="Active filters">
            {chips.map((c) => (
              <span key={c.key} className="achip">
                {c.label}
                <button onClick={c.remove} aria-label={`Remove ${c.label}`}>
                  ×
                </button>
              </span>
            ))}
            <button className="clear-all" onClick={clearAll}>
              Clear all
            </button>
          </div>
        )}
      </div>
      {sheet && (
        <div className="sheet-backdrop" onClick={() => setSheet(false)} />
      )}
      {sheet && (
        <div className="filter-sheet" role="dialog" aria-label="Filters">
          <div className="filter-sheet-top">
            <b>Filters</b>
            <button className="btn-ink" onClick={() => setSheet(false)}>
              Show {total.toLocaleString("en")}
            </button>
          </div>
          <div className="filter-sheet-body">
            <Group label="Sort">
              {sorts.map((s) => (
                <Chip key={s.key} on={activeSort === s.key} onClick={() => update({ sort: s.key })}>
                  {s.label}
                </Chip>
              ))}
            </Group>
            <CharacterPanel f={f} update={update} counts={counts} />
            <LengthPanel f={f} update={update} />
            <MorePanel f={f} update={update} counts={counts} />
          </div>
        </div>
      )}
    </>
  );
}

function SortMenu({
  sorts,
  active,
  onPick,
}: {
  sorts: { key: Filters["sort"]; label: string }[];
  active: Filters["sort"];
  onPick: (s: Filters["sort"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) =>
      !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div className="pop sortsel" ref={ref}>
      <button aria-expanded={open} onClick={() => setOpen(!open)}>
        Sort: <b>{sorts.find((s) => s.key === active)?.label ?? "Composer"}</b>
      </button>
      {open && (
        <div className="menu right" role="listbox">
          {sorts.map((s) => (
            <button
              key={s.key}
              role="option"
              aria-selected={s.key === active}
              onClick={() => {
                onPick(s.key);
                setOpen(false);
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
