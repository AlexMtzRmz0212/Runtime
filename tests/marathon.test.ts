import { describe, expect, it } from "vitest";
import { distanceOf, duration, hours } from "@/lib/distance";
import { addDays, recentPace } from "@/lib/pace";
import { totalRuntime } from "@/lib/tvmaze";

describe("distance", () => {
  it("splits the runtime by episodes watched", () => {
    expect(distanceOf(600, { watched: 3, total: 10, percent: 30, source: "episodes" })).toEqual({ total: 600, done: 180 });
    expect(distanceOf(600, { watched: 0, total: 0, percent: 100, source: "status" })).toEqual({ total: 600, done: 600 });
    expect(distanceOf(undefined, { watched: 3, total: 10, percent: 30, source: "episodes" })).toBeUndefined();
  });
  it("prints hours and clock times", () => {
    expect(hours(45)).toBe("45 min");
    expect(hours(270)).toBe("4.5 h");
    expect(hours(4380)).toBe("73 h");
    expect(duration(88)).toBe("1 h 28 min");
    expect(duration(180)).toBe("3 h");
  });
  it("adds up aired episodes, using the average where one is missing", () => {
    expect(totalRuntime([{ runtime: 30 }, {}, { airDate: "2030-01-01", runtime: 30 }], 25, "2026-10-21")).toBe(55);
    expect(totalRuntime([{}], undefined, "2026-10-21")).toBeUndefined();
  });
});

describe("pace", () => {
  it("counts episodes a day over the last 30 days", () => {
    const w = (watchedDate: string) => ({ watched: true, watchedDate });
    expect(recentPace([w("2026-10-20"), w("2026-10-20"), w("2026-10-21"), w("2026-10-21")], "2026-10-22")).toBe(2);
    expect(recentPace([w("2026-10-20"), w("2026-10-21")], "2026-10-22")).toBeUndefined();
    expect(recentPace([w("2026-01-01"), w("2026-01-01"), w("2026-01-01")], "2026-10-22")).toBeUndefined();
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});
