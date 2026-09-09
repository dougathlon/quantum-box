import { describe, expect, it, vi } from "vitest";

import {
  isInstalledFluxballStoryRun,
  isInstalledQuantmanStoryRun,
  isInstalledQuarryStoryRun,
  persistSkiPixlStoryResult,
  resolveInstalledSkiPixlStoryRun,
  resolveStoryRetryLaunch,
} from "../../src/app/StoryResultPersistence";
import { createRunContext } from "../../src/core/run";
import { fluxballRulePackFor } from "../../src/games/fluxball/fluxballControlPacks";
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

describe("Story result identity boundaries", () => {
  it.each([
    ["skipixl-feasible", "P84"],
    ["skipixl-overloaded", "P78"],
  ] as const)(
    "persists and resolves %s from its exact QPixl receipt",
    (stage, cut) => {
      const pack = selectStorySkiPixlPack(3, cut);
      const context = storyRun("skipixl", stage, pack, 71);
      const save = createDefaultSave();
      const recordSkiPixlCutResult = vi.fn(() => save);
      const repository = {
        recordSkiPixlCutResult,
      } as unknown as SaveRepository;
      expect(
        persistSkiPixlStoryResult(repository, context, pack, {
          storyQualified: true,
          elapsedSeconds: 58.25,
          collisions: [{}, {}] as never,
          gateResults: [{ passed: true }, { passed: false }] as never,
        }),
      ).toBe(save);
      expect(recordSkiPixlCutResult).toHaveBeenCalledOnce();
      expect(resolveInstalledSkiPixlStoryRun(context, stage)).toEqual(pack);
      expect(
        resolveInstalledSkiPixlStoryRun(
          { ...context, runId: "run-00000000" },
          stage,
        ),
      ).toBeNull();
    },
  );

  it("rejects Arcade SkiPixl at the Story persistence boundary", () => {
    const pack = selectStorySkiPixlPack(7, "P84");
    const context = createRunContext({
      gameId: "skipixl",
      playMode: "arcade",
      rulesVersion: pack.rulesVersion,
      runSeed: 79,
      pack: packIdentity(pack),
    });
    expect(() =>
      persistSkiPixlStoryResult({} as SaveRepository, context, pack, {
        storyQualified: true,
        elapsedSeconds: 50,
        collisions: [] as never,
        gateResults: [] as never,
      }),
    ).toThrow("Only a Story SkiPixl result");
  });

  it("binds 2P Fluxball Story runs to their exact format and pack", () => {
    const format = {
      competitorCount: 2,
      ruleMode: "individual",
      roundSeconds: 40,
      humanPlayerIds: ["A"],
    } as const;
    const pack = fluxballRulePackFor(2);
    const run = storyRun("fluxball", "fluxball-individual", pack, 83);
    expect(
      isInstalledFluxballStoryRun(run, "fluxball-individual", format),
    ).toBe(true);
    expect(
      isInstalledFluxballStoryRun(
        { ...run, runId: "run-00000000" },
        "fluxball-individual",
        format,
      ),
    ).toBe(false);
  });

  it("binds Quantman Hold to the selected installed hardware capture", async () => {
    const bank = await loadInstalledQuantmanQpuBank();
    const { fixture } = selectQuantmanQpuFixture(bank, 101);
    const run = createRunContext({
      gameId: "quantman",
      storyStage: "quantman-hold",
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
    expect(isInstalledQuantmanStoryRun(run, "quantman-hold", fixture)).toBe(
      true,
    );
    expect(
      isInstalledQuantmanStoryRun(
        { ...run, runId: "run-00000000" },
        "quantman-hold",
        fixture,
      ),
    ).toBe(false);
  });

  it("binds Quarry to its exact installed 24-job pack selection", async () => {
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
  });

  it("keeps RETRY interactive and rejects Arcade contexts", () => {
    const pack = selectStorySkiPixlPack(1, "P84");
    const story = storyRun("skipixl", "skipixl-feasible", pack, 107);
    expect(resolveStoryRetryLaunch(story, false)).toEqual({
      stage: "skipixl-feasible",
      replay: false,
    });
    const arcade = createRunContext({
      gameId: "skipixl",
      playMode: "arcade",
      rulesVersion: pack.rulesVersion,
      runSeed: 109,
      pack: packIdentity(pack),
    });
    expect(resolveStoryRetryLaunch(arcade, true)).toBeNull();
  });
});

function storyRun(
  gameId: "skipixl" | "fluxball",
  stage: "skipixl-feasible" | "skipixl-overloaded" | "fluxball-individual",
  pack: {
    readonly packId: string;
    readonly contentSha256: string;
    readonly schemaVersion: string;
    readonly source: string;
    readonly rulesVersion: string;
  },
  runSeed: number,
) {
  return createRunContext({
    gameId,
    storyStage: stage,
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
