import { describe, expect, it } from "vitest";

import { sha256CanonicalJson } from "../../src/core/canonicalJson";
import { createRunContext } from "../../src/core/run";
import { adaptFluxballClubhouseEvidence } from "../../src/tutorials/fluxballClubhouse";
import { adaptQongWorkshopEvidence } from "../../src/tutorials/qongWorkshop";
import {
  createTutorialRecoveryRecord,
  sha256CanonicalJsonSync,
  type TutorialRecoveryRecord,
  validateTutorialRecoveryRecord,
} from "../../src/tutorials/recovery";
import { adaptSkiPixlLodgeEvidence } from "../../src/tutorials/skiPixlLodge";
import { adaptQuantmanTopologyRoomEvidence } from "../../src/tutorials/quantmanTopologyRoom";
import {
  fluxballClubhouseFixtureInput,
  qongWorkshopRunInput,
  quantmanTopologyRoomFixtureInput,
  skiPixlLodgeRunInput,
} from "./tutorialWorldEvidenceFixtures";

describe("tutorial recovery records", () => {
  it("matches Web Crypto with its synchronous canonical SHA-256", async () => {
    const value = {
      unicode: "QPixl · IBM Fez",
      ordered: [0, 1, { z: false, a: true }],
    };
    expect(sha256CanonicalJsonSync(value)).toBe(
      await sha256CanonicalJson(value),
    );
    expect(sha256CanonicalJsonSync({})).toBe(
      "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a",
    );
  });

  it("creates normalized, run-bound records for all four Story tutorials", async () => {
    const qong = await qongWorkshopRunInput();
    const skipixl = skiPixlLodgeRunInput();
    const fluxballFixture = fluxballClubhouseFixtureInput();
    const fluxball = {
      ...fluxballFixture,
      origin: "completed-story-run" as const,
      snapshot: {
        ...fluxballFixture.snapshot,
        humanWon: true,
        winnerIds: ["A" as const],
      },
    };
    const quantman = {
      ...quantmanTopologyRoomFixtureInput(),
      origin: "completed-story-run" as const,
    };
    const records = [
      createTutorialRecoveryRecord(
        "qong",
        qong.context,
        adaptQongWorkshopEvidence(qong),
      ),
      createTutorialRecoveryRecord(
        "skipixl",
        skipixl.context,
        adaptSkiPixlLodgeEvidence(skipixl),
      ),
      createTutorialRecoveryRecord(
        "fluxball",
        fluxball.context,
        adaptFluxballClubhouseEvidence(fluxball),
      ),
      createTutorialRecoveryRecord(
        "quantman",
        quantman.context,
        adaptQuantmanTopologyRoomEvidence(quantman),
      ),
    ];

    expect(records.map((record) => record.gameId)).toEqual([
      "qong",
      "skipixl",
      "fluxball",
      "quantman",
    ]);
    for (const record of records) {
      expect(validateTutorialRecoveryRecord(record)).toEqual(record);
      expect(record.run.runId).toMatch(/^run-[0-9a-f]{8}$/);
      expect(record.evidenceOrigin).toBe("completed-story-run");
      expect(record.evidenceStatus).toBe("validated-run");
      expect(record.storyProgressEligible).toBe(true);
      expect(record.evidenceSha256).toMatch(/^[0-9a-f]{64}$/);
      expect(record.recoverySha256).toMatch(/^[0-9a-f]{64}$/);
      expect(Object.isFrozen(record)).toBe(true);
      expect(Object.isFrozen(record.evidence)).toBe(true);
    }
  });

  it("rejects development evidence and Arcade/replay authority", () => {
    const development = skiPixlLodgeRunInput("development-fixture");
    expect(() =>
      createTutorialRecoveryRecord(
        "skipixl",
        development.context,
        adaptSkiPixlLodgeEvidence(development),
      ),
    ).toThrow("validated completed-run evidence");

    const completed = skiPixlLodgeRunInput();
    const arcade = createRunContext({
      gameId: "skipixl",
      playMode: "arcade",
      rulesVersion: completed.context.rulesVersion,
      runSeed: 1,
      pack: completed.context.pack,
    });
    expect(() =>
      createTutorialRecoveryRecord(
        "skipixl",
        arcade,
        adaptSkiPixlLodgeEvidence(completed),
      ),
    ).toThrow("matching completed Story authority");
  });

  it("rejects evidence, run, source, and provenance tampering", () => {
    const input = skiPixlLodgeRunInput();
    const record = createTutorialRecoveryRecord(
      "skipixl",
      input.context,
      adaptSkiPixlLodgeEvidence(input),
    );
    const clone = JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
    const evidence = clone["evidence"] as {
      grids: Array<{ row: { returnedValue: number } }>;
    };
    evidence.grids[0]!.row.returnedValue += 0.01;
    expect(() => validateTutorialRecoveryRecord(clone)).toThrow();

    const changedRun = JSON.parse(JSON.stringify(record)) as {
      run: { runSeed: number };
    };
    changedRun.run.runSeed += 1;
    expect(() => validateTutorialRecoveryRecord(changedRun)).toThrow(
      "run identity changed",
    );

    const wrongSourceRun = createRunContext({
      gameId: "skipixl",
      storyStage: "skipixl",
      playMode: "story",
      rulesVersion: input.context.rulesVersion,
      runSeed: input.context.runSeed,
      pack: { ...input.context.pack, source: "synthetic-control" },
    });
    const { recoverySha256: _sourceHash, ...wrongSourceUnsigned } = {
      ...record,
      run: wrongSourceRun,
    };
    const wrongSource = {
      ...wrongSourceUnsigned,
      recoverySha256: sha256CanonicalJsonSync(wrongSourceUnsigned),
    };
    expect(() => validateTutorialRecoveryRecord(wrongSource)).toThrow(
      "matching completed Story authority",
    );

    const wrongStageRun = createRunContext({
      gameId: "skipixl",
      storyStage: "qong",
      playMode: "story",
      rulesVersion: input.context.rulesVersion,
      runSeed: input.context.runSeed,
      pack: input.context.pack,
    });
    const { recoverySha256: _stageHash, ...wrongStageUnsigned } = {
      ...record,
      run: wrongStageRun,
    };
    const wrongStage = {
      ...wrongStageUnsigned,
      recoverySha256: sha256CanonicalJsonSync(wrongStageUnsigned),
    };
    expect(() => validateTutorialRecoveryRecord(wrongStage)).toThrow(
      "matching completed Story authority",
    );

    const changedOrigin = {
      ...record,
      evidenceOrigin: "development-fixture",
    };
    expect(() => validateTutorialRecoveryRecord(changedOrigin)).toThrow(
      "provenance",
    );
  });

  it("rejects a self-consistent recovery rebuilt around an uninstalled pack", () => {
    const input = skiPixlLodgeRunInput();
    const record = createTutorialRecoveryRecord(
      "skipixl",
      input.context,
      adaptSkiPixlLodgeEvidence(input),
    );
    const run = createRunContext({
      gameId: "skipixl",
      storyStage: "skipixl",
      playMode: "story",
      rulesVersion: input.context.rulesVersion,
      runSeed: input.context.runSeed,
      pack: {
        ...input.context.pack,
        packId: "attacker-authored-qpixl-pack",
        contentSha256:
          "1111111111111111111111111111111111111111111111111111111111111111",
      },
    });
    const evidence = {
      ...JSON.parse(JSON.stringify(record.evidence)),
      packId: run.pack.packId,
    };
    const evidenceSha256 = sha256CanonicalJsonSync(evidence);
    const { recoverySha256: _oldRecovery, ...base } = record;
    const unsigned = { ...base, run, evidence, evidenceSha256 };
    const rebuilt = {
      ...unsigned,
      recoverySha256: sha256CanonicalJsonSync(unsigned),
    };

    expect(() => validateTutorialRecoveryRecord(rebuilt)).toThrow(
      "pack is not installed",
    );
  });

  it("rejects self-consistent evidence not derived from the installed pack", () => {
    const input = skiPixlLodgeRunInput();
    const record = createTutorialRecoveryRecord(
      "skipixl",
      input.context,
      adaptSkiPixlLodgeEvidence(input),
    );
    const evidence = JSON.parse(JSON.stringify(record.evidence)) as {
      grids: Array<{
        reading: {
          obstacleId: string;
          returnedValue: number;
          residual: number;
          absoluteResidual: number;
        };
        row: {
          selectedHazards: Array<{
            obstacleId: string;
            returnedValue: number;
            residual: number;
            absoluteResidual: number;
          }>;
        };
        obstacle: {
          residual: number;
          absoluteResidual: number;
        };
      }>;
    };
    const grid = evidence.grids[0]!;
    grid.reading.returnedValue += 0.01;
    grid.reading.residual += 0.01;
    grid.reading.absoluteResidual = Math.abs(grid.reading.residual);
    const selected = grid.row.selectedHazards.find(
      (hazard) => hazard.obstacleId === grid.reading.obstacleId,
    )!;
    selected.returnedValue = grid.reading.returnedValue;
    selected.residual = grid.reading.residual;
    selected.absoluteResidual = grid.reading.absoluteResidual;
    grid.obstacle.residual = grid.reading.residual;
    grid.obstacle.absoluteResidual = grid.reading.absoluteResidual;
    const evidenceSha256 = sha256CanonicalJsonSync(evidence);
    const { recoverySha256: _oldRecovery, ...base } = record;
    const unsigned = { ...base, evidence, evidenceSha256 };
    const rebuilt = {
      ...unsigned,
      recoverySha256: sha256CanonicalJsonSync(unsigned),
    };

    expect(() => validateTutorialRecoveryRecord(rebuilt)).toThrow(
      "not derived from its installed pack",
    );
  });

  it("rejects a self-consistent Quantman compatible-state count not derived from the installed ensemble", () => {
    const record = quantmanRecoveryRecord();
    const rebuilt = rebuildQuantmanRecovery(record, (evidence) => {
      evidence.doors[0]!.compatibleStateCount = 999_999;
    });

    expect(() => validateTutorialRecoveryRecord(rebuilt)).toThrow(
      "compatible-state count is not derived",
    );
  });

  it("rejects empty, incomplete, and self-consistently tampered Quantman pursuer responses", () => {
    const record = quantmanRecoveryRecord();
    const mutations: ReadonlyArray<
      readonly [string, (evidence: MutableQuantmanEvidence) => void]
    > = [
      [
        "pack identity",
        (evidence) => {
          evidence.packId = "attacker-authored-quantman-pack";
        },
      ],
      [
        "empty trace",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses = [];
        },
      ],
      [
        "missing installed pursuer",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses.pop();
        },
      ],
      [
        "missing response field",
        (evidence) => {
          delete evidence.doors[0]!.pursuerResponses[0]!.targetCell;
        },
      ],
      [
        "observation index",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses[0]!.observationIndex = 2;
        },
      ],
      [
        "response tick",
        (evidence) => {
          for (const response of evidence.doors[0]!.pursuerResponses) {
            response.tick = 99_999;
          }
        },
      ],
      [
        "topology state",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses[0]!.topologyStateId =
            evidence.doors[0]!.beforeStateId;
        },
      ],
      [
        "pursuer identity",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses[0]!.pursuerId = "INTRUDER";
        },
      ],
      [
        "own cell",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses[0]!.ownCell = {
            row: 0,
            col: 0,
          };
        },
      ],
      [
        "previous next cell",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses[0]!.previousNextCell = {
            row: 0,
            col: 0,
          };
        },
      ],
      [
        "next cell",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses[0]!.nextCell = {
            row: 0,
            col: 0,
          };
        },
      ],
      [
        "target cell",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses[0]!.targetCell = {
            row: 0,
            col: 0,
          };
        },
      ],
      [
        "mode",
        (evidence) => {
          evidence.doors[0]!.pursuerResponses[0]!.mode = "teleport";
        },
      ],
    ];

    for (const [label, mutate] of mutations) {
      const rebuilt = rebuildQuantmanRecovery(record, mutate);
      expect(() => validateTutorialRecoveryRecord(rebuilt), label).toThrow();
    }
  });
});

