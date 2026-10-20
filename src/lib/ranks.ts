/** The Top list: which shows you'd recommend first, stored in Notion's Top column as "01", "02", "03"… */

type Ranked = { slug: string; name: string; top?: string };
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** The most places the list can hold. */
export const MAX_RANKS = 99;

/** Place 6 is stored as "06", the way the Top column's options are named. */
export const rankLabel = (place: number) => String(place).padStart(2, "0");

/** Ranked shows in list order: by Top, then by name where two shows share a place. */
export function ranked<T extends Ranked>(shows: T[]): T[] {
  return shows.filter((s) => s.top).sort((a, b) => Number(a.top) - Number(b.top) || a.name.localeCompare(b.name));
}

/** Places held by more than one show, e.g. ["06"]. */
export function sharedRanks(shows: { top?: string }[]): string[] {
  const count = new Map<string, number>();
  for (const s of shows) if (s.top) count.set(s.top, (count.get(s.top) ?? 0) + 1);
  return [...count].filter(([, n]) => n > 1).map(([top]) => top);
}

/**
 * What to write so the shows in `order` hold 01, 02, 03… in that order and every other show leaves the list.
 * Only shows whose Top actually changes are returned, so saving costs one Notion write per moved show.
 */
export function rankChanges(shows: Ranked[], order: string[]): { slug: string; top: string | null }[] {
  const place = new Map(order.map((slug, i) => [slug, rankLabel(i + 1)]));
  return shows.flatMap((s) => {
    const top = place.get(s.slug) ?? null;
    return (s.top ?? null) === top ? [] : [{ slug: s.slug, top }];
  });
}

/** The new order sent by the Ranks screen: known show slugs, each once. */
export function parseOrder(body: Record<string, unknown>, slugs: Set<string>): Result<string[]> {
  const order = body.order;
  if (!Array.isArray(order) || order.some((s) => typeof s !== "string")) return { ok: false, error: "Send the list as an array of shows" };
  if (order.length > MAX_RANKS) return { ok: false, error: `The list holds up to ${MAX_RANKS} shows` };
  if (new Set(order).size !== order.length) return { ok: false, error: "A show is on the list twice" };
  const unknown = order.find((s) => !slugs.has(s));
  if (unknown) return { ok: false, error: `Show not found: ${unknown}` };
  return { ok: true, value: order as string[] };
}
