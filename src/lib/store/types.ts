import type { RawShow } from "../merge";
import type { Episode, NewEpisode, NewShow, ShowPatch } from "../types";

/** Where shows and episodes live. */
export interface Store {
  /** Status names, in the order Notion defines them. */
  statusOptions(): Promise<string[]>;
  /** Options that already exist on TV Shows columns, so new shows reuse them instead of inventing new ones. */
  choices(): Promise<{ genres: string[]; platforms: string[]; types: string[] }>;
  /** Raw rows: duplicates are merged one level up (library.ts). */
  listShows(): Promise<RawShow[]>;
  listEpisodes(): Promise<Episode[]>;
  /** Apply the same edit to every row of a (merged) show. */
  updateShows(pageIds: string[], patch: ShowPatch): Promise<void>;
  setWatched(episodePageIds: string[], watched: boolean, date: string | null): Promise<void>;
  /** Returns the new show's page id. */
  createShow(input: NewShow): Promise<string>;
  createEpisodes(showPageId: string, items: NewEpisode[]): Promise<void>;
}
