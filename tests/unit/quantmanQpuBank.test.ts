import { describe, expect, it } from "vitest";

import { sha256CanonicalJson } from "../../src/core/canonicalJson";
import originalBankJson from "../../src/games/quantmanSynthetic/data/quantman-labyrinth-ibm-fez-bank-v1.json";
import {
  QUANTMAN_ADMISSIBILITY_FILTER_ID,
  QUANTMAN_QPU_AUTHORITY_SCHEMA,
  QUANTMAN_QPU_BANK_SCHEMA,
  QUANTMAN_QPU_RULES_VERSION,
  QUANTMAN_QPU_SELECTION_METHOD,
  QuantmanQpuBankUnavailableError,
  QuantmanSyntheticRuntime,
  deriveQuantmanAdmissibilityIndex,
  loadInstalledQuantmanQpuBank,
  playableQuantmanTopologies,
  resolveQuantmanQpuFixtureForRun,
  runQuantmanSyntheticReplay,
  selectQuantmanArcadeQpuFixture,
  selectQuantmanQpuFixtureForTopology,
  selectQuantmanQpuFixture,
  selectQuantmanStoryQpuFixture,
  validateQuantmanQpuBank,
  type QuantmanMazeTopology,
  type QuantmanQpuFixtureAuthority,
  type QuantmanSyntheticFixture,
} from "../../src/games/quantmanSynthetic";

