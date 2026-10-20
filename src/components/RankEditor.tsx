"use client";

import { ArrowDown, ArrowUp, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { plural } from "@/lib/format";
import { MAX_RANKS, rankLabel, sharedRanks } from "@/lib/ranks";
import { Poster } from "./Poster";
import { Spinner } from "./Progress";

export interface RankShow {
  slug: string;
  name: string;
  top?: string;
  poster?: string;
  /** "TV Series, 2005–2013" */
  meta: string;
}

const names = (shows: RankShow[]) => {
  const n = shows.map((s) => s.name);
  return n.length > 1 ? `${n.slice(0, -1).join(", ")} and ${n[n.length - 1]}` : n[0];
};

const focus = (id: string) => document.getElementById(id)?.focus();

/** Owner screen for the Top list: put shows in order, add and remove them, then save the whole list as 01, 02, 03… */
export function RankEditor({ list, others }: { list: RankShow[]; others: RankShow[] }) {
  const router = useRouter();
  const saved = useMemo(() => list.map((s) => s.slug), [list]);
  const [order, setOrder] = useState(saved);
  // After a save the page sends the new list; start again from it.
  useEffect(() => setOrder(saved), [saved]);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // What the last edit did, read out by screen readers (the list itself shows it).
  const [said, setSaid] = useState("");

  const bySlug = useMemo(() => new Map([...list, ...others].map((s) => [s.slug, s])), [list, others]);
  const shows = order.map((slug) => bySlug.get(slug)!);
  const available = [...bySlug.values()].filter((s) => !order.includes(s.slug)).sort((a, b) => a.name.localeCompare(b.name));
  const leaving = list.filter((s) => !order.includes(s.slug));
  const dirty = order.length !== saved.length || order.some((slug, i) => slug !== saved[i]);
  const clashes = sharedRanks(list).map((top) => ({ place: Number(top), shows: list.filter((s) => s.top === top) }));

  // Leaving with an unsaved order asks first: closing or reloading the tab through the browser, and links inside the
  // app (which don't unload the page) through a confirm of our own.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.origin !== window.location.origin || link.getAttribute("href")?.startsWith("#")) return;
      if (!window.confirm("Leave without saving the new order?")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  // Edits render right away (flushSync) so focus can go to a control that still exists and isn't disabled: the
  // button just pressed may have turned off (top or bottom of the list) or left with its row.
  const edit = (next: string[], note: string) => {
    flushSync(() => {
      setOrder(next);
      setMsg(null);
      setSaid(note);
    });
  };
  const move = (i: number, by: -1 | 1) => {
    const slug = order[i];
    const to = i + by;
    const next = [...order];
    [next[i], next[to]] = [next[to], next[i]];
    edit(next, `Moved ${bySlug.get(slug)!.name} to place ${to + 1}.`);
    focus(to === 0 ? `rank-down-${slug}` : to === next.length - 1 ? `rank-up-${slug}` : `rank-${by < 0 ? "up" : "down"}-${slug}`);
  };
  const remove = (i: number) => {
    const next = order.filter((_, j) => j !== i);
    edit(next, `Took ${bySlug.get(order[i])!.name} off the list.`);
    const neighbour = next[i] ?? next[i - 1];
    focus(neighbour ? `rank-remove-${neighbour}` : "rank-pick");
  };

  async function save() {
    setBusy(true);
    setMsg(null);
    setSaid("");
    const res = await fetch("/api/ranks", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ order }) }).catch(() => null);
    const data = ((await res?.json().catch(() => null)) ?? {}) as { changed?: number; error?: string };
    if (res?.ok) {
      setMsg({ ok: true, text: `Saved. ${plural(data.changed ?? 0, "show")} updated in Notion.` });
      router.refresh();
    } else {
      setMsg({ ok: false, text: data.error ?? "Couldn't reach the server. Try again." });
    }
    setBusy(false);
  }

  return (
    <div className="max-w-3xl">
      <p role="status" className="sr-only">{said}</p>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 id="ranks-title" tabIndex={-1} className="page-title mb-2">Ranks</h1>
          {clashes.length > 0 ? (
            <p className="text-warn">
              {clashes.map((c) => `${names(c.shows)} share place ${c.place}.`).join(" ")} Save to give each show its own place.
            </p>
          ) : (
            <p className="text-muted">{plural(order.length, "show")} on your Top list, in the order you’d recommend them.</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dirty && !busy && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                // This button goes away with the changes, so focus moves up to the heading.
                edit(saved, "Back to the saved order.");
                focus("ranks-title");
              }}
            >
              Undo changes
            </button>
          )}
          <button type="button" className="btn btn-primary" disabled={busy || (!dirty && clashes.length === 0)} onClick={save}>
            {busy && <Spinner onAccent />}
            {busy ? "Saving…" : "Save order"}
          </button>
        </div>
      </div>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`mb-4 text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>{msg.text}</p>
      )}

      {shows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-muted">Nothing ranked yet. Add a show below to start the list.</p>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-panel">
          {shows.map((s, i) => {
            const place = rankLabel(i + 1);
            const change = !s.top ? "New on the list" : s.top !== place ? `Was ${Number(s.top)}` : "";
            return (
              <li key={s.slug} className="flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
                <span className="w-9 shrink-0 text-center font-display text-3xl leading-none font-black text-ok tabular-nums">
                  <span className="sr-only">Place </span>
                  {i + 1}
                </span>
                <Poster url={s.poster} name={s.name} className="hidden w-10 shrink-0 sm:block" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.name}</p>
                  <p className="flex flex-wrap gap-x-3 text-sm text-muted">
                    {s.meta && <span>{s.meta}</span>}
                    {change && (
                      <span className="inline-flex items-center gap-1.5 text-text">
                        <span aria-hidden className="size-1.5 rounded-full bg-accent" />
                        {change}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" id={`rank-up-${s.slug}`} className="btn w-9 px-0" aria-label={`Move ${s.name} up`} disabled={busy || i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={16} aria-hidden />
                  </button>
                  <button type="button" id={`rank-down-${s.slug}`} className="btn w-9 px-0" aria-label={`Move ${s.name} down`} disabled={busy || i === shows.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={16} aria-hidden />
                  </button>
                  <button type="button" id={`rank-remove-${s.slug}`} className="btn w-9 px-0" aria-label={`Take ${s.name} off the list`} disabled={busy} onClick={() => remove(i)}>
                    <X size={16} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {leaving.length > 0 && <p className="mt-3 text-sm text-muted">Leaving the list when you save: {names(leaving)}.</p>}

      <form
        className="mt-6 flex max-w-xl gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const show = bySlug.get(pick);
          if (!show) return;
          edit([...order, pick], `Added ${show.name} at place ${order.length + 1}.`);
          setPick("");
          // The Add button turns off once the choice is cleared; stay on the list of shows instead.
          focus("rank-pick");
        }}
      >
        <label className="block min-w-0 flex-1">
          <span className="sr-only">Show to add</span>
          <select id="rank-pick" className="input" value={pick} onChange={(e) => setPick(e.target.value)} disabled={busy || order.length >= MAX_RANKS}>
            <option value="">Choose a show to add…</option>
            {available.map((s) => (
              <option key={s.slug} value={s.slug}>{s.name}</option>
            ))}
          </select>
        </label>
        <button className="btn" disabled={busy || !pick}>Add to the list</button>
      </form>
    </div>
  );
}
