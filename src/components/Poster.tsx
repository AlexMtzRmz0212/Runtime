import { posterSize } from "@/lib/format";

// TVmaze's sizes, so the browser reserves the right box before the picture arrives (the class sets the drawn size).
const DIMENSIONS = { medium: { width: 210, height: 295 }, original: { width: 680, height: 1000 } };

/**
 * A show's cover, or a quiet placeholder with its first letter. Decorative: the name is always next to it.
 * `priority` is for the one cover at the top of a page: fetched first instead of lazily.
 */
export function Poster({ url, name, size = "medium", priority = false, className = "" }: { url?: string; name: string; size?: "medium" | "original"; priority?: boolean; className?: string }) {
  if (!url) {
    return (
      <div aria-hidden className={`grid aspect-[2/3] place-items-center rounded-md bg-well font-display text-2xl font-extrabold text-muted ${className}`}>
        {name.trim().slice(0, 1).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={posterSize(url, size)}
      alt=""
      {...DIMENSIONS[size]}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding="async"
      className={`aspect-[2/3] rounded-md bg-well object-cover ${className}`}
    />
  );
}
