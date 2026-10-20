import type { RawShow } from "../merge";
import type { Episode, NewShow, ShowPatch } from "../types";
import type { NotionAny } from "./client";
import { EPISODE, SHOW } from "./schema";

const text = (prop: NotionAny): string => ((prop?.title ?? prop?.rich_text ?? []) as NotionAny[]).map((t) => t.plain_text ?? "").join("");
const num = (prop: NotionAny): number | undefined => (typeof prop?.number === "number" ? prop.number : undefined);
const choice = (prop: NotionAny): string | undefined => prop?.status?.name ?? prop?.select?.name ?? undefined;
const names = (prop: NotionAny): string[] => ((prop?.multi_select ?? []) as NotionAny[]).map((o) => o.name);
const day = (d?: string | null) => (d ? d.slice(0, 10) : undefined);

export function pageToShow(page: NotionAny, titleProp: string): RawShow {
  const p = page.properties ?? {};
  return {
    pageId: page.id,
    pageIds: [page.id],
    name: text(p[titleProp]).trim(),
    type: choice(p[SHOW.type]),
    status: choice(p[SHOW.status]),
    year: text(p[SHOW.year]).trim() || undefined,
    startDate: day(p[SHOW.length]?.date?.start),
    endDate: day(p[SHOW.length]?.date?.end),
    seasons: num(p[SHOW.seasons]),
    currentSeason: num(p[SHOW.currentSeason]),
    episodesOfCurrentSeason: num(p[SHOW.episodesOfCurrentSeason]),
    lastWatchedEpisode: num(p[SHOW.lastWatchedEpisode]),
    score: num(p[SHOW.score]),
    imdb: num(p[SHOW.imdb]),
    top: choice(p[SHOW.top]),
    genres: names(p[SHOW.genre]),
    platforms: names(p[SHOW.platform]),
    cast: names(p[SHOW.cast]),
    directors: names(p[SHOW.directors]),
    tvmazeId: num(p[SHOW.tvmazeId]),
    poster: p[SHOW.poster]?.url || undefined,
    hasIcon: Boolean(page.icon),
    watchedWith: choice(p[SHOW.watchedWith]),
    scoreAlex: num(p[SHOW.scoreAlex]),
    scoreMish: num(p[SHOW.scoreMish]),
    scoreChar: num(p[SHOW.scoreChar]),
    createdTime: page.created_time,
  };
}

const title = (content: string) => ({ title: [{ type: "text", text: { content } }] });

export function showPatchToProperties(patch: ShowPatch, statusType: "status" | "select" = "status"): Record<string, NotionAny> {
  const out: Record<string, NotionAny> = {};
  if (patch.status !== undefined) out[SHOW.status] = { [statusType]: { name: patch.status } };
  if (patch.score !== undefined) out[SHOW.score] = { number: patch.score };
  if (patch.currentSeason !== undefined) out[SHOW.currentSeason] = { number: patch.currentSeason };
  if (patch.lastWatchedEpisode !== undefined) out[SHOW.lastWatchedEpisode] = { number: patch.lastWatchedEpisode };
  if (patch.episodesOfCurrentSeason !== undefined) out[SHOW.episodesOfCurrentSeason] = { number: patch.episodesOfCurrentSeason };
  // A select: Notion adds the option ("10", "11"…) the first time a place is used.
  if (patch.top !== undefined) out[SHOW.top] = { select: patch.top ? { name: patch.top } : null };
  if (patch.tvmazeId !== undefined) out[SHOW.tvmazeId] = { number: patch.tvmazeId };
  if (patch.poster !== undefined) out[SHOW.poster] = { url: patch.poster };
  if (patch.seasons !== undefined) out[SHOW.seasons] = { number: patch.seasons };
  if (patch.startDate !== undefined || patch.endDate !== undefined) {
    out[SHOW.length] = { date: patch.startDate ? { start: patch.startDate, end: patch.endDate ?? null } : null };
  }
  return out;
}

export function newShowToProperties(input: NewShow, titleProp: string, statusType: "status" | "select" = "status"): Record<string, NotionAny> {
  const out: Record<string, NotionAny> = { [titleProp]: title(input.name) };
  if (input.type) out[SHOW.type] = { select: { name: input.type } };
  if (input.status) out[SHOW.status] = { [statusType]: { name: input.status } };
  if (input.platforms?.length) out[SHOW.platform] = { multi_select: input.platforms.map((name) => ({ name })) };
  if (input.genres?.length) out[SHOW.genre] = { multi_select: input.genres.map((name) => ({ name })) };
  const seasons = input.seasons ?? input.episodesPerSeason?.length;
  if (seasons) out[SHOW.seasons] = { number: seasons };
  if (input.startDate) out[SHOW.length] = { date: { start: input.startDate, end: input.endDate ?? null } };
  if (input.tvmazeId !== undefined) out[SHOW.tvmazeId] = { number: input.tvmazeId };
  if (input.poster) out[SHOW.poster] = { url: input.poster };
  return out;
}

export function pageToEpisode(page: NotionAny, titleProp: string): Episode | undefined {
  const p = page.properties ?? {};
  const showPageId = p[EPISODE.show.name]?.relation?.[0]?.id;
  const season = num(p[EPISODE.season.name]);
  const episode = num(p[EPISODE.episode.name]);
  if (!showPageId || season === undefined || episode === undefined) return undefined;
  return {
    pageId: page.id,
    showPageId,
    season,
    episode,
    title: text(p[titleProp]).trim(),
    watched: Boolean(p[EPISODE.watched.name]?.checkbox),
    watchedDate: day(p[EPISODE.watchedDate.name]?.date?.start),
    airDate: day(p[EPISODE.airDate.name]?.date?.start),
  };
}

export function newEpisodeToProperties(showPageId: string, ep: { season: number; episode: number; title: string; watched?: boolean; watchedDate?: string | null; airDate?: string | null }, titleProp: string): Record<string, NotionAny> {
  const out: Record<string, NotionAny> = {
    [titleProp]: title(ep.title),
    [EPISODE.show.name]: { relation: [{ id: showPageId }] },
    [EPISODE.season.name]: { number: ep.season },
    [EPISODE.episode.name]: { number: ep.episode },
    [EPISODE.watched.name]: { checkbox: Boolean(ep.watched) },
  };
  if (ep.watchedDate) out[EPISODE.watchedDate.name] = { date: { start: ep.watchedDate } };
  if (ep.airDate) out[EPISODE.airDate.name] = { date: { start: ep.airDate } };
  return out;
}

export function watchedToProperties(watched: boolean, date?: string | null): Record<string, NotionAny> {
  return {
    [EPISODE.watched.name]: { checkbox: watched },
    [EPISODE.watchedDate.name]: { date: watched && date ? { start: date } : null },
  };
}
