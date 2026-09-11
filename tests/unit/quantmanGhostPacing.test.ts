import { describe, expect, it } from "vitest";
import {
  QuantmanSyntheticSession,
  QUANTMAN_SYNTHETIC_FIXTURE,
} from "../../src/games/quantmanSynthetic";
import { TUNING } from "../../src/games/quantmanSynthetic/config";

describe("Quantman ghost pacing", () => {
  it("walks through the den doorway instead of teleporting at release", () => {
    const session = new QuantmanSyntheticSession(
      QUANTMAN_SYNTHETIC_FIXTURE,
      29,
    );
    let state = session.snapshot();
    for (let tick = 0; tick < 60; tick++)
      state = session.step({ direction: null, start: true });
    expect(state.ghosts[0]).toMatchObject({ room: 44, nextRoom: 45 });
    expect(state.ghosts[0]!.progress).toBeGreaterThan(0);
    expect(state.ghosts[1]!.mode).toBe("waiting");
    for (let tick = 0; tick < 74; tick++)
      state = session.step({ direction: null, start: true });
    expect(state.ghosts[0]!.room).toBe(35);
  });
  it("slows a ghost leaving a tunnel mouth", () => {
    const session = new QuantmanSyntheticSession(
      QUANTMAN_SYNTHETIC_FIXTURE,
      29,
      {
        ghostStartRooms: [50, 44, 54, 55],
        ghostReleaseTicks: [0, 150, 240, 330],
        initialTopologyIndex: 0,
      },
    );
    const ghost = session.step({ direction: null, start: true }).ghosts[0]!;
    expect(ghost.nextRoom).not.toBeNull();
    expect(ghost.progress).toBeCloseTo(
      (TUNING.ghostRoomsPerSecond / TUNING.simulationHz) *
        TUNING.ghostTunnelSpeedMultiplier,
    );
  });
});
