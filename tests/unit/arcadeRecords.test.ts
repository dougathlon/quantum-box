import { describe, expect, test } from "vitest";
import {
  ARCADE_RECORDS_SCHEMA_VERSION,
  createEmptyArcadeRecords,
  normalizeInitials,
  quantmanArcadeBoard,
  quantmanArcadeOverallBoard,
  recordQuantmanArcadeResult,
  recordSkiPixlArcadeResult,
  updateArcadeRecordInitials,
  validateArcadeRecords,
  wouldPlaceQuantmanRecord,
  wouldPlaceSkiPixlRecord,
} from "../../src/save/ArcadeRecords";

const PACK = Object.freeze({
  packId: "fixture-v1",
  contentSha256: "a".repeat(64),
  schemaVersion: "fixture-schema-v1",
  source: "synthetic-control",
});

const TOPOLOGY = Object.freeze({
  topologyId: "quantman-maze-01-v1",
  topologyLabel: "MAP 01",
  authoredTopologySha256: "b".repeat(64),
});

describe("ArcadeRecords", () => {
  test("marks the persisted record cohort with an explicit schema", () => {
    const records = createEmptyArcadeRecords();
    expect(records.schemaVersion).toBe(ARCADE_RECORDS_SCHEMA_VERSION);

    const preMarkerV5 = structuredClone(records) as {
      schemaVersion?: string;
    };
    delete preMarkerV5.schemaVersion;
    expect(validateArcadeRecords(preMarkerV5).schemaVersion).toBe(
      ARCADE_RECORDS_SCHEMA_VERSION,
    );
    expect(() =>
      validateArcadeRecords({ ...records, schemaVersion: "future-v2" }),
    ).toThrow("Arcade records are invalid");
  });

  test("ranks and caps independent SkiPixl difficulty boards", () => {
    let records = createEmptyArcadeRecords();
    for (let index = 0; index < 7; index += 1) {
      records = recordSkiPixlArcadeResult(
        records,
        {
          kind: "skipixl",
          difficulty: "medium",
          runId: `ski-${index}`,
          rulesVersion: "ski-v1",
          pack: PACK,
          officialTimeMs: 70_000 - index * 1_000,
          missedGates: index % 2,
          collisions: index,
        },
        `A${index}-`,
      );
    }
    expect(records.skipixl.medium).toHaveLength(5);
    expect(records.skipixl.medium.map((entry) => entry.officialTimeMs)).toEqual(
      [64_000, 65_000, 66_000, 67_000, 68_000],
    );
    expect(records.skipixl.easy).toEqual([]);
    expect(records.nextSequence).toBe(8);
  });

  test("ranks Quantman by score, outcome, lives, and time", () => {
    let records = createEmptyArcadeRecords();
    const base = {
      kind: "quantman" as const,
      mechanic: "stabilize-gaze" as const,
      rulesVersion: "quantman-v1",
      pack: PACK,
      ...TOPOLOGY,
      score: 4_000,
    };
    records = recordQuantmanArcadeResult(
      records,
      {
        ...base,
        runId: "lost",
        outcome: "lost",
        remainingLives: 0,
        activeTicks: 100,
      },
      "LOS",
    );
    records = recordQuantmanArcadeResult(
      records,
      {
        ...base,
        runId: "slow",
        outcome: "won",
        remainingLives: 2,
        activeTicks: 200,
      },
      "SLW",
    );
    records = recordQuantmanArcadeResult(
      records,
      {
        ...base,
        runId: "fast",
        outcome: "won",
        remainingLives: 2,
        activeTicks: 150,
      },
      "FST",
    );
    expect(
      quantmanArcadeBoard(records, "stabilize-gaze", TOPOLOGY.topologyId).map(
        (entry) => entry.runId,
      ),
    ).toEqual(["fast", "slow", "lost"]);
    expect(
      quantmanArcadeBoard(records, "stabilize-gaze", "quantman-maze-02-v1"),
    ).toEqual([]);
    expect(
      quantmanArcadeOverallBoard(records, "stabilize-gaze").map(
        (entry) => entry.runId,
      ),
    ).toEqual(["fast", "slow", "lost"]);
  });

  test("reports qualification against the fifth place boundary", () => {
    let records = createEmptyArcadeRecords();
    for (let index = 0; index < 5; index += 1) {
      records = recordSkiPixlArcadeResult(
        records,
        {
          kind: "skipixl",
          difficulty: "hard",
          runId: `ski-${index}`,
          rulesVersion: "ski-v1",
          pack: PACK,
          officialTimeMs: 60_000 + index,
          missedGates: 0,
          collisions: 0,
        },
        "AAA",
      );
    }
    expect(
      wouldPlaceSkiPixlRecord(records, {
        kind: "skipixl",
        difficulty: "hard",
        runId: "better",
        rulesVersion: "ski-v1",
        pack: PACK,
        officialTimeMs: 59_999,
        missedGates: 0,
        collisions: 0,
      }),
    ).toBe(true);
    expect(
      wouldPlaceQuantmanRecord(records, {
        kind: "quantman",
        mechanic: "inverse-gaze",
        runId: "first",
        rulesVersion: "quantman-v1",
        pack: PACK,
        ...TOPOLOGY,
        score: 1,
        outcome: "lost",
        remainingLives: 0,
        activeTicks: 1,
      }),
    ).toBe(true);
  });

  test("validates persistence and rejects malformed initials or ordering", () => {
    const records = recordSkiPixlArcadeResult(
      createEmptyArcadeRecords(),
      {
        kind: "skipixl",
        difficulty: "easy",
        runId: "ski",
        rulesVersion: "ski-v1",
        pack: PACK,
        officialTimeMs: 42_000,
        missedGates: 1,
        collisions: 2,
      },
      "qbx",
    );
    expect(validateArcadeRecords(JSON.parse(JSON.stringify(records)))).toEqual(
      records,
    );
    expect(normalizeInitials(" qbx ")).toBe("QBX");
    expect(() => normalizeInitials("TOO-LONG")).toThrow(/exactly three/);
  });

  test("updates one retained run's initials without changing its result or provenance", () => {
    let recorded = recordSkiPixlArcadeResult(
      createEmptyArcadeRecords(),
      {
        kind: "skipixl",
        difficulty: "easy",
        runId: "ski-initials",
        rulesVersion: "ski-v1",
        pack: PACK,
        officialTimeMs: 42_000,
        missedGates: 1,
        collisions: 2,
      },
      "YOU",
    );
    recorded = recordSkiPixlArcadeResult(
      recorded,
      {
        kind: "skipixl",
        difficulty: "easy",
        runId: "ski-initials",
        rulesVersion: "ski-v1",
        pack: PACK,
        officialTimeMs: 41_000,
        missedGates: 0,
        collisions: 1,
      },
      "YOU",
    );
    const newestSequence = recorded.nextSequence - 1;
    const updated = updateArcadeRecordInitials(recorded, newestSequence, "qbx");

    expect(
      updated.skipixl.easy.find(
        (entry) => entry.recordedSequence === newestSequence,
      ),
    ).toEqual({
      ...recorded.skipixl.easy.find(
        (entry) => entry.recordedSequence === newestSequence,
      ),
      initials: "QBX",
    });
    expect(
      updated.skipixl.easy.find(
        (entry) => entry.recordedSequence !== newestSequence,
      )?.initials,
    ).toBe("YOU");
    expect(updated.nextSequence).toBe(recorded.nextSequence);
    expect(() => updateArcadeRecordInitials(recorded, 999, "QBX")).toThrow(
      /no longer in the top five/,
    );
  });

  test("migrates legacy Quantman boards under the original topology", () => {
    const legacy = {
      ...createEmptyArcadeRecords(),
      schemaVersion: "quantum-box-arcade-records-v1",
      nextSequence: 2,
      quantman: {
        "stabilize-gaze": [
          {
            kind: "quantman",
            mechanic: "stabilize-gaze",
            runId: "legacy-quantman",
            initials: "OLD",
            rulesVersion: "quantman-v1",
            pack: PACK,
            recordedSequence: 1,
            score: 100,
            outcome: "lost",
            remainingLives: 0,
            activeTicks: 12,
          },
        ],
        "inverse-gaze": [],
      },
    };
    const migrated = validateArcadeRecords(legacy);
    expect(
      quantmanArcadeBoard(
        migrated,
        "stabilize-gaze",
        "quantman-maze-original-v1",
      )[0],
    ).toMatchObject({
      runId: "legacy-quantman",
      topologyLabel: "ORIGINAL",
    });
  });
});
