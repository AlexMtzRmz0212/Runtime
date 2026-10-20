import type { NewEpisode } from "./types";

/**
 * Which episodes a freshly filled list starts out as watched, worked out from what the show row already says,
 * so filling a show you finished doesn't reset it to 0%.
 */
export type WatchedRule = { kind: "all"; throughSeason?: number } | { kind: "upTo"; season: number; episode: number } | { kind: "none" };

export function watchedRule(show: { status?: string; seasons?: number; currentSeason?: number; lastWatchedEpisode?: number }): WatchedRule {
  // "Seasons" is how many you have seen: a season that aired after you finished stays unwatched.
  if (show.status === "Watched") return { kind: "all", throughSeason: show.seasons };
  if (show.status === "In Progress" && show.currentSeason && show.lastWatchedEpisode !== undefined) {
    return { kind: "upTo", season: show.currentSeason, episode: show.lastWatchedEpisode };
  }
  return { kind: "none" };
}

export function describeRule(rule: WatchedRule): string {
  switch (rule.kind) {
    case "all":
      return rule.throughSeason
        ? `Your status is Watched, so episodes that have aired up to season ${rule.throughSeason} will be marked watched (the number in Seasons).`
        : "Your status is Watched, so every episode that has aired will be marked watched.";
    case "upTo":
      return `Episodes up to season ${rule.season}, episode ${rule.episode} will be marked watched (from Current Season and Last watched episode). The rest start unwatched.`;
    default:
      return "All episodes will start unwatched.";
  }
}

/** Episodes that haven't aired yet are never watched. */
export function isWatched(rule: WatchedRule, ep: { season: number; episode: number; airDate?: string }, today: string): boolean {
  if (ep.airDate && ep.airDate > today) return false;
  if (rule.kind === "all") return rule.throughSeason === undefined || ep.season <= rule.throughSeason;
  if (rule.kind === "upTo") return ep.season < rule.season || (ep.season === rule.season && ep.episode <= rule.episode);
  return false;
}

const key = (e: { season: number; episode: number }) => `${e.season}x${e.episode}`;

/** What is left to create: every TVmaze episode the show doesn't have yet, with its starting watched state. Never touches existing rows. */
export function planFill(existing: { season: number; episode: number }[], listed: NewEpisode[], rule: WatchedRule, today: string): { toCreate: NewEpisode[]; already: number } {
  const have = new Set(existing.map(key));
  const toCreate = listed.filter((e) => !have.has(key(e))).map((e) => ({ ...e, watched: isWatched(rule, e, today) }));
  return { toCreate, already: listed.length - toCreate.length };
}
