import installedBankArtifact from "../data/quantman-labyrinth-ibm-fez-bank-v3.json" with { type: "json" };

import { sha256CanonicalJson } from "../../../core/canonicalJson";
import { asUint32Seed, deriveSeed } from "../../../core/determinism";
import { validateLabyrinthFixture } from "./LabyrinthFixture";
import { validateQuantmanAdmissibilityIndex } from "./QuantmanAdmissibility";
import type {
  LabyrinthFixture,
  QuantmanMazeTopology,
  QuantmanQpuFixtureAuthority,
  QuantmanQpuFixtureSelection,
} from "./types";

export const QUANTMAN_QPU_BANK_SCHEMA =
  "quantum-box-quantman-qpu-bank-v3" as const;
export const QUANTMAN_QPU_TOPOLOGY_SCHEMA =
  "quantman-authored-maze-topology-v1" as const;
export const QUANTMAN_QPU_AUTHORITY_SCHEMA =
  "quantman-qpu-fixture-authority-v1" as const;
export const QUANTMAN_QPU_SELECTION_METHOD =
  "topology-sequence-and-seeded-capture-v3" as const;

export interface QuantmanQpuBank {
  readonly schemaVersion: typeof QUANTMAN_QPU_BANK_SCHEMA;
  readonly bankId: string;
  readonly selectionMethod: typeof QUANTMAN_QPU_SELECTION_METHOD;
  readonly topologies: readonly QuantmanMazeTopology[];
  readonly fixtures: readonly LabyrinthFixture[];
  readonly fixtureAuthorities: readonly QuantmanQpuFixtureAuthority[];
  readonly contentSha256: string;
}

export class QuantmanQpuBankUnavailableError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "QuantmanQpuBankUnavailableError";
  }
}

export async function loadInstalledQuantmanQpuBank(): Promise<QuantmanQpuBank> {
  return validateQuantmanQpuBank(installedBankArtifact);
}

/**
 * Credential-free promotion boundary for completed Labyrinth captures.
 * The caller supplies parsed JSON only after the acquisition compiler has
 * written an immutable bank; this function never performs provider traffic.
 */