describe("Quantman QPU bank adapter", () => {
  it("groups eight hardware captures into seven distinct maze courses", async () => {
    const bank = await loadInstalledQuantmanQpuBank();
    expect(bank.fixtures).toHaveLength(8);
    expect(bank.fixtureAuthorities).toHaveLength(8);
    expect(bank.topologies).toHaveLength(7);
    expect(bank.fixtures[0]).toEqual(originalBankJson.fixtures[0]);
    expect(bank.fixtures[0]?.fixtureId).toBe(
      "quantman-quantman-10x10-r1-qpu-v1",
    );
    expect(bank.fixtures[0]?.contentSha256).toBe(
      "ec1005464d189ab4775950c4a19506514d5b764aad3f6f4ff82b2da4da95b389",
    );
    expect(
      bank.topologies.map((topology) => ({
        id: topology.topologyId,
        label: topology.label,
        captures: topology.captureFixtureIds.length,
      })),
    ).toEqual([
      { id: "quantman-maze-original-v1", label: "ORIGINAL", captures: 2 },
      { id: "quantman-maze-01-v1", label: "MAP 01", captures: 1 },
      { id: "quantman-maze-02-v1", label: "MAP 02", captures: 1 },
      { id: "quantman-maze-03-v1", label: "MAP 03", captures: 1 },
      { id: "quantman-maze-04-v1", label: "MAP 04", captures: 1 },
      { id: "quantman-maze-05-v1", label: "MAP 05", captures: 1 },
      { id: "quantman-maze-06-v1", label: "MAP 06", captures: 1 },
    ]);
    expect(
      bank.fixtureAuthorities.map((authority) => authority.targetId),
    ).toEqual([
      "quantman-10x10-r1",
      "quantman-known-good-serial-r1",
      "quantman-map-01-serial-r1",
      "quantman-map-02-serial-r1",
      "quantman-map-03-serial-r1",
      "quantman-map-04-serial-r1",
      "quantman-map-05-serial-r1",
      "quantman-map-06-serial-r1",
    ]);
    expect(
      bank.fixtureAuthorities.some((authority) =>
        authority.campaignId.includes("qpu-bank-v2"),
      ),
    ).toBe(false);
    expect(
      bank.fixtures.every((fixture) => fixture.records.length === 4096),
    ).toBe(true);
    expect(
      bank.fixtureAuthorities.every(
        (authority) =>
          authority.admissibility.runtimeEligible &&
          authority.admissibility.filterId === QUANTMAN_ADMISSIBILITY_FILTER_ID,
      ),
    ).toBe(true);

    const reachedTopologies = new Set(
      Array.from(
        { length: 512 },
        (_, seed) => selectQuantmanQpuFixture(bank, seed).topology.topologyId,
      ),
    );
    expect(reachedTopologies).toEqual(
      new Set(bank.topologies.map((topology) => topology.topologyId)),
    );
    const originalCaptures = new Set(
      Array.from(
        { length: 512 },
        (_, seed) =>
          selectQuantmanQpuFixtureForTopology(
            bank,
            "quantman-maze-original-v1",
            seed,
          ).fixture.fixtureId,
      ),
    );
    expect(originalCaptures).toEqual(
      new Set(bank.topologies[0]?.captureFixtureIds),
    );
  });

  it("rotates Arcade runs through each distinct topology without exposing captures as levels", async () => {
    const bank = await loadInstalledQuantmanQpuBank();
    const sequence = Array.from({ length: 9 }, (_, courseIndex) =>
      selectQuantmanArcadeQpuFixture(bank, courseIndex, 260_823),
    );

    expect(
      sequence.slice(0, 7).map(({ topology }) => topology.topologyId),
    ).toEqual(bank.topologies.map(({ topologyId }) => topologyId));
    expect(sequence[7]?.topology.topologyId).toBe(
      bank.topologies[0]?.topologyId,
    );
    expect(
      selectQuantmanArcadeQpuFixture(bank, 0, 260_823).fixture.fixtureId,
    ).toBe(sequence[0]?.fixture.fixtureId);
  });

  it("drives deterministic offline play from admitted intact records and replays exactly", async () => {
    const bank = await loadInstalledQuantmanQpuBank();
    const selection = selectQuantmanQpuFixture(bank, 0x1234_5678);
    const { fixture, authority } = selection;
    const runtime = new QuantmanSyntheticRuntime({
      playMode: "arcade",
      runSeed: 0x1234_5678,
      mechanic: "stabilize-gaze",
      fixture,
      qpuAuthority: authority,
      rulesVersion: QUANTMAN_QPU_RULES_VERSION,
    });
    runtime.step({ direction: null, start: true });
    for (let tick = 0; tick < 60; tick += 1) {
      runtime.step({ direction: tick < 30 ? "right" : "down", start: false });
    }
    const snapshot = runtime.snapshot();
    expect(snapshot.fixture).toMatchObject({
      classification: "recorded-moth-qpu",
      qpu: true,
      backend: "ibm_fez",
      recordCount: 4096,
      admissibilityFilterId: QUANTMAN_ADMISSIBILITY_FILTER_ID,
      admittedRecordCount: authority.admissibility.summary.admittedRecordCount,
      admittedWeight: authority.admissibility.summary.admittedWeight,
      excludedRecordCount: authority.admissibility.summary.excludedRecordCount,
      excludedWeight: authority.admissibility.summary.excludedWeight,
      effectiveWeight: authority.admissibility.summary.admittedWeight,
    });
    const admitted = new Set(authority.admissibility.admittedRecordIndices);
    for (const topology of runtime.session.bank.topologies) {
      expect(
        topology.rawRecordIndices.every((index) => admitted.has(index)),
      ).toBe(true);
      const representativeIndex = topology.rawRecordIndices[0];
      expect(topology.representativeBitstring).toBe(
        fixture.records[representativeIndex!]?.bitstring,
      );
    }
    expect(snapshot.run.rulesVersion).toBe(QUANTMAN_QPU_RULES_VERSION);
    expect(
      runQuantmanSyntheticReplay(runtime.replayTape(), fixture, authority),
    ).toEqual(snapshot);
  });

  it("advances Story through distinct courses and resolves frozen evidence exactly", async () => {
    const bank = await loadInstalledQuantmanQpuBank();
    const sequence = Array.from({ length: 8 }, (_, levelIndex) =>
      selectQuantmanStoryQpuFixture(bank, levelIndex, 11),
    );
    expect(
      sequence.slice(0, 7).map(({ topology }) => topology.topologyId),
    ).toEqual(
      playableQuantmanTopologies(bank).map(({ topologyId }) => topologyId),
    );
    expect(sequence[7]?.topology.topologyId).toBe(
      sequence[0]?.topology.topologyId,
    );
    const stabilize = sequence[0]!;
    const frozen = resolveQuantmanQpuFixtureForRun(bank, 0xffff_ffff, {
      fixtureId: stabilize.fixture.fixtureId,
      contentSha256: stabilize.fixture.contentSha256,
    });
    expect(frozen).toStrictEqual(stabilize);
  });

  it("accepts a complete, independently derived admissibility index", async () => {
    const fixture = await makeFixture(
      admissibleRecords(),
      "quantman-test-qpu-v2",
    );
    const bank = await validatedBank([fixture]);
    expect(selectQuantmanQpuFixture(bank, 1).fixture).toBe(bank.fixtures[0]);
    expect(selectQuantmanQpuFixture(bank, 0xffff_ffff).fixture).toBe(
      bank.fixtures[0],
    );
  });

  it("rejects an admission index changed after compilation even with fresh hashes", async () => {
    const fixture = await makeFixture(
      admissibleRecords(),
      "quantman-tampered-qpu-v2",
    );
    const authority = await makeAuthority(fixture);
    const tamperedAuthorityMaterial = {
      ...withoutAuthorityContentHash(authority),
      admissibility: {
        ...authority.admissibility,
        admittedRecordIndices:
          authority.admissibility.admittedRecordIndices.slice(1),
      },
    };
    const tamperedAuthority = {
      ...tamperedAuthorityMaterial,
      contentSha256: await sha256CanonicalJson(tamperedAuthorityMaterial),
    } as QuantmanQpuFixtureAuthority;
    await expect(validatedBank([fixture], [tamperedAuthority])).rejects.toThrow(
      /admissibility index does not match/i,
    );
  });

  it("retains an inadmissible capture as evidence but never selects it for play", async () => {
    const fixture = await makeFixture(
      [{ bitstring: "0".repeat(100), weight: 1 }],
      "quantman-evidence-only-qpu-v2",
    );
    const authority = await makeAuthority(fixture);
    expect(authority.admissibility.runtimeEligible).toBe(false);
    const bank = await validatedBank([fixture], [authority]);
    expect(() => selectQuantmanQpuFixture(bank, 1)).toThrow(
      QuantmanQpuBankUnavailableError,
    );
  });

  it("rejects incomplete returned-shot preservation", async () => {
    const fixture = await makeFixture(
      admissibleRecords(),
      "quantman-short-qpu-v2",
    );
    const material = {
      ...withoutFixtureContentHash(fixture),
      provenance: { ...fixture.provenance, shots: fixture.records.length + 1 },
    };
    const altered = {
      ...material,
      contentSha256: await sha256CanonicalJson(material),
    } as QuantmanSyntheticFixture;
    await expect(validatedBank([altered])).rejects.toThrow(
      /not a complete 100-bit IBM Fez record/i,
    );
  });
});

