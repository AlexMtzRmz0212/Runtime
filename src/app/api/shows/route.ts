import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { normalizeName } from "@/lib/merge";
import { getStore } from "@/lib/store";
import { parseNewShow } from "@/lib/validate";

// Creating the Episodes rows of a long show takes a while (Notion allows ~3 writes a second).
export const maxDuration = 300;

/** Add a show, and optionally its episodes: [7, 13, 13] makes three seasons with that many episodes each. */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const store = getStore();
    const parsed = parseNewShow(body, await store.statusOptions());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const input = parsed.value;

    const { shows } = await getLibrary({ fresh: true });
    if (shows.some((s) => normalizeName(s.name) === normalizeName(input.name))) {
      return NextResponse.json({ error: `"${input.name}" is already in the library` }, { status: 409 });
    }

    const pageId = await store.createShow(input);
    invalidateLibrary();
    const episodes = (input.episodesPerSeason ?? []).flatMap((count, s) =>
      Array.from({ length: count }, (_, e) => ({ season: s + 1, episode: e + 1, title: `Episode ${e + 1}` })),
    );
    if (episodes.length > 0) await store.createEpisodes(pageId, episodes);
    invalidateLibrary();
    revalidatePath("/", "layout");
    const created = (await getLibrary({ fresh: true })).shows.find((s) => s.pageIds.includes(pageId));
    return NextResponse.json({ slug: created?.slug, episodes: episodes.length }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
