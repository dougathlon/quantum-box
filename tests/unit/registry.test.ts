import { describe, expect, it } from "vitest";

import {
  ARCADE_CABINET_IDS,
  GAME_IDS,
  STORY_CHAPTER_IDS,
  STORY_SEQUENCE,
  chapterForStoryStage,
  gameForStoryStage,
  isArcadeCabinetId,
  isShippedArcadeCabinetId,
  nextStoryStage,
} from "../../src/games/registry";

describe("Quantum Box registry", () => {
  it("ships five cabinets while preserving dormant legacy ids only at compatibility boundaries", () => {
    expect(GAME_IDS).toEqual(["qong", "skipixl", "fluxball", "quantman"]);
    expect(ARCADE_CABINET_IDS).toEqual([
      "qong",
      "skipixl",
      "fluxball",
      "quantman",
      "quarry",
    ]);
    expect(STORY_CHAPTER_IDS).toEqual([
      "qong",
      "skipixl",
      "fluxball",
      "quantman",
      "quarry",
    ]);
    expect(STORY_SEQUENCE).toEqual([
      "qong",
      "skipixl-medium",
      "skipixl",
      "fluxball-two",
      "fluxball-four",
      "quantman-stabilize",
      "quantman",
      "quarry",
    ]);
    expect(isArcadeCabinetId("enclose")).toBe(true);
    expect(isShippedArcadeCabinetId("enclose")).toBe(false);
  });

  it("maps paired stages and Quarry's reused QGraph formula coherently", () => {
    expect(gameForStoryStage("fluxball-two").id).toBe("fluxball");
    expect(gameForStoryStage("fluxball-four").id).toBe("fluxball");
    expect(gameForStoryStage("quarry").id).toBe("fluxball");
    expect(chapterForStoryStage("quarry").id).toBe("quarry");
    expect(nextStoryStage("skipixl-medium")).toBe("skipixl");
    expect(nextStoryStage("fluxball-two")).toBe("fluxball-four");
    expect(nextStoryStage("quantman")).toBe("quarry");
    expect(nextStoryStage("quarry")).toBe("complete");
  });
});
