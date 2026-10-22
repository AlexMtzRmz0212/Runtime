"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useOwner } from "./useOwner";

interface Props {
  slug: string;
  statusOptions: string[];
  status?: string;
  score?: number;
  currentSeason?: number;
  lastWatchedEpisode?: number;
  /** With Episodes rows the season/episode columns follow the ticks, so they aren't edited by hand. */
  hasEpisodes: boolean;
}

const toNum = (s: string) => (s.trim() === "" ? null : Number(s));

/** Owner-only, inside Controls: status, score and (for shows without an episode list) where you are. */
export function ShowEditor({ slug, statusOptions, status, score, currentSeason, lastWatchedEpisode, hasEpisodes }: Props) {
  const owner = useOwner();
  const router = useRouter();
  const [st, setSt] = useState(status ?? "");
  const [sc, setSc] = useState(score?.toString() ?? "");
  const [season, setSeason] = useState(currentSeason?.toString() ?? "");
  const [ep, setEp] = useState(lastWatchedEpisode?.toString() ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  if (!owner) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const body: Record<string, unknown> = { score: toNum(sc) };
    if (st) body.status = st;
    if (!hasEpisodes) {
      body.currentSeason = toNum(season);
      body.lastWatchedEpisode = toNum(ep);
    }
    const res = await fetch(`/api/shows/${slug}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    if (res?.ok) {
      const { marked = 0 } = ((await res.json().catch(() => null)) as { marked?: number } | null) ?? {};
      setMsg({ ok: true, text: marked > 0 ? `Saved. ${marked} ${marked === 1 ? "episode" : "episodes"} marked watched.` : "Saved" });
      router.refresh();
    } else {
      setMsg({ ok: false, text: ((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't reach the server" });
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} aria-label="Edit show" className="flex flex-wrap items-end gap-3">
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:[&>label]:w-44">
        <label className="col-span-2 sm:col-span-1">
          <span className="label">Status</span>
          <select className="input" value={st} onChange={(e) => setSt(e.target.value)}>
            {!status && <option value="">—</option>}
            {statusOptions.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">My score (0–10)</span>
          <input className="input" type="number" inputMode="decimal" min={0} max={10} step={0.1} value={sc} onChange={(e) => setSc(e.target.value)} />
        </label>
        {!hasEpisodes && (
          <>
            <label>
              <span className="label">Current season</span>
              <input className="input" type="number" inputMode="numeric" min={1} step={1} value={season} onChange={(e) => setSeason(e.target.value)} />
            </label>
            <label>
              <span className="label">Last watched episode</span>
              <input className="input" type="number" inputMode="numeric" min={0} step={1} value={ep} onChange={(e) => setEp(e.target.value)} />
            </label>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
        {msg && (
          <span role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-ok" : "text-danger"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
