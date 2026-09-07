import { describe, expect, it } from "vitest";

import {
  adaptQuantmanTopologyRoomEvidence,
  createQuantmanTopologyRoom,
  quantmanTopologyRoomCompletionScript,
} from "../../src/tutorials/quantmanTopologyRoom";
import { quantmanTopologyRoomFixtureInput } from "./tutorialWorldEvidenceFixtures";

describe("Quantman Topology Room tutorial world", () => {
  it("holds a selected door, observes a whole-state change, and inspects a changed route", () => {
    const gate = adaptQuantmanTopologyRoomEvidence(
      quantmanTopologyRoomFixtureInput(),
    );
    expect(gate.status).toBe("development-fixture");
    const world = createQuantmanTopologyRoom(gate);
    const phases = new Set([world.snapshot().phase]);

    for (const action of quantmanTopologyRoomCompletionScript(
      gate.value?.doors.length ?? 1,
    )) {
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
    expect(snapshot.mechanism.observation).toMatchObject({
      heldDoorId: gate.value?.doors.at(-1)?.doorId,
      heldDoorOpen: gate.value?.doors.at(-1)?.afterDoorOpen,
      beforeStateId: gate.value?.doors.at(-1)?.beforeStateId,
      afterStateId: gate.value?.doors.at(-1)?.afterStateId,
    });
    expect(
      snapshot.mechanism.observation?.changedDoorIds.length,
    ).toBeGreaterThan(0);
    expect(snapshot.mechanism.changedRouteInspected).toBe(true);
    expect(snapshot.mechanism.operationPerformed).toBe(true);
    expect(snapshot.completion).toMatchObject({
      worldComplete: true,
      storyProgressGranted: false,
    });
  });
});
