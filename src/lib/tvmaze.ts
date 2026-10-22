import { fetchRetry } from "./http";
import { normalizeName } from "./merge";
import type { NewEpisode, NewShow } from "./types";

/** TVmaze: free, no key, has every season and episode with air dates. https://www.tvmaze.com/api */
const BASE = "https://api.tvmaze.com";

export interface Candidate {
  id: number;
  name: string;
  /** YYYY-MM-DD */
  premiered?: string;
  ended?: string;
  /** Running, Ended, To Be Determined... */
  status?: string;
  network?: string;
  /** Small poster, for pickers. */
  image?: string;
  /** Full-size poster: what is stored on the show and used as the Notion cover. */
  poster?: string;
  genres: string[];
  type?: string;
  /** Minutes per episode, on average. */
  averageRuntime?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

/** A runtime in minutes, or undefined when TVmaze has none (null, 0). */
const minutes = (v: unknown): number | undefined => (typeof v === "number" && v > 0 ? v : undefined);

export function toCandidate(raw: Raw): Candidate {
  const https = (u?: string) => u?.replace(/^http:/, "https:");
  const image: string | undefined = raw.image?.medium ?? raw.image?.original ?? undefined;
  return {
    id: raw.id,
    name: String(raw.name ?? "").trim(),
    premiered: raw.premiered || undefined,
    ended: raw.ended || undefined,
    status: raw.status || undefined,
    network: raw.network?.name ?? raw.webChannel?.name ?? undefined,
    image: https(image),
    poster: https(raw.image?.original ?? raw.image?.medium ?? undefined),
    genres: Array.isArray(raw.genres) ? raw.genres : [],
    type: raw.type || undefined,
    averageRuntime: minutes(raw.averageRuntime) ?? minutes(raw.runtime),
  };
}

async function getJson(path: string): Promise<Raw> {
  const res = await fetchRetry(`${BASE}${path}`, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(res.status === 404 ? "TVmaze doesn't have that show" : `TVmaze answered ${res.status}`);
  return res.json();
}

export async function searchShows(query: string): Promise<Candidate[]> {
  const raw: Raw[] = await getJson(`/search/shows?q=${encodeURIComponent(query)}`);
  return raw.map((r) => toCandidate(r.show)).filter((c) => c.id && c.name);
}

export async function getShow(id: number): Promise<Candidate> {
  return toCandidate(await getJson(`/shows/${id}`));
}

/** Regular, numbered episodes (no specials), in order. Season and number are unique: the first one wins. */
export function toEpisodes(raw: Raw[]): NewEpisode[] {
  const seen = new Set<string>();
  const out: NewEpisode[] = [];
  for (const e of raw) {
    if (!Number.isInteger(e.season) || !Number.isInteger(e.number) || e.season < 1 || e.number < 1) continue;
    const key = `${e.season}x${e.number}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ season: e.season, episode: e.number, title: String(e.name ?? "").trim() || `Episode ${e.number}`, airDate: e.airdate || undefined, runtime: minutes(e.runtime) });
  }
  return out.sort((a, b) => a.season - b.season || a.episode - b.episode);
}

/**
 * Minutes of every episode that has aired by `today`, added up: the show's Runtime. An episode without its own runtime counts
 * as the show's average. Undefined when nothing is known.
 */
export function totalRuntime(episodes: { airDate?: string; runtime?: number }[], average: number | undefined, today: string): number | undefined {
  let total = 0;
  for (const e of episodes) {
    if (e.airDate && e.airDate > today) continue;
    const minutes = e.runtime ?? average;
    if (minutes === undefined) return undefined;
    total += minutes;
  }
  return total > 0 ? Math.round(total) : undefined;
}

export async function getEpisodes(id: number): Promise<NewEpisode[]> {
  return toEpisodes(await getJson(`/shows/${id}/episodes`));
}

/** Keep only values that already exist as options of the Notion column: never invent new options. */
export function onlyExisting(values: string[], options: string[]): string[] {
  const byKey = new Map(options.map((o) => [normalizeName(o), o]));
  return [...new Set(values.map((v) => byKey.get(normalizeName(v))).filter((v): v is string => Boolean(v)))];
}

/** A new TV Shows row from a TVmaze show and its episodes. Genres are limited to the options you already have. */
export function showFromTvmaze(c: Candidate, episodes: NewEpisode[], choices: { genres: string[]; types: string[] }, status?: string, today = new Date().toISOString().slice(0, 10)): NewShow {
  const anime = c.genres.some((g) => g.toLowerCase() === "anime");
  return {
    name: c.name,
    type: onlyExisting([anime ? "Anime" : "TV Series"], choices.types)[0],
    status,
    genres: onlyExisting(c.genres, choices.genres),
    seasons: episodes.length ? Math.max(...episodes.map((e) => e.season)) : undefined,
    startDate: c.premiered,
    endDate: c.ended,
    tvmazeId: c.id,
    poster: c.poster,
    runtime: totalRuntime(episodes, c.averageRuntime, today),
  };
}

const yearOf = (d?: string) => (d && /^\d{4}/.test(d) ? d.slice(0, 4) : undefined);

/** The result to pre-select for an existing show: same name (ignoring case/punctuation), preferring the same start year. */
export function pickBest(candidates: Candidate[], show: { name: string; startDate?: string; year?: string }): Candidate | undefined {
  // "Big Bang Theory" and "The Big Bang Theory" are the same show.
  const key = (n: string) => normalizeName(n).replace(/^the /, "");
  const same = candidates.filter((c) => key(c.name) === key(show.name));
  if (same.length === 0) return undefined;
  const year = yearOf(show.startDate) ?? yearOf(show.year);
  return (year && same.find((c) => yearOf(c.premiered) === year)) || same[0];
}

export interface PosterOption {
  /** Full-size picture: what gets stored and used as the Notion cover and icon. */
  url: string;
  label: string;
}

/** Only TVmaze's own image host: a stored cover can't point anywhere else. */
export const isTvmazeImage = (url: unknown): url is string => typeof url === "string" && !url.includes("..") && /^https:\/\/static\.tvmaze\.com\/uploads\/images\/[\w./-]+$/.test(url);

/** Posters TVmaze has for a show: the main one, season posters and alternates, without repeats. */
export function toPosterOptions(images: Raw[], seasons: Raw[]): PosterOption[] {
  const https = (u?: string) => u?.replace(/^http:/, "https:");
  const seen = new Set<string>();
  const out: PosterOption[] = [];
  const add = (url: string | undefined, label: string) => {
    const u = https(url);
    if (u && isTvmazeImage(u) && !seen.has(u)) {
      seen.add(u);
      out.push({ url: u, label });
    }
  };
  const posters = images.filter((i) => i.type === "poster");
  for (const i of posters.filter((p) => p.main)) add(i.resolutions?.original?.url, "Main");
  for (const s of [...seasons].sort((a, b) => a.number - b.number)) add(s.image?.original, `Season ${s.number}`);
  for (const i of posters.filter((p) => !p.main)) add(i.resolutions?.original?.url, "Alternate");
  return out;
}

export async function getPosterOptions(id: number): Promise<PosterOption[]> {
  const [images, seasons] = await Promise.all([getJson(`/shows/${id}/images`), getJson(`/shows/${id}/seasons`)]);
  return toPosterOptions(images, seasons);
}

/** Notion option names can't hold commas. */
const optionName = (name: unknown) => String(name ?? "").replace(/,/g, "").trim();

/** The main cast, in TVmaze's billing order. */
export function toCast(raw: Raw[], limit = 8): string[] {
  return [...new Set(raw.map((c) => optionName(c.person?.name)).filter(Boolean))].slice(0, limit);
}

/** Whoever TVmaze lists as the show's creator. */
export function toCreators(raw: Raw[]): string[] {
  return [...new Set(raw.filter((c) => c.type === "Creator").map((c) => optionName(c.person?.name)).filter(Boolean))];
}

export const getCast = async (id: number) => toCast(await getJson(`/shows/${id}/cast`));
export const getCreators = async (id: number) => toCreators(await getJson(`/shows/${id}/crew`));

/** "Still running" means not ended: airing now, or between seasons with no decision yet. */
export const isStillRunning = (status?: string) => status === "Running" || status === "To Be Determined";
