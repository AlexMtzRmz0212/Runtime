"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { plural } from "@/lib/format";
import { useOwner } from "./useOwner";

interface Item {
  slug: string;
  name: string;
}

type Outcome = { name: string; status: "set" | "has" | "no-match" | "no-image" | "unknown" | "error"; tried?: string[] };
type Kind = "covers" | "icons" | "runtimes";

/**
 * Owner-only banner on the library. Gets covers for shows that have none: a show is only matched when its name matches a
 * TVmaze show exactly (or its TVmaze id is already saved); anything doubtful is listed, not guessed. And adds the poster as the
 * Notion page icon on shows that have a cover but no icon. And works out each show's Runtime (its course length) the same way.
 */
export function FetchCovers({ missing, noIcon, noRuntime = [] }: { missing: Item[]; noIcon: Item[]; noRuntime?: Item[] }) {
  const owner = useOwner();
  const router = useRouter();
  const [running, setRunning] = useState<Kind | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [outcomes, setOutcomes] = useState<{ kind: Kind; list: Outcome[] } | null>(null);

  if (!owner || (missing.length === 0 && noIcon.length === 0 && noRuntime.length === 0 && !outcomes)) return null;

  async function run(kind: Kind) {
    const items = kind === "covers" ? missing : kind === "icons" ? noIcon : noRuntime;
    setRunning(kind);
    setDone(0);
    setTotal(items.length);
    const list: Outcome[] = [];
    for (const item of items) {
      try {
        const res = await fetch(`/api/shows/${encodeURIComponent(item.slug)}/${kind === "runtimes" ? "runtime" : "cover"}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refresh: kind === "icons" }),
        });
        const data = (await res.json().catch(() => null)) as { status?: Outcome["status"]; tried?: string[] } | null;
        list.push({ name: item.name, status: res.ok && data?.status ? data.status : "error", tried: data?.tried });
      } catch {
        list.push({ name: item.name, status: "error" });
      }
      setDone(list.length);
    }
    setOutcomes({ kind, list });
    setRunning(null);
    router.refresh();
  }

  const set = outcomes?.list.filter((o) => o.status === "set").length ?? 0;
  const problems = outcomes?.list.filter((o) => o.status !== "set" && o.status !== "has") ?? [];

  return (
    <section aria-label="Covers and runtimes" className="mb-8 flex flex-col gap-3 rounded-lg border border-accent/40 bg-panel p-4">
      {outcomes && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{`Added ${plural(set, outcomes.kind === "covers" ? "cover" : outcomes.kind === "icons" ? "icon" : "runtime")}.`}</p>
          <button className="btn" onClick={() => setOutcomes(null)}>Dismiss</button>
        </div>
      )}
      {!outcomes && missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{plural(missing.length, "show")} without a cover.</p>
          <button className="btn btn-primary" onClick={() => run("covers")} disabled={running !== null}>
            {running === "covers" ? `Getting covers… ${done} of ${total}` : "Get covers from TVmaze"}
          </button>
        </div>
      )}
      {!outcomes && noIcon.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{plural(noIcon.length, "show")} with a cover but no Notion icon.</p>
          <button className="btn btn-primary" onClick={() => run("icons")} disabled={running !== null}>
            {running === "icons" ? `Adding icons… ${done} of ${total}` : "Use covers as Notion icons"}
          </button>
        </div>
      )}
      {!outcomes && noRuntime.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">{plural(noRuntime.length, "show")} without a runtime, so their course length in hours is unknown.</p>
          <button className="btn btn-primary" onClick={() => run("runtimes")} disabled={running !== null}>
            {running === "runtimes" ? `Getting runtimes… ${done} of ${total}` : "Get runtimes from TVmaze"}
          </button>
        </div>
      )}
      {running && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-well" role="progressbar" aria-label="Progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      {problems.length > 0 && (
        <div className="text-sm text-muted">
          <p className="mb-1">Couldn&apos;t match these. Open one and use <strong className="font-semibold text-text">Fill episodes</strong> to pick the right show, which also adds its cover and runtime:</p>
          <ul className="list-disc pl-5">
            {problems.map((p) => (
              <li key={p.name}>
                <span className="text-text">{p.name}</span>
                {p.status === "no-match" && p.tried?.length ? ` (TVmaze found: ${p.tried.join(", ")})` : p.status === "no-image" ? " (TVmaze has no picture)" : p.status === "unknown" ? " (TVmaze has no runtime)" : p.status === "error" ? " (something went wrong)" : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
