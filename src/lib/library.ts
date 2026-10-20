import { attachEpisodes, mergeShows } from "./merge";
import { getStore } from "./store";
import type { Episode, Show } from "./types";

export interface Library {
  shows: Show[];
  episodes: Episode[];
}

// A burst of requests (marking a whole season, page + API) shares one read of Notion.
const TTL_MS = 15_000;
let cache: { at: number; value: Promise<Library> } | undefined;

export function getLibrary({ fresh = false } = {}): Promise<Library> {
  if (!fresh && cache && Date.now() - cache.at < TTL_MS) return cache.value;
  const value = (async () => {
    const store = getStore();
    const [rows, episodes] = await Promise.all([store.listShows(), store.listEpisodes()]);
    const shows = mergeShows(rows);
    return { shows, episodes: attachEpisodes(shows, episodes) };
  })();
  cache = { at: Date.now(), value };
  value.catch(() => {
    if (cache?.value === value) cache = undefined;
  });
  return value;
}

export const invalidateLibrary = () => {
  cache = undefined;
};

export function episodesByShow(episodes: Episode[]): Map<string, Episode[]> {
  const map = new Map<string, Episode[]>();
  for (const ep of episodes) {
    const list = map.get(ep.showPageId);
    if (list) list.push(ep);
    else map.set(ep.showPageId, [ep]);
  }
  return map;
}
