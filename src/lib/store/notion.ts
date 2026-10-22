import { posterSize } from "../format";
import { mapLimit } from "../http";
import type { RawShow } from "../merge";
import type { Episode } from "../types";
import { episodesSource, notion, showsSource, type NotionAny } from "../notion/client";
import { SHOW } from "../notion/schema";
import { newEpisodeToProperties, newShowToProperties, pageToEpisode, pageToShow, showPatchToProperties, watchedToProperties, watchingToProperties } from "../notion/mapper";
import type { Store } from "./types";

async function queryAll(dataSourceId: string): Promise<NotionAny[]> {
  const pages: NotionAny[] = [];
  let cursor: string | undefined;
  do {
    const res: NotionAny = await notion().dataSources.query({ data_source_id: dataSourceId, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    pages.push(...(res.results as NotionAny[]).filter((p) => p.object === "page"));
    cursor = res.has_more ? (res.next_cursor as string) : undefined;
  } while (cursor);
  return pages;
}

const needEpisodes = async () => {
  const source = await episodesSource();
  if (!source) throw new Error("Set EPISODES_DATABASE_ID to track episodes");
  return source;
};

const imageOf = (url: string) => ({ type: "external" as const, external: { url } });
/** The poster is both the Notion page cover and its icon (the small size, which is all an icon needs). */
const artOf = (url: string) => ({ cover: imageOf(url), icon: imageOf(posterSize(url, "medium")) });

// Notion allows about 3 requests per second per integration.
const WRITE_CONCURRENCY = 3;

export const notionStore: Store = {
  async statusOptions() {
    return (await showsSource()).statusOptions;
  },

  async choices() {
    const { options } = await showsSource();
    return { genres: options[SHOW.genre] ?? [], types: options[SHOW.type] ?? [] };
  },

  async listShows(): Promise<RawShow[]> {
    const { dataSourceId, titleProp } = await showsSource();
    return (await queryAll(dataSourceId)).map((p) => pageToShow(p, titleProp)).filter((s) => s.name);
  },

  async listEpisodes(): Promise<Episode[]> {
    const source = await episodesSource();
    if (!source) return [];
    return (await queryAll(source.dataSourceId)).map((p) => pageToEpisode(p, source.titleProp)).filter((e): e is Episode => Boolean(e));
  },

  async updateShows(pageIds, patch) {
    const { statusType } = await showsSource();
    const properties = showPatchToProperties(patch, statusType);
    // The poster is also the Notion page cover and icon, so your Notion views show it too.
    const art = patch.poster === undefined ? {} : patch.poster ? artOf(patch.poster) : { cover: null, icon: null };
    await mapLimit(pageIds, WRITE_CONCURRENCY, (page_id) => notion().pages.update({ page_id, properties, ...art }));
  },

  async setWatched(episodePageIds, watched, date) {
    const properties = watchedToProperties(watched, date);
    await mapLimit(episodePageIds, WRITE_CONCURRENCY, (page_id) => notion().pages.update({ page_id, properties }));
  },

  async setWatching(episodePageIds, watching) {
    const properties = watchingToProperties(watching);
    await mapLimit(episodePageIds, WRITE_CONCURRENCY, (page_id) => notion().pages.update({ page_id, properties }));
  },

  async createShow(input) {
    const { dataSourceId, titleProp, statusType } = await showsSource();
    const page: NotionAny = await notion().pages.create({
      parent: { type: "data_source_id", data_source_id: dataSourceId },
      properties: newShowToProperties(input, titleProp, statusType),
      ...(input.poster ? artOf(input.poster) : {}),
    });
    return page.id;
  },

  async createEpisodes(showPageId, items, onCreated) {
    const { dataSourceId, titleProp } = await needEpisodes();
    await mapLimit(items, WRITE_CONCURRENCY, async (item) => {
      await notion().pages.create({
        parent: { type: "data_source_id", data_source_id: dataSourceId },
        properties: newEpisodeToProperties(showPageId, item, titleProp),
      });
      onCreated?.(item);
    });
  },
};
