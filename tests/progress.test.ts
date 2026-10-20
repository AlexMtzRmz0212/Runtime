import { describe, expect, it } from "vitest";
import { episodeLabel, nextUp, progressOf, seasonsOf } from "@/lib/progress";

const ep = (season: number, episode: number, watched: boolean) => ({ season, episode, title: `t${season}${episode}`, watched });

describe("progressOf", () => {
  it("counts Episodes rows when there are any", () => {
    const eps = [ep(1, 1, true), ep(1, 2, true), ep(1, 3, false), ep(2, 1, false)];
    expect(progressOf({}, eps)).toEqual({ watched: 2, total: 4, percent: 50, source: "episodes" });
  });
  it("treats Watched shows without episodes as complete", () => {
    expect(progressOf({ status: "Watched" }, [])).toMatchObject({ percent: 100, source: "status" });
  });
  it("estimates from the show's own columns", () => {
    const p = progressOf({ status: "In Progress", seasons: 9, currentSeason: 2, episodesOfCurrentSeason: 22, lastWatchedEpisode: 11 }, []);
    expect(p).toMatchObject({ watched: 33, total: 198, percent: 17, source: "estimate" });
  });
  it("knows nothing without data", () => {
    expect(progressOf({ status: "Want to watch" }, [])).toMatchObject({ percent: 0, source: "none" });
  });
});

describe("seasonsOf", () => {
  it("groups and sorts by season", () => {
    expect(seasonsOf([ep(2, 1, true), ep(1, 1, true), ep(1, 2, false)])).toEqual([
      { season: 1, watched: 1, total: 2 },
      { season: 2, watched: 1, total: 1 },
    ]);
  });
});

describe("nextUp", () => {
  it("is the first unwatched episode in order", () => {
    expect(nextUp({}, [ep(2, 1, false), ep(1, 2, false), ep(1, 1, true)])).toMatchObject({ season: 1, episode: 2 });
  });
  it("is undefined when everything is watched", () => {
    expect(nextUp({}, [ep(1, 1, true)])).toBeUndefined();
  });
  it("falls back to the show's columns", () => {
    expect(nextUp({ status: "In Progress", currentSeason: 2, lastWatchedEpisode: 11, episodesOfCurrentSeason: 22 }, [])).toEqual({ season: 2, episode: 12 });
  });
  it("rolls over to the next season, but not past the last", () => {
    expect(nextUp({ status: "In Progress", seasons: 3, currentSeason: 2, lastWatchedEpisode: 22, episodesOfCurrentSeason: 22 }, [])).toEqual({ season: 3, episode: 1 });
    expect(nextUp({ status: "In Progress", seasons: 2, currentSeason: 2, lastWatchedEpisode: 22, episodesOfCurrentSeason: 22 }, [])).toBeUndefined();
  });
  it("labels", () => expect(episodeLabel(2, 5)).toBe("S2E05"));
});

import { syncFields } from "@/lib/progress";

describe("syncFields", () => {
  const eps = [ep(1, 1, true), ep(1, 2, true), ep(2, 1, false), ep(2, 2, false)];
  const options = ["Not started", "Want to watch", "In Progress", "Watched"];
  it("moves the show's columns to the last watched episode and starts it", () => {
    expect(syncFields({ status: "Want to watch" }, eps, options)).toEqual({ currentSeason: 1, lastWatchedEpisode: 2, episodesOfCurrentSeason: 2, status: "In Progress" });
  });
  it("marks the show Watched when every episode is", () => {
    expect(syncFields({ status: "In Progress" }, eps.map((e) => ({ ...e, watched: true })), options).status).toBe("Watched");
  });
  it("puts a Watched show back In Progress when an episode is unticked", () => {
    expect(syncFields({ status: "Watched" }, eps, options).status).toBe("In Progress");
  });
  it("leaves the status alone when the option doesn't exist", () => {
    expect(syncFields({ status: "Want to watch" }, eps, ["Watched"]).status).toBeUndefined();
  });
  it("resets to the start when nothing is watched", () => {
    expect(syncFields({ status: "In Progress" }, eps.map((e) => ({ ...e, watched: false })), options)).toEqual({ currentSeason: 1, lastWatchedEpisode: 0, episodesOfCurrentSeason: 2 });
  });
});

