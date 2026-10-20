import { normalizeName } from "../merge";

export interface SourceColumn {
  name: string;
  /** Notion property type; "text" for CSV columns. */
  type: string;
}

export interface ColumnMap {
  title?: string;
  season?: string;
  episode?: string;
  watched?: string;
  watchedDate?: string;
  airDate?: string;
}

export interface EpisodeRow {
  season: number;
  episode: number;
  title: string;
  watched: boolean;
  watchedDate?: string;
  airDate?: string;
}

const norm = (s: string) => normalizeName(s);
const hasWord = (name: string, words: string[]) => norm(name).split(" ").some((w) => words.includes(w));

const TITLE_WORDS = ["title", "name", "nombre", "titulo"];
const SEASON_WORDS = ["season", "temporada", "temp", "s"];
const EPISODE_WORDS = ["episode", "ep", "eps", "episodio", "capitulo", "cap", "number", "numero", "num", "no", "e"];
const WATCHED_WORDS = ["watched", "seen", "visto", "vista", "done", "completed", "complete", "status", "estado", "check"];
const WATCHED_DATE_WORDS = ["watched", "seen", "visto", "vista"];
const AIR_WORDS = ["air", "aired", "release", "released", "estreno", "emision", "fecha", "date"];

/**
 * Guess which column is which from names and types. Anything it cannot find stays undefined and is reported by the
 * migration script instead of being guessed at silently.
 */
export function mapColumns(columns: SourceColumn[]): ColumnMap {
  const map: ColumnMap = {};
  const taken = new Set<string>();
  const pick = (key: keyof ColumnMap, test: (c: SourceColumn) => boolean) => {
    const found = columns.find((c) => !taken.has(c.name) && test(c));
    if (found) {
      map[key] = found.name;
      taken.add(found.name);
    }
  };
  const numeric = (c: SourceColumn) => c.type === "number" || c.type === "text" || c.type === "rich_text" || c.type === "select";

  pick("title", (c) => c.type === "title");
  pick("title", (c) => hasWord(c.name, TITLE_WORDS));
  pick("season", (c) => numeric(c) && hasWord(c.name, SEASON_WORDS) && !hasWord(c.name, TITLE_WORDS));
  pick("episode", (c) => numeric(c) && (hasWord(c.name, EPISODE_WORDS) || norm(c.name) === "") && !hasWord(c.name, TITLE_WORDS));
  pick("watchedDate", (c) => c.type === "date" && hasWord(c.name, WATCHED_DATE_WORDS));
  pick("watched", (c) => c.type === "checkbox" && hasWord(c.name, WATCHED_WORDS));
  pick("watched", (c) => c.type === "checkbox");
  pick("watched", (c) => (c.type === "status" || c.type === "select" || c.type === "text") && hasWord(c.name, WATCHED_WORDS));
  pick("airDate", (c) => c.type === "date" && hasWord(c.name, AIR_WORDS));
  return map;
}

const WATCHED_VALUES = new Set(["true", "yes", "y", "si", "sí", "x", "done", "watched", "visto", "vista", "completed", "complete", "1", "✓", "✔"]); // taste-skill-ignore: tick characters people type in Notion, not UI

export function isWatchedValue(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") return WATCHED_VALUES.has(value.trim().toLowerCase());
  return false;
}

const wholeNumber = (value: unknown): number | undefined => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value.trim().replace(/^[se]/i, "")) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : undefined;
};

const day = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const m = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
  return m?.[0];
};

/** One source row as an episode, or null when it has no usable season and episode number. */
export function toEpisodeRow(row: Record<string, unknown>, map: ColumnMap): EpisodeRow | null {
  if (!map.season || !map.episode) return null;
  const season = wholeNumber(row[map.season]);
  const episode = wholeNumber(row[map.episode]);
  if (season === undefined || episode === undefined) return null;
  const title = map.title && typeof row[map.title] === "string" ? (row[map.title] as string).trim() : "";
  const watched = map.watched ? isWatchedValue(row[map.watched]) : false;
  return {
    season,
    episode,
    title: title || `Episode ${episode}`,
    watched,
    watchedDate: watched && map.watchedDate ? day(row[map.watchedDate]) : undefined,
    airDate: map.airDate ? day(row[map.airDate]) : undefined,
  };
}
