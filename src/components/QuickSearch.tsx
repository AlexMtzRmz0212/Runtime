"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { normalizeName } from "@/lib/merge";
import { StatusChip } from "./Bits";
import { useOwner } from "./useOwner";
import { Poster } from "./Poster";

interface Entry {
  slug: string;
  name: string;
  poster?: string;
  status?: string;
  year?: string;
}

// The list is fetched once per page load, the first time the popup opens.
let index: Promise<Entry[]> | undefined;
const loadIndex = () =>
  (index ??= fetch("/api/shows-index")
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error("failed"))))
    .then((d: { shows: Entry[] }) => d.shows)
    .catch(() => {
      index = undefined;
      return [] as Entry[];
    }));

// Pages with a search of their own. Everywhere else Ctrl+F opens this popup.
const OWN_SEARCH = ["/", "/add", "/login"];

/**
 * A search popup for pages that have no search box (a show page, Top): type a name to jump to a show in the library; if it
 * isn't there, the owner gets the same "Add as a new show" as in the Library, and Enter does it.
 */
export function QuickSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const owner = useOwner();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [shows, setShows] = useState<Entry[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const available = !OWN_SEARCH.includes(pathname);

  function open() {
    if (!dialog.current || dialog.current.open) return;
    setQ("");
    setActive(0);
    dialog.current.showModal();
    input.current?.focus();
    void loadIndex().then(setShows);
  }

  // Ctrl+F (Cmd+F on a Mac) opens the popup. With the popup already open, a second press falls through to the browser's own find.
  useEffect(() => {
    if (!available) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey || e.key.toLowerCase() !== "f") return;
      if (dialog.current?.open) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [available]);

  // Leaving the page by a link inside the popup closes it.
  useEffect(() => {
    dialog.current?.close();
  }, [pathname]);

  const matches = useMemo(() => {
    const needle = normalizeName(q);
    if (!needle) return [];
    const scored = shows
      .map((s) => ({ s, n: normalizeName(s.name) }))
      .filter(({ n }) => n.includes(needle))
      .sort((a, b) => Number(b.n.startsWith(needle)) - Number(a.n.startsWith(needle)) || a.s.name.localeCompare(b.s.name));
    return scored.slice(0, 8).map(({ s }) => s);
  }, [shows, q]);

  const trimmed = q.trim();
  const canAdd = owner === true && trimmed.length >= 2 && matches.length === 0;
  const addHref = `/add?q=${encodeURIComponent(trimmed)}`;

  function go(href: string) {
    dialog.current?.close();
    router.push(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && matches.length > 0) {
      e.preventDefault();
      setActive((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp" && matches.length > 0) {
      e.preventDefault();
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (matches[active]) go(`/show/${matches[active].slug}`);
      else if (canAdd) go(addHref);
    }
  }

  if (!available) return null;

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="-m-2 inline-flex cursor-pointer items-center gap-1.5 p-2 text-muted transition-colors hover:text-text"
        aria-label="Search the library"
        aria-keyshortcuts="Control+F Meta+F"
        title="Search (Ctrl F)"
      >
        <MagnifyingGlass size={18} aria-hidden />
      </button>

      <dialog
        ref={dialog}
        aria-label="Search the library"
        className="quick"
        onClick={(e) => {
          // A click on the backdrop (the dialog element itself) closes it.
          if (e.target === dialog.current) dialog.current?.close();
        }}
      >
        <div className="w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-border bg-panel shadow-2xl">
          <div className="border-b border-border p-3">
            <input
              ref={input}
              className="input h-11 text-base"
              type="search"
              role="combobox"
              aria-expanded={matches.length > 0}
              aria-controls="quick-results"
              aria-activedescendant={matches[active] ? `quick-${matches[active].slug}` : undefined}
              placeholder="Search your library…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
            />
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {!trimmed && <p className="px-3 py-6 text-center text-sm text-muted">Type a show&apos;s name.</p>}

            {matches.length > 0 && (
              <ul id="quick-results" role="listbox" aria-label="Shows in your library">
                {matches.map((s, i) => (
                  <li key={s.slug} id={`quick-${s.slug}`} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onClick={() => go(`/show/${s.slug}`)}
                      onMouseMove={() => setActive(i)}
                      className={`flex w-full cursor-pointer items-center gap-3 rounded-lg p-2 text-left transition-colors ${i === active ? "bg-well" : ""}`}
                    >
                      <Poster url={s.poster} name={s.name} className="w-9 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{s.name}</span>
                        <span className="block truncate text-xs text-muted">In your library{s.year ? ` · ${s.year}` : ""}</span>
                      </span>
                      <StatusChip status={s.status} />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {trimmed && matches.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-3 py-6 text-center">
                <p className="text-sm text-muted">{shows.length === 0 ? "Loading…" : "No shows match."}</p>
                {canAdd && shows.length > 0 && (
                  <>
                    <button type="button" className="btn btn-primary max-w-full" onClick={() => go(addHref)}>
                      <span className="truncate">Add “{trimmed}” as a new show</span>
                    </button>
                    <p className="text-xs text-muted">or press Enter</p>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
