import type { Distance, Progress } from "./types";

/**
 * The course in minutes: the whole show (its Runtime) and the share of it behind you, taken from progress. Undefined when
 * the Runtime isn't known yet.
 */
export function distanceOf(runtime: number | undefined, progress: Progress): Distance | undefined {
  if (!runtime || progress.source === "none") return undefined;
  const share = progress.source === "episodes" && progress.total > 0 ? progress.watched / progress.total : progress.percent / 100;
  return { total: runtime, done: Math.round(runtime * Math.min(1, share)) };
}

/** Minutes of one episode, on average: the Runtime spread over the episodes that have aired. */
export function minutesPerEpisode(runtime: number | undefined, episodes: { airDate?: string }[], today: string): number | undefined {
  if (!runtime) return undefined;
  const aired = episodes.filter((e) => !e.airDate || e.airDate <= today).length;
  return aired > 0 ? runtime / aired : undefined;
}

/** A course length: "45 min", "4.5 h", "73 h". */
export function hours(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = minutes / 60;
  return h < 10 ? `${Number(h.toFixed(1))} h` : `${Math.round(h)} h`;
}

/** A time on the clock, for one day's watching: "45 min", "3 h", "1 h 28 min". */
export function duration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}
