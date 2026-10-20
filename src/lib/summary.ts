import { episodesByShow, type Library } from "./library";
import { episodeLabel, nextUp, progressOf, splitsOf } from "./progress";
import { toPublicShow, type ShowSummary } from "./types";

/** Public fields + progress for every show. Nothing private or Notion-internal goes into this. */
export function summarize({ shows, episodes }: Library): ShowSummary[] {
  const byShow = episodesByShow(episodes);
  return shows.map((show) => {
    const eps = byShow.get(show.pageId) ?? [];
    const next = nextUp(show, eps);
    return { ...toPublicShow(show), needsIcon: Boolean(show.poster) && !show.hasIcon, progress: progressOf(show, eps), splits: eps.length > 0 ? splitsOf(eps) : undefined, next: next ? episodeLabel(next.season, next.episode) : undefined };
  });
}
