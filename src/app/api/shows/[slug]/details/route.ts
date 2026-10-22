import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getLibrary, invalidateLibrary } from "@/lib/library";
import { getStore } from "@/lib/store";
import { getCast, getCreators, getShow, onlyExisting, pickBest, searchShows } from "@/lib/tvmaze";

type Params = { params: Promise<{ slug: string }> };
const FIELDS = ["genres", "cast", "directors"] as const;
type Field = (typeof FIELDS)[number];

/**
 * Fill one of the show's columns from TVmaze: Genre (only options you already have, never new ones), Cast or
 * Director/Creator. What TVmaze has is added to what's there; nothing is removed. Uses the saved TVmaze id, or only an exact
 * name match. Body: { field: "genres" | "cast" | "directors" }.
 */
export async function POST(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const body = (await request.json().catch(() => ({}))) as { field?: unknown };
    if (!FIELDS.includes(body.field as Field)) return NextResponse.json({ error: "Unknown field" }, { status: 400 });
    const field = body.field as Field;

    const show = (await getLibrary({ fresh: true })).shows.find((s) => s.slug === slug);
    if (!show) return NextResponse.json({ error: "Show not found" }, { status: 404 });
    let tvmazeId = show.tvmazeId;
    if (!tvmazeId) {
      const best = pickBest(await searchShows(show.name), show);
      if (!best) return NextResponse.json({ error: "Couldn't tell which TVmaze show this is. Use Fill episodes to pick it first." }, { status: 404 });
      tvmazeId = best.id;
    }

    const store = getStore();
    const found =
      field === "genres" ? onlyExisting((await getShow(tvmazeId)).genres, (await store.choices()).genres) : field === "cast" ? await getCast(tvmazeId) : await getCreators(tvmazeId);
    const have = show[field];
    const added = found.filter((name) => !have.includes(name));
    if (added.length > 0) await store.updateShows(show.pageIds, { [field]: [...have, ...added] });

    invalidateLibrary();
    revalidatePath("/", "layout");
    return NextResponse.json({ added });
  } catch (error) {
    return fail(error);
  }
}
