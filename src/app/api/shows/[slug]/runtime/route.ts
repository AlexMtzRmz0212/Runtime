import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { getStore } from "@/lib/store";
import { getEpisodes, getShow, pickBest, searchShows, totalRuntime } from "@/lib/tvmaze";
import { today } from "@/lib/validate";

type Params = { params: Promise<{ slug: string }> };

/**
 * Work out one show's Runtime (the minutes of every aired episode, added up) from TVmaze and save it. Uses the saved TVmaze id,
 * or only an exact name match (same start year preferred), never a guess, like the automatic cover.
 */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const show = (await getLibrary({ fresh: true })).shows.find((s) => s.slug === slug);
    if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });

    let tvmazeId = show.tvmazeId;
    if (!tvmazeId) {
      const found = await searchShows(show.name);
      const best = pickBest(found, show);
      if (!best) return NextResponse.json({ status: "no-match", tried: found.slice(0, 3).map((c) => c.name) });
      tvmazeId = best.id;
    }
    const [tv, episodes] = await Promise.all([getShow(tvmazeId), getEpisodes(tvmazeId)]);
    const runtime = totalRuntime(episodes, tv.averageRuntime, today());
    if (runtime === undefined) return NextResponse.json({ status: "unknown" });
    if (runtime !== show.runtime) await getStore().updateShows(show.pageIds, { runtime });

    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ status: "set", runtime });
  } catch (error) {
    return fail(error);
  }
}
