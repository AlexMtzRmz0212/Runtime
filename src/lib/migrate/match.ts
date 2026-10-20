import { normalizeName } from "../merge";

const NOISE = new Set(["episodes", "episode", "episodios", "seasons", "season", "temporadas", "tracker", "list", "lista", "tv", "show", "serie", "series", "eps", "watchlist", "progress", "database", "db"]);

const stripNoise = (name: string) =>
  normalizeName(name)
    .split(" ")
    .filter((w) => !NOISE.has(w))
    .join(" ");

export interface Named {
  name: string;
}

export type Match<T extends Named> = { show: T; how: "exact" | "cleaned" | "partial" } | { show: undefined; reason: string };

/**
 * Find the show a per-show database belongs to from the database's title. Exact name first, then without words like
 * "Episodes"/"Tracker", then a unique partial match. Ambiguous or missing: no match, with a reason to print.
 */
export function matchShow<T extends Named>(dbTitle: string, shows: T[]): Match<T> {
  const full = normalizeName(dbTitle);
  if (!full) return { show: undefined, reason: "database has no title" };

  const exact = shows.find((s) => normalizeName(s.name) === full);
  if (exact) return { show: exact, how: "exact" };

  const cleaned = stripNoise(dbTitle);
  if (cleaned) {
    const hit = shows.filter((s) => stripNoise(s.name) === cleaned);
    if (hit.length === 1) return { show: hit[0], how: "cleaned" };
    if (hit.length > 1) return { show: undefined, reason: `ambiguous: ${hit.map((s) => s.name).join(", ")}` };
  }

  if (cleaned.length >= 4) {
    const hit = shows.filter((s) => {
      const n = stripNoise(s.name);
      return n.length >= 4 && (n.startsWith(cleaned) || cleaned.startsWith(n));
    });
    if (hit.length === 1) return { show: hit[0], how: "partial" };
    if (hit.length > 1) return { show: undefined, reason: `ambiguous: ${hit.map((s) => s.name).join(", ")}` };
  }
  return { show: undefined, reason: "no show with that name in TV Shows" };
}
