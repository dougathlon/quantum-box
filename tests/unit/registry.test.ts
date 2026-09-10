import { describe, expect, it } from "vitest";

import {
  ARCADE_CABINET_DEFINITIONS,
  ARCADE_CABINET_IDS,
  GAME_IDS,
  STORY_CHAPTER_IDS,
  STORY_SEQUENCE,
  chapterForStoryStage,
  gameForStoryStage,
  isArcadeCabinetId,
  isBoundedLegacyCabinetSlug,
  isShippedArcadeCabinetId,
  nextStoryStage,
} from "../../src/games/registry";

describe("Quantum Box registry", () => {
  it("separates migration slugs from recognized and shipped identifiers", () => {
    expect(isBoundedLegacyCabinetSlug("retired-program")).toBe(true);
    expect(isArcadeCabinetId("retired-program")).toBe(false);
    expect(isShippedArcadeCabinetId("retired-program")).toBe(false);
    expect(isArcadeCabinetId("quag")).toBe(true);
    expect(isShippedArcadeCabinetId("quag")).toBe(false);
    for (const value of [null, 3, "../qong", "A", "a".repeat(65)])
      expect(isBoundedLegacyCabinetSlug(value)).toBe(false);
  });
  it("ships five cabinets in the canonical demonstration order", () => {
    expect(GAME_IDS).toEqual(["qong", "skipixl", "fluxball", "quantman"]);
    expect(ARCADE_CABINET_IDS).toEqual([
      "qong",
      "skipixl",
      "quantman",
      "fluxball",
      "quarry",
    ]);
    expect(STORY_CHAPTER_IDS).toEqual([
      "qong",
      "skipixl",
      "quantman",
      "fluxball",
      "quarry",
    ]);
    expect(STORY_SEQUENCE).toEqual([
      "qong",
      "skipixl-feasible",
      "skipixl-overloaded",
      "quantman-hold",
      "fluxball-global",
      "fluxball-individual",
      "quarry",
    ]);
    expect(isArcadeCabinetId("enclose")).toBe(true);
    expect(isShippedArcadeCabinetId("enclose")).toBe(false);
  });

  it("maps paired stages and Quarry's reused QGraph formula coherently", () => {
    expect(gameForStoryStage("fluxball-global").id).toBe("fluxball");
    expect(gameForStoryStage("fluxball-individual").id).toBe("fluxball");
    expect(gameForStoryStage("quarry").id).toBe("fluxball");
    expect(chapterForStoryStage("quarry").id).toBe("quarry");
    expect(nextStoryStage("skipixl-feasible")).toBe("skipixl-overloaded");
    expect(nextStoryStage("quantman-hold")).toBe("fluxball-global");
    expect(nextStoryStage("quarry")).toBe("complete");
  });

  it("gives every Arcade cabinet one concise trial sheet", () => {
    for (const gameId of ARCADE_CABINET_IDS) {
      const brief = ARCADE_CABINET_DEFINITIONS[gameId].brief;
      for (const line of Object.values(brief)) expect(line).toMatch(/\.$/);
    }
  });
});
