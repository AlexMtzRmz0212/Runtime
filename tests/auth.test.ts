import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth";
import { toPublicEpisode, toPublicShow, type Episode, type Show } from "@/lib/types";

describe("public showcase", () => {
  it("only the read-only pages are open to visitors", () => {
    for (const p of ["/", "/finishers", "/top", "/login", "/api/me", "/api/shows-index", "/show/breaking-bad"]) expect(isPublicPath(p)).toBe(true);
    for (const p of ["/add", "/api/shows", "/api/shows/breaking-bad", "/api/episodes", "/api/episodes/watching", "/showcase"]) expect(isPublicPath(p)).toBe(false);
  });

  it("strips Notion ids and private fields from shows", () => {
    const show: Show = {
      slug: "lost",
      pageId: "abc",
      pageIds: ["abc", "def"],
      name: "Lost",
      score: 5.5,
      genres: [],
      cast: [],
      directors: [],
      watchedWith: "Kary",
      scoreAlex: 7,
      scoreMish: 8,
      scoreChar: 6,
      createdTime: "2024-01-01",
    };
    const pub = toPublicShow(show);
    expect(pub).toEqual({ slug: "lost", name: "Lost", score: 5.5, genres: [], cast: [], directors: [] });
    expect(JSON.stringify(pub)).not.toMatch(/abc|Kary/);
  });

  it("strips Notion ids from episodes", () => {
    const ep: Episode = { pageId: "e1", showPageId: "abc", season: 1, episode: 2, title: "Pilot", watched: true };
    expect(toPublicEpisode(ep)).toEqual({ season: 1, episode: 2, title: "Pilot", watched: true, watchedDate: undefined, watching: undefined, airDate: undefined });
  });
});
