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

/** "5x8": one episode of a show, as the fill run passes it around. */
export const episodeKey = (e: { season: number; episode: number }) => `${e.season}x${e.episode}`;
export const isEpisodeKey = (v: unknown): v is string => typeof v === "string" && /^\d{1,3}x\d{1,4}$/.test(v);

/**
 * What is left to create: every TVmaze episode the show doesn't have yet, with its starting watched state. Never touches
 * existing rows. `skip` lists episodes known to exist that Notion's query may not return yet (created a moment ago).
 */
export function planFill(existing: { season: number; episode: number }[], listed: NewEpisode[], rule: WatchedRule, today: string, skip: Iterable<string> = []): { toCreate: NewEpisode[]; already: number } {
  const have = new Set([...existing.map(episodeKey), ...skip]);
  const toCreate = listed.filter((e) => !have.has(episodeKey(e))).map((e) => ({ ...e, watched: isWatched(rule, e, today) }));
  return { toCreate, already: listed.length - toCreate.length };
}

/**
 * Episodes this server created (or is creating) lately, per show. Notion's query can lag a few seconds behind pages it has
 * just created, so a fill call that re-reads the show right after a batch, or a second call running at the same time, would
 * create them again. Entries expire once Notion has surely caught up.
 */
export class RecentEpisodes {
  private shows = new Map<string, Map<string, number>>();
  constructor(private ttlMs = 10 * 60_000) {}

  /** Keys still remembered for the show. */
  of(showPageId: string, now = Date.now()): string[] {
    const keys = this.shows.get(showPageId);
    if (!keys) return [];
    for (const [k, until] of keys) if (until <= now) keys.delete(k);
    return [...keys.keys()];
  }

  add(showPageId: string, keys: string[], now = Date.now()) {
    const map = this.shows.get(showPageId) ?? new Map<string, number>();
    for (const k of keys) map.set(k, now + this.ttlMs);
    this.shows.set(showPageId, map);
  }

  remove(showPageId: string, keys: string[]) {
    const map = this.shows.get(showPageId);
    for (const k of keys) map?.delete(k);
  }
}
