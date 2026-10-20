import { describe, expect, it } from "vitest";
import { parseNewShow, parsePatch, parseToggle } from "@/lib/validate";

const options = ["Not started", "Want to watch", "In Progress", "Watched"];

describe("parsePatch", () => {
  it("accepts known fields and ignores the rest", () => {
    expect(parsePatch({ status: "Watched", score: 9.5, pageId: "x", top: "01" }, options)).toEqual({ ok: true, value: { status: "Watched", score: 9.5 } });
  });
  it("rejects bad values", () => {
    expect(parsePatch({ status: "Dropped" }, options).ok).toBe(false);
    expect(parsePatch({ score: 11 }, options).ok).toBe(false);
    expect(parsePatch({ currentSeason: 0 }, options).ok).toBe(false);
    expect(parsePatch({ lastWatchedEpisode: 1.5 }, options).ok).toBe(false);
    expect(parsePatch({}, options).ok).toBe(false);
  });
  it("lets null clear a value", () => {
    expect(parsePatch({ score: null }, options)).toEqual({ ok: true, value: { score: null } });
  });
});

describe("parseNewShow", () => {
  it("needs a name and a known type", () => {
    expect(parseNewShow({ name: " " }, options).ok).toBe(false);
    expect(parseNewShow({ name: "X", type: "Podcast" }, options).ok).toBe(false);
    expect(parseNewShow({ name: " Severance ", type: "TV Series", episodesPerSeason: [9, 10] }, options)).toEqual({
      ok: true,
      value: { name: "Severance", type: "TV Series", episodesPerSeason: [9, 10] },
    });
  });
  it("limits the episode list", () => {
    expect(parseNewShow({ name: "X", episodesPerSeason: [0] }, options).ok).toBe(false);
    expect(parseNewShow({ name: "X", episodesPerSeason: Array(41).fill(1) }, options).ok).toBe(false);
    expect(parseNewShow({ name: "X", episodesPerSeason: Array(10).fill(300) }, options).ok).toBe(false);
  });
});

describe("parseToggle", () => {
  it("defaults the date to today", () => {
    const r = parseToggle({ show: "lost", watched: true });
    expect(r.ok && r.value.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("needs a season with episode numbers", () => {
    expect(parseToggle({ show: "lost", watched: true, episodes: [1] }).ok).toBe(false);
    expect(parseToggle({ show: "lost", watched: true, season: 1, episodes: [1, 2] }).ok).toBe(true);
  });
  it("rejects a non-boolean watched and a bad date", () => {
    expect(parseToggle({ show: "lost", watched: "yes" }).ok).toBe(false);
    expect(parseToggle({ show: "lost", watched: true, date: "yesterday" }).ok).toBe(false);
  });
});

describe("parseToggle upTo", () => {
  it("accepts everything up until an episode, with no watched date", () => {
    expect(parseToggle({ show: "lost", watched: true, upTo: { season: 2, episode: 5 } })).toEqual({ ok: true, value: { show: "lost", upTo: { season: 2, episode: 5 }, watched: true, date: null } });
  });
  it("can only mark watched, and stands on its own", () => {
    expect(parseToggle({ show: "lost", watched: false, upTo: { season: 2, episode: 5 } }).ok).toBe(false);
    expect(parseToggle({ show: "lost", watched: true, season: 1, upTo: { season: 2, episode: 5 } }).ok).toBe(false);
    expect(parseToggle({ show: "lost", watched: true, upTo: { season: "2", episode: 5 } }).ok).toBe(false);
    expect(parseToggle({ show: "lost", watched: true, upTo: null }).ok).toBe(false);
  });
});
