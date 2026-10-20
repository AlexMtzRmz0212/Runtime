import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { episodesByShow, getLibrary, invalidateLibrary } from "@/lib/library";
import { airedAllWatched, isUpTo, syncFields } from "@/lib/progress";
import { getStore } from "@/lib/store";
import { getShow, isStillRunning } from "@/lib/tvmaze";
import { parseToggle, today } from "@/lib/validate";

export const maxDuration = 120;

/**
 * Tick or untick episodes of a show: one episode, a list within a season, a whole season, or (no season) the whole show;
 * or everything "up until here" (upTo), which only ticks.
 * Then the show's own columns (current season, last watched episode, status) follow.
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = parseToggle(body);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const { show: slug, season, episodes: numbers, upTo, watched, date } = parsed.value;

    const library = await getLibrary({ fresh: true });
    const show = library.shows.find((s) => s.slug === slug);
    if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });

    const all = episodesByShow(library.episodes).get(show.pageId) ?? [];
    const inScope = (e: (typeof all)[number]) => (upTo ? isUpTo(e, upTo.season, upTo.episode) : (season === undefined || e.season === season) && (!numbers || numbers.includes(e.episode)));
    const targets = all.filter((e) => inScope(e) && e.watched !== watched);
    if (all.length === 0) return NextResponse.json({ error: "This show has no episodes yet" }, { status: 404 });

    const store = getStore();
    if (targets.length > 0) {
      await store.setWatched(targets.map((e) => e.pageId), watched, date);
      const changed = new Set(targets.map((e) => e.pageId));
      const after = all.map((e) => (changed.has(e.pageId) ? { ...e, watched } : e));
      // Caught up on every episode that has aired: Waiting if the show is still running, Watched if it ended.
      const day = today();
      const running = airedAllWatched(after, day) && show.tvmazeId ? isStillRunning((await getShow(show.tvmazeId).catch(() => undefined))?.status) : false;
      const patch = syncFields(show, after, await store.statusOptions(), { today: day, running });
      if (Object.keys(patch).length > 0) await store.updateShows(show.pageIds, patch);
    }
    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ changed: targets.length });
  } catch (error) {
    return fail(error);
  }
}