export async function validateQuantmanQpuBank(
  input: unknown,
): Promise<QuantmanQpuBank> {
  if (!isRecord(input)) {
    throw unavailable("The Quantman QPU bank is not an object.");
  }
  if (
    input["schemaVersion"] !== QUANTMAN_QPU_BANK_SCHEMA ||
    input["selectionMethod"] !== QUANTMAN_QPU_SELECTION_METHOD
  ) {
    throw unavailable("The Quantman QPU bank contract is unsupported.");
  }
  const bankId = requiredString(input["bankId"], "bankId");
  const contentSha256 = requiredHash(input["contentSha256"], "contentSha256");
  const rawFixtures = input["fixtures"];
  const rawAuthorities = input["fixtureAuthorities"];
  const rawTopologies = input["topologies"];
  if (!Array.isArray(rawFixtures) || rawFixtures.length === 0) {
    throw unavailable("The Quantman QPU bank contains no fixtures.");
  }
  if (
    !Array.isArray(rawAuthorities) ||
    rawAuthorities.length !== rawFixtures.length
  ) {
    throw unavailable(
      "The Quantman QPU bank must bind one authority record to every fixture.",
    );
  }
  if (!Array.isArray(rawTopologies) || rawTopologies.length === 0) {
    throw unavailable("The Quantman QPU bank contains no maze topologies.");
  }

  const fixtures: LabyrinthFixture[] = [];
  const fixtureAuthorities: QuantmanQpuFixtureAuthority[] = [];
  for (let index = 0; index < rawFixtures.length; index += 1) {
    const fixture = validateLabyrinthFixture(rawFixtures[index]);
    if (
      fixture.width !== 10 ||
      fixture.height !== 10 ||
      fixture.provenance.sourceType !== "qpu" ||
      fixture.provenance.backend !== "ibm_fez" ||
      !fixture.provenance.jobId ||
      !fixture.provenance.shots
    ) {
      throw unavailable(
        `Quantman fixture ${fixture.fixtureId} is not an IBM Fez hardware record.`,
      );
    }
    const fixtureMaterial = { ...fixture } as Record<string, unknown>;
    delete fixtureMaterial["contentSha256"];
    if (
      (await sha256CanonicalJson(fixtureMaterial)) !== fixture.contentSha256
    ) {
      throw unavailable(
        `Quantman fixture ${fixture.fixtureId} content hash does not match.`,
      );
    }
    const authority = await validateAuthority(rawAuthorities[index], fixture);
    fixtures.push(fixture);
    fixtureAuthorities.push(authority);
  }

  requireUnique(
    fixtures.map((fixture) => fixture.fixtureId),
    "fixture ID",
  );
  requireUnique(
    fixtureAuthorities.map((authority) => authority.mothJobId),
    "Moth job ID",
  );
  requireUnique(
    fixtureAuthorities.map((authority) => authority.hardwareJobId),
    "hardware job ID",
  );

  const topologies = await Promise.all(
    rawTopologies.map((value, index) => validateTopology(value, index)),
  );
  requireUnique(
    topologies.map((topology) => topology.topologyId),
    "topology ID",
  );
  requireUnique(
    topologies.map((topology) => topology.authoredTopologySha256),
    "authored topology hash",
  );
  for (let index = 1; index < topologies.length; index += 1) {
    const previous = topologies[index - 1]!;
    const current = topologies[index]!;
    if (
      previous.courseOrder > current.courseOrder ||
      (previous.courseOrder === current.courseOrder &&
        previous.topologyId.localeCompare(current.topologyId) >= 0)
    ) {
      throw unavailable(
        "The Quantman maze topologies are not in deterministic course order.",
      );
    }
  }
  const assignedFixtureIds = topologies.flatMap(
    (topology) => topology.captureFixtureIds,
  );
  requireUnique(assignedFixtureIds, "topology capture fixture ID");
  if (
    assignedFixtureIds.length !== fixtures.length ||
    fixtures.some((fixture) => !assignedFixtureIds.includes(fixture.fixtureId))
  ) {
    throw unavailable(
      "Every Quantman hardware fixture must belong to exactly one authored topology.",
    );
  }
  for (const topology of topologies) {
    for (const fixtureId of topology.captureFixtureIds) {
      const fixtureIndex = fixtures.findIndex(
        (fixture) => fixture.fixtureId === fixtureId,
      );
      const authority = fixtureAuthorities[fixtureIndex];
      if (
        fixtureIndex < 0 ||
        !authority ||
        (await authoredTopologyHashFromAuthority(authority)) !==
          topology.authoredTopologySha256
      ) {
        throw unavailable(
          `Quantman fixture ${fixtureId} does not match topology ${topology.topologyId}.`,
        );
      }
    }
  }

  const bank = {
    schemaVersion: QUANTMAN_QPU_BANK_SCHEMA,
    bankId,
    selectionMethod: QUANTMAN_QPU_SELECTION_METHOD,
    topologies,
    fixtures,
    fixtureAuthorities,
    contentSha256,
  } as const;
  const material = {
    schemaVersion: bank.schemaVersion,
    bankId: bank.bankId,
    selectionMethod: bank.selectionMethod,
    topologies: bank.topologies,
    fixtures: bank.fixtures,
    fixtureAuthorities: bank.fixtureAuthorities,
  };
  if ((await sha256CanonicalJson(material)) !== contentSha256) {
    throw unavailable("The Quantman QPU bank content hash does not match.");
  }
  return deepFreeze(bank);
}

