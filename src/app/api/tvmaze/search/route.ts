import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { getLibrary } from "@/lib/library";
import { normalizeName } from "@/lib/merge";
import { pickBest, searchShows } from "@/lib/tvmaze";

/** Owner only (the proxy gates /api/tvmaze). Search TVmaze; each result says whether it is already in the library. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim();
    if (q.length < 2 || q.length > 100) return NextResponse.json({ error: "Type at least 2 characters" }, { status: 400 });

    const [found, library] = await Promise.all([searchShows(q), getLibrary()]);
    const bySlug = new Map(library.shows.map((s) => [normalizeName(s.name), s]));
    const results = found.slice(0, 8).map((c) => ({ ...c, inLibrary: bySlug.get(normalizeName(c.name))?.slug }));

    // Preselect for the "Fill episodes" button, which passes the show it is on.
    const forName = url.searchParams.get("for");
    const show = forName ? library.shows.find((s) => s.slug === forName) : undefined;
    const best = show ? pickBest(found, show)?.id : undefined;
    return NextResponse.json({ results, best });
  } catch (error) {
    return fail(error);
  }
}
