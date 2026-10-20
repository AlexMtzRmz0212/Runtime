/** One show, after duplicate Notion rows with the same name have been merged (see merge.ts). */
export interface Show {
  /** URL-safe, unique name used in /show/<slug>. Public pages never expose Notion ids. */
  slug: string;
  /** Primary Notion row (the oldest one). */
  pageId: string;
  /** Every Notion row merged into this show. Writes go to all of them. */
  pageIds: string[];
  name: string;
  type?: string;
  status?: string;
  year?: string;
  startDate?: string;
  endDate?: string;
  seasons?: number;
  currentSeason?: number;
  episodesOfCurrentSeason?: number;
  lastWatchedEpisode?: number;
  /** "Score/Relevance": the score for myself. */
  score?: number;
  imdb?: number;
  /** "Top": rank to recommend to others, "01" to "09". */
  top?: string;
  genres: string[];
  platforms: string[];
  cast: string[];
  directors: string[];
  // Private: never leave the server for visitors (see toPublicShow).
  /** TVmaze id: where the episode list comes from. Set the first time episodes are filled. */
  tvmazeId?: number;
  /** Cover image URL (from TVmaze). Also set as the Notion page cover. */
  poster?: string;
  /** Whether the Notion page already has an icon (so the poster is only added as one where there is none). */
  hasIcon?: boolean;
  watchedWith?: string;
  scoreAlex?: number;
  scoreMish?: number;
  scoreChar?: number;
  createdTime?: string;
}

export type PublicShow = Omit<Show, "pageId" | "pageIds" | "hasIcon" | "watchedWith" | "scoreAlex" | "scoreMish" | "scoreChar" | "createdTime">;

export function toPublicShow(show: Show): PublicShow {
  const { pageId, pageIds, hasIcon, watchedWith, scoreAlex, scoreMish, scoreChar, createdTime, ...rest } = show;
  void pageId, pageIds, hasIcon, watchedWith, scoreAlex, scoreMish, scoreChar, createdTime;
  return rest;
}

export interface Episode {
  /** Notion row of the episode. Server only. */
  pageId: string;
  /** Primary Notion row of the show this episode belongs to. */
  showPageId: string;
  season: number;
  episode: number;
  title: string;
  watched: boolean;
  watchedDate?: string;
  /** YYYY-MM-DD, when it airs (or aired). Unknown for episodes added by hand. */
  airDate?: string;
}

export type PublicEpisode = Pick<Episode, "season" | "episode" | "title" | "watched" | "watchedDate">;

export const toPublicEpisode = ({ season, episode, title, watched, watchedDate }: Episode): PublicEpisode => ({ season, episode, title, watched, watchedDate });

/** Fields the owner can change on a show. null clears the value. */
export interface ShowPatch {
  status?: string;
  score?: number | null;
  currentSeason?: number | null;
  lastWatchedEpisode?: number | null;
  episodesOfCurrentSeason?: number | null;
  /** Place on the Top list ("06"); set by the Ranks screen. */
  top?: string | null;
  // Set by the fill tool, not by the edit form.
  tvmazeId?: number | null;
  poster?: string | null;
  seasons?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export interface NewShow {
  name: string;
  type?: string;
  status?: string;
  platforms?: string[];
  genres?: string[];
  seasons?: number;
  startDate?: string;
  endDate?: string;
  tvmazeId?: number;
  poster?: string;
  /** Episode count of each season, in order: [7, 13, 13]. Creates the Episodes rows too. */
  episodesPerSeason?: number[];
}

export interface NewEpisode {
  season: number;
  episode: number;
  title: string;
  watched?: boolean;
  watchedDate?: string;
  airDate?: string;
}

export interface Progress {
  watched: number;
  total: number;
  /** 0 to 100. */
  percent: number;
  /** episodes: counted from Episodes rows. estimate: guessed from the show's own fields. status: just "Watched". none: nothing known. */
  source: "episodes" | "estimate" | "status" | "none";
}

export interface SeasonProgress {
  season: number;
  watched: number;
  total: number;
}

/** Where a season sits along the whole show, like a marathon's split markers. */
export interface Split {
  season: number;
  /** 0 to 1: share of all episodes watched once this season is done. */
  end: number;
}

/** What list pages need per show: the public fields plus progress worked out on the server. */
export interface ShowSummary extends PublicShow {
  /** Has a poster but the Notion page has no icon yet (owner banner). */
  needsIcon?: boolean;
  progress: Progress;
  /** Season markers for the progress line, when the show has Episodes rows. */
  splits?: Split[];
  /** "S2E12", when there is a next episode to watch. */
  next?: string;
}