export function selectQuantmanQpuFixture(
  bank: QuantmanQpuBank,
  runSeed: number,
): QuantmanQpuFixtureSelection {
  const topologies = playableQuantmanTopologies(bank);
  if (topologies.length === 0) {
    throw unavailable(
      "The Quantman QPU bank contains no runtime-admissible maze topology.",
    );
  }
  const index =
    deriveSeed(asUint32Seed(runSeed), "quantman:qpu-topology-selector") %
    topologies.length;
  const topology = topologies[index];
  if (!topology) {
    throw unavailable(
      "The Quantman topology selector resolved outside the installed bank.",
    );
  }
  return selectQuantmanQpuFixtureForTopology(
    bank,
    topology.topologyId,
    runSeed,
  );
}

export function selectQuantmanArcadeQpuFixture(
  bank: QuantmanQpuBank,
  courseIndex: number,
  runSeed: number,
): QuantmanQpuFixtureSelection {
  if (!Number.isSafeInteger(courseIndex) || courseIndex < 0) {
    throw unavailable("The Quantman Arcade course index is invalid.");
  }
  const topologies = playableQuantmanTopologies(bank);
  if (topologies.length === 0) {
    throw unavailable(
      "The Quantman QPU bank contains no runtime-admissible maze topology.",
    );
  }
  const topology = topologies[courseIndex % topologies.length]!;
  const captureSeed = deriveSeed(
    asUint32Seed(runSeed),
    `quantman:arcade-course:${courseIndex}`,
  );
  return selectQuantmanQpuFixtureForTopology(
    bank,
    topology.topologyId,
    captureSeed,
  );
}

export function playableQuantmanTopologies(
  bank: QuantmanQpuBank,
): readonly QuantmanMazeTopology[] {
  const playableFixtureIds = new Set(
    selections(bank)
      .filter(({ authority }) => authority.admissibility.runtimeEligible)
      .map(({ fixture }) => fixture.fixtureId),
  );
  return Object.freeze(
    bank.topologies.filter((topology) =>
      topology.captureFixtureIds.some((fixtureId) =>
        playableFixtureIds.has(fixtureId),
      ),
    ),
  );
}

export function selectQuantmanQpuFixtureForTopology(
  bank: QuantmanQpuBank,
  topologyId: string,
  runSeed: number,
): QuantmanQpuFixtureSelection {
  const topology = playableQuantmanTopologies(bank).find(
    (candidate) => candidate.topologyId === topologyId,
  );
  if (!topology) {
    throw unavailable(
      `The Quantman maze topology ${topologyId} is not installed or has no admissible hardware capture.`,
    );
  }
  const eligible = selections(bank).filter(
    ({ fixture, authority }) =>
      topology.captureFixtureIds.includes(fixture.fixtureId) &&
      authority.admissibility.runtimeEligible,
  );
  const index =
    deriveSeed(
      asUint32Seed(runSeed),
      `quantman:qpu-capture:${topology.topologyId}`,
    ) % eligible.length;
  const selected = eligible[index];
  if (!selected) {
    throw unavailable(
      `The Quantman capture selector failed for topology ${topology.topologyId}.`,
    );
  }
  return selected;
}

export function selectQuantmanStoryQpuFixture(
  bank: QuantmanQpuBank,
  levelIndex: number,
  runSeed: number,
): QuantmanQpuFixtureSelection {
  if (!Number.isSafeInteger(levelIndex) || levelIndex < 0) {
    throw unavailable("The Quantman Story level index is invalid.");
  }
  const topologies = playableQuantmanTopologies(bank);
  if (topologies.length === 0) {
    throw unavailable(
      "The Quantman QPU bank contains no runtime-admissible maze topology.",
    );
  }
  const topology = topologies[levelIndex % topologies.length]!;
  return selectQuantmanQpuFixtureForTopology(
    bank,
    topology.topologyId,
    runSeed,
  );
}

export function findInstalledQuantmanQpuFixture(
  bank: QuantmanQpuBank,
  fixtureId: string,
  contentSha256: string,
): QuantmanQpuFixtureSelection | null {
  return (
    selections(bank).find(
      ({ fixture, authority }) =>
        fixture.fixtureId === fixtureId &&
        fixture.contentSha256 === contentSha256 &&
        authority.admissibility.runtimeEligible,
    ) ?? null
  );
}

