import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProgressBar, StatusChip, progressText } from "@/components/Bits";
import { ChangeCover } from "@/components/ChangeCover";
import { Controls } from "@/components/Controls";
import { EpisodeBoard } from "@/components/EpisodeBoard";
import { Poster } from "@/components/Poster";
import { FillEpisodes } from "@/components/FillEpisodes";
import { PaceDial } from "@/components/PaceDial";
import { SetupError } from "@/components/SetupError";
import { ShowEditor } from "@/components/ShowEditor";
import { distanceOf, hours, minutesPerEpisode } from "@/lib/distance";
import { dayLabel, plural, score1, yearLabel } from "@/lib/format";
import { episodesByShow, getLibrary, type Library } from "@/lib/library";
import { recentPace } from "@/lib/pace";
import { aired, progressOf, sortEpisodes, splitsOf } from "@/lib/progress";
import { getStore } from "@/lib/store";
import { toPublicEpisode, toPublicShow } from "@/lib/types";
import { today } from "@/lib/validate";

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
  const subtitle = [show.type, yearLabel(show), show.seasons !== undefined && plural(show.seasons, "season")].filter(Boolean).join(", ");
  const day = today();
  const distance = distanceOf(found.runtime, progress);
  const finished = show.status === "Watched";
  // Aired and not watched yet: what the pace dial has left to run.
  const left = episodes.length > 0 ? aired(episodes, day).filter((e) => !e.watched).length : progress.source === "estimate" ? progress.total - progress.watched : 0;
  const finishedOn = episodes.flatMap((e) => (e.watched && e.watchedDate ? [e.watchedDate] : [])).sort().at(-1);

  // Poster on the left; beside it who the show is, then where you are on its course. On a phone the course runs full width
  // under the poster. Built once, then placed beside the episode feed.
  const header = (
    <header className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-5 gap-y-6 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-x-8">
      {/* The owner changes the cover from a small button on the poster itself. */}
      <div className="group relative self-start sm:row-span-2">
        <Poster url={show.poster} name={show.name} size="original" priority className="w-full" />
        <ChangeCover slug={show.slug} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
          <h1 className="page-title mb-0">{show.name}</h1>
          {show.top && <span className="rounded bg-ok px-2 py-1 text-sm font-bold text-ink" title="Top pick">Top #{Number(show.top)}</span>}
          {/* Owner tools open in a dialog from here, so they never push the episodes down. */}
          <div className="ml-auto">
            <Controls slug={show.slug}>
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
            </Controls>
          </div>
        </div>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        {show.genres.length > 0 && (
          <ul aria-label="Genres" className="mt-3 flex flex-wrap items-center gap-2">
            {show.genres.map((g) => (
              <li key={g} className="chip">{g}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
        <StatusChip status={show.status} />
        {progress.source !== "none" && (
          <>
            {/* The course: hours of the show still ahead (Runtime from TVmaze), or the share done when that isn't known. */}
            <div className="mt-3 mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className={`font-display text-4xl leading-none font-black tabular-nums ${finished ? "text-ok" : ""}`}>
                {distance ? (distance.done >= distance.total ? `${hours(distance.total)} run` : `${hours(distance.total - distance.done)} to go`) : `${progress.percent}%`}
              </span>
              <span className="text-sm text-muted">
                {distance && distance.done < distance.total && `${progress.percent}%, ${hours(distance.done)} of ${hours(distance.total)}, `}
                {progressText(progress)}
              </span>
              {progress.source === "estimate" && <span className="text-xs text-muted">(estimated from the current season)</span>}
            </div>
            <ProgressBar progress={progress} status={show.status} label={`${show.name} progress`} splits={splitsOf(episodes)} size="course" />
          </>
        )}
        {!finished && left > 0 && <PaceDial left={left} minutes={minutesPerEpisode(found.runtime, episodes, day)} today={day} recent={recentPace(episodes, day)} />}
        {finished && (
          <p className="mt-4 text-sm text-muted">
            Finished{finishedOn && <> on <time dateTime={finishedOn} className="text-text">{dayLabel(finishedOn)}</time></>}
            {episodes.length > 0 && `, ${plural(episodes.filter((e) => e.watched).length, "episode")}`}.{" "}
            <Link href="/finishers" className="text-text underline underline-offset-2">See the finishers</Link>
          </p>
        )}
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {show.score !== undefined && <Fact label="My score">{score1(show.score)}<span className="text-muted">&nbsp;/10</span></Fact>}
          {show.imdb !== undefined && <Fact label="IMDb">{score1(show.imdb)}<span className="text-muted">&nbsp;/10</span></Fact>}
          {show.directors.length > 0 && <Fact label="Creator">{show.directors.join(", ")}</Fact>}
          {show.cast.length > 0 && <Fact label="Cast">{show.cast.join(", ")}</Fact>}
        </dl>
      </div>
    </header>
  );

  return (
    <article>
      {episodes.length > 0 ? (
        <EpisodeBoard slug={show.slug} episodes={episodes.map(toPublicEpisode)} today={day} minutes={minutesPerEpisode(found.runtime, episodes, day)} header={header} />
      ) : (
        <>
          <div className="mb-10">{header}</div>
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
        </>
      )}
    </article>
  );
}
