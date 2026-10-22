const DAY = 86_400_000;
export const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** Episodes a day on the days you watched this show in the last 30, rounded; undefined with fewer than 3 dated episodes. */
export function recentPace(episodes: { watched: boolean; watchedDate?: string }[], today: string): number | undefined {
  const since = addDays(today, -30);
  const dates = episodes.flatMap((e) => (e.watched && e.watchedDate && e.watchedDate >= since ? [e.watchedDate] : []));
  if (dates.length < 3) return undefined;
  return Math.max(1, Math.round(dates.length / new Set(dates).size));
}
