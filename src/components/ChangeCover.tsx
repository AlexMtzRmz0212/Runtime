"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { posterSize } from "@/lib/format";
import { useOwner } from "./useOwner";

interface Option {
  url: string;
  label: string;
}

/** Owner-only: pick which of TVmaze's posters is the cover (e.g. the season 1 poster instead of the newest season's). */
export function ChangeCover({ slug }: { slug: string }) {
  const owner = useOwner();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<Option[]>([]);
  const [current, setCurrent] = useState<string | undefined>();
  const [tvmazeId, setTvmazeId] = useState<number | undefined>();
  const [picked, setPicked] = useState<string | undefined>();
  const [error, setError] = useState("");

  if (!owner) return null;

  async function load() {
    setOpen(true);
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
      setError(data?.error ?? "Couldn't reach TVmaze");
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
      setOpen(false);
      router.refresh();
    } else {
      setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't save the cover");
    }
    setSaving(false);
  }

  if (!open) {
    return (
      <button className="btn mt-4" onClick={load}>Change cover</button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-panel p-4">
      <p className="mb-3 text-sm text-muted">{loading ? "Loading posters from TVmaze…" : options.length ? "Pick a cover:" : "TVmaze has no other posters for this show."}</p>
      {options.length > 0 && (
        <ul className="mb-4 flex flex-wrap gap-3">
          {options.map((o) => (
            <li key={o.url}>
              <button
                type="button"
                onClick={() => setPicked(o.url)}
                aria-pressed={picked === o.url}
                className={`block w-24 cursor-pointer rounded-md border-2 p-0.5 text-left transition-colors ${picked === o.url ? "border-accent" : "border-transparent hover:border-muted"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={posterSize(o.url, "medium")} alt="" loading="lazy" className="aspect-[2/3] w-full rounded bg-well object-cover" />
                <span className="mt-1 block truncate text-xs text-muted">{o.label}{o.url === current ? " · current" : ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={save} disabled={saving || !picked || picked === current}>{saving ? "Saving…" : "Use this cover"}</button>
        <button className="btn" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
