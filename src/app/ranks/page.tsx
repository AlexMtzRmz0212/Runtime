import type { Metadata } from "next";
import { RankEditor, type RankShow } from "@/components/RankEditor";
import { SetupError } from "@/components/SetupError";
import { yearLabel } from "@/lib/format";
import { getLibrary } from "@/lib/library";
import { ranked } from "@/lib/ranks";
import { summarize } from "@/lib/summary";
import type { ShowSummary } from "@/lib/types";

export const metadata: Metadata = { title: "Ranks" };
// Owner only (the proxy sends visitors to sign in), and always the current order.
export const dynamic = "force-dynamic";

const toRankShow = (s: ShowSummary): RankShow => ({ slug: s.slug, name: s.name, top: s.top, poster: s.poster, meta: [s.type, yearLabel(s)].filter(Boolean).join(", ") });

export default async function Ranks() {
  let shows: ShowSummary[];
  try {
    shows = summarize(await getLibrary({ fresh: true }));
  } catch (error) {
    return <SetupError error={error} />;
  }
  const list = ranked(shows).map(toRankShow);
  const others = shows.filter((s) => !s.top).sort((a, b) => a.name.localeCompare(b.name)).map(toRankShow);
  return <RankEditor list={list} others={others} />;
}
