"use client";

import { Check, Play } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { duration } from "@/lib/distance";
import { dayLabel, plural } from "@/lib/format";
import { episodeLabel, isUpTo, seasonsOf, sortEpisodes } from "@/lib/progress";
import type { PublicEpisode } from "@/lib/types";
import { useOwner } from "./useOwner";

const localDay = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the browser's time zone
const key = (e: { season: number; episode: number }) => `${e.season}-${e.episode}`;
const seasonName = (season: number) => (season === 0 ? "Specials" : `Season ${season}`);
const seasonShort = (season: number) => (season === 0 ? "Sp" : `S${season}`);
const named = (e: PublicEpisode) => e.title && e.title !== `Episode ${e.episode}`;
const SAVE_FAILED = "Couldn't save that. Try again.";
/** Episodes listed under the next one in the feed. */
const QUEUE = 3;

type Change = { season: number; episodes?: number[]; upTo?: { season: number; episode: number }; watched: boolean };

async function send(url: string, body: object) {
  const res = await fetch(url, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? SAVE_FAILED);
}

/**
 * The show's episodes in two parts. First the feed: the next episode as a race bib (the owner starts it and ticks it watched,
 * and the one after steps up), with the few after it underneath; watched ones never show here. On a wide screen it sits in a
 * column beside `header` (the show's own header), under it on narrower ones. Then the seasons as buttons that open and fold
 * each season's episodes, for ticking anything by hand.
 */
