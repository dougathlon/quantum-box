import { describe, expect, it } from "vitest";

import {
  adaptSkiPixlLodgeEvidence,
  createSkiPixlLodge,
  SKIPIXL_LODGE_COMPLETION_SCRIPT,
} from "../../src/tutorials/skiPixlLodge";
import { skiPixlLodgeRunInput } from "./tutorialWorldEvidenceFixtures";

describe("SkiPixl Lodge tutorial world", () => {
  it("inspects three exact QPixl readings and links them to their course obstacles", () => {
    const gate = adaptSkiPixlLodgeEvidence(skiPixlLodgeRunInput());
    expect(gate.status).toBe("validated-run");
    const world = createSkiPixlLodge(gate);
    const phases = new Set([world.snapshot().phase]);

    for (const action of SKIPIXL_LODGE_COMPLETION_SCRIPT) {
      phases.add(world.dispatch(action).phase);
    }

    expect([...phases]).toEqual([
      "approach",
      "dialogue",
      "spatial-exploration",
      "mechanism-interaction",
      "demonstrated-understanding",
      "completion",
    ]);
    const snapshot = world.snapshot();
    expect(snapshot.mechanism.operationPerformed).toBe(true);
    expect(snapshot.mechanism.links).toHaveLength(3);
    snapshot.mechanism.links.forEach((link) => {
      const grid = gate.value?.grids[link.gridIndex];
      expect(link).toMatchObject({
        segmentId: grid?.segmentId,
        obstacleId: grid?.obstacle.obstacleId,
        courseRow: grid?.row.courseRow,
        column: grid?.reading.column,
        residual: grid?.reading.residual,
      });
    });
    expect(snapshot.completion.storyProgressGranted).toBe(true);
  });
});
