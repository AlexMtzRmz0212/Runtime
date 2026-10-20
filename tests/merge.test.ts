import { describe, expect, it } from "vitest";
import { attachEpisodes, mergeShows, normalizeName, slugify, type RawShow } from "@/lib/merge";
import type { Episode } from "@/lib/types";

const raw = (over: Partial<RawShow>): RawShow => ({ pageId: "p", pageIds: ["p"], name: "X", genres: [], platforms: [], cast: [], directors: [], ...over });

describe("normalizeName", () => {
  it("ignores case, accents and punctuation", () => {
    expect(normalizeName("Dr. House")).toBe("dr house");
    expect(normalizeName("  Café   Olé ")).toBe("cafe ole");
    expect(normalizeName("Law & Order")).toBe("law and order");
  });
  it("slugifies", () => expect(slugify("How I Met your Mother")).toBe("how-i-met-your-mother"));
});

describe("mergeShows", () => {
  const oldRow = raw({ pageId: "old", pageIds: ["old"], name: "Breaking Bad", createdTime: "2024-03-26", score: 9.8, top: "02", cast: ["Bryan Cranston"], seasons: 5 });
  const newRow = raw({ pageId: "new", pageIds: ["new"], name: "breaking bad", createdTime: "2026-10-15", score: 9, scoreMish: 8, genres: ["Drama"], cast: [] });

  it("keeps the oldest row as base and fills only its empty fields", () => {
    const [show] = mergeShows([newRow, oldRow]);
    expect(show.pageId).toBe("old");
    expect(show.pageIds).toEqual(["old", "new"]);
    expect(show.name).toBe("Breaking Bad");
    expect(show.score).toBe(9.8);
    expect(show.top).toBe("02");
    expect(show.scoreMish).toBe(8);
    expect(show.genres).toEqual(["Drama"]);
    expect(show.cast).toEqual(["Bryan Cranston"]);
  });

  it("gives different shows unique slugs, even with the same name once normalized apart", () => {
    const shows = mergeShows([raw({ pageId: "a", pageIds: ["a"], name: "Lost" }), raw({ pageId: "b", pageIds: ["b"], name: "Other" })]);
    expect(shows.map((s) => s.slug)).toEqual(["lost", "other"]);
  });

  it("skips rows without a name", () => {
    expect(mergeShows([raw({ name: "  " })])).toEqual([]);
  });
});

describe("attachEpisodes", () => {
  it("re-points episodes of a merged duplicate at the primary row and drops orphans", () => {
    const shows = mergeShows([raw({ pageId: "old", pageIds: ["old"], name: "A", createdTime: "1" }), raw({ pageId: "new", pageIds: ["new"], name: "A", createdTime: "2" })]);
    const ep = (showPageId: string): Episode => ({ pageId: "e" + showPageId, showPageId, season: 1, episode: 1, title: "", watched: false });
    const out = attachEpisodes(shows, [ep("new"), ep("old"), ep("ghost")]);
    expect(out.map((e) => e.showPageId)).toEqual(["old", "old"]);
  });
});
