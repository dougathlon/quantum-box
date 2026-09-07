import { describe, expect, it } from "vitest";

import {
  adaptQongWorkshopEvidence,
  createQongWorkshop,
  qongWorkshopCompletionScript,
} from "../../src/tutorials/qongWorkshop";
import { qongWorkshopRunInput } from "./tutorialWorldEvidenceFixtures";

describe("Qong Workshop tutorial world", () => {
  it("walks the stations and maps the exact recorded Coin Toss result to a Qong rule", async () => {
    const gate = adaptQongWorkshopEvidence(await qongWorkshopRunInput());
    expect(gate.status).toBe("validated-run");
    const expectedRule = gate.value?.result.rule;
    if (!expectedRule) throw new Error("Qong test evidence did not adapt.");
    const world = createQongWorkshop(gate);
    const phases = new Set([world.snapshot().phase]);

    for (const action of qongWorkshopCompletionScript(expectedRule)) {
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
    expect(world.snapshot()).toMatchObject({
      phase: "completion",
      mechanism: {
        inspectedResult: true,
        inspectedSelection: true,
        selectedRule: expectedRule,
        mappingCorrect: true,
        operationPerformed: true,
      },
      completion: {
        worldComplete: true,
        demonstratedUnderstanding: true,
        storyProgressGranted: true,
      },
    });
  });
});
