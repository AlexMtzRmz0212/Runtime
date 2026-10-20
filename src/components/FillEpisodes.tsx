"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { describeRule, watchedRule } from "@/lib/fill";
import { fillEpisodes, type FillProgress } from "@/lib/fillClient";
import { plural } from "@/lib/format";
import { CandidateInfo, type TvmazeCandidate } from "./Candidate";
import { useOwner } from "./useOwner";
import { Bar, Spinner } from "./Progress";

interface Props {
  slug: string;
  name: string;
  tvmazeId?: number;
  hasEpisodes: boolean;
  status?: string;
  seasons?: number;
  currentSeason?: number;
  lastWatchedEpisode?: number;
}

type Phase = "idle" | "searching" | "choosing" | "filling" | "done";

/**
 * Owner-only: get a show's season and episode list from TVmaze and create it in Notion. The first time it asks which TVmaze
 * show is the right one (best guess preselected); after that it remembers and just tops up new episodes.
 */
export function FillEpisodes({ slug, name, tvmazeId, hasEpisodes, status, seasons, currentSeason, lastWatchedEpisode }: Props) {
  const owner = useOwner();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [query, setQuery] = useState(name);
  const [results, setResults] = useState<TvmazeCandidate[]>([]);
  const [picked, setPicked] = useState<number | undefined>();
  const [progress, setProgress] = useState<FillProgress>({ done: 0, total: 0, watched: 0 });
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  if (!owner) return null;

  async function search(q: string) {
    setError("");
    setPhase("searching");
    const res = await fetch(`/api/tvmaze/search?q=${encodeURIComponent(q)}&for=${encodeURIComponent(slug)}`, { cache: "no-store" }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { results?: TvmazeCandidate[]; best?: number; error?: string } | null;
    if (!res?.ok || !data?.results) {
      setError(data?.error ?? "Couldn't reach TVmaze");
      setPhase("choosing");
      return;
    }
    setResults(data.results);
    setPicked(data.best);
    setPhase("choosing");
  }

  async function run(id: number | undefined) {
    setError("");
    setPhase("filling");
    setProgress({ done: 0, total: 0, watched: 0 });
    try {
      const final = await fillEpisodes(slug, id, setProgress);
      setNote(final.done === 0 ? "Already up to date." : `Added ${plural(final.done, "episode")}${final.watched ? `, ${final.watched} marked watched` : ""}.`);
      setPhase("done");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPhase(tvmazeId ? "idle" : "choosing");
    }
  }

  const start = () => (tvmazeId ? run(undefined) : search(query));
  const label = hasEpisodes ? "Sync new episodes" : "Fill episodes";

  return (
    <section aria-labelledby="fill" className="mb-8 rounded-lg border border-border bg-panel p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="fill" className="font-display text-lg font-bold">{hasEpisodes ? "Episodes from TVmaze" : "No episode list yet"}</h2>
        {(phase === "idle" || phase === "done") && (
          <button className="btn btn-primary" onClick={start}>{label}</button>
        )}
        {phase === "done" && <span role="status" className="text-sm text-ok">{note}</span>}
      </div>
      {phase === "idle" && !hasEpisodes && (
        <p className="mt-2 text-sm text-muted">Gets every season and episode from TVmaze and creates them in your Episodes database.</p>
      )}

      {phase === "searching" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted" role="status">
          <Spinner /> Searching TVmaze…
        </p>
      )}

      {phase === "choosing" && (
        <div className="mt-3">
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim().length >= 2) search(query.trim());
            }}
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Search TVmaze</span>
              <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} />
            </label>
            <button className="btn">Search</button>
          </form>
          {results.length === 0 && !error && <p className="text-sm text-muted">No match for “{query}”. Try another spelling.</p>}
          {results.length > 0 && (
            <fieldset>
              <legend className="mb-2 text-sm text-muted">Which one is it?</legend>
              <ul className="flex flex-col gap-2">
                {results.map((c) => (
                  <li key={c.id}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-md border p-2.5 transition-colors ${picked === c.id ? "border-accent bg-accent/5" : "border-border hover:border-muted"}`}>
                      <input type="radio" name="tvmaze" className="accent-[var(--accent)]" checked={picked === c.id} onChange={() => setPicked(c.id)} />
                      <CandidateInfo c={c} />
                    </label>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-sm text-muted">{describeRule(watchedRule({ status, seasons, currentSeason, lastWatchedEpisode }))}</p>
              <div className="mt-3 flex gap-2">
                <button className="btn btn-primary" disabled={picked === undefined} onClick={() => run(picked)}>Fill with this one</button>
                <button className="btn" onClick={() => setPhase("idle")}>Cancel</button>
              </div>
            </fieldset>
          )}
        </div>
      )}

      {phase === "filling" && (
        <div className="mt-3" role="status" aria-live="polite">
          <p className="mb-2 flex items-center gap-2 text-sm text-muted">
            <Spinner />
            {progress.total > 0 ? `Creating episodes in Notion: ${progress.done} of ${progress.total}.` : "Reading the episode list from TVmaze…"} Keep this page open.
          </p>
          <Bar value={progress.total > 0 ? progress.done / progress.total : undefined} label="Creating episodes" />
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </section>
  );
}
