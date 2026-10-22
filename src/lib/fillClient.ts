export interface FillProgress {
  /** Episodes created so far in this run. */
  done: number;
  /** Episodes this run will create in total (known after the first batch). */
  total: number;
  watched: number;
}

/**
 * Call the fill endpoint until nothing remains. Each call creates one batch, so a long show never hits a request time limit.
 * Every call passes on the episodes the earlier ones created, which Notion may not list yet, so none is created twice.
 */
export async function fillEpisodes(slug: string, tvmazeId: number | undefined, onProgress: (p: FillProgress) => void): Promise<FillProgress> {
  const progress: FillProgress = { done: 0, total: 0, watched: 0 };
  const created: string[] = [];
  for (;;) {
    const res = await fetch(`/api/shows/${encodeURIComponent(slug)}/fill`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(tvmazeId ? { tvmazeId, created } : { created }),
    });
    const data = (await res.json().catch(() => null)) as { keys?: string[]; created?: number; watched?: number; remaining?: number; error?: string } | null;
    if (!res.ok || data?.created === undefined || data.remaining === undefined) throw new Error(data?.error ?? "Couldn't reach the server");
    created.push(...(data.keys ?? []));
    progress.done += data.created;
    progress.watched += data.watched ?? 0;
    progress.total = progress.done + data.remaining;
    onProgress({ ...progress });
    if (data.remaining === 0) return progress;
    if (data.created === 0) throw new Error("Filling stopped without making progress");
  }
}

/** "2008–2013", "2022", or "" when unknown. */
export function seasonLabel(premiered?: string, ended?: string): string {
  const a = premiered?.slice(0, 4);
  const b = ended?.slice(0, 4);
  return a && b && a !== b ? `${a}–${b}` : (a ?? "");
}
