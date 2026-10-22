"use client";

import { GearSix } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { plural } from "@/lib/format";
import { Spinner } from "./Progress";
import { useOwner } from "./useOwner";

const FIELDS = [
  { field: "genres", label: "Genres", one: "genre" },
  { field: "cast", label: "Cast", one: "name" },
  { field: "directors", label: "Creator", one: "name" },
] as const;

/** Fill one column of the show from TVmaze; it only adds, never removes. */
function FillDetails({ slug }: { slug: string }) {
  const router = useRouter();
  const [running, setRunning] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function fill(field: string, label: string, one: string) {
    setRunning(field);
    setMsg(null);
    const res = await fetch(`/api/shows/${encodeURIComponent(slug)}/details`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ field }) }).catch(() => null);
    const data = (await res?.json().catch(() => null)) as { added?: string[]; error?: string } | null;
    if (res?.ok && data?.added) {
      setMsg({ ok: true, text: data.added.length ? `${label}: added ${data.added.length > 3 ? plural(data.added.length, one) : data.added.join(", ")}.` : `${label}: nothing new on TVmaze.` });
      router.refresh();
    } else {
      setMsg({ ok: false, text: data?.error ?? "Couldn't reach TVmaze" });
    }
    setRunning(null);
  }

  return (
    <div>
      <p className="label">Fill from TVmaze</p>
      <div className="flex flex-wrap items-center gap-2">
        {FIELDS.map((f) => (
          <button key={f.field} className="btn" disabled={running !== null} onClick={() => fill(f.field, f.label, f.one)}>
            {running === f.field && <Spinner />}
            {f.label}
          </button>
        ))}
        {msg && <span role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-muted" : "text-danger"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}

/** Owner-only tools for the show: a small button by the title that opens them in a dialog, so the page stays one screen. */
export function Controls({ slug, children }: { slug: string; children: React.ReactNode }) {
  const owner = useOwner();
  const dialog = useRef<HTMLDialogElement>(null);
  if (!owner) return null;
  return (
    <>
      <button className="btn" onClick={() => dialog.current?.showModal()}>
        <GearSix size={16} aria-hidden />
        Controls
      </button>
      <dialog ref={dialog} aria-labelledby="controls-title" className="quick w-[min(44rem,calc(100vw-2rem))]" onClick={(e) => e.target === dialog.current && dialog.current?.close()}>
        <div className="flex max-h-[76vh] flex-col gap-6 overflow-y-auto rounded-lg border border-border bg-panel p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 id="controls-title" className="font-display text-xl font-bold">Controls</h2>
            <button className="btn" onClick={() => dialog.current?.close()}>Close</button>
          </div>
          {children}
          <FillDetails slug={slug} />
        </div>
      </dialog>
    </>
  );
}
