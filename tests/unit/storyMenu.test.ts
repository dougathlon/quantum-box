import { describe, expect, it } from "vitest";

import {
  TERMINAL_TRANSCRIPT_PAGE_IDS,
  chapterStages,
  earliestUnclearedStage,
  storyNode,
  storyStageIntroNodeId,
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
    expect(TERMINAL_TRANSCRIPT_PAGE_IDS.skipixl).toContain(
      "skipixl-feasible-success",
    );
    expect(TERMINAL_TRANSCRIPT_PAGE_IDS.quarry.slice(-6)).toEqual([
      "ending-1",
      "ending-2",
      "ending-3",
      "ending-4",
      "postscript-1",
      "postscript-2",
    ]);
  });

  it("starts each retry at its own authored text and reaches only that stage first", () => {
    for (const chapter of [
      "qong",
      "skipixl",
      "quantman",
      "fluxball",
      "quarry",
    ] as const) {
      for (const stage of chapterStages(chapter)) {
        let node = storyNode(storyStageIntroNodeId(stage));
        let steps = 0;
        while (node.kind !== "game-launch" && steps++ < 8) {
          if (!("transitions" in node))
            throw new Error("Expected stage lead-in");
          const next = node.transitions.continue ?? node.transitions.play;
          if (!next) throw new Error("Missing stage lead-in transition");
          node = storyNode(next);
        }
        expect(node).toMatchObject({ kind: "game-launch", stageId: stage });
      }
    }
    expect(storyStageIntroNodeId("skipixl-overloaded")).toBe(
      "skipixl-overloaded-intro",
    );
    expect(storyStageIntroNodeId("fluxball-individual")).toBe(
      "fluxball-split-intro",
    );
  });
});
