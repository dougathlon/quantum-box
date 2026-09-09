import { describe, expect, it } from "vitest";

import {
  TERMINAL_TRANSCRIPT_PAGE_IDS,
  chapterStages,
  earliestUnclearedStage,
} from "../../src/story/terminal";

describe("Terminal archive gating", () => {
  it("requires the exact clear set for each chapter", () => {
    expect(chapterStages("qong")).toEqual(["qong"]);
    expect(chapterStages("skipixl")).toEqual([
      "skipixl-feasible",
      "skipixl-overloaded",
    ]);
    expect(chapterStages("fluxball")).toEqual([
      "fluxball-global",
      "fluxball-individual",
    ]);
  });

  it("targets the earliest uncleared stage without changing the main cursor", () => {
    expect(earliestUnclearedStage("skipixl", [])).toBe("skipixl-feasible");
    expect(earliestUnclearedStage("skipixl", ["skipixl-feasible"])).toBe(
      "skipixl-overloaded",
    );
    expect(
      earliestUnclearedStage("skipixl", [
        "skipixl-feasible",
        "skipixl-overloaded",
      ]),
    ).toBeNull();
  });

  it("keeps five bounded transcript collections", () => {
    expect(Object.keys(TERMINAL_TRANSCRIPT_PAGE_IDS)).toEqual([
      "qong",
      "skipixl",
      "quantman",
      "fluxball",
      "quarry",
    ]);
    for (const ids of Object.values(TERMINAL_TRANSCRIPT_PAGE_IDS)) {
      expect(ids.length).toBeGreaterThan(0);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
