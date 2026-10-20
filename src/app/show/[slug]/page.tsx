import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar, StatusChip, progressText } from "@/components/Bits";
import { ChangeCover } from "@/components/ChangeCover";
import { EpisodeBoard } from "@/components/EpisodeBoard";
import { Poster } from "@/components/Poster";
import { FillEpisodes } from "@/components/FillEpisodes";
import { SetupError } from "@/components/SetupError";
import { ShowEditor } from "@/components/ShowEditor";
import { score1, yearLabel } from "@/lib/format";
import { episodesByShow, getLibrary, type Library } from "@/lib/library";
import { episodeLabel, nextUp, progressOf, sortEpisodes, splitsOf } from "@/lib/progress";
import { getStore } from "@/lib/store";
import { toPublicEpisode, toPublicShow } from "@/lib/types";

export const revalidate = 900;

type Props = { params: Promise<{ slug: string }> };

// No pages are built ahead of time, but with this each show page is generated on first visit and then cached like the
// others (revalidate above) instead of re-reading Notion on every request.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const show = await getLibrary().then((l) => l.shows.find((s) => s.slug === slug)).catch(() => undefined);
  return { title: show?.name ?? "Show" };
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  );
}

export default async function ShowPage({ params }: Props) {
  const { slug } = await params;
  let library: Library;
  let statusOptions: string[];
  try {
    library = await getLibrary();
    statusOptions = await getStore().statusOptions();
  } catch (error) {
    return <SetupError error={error} />;
  }
  const found = library.shows.find((s) => s.slug === slug);
  if (!found) notFound();

  const show = toPublicShow(found);
  const episodes = sortEpisodes(episodesByShow(library.episodes).get(found.pageId) ?? []);
  const progress = progressOf(found, episodes);
  const next = nextUp(found, episodes);
  const subtitle = [show.type, yearLabel(show), show.platforms.join(", ")].filter(Boolean).join(", ");

  return (
    <article>
      <Link href="/" className="mb-6 inline-block text-sm text-muted transition-colors hover:text-text">← Library</Link>
      {/* Poster on the left; beside it who the show is, then where you are on its course. On a phone the course runs
          full width under the poster. */}
      <header className="mb-10 grid grid-cols-[7rem_minmax(0,1fr)] gap-x-5 gap-y-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-8">
        <Poster url={show.poster} name={show.name} size="original" priority className="w-full self-start sm:row-span-2" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
            <h1 className="page-title mb-0">{show.name}</h1>
            {show.top && <span className="rounded bg-ok px-2 py-1 text-sm font-bold text-ink" title="Top pick">Top #{Number(show.top)}</span>}
          </div>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <StatusChip status={show.status} />
            {show.genres.map((g) => (
              <span key={g} className="chip">{g}</span>
            ))}
          </div>
          <ChangeCover slug={show.slug} />
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
          {progress.source !== "none" && (
            <>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-display text-4xl leading-none font-black tabular-nums">{progress.percent}%</span>
                <span className="text-sm text-muted">{progressText(progress)}</span>
                {progress.source === "estimate" && <span className="text-xs text-muted">(estimated from the current season)</span>}
              </div>
              <ProgressBar progress={progress} status={show.status} label={`${show.name} progress`} splits={splitsOf(episodes)} size="course" />
            </>
          )}
          {next && show.status !== "Watched" && (
            <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
              Next up
              <span className="bib bib-sm rounded-[3px] px-3 pt-1.5 pb-1 font-display text-2xl leading-none font-black tabular-nums">{episodeLabel(next.season, next.episode)}</span>
              {next.title && next.title !== `Episode ${next.episode}` && <span className="text-text">{next.title}</span>}
            </p>
          )}
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {show.score !== undefined && <Fact label="My score">{score1(show.score)}<span className="text-muted">&nbsp;/10</span></Fact>}
            {show.imdb !== undefined && <Fact label="IMDb">{score1(show.imdb)}<span className="text-muted">&nbsp;/10</span></Fact>}
            {show.seasons !== undefined && <Fact label="Seasons">{show.seasons}</Fact>}
            {show.directors.length > 0 && <Fact label="Creator">{show.directors.join(", ")}</Fact>}
            {show.cast.length > 0 && <Fact label="Cast">{show.cast.join(", ")}</Fact>}
          </dl>
        </div>
      </header>

      <ShowEditor
        key={`${show.status}-${show.score}-${show.currentSeason}-${show.lastWatchedEpisode}`}
        slug={show.slug}
        statusOptions={statusOptions}
        status={show.status}
        score={show.score}
        currentSeason={show.currentSeason}
        lastWatchedEpisode={show.lastWatchedEpisode}
        hasEpisodes={episodes.length > 0}
      />

      <FillEpisodes
        slug={show.slug}
        name={show.name}
        tvmazeId={show.tvmazeId}
        hasEpisodes={episodes.length > 0}
        status={show.status}
        seasons={show.seasons}
        currentSeason={show.currentSeason}
        lastWatchedEpisode={show.lastWatchedEpisode}
      />

      {episodes.length > 0 ? (
        <EpisodeBoard slug={show.slug} episodes={episodes.map(toPublicEpisode)} />
      ) : (
        <section aria-labelledby="where">
          <h2 id="where" className="mb-3 font-display text-xl font-bold">Where I am</h2>
          <p className="text-muted">
            {show.currentSeason !== undefined
              ? `Season ${show.currentSeason}${show.lastWatchedEpisode !== undefined ? `, episode ${show.lastWatchedEpisode}${show.episodesOfCurrentSeason ? ` of ${show.episodesOfCurrentSeason}` : ""}` : ""}.`
              : show.status === "Watched"
                ? "All watched."
                : "No episode list for this show."}
          </p>
        </section>
      )}
    </article>
  );
}
