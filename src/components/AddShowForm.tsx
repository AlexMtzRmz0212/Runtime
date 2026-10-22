"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { plural } from "@/lib/format";

const TYPES = ["TV Series", "Mini Series", "Saga", "Anime", "Film Series"];

/** "7, 13 13" -> [7, 13, 13]. Returns null when something isn't a whole number. */
function parseCounts(text: string): number[] | null {
  const parts = text.split(/[\s,;]+/).filter(Boolean);
  const counts = parts.map(Number);
  return counts.every((n) => Number.isInteger(n) && n > 0) ? counts : null;
}

export function AddShowForm({ statusOptions }: { statusOptions: string[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("TV Series");
  const [status, setStatus] = useState(statusOptions.includes("Want to watch") ? "Want to watch" : (statusOptions[0] ?? ""));
  const [counts, setCounts] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = useMemo(() => parseCounts(counts), [counts]);
  const total = parsed?.reduce((a, b) => a + b, 0) ?? 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (parsed === null) return setError("Episodes per season: whole numbers like 7, 13, 13");
    setBusy(true);
    setError("");
    const body = { name, type, status: status || undefined, episodesPerSeason: parsed.length ? parsed : undefined };
    const res = await fetch("/api/shows", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { slug?: string; error?: string } | null;
    if (res?.ok && data?.slug) router.push(`/show/${data.slug}`);
    else {
      setError(data?.error ?? "Couldn't reach the server");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex max-w-xl flex-col gap-5">
      <label>
        <span className="label">Name</span>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label">Type</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Status</span>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {statusOptions.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <label>
        <span className="label">Episodes per season (optional)</span>
        <input className="input" placeholder="7, 13, 13" inputMode="numeric" value={counts} onChange={(e) => setCounts(e.target.value)} aria-describedby="counts-hint" />
        <span id="counts-hint" className="mt-1.5 block text-xs text-muted">
          {parsed && parsed.length > 0 ? `${plural(parsed.length, "season")}, ${plural(total, "episode")} to create in Notion` : "Leave empty to add the show without an episode list."}
        </span>
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <div>
        <button className="btn btn-primary" disabled={busy || !name.trim()}>{busy ? (total > 20 ? "Creating episodes…" : "Adding…") : "Add show"}</button>
      </div>
    </form>
  );
}
