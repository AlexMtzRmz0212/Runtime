"use client";

import { Funnel, Star } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { plural, score1, yearLabel } from "@/lib/format";
import type { ShowSummary } from "@/lib/types";
import { ProgressBar, StatusChip, progressText } from "./Bits";
import { FetchCovers } from "./FetchCovers";
import { useFindKey } from "./useFindKey";
import { useOwner } from "./useOwner";
import { Poster } from "./Poster";

type Sort = "top" | "score" | "imdb" | "name" | "progress";

const SORTS: { value: Sort; label: string }[] = [
  { value: "top", label: "Top picks" },
  { value: "score", label: "My score" },
  { value: "imdb", label: "IMDb" },
  { value: "progress", label: "Progress" },
  { value: "name", label: "Name" },
];

const num = (n?: number) => n ?? -1;

const sorters: Record<Sort, (a: ShowSummary, b: ShowSummary) => number> = {
  top: (a, b) => (a.top ?? "99").localeCompare(b.top ?? "99") || num(b.score) - num(a.score) || a.name.localeCompare(b.name),
  score: (a, b) => num(b.score) - num(a.score) || a.name.localeCompare(b.name),
  imdb: (a, b) => num(b.imdb) - num(a.imdb) || a.name.localeCompare(b.name),
  progress: (a, b) => b.progress.percent - a.progress.percent || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
};

const uniq = (lists: string[][]) => [...new Set(lists.flat())].sort((a, b) => a.localeCompare(b));

