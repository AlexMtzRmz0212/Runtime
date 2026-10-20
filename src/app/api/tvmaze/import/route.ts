import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { normalizeName } from "@/lib/merge";
import { getStore } from "@/lib/store";
import { getEpisodes, getShow, showFromTvmaze } from "@/lib/tvmaze";

/** Create the TV Shows row for a TVmaze show (name, dates, genres, platform...). Its episodes are filled in right after by /api/shows/<slug>/fill. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { tvmazeId?: unknown; status?: unknown };
    if (!Number.isInteger(body.tvmazeId) || (body.tvmazeId as number) < 1) return NextResponse.json({ error: "Missing show" }, { status: 400 });
    const store = getStore();
    const statusOptions = await store.statusOptions();
    const status = typeof body.status === "string" && statusOptions.includes(body.status) ? body.status : undefined;

    const [candidate, episodes, library, choices] = await Promise.all([getShow(body.tvmazeId as number), getEpisodes(body.tvmazeId as number), getLibrary({ fresh: true }), store.choices()]);
    const existing = library.shows.find((s) => normalizeName(s.name) === normalizeName(candidate.name));
    if (existing) return NextResponse.json({ error: `"${existing.name}" is already in the library`, slug: existing.slug }, { status: 409 });

    await store.createShow(showFromTvmaze(candidate, episodes, choices, status));
    invalidateLibrary();
    revalidatePath("/", "layout");
    const created = (await getLibrary({ fresh: true })).shows.find((s) => normalizeName(s.name) === normalizeName(candidate.name));
    return NextResponse.json({ slug: created?.slug, episodes: episodes.length }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
