import { statusTone, type Tone } from "@/lib/format";
import type { Progress } from "@/lib/types";

const dot: Record<Tone, string> = { done: "bg-ok", active: "bg-accent", waiting: "bg-warn", want: "bg-info", idle: "bg-muted" };

export function StatusChip({ status }: { status?: string }) {
  if (!status) return null;
  return (
    <span className="chip">
      <span aria-hidden className={`size-1.5 rounded-full ${dot[statusTone(status)]}`} />
      {status}
    </span>
  );
}

const fill: Record<Tone, string> = { done: "bg-ok", active: "bg-accent", waiting: "bg-warn", want: "bg-info", idle: "bg-muted" };

/** Thin bar. Estimated progress is drawn striped so it never passes for a count. */
export function ProgressBar({ progress, status, label }: { progress: Progress; status?: string; label: string }) {
  const estimate = progress.source === "estimate";
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={progress.percent}
      className="h-1.5 w-full overflow-hidden rounded-full bg-well"
    >
      <div
        className={`h-full rounded-full ${fill[statusTone(status)]} ${estimate ? "opacity-60" : ""}`}
        style={{ width: `${progress.percent}%`, ...(estimate ? { backgroundImage: "repeating-linear-gradient(135deg, transparent 0 4px, rgb(0 0 0 / 0.25) 4px 7px)" } : {}) }}
      />
    </div>
  );
}

export function progressText(p: Progress): string {
  switch (p.source) {
    case "episodes":
      return `${p.watched} of ${p.total} episodes`;
    case "estimate":
      return `about ${p.percent}%`;
    case "status":
      return "All watched";
    default:
      return "";
  }
}
