/**
 * One-off: copy the per-show episode databases from another Notion account (or CSV exports of them) into the single
 * Episodes database of this app, linked to the right row of TV Shows.
 *
 *   npm run migrate                      dry run against SOURCE_NOTION_TOKEN: prints what would happen, writes nothing
 *   npm run migrate -- --apply           create the missing Episodes rows (safe to repeat: existing ones are skipped)
 *   npm run migrate -- --csv exports/    read *.csv files instead (file name = show name)
 *   npm run migrate -- --only "Lost"     only databases whose title contains this
 */
import { Client } from "@notionhq/client";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { episodesByShow, getLibrary, invalidateLibrary } from "../src/lib/library";
import { mapColumns, toEpisodeRow, type ColumnMap, type EpisodeRow, type SourceColumn } from "../src/lib/migrate/columns";
import { matchShow } from "../src/lib/migrate/match";
import { episodesSource, showsSource, type NotionAny } from "../src/lib/notion/client";
import { syncFields } from "../src/lib/progress";
import { getStore } from "../src/lib/store";

try {
  process.loadEnvFile(".env.local");
} catch {
  /* variables may come from the shell */
}

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const APPLY = flag("apply");
const CSV_DIR = option("csv");
const ONLY = option("only")?.toLowerCase();

interface SourceTable {
  title: string;
  columns: SourceColumn[];
  rows: Record<string, unknown>[];
}

const plain = (arr: NotionAny[] | undefined) => (arr ?? []).map((t) => t.plain_text ?? "").join("");

/** A Notion property as a plain value (formulas, relations and rollups are skipped). */
function flatten(prop: NotionAny): unknown {
  switch (prop?.type) {
    case "title":
      return plain(prop.title);
    case "rich_text":
      return plain(prop.rich_text);
    case "number":
    case "checkbox":
      return prop[prop.type];
    case "select":
    case "status":
      return prop[prop.type]?.name;
    case "date":
      return prop.date?.start;
    default:
      return undefined;
  }
}