const TEST_COUPLING_MAP = Object.freeze(
  Array.from({ length: 10 }, (_, row) => {
    const columns = Array.from({ length: 10 }, (_, index) =>
      row % 2 === 0 ? index : 9 - index,
    );
    const horizontal = columns
      .slice(0, -1)
      .map((column, index) =>
        Object.freeze([
          row * 10 + column,
          row * 10 + columns[index + 1]!,
        ] as const),
      );
    const vertical =
      row < 9
        ? [
            Object.freeze([
              row * 10 + columns[9]!,
              (row + 1) * 10 + columns[9]!,
            ] as const),
          ]
        : [];
    return [...horizontal, ...vertical];
  }).flat(),
);

function admissibleRecords() {
  const excluded = new Set([35, 44, 45, 54, 55, 95]);
  return Array.from({ length: 100 }, (_, room) => room)
    .filter((room) => !excluded.has(room))
    .map((room) => ({
      bitstring: Array.from({ length: 100 }, (_, index) =>
        index === room ? "1" : "0",
      ).join(""),
      weight: 1,
    }));
}

async function makeFixture(
  records: readonly Readonly<{ bitstring: string; weight: number }>[],
  fixtureId: string,
): Promise<QuantmanSyntheticFixture> {
  const shots = records.reduce((sum, record) => sum + record.weight, 0);
  const material = {
    schemaVersion: "labyrinth-measurement-bank-v1" as const,
    fixtureId,
    width: 10,
    height: 10,
    bitOrder: "row-major-room-index" as const,
    parityRule: "equal-open-unequal-wall" as const,
    provenance: {
      sourceType: "qpu" as const,
      label: "RECORDED TEST RETURN",
      generatorOrProvider: "Moth labyrinth-v1 / IBM Quantum",
      acquisitionOrGenerationDate: "2026-09-06T00:00:00Z",
      engineId: "labyrinth-v1" as const,
      backend: "ibm_fez",
      jobId: `ibm-${fixtureId}`,
      mothJobId: `moth-${fixtureId}`,
      hardwareJobId: `ibm-${fixtureId}`,
      rawResultSha256: "b".repeat(64),
      shots,
      limits: ["Test fixture."],
    },
    records,
  };
  return {
    ...material,
    contentSha256: await sha256CanonicalJson(material),
  };
}

