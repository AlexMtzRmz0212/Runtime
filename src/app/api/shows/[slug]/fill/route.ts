import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { planFill, watchedRule } from "@/lib/fill";
import { syncFields } from "@/lib/progress";
import { episodesByShow, getLibrary, invalidateLibrary } from "@/lib/library";
import { getStore } from "@/lib/store";
import { getEpisodes, getShow, isStillRunning } from "@/lib/tvmaze";
import type { ShowPatch } from "@/lib/types";
import { today } from "@/lib/validate";

// One request creates at most BATCH episodes (Notion allows ~3 writes a second); the page calls again until nothing remains.
const BATCH = 40;
export const maxDuration = 60;

type Params = { params: Promise<{ slug: string }> };

/**
 * Fill (or top up) a show's Episodes from TVmaze. Safe to repeat: it only creates episodes the show doesn't have yet, and never
 * changes existing ones. Body: { tvmazeId } the first time; later calls reuse the id saved on the show.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const body = (await request.json().catch(() => ({}))) as { tvmazeId?: unknown };
    const library = await getLibrary({ fresh: true });
    const show = library.shows.find((s) => s.slug === slug);
    if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });

    const id = body.tvmazeId ?? show.tvmazeId;
    if (!Number.isInteger(id) || (id as number) < 1) return NextResponse.json({ error: "Pick the matching show on TVmaze first" }, { status: 400 });
    const tvmazeId = id as number;

    const listed = await getEpisodes(tvmazeId);
    if (listed.length === 0) return NextResponse.json({ error: "TVmaze has no episodes for that show yet" }, { status: 404 });

    const existing = episodesByShow(library.episodes).get(show.pageId) ?? [];
    const { toCreate } = planFill(existing, listed, watchedRule(show), today());
    const batch = toCreate.slice(0, BATCH);

    const store = getStore();
    if (batch.length > 0) await store.createEpisodes(show.pageId, batch);

    // Remember where the list came from, and fill in what the show row was missing. Existing values are kept.
    const patch: ShowPatch = {};
    if (show.tvmazeId !== tvmazeId) patch.tvmazeId = tvmazeId;
    if (show.seasons === undefined) patch.seasons = Math.max(...listed.map((e) => e.season));
    if (!show.startDate && listed[0]?.airDate) {
      patch.startDate = listed[0].airDate;
      patch.endDate = null;
    }
    const tv = await getShow(tvmazeId).catch(() => undefined);
    if (!show.poster && tv?.poster) patch.poster = tv.poster;

    // Once the list is complete: a running show you are caught up on is Waiting, and a Waiting show with a new episode out is In Progress
    // again. Anything else (like a Watched mini series whose later seasons you skipped) keeps the status you gave it.
    if (toCreate.length - batch.length === 0) {
      const all = [...existing, ...batch.map((e) => ({ season: e.season, episode: e.episode, watched: Boolean(e.watched), airDate: e.airDate }))];
      const status = syncFields(show, all, await store.statusOptions(), { today: today(), running: isStillRunning(tv?.status) }).status;
      if (status && (status === "Waiting" || show.status === "Waiting")) patch.status = status;
    }
    if (Object.keys(patch).length > 0) await store.updateShows(show.pageIds, patch);

    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ created: batch.length, watched: batch.filter((e) => e.watched).length, remaining: toCreate.length - batch.length, total: listed.length });
  } catch (error) {
    return fail(error);
  }
}
