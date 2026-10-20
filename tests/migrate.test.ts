import { describe, expect, it } from "vitest";
import { isWatchedValue, mapColumns, toEpisodeRow } from "@/lib/migrate/columns";
import { matchShow } from "@/lib/migrate/match";

describe("mapColumns", () => {
  it("maps a typical English episode database", () => {
    const map = mapColumns([
      { name: "Name", type: "title" },
      { name: "Season", type: "number" },
      { name: "Episode", type: "number" },
      { name: "Watched", type: "checkbox" },
      { name: "Air Date", type: "date" },
    ]);
    expect(map).toEqual({ title: "Name", season: "Season", episode: "Episode", watched: "Watched", airDate: "Air Date" });
  });

  it("maps a Spanish one, with a watched date", () => {
    const map = mapColumns([
      { name: "Título", type: "title" },
      { name: "Temporada", type: "number" },
      { name: "Capítulo", type: "number" },
      { name: "Visto", type: "checkbox" },
      { name: "Fecha vista", type: "date" },
      { name: "Fecha de estreno", type: "date" },
    ]);
    expect(map).toMatchObject({ title: "Título", season: "Temporada", episode: "Capítulo", watched: "Visto", watchedDate: "Fecha vista", airDate: "Fecha de estreno" });
  });

  it("does not take the episode title column for the episode number", () => {
    const map = mapColumns([
      { name: "Episode Title", type: "title" },
      { name: "S", type: "number" },
      { name: "Ep", type: "number" },
    ]);
    expect(map).toMatchObject({ title: "Episode Title", season: "S", episode: "Ep" });
  });

  it("leaves unknown columns unmapped", () => {
    expect(mapColumns([{ name: "Notes", type: "text" }])).toEqual({});
  });

  it("falls back to a status column for watched", () => {
    expect(mapColumns([{ name: "Season", type: "number" }, { name: "Ep", type: "number" }, { name: "Status", type: "status" }]).watched).toBe("Status");
  });
});

describe("toEpisodeRow", () => {
  const map = { title: "Name", season: "Season", episode: "Episode", watched: "Watched", watchedDate: "Seen on" };
  it("reads a row", () => {
    expect(toEpisodeRow({ Name: " Pilot ", Season: 1, Episode: 1, Watched: true, "Seen on": "2026-01-02T10:00:00Z" }, map)).toEqual({
      season: 1,
      episode: 1,
      title: "Pilot",
      watched: true,
      watchedDate: "2026-01-02",
      airDate: undefined,
    });
  });
  it("accepts CSV strings, S1/E2 prefixes and 'Yes'", () => {
    expect(toEpisodeRow({ Name: "", Season: "S2", Episode: "E5", Watched: "Yes" }, map)).toMatchObject({ season: 2, episode: 5, title: "Episode 5", watched: true });
  });
  it("skips rows without usable numbers", () => {
    expect(toEpisodeRow({ Name: "x", Season: "", Episode: 1 }, map)).toBeNull();
    expect(toEpisodeRow({ Name: "x", Season: 1.5, Episode: 1 }, map)).toBeNull();
    expect(toEpisodeRow({ Name: "x", Season: 1, Episode: 1 }, {})).toBeNull();
  });
  it("only keeps a watched date for watched episodes", () => {
    expect(toEpisodeRow({ Name: "x", Season: 1, Episode: 1, Watched: false, "Seen on": "2026-01-02" }, map)?.watchedDate).toBeUndefined();
  });
});

describe("isWatchedValue", () => {
  it("understands checkboxes, words and ticks", () => {
    for (const v of [true, 1, "true", "Sí", "x", "Watched", "✓"]) expect(isWatchedValue(v)).toBe(true);
    for (const v of [false, 0, "", "no", "Not started", null, undefined]) expect(isWatchedValue(v)).toBe(false);
  });
});

describe("matchShow", () => {
  const shows = [{ name: "Breaking Bad" }, { name: "The Office" }, { name: "Dr. House" }, { name: "Lost" }, { name: "Lost Girl" }];
  it("matches exactly, ignoring case and punctuation", () => {
    expect(matchShow("breaking bad", shows)).toMatchObject({ show: { name: "Breaking Bad" }, how: "exact" });
    expect(matchShow("Dr House", shows)).toMatchObject({ show: { name: "Dr. House" }, how: "exact" });
  });
  it("ignores words like Episodes and Tracker", () => {
    expect(matchShow("The Office - Episodes", shows)).toMatchObject({ show: { name: "The Office" }, how: "cleaned" });
    expect(matchShow("Breaking Bad Tracker", shows)).toMatchObject({ show: { name: "Breaking Bad" } });
  });
  it("matches a unique partial title", () => {
    expect(matchShow("Breaking Bad (2008)", shows)).toMatchObject({ show: { name: "Breaking Bad" }, how: "partial" });
  });
  it("refuses ambiguous and unknown titles", () => {
    expect(matchShow("Lost Episodes Tracker", shows)).toMatchObject({ show: { name: "Lost" } });
    expect(matchShow("Severance", shows).show).toBeUndefined();
    expect(matchShow("", shows).show).toBeUndefined();
  });
});
