import { posterSize } from "@/lib/format";

/** A show's cover, or a quiet placeholder with its first letter. Decorative: the name is always next to it. */
export function Poster({ url, name, size = "medium", className = "" }: { url?: string; name: string; size?: "medium" | "original"; className?: string }) {
  if (!url) {
    return (
      <div aria-hidden className={`grid aspect-[2/3] place-items-center rounded-md bg-well font-display text-2xl font-extrabold text-muted ${className}`}>
        {name.trim().slice(0, 1).toUpperCase()}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={posterSize(url, size)} alt="" loading="lazy" decoding="async" className={`aspect-[2/3] rounded-md bg-well object-cover ${className}`} />;
}
