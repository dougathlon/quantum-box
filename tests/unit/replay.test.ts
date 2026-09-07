import { describe, expect, it } from "vitest";

import {
  createReplayBundle,
  REPLAY_SCHEMA_VERSION,
  serializeReplayBundle,
} from "../../src/core/replay";
import { createRunContext } from "../../src/core/run";

const run = createRunContext({
  gameId: "qong",
  playMode: "arcade",
  rulesVersion: "qong-rules-v1",
  runSeed: 41,
  pack: {
    packId: "test-pack",
    contentSha256: "a".repeat(64),
    schemaVersion: "quantum-box-pack-v1",
    source: "synthetic-control",
  },
});

describe("replay export", () => {
  it("freezes the exact run identity, semantic tape, and final state", () => {
    const bundle = createReplayBundle({
      run,
      completion: { succeeded: true, outcome: "left" },
      inputTape: [{ leftAxis: 1, rightAxis: 0, scanPressed: false }],
      finalState: { winner: "left", score: [4, 3] },
    });

    expect(bundle.schemaVersion).toBe(REPLAY_SCHEMA_VERSION);
    expect(bundle.run.pack.contentSha256).toBe("a".repeat(64));
    expect(Object.isFrozen(bundle)).toBe(true);
    expect(Object.isFrozen(bundle.inputTape)).toBe(true);
    expect(JSON.parse(serializeReplayBundle(bundle))).toEqual(bundle);
  });

  it("rejects values that cannot form a truthful JSON replay artifact", () => {
    expect(() =>
      createReplayBundle({
        run,
        completion: { succeeded: false, outcome: "invalid" },
        inputTape: [{ axis: Number.NaN }],
        finalState: {},
      }),
    ).toThrow("non-finite");
  });
});
