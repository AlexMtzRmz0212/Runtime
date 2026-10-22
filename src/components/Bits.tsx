import { hours } from "@/lib/distance";
import { statusTone, type Tone } from "@/lib/format";
import type { Distance, Progress, Split } from "@/lib/types";

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

const MAX_SEASON_LABELS = 12;
// Hard-edged stripes that mark a guess, not a colour fade.
const HATCH = "repeating-linear-gradient(135deg, transparent 0 4px, rgb(0 0 0 / 0.25) 4px 7px)"; // taste-skill-ignore

/**
 * The course line. Seasons end at split markers that poke out of the line; the "course" size also names each season
 * under it. Estimated progress is drawn striped so it never passes for a count. `run` animates the fill out once.
 */
export function ProgressBar({
  progress,
  status,
  label,
  splits = [],
  size = "thin",
  onPaper = false,
  run = false,
}: {
  progress: Progress;
  status?: string;
  label: string;
  splits?: Split[];
  size?: "thin" | "course";
  onPaper?: boolean;
  run?: boolean;
}) {
  const estimate = progress.source === "estimate";
  const course = size === "course";
  const markers = splits.filter((s) => s.end < 1);
  const labels = course && splits.length > 1 && splits.length <= MAX_SEASON_LABELS;
  return (
    <div className={onPaper ? "text-ink" : "text-muted"}>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className={`relative flex w-full items-center ${course ? "h-4" : "h-2.5"}`}
      >
        <div className={`w-full overflow-hidden rounded-full ${onPaper ? "bg-ink/12" : "bg-well"} ${course ? "h-2.5" : "h-1.5"}`}>
          <div
            className={`h-full rounded-full ${fill[statusTone(status)]} ${estimate ? "opacity-60" : ""} ${run ? "run" : ""}`}
            style={{ width: `${progress.percent}%`, ...(estimate ? { backgroundImage: HATCH } : {}) }}
          />
        </div>
        {markers.map((s) => (
          <span key={s.season} aria-hidden className="absolute inset-y-0 w-px bg-current opacity-50" style={{ left: `${s.end * 100}%` }} />
        ))}
      </div>
      {labels && (
        <div aria-hidden className="relative mt-1 h-4 text-xs tabular-nums">
          {splits.map((s, i) => {
            const start = i === 0 ? 0 : splits[i - 1].end;
            return (
              <span key={s.season} className="absolute -translate-x-1/2" style={{ left: `${((start + s.end) / 2) * 100}%` }}>
                {s.season === 0 ? "Sp" : `S${s.season}`}
              </span>
            );
          })}
        </div>
      )}
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

/** Progress plus what's left of the course: "128 of 201 episodes, 49 h to go". */
export function courseText(p: Progress, distance?: Distance): string {
  const text = progressText(p);
  if (!distance) return text;
  const left = distance.total - distance.done;
  if (left <= 0) return `${text}, ${hours(distance.total)} run`;
  return `${text}, ${hours(left)} to go`;
}