async function queryAll(client: Client, dataSourceId: string): Promise<NotionAny[]> {
  const pages: NotionAny[] = [];
  let cursor: string | undefined;
  do {
    const res: NotionAny = await client.dataSources.query({ data_source_id: dataSourceId, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    pages.push(...(res.results as NotionAny[]).filter((p) => p.object === "page"));
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function notionTables(ownIds: Set<string>): Promise<SourceTable[]> {
  const token = process.env.SOURCE_NOTION_TOKEN;
  if (!token) throw new Error("Set SOURCE_NOTION_TOKEN (an integration in the other account, with the per-show databases shared with it), or pass --csv <folder>");
  const client = new Client({ auth: token });

  const found: NotionAny[] = [];
  let cursor: string | undefined;
  do {
    const res: NotionAny = await client.search({ filter: { property: "object", value: "data_source" }, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    found.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  const tables: SourceTable[] = [];
  for (const hit of found) {
    if (ownIds.has(hit.id)) continue; // never read this app's own databases as a source
    const ds: NotionAny = await client.dataSources.retrieve({ data_source_id: hit.id });
    let title = plain(ds.title);
    if (!title && ds.parent?.database_id) {
      const db: NotionAny = await client.databases.retrieve({ database_id: ds.parent.database_id });
      title = plain(db.title);
    }
    const columns = Object.entries<NotionAny>(ds.properties).map(([name, def]) => ({ name, type: def.type }));
    const pages = await queryAll(client, hit.id);
    const rows = pages.map((p) => Object.fromEntries(Object.entries<NotionAny>(p.properties).map(([name, prop]) => [name, flatten(prop)])));
    tables.push({ title, columns, rows });
  }
  return tables;
}

function csvTables(dir: string): SourceTable[] {
  return readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".csv"))
    .map((file) => {
      const parsed = Papa.parse<Record<string, string>>(readFileSync(path.join(dir, file), "utf8").replace(/^﻿/, ""), { header: true, skipEmptyLines: true });
      return { title: path.basename(file, path.extname(file)), columns: (parsed.meta.fields ?? []).map((name) => ({ name, type: "text" })), rows: parsed.data };
    });
}

const key = (e: { season: number; episode: number }) => `${e.season}x${e.episode}`;

async function main() {
  const store = getStore();
  if (!(await episodesSource())) throw new Error("Set EPISODES_DATABASE_ID in .env.local");

  const library = await getLibrary({ fresh: true });
  const existing = episodesByShow(library.episodes);
  const ownIds = new Set([(await showsSource()).dataSourceId, (await episodesSource())!.dataSourceId]);
  let tables = CSV_DIR ? csvTables(CSV_DIR) : await notionTables(ownIds);
  if (ONLY) tables = tables.filter((t) => t.title.toLowerCase().includes(ONLY));

  console.log(`${APPLY ? "APPLYING" : "DRY RUN (nothing is written; add --apply)"}: ${tables.length} source database(s), ${library.shows.length} shows in TV Shows\n`);

  interface Plan {
    table: SourceTable;
    map: ColumnMap;
    showName: string;
    toCreate: EpisodeRow[];
    pageId: string;
    pageIds: string[];
    status?: string;
  }
  const plans: Plan[] = [];
  const problems: string[] = [];
  const lines: string[][] = [["Source database", "Show", "Rows", "Have", "Create", "Watched", "Mapped columns"]];

  for (const table of tables) {
    const map = mapColumns(table.columns);
    const mapped = Object.entries(map).map(([k, v]) => `${k}=${v}`).join(" ");
    const match = matchShow(table.title, library.shows);
    if (!match.show) {
      problems.push(`"${table.title}": no show (${match.reason})`);
      lines.push([table.title, "—", String(table.rows.length), "", "", "", mapped]);
      continue;
    }
    if (!map.season || !map.episode) {
      problems.push(`"${table.title}": no season/episode column found. Columns: ${table.columns.map((c) => `${c.name} (${c.type})`).join(", ")}`);
      lines.push([table.title, match.show.name, String(table.rows.length), "", "", "", mapped || "(none)"]);
      continue;
    }

    const rows = new Map<string, EpisodeRow>();
    let skipped = 0;
    for (const raw of table.rows) {
      const row = toEpisodeRow(raw, map);
      if (!row) skipped++;
      else if (!rows.has(key(row)) || (row.watched && !rows.get(key(row))!.watched)) rows.set(key(row), row);
    }
    if (skipped > 0) problems.push(`"${table.title}": ${skipped} row(s) skipped, no usable season/episode number`);

    const have = new Set((existing.get(match.show.pageId) ?? []).map(key));
    const toCreate = [...rows.values()].filter((r) => !have.has(key(r)));
    plans.push({ table, map, showName: match.show.name, toCreate, pageId: match.show.pageId, pageIds: match.show.pageIds, status: match.show.status });
    lines.push([table.title + (match.how === "exact" ? "" : ` (${match.how})`), match.show.name, String(table.rows.length), String(have.size), String(toCreate.length), String(toCreate.filter((r) => r.watched).length), mapped]);
  }

  const widths = lines[0].map((_, i) => Math.min(40, Math.max(...lines.map((l) => l[i].length))));
  for (const l of lines) console.log(l.map((c, i) => (i === l.length - 1 ? c : c.slice(0, widths[i]).padEnd(widths[i]))).join("  "));
  if (problems.length > 0) console.log(`\n${problems.length} thing(s) need a look:\n${problems.map((p) => "  - " + p).join("\n")}`);

  const total = plans.reduce((n, p) => n + p.toCreate.length, 0);
  console.log(`\n${total} episode row(s) to create in ${plans.filter((p) => p.toCreate.length).length} show(s).`);
  if (!APPLY) return console.log("Nothing written. Review the table above, then run again with --apply.");

  const statusOptions = await store.statusOptions();
  for (const plan of plans.filter((p) => p.toCreate.length > 0)) {
    process.stdout.write(`${plan.showName}: creating ${plan.toCreate.length}… `);
    await store.createEpisodes(plan.pageId, plan.toCreate);
    // Bring the show's current season / last watched / status in line with the episodes it now has.
    invalidateLibrary();
    const after = episodesByShow((await getLibrary({ fresh: true })).episodes).get(plan.pageId) ?? [];
    const patch = syncFields({ status: plan.status }, after, statusOptions);
    if (Object.keys(patch).length > 0) await store.updateShows(plan.pageIds, patch);
    console.log("done");
  }
  console.log("Finished. Re-run without --apply to confirm there is nothing left to create.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

