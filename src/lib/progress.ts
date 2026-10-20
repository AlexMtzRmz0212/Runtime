import type { Episode, Progress, SeasonProgress, ShowPatch, Split } from "./types";

type ShowFields = {
  status?: string;
  seasons?: number;
  currentSeason?: number;
  episodesOfCurrentSeason?: number;
  lastWatchedEpisode?: number;
};

export const sortEpisodes = <T extends { season: number; episode: number }>(episodes: T[]): T[] =>
  [...episodes].sort((a, b) => a.season - b.season || a.episode - b.episode);

export const episodeLabel = (season: number, episode: number) => `S${season}E${String(episode).padStart(2, "0")}`;

export function seasonsOf(episodes: Pick<Episode, "season" | "watched">[]): SeasonProgress[] {
  const map = new Map<number, SeasonProgress>();
  for (const ep of episodes) {
    const s = map.get(ep.season) ?? { season: ep.season, watched: 0, total: 0 };
    s.total++;
    if (ep.watched) s.watched++;
    map.set(ep.season, s);
  }
  return [...map.values()].sort((a, b) => a.season - b.season);
}

/** Each season's end as a share of all episodes, in order. Empty without episodes. */
export function splitsOf(episodes: Pick<Episode, "season" | "watched">[]): Split[] {
  let done = 0;
  return seasonsOf(episodes).map((s) => {
    done += s.total;
    return { season: s.season, end: done / episodes.length };
  });
}

const pct = (watched: number, total: number) => (total > 0 ? Math.min(100, Math.round((watched / total) * 100)) : 0);

/**
 * Counted from the show's Episodes rows when it has any. Otherwise guessed from the show's own columns
 * (current season, last watched episode, assuming seasons are as long as the current one), or just "all" for Watched.
 */
export function progressOf(show: ShowFields, episodes: Pick<Episode, "watched">[]): Progress {
  if (episodes.length > 0) {
    const watched = episodes.filter((e) => e.watched).length;
    return { watched, total: episodes.length, percent: pct(watched, episodes.length), source: "episodes" };
  }
  if (show.status === "Watched") return { watched: 0, total: 0, percent: 100, source: "status" };
  const { seasons, currentSeason: cur, episodesOfCurrentSeason: per, lastWatchedEpisode: last } = show;
  if (seasons && cur && per && last !== undefined) {
    const total = seasons * per;
    const watched = Math.min(total, (cur - 1) * per + last);
    return { watched, total, percent: pct(watched, total), source: "estimate" };
  }
  return { watched: 0, total: 0, percent: 0, source: "none" };
}

export interface NextUp {
  season: number;
  episode: number;
  title?: string;
}

/** The first unwatched episode, or (without Episodes rows) the one after "Last watched episode" in the current season. */
export function nextUp(show: ShowFields, episodes: Pick<Episode, "season" | "episode" | "title" | "watched">[]): NextUp | undefined {
  if (episodes.length > 0) {
    const next = sortEpisodes(episodes).find((e) => !e.watched);
    return next && { season: next.season, episode: next.episode, title: next.title || undefined };
  }
  if (show.status !== "In Progress" || !show.currentSeason) return undefined;
  const last = show.lastWatchedEpisode ?? 0;
  if (show.episodesOfCurrentSeason && last >= show.episodesOfCurrentSeason) {
    return show.seasons && show.currentSeason >= show.seasons ? undefined : { season: show.currentSeason + 1, episode: 1 };
  }
  return { season: show.currentSeason, episode: last + 1 };
}

/** Episodes that have aired by `today` (those with no date count as aired). */
export const aired = <T extends { airDate?: string }>(episodes: T[], today: string): T[] => episodes.filter((e) => !e.airDate || e.airDate <= today);

/** Every episode that has aired is watched, and there is at least one. For a running show this means: caught up. */
export const airedAllWatched = (episodes: { watched: boolean; airDate?: string }[], today: string): boolean => {
  const out = aired(episodes, today);
  return out.length > 0 && out.every((e) => e.watched);
};

export interface SyncContext {
  /** YYYY-MM-DD. */
  today: string;
  /** The show has not ended (TVmaze says Running or To Be Determined). */
  running?: boolean;
}

/**
 * After episodes change, bring the show's own columns in line (the Notion views and "Progress" formulas read them):
 * current season and last watched episode, and the status where it clearly changed:
 *  - everything that has aired is watched: Waiting if the show is still running (the next episode isn't out), else Watched;
 *  - something that has aired is unwatched, and the show was Watched or Waiting: back to In Progress;
 *  - something is watched on a show that hadn't been started: In Progress.
 * A status is only suggested when it exists as an option in Notion.
 */
export function syncFields(
  show: { status?: string },
  episodes: (Pick<Episode, "season" | "episode" | "watched"> & { airDate?: string })[],
  statusOptions: string[],
  ctx: SyncContext = { today: new Date().toISOString().slice(0, 10) },
): ShowPatch {
  if (episodes.length === 0) return {};
  const sorted = sortEpisodes(episodes);
  const watched = sorted.filter((e) => e.watched);
  const last = watched[watched.length - 1];
  const patch: ShowPatch = last
    ? { currentSeason: last.season, lastWatchedEpisode: last.episode, episodesOfCurrentSeason: sorted.filter((e) => e.season === last.season).length }
    : { currentSeason: sorted[0].season, lastWatchedEpisode: 0, episodesOfCurrentSeason: sorted.filter((e) => e.season === sorted[0].season).length };

  const idle = [undefined, "Not started", "Want to watch"];
  const done = [ "Watched", "Waiting" ];
  const canWait = statusOptions.includes("Waiting");
  let status: string | undefined;
  if (airedAllWatched(sorted, ctx.today)) {
    if (ctx.running && canWait) status = "Waiting";
    else if (watched.length === sorted.length) status = "Watched";
  } else if (done.includes(show.status ?? "") || (watched.length > 0 && idle.includes(show.status))) {
    status = "In Progress";
  }
  if (status && status !== show.status && statusOptions.includes(status)) patch.status = status;
  return patch;
}

/** True for every episode up to and including the given one, counting across seasons. */
export const isUpTo = (e: { season: number; episode: number }, season: number, episode: number) => e.season < season || (e.season === season && e.episode <= episode);
