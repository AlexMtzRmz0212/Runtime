"use client";

import { useEffect, useId, useState } from "react";
import { duration } from "@/lib/distance";
import { dayLabel, plural } from "@/lib/format";
import { addDays } from "@/lib/pace";

const PACES = [1, 2, 3, 4, 6];
const KEY = "runtime:pace";

/**
 * Pick a pace (episodes a night) and see when you'd cross the finish line. Starts at your real recent pace on this show when
 * there is one, else the pace you picked last time on any show, else 2.
 */
export function PaceDial({ left, minutes, today, recent }: { left: number; minutes?: number; today: string; recent?: number }) {
  const id = useId();
  const [pace, setPace] = useState(recent ?? 2);
  useEffect(() => {
    if (recent) return;
    try {
      const saved = Number(localStorage.getItem(KEY));
      if (PACES.includes(saved)) setPace(saved);
    } catch {}
  }, [recent]);

  const choose = (p: number) => {
    setPace(p);
    try {
      localStorage.setItem(KEY, String(p));
    } catch {}
  };

  const paces = recent && !PACES.includes(recent) ? [...PACES, recent].sort((a, b) => a - b) : PACES;
  const nights = Math.ceil(left / pace);
  return (
    <fieldset className="mt-6">
      <legend className="mb-2 text-sm text-muted">Episodes a night{recent ? `, my pace lately is ${recent}` : ""}</legend>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="inline-flex rounded-md bg-well p-1">
          {paces.map((p) => (
            <label key={p} className="relative">
              <input type="radio" name={id} value={p} checked={pace === p} onChange={() => choose(p)} className="peer sr-only" />
              <span className="grid h-8 min-w-10 cursor-pointer place-items-center rounded px-2 font-display text-lg font-black tabular-nums text-muted transition-colors peer-checked:bg-paper peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent hover:text-text peer-checked:hover:text-ink">
                {p}
              </span>
            </label>
          ))}
        </div>
        <p aria-live="polite" className="text-sm">
          Finish line <strong className="font-display text-2xl leading-none font-black text-ok tabular-nums">{dayLabel(addDays(today, nights - 1))}</strong>
          <span className="text-muted">
            {" "}in {plural(nights, "night")}
            {minutes ? `, ${duration(Math.min(left, pace) * minutes)} a night` : ""}
          </span>
        </p>
      </div>
    </fieldset>
  );
}
