import { describe, expect, it, vi } from "vitest";

import {
  isInstalledFluxballStoryRun,
  isInstalledQuantmanStoryRun,
  isInstalledQuarryStoryRun,
  persistSkiPixlStoryResult,
  resolveInstalledQongStoryRun,
  resolveInstalledSkiPixlStoryRun,
  resolveStoryRetryLaunch,
} from "../../src/app/StoryResultPersistence";
import { createRunContext } from "../../src/core/run";
import { fluxballRulePackFor } from "../../src/games/fluxball/fluxballControlPacks";
import {
  loadInstalledQongStoryBank,
  selectQongStoryPack,
} from "../../src/games/qong/qongStoryPackBank";
import {
  loadInstalledQuarryQpuBank,
  selectQuarryQpuPack,
} from "../../src/games/qgraph/quarryQpuBank";
import { QUAG_RULES_VERSION } from "../../src/games/quag/types";
import {
  QUANTMAN_QPU_RULES_VERSION,
  loadInstalledQuantmanQpuBank,
  selectQuantmanQpuFixture,
} from "../../src/games/quantmanSynthetic";
import { selectStorySkiPixlPack } from "../../src/games/skipixl/SkiPixlCourseAdapter";
import type { SaveRepository } from "../../src/save/SaveRepository";
import { createDefaultSave } from "../../src/save/types";