import { isUpTo } from "@/lib/progress";

describe("isUpTo", () => {
  it("counts across seasons, inclusive", () => {
    expect(isUpTo({ season: 1, episode: 22 }, 2, 3)).toBe(true);
    expect(isUpTo({ season: 2, episode: 3 }, 2, 3)).toBe(true);
    expect(isUpTo({ season: 2, episode: 4 }, 2, 3)).toBe(false);
    expect(isUpTo({ season: 3, episode: 1 }, 2, 3)).toBe(false);
  });
});

import { aired, airedAllWatched } from "@/lib/progress";
import { statusTone } from "@/lib/format";
import { isStillRunning } from "@/lib/tvmaze";

describe("Waiting status", () => {
  const today = "2026-10-20";
  const options = ["Not started", "Want to watch", "In Progress", "Waiting", "Watched"];
  const e = (season: number, episode: number, watched: boolean, airDate?: string) => ({ season, episode, watched, airDate });

  it("a running show with every aired episode watched is Waiting, even with future episodes listed", () => {
    const eps = [e(1, 1, true, "2026-01-01"), e(1, 2, true, "2026-10-13"), e(2, 1, false, "2027-01-01")];
    expect(syncFields({ status: "In Progress" }, eps, options, { today, running: true }).status).toBe("Waiting");
  });
  it("a running show with nothing left is Waiting, an ended one is Watched", () => {
    const eps = [e(1, 1, true, "2020-01-01"), e(1, 2, true, "2020-01-08")];
    expect(syncFields({ status: "In Progress" }, eps, options, { today, running: true }).status).toBe("Waiting");
    expect(syncFields({ status: "In Progress" }, eps, options, { today, running: false }).status).toBe("Watched");
  });
  it("falls back to Watched when there is no Waiting option", () => {
    const eps = [e(1, 1, true, "2020-01-01")];
    expect(syncFields({ status: "In Progress" }, eps, ["In Progress", "Watched"], { today, running: true }).status).toBe("Watched");
  });
  it("one aired episode left to watch is not Waiting", () => {
    const eps = [e(1, 1, true, "2026-01-01"), e(1, 2, false, "2026-10-13")];
    expect(syncFields({ status: "In Progress" }, eps, options, { today, running: true }).status).toBeUndefined();
  });
  it("a new aired episode takes a Waiting or Watched show back to In Progress", () => {
    const eps = [e(1, 1, true, "2026-01-01"), e(1, 2, false, "2026-10-13")];
    expect(syncFields({ status: "Waiting" }, eps, options, { today, running: true }).status).toBe("In Progress");
    expect(syncFields({ status: "Watched" }, eps, options, { today, running: false }).status).toBe("In Progress");
  });
  it("is already Waiting: no change suggested", () => {
    const eps = [e(1, 1, true, "2026-01-01")];
    expect(syncFields({ status: "Waiting" }, eps, options, { today, running: true }).status).toBeUndefined();
  });
  it("counts episodes with no air date as aired", () => {
    expect(aired([e(1, 1, true), e(1, 2, false, "2030-01-01")], today)).toHaveLength(1);
    expect(airedAllWatched([e(1, 1, true), e(1, 2, false, "2030-01-01")], today)).toBe(true);
    expect(airedAllWatched([], today)).toBe(false);
  });
  it("knows what still running means", () => {
    expect(isStillRunning("Running")).toBe(true);
    expect(isStillRunning("To Be Determined")).toBe(true);
    expect(isStillRunning("Ended")).toBe(false);
    expect(isStillRunning(undefined)).toBe(false);
  });
  it("gives Waiting its own colour", () => expect(statusTone("Waiting")).toBe("waiting"));
});
