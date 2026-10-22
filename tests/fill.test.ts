import { describe, expect, it } from "vitest";
import { RecentEpisodes, describeRule, episodeKey, isEpisodeKey, isWatched, planFill, watchedRule } from "@/lib/fill";
import { pickBest, showFromTvmaze, toCandidate, toCast, toCreators, toEpisodes, type Candidate } from "@/lib/tvmaze";

const today = "2026-10-20";

describe("watchedRule / isWatched", () => {
  it("Watched shows are watched, apart from episodes that haven't aired", () => {
    const rule = watchedRule({ status: "Watched" });
    expect(isWatched(rule, { season: 1, episode: 1, airDate: "2010-01-01" }, today)).toBe(true);
    expect(isWatched(rule, { season: 9, episode: 1, airDate: "2027-01-01" }, today)).toBe(false);
  });
  it("a finished show stays unwatched past its recorded seasons", () => {
    const rule = watchedRule({ status: "Watched", seasons: 1 });
    expect(isWatched(rule, { season: 1, episode: 10, airDate: "2023-04-06" }, today)).toBe(true);
    expect(isWatched(rule, { season: 2, episode: 1, airDate: "2025-06-05" }, today)).toBe(false);
    expect(describeRule(rule)).toMatch(/season 1/);
  });
  it("In Progress with a season and episode is watched up to there", () => {
    const rule = watchedRule({ status: "In Progress", currentSeason: 2, lastWatchedEpisode: 11 });
    expect(rule).toEqual({ kind: "upTo", season: 2, episode: 11 });
    expect(isWatched(rule, { season: 1, episode: 22 }, today)).toBe(true);
    expect(isWatched(rule, { season: 2, episode: 11 }, today)).toBe(true);
    expect(isWatched(rule, { season: 2, episode: 12 }, today)).toBe(false);
    expect(isWatched(rule, { season: 3, episode: 1 }, today)).toBe(false);
  });
  it("anything else starts unwatched", () => {
    expect(watchedRule({ status: "Not started" })).toEqual({ kind: "none" });
    expect(watchedRule({ status: "In Progress" })).toEqual({ kind: "none" });
    expect(describeRule({ kind: "none" })).toMatch(/unwatched/);
  });
});

describe("planFill", () => {
  const listed = [1, 2, 3].map((n) => ({ season: 1, episode: n, title: `E${n}`, airDate: "2020-01-01" }));
  it("creates only what's missing and never lists existing rows", () => {
    const plan = planFill([{ season: 1, episode: 2 }], listed, { kind: "all" }, today);
    expect(plan.toCreate.map((e) => e.episode)).toEqual([1, 3]);
    expect(plan.already).toBe(1);
    expect(plan.toCreate.every((e) => e.watched)).toBe(true);
  });
  it("is empty when everything exists", () => {
    expect(planFill(listed, listed, { kind: "none" }, today)).toEqual({ toCreate: [], already: 3 });
  });
  it("skips episodes created a moment ago that Notion doesn't list yet", () => {
    expect(planFill([], listed, { kind: "none" }, today, ["1x1", "1x3"]).toCreate.map((e) => e.episode)).toEqual([2]);
  });
});

describe("RecentEpisodes", () => {
  it("remembers a show's episodes until they expire, and releases the ones asked", () => {
    const recent = new RecentEpisodes(1000);
    recent.add("show", ["1x1", "1x2"], 0);
    expect(recent.of("show", 500)).toEqual(["1x1", "1x2"]);
    expect(recent.of("other", 500)).toEqual([]);
    recent.remove("show", ["1x2"]);
    expect(recent.of("show", 500)).toEqual(["1x1"]);
    expect(recent.of("show", 1000)).toEqual([]);
  });
  it("only accepts real episode keys", () => {
    expect(["5x8", episodeKey({ season: 12, episode: 104 })].every(isEpisodeKey)).toBe(true);
    expect(["5", "x8", "5x8x1", 58, "../x"].some(isEpisodeKey)).toBe(false);
  });
});

