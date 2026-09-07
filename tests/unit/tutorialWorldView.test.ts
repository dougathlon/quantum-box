import { describe, expect, it } from "vitest";
import { TUTORIAL_SNAPSHOT_VERSION } from "../../src/tutorials/contracts";
import {
  TUTORIAL_REGISTRY,
  type TutorialRuntimeSnapshot,
} from "../../src/tutorials/registry";
import {
  TUTORIAL_WORLD_LAYOUT,
  TUTORIAL_WORLD_TEXT_PIXEL,
  shouldDrawTutorialFeedback,
  tutorialAuthorityLabel,
  tutorialMorphFrame,
  tutorialOverlayLines,
  tutorialTileCenter,
  tutorialZoneProgress,
} from "../../src/display/views/TutorialWorldView";

describe("spatial tutorial renderer contract", () => {
  it("maps every 11x9 room onto exact 20x20 logical-pixel tiles", () => {
    expect(TUTORIAL_WORLD_LAYOUT.tileSize / 2).toBe(20);
    expect(
      (TUTORIAL_WORLD_LAYOUT.columns * TUTORIAL_WORLD_LAYOUT.tileSize) / 2,
    ).toBe(220);
    expect(
      (TUTORIAL_WORLD_LAYOUT.rows * TUTORIAL_WORLD_LAYOUT.tileSize) / 2,
    ).toBe(180);
    expect(tutorialTileCenter({ row: 7, col: 5 })).toEqual({
      x: 320,
      y: 300,
      bottomY: 318,
    });

    for (const definition of Object.values(TUTORIAL_REGISTRY).map(
      (entry) => entry.definition,
    )) {
      expect(definition.collisionRows).toHaveLength(9);
      expect(definition.collisionRows.every((row) => row.length === 11)).toBe(
        true,
      );
    }
  });

  it("draws tutorial copy on whole native framebuffer pixels", () => {
    expect(TUTORIAL_WORLD_TEXT_PIXEL).toBe(2);
    expect(TUTORIAL_WORLD_TEXT_PIXEL / 2).toBe(1);
  });

  it("uses the approved sparse true-morph frames and no SkiPixl morph", () => {
    expect([0, 1, 2, 3].map(tutorialMorphFrame)).toEqual([0, 2, 4, 6]);
    expect(() => tutorialMorphFrame(4)).toThrow(/outside 0\.\.3/);
    expect(TUTORIAL_REGISTRY.qong.morphAssetId).toBe("qong-paddle-to-wizard");
    expect(TUTORIAL_REGISTRY.fluxball.morphAssetId).toBe(
      "fluxball-player-a-to-wizard",
    );
    expect(TUTORIAL_REGISTRY.quantman.morphAssetId).toBe(
      "quantman-ghost-c-to-wizard",
    );
    expect(TUTORIAL_REGISTRY.skipixl.morphAssetId).toBeNull();
  });

  it("projects mechanism state onto its spatial stations", () => {
    const snapshot = qongTutorialSnapshot({
      inspectedResult: true,
      inspectedSelection: true,
      selectedRule: "invert",
      mappingCorrect: true,
      operationPerformed: true,
      lastReading: null,
    });

    expect(tutorialZoneProgress(snapshot, "coin-result")).toBe("visited");
    expect(tutorialZoneProgress(snapshot, "selection")).toBe("visited");
    expect(tutorialZoneProgress(snapshot, "invert")).toBe("resolved");
    expect(tutorialZoneProgress(snapshot, "direct")).toBe("idle");
  });

  it("wraps visible tutorial dialogue on the integer bitmap plane", () => {
    const lines = tutorialOverlayLines(
      "A RECORDED RESULT BECOMES A RULE WITHOUT CONTACTING THE NETWORK DURING PLAY",
      100,
      TUTORIAL_WORLD_TEXT_PIXEL,
    );
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.join(" ")).toBe(
      "A RECORDED RESULT BECOMES A RULE WITHOUT CONTACTING THE NETWORK DURING PLAY",
    );
  });

  it("keeps non-authoritative tutorial labels concise without hiding their boundary", () => {
    const snapshot = qongTutorialSnapshot({
      inspectedResult: false,
      inspectedSelection: false,
      selectedRule: null,
      mappingCorrect: false,
      operationPerformed: false,
      lastReading: null,
    });

    expect(tutorialAuthorityLabel(snapshot)).toBe(
      "FIXTURE / NO STORY PROGRESS",
    );
    expect(shouldDrawTutorialFeedback(snapshot)).toBe(false);
  });
});

function qongTutorialSnapshot(
  mechanism: TutorialRuntimeSnapshot<"qong">["world"]["mechanism"],
): TutorialRuntimeSnapshot<"qong"> {
  return {
    gameId: "qong",
    worldId: "qong-workshop",
    title: "Qong Workshop",
    definition: TUTORIAL_REGISTRY.qong.definition,
    morphAssetId: "qong-paddle-to-wizard",
    evidence: {
      requestOrigin: "development-fixture",
      status: "development-fixture",
      authority: "development-fixture",
      label: "DEVELOPMENT FIXTURE · NO STORY PROGRESS",
      storyProgressEligible: false,
      reason: null,
    },
    world: {
      version: TUTORIAL_SNAPSHOT_VERSION,
      worldId: "qong-workshop",
      phase: "mechanism-interaction",
      player: {
        role: "player-candidate-c",
        tile: { row: 7, col: 5 },
        facing: "up",
        lastMoveBlocked: false,
      },
      designer: { role: "designer-wizard", morph: null },
      activeZoneId: null,
      dialogue: null,
      feedback: null,
      visitedZoneIds: [],
      evidence: {
        status: "development-fixture",
        label: "DEVELOPMENT FIXTURE · NO STORY PROGRESS",
        storyProgressEligible: false,
        reason: null,
      },
      mechanism,
      completion: {
        worldComplete: false,
        demonstratedUnderstanding: false,
        storyProgressGranted: false,
      },
    },
  };
}
