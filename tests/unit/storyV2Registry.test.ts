import { describe, expect, it } from "vitest";
import {
  nextStoryV2Stage,
  STORY_V2_CHAPTER_SEQUENCE,
  STORY_V2_CHAPTERS,
  STORY_V2_STAGE_SEQUENCE,
  STORY_V2_STAGES,
  storyV2ChapterProgress,
} from "../../src/story/v2";

describe("Story v2 registry", () => {
  it("locks eight stages into five visible chapters", () => {
    expect(STORY_V2_STAGE_SEQUENCE).toEqual([
      "qong",
      "skipixl-medium",
      "skipixl",
      "fluxball-two",
      "fluxball-four",
      "quantman-stabilize",
      "quantman",
      "quarry",
    ]);
    expect(STORY_V2_CHAPTER_SEQUENCE).toEqual([
      "qong",
      "skipixl",
      "fluxball",
      "quantman",
      "quarry",
    ]);
    expect(STORY_V2_CHAPTERS.skipixl.stageIds).toEqual([
      "skipixl-medium",
      "skipixl",
    ]);
    expect(STORY_V2_CHAPTERS.fluxball.stageIds).toEqual([
      "fluxball-two",
      "fluxball-four",
    ]);
    expect(STORY_V2_CHAPTERS.quantman.stageIds).toEqual([
      "quantman-stabilize",
      "quantman",
    ]);
  });

  it("uses Quarry, never Quag, for canonical new Story launch identity", () => {
    expect(STORY_V2_STAGES.quarry.launch.runtimeGameId).toBe("quarry");
    expect(JSON.stringify(STORY_V2_STAGES)).not.toContain('"quag"');
  });

  it("requires the intended evidence-bearing qualification at every stage", () => {
    expect(
      STORY_V2_STAGE_SEQUENCE.map((stageId) =>
        Object.freeze({
          stageId,
          qualification: STORY_V2_STAGES[stageId].qualification,
        }),
      ),
    ).toEqual([
      { stageId: "qong", qualification: "match-win" },
      { stageId: "skipixl-medium", qualification: "descent-finish" },
      { stageId: "skipixl", qualification: "descent-finish" },
      { stageId: "fluxball-two", qualification: "match-win" },
      { stageId: "fluxball-four", qualification: "match-win" },
      { stageId: "quantman-stabilize", qualification: "screen-clear" },
      { stageId: "quantman", qualification: "screen-clear" },
      { stageId: "quarry", qualification: "unique-score-leader" },
    ]);
  });

  it("advances in exact order and reports chapter progress without inventing stages", () => {
    expect(nextStoryV2Stage("qong")).toBe("skipixl-medium");
    expect(nextStoryV2Stage("fluxball-two")).toBe("fluxball-four");
    expect(nextStoryV2Stage("quarry")).toBe("complete");
    expect(
      storyV2ChapterProgress("skipixl", ["qong", "skipixl-medium"]),
    ).toEqual({ completed: 1, total: 2 });
    expect(storyV2ChapterProgress("quarry", ["qong", "skipixl"])).toEqual({
      completed: 0,
      total: 1,
    });
  });

  it("freezes registry records so presentation cannot rewrite Story authority", () => {
    expect(Object.isFrozen(STORY_V2_STAGES)).toBe(true);
    expect(Object.isFrozen(STORY_V2_STAGES.quarry)).toBe(true);
    expect(Object.isFrozen(STORY_V2_STAGES.quarry.launch)).toBe(true);
    expect(Object.isFrozen(STORY_V2_CHAPTERS.quantman.stageIds)).toBe(true);
  });
});
