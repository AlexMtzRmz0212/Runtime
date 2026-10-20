import type { Episode, Show } from "./types";

/** Lowercase, no accents or punctuation: "Dr. House" and "dr house" are the same show. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const slugify = (name: string) => normalizeName(name).replace(/ /g, "-") || "show";

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (typeof v === "number" && Number.isNaN(v)) || (Array.isArray(v) && v.length === 0);

/** A raw Notion row, before merging. slug is filled in by mergeShows. */
export type RawShow = Omit<Show, "slug">;

/**
 * Rows with the same normalized name are one show. The oldest row is the base and the others only fill the fields
 * it leaves empty, so a half-empty newer copy never overrides the original.
 */
export function mergeShows(rows: RawShow[]): Show[] {
  const groups = new Map<string, RawShow[]>();
  for (const row of rows) {
    const key = normalizeName(row.name);
    if (!key) continue;
    const group = groups.get(key);
    if (group) group.push(row);
    else groups.set(key, [row]);
  }

  const used = new Set<string>();
  const out: Show[] = [];
  for (const group of groups.values()) {
    const sorted = [...group].sort((a, b) => (a.createdTime ?? "9999").localeCompare(b.createdTime ?? "9999"));
    const merged: RawShow = { ...sorted[0], pageIds: sorted.map((r) => r.pageId) };
    for (const other of sorted.slice(1)) {
      for (const key of Object.keys(other) as (keyof RawShow)[]) {
        if (key === "pageId" || key === "pageIds" || key === "createdTime") continue;
        if (isEmpty(merged[key]) && !isEmpty(other[key])) (merged as unknown as Record<string, unknown>)[key] = other[key];
      }
    }
    let slug = slugify(merged.name);
    for (let n = 2; used.has(slug); n++) slug = `${slugify(merged.name)}-${n}`;
    used.add(slug);
    out.push({ ...merged, slug });
  }
  return out;
}

/** Point every episode at the primary row of its (merged) show, and drop episodes of unknown shows. */
export function attachEpisodes(shows: Show[], episodes: Episode[]): Episode[] {
  const primary = new Map<string, string>();
  for (const show of shows) for (const id of show.pageIds) primary.set(id, show.pageId);
  const out: Episode[] = [];
  for (const ep of episodes) {
    const showPageId = primary.get(ep.showPageId);
    if (showPageId) out.push({ ...ep, showPageId });
  }
  return out;
}
