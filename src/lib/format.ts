import type { PublicShow } from "./types";

/** "2005–2013", "2022", or the Year column when someone filled it in. */
export function yearLabel(show: Pick<PublicShow, "year" | "startDate" | "endDate">): string {
  if (show.year) return show.year;
  const a = show.startDate?.slice(0, 4);
  const b = show.endDate?.slice(0, 4);
  if (a && b && a !== b) return `${a}–${b}`;
  return a ?? b ?? "";
}

export const score1 = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export type Tone = "done" | "active" | "waiting" | "want" | "idle";

/** Colour family of a Notion status name. Custom statuses fall back to idle. */
export function statusTone(status?: string): Tone {
  switch (status) {
    case "Watched":
      return "done";
    case "In Progress":
      return "active";
    case "Waiting":
      return "waiting";
    case "Want to watch":
      return "want";
    default:
      return "idle";
  }
}

// A fixed locale and UTC so the server and the browser print the same text (no hydration mismatch).
const dayFormat = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-10-20" → "Oct 20, 2026". Anything that isn't a date comes back as it was. */
export function dayLabel(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : dayFormat.format(date);
}

export const plural =(n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** TVmaze serves the same picture at several sizes; the stored URL is the big one, lists use the small one. */
export function posterSize(url: string, size: "medium" | "original"): string {
  return size === "medium" ? url.replace("/original_untouched/", "/medium_portrait/") : url;
}