describe("TVmaze data", () => {
  it("keeps numbered regular episodes in order and drops specials and repeats", () => {
    const eps = toEpisodes([
      { season: 2, number: 1, name: "B", airdate: "2009-01-01" },
      { season: 1, number: 2, name: "", airdate: "" },
      { season: 1, number: 1, name: "A", airdate: "2008-01-20" },
      { season: 1, number: 1, name: "dup" },
      { season: 1, number: null, name: "Special" },
      { season: 0, number: 1, name: "Season zero" },
    ]);
    expect(eps).toEqual([
      { season: 1, episode: 1, title: "A", airDate: "2008-01-20" },
      { season: 1, episode: 2, title: "Episode 2", airDate: undefined },
      { season: 2, episode: 1, title: "B", airDate: "2009-01-01" },
    ]);
  });

  const raw = { id: 169, name: "Breaking Bad", premiered: "2008-01-20", ended: "2013-09-29", status: "Ended", genres: ["Drama", "Crime", "Thriller"], network: { name: "AMC" }, image: { medium: "http://static.tvmaze.com/x.jpg" } };
  it("normalises a candidate", () => {
    expect(toCandidate(raw)).toMatchObject({ id: 169, network: "AMC", image: "https://static.tvmaze.com/x.jpg", genres: ["Drama", "Crime", "Thriller"] });
  });

  it("builds a new show using only options you already have", () => {
    const show = showFromTvmaze(
      { ...toCandidate(raw), network: "Netflix" },
      [{ season: 1, episode: 1, title: "x" }, { season: 5, episode: 1, title: "y" }],
      { genres: ["Drama", "Crime", "Comedy"], types: ["TV Series", "Anime"] },
      "Want to watch",
    );
    expect(show).toEqual({ name: "Breaking Bad", type: "TV Series", status: "Want to watch", genres: ["Drama", "Crime"], seasons: 5, startDate: "2008-01-20", endDate: "2013-09-29", tvmazeId: 169, poster: "https://static.tvmaze.com/x.jpg" });
  });
});

describe("pickBest", () => {
  const c = (id: number, name: string, premiered: string): Candidate => ({ id, name, premiered, genres: [] });
  const found = [c(1, "Lost Girl", "2010-09-12"), c(2, "Lost", "2004-09-22"), c(3, "Lost", "1990-01-01")];
  it("takes the exact name and prefers the same start year", () => {
    expect(pickBest(found, { name: "Lost", startDate: "2004-09-22" })?.id).toBe(2);
    expect(pickBest(found, { name: "Lost", year: "1990" })?.id).toBe(3);
    expect(pickBest(found, { name: "lost" })?.id).toBe(2);
  });
  it("ignores a leading The", () => {
    expect(pickBest([c(9, "The Big Bang Theory", "2007-09-24")], { name: "Big Bang Theory" })?.id).toBe(9);
  });
  it("preselects nothing when no name matches", () => {
    expect(pickBest(found, { name: "Severance" })).toBeUndefined();
  });
});

import { posterSize } from "@/lib/format";
import { newShowToProperties, pageToShow, showPatchToProperties } from "@/lib/notion/mapper";