describe("shipped SkiPixl Story result persistence", () => {
  it("passes the exact qualified Medium receipt to the save boundary", () => {
    const pack = selectStorySkiPixlPack(3, "P84");
    const context = skiContext("skipixl-medium", pack, 71);
    const save = createDefaultSave();
    const recordSkiPixlCutResult = vi.fn(() => save);
    const repository = {
      recordSkiPixlCutResult,
    } as unknown as SaveRepository;

    expect(
      persistSkiPixlStoryResult(repository, context, pack, {
        storyQualified: true,
        elapsedSeconds: 61.25,
        collisions: [{}, {}, {}] as never,
        gateResults: [{ passed: true }, { passed: false }] as never,
      }),
    ).toBe(save);
    expect(recordSkiPixlCutResult).toHaveBeenCalledWith(context, {
      qualified: true,
      pass: {
        cutId: "P84",
        tripletId: pack.payload.tripletId,
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        runId: context.runId,
        elapsedSeconds: 61.25,
        collisionCount: 3,
      },
      attempt: expectedSkiPixlAttempt(pack, context, {
        qualified: true,
        elapsedSeconds: 61.25,
        collisionCount: 3,
        passedGateCount: 1,
        missedGateCount: 1,
      }),
    });
  });

  it("persists a failed Hard attempt instead of queuing false progress", () => {
    const pack = selectStorySkiPixlPack(5, "P78");
    const context = skiContext("skipixl", pack, 73);
    const save = createDefaultSave();
    const recordSkiPixlCutResult = vi.fn(() => save);
    const repository = {
      recordSkiPixlCutResult,
    } as unknown as SaveRepository;

    expect(
      persistSkiPixlStoryResult(repository, context, pack, {
        storyQualified: false,
        elapsedSeconds: 75,
        collisions: [] as never,
        gateResults: [{ passed: false }] as never,
      }),
    ).toBe(save);
    expect(recordSkiPixlCutResult).toHaveBeenCalledWith(context, {
      qualified: false,
      attempt: expectedSkiPixlAttempt(pack, context, {
        qualified: false,
        elapsedSeconds: 75,
        collisionCount: 0,
        passedGateCount: 0,
        missedGateCount: 1,
      }),
    });
  });

  it("does not let an Arcade result cross the Story persistence boundary", () => {
    const pack = selectStorySkiPixlPack(7, "P84");
    const context = createRunContext({
      gameId: "skipixl",
      storyStage: null,
      playMode: "arcade",
      rulesVersion: pack.rulesVersion,
      runSeed: 79,
      pack: packIdentity(pack),
    });
    const repository = {
      recordSkiPixlCutResult: vi.fn(),
    } as unknown as SaveRepository;
    expect(() =>
      persistSkiPixlStoryResult(repository, context, pack, {
        storyQualified: true,
        elapsedSeconds: 50,
        collisions: [] as never,
        gateResults: [] as never,
      }),
    ).toThrow("Only a Story SkiPixl result");
  });

  it("accepts only the exact installed Fluxball run identity for Story replay", () => {
    const format = {
      competitorCount: 4,
      ruleMode: "individual",
      roundSeconds: 60,
      humanPlayerIds: ["A"],
    } as const;
    const pack = fluxballRulePackFor(4);
    const run = createRunContext({
      gameId: "fluxball",
      storyStage: "fluxball-four",
      playMode: "story",
      rulesVersion: pack.rulesVersion,
      runSeed: 83,
      pack: packIdentity(pack),
    });
    expect(isInstalledFluxballStoryRun(run, "fluxball-four", format)).toBe(
      true,
    );
    const wrongRun = createRunContext({
      gameId: "fluxball",
      storyStage: "fluxball-four",
      playMode: "story",
      rulesVersion: pack.rulesVersion,
      runSeed: 83,
      pack: { ...packIdentity(pack), contentSha256: "d".repeat(64) },
    });
    expect(isInstalledFluxballStoryRun(wrongRun, "fluxball-four", format)).toBe(
      false,
    );
    expect(isInstalledFluxballStoryRun(null, "fluxball-four", format)).toBe(
      false,
    );
  });

  it("reconstructs Qong replay from its exact qualified run rather than the mutable selector", async () => {
    const bank = await loadInstalledQongStoryBank();
    const selection = selectQongStoryPack(bank, { cursor: 0, cycle: 0 });
    const run = createRunContext({
      gameId: "qong",
      storyStage: "qong",
      playMode: "story",
      rulesVersion: selection.pack.rulesVersion,
      runSeed: 89,
      pack: packIdentity(selection.pack),
      packSelection: selection.receipt,
    });

    expect(resolveInstalledQongStoryRun(bank, run)).toEqual(selection);
    expect(
      resolveInstalledQongStoryRun(bank, {
        ...run,
        runId: "run-00000000",
      }),
    ).toBeNull();
    expect(resolveInstalledQongStoryRun(bank, null)).toBeNull();
  });

  it.each([
    ["skipixl-medium", "P84"],
    ["skipixl", "P78"],
  ] as const)(
    "resolves %s only from its exact installed QPixl cut",
    (stage, cutId) => {
      const pack = selectStorySkiPixlPack(2, cutId);
      const run = skiContext(stage, pack, 97);
      expect(resolveInstalledSkiPixlStoryRun(run, stage)).toEqual(pack);
      expect(
        resolveInstalledSkiPixlStoryRun(
          { ...run, runId: "run-00000000" },
          stage,
        ),
      ).toBeNull();
      expect(resolveInstalledSkiPixlStoryRun(null, stage)).toBeNull();
    },
  );

  it.each(["quantman-stabilize", "quantman"] as const)(
    "accepts the exact %s recorded-QPU qualified run",
    async (stage) => {
      const bank = await loadInstalledQuantmanQpuBank();
      const { fixture } = selectQuantmanQpuFixture(bank, 101);
      const run = createRunContext({
        gameId: "quantman",
        storyStage: stage,
        playMode: "story",
        rulesVersion: QUANTMAN_QPU_RULES_VERSION,
        runSeed: 101,
        pack: {
          packId: fixture.fixtureId,
          contentSha256: fixture.contentSha256,
          schemaVersion: fixture.schemaVersion,
          source: "moth-api-qpu",
        },
      });
      expect(isInstalledQuantmanStoryRun(run, stage, fixture)).toBe(true);
      expect(
        isInstalledQuantmanStoryRun(
          { ...run, runId: "run-00000000" },
          stage,
          fixture,
        ),
      ).toBe(false);
      expect(isInstalledQuantmanStoryRun(null, stage, fixture)).toBe(false);
    },
  );

  it("accepts only the exact installed Quarry QPU qualified run", async () => {
    const bank = await loadInstalledQuarryQpuBank();
    const selection = selectQuarryQpuPack(bank, 103);
    const pack = selection.pack;
    const run = createRunContext({
      gameId: "quarry",
      storyStage: "quarry",
      playMode: "story",
      rulesVersion: QUAG_RULES_VERSION,
      runSeed: 103,
      pack: {
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.sourceClassification,
      },
    });
    expect(isInstalledQuarryStoryRun(run, pack)).toBe(true);
    expect(
      isInstalledQuarryStoryRun({ ...run, runId: "run-00000000" }, pack),
    ).toBe(false);
    expect(isInstalledQuarryStoryRun(null, pack)).toBe(false);
  });

  it("keeps RETRY interactive while preserving completed-stage replay authority", () => {
    const pack = selectStorySkiPixlPack(1, "P84");
    const storyRun = skiContext("skipixl-medium", pack, 107);
    expect(resolveStoryRetryLaunch(storyRun, false)).toEqual({
      stage: "skipixl-medium",
      replay: false,
    });
    expect(resolveStoryRetryLaunch(storyRun, true)).toEqual({
      stage: "skipixl-medium",
      replay: true,
    });
    const arcadeRun = createRunContext({
      gameId: "skipixl",
      playMode: "arcade",
      rulesVersion: pack.rulesVersion,
      runSeed: 109,
      pack: packIdentity(pack),
    });
    expect(resolveStoryRetryLaunch(arcadeRun, true)).toBeNull();
  });
});