function Select({ label, value, onChange, options, all }: { label: string; value: string; onChange: (v: string) => void; options: string[]; all: string }) {
  return (
    <label className="block min-w-0">
      <span className="sr-only">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function LibraryView({ shows }: { shows: ShowSummary[] }) {
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const owner = useOwner();
  const router = useRouter();
  const findKey = useFindKey();

  // Ctrl+F (Cmd+F on a Mac) jumps to the search box here instead of the browser's find. Press it again while the box is
  // focused and the browser's own find opens, so searching the page text is still one more keystroke away.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "f") return;
      const box = searchRef.current;
      if (!box || document.activeElement === box) return;
      e.preventDefault();
      box.focus();
      box.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [platform, setPlatform] = useState("");
  const [genre, setGenre] = useState("");
  const [sort, setSort] = useState<Sort>("top");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fromUrl, setFromUrl] = useState(false);

  // Search, filters and sort live in the address (?q=…&genre=…), so Back from a show returns to the same list and a
  // filtered list can be shared. Read once before the first paint (the server rendered the unfiltered list), then kept
  // in step with replaceState so typing doesn't pile up history entries.
  useLayoutEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setQ(p.get("q") ?? "");
    setStatus(p.get("status") ?? "");
    setType(p.get("type") ?? "");
    setPlatform(p.get("platform") ?? "");
    setGenre(p.get("genre") ?? "");
    const s = p.get("sort");
    if (s && s in sorters) setSort(s as Sort);
    setFromUrl(true);
  }, []);
  useEffect(() => {
    if (!fromUrl) return;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, status, type, platform, genre, sort: sort === "top" ? "" : sort })) if (v) p.set(k, v);
    const search = p.size > 0 ? `?${p}` : "";
    if (search !== window.location.search) window.history.replaceState(null, "", `${window.location.pathname}${search}`);
  }, [fromUrl, q, status, type, platform, genre, sort]);

  const options = useMemo(
    () => ({
      status: uniq([shows.flatMap((s) => (s.status ? [s.status] : []))]),
      type: uniq([shows.flatMap((s) => (s.type ? [s.type] : []))]),
      platform: uniq(shows.map((s) => s.platforms)),
      genre: uniq(shows.map((s) => s.genres)),
    }),
    [shows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return shows
      .filter((s) => (!needle || s.name.toLowerCase().includes(needle)) && (!status || s.status === status) && (!type || s.type === type) && (!platform || s.platforms.includes(platform)) && (!genre || s.genres.includes(genre)))
      .sort(sorters[sort]);
  }, [shows, q, status, type, platform, genre, sort]);

  const filtering = Boolean(q || status || type || platform || genre);
  const activeFilters = [status, type, platform, genre].filter(Boolean).length + (sort === "top" ? 0 : 1);
  const watching = shows.filter((s) => s.status === "In Progress" && s.next);

  return (
    <div>
      <h1 className="page-title">Library</h1>
      <FetchCovers
        missing={shows.filter((s) => !s.poster).map((s) => ({ slug: s.slug, name: s.name }))}
        noIcon={shows.filter((s) => s.needsIcon).map((s) => ({ slug: s.slug, name: s.name }))}
      />

      {!filtering && watching.length > 0 && (
        <section aria-labelledby="continue" className="mb-10">
          <h2 id="continue" className="mb-3 font-display text-xl font-bold">Continue watching</h2>
          {/* Each show you're on wears a race bib: its number is the next episode. */}
          <ul className="-mx-1 flex gap-4 overflow-x-auto px-1 pt-1 pb-3">
            {watching.map((s) => (
              <li key={s.slug} className="w-60 shrink-0">
                <Link href={`/show/${s.slug}`} className="bib flex h-full flex-col overflow-hidden rounded-md">
                  <span className="block truncate bg-accent px-6 py-2 text-center text-sm font-bold text-ink font-stretch-semi-condensed">{s.name}</span>
                  <span className="flex flex-1 flex-col items-center justify-center px-4 pt-3 pb-4">
                    <span className="text-xs">Next up</span>
                    <span className="font-display text-7xl leading-[0.85] font-black tabular-nums">{s.next}</span>
                  </span>
                  <span className="perforated block px-5 pt-2.5 pb-4">
                    <ProgressBar progress={s.progress} status={s.status} label={`${s.name} progress`} splits={s.splits} onPaper run />
                    <span className="mt-1 block text-center text-xs tabular-nums">{progressText(s.progress)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="sr-only">All shows</h2>
      {/* On a phone the selects fold behind one Filters button, so the list starts on the first screen. */}
      <div className="mb-6 grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <label className="relative block sm:col-span-3 lg:col-span-1">
          <span className="sr-only">Search shows</span>
          <input
            ref={searchRef}
            className="input pointer-fine:pr-14"
            type="search"
            name="q"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search…"
            aria-keyshortcuts="Control+F Meta+F"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              // Nothing matches: Enter is the same as pressing the "Add as a new show" button.
              if (e.key === "Enter" && owner && filtered.length === 0 && q.trim().length >= 2) router.push(`/add?q=${encodeURIComponent(q.trim())}`);
            }}
          />
          {/* The shortcut, for keyboards only; it steps aside once there's text (and the field's own clear button). */}
          {!q && (
            <kbd aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 hidden -translate-y-1/2 rounded border border-border px-1.5 py-px font-sans text-xs text-muted pointer-fine:block">
              {findKey}
            </kbd>
          )}
        </label>
        <button type="button" className="btn sm:hidden" aria-expanded={filtersOpen} aria-controls="filters" onClick={() => setFiltersOpen((o) => !o)}>
          <Funnel size={16} aria-hidden />
          Filters{activeFilters > 0 && <span className="tabular-nums text-muted">{activeFilters}</span>}
        </button>
        <div id="filters" className={`${filtersOpen ? "grid" : "hidden"} col-span-2 grid-cols-2 gap-3 sm:contents`}>
          <Select label="Status" value={status} onChange={setStatus} options={options.status} all="Any status" />
          <Select label="Type" value={type} onChange={setType} options={options.type} all="Any type" />
          <Select label="Platform" value={platform} onChange={setPlatform} options={options.platform} all="Any platform" />
          <Select label="Genre" value={genre} onChange={setGenre} options={options.genre} all="Any genre" />
          <label className="block min-w-0">
            <span className="sr-only">Sort by</span>
            <select className="input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>Sort: {s.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted" aria-live="polite">
        {filtering ? `${filtered.length} of ${plural(shows.length, "show")}` : plural(shows.length, "show")}
      </p>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-border p-10 text-center">
          <p className="text-muted">No shows match.</p>
          {/* Owner only: carry the search over to the Add page, which runs it on TVmaze right away. */}
          {owner && q.trim().length >= 2 && (
            <>
              <Link href={`/add?q=${encodeURIComponent(q.trim())}`} className="btn btn-primary max-w-full">
                <span className="truncate">Add “{q.trim()}” as a new show</span>
              </Link>
              <p className="text-xs text-muted">or press Enter</p>
            </>
          )}
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            // Cards off screen skip layout and paint until they scroll near. The 4px of padding, taken back by the
            // negative margin, keeps the focus ring inside the paint box that content-visibility clips to.
            <li key={s.slug} className="-m-1 p-1 [contain-intrinsic-size:auto_10rem] [content-visibility:auto]">
              <Link href={`/show/${s.slug}`} className="flex h-full gap-4 rounded-lg border border-border bg-panel p-3 transition-colors hover:border-muted">
                <Poster url={s.poster} name={s.name} className="w-20 shrink-0 self-start" />
                <div className="flex min-w-0 flex-1 flex-col">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="min-w-0 text-base leading-tight font-bold break-words">{s.name}</h3>
                  {s.top && <span className="shrink-0 rounded bg-ok px-1.5 py-0.5 text-xs font-bold text-ink" title="Top pick">#{Number(s.top)}</span>}
                </div>
                <p className="mb-3 text-sm text-muted">
                  {[s.type, yearLabel(s), s.platforms.join(", ")].filter(Boolean).join(", ")}
                </p>
                <div className="mt-auto">
                  <div className="mb-2.5 flex flex-wrap items-center gap-2">
                    <StatusChip status={s.status} />
                    {s.score !== undefined && <span className="inline-flex items-center gap-1 text-sm tabular-nums text-text" title="My score"><Star size={12} weight="fill" aria-hidden /><span className="sr-only">My score </span>{score1(s.score)}</span>}
                    {s.imdb !== undefined && <span className="text-sm text-muted tabular-nums" title="IMDb">IMDb {score1(s.imdb)}</span>}
                  </div>
                  {s.progress.source !== "none" && (
                    <>
                      <ProgressBar progress={s.progress} status={s.status} label={`${s.name} progress`} splits={s.splits} />
                      <p className="mt-1.5 min-h-4 text-xs text-muted">{progressText(s.progress)}</p>
                    </>
                  )}
                </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