interface MutableQuantmanCell {
  row: number;
  col: number;
}

interface MutableQuantmanPursuerResponse {
  observationIndex: number;
  tick: number;
  topologyStateId: string;
  pursuerId: string;
  ownCell: MutableQuantmanCell;
  previousNextCell: MutableQuantmanCell;
  nextCell: MutableQuantmanCell;
  targetCell?: MutableQuantmanCell;
  mode: string;
}

interface MutableQuantmanEvidence {
  packId: string;
  doors: Array<{
    beforeStateId: string;
    compatibleStateCount: number;
    pursuerResponses: MutableQuantmanPursuerResponse[];
  }>;
}

function quantmanRecoveryRecord(): TutorialRecoveryRecord<"quantman"> {
  const input = {
    ...quantmanTopologyRoomFixtureInput(),
    origin: "completed-story-run" as const,
  };
  return createTutorialRecoveryRecord(
    "quantman",
    input.context,
    adaptQuantmanTopologyRoomEvidence(input),
  );
}

function rebuildQuantmanRecovery(
  record: TutorialRecoveryRecord<"quantman">,
  mutate: (evidence: MutableQuantmanEvidence) => void,
): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(record)) as Record<
    string,
    unknown
  > & {
    evidence: MutableQuantmanEvidence;
    evidenceSha256: string;
    recoverySha256: string;
  };
  mutate(clone.evidence);
  clone.evidenceSha256 = sha256CanonicalJsonSync(clone.evidence);
  const { recoverySha256: _oldRecovery, ...unsigned } = clone;
  return {
    ...unsigned,
    recoverySha256: sha256CanonicalJsonSync(unsigned),
  };
}
