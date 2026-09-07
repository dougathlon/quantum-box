import { describe, expect, it } from "vitest";

import { createQuantmanRetryRequest } from "../../src/app/QuantmanRetry";
import { createRunContext } from "../../src/core/run";

describe("Quantman retry authority", () => {
  it("starts a fresh Story replay run without converting it to current-stage play", () => {
    const context = createRunContext({
      gameId: "quantman",
      storyStage: "quantman-stabilize",
      playMode: "story",
      rulesVersion: "quantman-rules-test-v1",
      runSeed: 0x1234_5678,
      pack: {
        packId: "quantman-test-pack",
        contentSha256: "a".repeat(64),
        schemaVersion: "quantman-test-pack-v1",
        source: "synthetic-control",
      },
    });
    expect(
      createQuantmanRetryRequest(
        context,
        "stabilize-gaze",
        true,
        null,
        0x8765_4321,
      ),
    ).toEqual({
      playMode: "story",
      mechanic: "stabilize-gaze",
      runSeed: 0x8765_4321,
      storyReplay: true,
      arcadeRunOrigin: "developer-qa",
    });
  });

  it("preserves player Arcade record eligibility across a retry", () => {
    const context = createRunContext({
      gameId: "quantman",
      storyStage: null,
      playMode: "arcade",
      rulesVersion: "quantman-rules-test-v1",
      runSeed: 91,
      pack: {
        packId: "quantman-test-pack",
        contentSha256: "b".repeat(64),
        schemaVersion: "quantman-test-pack-v1",
        source: "synthetic-control",
      },
    });
    expect(
      createQuantmanRetryRequest(
        context,
        "inverse-gaze",
        false,
        "player-arcade",
        92,
      ),
    ).toMatchObject({
      playMode: "arcade",
      runSeed: 92,
      storyReplay: false,
      arcadeRunOrigin: "player-arcade",
    });
  });
});
