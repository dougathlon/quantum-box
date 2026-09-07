import { describe, expect, it } from "vitest";

import { DEVELOPMENT_FIXTURE_LABEL } from "../../src/tutorials/contracts";
import {
  adaptFluxballClubhouseEvidence,
  createFluxballClubhouse,
  FLUXBALL_CLUBHOUSE_COMPLETION_SCRIPT,
} from "../../src/tutorials/fluxballClubhouse";
import { fluxballClubhouseFixtureInput } from "./tutorialWorldEvidenceFixtures";

describe("Fluxball Clubhouse tutorial world", () => {
  it("resolves three recorded QGraph relationships into one player's rule card", () => {
    const gate = adaptFluxballClubhouseEvidence(
      fluxballClubhouseFixtureInput(),
    );
    expect(gate).toMatchObject({
      status: "development-fixture",
      label: DEVELOPMENT_FIXTURE_LABEL,
      storyProgressEligible: false,
    });
    const world = createFluxballClubhouse(gate);
    const phases = new Set([world.snapshot().phase]);

    for (const action of FLUXBALL_CLUBHOUSE_COMPLETION_SCRIPT) {
      phases.add(world.dispatch(action).phase);
    }

    expect([...phases]).toEqual([
      "approach",
      "true-morph",
      "dialogue",
      "spatial-exploration",
      "mechanism-interaction",
      "demonstrated-understanding",
      "completion",
    ]);
    const snapshot = world.snapshot();
    expect(snapshot.mechanism.selectedPlayerId).toBe("A");
    expect(snapshot.mechanism.ruleCard).toHaveLength(3);
    expect(
      snapshot.mechanism.ruleCard.map(({ dimension }) => dimension),
    ).toEqual(["ACTION", "INTERACTION", "PURPOSE"]);
    expect(snapshot.mechanism.operationPerformed).toBe(true);
    expect(snapshot.evidence.label).toBe(DEVELOPMENT_FIXTURE_LABEL);
    expect(snapshot.completion).toMatchObject({
      worldComplete: true,
      storyProgressGranted: false,
    });
  });
});
