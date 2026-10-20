import { Star } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { ProgressBar, StatusChip } from "@/components/Bits";
import { Poster } from "@/components/Poster";
import { SetupError } from "@/components/SetupError";
import { score1, yearLabel } from "@/lib/format";
import { getLibrary } from "@/lib/library";
import { ranked } from "@/lib/ranks";
import { summarize } from "@/lib/summary";
import type { ShowSummary } from "@/lib/types";

export const revalidate = 900;
export const metadata: Metadata = { title: "Top" };

export default async function Top() {
  let shows: ShowSummary[];
  try {
    shows = summarize(await getLibrary());
  } catch (error) {
    return <SetupError error={error} />;
  }
  const list = ranked(shows);

  return (
    <div>
      <h1 className="page-title">Top</h1>
      <p className="mb-8 max-w-prose text-muted">The shows I’d recommend first, in order.</p>
      {list.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-10 text-center text-muted">Nothing ranked yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {list.map((s) => (
            <li key={s.slug}>
              <Link href={`/show/${s.slug}`} className="flex items-center gap-4 rounded-lg border border-border bg-panel p-4 transition-colors hover:border-muted sm:gap-6 sm:p-5">
                <span className="w-12 shrink-0 text-center font-display text-5xl leading-none font-black text-ok tabular-nums sm:w-16 sm:text-6xl">
                  <span className="sr-only">Number </span>
                  {Number(s.top)}
                </span>
                <Poster url={s.poster} name={s.name} className="w-12 shrink-0 sm:w-14" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg leading-tight font-bold">{s.name}</span>
                  <span className="mb-2 block text-sm text-muted">{[s.type, yearLabel(s), s.genres.slice(0, 3).join(", ")].filter(Boolean).join(", ")}</span>
                  <span className="block max-w-xs">
                    {s.progress.source !== "none" && <ProgressBar progress={s.progress} status={s.status} label={`${s.name} progress`} splits={s.splits} />}
                  </span>
                </span>
                <span className="hidden shrink-0 flex-col items-end gap-2 sm:flex">
                  <StatusChip status={s.status} />
                  {s.score !== undefined && <span className="inline-flex items-center gap-1 text-sm tabular-nums" title="My score"><Star size={12} weight="fill" aria-hidden /><span className="sr-only">My score </span>{score1(s.score)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
