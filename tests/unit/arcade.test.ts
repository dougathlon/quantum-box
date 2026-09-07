import { describe, expect, it } from "vitest";

import {
  isArcadeScoreEligible,
  parseArcadeRunSeed,
} from "../../src/app/arcade";

describe("Arcade run seed", () => {
  it("accepts the complete uint32 range", () => {
    expect(parseArcadeRunSeed("0")).toBe(0);
    expect(parseArcadeRunSeed("4294967295")).toBe(0xffff_ffff);
  });

  it("rejects ambiguous, fractional, or out-of-range values", () => {
    for (const value of ["", "1.5", "-1", "4294967296", "seed"]) {
      expect(() => parseArcadeRunSeed(value)).toThrow("Arcade run seed");
    }
  });

  it("keeps player Arcade records separate from Story and developer QA", () => {
    expect(isArcadeScoreEligible("arcade", "player-arcade")).toBe(true);
    expect(isArcadeScoreEligible("arcade", "developer-qa")).toBe(false);
    expect(isArcadeScoreEligible("story", null)).toBe(false);
    expect(isArcadeScoreEligible("story", "player-arcade")).toBe(false);
  });
});
