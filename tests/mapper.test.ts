import { describe, expect, it } from "vitest";
import { newEpisodeToProperties, newShowToProperties, pageToEpisode, pageToShow, showPatchToProperties, watchedToProperties } from "@/lib/notion/mapper";

const rich = (s: string) => ({ rich_text: [{ plain_text: s }] });
const titled = (s: string) => ({ title: [{ plain_text: s }] });

describe("pageToShow", () => {
  it("reads the TV Shows columns", () => {
    const show = pageToShow(
      {
        id: "p1",
        created_time: "2024-03-26T01:00:00.000Z",
        properties: {
          Name: titled(" The Office "),
          Status: { status: { name: "In Progress" } },
          Type: { select: { name: "TV Series" } },
          Year: rich(""),
          Platform: { multi_select: [{ name: "Netflix" }] },
          Seasons: { number: 9 },
          Length: { date: { start: "2005-03-24", end: "2013-05-16" } },
          "Last watched episode": { number: 11 },
          "Score/Relevance": { number: 9.6 },
          "Watched with": { select: { name: "A&K" } },
        },
      },
      "Name",
    );
    expect(show).toMatchObject({ pageId: "p1", name: "The Office", status: "In Progress", type: "TV Series", year: undefined, platforms: ["Netflix"], seasons: 9, startDate: "2005-03-24", endDate: "2013-05-16", lastWatchedEpisode: 11, score: 9.6, watchedWith: "A&K", genres: [] });
  });
});

describe("show writes", () => {
  it("builds a patch, clearing with null", () => {
    expect(showPatchToProperties({ status: "Watched", score: null, lastWatchedEpisode: 3 })).toEqual({
      Status: { status: { name: "Watched" } },
      "Score/Relevance": { number: null },
      "Last watched episode": { number: 3 },
    });
  });
  it("uses select when Status is a select column", () => {
    expect(showPatchToProperties({ status: "Done" }, "select")).toEqual({ Status: { select: { name: "Done" } } });
  });
  it("builds a new show", () => {
    const props = newShowToProperties({ name: "Severance", type: "TV Series", status: "Want to watch", platforms: ["Apple"], episodesPerSeason: [9, 10] }, "Name");
    expect(props.Name.title[0].text.content).toBe("Severance");
    expect(props.Seasons).toEqual({ number: 2 });
    expect(props.Platform).toEqual({ multi_select: [{ name: "Apple" }] });
  });
});

describe("episodes", () => {
  const page = { id: "e1", properties: { Title: titled("Pilot"), Show: { relation: [{ id: "s1" }] }, Season: { number: 1 }, Episode: { number: 1 }, Watched: { checkbox: true }, "Watched date": { date: { start: "2026-09-01T10:00:00Z" } } } };
  it("reads a row", () => {
    expect(pageToEpisode(page, "Title")).toEqual({ pageId: "e1", showPageId: "s1", season: 1, episode: 1, title: "Pilot", watched: true, watchedDate: "2026-09-01" });
  });
  it("ignores rows with no show or numbers", () => {
    expect(pageToEpisode({ id: "x", properties: { Title: titled("Loose") } }, "Title")).toBeUndefined();
  });
  it("writes a row and the watched toggle", () => {
    const props = newEpisodeToProperties("s1", { season: 2, episode: 3, title: "T" }, "Title");
    expect(props.Show).toEqual({ relation: [{ id: "s1" }] });
    expect(props.Watched).toEqual({ checkbox: false });
    expect(watchedToProperties(false, "2026-01-01")["Watched date"]).toEqual({ date: null });
    expect(watchedToProperties(true, "2026-01-01")["Watched date"]).toEqual({ date: { start: "2026-01-01" } });
  });
});
