import { describe, expect, it } from "vitest";

import { createDevDesignerEncounterFixture } from "../../src/debug/DesignerEncounterFixtures";
import { startTutorial } from "../../src/tutorials/registry";

describe("Designer visual replay fixtures", () => {
  it.each(["skipixl", "fluxball", "quantman"] as const)(
    "%s uses the installed evidence path without Qong fallback data",
    (gameId) => {
      const fixture = createDevDesignerEncounterFixture(gameId);
      expect(fixture.request.gameId).toBe(gameId);
      expect(fixture.request.evidenceInput?.context.gameId).toBe(gameId);
      expect(fixture.request.evidenceInput?.context.playMode).toBe("story");
      expect(fixture.evidenceNote).toMatch(/grants no Story progress/);
      const tutorial = startTutorial(fixture.request);
      expect(tutorial.snapshot().evidence).toMatchObject({
        requestOrigin: "development-fixture",
        authority: "development-fixture",
        storyProgressEligible: false,
      });
      expect(JSON.stringify(fixture.request.evidenceInput)).not.toMatch(
        /placeholder|contract-mock|synthetic/i,
      );
    },
  );

  it("generates a qualified observed Quantman source run", () => {
    const fixture = createDevDesignerEncounterFixture("quantman");
    const request = fixture.request;
    if (request.gameId !== "quantman" || request.evidenceInput === null) {
      throw new Error("Quantman fixture returned the wrong tutorial request.");
    }
    expect(request.evidenceInput.evidence).toMatchObject({
      source: "Moth remote Aer",
      qpuEvidence: false,
    });
    expect(
      request.evidenceInput.evidence.observationsUsed,
    ).toBeGreaterThanOrEqual(1);
    expect(request.evidenceInput.evidence.transitions).toHaveLength(
      request.evidenceInput.evidence.observationsUsed,
    );
  });

  it("generates a completed fourth-round Fluxball reveal", () => {
    const fixture = createDevDesignerEncounterFixture("fluxball");
    const request = fixture.request;
    if (request.gameId !== "fluxball" || request.evidenceInput === null) {
      throw new Error("Fluxball fixture returned the wrong tutorial request.");
    }
    expect(request.evidenceInput.evidence).toMatchObject({
      source: "mixed-preacquired-bank",
      roundNumber: 4,
    });
    expect(request.evidenceInput.evidence.axes).toHaveLength(3);
  });

  it("retains SkiPixl's current bank-threshold QPixl decoder evidence", () => {
    const fixture = createDevDesignerEncounterFixture("skipixl");
    const request = fixture.request;
    if (request.gameId !== "skipixl" || request.evidenceInput === null) {
      throw new Error("SkiPixl fixture returned the wrong tutorial request.");
    }
    expect(request.evidenceInput.evidence).toMatchObject({
      source: "moth-platform-qpu-capture",
      decoderVersion: "skipixl-triplet-residual-slalom-v7",
      cutId: "P90",
      selectionPercentile: 0.9,
    });
    expect(request.evidenceInput.evidence.obstacleCount).toBeGreaterThan(60);
    expect(request.evidenceInput.evidence.denseRowCount).toBeGreaterThan(0);
    expect(request.evidenceInput.evidence.segments).toHaveLength(3);
  });
});
