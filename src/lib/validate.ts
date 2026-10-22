import type { NewShow, ShowPatch } from "./types";

export const SHOW_TYPES = ["TV Series", "Mini Series", "Saga", "Anime", "Film Series"];

type Result<T> = { ok: true; value: T } | { ok: false; error: string };
const bad = (error: string): { ok: false; error: string } => ({ ok: false, error });

const isInt = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** YYYY-MM-DD where you watch: in TIME_ZONE ("America/Mexico_City") when set, else the server's own zone (UTC on Vercel). */
export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: process.env.TIME_ZONE || undefined });

/** Only the four fields the owner may edit; anything else in the body is ignored. */
export function parsePatch(body: Record<string, unknown>, statusOptions: string[]): Result<ShowPatch> {
  const patch: ShowPatch = {};
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || (statusOptions.length > 0 && !statusOptions.includes(body.status))) return bad("Unknown status");
    patch.status = body.status;
  }
  if (body.score !== undefined) {
    const s = body.score;
    if (s !== null && !(typeof s === "number" && s >= 0 && s <= 10)) return bad("Score must be between 0 and 10");
    patch.score = s as number | null;
  }
  if (body.currentSeason !== undefined) {
    if (body.currentSeason !== null && !isInt(body.currentSeason, 1, 100)) return bad("Season must be a whole number from 1 to 100");
    patch.currentSeason = body.currentSeason as number | null;
  }
  if (body.lastWatchedEpisode !== undefined) {
    if (body.lastWatchedEpisode !== null && !isInt(body.lastWatchedEpisode, 0, 2000)) return bad("Episode must be a whole number from 0 to 2000");
    patch.lastWatchedEpisode = body.lastWatchedEpisode as number | null;
  }
  if (Object.keys(patch).length === 0) return bad("Nothing to change");
  return { ok: true, value: patch };
}

export function parseNewShow(body: Record<string, unknown>, statusOptions: string[]): Result<NewShow> {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 200) return bad("Give the show a name (up to 200 characters)");
  const show: NewShow = { name };
  if (body.type !== undefined && body.type !== "") {
    if (typeof body.type !== "string" || !SHOW_TYPES.includes(body.type)) return bad("Unknown type");
    show.type = body.type;
  }
  if (body.status !== undefined && body.status !== "") {
    if (typeof body.status !== "string" || (statusOptions.length > 0 && !statusOptions.includes(body.status))) return bad("Unknown status");
    show.status = body.status;
  }
  if (body.episodesPerSeason !== undefined) {
    const eps = body.episodesPerSeason;
    if (!Array.isArray(eps) || eps.length > 40 || eps.some((n) => !isInt(n, 1, 300))) return bad("Episodes per season must be whole numbers, up to 40 seasons");
    if ((eps as number[]).reduce((a, b) => a + b, 0) > 1500) return bad("That is more than 1500 episodes");
    if (eps.length > 0) show.episodesPerSeason = eps as number[];
  }
  return { ok: true, value: show };
}

export interface EpisodeToggle {
  show: string;
  season?: number;
  episodes?: number[];
  /** Mark everything up to and including this episode (across seasons) as watched. */
  upTo?: { season: number; episode: number };
  watched: boolean;
  /** null: no watched date (used for bulk "up until here", where the real dates are unknown). */
  date: string | null;
}

export function parseToggle(body: Record<string, unknown>): Result<EpisodeToggle> {
  if (typeof body.show !== "string" || !body.show) return bad("Missing show");
  if (typeof body.watched !== "boolean") return bad("watched must be true or false");
  if (body.season !== undefined && !isInt(body.season, 0, 200)) return bad("Bad season");
  if (body.episodes !== undefined && (!Array.isArray(body.episodes) || body.episodes.length > 2000 || body.episodes.some((n) => !isInt(n, 0, 5000)))) return bad("Bad episode list");
  if (body.episodes !== undefined && body.season === undefined) return bad("Pass a season with the episode numbers");
  if (body.date !== undefined && !isDay(body.date)) return bad("Date must be YYYY-MM-DD");
  if (body.upTo !== undefined) {
    const u = body.upTo as { season?: unknown; episode?: unknown } | null;
    if (!u || typeof u !== "object" || !isInt(u.season, 0, 200) || !isInt(u.episode, 0, 5000)) return bad("Bad upTo");
    if (body.watched !== true) return bad("Up until here can only mark episodes as watched");
    if (body.season !== undefined || body.episodes !== undefined) return bad("Use upTo on its own");
    return { ok: true, value: { show: body.show, upTo: { season: u.season as number, episode: u.episode as number }, watched: true, date: null } };
  }
  return {
    ok: true,
    value: { show: body.show, season: body.season as number | undefined, episodes: body.episodes as number[] | undefined, watched: body.watched, date: (body.date as string | undefined) ?? today() },
  };
}
