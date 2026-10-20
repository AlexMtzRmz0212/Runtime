import { describe, expect, it } from "vitest";
import { showPatchToProperties } from "@/lib/notion/mapper";
import { parseOrder, rankChanges, rankLabel, ranked, sharedRanks } from "@/lib/ranks";

const show = (slug: string, top?: string) => ({ slug, name: slug, top });

describe("ranked", () => {
  it("orders by place, then by name where two shows share one", () => {
    const list = ranked([show("office", "03"), show("lost"), show("the-last-of-us", "06"), show("the-good-place", "06"), show("modern-family", "01")]);
    expect(list.map((s) => s.slug)).toEqual(["modern-family", "office", "the-good-place", "the-last-of-us"]);
  });
  it("puts 10 after 9", () => {
    expect(ranked([show("b", "10"), show("a", "09")]).map((s) => s.top)).toEqual(["09", "10"]);
  });
});

describe("sharedRanks", () => {
  it("finds places held twice", () => {
    expect(sharedRanks([show("a", "06"), show("b", "06"), show("c", "01"), show("d")])).toEqual(["06"]);
  });
});

describe("rankChanges", () => {
  const shows = [show("a", "01"), show("b", "02"), show("c", "02"), show("d")];
  it("renumbers the order and only writes shows that change", () => {
    expect(rankChanges(shows, ["a", "b", "c"])).toEqual([{ slug: "c", top: "03" }]);
  });
  it("moves, adds and takes shows off the list", () => {
    expect(rankChanges(shows, ["d", "a", "c"])).toEqual([
      { slug: "a", top: "02" },
      { slug: "b", top: null },
      { slug: "c", top: "03" },
      { slug: "d", top: "01" },
    ]);
  });
  it("writes nothing when the order is unchanged", () => {
    expect(rankChanges([show("a", "01"), show("b", "02")], ["a", "b"])).toEqual([]);
  });
  it("labels places with two digits", () => {
    expect(rankLabel(6)).toBe("06");
    expect(rankLabel(12)).toBe("12");
  });
});

describe("parseOrder", () => {
  const slugs = new Set(["a", "b"]);
  it("accepts known shows, each once", () => {
    expect(parseOrder({ order: ["b", "a"] }, slugs)).toEqual({ ok: true, value: ["b", "a"] });
    expect(parseOrder({ order: [] }, slugs)).toEqual({ ok: true, value: [] });
  });
  it("rejects repeats, unknown shows and other shapes", () => {
    expect(parseOrder({ order: ["a", "a"] }, slugs).ok).toBe(false);
    expect(parseOrder({ order: ["z"] }, slugs).ok).toBe(false);
    expect(parseOrder({ order: "a" }, slugs).ok).toBe(false);
    expect(parseOrder({}, slugs).ok).toBe(false);
  });
});

describe("Top in Notion", () => {
  it("is written as a select, and cleared with null", () => {
    expect(showPatchToProperties({ top: "06" })).toEqual({ Top: { select: { name: "06" } } });
    expect(showPatchToProperties({ top: null })).toEqual({ Top: { select: null } });
  });
});