function skiContext(
  storyStage: "skipixl-medium" | "skipixl",
  pack: ReturnType<typeof selectStorySkiPixlPack>,
  runSeed: number,
) {
  return createRunContext({
    gameId: "skipixl",
    storyStage,
    playMode: "story",
    rulesVersion: pack.rulesVersion,
    runSeed,
    pack: packIdentity(pack),
  });
}

function packIdentity(pack: {
  readonly packId: string;
  readonly contentSha256: string;
  readonly schemaVersion: string;
  readonly source: string;
}) {
  return {
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    schemaVersion: pack.schemaVersion,
    source: pack.source,
  };
}

function expectedSkiPixlAttempt(
  pack: ReturnType<typeof selectStorySkiPixlPack>,
  context: ReturnType<typeof skiContext>,
  outcome: {
    readonly qualified: boolean;
    readonly elapsedSeconds: number;
    readonly collisionCount: number;
    readonly passedGateCount: number;
    readonly missedGateCount: number;
  },
) {
  const receipt = pack.payload.receipt;
  if (receipt.schemaVersion !== "skipixl-course-receipt-v7") {
    throw new Error("Expected a v7 SkiPixl course receipt.");
  }
  return {
    stageId: context.storyStage,
    cutId: receipt.cutId,
    tripletId: receipt.tripletId,
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    runId: context.runId,
    qualified: outcome.qualified,
    elapsedSeconds: outcome.elapsedSeconds,
    collisionCount: outcome.collisionCount,
    gateCount: outcome.passedGateCount + outcome.missedGateCount,
    passedGateCount: outcome.passedGateCount,
    missedGateCount: outcome.missedGateCount,
    courseReceiptSchemaVersion: receipt.schemaVersion,
    bankId: receipt.bankId,
    bankContentSha256: receipt.bankContentSha256,
    decoderVersion: receipt.decoderVersion,
    segments: receipt.segments.map((segment) => ({
      order: segment.order,
      segmentId: segment.segmentId,
      sourceSha256: segment.sourceSha256,
      returnedValuesSha256: segment.returnedValuesSha256,
      mothJobId: segment.mothJobId,
      ibmJobId: segment.ibmJobId,
    })),
  };
}
