import { NextResponse } from "next/server";
import { fail } from "@/lib/api";
import { yearLabel } from "@/lib/format";
import { getLibrary } from "@/lib/library";

// Public: just what the quick-search popup lists (the same names, covers and statuses the public library shows).
export const revalidate = 60;

export async function GET() {
  try {
    const { shows } = await getLibrary();
    return NextResponse.json({ shows: shows.map((s) => ({ slug: s.slug, name: s.name, poster: s.poster, status: s.status, year: yearLabel(s) })) });
  } catch (error) {
    return fail(error);
  }
}