export function resolveQuantmanQpuFixtureForRun(
  bank: QuantmanQpuBank,
  runSeed: number,
  frozenIdentity: Readonly<{
    fixtureId: string;
    contentSha256: string;
  }> | null = null,
): QuantmanQpuFixtureSelection {
  if (!frozenIdentity) return selectQuantmanQpuFixture(bank, runSeed);
  const selection = findInstalledQuantmanQpuFixture(
    bank,
    frozenIdentity.fixtureId,
    frozenIdentity.contentSha256,
  );
  if (!selection) {
    throw unavailable(
      "The frozen Quantman QPU fixture is not installed or no longer runtime-admissible.",
    );
  }
  return selection;
}

function selections(bank: QuantmanQpuBank): QuantmanQpuFixtureSelection[] {
  const bankIdentity = deepFreeze({
    schemaVersion: bank.schemaVersion,
    bankId: bank.bankId,
    selectionMethod: bank.selectionMethod,
    contentSha256: bank.contentSha256,
  });
  return bank.fixtures.map((fixture, index) => {
    const authority = bank.fixtureAuthorities[index];
    if (!authority) {
      throw unavailable(
        `Quantman fixture ${fixture.fixtureId} has no authority.`,
      );
    }
    const topology = bank.topologies.find((candidate) =>
      candidate.captureFixtureIds.includes(fixture.fixtureId),
    );
    if (!topology) {
      throw unavailable(
        `Quantman fixture ${fixture.fixtureId} has no authored topology.`,
      );
    }
    return deepFreeze({
      bank: bankIdentity,
      topology,
      fixture,
      authority,
    });
  });
}

async function validateAuthority(
  value: unknown,
  fixture: LabyrinthFixture,
): Promise<QuantmanQpuFixtureAuthority> {
  if (!isRecord(value)) {
    throw unavailable(
      `Quantman fixture ${fixture.fixtureId} has no authority.`,
    );
  }
  const material = { ...value };
  const contentSha256 = requiredHash(
    material["contentSha256"],
    "authority contentSha256",
  );
  delete material["contentSha256"];
  if ((await sha256CanonicalJson(material)) !== contentSha256) {
    throw unavailable(
      `Quantman fixture ${fixture.fixtureId} authority hash does not match.`,
    );
  }
  const apiSpecification = requiredRecord(
    value["apiSpecification"],
    "authority apiSpecification",
  );
  const gridSize = requiredRecord(value["gridSize"], "authority gridSize");
  const redactedRequest = requiredRecord(
    value["redactedRequest"],
    "authority redactedRequest",
  );
  const authority = value as unknown as QuantmanQpuFixtureAuthority;
  const returnedWeight = fixture.records.reduce(
    (sum, record) => sum + record.weight,
    0,
  );
  if (
    value["schemaVersion"] !== QUANTMAN_QPU_AUTHORITY_SCHEMA ||
    value["fixtureId"] !== fixture.fixtureId ||
    value["fixtureContentSha256"] !== fixture.contentSha256 ||
    value["engineId"] !== "labyrinth-v1" ||
    value["mode"] !== "qpu" ||
    value["numQubits"] !== 100 ||
    value["bitOrder"] !== "row-major-room-index" ||
    value["backend"] !== "ibm_fez" ||
    value["mothJobId"] !== fixture.provenance.mothJobId ||
    value["hardwareJobId"] !== fixture.provenance.hardwareJobId ||
    value["returnedShots"] !== returnedWeight ||
    value["returnedShots"] !== fixture.provenance.shots ||
    value["requestedShots"] !== value["returnedShots"] ||
    gridSize["rows"] !== 10 ||
    gridSize["cols"] !== 10 ||
    containsCredentialField(redactedRequest)
  ) {
    throw unavailable(
      `Quantman fixture ${fixture.fixtureId} authority is not a complete 100-bit IBM Fez record.`,
    );
  }
  for (const [label, candidate] of [
    ["campaignId", value["campaignId"]],
    ["targetId", value["targetId"]],
    ["engineUpdatedAt", value["engineUpdatedAt"]],
    ["submittedAt", value["submittedAt"]],
    ["retrievedAtUtc", value["retrievedAtUtc"]],
    ["providerUpdatedAt", value["providerUpdatedAt"]],
    ["terminalObservedAtUtc", value["terminalObservedAtUtc"]],
    ["claimBoundary", value["claimBoundary"]],
    ["api version", apiSpecification["version"]],
  ] as const) {
    requiredString(candidate, `authority ${label}`);
  }
  for (const [label, candidate] of [
    ["engineCanonicalSha256", value["engineCanonicalSha256"]],
    ["redactedRequestSha256", value["redactedRequestSha256"]],
    ["rawResultSha256", value["rawResultSha256"]],
    ["captureContentSha256", value["captureContentSha256"]],
    ["terminalStatusSha256", value["terminalStatusSha256"]],
    ["API canonicalSha256", apiSpecification["canonicalSha256"]],
  ] as const) {
    requiredHash(candidate, `authority ${label}`);
  }
  if (
    (await sha256CanonicalJson(redactedRequest)) !==
    value["redactedRequestSha256"]
  ) {
    throw unavailable(
      `Quantman fixture ${fixture.fixtureId} redacted request hash does not match.`,
    );
  }
  validateQuantmanAdmissibilityIndex(
    authority.admissibility,
    fixture.records,
    fixture.width,
    fixture.height,
  );
  return authority;
}

