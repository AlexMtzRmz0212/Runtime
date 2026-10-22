import { Client } from "@notionhq/client";
import { optional, required } from "../env";
import { EPISODE, SHOW } from "./schema";

// The SDK's response types are very deep unions; the mapper validates shapes itself.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotionAny = any;

let client: Client | undefined;
export const notion = (): Client => (client ??= new Client({ auth: required("NOTION_TOKEN") }));

export interface Source {
  dataSourceId: string;
  titleProp: string;
  /** Existing property name -> type. */
  props: Record<string, string>;
  /** Option names of the Status column (Shows only), in Notion's order. */
  statusOptions: string[];
  statusType?: "status" | "select";
  /** Option names of every select / multi-select / status column. */
  options: Record<string, string[]>;
}

/** Notion queries "data sources" rather than databases: resolve a database id to its first data source and read its columns. */
export async function readSource(databaseId: string, n: Client = notion()): Promise<Source> {
  const db: NotionAny = await n.databases.retrieve({ database_id: databaseId });
  const dataSourceId: string = db.data_sources?.[0]?.id ?? databaseId;
  const ds: NotionAny = await n.dataSources.retrieve({ data_source_id: dataSourceId });
  const props: Record<string, string> = {};
  const options: Record<string, string[]> = {};
  let titleProp = "";
  for (const [name, def] of Object.entries<NotionAny>(ds.properties)) {
    props[name] = def.type;
    const list = def.multi_select?.options ?? def.select?.options ?? def.status?.options;
    if (list) options[name] = list.map((o: NotionAny) => o.name);
    if (def.type === "title") titleProp = name;
  }
  if (!titleProp) throw new Error("The Notion database has no title column");
  const statusDef = ds.properties.Status;
  const statusOptions: string[] = (statusDef?.status?.options ?? statusDef?.select?.options ?? []).map((o: NotionAny) => o.name);
  return { dataSourceId, titleProp, props, statusOptions, statusType: statusDef?.type, options };
}

let shows: Promise<Source> | undefined;
let episodes: Promise<Source | null> | undefined;

/** Cached for the process lifetime; reset on failure so a fixed .env.local is picked up. */
export function showsSource(): Promise<Source> {
  shows ??= ensureShowColumns().catch((error) => {
    shows = undefined;
    throw error;
  });
  return shows;
}

/** null when EPISODES_DATABASE_ID isn't set: the app then works from the Shows columns alone. */
export function episodesSource(): Promise<Source | null> {
  episodes ??= ensureEpisodeColumns().catch((error) => {
    episodes = undefined;
    throw error;
  });
  return episodes;
}

export function refreshSources() {
  shows = undefined;
  episodes = undefined;
}

/** Adds the columns the app needs on TV Shows (TVmaze id, Poster, Runtime), only when missing. Nothing is removed or renamed. */
async function ensureShowColumns(): Promise<Source> {
  const source = await readSource(required("SHOWS_DATABASE_ID"));
  const wanted: Record<string, NotionAny> = {
    [SHOW.tvmazeId]: { number: { format: "number" } },
    [SHOW.poster]: { url: {} },
    [SHOW.runtime]: { number: { format: "number" } },
  };
  const missing = Object.fromEntries(Object.entries(wanted).filter(([name]) => source.props[name] === undefined));
  if (Object.keys(missing).length > 0) {
    await notion().dataSources.update({ data_source_id: source.dataSourceId, properties: missing });
    for (const [name, def] of Object.entries(missing)) source.props[name] = Object.keys(def)[0];
  }
  return source;
}

/** Adds the columns the app needs to the Episodes database (never removes or renames anything). */
async function ensureEpisodeColumns(): Promise<Source | null> {
  const databaseId = optional("EPISODES_DATABASE_ID");
  if (!databaseId) return null;
  const source = await readSource(databaseId);
  const { dataSourceId: showsDataSourceId } = await showsSource();

  const missing: Record<string, NotionAny> = {};
  for (const { name, type } of Object.values(EPISODE)) {
    if (source.props[name] !== undefined) continue;
    if (type === "relation") missing[name] = { relation: { data_source_id: showsDataSourceId, type: "single_property", single_property: {} } };
    else missing[name] = { [type]: type === "number" ? { format: "number" } : {} };
  }
  if (Object.keys(missing).length > 0) {
    await notion().dataSources.update({ data_source_id: source.dataSourceId, properties: missing });
    for (const [name, def] of Object.entries(missing)) source.props[name] = Object.keys(def)[0];
  }
  return source;
}
