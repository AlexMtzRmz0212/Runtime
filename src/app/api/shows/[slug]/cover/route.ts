import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { getStore } from "@/lib/store";
import { getPosterOptions, getShow, isTvmazeImage, pickBest, searchShows } from "@/lib/tvmaze";
import type { ShowPatch } from "@/lib/types";

type Params = { params: Promise<{ slug: string }> };

const done = () => {
  invalidateLibrary();
  revalidatePath("/", "layout");
};

/** The posters TVmaze has for this show (main, per season, alternates), for the Change cover picker. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const show = (await getLibrary({ fresh: true })).shows.find((s) => s.slug === slug);
    if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });

    let tvmazeId = show.tvmazeId;
    if (!tvmazeId) {
      const best = pickBest(await searchShows(show.name), show);
      if (!best) return NextResponse.json({ error: "Couldn't tell which TVmaze show this is. Use Fill episodes to pick it first." }, { status: 404 });
      tvmazeId = best.id;
    }
    const options = await getPosterOptions(tvmazeId);
    return NextResponse.json({ tvmazeId, current: show.poster, options });
  } catch (error) {
    return fail(error);
  }
}

/**
 * Give one show its cover. Body {url, tvmazeId?}: use that TVmaze picture (the Change cover picker). Body {refresh}: apply the
 * saved poster again, so a page with a cover but no icon gets its icon. No body: find a cover automatically, using the saved
 * TVmaze id or only an exact name match (same start year preferred), never a guess. Sets the Poster column, the page cover and icon.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const body = (await request.json().catch(() => ({}))) as { refresh?: boolean; url?: unknown; tvmazeId?: unknown };
    const show = (await getLibrary({ fresh: true })).shows.find((s) => s.slug === slug);
    if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });
    const store = getStore();

    if (body.url !== undefined) {
      if (!isTvmazeImage(body.url)) return NextResponse.json({ error: "That isn't a TVmaze picture" }, { status: 400 });
      const patch: ShowPatch = { poster: body.url };
      // Picking from this show's gallery confirms which TVmaze show it is, so remember it for Fill episodes.
      if (Number.isInteger(body.tvmazeId) && (body.tvmazeId as number) > 0 && show.tvmazeId !== body.tvmazeId) patch.tvmazeId = body.tvmazeId as number;
      await store.updateShows(show.pageIds, patch);
      done();
      return NextResponse.json({ status: "set" });
    }

    if (show.poster) {
      if (!body.refresh || show.hasIcon) return NextResponse.json({ status: "has" });
      await store.updateShows(show.pageIds, { poster: show.poster });
      done();
      return NextResponse.json({ status: "set" });
    }

    let poster: string | undefined;
    if (show.tvmazeId) {
      poster = (await getShow(show.tvmazeId)).poster;
    } else {
      const found = await searchShows(show.name);
      const best = pickBest(found, show);
      if (!best) return NextResponse.json({ status: "no-match", tried: found.slice(0, 3).map((c) => c.name) });
      poster = best.poster;
    }
    if (!poster) return NextResponse.json({ status: "no-image" });

    await store.updateShows(show.pageIds, { poster });
    done();
    return NextResponse.json({ status: "set" });
  } catch (error) {
    return fail(error);
  }
}
