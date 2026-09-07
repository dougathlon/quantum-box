import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import {
  TEST_QONG_PACK_HASH,
  TEST_QONG_PACK_ID,
  TEST_QONG_SELECTION,
} from "../fixtures/qongStoryBank";

const pack = Object.freeze({
  packId: TEST_QONG_PACK_ID,
  contentSha256: TEST_QONG_PACK_HASH,
  schemaVersion: "quantum-box-pack-v1",
  source: "moth-api-qpu",
});

describe("createRunContext", () => {
  it("freezes the complete replay identity before play", () => {
    const context = createRunContext({
      gameId: "qong",
      storyStage: "qong",
      playMode: "story",
      rulesVersion: "qong-rules-v1",
      runSeed: 123,
      pack,
      packSelection: TEST_QONG_SELECTION,
    });

    expect(context.runId).toBe(
      createRunContext({
        gameId: "qong",
        storyStage: "qong",
        playMode: "story",
        rulesVersion: "qong-rules-v1",
        runSeed: 123,
        pack,
        packSelection: TEST_QONG_SELECTION,
      }).runId,
    );
    expect(Object.isFrozen(context)).toBe(true);
    expect(Object.isFrozen(context.pack)).toBe(true);
  });

  it("prevents Arcade runs from carrying Story authority", () => {
    expect(() =>
      createRunContext({
        gameId: "qong",
        storyStage: "qong",
        playMode: "arcade",
        rulesVersion: "qong-rules-v1",
        runSeed: 123,
        pack,
      }),
    ).toThrow("Arcade runs cannot carry Story authority");
  });

  it("requires a complete validated fixture identity", () => {
    expect(() =>
      createRunContext({
        gameId: "qong",
        playMode: "arcade",
        rulesVersion: "qong-rules-v1",
        runSeed: 123,
        pack: { ...pack, contentSha256: "not-a-hash" },
      }),
    ).toThrow("fixture content SHA-256");
  });
});
