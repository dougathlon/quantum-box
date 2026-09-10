import { describe, expect, it } from "vitest";
import {
  QuantmanSyntheticRuntime,
  runQuantmanSyntheticReplay,
} from "../../src/games/quantmanSynthetic/QuantmanSyntheticRuntime";
describe("Quantman carried run state", () => {
  it("preserves score and remaining lives across a new maze and its replay", () => {
    const runtime = new QuantmanSyntheticRuntime({
      playMode: "arcade",
      mechanic: "stabilize-gaze",
      runSeed: 47,
      startingScore: 2070,
      startingLives: 2,
    });
    expect(runtime.snapshot().simulation.score).toBe(2070);
    expect(runtime.snapshot().simulation.lives).toBe(2);
    expect(runQuantmanSyntheticReplay(runtime.replayTape())).toEqual(
      runtime.snapshot(),
    );
  });
  it("keeps fresh runs independent and rejects impossible carry state", () => {
    const fresh = new QuantmanSyntheticRuntime({
      playMode: "arcade",
      mechanic: "stabilize-gaze",
      runSeed: 47,
    });
    expect(fresh.snapshot().simulation.score).toBe(0);
    expect(
      () =>
        new QuantmanSyntheticRuntime({
          playMode: "arcade",
          mechanic: "stabilize-gaze",
          runSeed: 47,
          startingLives: 0,
        }),
    ).toThrow();
    expect(
      () =>
        new QuantmanSyntheticRuntime({
          playMode: "arcade",
          mechanic: "stabilize-gaze",
          runSeed: 47,
          startingScore: -1,
        }),
    ).toThrow();
  });
});
