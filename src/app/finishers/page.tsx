import { Star } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { SetupError } from "@/components/SetupError";
import { hours } from "@/lib/distance";
import { dayLabel, plural, posterSize, score1 } from "@/lib/format";
import { episodesByShow, getLibrary, type Library } from "@/lib/library";

export const revalidate = 900;
export const metadata: Metadata = { title: "Finishers" };

interface Finisher {
  slug: string;
  name: string;
  poster?: string;
  runtime?: number;
  seasons?: number;
  episodes: number;
  score?: number;
  finishedOn?: string;
}

/** Every show watched to the end, longest course first. */
function finishers({ shows, episodes }: Library): Finisher[] {
  const byShow = episodesByShow(episodes);
  return shows
    .filter((s) => s.status === "Watched")
    .map((s) => {
      const eps = byShow.get(s.pageId) ?? [];
      return {
        slug: s.slug,
        name: s.name,
        poster: s.poster,
        runtime: s.runtime,
        seasons: s.seasons,
        episodes: eps.filter((e) => e.watched).length,
        score: s.score,
        finishedOn: eps.flatMap((e) => (e.watched && e.watchedDate ? [e.watchedDate] : [])).sort().at(-1),
      };
    })
    .sort((a, b) => (b.runtime ?? -1) - (a.runtime ?? -1) || a.name.localeCompare(b.name));
}

export default async function Finishers() {
  let list: Finisher[];
  try {
    list = finishers(await getLibrary());
  } catch (error) {
    return <SetupError error={error} />;
  }
  const timed = list.filter((f) => f.runtime);
  const total = timed.reduce((n, f) => n + (f.runtime ?? 0), 0);

  return (
    <div>
      <h1 className="page-title mb-2">Finishers</h1>
      <p className="mb-12 max-w-prose text-muted">
        {list.length === 0
          ? "No show run to the end yet."
          : `${plural(list.length, "show")} run to the end${total > 0 ? `, ${hours(total)} in all${timed.length < list.length ? ` across the ${timed.length} with a known runtime` : ""}` : ""}. Longest course first.`}
      </p>

      {list.length > 0 && (
        <ol className="grid grid-cols-2 gap-x-4 gap-y-12 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((f) => (
            <li key={f.slug}>
              <Link href={`/show/${f.slug}`} className="medal group flex flex-col items-center text-center">
                {/* Hangs from its ribbon and swings a little when you point at it. */}
                <span aria-hidden className="medal-hang flex flex-col items-center">
                  <span className="medal-ribbon" />
                  <span className="-mt-2 grid size-32 place-items-center rounded-full bg-ok p-[7px] sm:size-40">
                    <span className="grid size-full place-items-center overflow-hidden rounded-full bg-ink ring-2 ring-ink/25">
                      {f.poster ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={posterSize(f.poster, "medium")} alt="" width={210} height={295} loading="lazy" decoding="async" className="size-full object-cover object-top" />
                      ) : (
                        <span className="font-display text-5xl font-black text-ok">{f.name.trim().slice(0, 1).toUpperCase()}</span>
                      )}
                    </span>
                  </span>
                </span>
                <h2 className="mt-4 text-base leading-tight font-bold break-words group-hover:underline group-hover:underline-offset-2">{f.name}</h2>
                {f.runtime ? <p className="mt-1.5 font-display text-4xl leading-none font-black text-ok tabular-nums">{hours(f.runtime)}</p> : null}
                <p className="mt-1.5 text-sm text-muted">
                  {[f.seasons && plural(f.seasons, "season"), f.episodes > 0 && plural(f.episodes, "episode")].filter(Boolean).join(", ") || "Length unknown"}
                </p>
                {(f.score !== undefined || f.finishedOn) && (
                  <p className="mt-1 flex flex-wrap items-center justify-center gap-x-3 text-sm tabular-nums">
                    {f.score !== undefined && (
                      <span className="inline-flex items-center gap-1" title="My score">
                        <Star size={12} weight="fill" aria-hidden />
                        <span className="sr-only">My score </span>
                        {score1(f.score)}
                      </span>
                    )}
                    {f.finishedOn && <time dateTime={f.finishedOn} className="text-muted">{dayLabel(f.finishedOn)}</time>}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