async function validateTopology(
  value: unknown,
  index: number,
): Promise<QuantmanMazeTopology> {
  if (!isRecord(value)) {
    throw unavailable(`Quantman topology ${index + 1} is not an object.`);
  }
  const material = { ...value };
  const contentSha256 = requiredHash(
    material["contentSha256"],
    `topology ${index + 1} contentSha256`,
  );
  delete material["contentSha256"];
  if ((await sha256CanonicalJson(material)) !== contentSha256) {
    throw unavailable(`Quantman topology ${index + 1} hash does not match.`);
  }
  const gridSize = requiredRecord(
    value["gridSize"],
    `topology ${index + 1} gridSize`,
  );
  const courseOrder = value["courseOrder"];
  const captureFixtureIds = value["captureFixtureIds"];
  const couplingMap = validateAuthoredCouplingMap(
    value["couplingMap"],
    `topology ${index + 1}`,
  );
  if (
    value["schemaVersion"] !== QUANTMAN_QPU_TOPOLOGY_SCHEMA ||
    gridSize["rows"] !== 10 ||
    gridSize["cols"] !== 10 ||
    value["numQubits"] !== 100 ||
    value["corridorCount"] !== 99 ||
    !Number.isSafeInteger(courseOrder) ||
    Number(courseOrder) < 0 ||
    !Array.isArray(captureFixtureIds) ||
    captureFixtureIds.length === 0 ||
    captureFixtureIds.some(
      (fixtureId) => typeof fixtureId !== "string" || fixtureId.length === 0,
    )
  ) {
    throw unavailable(`Quantman topology ${index + 1} contract is invalid.`);
  }
  requireUnique(
    captureFixtureIds as string[],
    `capture fixture ID within topology ${index + 1}`,
  );
  const authoredTopologySha256 = requiredHash(
    value["authoredTopologySha256"],
    `topology ${index + 1} authoredTopologySha256`,
  );
  if ((await sha256CanonicalJson(couplingMap)) !== authoredTopologySha256) {
    throw unavailable(
      `Quantman topology ${index + 1} authored hash does not match its corridors.`,
    );
  }
  return deepFreeze({
    schemaVersion: QUANTMAN_QPU_TOPOLOGY_SCHEMA,
    topologyId: requiredString(
      value["topologyId"],
      `topology ${index + 1} topologyId`,
    ),
    label: requiredString(value["label"], `topology ${index + 1} label`),
    courseOrder: Number(courseOrder),
    gridSize: { rows: 10, cols: 10 },
    numQubits: 100,
    corridorCount: 99,
    couplingMap,
    authoredTopologySha256,
    captureFixtureIds: [...(captureFixtureIds as string[])],
    contentSha256,
  });
}

