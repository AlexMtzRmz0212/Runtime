import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { episodesByShow, getLibrary, invalidateLibrary } from "@/lib/library";
import { aired, syncFields } from "@/lib/progress";
import { getStore } from "@/lib/store";
import type { ShowPatch } from "@/lib/types";
import { parsePatch, today } from "@/lib/validate";

// Setting a long show to Watched marks every episode, one Notion write each.
export const maxDuration = 120;

type Params = { params: Promise<{ slug: string }> };

/** Edit the fields you own: status, score, current season, last watched episode. Applied to every duplicate row of the show. */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const store = getStore();
    const parsed = parsePatch(body, await store.statusOptions());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const library = await getLibrary({ fresh: true });
    const show = library.shows.find((s) => s.slug === slug);
    if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });

    let patch: ShowPatch = parsed.value;
    let marked = 0;
    // Changing the status to Watched means you have seen it all: mark every episode that has aired as watched too.
    if (patch.status === "Watched" && show.status !== "Watched") {
      const episodes = episodesByShow(library.episodes).get(show.pageId) ?? [];
      const todo = aired(episodes, today()).filter((e) => !e.watched);
      if (todo.length > 0) await store.setWatched(todo.map((e) => e.pageId), true, null);
      marked = todo.length;
      const done = new Set(todo.map((e) => e.pageId));
      // Current season / last watched episode follow the episodes; the status is the one you chose.
      const columns = syncFields(show, episodes.map((e) => (done.has(e.pageId) ? { ...e, watched: true } : e)), []);
      delete columns.status;
      patch = { ...columns, ...patch };
    }

    await store.updateShows(show.pageIds, patch);
    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, marked });
  } catch (error) {
    return fail(error);
  }
}
