"use client";

import { useEffect, useRef, useState } from "react";
import type { LevelInfo } from "@/lib/types";
import type { Filters } from "@/lib/filter";
import { SETTINGS, TYPES } from "@/lib/vocab";
import type { Counts } from "./Explorer";

export function Pick({
  label,
  options,
  value,
  onChange,
  tone,
}: {
  tone: "a" | "b" | "c";
  label: string;
  options: { value: string | null; label: string; count?: number }[];
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <span className={`pick ${tone}`} ref={ref}>
      <button aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </button>
      {open && (
        <div className="menu" role="listbox">
          {options.map((o) => (
            <button
              key={o.value ?? "any"}
              role="option"
              aria-selected={o.value === value}
              disabled={o.count === 0 && o.value !== value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              <span>{o.label}</span>
              {o.count !== undefined && <span className="count">{o.count}</span>}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

export function Finder({
  f,
  update,
  levels,
  counts,
}: {
  f: Filters;
  update: (p: Partial<Filters>) => void;
  levels: LevelInfo[];
  counts: { type: Counts; setting: Counts; level: Counts };
}) {
  const lvl = f.level ? levels.find((l) => l.level === f.level) : null;
  const typeText = f.type ? TYPES.find((t) => t.key === f.type)!.label.toLowerCase() : "any piece";
  const setting = f.setting ? SETTINGS.find((s) => s.key === f.setting)! : null;
  const settingText = setting ? setting.label.replace(/^With /, "").toLowerCase() : "any setting";
  const totalTypes = [...counts.type.values()].reduce((a, b) => a + b, 0);

  return (
    <section className="finder" aria-label="Find music">
      <div className="sentence">
        Show me{" "}
        <Pick
          tone="a"
          label={typeText}
          value={f.type}
          onChange={(v) => update({ type: v as Filters["type"] })}
          options={[
            { value: null, label: "Any piece", count: totalTypes },
            ...TYPES.map((t) => ({ value: t.key, label: t.label, count: counts.type.get(t.key) ?? 0 })),
          ]}
        />{" "}
        {setting?.key === "solo" ? "" : "for "}
        <Pick
          tone="b"
          label={setting?.key === "solo" ? "unaccompanied" : settingText}
          value={f.setting}
          onChange={(v) => update({ setting: v as Filters["setting"] })}
          options={[
            { value: null, label: "Any setting" },
            ...SETTINGS.map((s) => ({ value: s.key, label: s.label, count: counts.setting.get(s.key) ?? 0 })),
          ]}
        />{" "}
        {f.level ? (f.exact ? "at" : "around") : "at"}{" "}
        <Pick
          tone="c"
          label={f.level ? `level ${f.level}` : "any level"}
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

      <div className={`levels${f.level ? "" : " any"}`} role="group" aria-label="Level">
        {levels.map((l) => {
          const inRange = f.level != null && (f.exact ? l.level === f.level : Math.abs(l.level - f.level) <= 1);
          const n = counts.level.get(String(l.level)) ?? 0;
          return (
            <button
              key={l.level}
              className={`${inRange ? "in" : ""}${f.level === l.level ? " core" : ""}`}
              aria-pressed={f.level === l.level}
              title={`${l.name} — about ${l.exam} · ${n} works`}
              onClick={() => update({ level: f.level === l.level ? null : l.level })}
            >
              <i />
              <b>{l.level}</b>
              <small>{l.name}</small>
            </button>
          );
        })}
      </div>
      <div className="legend">
        <span>
          {lvl ? (
            <>
              <b>{lvl.name}</b> · about {lvl.exam.replace(" · ", " / ")}
            </>
          ) : (
            "Tap a level to narrow the list, or leave it open."
          )}
        </span>
        {f.level != null && (
          <span>
            {f.exact ? `level ${f.level} only` : `levels ${Math.max(1, f.level - 1)}–${Math.min(10, f.level + 1)}`} ·{" "}
            <button onClick={() => update({ exact: !f.exact })}>{f.exact ? "around" : "exact"}</button>
          </span>
        )}
      </div>
    </section>
  );
}