async function authoredTopologyHashFromAuthority(
  authority: QuantmanQpuFixtureAuthority,
): Promise<string> {
  const params = requiredRecord(
    authority.redactedRequest.params,
    `fixture ${authority.fixtureId} request params`,
  );
  const levelData = requiredRecord(
    params["level_data"],
    `fixture ${authority.fixtureId} level_data`,
  );
  const couplingMap = validateAuthoredCouplingMap(
    levelData["coupling_map"],
    `fixture ${authority.fixtureId}`,
  );
  return sha256CanonicalJson(couplingMap);
}

function validateAuthoredCouplingMap(
  value: unknown,
  label: string,
): readonly (readonly [number, number])[] {
  if (!Array.isArray(value) || value.length !== 99) {
    throw unavailable(`${label} must contain 99 authored maze corridors.`);
  }
  const edges = value.map((candidate, index) => {
    if (
      !Array.isArray(candidate) ||
      candidate.length !== 2 ||
      !candidate.every(
        (room) => Number.isSafeInteger(room) && room >= 0 && room < 100,
      )
    ) {
      throw unavailable(`${label} corridor ${index + 1} is invalid.`);
    }
    const a = Math.min(Number(candidate[0]), Number(candidate[1]));
    const b = Math.max(Number(candidate[0]), Number(candidate[1]));
    if (
      !(
        b - a === 10 ||
        (b - a === 1 && Math.floor(a / 10) === Math.floor(b / 10))
      )
    ) {
      throw unavailable(`${label} corridor ${index + 1} is not a grid edge.`);
    }
    return [a, b] as const;
  });
  edges.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
  if (new Set(edges.map(([a, b]) => `${a},${b}`)).size !== 99) {
    throw unavailable(`${label} repeats an authored maze corridor.`);
  }
  const adjacency = Array.from({ length: 100 }, () => [] as number[]);
  for (const [a, b] of edges) {
    adjacency[a]!.push(b);
    adjacency[b]!.push(a);
  }
  const reached = new Set([0]);
  const pending = [0];
  while (pending.length > 0) {
    const room = pending.pop()!;
    for (const neighbour of adjacency[room]!) {
      if (!reached.has(neighbour)) {
        reached.add(neighbour);
        pending.push(neighbour);
      }
    }
  }
  if (reached.size !== 100) {
    throw unavailable(`${label} authored maze does not span all 100 rooms.`);
  }
  return Object.freeze(edges);
}

function requiredRecord(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isRecord(value)) {
    throw unavailable(`The Quantman QPU bank ${label} is invalid.`);
  }
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw unavailable(`The Quantman QPU bank ${label} is invalid.`);
  }
  return value;
}

function requiredHash(value: unknown, label: string): string {
  const hash = requiredString(value, label);
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    throw unavailable(`The Quantman QPU bank ${label} is not SHA-256.`);
  }
  return hash;
}

function requireUnique(values: readonly string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw unavailable(`The Quantman QPU bank repeats a ${label}.`);
  }
}

function containsCredentialField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCredentialField);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => {
    const normalized = key.toLowerCase().replaceAll("-", "_");
    return (
      [
        "api_key",
        "access_token",
        "auth_token",
        "moth_api_key",
        "qpu_token",
        "qpu_instance",
      ].includes(normalized) || containsCredentialField(child)
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function unavailable(message: string): QuantmanQpuBankUnavailableError {
  return new QuantmanQpuBankUnavailableError(message);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