describe("covers", () => {
  const raw = { id: 1, name: "X", image: { medium: "http://static.tvmaze.com/uploads/images/medium_portrait/1/2.jpg", original: "http://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg" } };
  it("keeps the big picture as the poster and the small one for pickers, over https", () => {
    expect(toCandidate(raw)).toMatchObject({ poster: "https://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg", image: "https://static.tvmaze.com/uploads/images/medium_portrait/1/2.jpg" });
    expect(toCandidate({ id: 1, name: "X" }).poster).toBeUndefined();
  });
  it("derives the small size from the stored URL", () => {
    const big = "https://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg";
    expect(posterSize(big, "medium")).toBe("https://static.tvmaze.com/uploads/images/medium_portrait/1/2.jpg");
    expect(posterSize(big, "original")).toBe(big);
    expect(posterSize("https://example.com/a.jpg", "medium")).toBe("https://example.com/a.jpg");
  });
  it("reads and writes the Poster column", () => {
    const page = { id: "p", properties: { Name: { title: [{ plain_text: "X" }] }, Poster: { url: "https://x/y.jpg" } } };
    expect(pageToShow(page, "Name").poster).toBe("https://x/y.jpg");
    expect(pageToShow({ id: "p", properties: { Name: page.properties.Name, Poster: { url: null } } }, "Name").poster).toBeUndefined();
    expect(showPatchToProperties({ poster: "https://x/y.jpg" })).toEqual({ Poster: { url: "https://x/y.jpg" } });
    expect(newShowToProperties({ name: "X", poster: "https://x/y.jpg" }, "Name").Poster).toEqual({ url: "https://x/y.jpg" });
  });
  it("a new show from TVmaze carries its poster", () => {
    const show = showFromTvmaze(toCandidate(raw), [], { genres: [], types: ["TV Series"] });
    expect(show.poster).toBe("https://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg");
  });
});

describe("icons", () => {
  it("reads whether a Notion page already has an icon", () => {
    const base = { id: "p", properties: { Name: { title: [{ plain_text: "X" }] } } };
    expect(pageToShow({ ...base, icon: { type: "external", external: { url: "https://x/y.jpg" } } }, "Name").hasIcon).toBe(true);
    expect(pageToShow({ ...base, icon: null }, "Name").hasIcon).toBe(false);
  });
  it("keeps hasIcon out of what visitors get", async () => {
    const { toPublicShow } = await import("@/lib/types");
    const pub = toPublicShow({ slug: "x", pageId: "p", pageIds: ["p"], name: "X", genres: [], cast: [], directors: [], poster: "https://x/y.jpg", hasIcon: false });
    expect("hasIcon" in pub).toBe(false);
    expect(pub.poster).toBe("https://x/y.jpg");
  });
});

import { isTvmazeImage, toPosterOptions } from "@/lib/tvmaze";

describe("poster options", () => {
  const img = (id: number, main: boolean, type = "poster") => ({ type, main, resolutions: { original: { url: `http://static.tvmaze.com/uploads/images/original_untouched/1/${id}.jpg` } } });
  it("lists main first, then seasons, then alternates, without repeats or non-posters", () => {
    const opts = toPosterOptions(
      [img(3, false), img(1, true), img(2, false), img(9, false, "background"), img(2, false)],
      [{ number: 2, image: { original: "https://static.tvmaze.com/uploads/images/original_untouched/1/3.jpg" } }, { number: 1, image: { original: "https://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg" } }, { number: 3, image: null }],
    );
    expect(opts.map((o) => `${o.label}:${o.url.split("/").pop()}`)).toEqual(["Main:1.jpg", "Season 1:2.jpg", "Season 2:3.jpg"]);
  });
  it("only accepts TVmaze's own image host", () => {
    expect(isTvmazeImage("https://static.tvmaze.com/uploads/images/original_untouched/1/2.jpg")).toBe(true);
    for (const bad of ["http://static.tvmaze.com/uploads/images/a.jpg", "https://evil.example/uploads/images/a.jpg", "https://static.tvmaze.com/other/a.jpg", "https://static.tvmaze.com/uploads/images/../x", undefined, 5]) {
      expect(isTvmazeImage(bad)).toBe(false);
    }
  });
});

describe("cast and creators", () => {
  it("reads names in order, without repeats or commas", () => {
    expect(toCast([{ person: { name: "Bryan Cranston" } }, { person: { name: "Aaron Paul" } }, { person: { name: "Bryan Cranston" } }, { person: { name: "Smith, Jr." } }])).toEqual(["Bryan Cranston", "Aaron Paul", "Smith Jr."]);
    expect(toCreators([{ type: "Creator", person: { name: "Vince Gilligan" } }, { type: "Executive Producer", person: { name: "Mark Johnson" } }])).toEqual(["Vince Gilligan"]);
  });
});