export function EpisodeBoard({ slug, episodes: initial, today, minutes, header }: { slug: string; episodes: PublicEpisode[]; today: string; minutes?: number; header: React.ReactNode }) {
  const owner = useOwner();
  const router = useRouter();
  const [episodes, setEpisodes] = useState(initial);
  // The page re-renders on the server after every save (and after a status change marks episodes); follow what it sends.
  useEffect(() => setEpisodes(initial), [initial]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // After ticking episodes: which ones, so one click can take them back.
  const [undo, setUndo] = useState<PublicEpisode[] | null>(null);

  const sorted = useMemo(() => sortEpisodes(episodes), [episodes]);
  const seasons = useMemo(() => seasonsOf(episodes), [episodes]);
  const open = sorted.filter((e) => !e.watched && (!e.airDate || e.airDate <= today));
  // The one on screen comes first, else the first aired one not watched yet.
  const next = open.find((e) => e.watching) ?? open[0];
  const queue = open.filter((e) => e !== next).slice(0, QUEUE);
  const soon = next ? undefined : sorted.find((e) => !e.watched && e.airDate && e.airDate > today);

  // The feed already shows where you are, so the seasons start folded: a season's button opens its episodes, and pressing
  // it again folds them away.
  const [current, setCurrent] = useState<number | null>(null);

  async function save(before: PublicEpisode[], after: PublicEpisode[], request: () => Promise<void>, marked: PublicEpisode[] = []) {
    setEpisodes(after);
    setError("");
    setUndo(null);
    setBusy(true);
    try {
      await request();
      if (marked.length > 0) setUndo(marked);
      router.refresh();
    } catch (e) {
      setEpisodes(before);
      setError(e instanceof Error ? e.message : SAVE_FAILED);
    } finally {
      setBusy(false);
    }
  }

  function apply(change: Change) {
    const before = episodes;
    const date = change.upTo ? undefined : localDay();
    const affected = (e: PublicEpisode) => (change.upTo ? isUpTo(e, change.upTo.season, change.upTo.episode) : e.season === change.season && (!change.episodes || change.episodes.includes(e.episode)));
    const marked = change.watched ? before.filter((e) => affected(e) && !e.watched) : [];
    const after = before.map((e) => (affected(e) && !(change.upTo && e.watched) ? { ...e, watched: change.watched, watchedDate: change.watched ? date : undefined, watching: false } : e));
    return save(before, after, () => send("/api/episodes", change.upTo ? { show: slug, upTo: change.upTo, watched: true } : { show: slug, season: change.season, episodes: change.episodes, watched: change.watched, date }), marked);
  }

  function toggleWatching(ep: PublicEpisode) {
    const watching = !ep.watching;
    const after = episodes.map((e) => (key(e) === key(ep) ? { ...e, watching } : e));
    return save(episodes, after, () => send("/api/episodes/watching", { show: slug, season: ep.season, episode: ep.episode, watching }));
  }

  /** Untick exactly the episodes the last tick marked, one request per season. */
  async function takeBack(marked: PublicEpisode[]) {
    const keys = new Set(marked.map(key));
    setEpisodes((list) => list.map((e) => (keys.has(key(e)) ? { ...e, watched: false, watchedDate: undefined } : e)));
    setError("");
    setUndo(null);
    setBusy(true);
    try {
      for (const season of new Set(marked.map((e) => e.season))) {
        await send("/api/episodes", { show: slug, season, episodes: marked.filter((e) => e.season === season).map((e) => e.episode), watched: false });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : SAVE_FAILED);
    } finally {
      // Whatever got through, show what Notion has now.
      router.refresh();
      setBusy(false);
    }
  }

  if (episodes.length === 0) return null;

  const list = sorted.filter((e) => e.season === current);
  const season = seasons.find((s) => s.season === current);
  const allWatched = season ? season.watched === season.total : false;

  return (
    // Wide screens: the show's header on the left, and a column on the right with the feed and the seasons, never taller
    // than the screen; an open season scrolls inside it, so the page itself doesn't have to.
    <div className="grid gap-x-10 gap-y-12 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
      {header}

      <div className="flex flex-col gap-8 lg:sticky lg:top-24 lg:max-h-[calc(100vh-8rem)]">
        <section aria-labelledby="up-next" className="shrink-0">
          <h2 id="up-next" className="mb-3 font-display text-xl font-bold">Up next</h2>
          <div role="status" className="mb-2 empty:hidden text-sm text-muted">
            {busy && "Saving to Notion…"}
            {undo && !busy && (
              <p className="flex flex-wrap items-center gap-x-3">
                {undo.length === 1 ? `${episodeLabel(undo[0].season, undo[0].episode)} marked watched.` : `Marked ${plural(undo.length, "episode")} as watched.`}
                <button className="cursor-pointer font-medium text-text underline underline-offset-2 transition-colors hover:text-accent" onClick={() => takeBack(undo)}>
                  Undo
                </button>
              </p>
            )}
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
          {next ? (
            <div className={`rounded-lg border bg-panel transition-colors ${next.watching ? "border-accent" : "border-border"}`}>
              {/* The next episode wears the bib; the band turns course blue while it's on screen. */}
              <div className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-x-4 gap-y-4 p-3 sm:grid-cols-[9.5rem_minmax(0,1fr)_auto] sm:gap-x-6 sm:p-4 lg:grid-cols-[7.5rem_minmax(0,1fr)] lg:gap-x-4">
                <div className="bib flex flex-col overflow-hidden rounded-md">
                  <span className={`block px-3 py-1.5 text-center text-xs font-bold transition-colors font-stretch-semi-condensed ${next.watching ? "bg-accent text-ink" : "bg-ink/10 text-ink/70"}`}>
                    {next.watching ? "Watching" : "Next up"}
                  </span>
                  <span key={key(next)} className="rise block px-2 pt-2 pb-3.5 text-center font-display text-[2rem] leading-[0.85] font-black tabular-nums sm:text-[2.75rem] lg:text-[2.1rem]">
                    {episodeLabel(next.season, next.episode)}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-lg leading-tight font-bold break-words">{named(next) ? next.title : `Episode ${next.episode}`}</p>
                  <p className="mt-1 text-sm text-muted">
                    {[seasonName(next.season), minutes && duration(minutes), next.airDate && `aired ${dayLabel(next.airDate)}`].filter(Boolean).join(", ")}
                  </p>
                  <p className="mt-1 text-sm text-muted">{plural(open.length, "episode")} left to watch</p>
                </div>
                {owner && (
                  <div className="col-span-2 flex gap-2 sm:col-span-1 sm:flex-col lg:col-span-2 lg:flex-row">
                    <button
                      className={`btn flex-1 sm:flex-none ${next.watching ? "border-accent bg-accent/15" : ""}`}
                      aria-pressed={Boolean(next.watching)}
                      aria-label={`Watching ${episodeLabel(next.season, next.episode)}`}
                      title={next.watching ? "Mark as not started" : "Mark as started"}
                      disabled={busy}
                      onClick={() => toggleWatching(next)}
                    >
                      <Play size={14} weight={next.watching ? "fill" : "regular"} aria-hidden />
                      {next.watching ? "Watching" : "Start"}
                    </button>
                    <button className="btn btn-primary flex-1 sm:flex-none" disabled={busy} onClick={() => apply({ season: next.season, episodes: [next.episode], watched: true })}>
                      <Check size={14} weight="bold" aria-hidden />
                      Watched
                    </button>
                  </div>
                )}
              </div>
              {queue.length > 0 && (
                <ol aria-label="After that" className="px-2 pb-2 sm:px-3 sm:pb-3">
                  {queue.map((e) => (
                    <li key={key(e)} className="group/row flex items-center gap-3 rounded-md px-2 py-2 hover:bg-well/60 focus-within:bg-well/60">
                      <span className="w-16 shrink-0 font-display text-lg leading-none font-black tabular-nums text-muted">{episodeLabel(e.season, e.episode)}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{named(e) ? e.title : `Episode ${e.episode}`}</span>
                      {owner && (
                        <button
                          className="shrink-0 cursor-pointer rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap text-muted transition-colors hover:border-accent hover:text-text disabled:cursor-default pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-visible:opacity-100"
                          title={`Mark everything up until ${episodeLabel(e.season, e.episode)} as watched`}
                          disabled={busy}
                          onClick={() => apply({ season: e.season, upTo: { season: e.season, episode: e.episode }, watched: true })}
                        >
                          Up until here
                        </button>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-6 text-muted">
              {soon?.airDate ? (
                <>Caught up. {episodeLabel(soon.season, soon.episode)} airs <time dateTime={soon.airDate} className="text-warn">{dayLabel(soon.airDate)}</time>.</>
              ) : (
                "Every episode watched."
              )}
            </p>
          )}
        </section>

        <section aria-labelledby="episodes" className="flex min-h-0 flex-col">
          <h2 id="episodes" className="mb-3 font-display text-xl font-bold">Seasons</h2>
          <div className="-mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pt-1 pb-2 lg:flex-wrap lg:overflow-visible">
            {seasons.map((s) => {
              const on = s.season === current;
              const done = s.watched === s.total;
              return (
                <button
                  key={s.season}
                  id={`tab-${s.season}`}
                  aria-expanded={on}
                  aria-controls={on ? "season-panel" : undefined}
                  aria-label={`${seasonName(s.season)}, ${s.watched} of ${s.total} watched`}
                  onClick={() => setCurrent(on ? null : s.season)}
                  className={`flex w-16 shrink-0 cursor-pointer flex-col items-start lg:w-[3.6rem] gap-1.5 rounded-md px-2.5 pt-2 pb-2.5 transition-colors ${on ? "bg-paper text-ink" : "bg-panel text-text hover:bg-well"}`}
                >
                  <span className="font-display text-xl leading-none font-black">{seasonShort(s.season)}</span>
                  <span className="text-xs tabular-nums opacity-70">{s.watched}/{s.total}</span>
                  <span aria-hidden className={`h-1 w-full overflow-hidden rounded-full ${on ? "bg-ink/12" : "bg-well"}`}>
                    <span className={`block h-full rounded-full ${done ? "bg-ok" : "bg-accent"}`} style={{ width: `${(s.watched / s.total) * 100}%` }} />
                  </span>
                </button>
              );
            })}
          </div>

          {current !== null && (
            <div role="region" id="season-panel" aria-labelledby={`tab-${current}`} className="rounded-lg border border-border bg-panel px-2 py-2 sm:px-4 sm:py-3 lg:min-h-48 lg:flex-1 lg:overflow-y-auto lg:px-2">
              <ol>
                {list.map((e) => {
                  const code = episodeLabel(e.season, e.episode);
                  const isNext = next && key(e) === key(next);
                  const box = `grid size-7 shrink-0 place-items-center rounded-md border ${e.watched ? "border-ok bg-ok text-ink" : "border-border text-transparent"}`; // taste-skill-ignore: a ticked checkbox, and an unticked one hides its tick
                  return (
                    // Long seasons: rows off screen skip layout and paint until they scroll near.
                    <li key={e.episode} className={`group/row flex items-start gap-3 rounded-md px-2 py-1.5 [contain-intrinsic-size:auto_2.5rem] [content-visibility:auto] hover:bg-well/60 focus-within:bg-well/60 ${isNext ? "bg-accent/10" : ""}`}>
                      {owner ? (
                        <button
                          className={`${box} cursor-pointer transition-colors hover:border-accent disabled:cursor-default`}
                          aria-label={`${code} ${e.title} watched`}
                          aria-pressed={e.watched}
                          disabled={busy}
                          onClick={() => apply({ season: e.season, episodes: [e.episode], watched: !e.watched })}
                        >
                          <Check size={14} weight="bold" aria-hidden />
                        </button>
                      ) : (
                        <span className={box} role="img" aria-label={e.watched ? "Watched" : "Not watched"}>
                          <Check size={14} weight="bold" aria-hidden />
                        </span>
                      )}
                      <span className="w-7 shrink-0 pt-0.5 text-right text-sm text-muted tabular-nums">{e.episode}</span>
                      <span className={`min-w-0 flex-1 pt-0.5 text-sm break-words ${e.watched ? "text-muted" : "text-text"}`}>
                        {e.title}
                        {e.watching && !e.watched && <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold text-accent"><span aria-hidden className="size-1.5 rounded-full bg-accent" />Watching</span>}
                        {isNext && !e.watching && <span className="ml-2 text-xs font-semibold text-accent">Next up</span>}
                        {e.watchedDate && <time dateTime={e.watchedDate} className="ml-2 text-xs text-muted">{dayLabel(e.watchedDate)}</time>}
                        {!e.watched && e.airDate && e.airDate > today && <span className="ml-2 text-xs text-warn">airs {dayLabel(e.airDate)}</span>}
                      </span>
                      {owner && !e.watched && (
                        // Shown on hover where there is a mouse; always shown on touch screens, which can't hover.
                        <button
                          className="shrink-0 cursor-pointer rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap text-muted transition-colors hover:border-accent hover:text-text disabled:cursor-default pointer-fine:opacity-0 pointer-fine:group-hover/row:opacity-100 pointer-fine:focus-visible:opacity-100"
                          title={`Mark everything up until ${code} as watched`}
                          disabled={busy}
                          onClick={() => apply({ season: e.season, upTo: { season: e.season, episode: e.episode }, watched: true })}
                        >
                          Up until here<span className="sr-only"> ({code})</span>
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
              {owner && season && (
                <button
                  className="btn mt-3 ml-2"
                  disabled={busy}
                  onClick={() => {
                    // Unticking throws away the watched dates, so it asks first.
                    if (allWatched && !window.confirm(`Unmark all ${plural(season.total, "episode")} of ${seasonName(season.season)}? Their watched dates will be lost.`)) return;
                    apply({ season: season.season, watched: !allWatched });
                  }}
                >
                  {allWatched ? "Unmark season" : "Mark season watched"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
