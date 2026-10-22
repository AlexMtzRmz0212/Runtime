import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { episodesByShow, getLibrary, invalidateLibrary } from "@/lib/library";
import { getStore } from "@/lib/store";

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5000;

/** Mark one episode as started (on screen now) or not. Body: { show, season, episode, watching }. */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (typeof body.show !== "string" || !body.show) return NextResponse.json({ error: "Missing show" }, { status: 400 });
    if (!isInt(body.season) || !isInt(body.episode)) return NextResponse.json({ error: "Bad season or episode" }, { status: 400 });
    if (typeof body.watching !== "boolean") return NextResponse.json({ error: "watching must be true or false" }, { status: 400 });

    const library = await getLibrary({ fresh: true });
    const show = library.shows.find((s) => s.slug === body.show);
    if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });
    const episode = (episodesByShow(library.episodes).get(show.pageId) ?? []).find((e) => e.season === body.season && e.episode === body.episode);
    if (!episode) return NextResponse.json({ error: "Episode not found" }, { status: 404 });

    if (Boolean(episode.watching) !== body.watching) await getStore().setWatching([episode.pageId], body.watching);
    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ watching: body.watching });
  } catch (error) {
    return fail(error);
  }
}
