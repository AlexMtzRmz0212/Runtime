import { distanceOf } from "./distance";
import { episodesByShow, type Library } from "./library";
import { episodeLabel, nextUp, progressOf, splitsOf } from "./progress";
import { toPublicShow, type ShowSummary } from "./types";

/** Public fields + progress for every show. Nothing private or Notion-internal goes into this. */
export function summarize({ shows, episodes }: Library): ShowSummary[] {
  const byShow = episodesByShow(episodes);
  return shows.map((show) => {
    const eps = byShow.get(show.pageId) ?? [];
    const next = nextUp(show, eps);
    const progress = progressOf(show, eps);
    const lastActive = [show.editedTime, ...eps.map((e) => e.editedTime)].reduce<string | undefined>((a, b) => (b && (!a || b > a) ? b : a), undefined);
    return {
      ...toPublicShow(show),
      needsIcon: Boolean(show.poster) && !show.hasIcon,
      progress,
      splits: eps.length > 0 ? splitsOf(eps) : undefined,
      next: next ? episodeLabel(next.season, next.episode) : undefined,
      distance: distanceOf(show.runtime, progress),
      lastActive,
    };
  });
}
