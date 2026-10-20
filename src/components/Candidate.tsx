import { seasonLabel } from "@/lib/fillClient";

export interface TvmazeCandidate {
  id: number;
  name: string;
  premiered?: string;
  ended?: string;
  status?: string;
  network?: string;
  image?: string;
  genres: string[];
  /** Slug of the library show with the same name, if there is one. */
  inLibrary?: string;
}

/** One TVmaze search result: poster, name, years, network. */
export function CandidateInfo({ c }: { c: TvmazeCandidate }) {
  const meta = [seasonLabel(c.premiered, c.ended), c.network, c.status].filter(Boolean).join(", ");
  return (
    <span className="flex min-w-0 items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {c.image ? <img src={c.image} alt="" width={40} height={56} loading="lazy" className="h-14 w-10 shrink-0 rounded object-cover" /> : <span aria-hidden className="h-14 w-10 shrink-0 rounded bg-well" />}
      <span className="min-w-0">
        <span className="block truncate font-semibold">{c.name}</span>
        <span className="block truncate text-sm text-muted">{meta || "No details"}</span>
        {c.genres.length > 0 && <span className="block truncate text-xs text-muted">{c.genres.join(", ")}</span>}
      </span>
    </span>
  );
}
