"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { describeRule, watchedRule } from "@/lib/fill";
import { fillEpisodes, type FillProgress } from "@/lib/fillClient";
import { plural } from "@/lib/format";
import { CandidateInfo, type TvmazeCandidate } from "./Candidate";
import { Bar, Spinner, Steps, type Step } from "./Progress";

type Stage = "creating" | "episodes" | "opening";

/** Search TVmaze, pick the show, and it creates the Notion row and all its episodes in one go, showing each step as it happens. */
export function AddFromSearch({ statusOptions, initialQuery = "" }: { statusOptions: string[]; initialQuery?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [status, setStatus] = useState(statusOptions.includes("Want to watch") ? "Want to watch" : (statusOptions[0] ?? ""));
  const [results, setResults] = useState<TvmazeCandidate[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<TvmazeCandidate | null>(null);
  const [stage, setStage] = useState<Stage>("creating");
  const [progress, setProgress] = useState<FillProgress>({ done: 0, total: 0, watched: 0 });
  const [error, setError] = useState("");

  async function runSearch(q: string) {
    if (q.length < 2) return;
    setSearching(true);
    setError("");
    const res = await fetch(`/api/tvmaze/search?q=${encodeURIComponent(q)}`, { cache: "no-store" }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { results?: TvmazeCandidate[]; error?: string } | null;
    if (res?.ok && data?.results) setResults(data.results);
    else setError(data?.error ?? "Couldn't reach TVmaze");
    setSearching(false);
  }

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    void runSearch(query.trim());
  };

  // Arriving from the library's "No shows match" button: fill in that search and run it straight away. The address bar is
  // read too, so it still works if the page props came from an older render.
  useEffect(() => {
    const q = (initialQuery || new URLSearchParams(window.location.search).get("q") || "").trim().slice(0, 100);
    if (q.length < 2) return;
    setQuery(q);
    void runSearch(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add(c: TvmazeCandidate) {
    setAdding(c);
    setStage("creating");
    setError("");
    setProgress({ done: 0, total: 0, watched: 0 });
    try {
      const res = await fetch("/api/tvmaze/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tvmazeId: c.id, status }) });
      const data = (await res.json().catch(() => null)) as { slug?: string; error?: string } | null;
      if (!res.ok || !data?.slug) throw new Error(data?.error ?? "Couldn't add the show");
      setStage("episodes");
      await fillEpisodes(data.slug, c.id, setProgress);
      setStage("opening");
      router.push(`/show/${data.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setAdding(null);
    }
  }

  if (adding) {
    const counting = progress.total > 0;
    const steps: Step[] = [
      { label: "Adding it to your library", state: stage === "creating" ? "active" : "done" },
      {
        label: "Creating its episodes in Notion",
        state: stage === "creating" ? "pending" : stage === "episodes" ? "active" : "done",
        detail: counting ? `${progress.done} of ${plural(progress.total, "episode")}` : "Reading the episode list from TVmaze…",
      },
      { label: "Opening the show", state: stage === "opening" ? "active" : "pending" },
    ];
    const value = stage === "episodes" && counting ? progress.done / progress.total : stage === "opening" ? 1 : undefined;
    return (
      <div className="max-w-2xl rounded-lg border border-border bg-panel p-5" role="status" aria-live="polite">
        <div className="mb-5 flex items-center gap-3">
          <CandidateInfo c={adding} />
        </div>
        <Steps steps={steps} />
        <div className="mt-5">
          <Bar value={value} label={`Adding ${adding.name}`} />
          <p className="mt-2 text-xs text-muted">Each episode is its own row in Notion, so long shows take a little while. Keep this page open.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={search} className="mb-4 flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1">
          <span className="label">Search TVmaze</span>
          <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Severance" autoFocus />
        </label>
        <label>
          <span className="label">Add as</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <button className="btn btn-primary" disabled={searching || query.trim().length < 2}>
          {searching && <Spinner onAccent />}
          {searching ? "Searching" : "Search"}
        </button>
      </form>

      {error && <p role="alert" className="mb-4 text-sm text-danger">{error}</p>}

      {results && results.length === 0 && <p className="text-muted">Nothing found for “{query}”.</p>}
      {results && results.length > 0 && (
        <>
          <p className="mb-3 text-sm text-muted">{describeRule(watchedRule({ status }))}</p>
          <ul className="flex flex-col gap-2">
            {results.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-panel p-3">
                <CandidateInfo c={c} />
                {c.inLibrary ? (
                  <Link href={`/show/${c.inLibrary}`} className="btn shrink-0">In library</Link>
                ) : (
                  <button className="btn btn-primary shrink-0" onClick={() => add(c)}>Add</button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
