import { describe, expect, it } from "vitest";
import { encodeRank, rankBetween, ranksForCount } from "./boardRank.js";

describe("board ranks", () => {
  it("inserts between two neighbors", () => {
    const a = encodeRank(1024);
    const b = encodeRank(2048);
    const mid = rankBetween(a, b);
    expect(mid).toBe(encodeRank(1536));
    expect(mid! > a).toBe(true);
    expect(mid! < b).toBe(true);
  });

  it("spaces a full column", () => {
    const ranks = ranksForCount(3);
    expect(ranks).toHaveLength(3);
    expect(ranks[0] < ranks[1]).toBe(true);
    expect(ranks[1] < ranks[2]).toBe(true);
  });
});