async function makeAuthority(
  fixture: QuantmanSyntheticFixture,
): Promise<QuantmanQpuFixtureAuthority> {
  const shots = fixture.records.reduce((sum, record) => sum + record.weight, 0);
  const redactedRequest = {
    params: {
      mode: "qpu",
      backend_name: "ibm_fez",
      num_qubits: 100,
      grid_size: { rows: 10, cols: 10 },
      level_data: { coupling_map: TEST_COUPLING_MAP },
      shots,
    },
  };
  const material = {
    schemaVersion: QUANTMAN_QPU_AUTHORITY_SCHEMA,
    fixtureId: fixture.fixtureId,
    fixtureContentSha256: fixture.contentSha256,
    campaignId: "quantman-test-campaign-v1",
    targetId: fixture.fixtureId,
    engineId: "labyrinth-v1" as const,
    engineCanonicalSha256: "1".repeat(64),
    engineUpdatedAt: "2026-09-06T00:00:00Z",
    apiSpecification: {
      version: "1.0.0",
      canonicalSha256: "2".repeat(64),
    },
    mode: "qpu" as const,
    numQubits: 100 as const,
    gridSize: { rows: 10 as const, cols: 10 as const },
    bitOrder: "row-major-room-index" as const,
    backend: "ibm_fez" as const,
    mothJobId: fixture.provenance.mothJobId!,
    hardwareJobId: fixture.provenance.hardwareJobId!,
    submittedAt: "2026-09-06T00:00:00Z",
    retrievedAtUtc: "2026-09-06T00:01:00Z",
    providerUpdatedAt: "2026-09-06T00:01:00Z",
    requestedShots: shots,
    returnedShots: shots,
    redactedRequest,
    redactedRequestSha256: await sha256CanonicalJson(redactedRequest),
    rawResultSha256: fixture.provenance.rawResultSha256!,
    captureContentSha256: "3".repeat(64),
    terminalObservedAtUtc: "2026-09-06T00:01:00Z",
    terminalStatusSha256: "4".repeat(64),
    claimBoundary: "Test-only complete provider return.",
    admissibility: deriveQuantmanAdmissibilityIndex(
      fixture.records,
      fixture.width,
      fixture.height,
    ),
  };
  return {
    ...material,
    contentSha256: await sha256CanonicalJson(material),
  };
}

async function validatedBank(
  fixtures: readonly QuantmanSyntheticFixture[],
  suppliedAuthorities?: readonly QuantmanQpuFixtureAuthority[],
) {
  const fixtureAuthorities = suppliedAuthorities
    ? [...suppliedAuthorities]
    : await Promise.all(fixtures.map(makeAuthority));
  const topologies = [await makeTopology(fixtures)];
  const material = {
    schemaVersion: QUANTMAN_QPU_BANK_SCHEMA,
    bankId: "quantman-test-bank-v3",
    selectionMethod: QUANTMAN_QPU_SELECTION_METHOD,
    topologies,
    fixtures,
    fixtureAuthorities,
  } as const;
  return validateQuantmanQpuBank({
    ...material,
    contentSha256: await sha256CanonicalJson(material),
  });
}

async function makeTopology(
  fixtures: readonly QuantmanSyntheticFixture[],
): Promise<QuantmanMazeTopology> {
  const couplingMap = [...TEST_COUPLING_MAP]
    .map(
      ([left, right]) =>
        [Math.min(left, right), Math.max(left, right)] as const,
    )
    .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  const authoredTopologySha256 = await sha256CanonicalJson(couplingMap);
  const material = {
    schemaVersion: "quantman-authored-maze-topology-v1" as const,
    topologyId: "quantman-test-maze-v1",
    label: "TEST MAZE",
    courseOrder: 0,
    gridSize: { rows: 10 as const, cols: 10 as const },
    numQubits: 100 as const,
    corridorCount: 99 as const,
    couplingMap,
    authoredTopologySha256,
    captureFixtureIds: fixtures.map(({ fixtureId }) => fixtureId),
  };
  return {
    ...material,
    contentSha256: await sha256CanonicalJson(material),
  };
}

function withoutFixtureContentHash(fixture: QuantmanSyntheticFixture) {
  const { contentSha256: _contentSha256, ...material } = fixture;
  return material;
}

function withoutAuthorityContentHash(authority: QuantmanQpuFixtureAuthority) {
  const { contentSha256: _contentSha256, ...material } = authority;
  return material;
}
