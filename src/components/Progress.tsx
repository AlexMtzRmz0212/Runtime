import { Check } from "@phosphor-icons/react";

/** A small spinning ring. Keeps still (but stays visible) for people who prefer reduced motion. */
export function Spinner({ onAccent = false }: { onAccent?: boolean }) {
  return <span aria-hidden className={`${onAccent ? "spinner spinner-on-accent" : "spinner"} inline-block size-4 shrink-0 rounded-full`} />;
}

/** value 0..1 fills the bar; no value shows a sweeping bar for "working, length unknown". */
export function Bar({ value, label }: { value?: number; label: string }) {
  const known = value !== undefined;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={known ? Math.round(value * 100) : undefined}
      className="relative h-2 w-full overflow-hidden rounded-full bg-well"
    >
      {known ? (
        <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(2, value * 100)}%` }} />
      ) : (
        <div className="bar-sweep absolute inset-y-0 w-1/3 rounded-full bg-accent" />
      )}
    </div>
  );
}

export type StepState = "pending" | "active" | "done";
export interface Step {
  label: string;
  state: StepState;
  /** Shown under the label while the step runs, e.g. "12 of 62". */
  detail?: string;
}

/** What is happening, in order: a tick for finished steps, a spinner for the current one. */
export function Steps({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((s) => (
        <li key={s.label} className="flex items-start gap-3" aria-current={s.state === "active" ? "step" : undefined}>
          <span className="mt-0.5 grid size-5 shrink-0 place-items-center">
            {s.state === "done" ? (
              <span className="grid size-5 place-items-center rounded-full bg-ok/20 text-ok"><Check size={12} weight="bold" aria-hidden /></span>
            ) : s.state === "active" ? (
              <Spinner />
            ) : (
              <span aria-hidden className="size-3 rounded-full border border-border" />
            )}
          </span>
          <span className="min-w-0">
            <span className={`block text-sm ${s.state === "pending" ? "text-muted" : "text-text"} ${s.state === "active" ? "font-semibold" : ""}`}>{s.label}</span>
            {s.state === "active" && s.detail && <span className="block text-xs text-muted tabular-nums">{s.detail}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}
