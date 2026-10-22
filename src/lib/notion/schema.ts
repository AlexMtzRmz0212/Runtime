/** Column names of the "TV Shows" database (kept exactly as they are in Notion). */
export const SHOW = {
  type: "Type",
  status: "Status",
  year: "Year",
  seasons: "Seasons",
  length: "Length",
  currentSeason: "Current Season",
  episodesOfCurrentSeason: "Episodes of current Season",
  lastWatchedEpisode: "Last watched episode",
  score: "Score/Relevance",
  imdb: "IMDb",
  top: "Top",
  genre: "Genre",
  cast: "Cast",
  directors: "Director/Creator",
  watchedWith: "Watched with",
  scoreAlex: "Alex Relevance/Score",
  scoreMish: "Mish Relevance/Score",
  scoreChar: "Char Relevance/Score",
  /** Added by the app when missing. */
  tvmazeId: "TVmaze ID",
  poster: "Poster",
  /** Minutes of every aired episode added up (from TVmaze): the length of the show's course. */
  runtime: "Runtime",
} as const;

export type EpisodePropType = "number" | "checkbox" | "date" | "relation";

/** Columns of the "Episodes" database. The title column is whatever it is called; the rest are added when missing. */
export const EPISODE: Record<"show" | "season" | "episode" | "watched" | "watchedDate" | "airDate" | "watching", { name: string; type: EpisodePropType }> = {
  show: { name: "Show", type: "relation" },
  season: { name: "Season", type: "number" },
  episode: { name: "Episode", type: "number" },
  watched: { name: "Watched", type: "checkbox" },
  watchedDate: { name: "Watched date", type: "date" },
  airDate: { name: "Air date", type: "date" },
  /** Started, not finished: the episode on screen right now. Cleared when it's ticked watched. */
  watching: { name: "Watching", type: "checkbox" },
};
