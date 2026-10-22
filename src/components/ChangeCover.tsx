"use client";

import { ImageSquare } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { posterSize } from "@/lib/format";
import { useOwner } from "./useOwner";

interface Option {
  url: string;
  label: string;
}

/**
 * Owner-only: pick which of TVmaze's posters is the cover (e.g. the season 1 poster instead of the newest season's). A small
 * button on the poster, shown on hover (always on touch screens, which can't hover); the picker opens as a dialog.
 */
export function ChangeCover({ slug }: { slug: string }) {
  const owner = useOwner();
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [current, setCurrent] = useState<string | undefined>();
  const [tvmazeId, setTvmazeId] = useState<number | undefined>();
  const [picked, setPicked] = useState<string | undefined>();
  const [error, setError] = useState("");

  if (!owner) return null;

  async function load() {
    dialog.current?.showModal();
    setLoading(true);
    setError("");
    const res = await fetch(`/api/shows/${encodeURIComponent(slug)}/cover`, { cache: "no-store" }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { options?: Option[]; current?: string; tvmazeId?: number; error?: string } | null;
    if (res?.ok && data?.options) {
      setOptions(data.options);
      setCurrent(data.current);
      setTvmazeId(data.tvmazeId);
      setPicked(data.current);
    } else {
      setError(data?.error ?? "Couldn't reach TVmaze. Close this and try again.");
    }
    setLoading(false);
  }

  async function save() {
    if (!picked) return;
    setSaving(true);
    setError("");
    const res = await fetch(`/api/shows/${encodeURIComponent(slug)}/cover`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: picked, tvmazeId }),
    }).catch(() => null);
    if (res?.ok) {
      dialog.current?.close();
      router.refresh();
    } else {
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't save the cover. Try again.");
    }
    setSaving(false);
  }

  return (
    <>
      <button
        onClick={load}
        className="absolute right-2 bottom-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-bg/85 px-2.5 py-1.5 text-xs font-medium text-text transition-opacity hover:bg-bg focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
      >
        <ImageSquare size={14} aria-hidden />
        {/* On a phone the poster is small: just the icon. */}
        <span className="sr-only sm:not-sr-only">Change cover</span>
      </button>
      <dialog ref={dialog} aria-label="Change cover" className="quick w-[min(40rem,calc(100vw-2rem))]" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="rounded-lg border border-border bg-panel p-4">
          <p aria-live="polite" className="mb-3 text-sm text-muted">{loading ? "Loading posters from TVmaze…" : options.length ? "Pick a cover:" : error ? "" : "TVmaze has no other posters for this show."}</p>
          {options.length > 0 && (
            <ul className="mb-4 flex max-h-[60vh] flex-wrap gap-3 overflow-y-auto">
              {options.map((o) => (
                <li key={o.url}>
                  <button
                    type="button"
                    onClick={() => setPicked(o.url)}
                    aria-pressed={picked === o.url}
                    className={`block w-24 cursor-pointer rounded-md border-2 p-0.5 text-left transition-colors ${picked === o.url ? "border-accent" : "border-transparent hover:border-muted"}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={posterSize(o.url, "medium")} alt="" width={210} height={295} loading="lazy" className="aspect-[2/3] w-full rounded bg-well object-cover" />
                    <span className="mt-1 block truncate text-xs text-muted">{o.label}{o.url === current ? " (current)" : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={save} disabled={saving || !picked || picked === current}>{saving ? "Saving…" : "Use this cover"}</button>
            <button className="btn" onClick={() => dialog.current?.close()}>Cancel</button>
          </div>
        </div>
      </dialog>
    </>
  );
}
