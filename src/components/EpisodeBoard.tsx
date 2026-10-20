"use client";

import { Check } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isUpTo, seasonsOf, sortEpisodes } from "@/lib/progress";
import type { PublicEpisode } from "@/lib/types";
import { useOwner } from "./useOwner";

const localDay = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in the browser's time zone

type Change = { season: number; episodes?: number[]; upTo?: { season: number; episode: number }; watched: boolean };

/** Seasons, each a list of episodes with their names. Visitors see what's watched; the signed-in owner can tick episodes, whole seasons, or everything up until an episode. */
export function EpisodeBoard({ slug, episodes: initial }: { slug: string; episodes: PublicEpisode[] }) {
  const owner = useOwner();
  const router = useRouter();
  const [episodes, setEpisodes] = useState(initial);
  // The page re-renders on the server after every save (and after a status change marks episodes); follow what it sends.
  useEffect(() => setEpisodes(initial), [initial]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const seasons = useMemo(() => seasonsOf(episodes), [episodes]);
  const sorted = useMemo(() => sortEpisodes(episodes), [episodes]);
  // Open the season being watched: the first with something left to watch.
  const openSeason = seasons.find((s) => s.watched < s.total)?.season ?? seasons[seasons.length - 1]?.season;

  async function apply(change: Change) {
    const before = episodes;
    const date = change.upTo ? undefined : localDay();
    const affected = (e: PublicEpisode) => (change.upTo ? isUpTo(e, change.upTo.season, change.upTo.episode) : e.season === change.season && (!change.episodes || change.episodes.includes(e.episode)));
    setEpisodes(before.map((e) => (affected(e) && !(change.upTo && e.watched) ? { ...e, watched: change.watched, watchedDate: change.watched ? date : undefined } : e)));
    setError("");
    setBusy(true);
    try {
      const body = change.upTo ? { show: slug, upTo: change.upTo, watched: true } : { show: slug, season: change.season, episodes: change.episodes, watched: change.watched, date };
      const res = await fetch("/api/episodes", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't save that");
      router.refresh();
    } catch (e) {
      setEpisodes(before);
      setError(e instanceof Error ? e.message : "Couldn't save that");
    } finally {
      setBusy(false);
    }
  }

  if (episodes.length === 0) return null;

  return (
    <section aria-labelledby="episodes">
      <h2 id="episodes" className="mb-3 font-display text-xl font-bold">Episodes</h2>
      {busy && <p role="status" className="mb-3 text-sm text-muted">Saving to Notion…</p>}
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      <div className="divide-y divide-border rounded-lg border border-border bg-panel">
        {seasons.map((s) => {
          const list = sorted.filter((e) => e.season === s.season);
          const all = s.watched === s.total;
          return (
            <details key={s.season} open={s.season === openSeason} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 select-none">
                <span className="font-semibold">{s.season === 0 ? "Specials" : `Season ${s.season}`}</span>
                <span className="text-sm text-muted tabular-nums">{s.watched}/{s.total}</span>
                <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-well">
                  <span className={`block h-full rounded-full ${all ? "bg-ok" : "bg-accent"}`} style={{ width: `${(s.watched / s.total) * 100}%` }} />
                </span>
                <span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span>
              </summary>
              <div className="px-2 pb-4 sm:px-4">
                <ol>
                  {list.map((e) => {
                    const code = `S${e.season}E${e.episode}`;
                    const box = `grid size-7 shrink-0 place-items-center rounded-md border ${e.watched ? "border-ok/50 bg-ok/15 text-ok" : "border-border text-transparent"}`;
                    return (
                      <li key={e.episode} className="group/row flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-well/60 focus-within:bg-well/60">
                        {owner ? (
                          <button
                            className={`${box} cursor-pointer transition-colors hover:border-accent disabled:cursor-default`}
                            aria-label={`${code} ${e.title}: ${e.watched ? "watched, click to unmark" : "not watched, click to mark watched"}`}
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
                          {e.watchedDate && <span className="ml-2 text-xs text-muted">{e.watchedDate}</span>}
                        </span>
                        {owner && (
                          <button
                            className="shrink-0 cursor-pointer rounded-md border border-border px-2 py-1 text-xs whitespace-nowrap text-muted transition-colors hover:border-accent hover:text-text focus-visible:opacity-100 disabled:cursor-default sm:opacity-0 sm:group-hover/row:opacity-100"
                            aria-label={`Mark everything up until ${code} as watched`}
                            title={`Mark everything up until ${code} as watched`}
                            disabled={busy}
                            onClick={() => apply({ season: e.season, upTo: { season: e.season, episode: e.episode }, watched: true })}
                          >
                            Up until here
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ol>
                {owner && (
                  <button className="btn mt-3 ml-2" disabled={busy} onClick={() => apply({ season: s.season, watched: !all })}>
                    {all ? "Unmark season" : "Mark season watched"}
                  </button>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </section>
  );
}
