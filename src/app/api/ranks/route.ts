import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { parseOrder, rankChanges } from "@/lib/ranks";
import { getStore } from "@/lib/store";

export const maxDuration = 60;

/** Save the Top list in a new order: the shows sent hold 01, 02, 03…, every other show leaves the list. */
export async function PUT(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const library = await getLibrary({ fresh: true });
    const parsed = parseOrder(body, new Set(library.shows.map((s) => s.slug)));
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const bySlug = new Map(library.shows.map((s) => [s.slug, s]));
    const changes = rankChanges(library.shows, parsed.value);
    const store = getStore();
    // One show at a time: each write already fans out to the show's duplicate rows within Notion's rate limit.
    for (const change of changes) await store.updateShows(bySlug.get(change.slug)!.pageIds, { top: change.top });

    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, changed: changes.length });
  } catch (error) {
    return fail(error);
  }
}
