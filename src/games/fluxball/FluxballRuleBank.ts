import ruleBankInput from "./data/fluxball-qgraph-rule-bank-v1.json" with { type: "json" };
import type { SignedOutcome } from "./standalone/fixtures";
import type { FixtureCatalog } from "./standalone/fixtures";
import type { Context } from "./standalone/fixtures/types";
import {
  activePlayerIdsFor,
  type ActivePlayerMap,
  type CompetitorCount,
  type PlayerId,
} from "./standalone/modes";
import { deriveRuleSeed } from "./standalone/rules/sampleRoundRules";
import { sampleRoundRules } from "./standalone/rules/sampleRoundRules";
import {
  DeterministicRng,
  RNG_ALGORITHM,
  mixSeed,
} from "./standalone/rules/rng";
import type {
  AxisSample,
  GlobalParity,
  RoundRuleDistribution,
  RoundRuleTrace,
  RuleAcquisitionSource,
  RuleDimension,
  Sign,
} from "./standalone/rules/types";

const SOURCE_ORDER = Object.freeze([
  "moth-qgraph-qpu",
  "moth-qgraph-emu",
  "finite-shot-aer",
  "deterministic-classical-fallback",
] as const);

const CHANNELS = Object.freeze([
  { context: "X", dimension: "ACTION", drawIndex: 0 },
  { context: "Y", dimension: "INTERACTION", drawIndex: 1 },
  { context: "Z", dimension: "PURPOSE", drawIndex: 2 },
] as const satisfies readonly {
  context: Context;
  dimension: RuleDimension;
  drawIndex: 0 | 1 | 2;
}[]);

interface QGraphMeasurement {
  readonly bitstring: string;
  readonly count: number;
}

export interface FluxballQGraphRecord {
  readonly recordId: string;
  readonly source: "moth-qgraph-qpu" | "moth-qgraph-emu";
  readonly engineId: "graph-v1";
  readonly competitorCount: CompetitorCount;
  readonly eligibleRounds: readonly number[];
  readonly playerOrder: readonly PlayerId[];
  readonly mode: "qpu" | "emu";
  readonly backendName: string | null;
  readonly mothJobId: string;
  readonly ibmJobId: string | null;
  readonly submittedAt: string | null;
  readonly captureMethod:
    | "user-supplied-terminal-transcript"
    | "committed-api-result";
  readonly rawResultSha256: string | null;
  readonly evidencePath: string | null;
  readonly shots: number;
  readonly numQubits: number;
  readonly couplingMap: readonly (readonly [number, number])[];
  readonly operations: readonly Readonly<{
    type: "relationship";
    qubits: readonly [number, number];
    paulis: Readonly<{ XX: number; YY: number; ZZ: number }>;
    update: boolean;
  }>[];
  readonly measurementBasis: "computational";
  readonly bitOrder: "qubit-0-leftmost";
  readonly bitToSign: Readonly<{ "0": "+"; "1": "-" }>;
  readonly measurements: readonly QGraphMeasurement[];
  readonly claimBoundary: string;
}

interface FluxballQGraphRuleBank {
  readonly schemaVersion: "fluxball-qgraph-rule-bank-v1";
  readonly bankId: string;
  readonly selectionPolicy: typeof SELECTION_POLICY;
  readonly fallbackPacks: Readonly<
    Record<"2" | "4", Readonly<{ packId: string; contentSha256: string }>>
  >;
  readonly records: readonly FluxballQGraphRecord[];
}

const SELECTION_POLICY =
  "qpu-then-moth-emulator-then-local-aer-then-deterministic-classical" as const;

export interface SampleFluxballRulesOptions {
  readonly catalog: FixtureCatalog;
  readonly competitorCount: CompetitorCount;
  readonly runSeed: number;
  readonly roundNumber: number;
  readonly ruleBank?: unknown;
}

export interface FluxballRuleScheduleState {
  readonly stateIndex: number;
  readonly sourceRoundBuckets: readonly [number, number];
  readonly trace: RoundRuleTrace;
}

export interface BuildFluxballRuleScheduleOptions {
  readonly catalog: FixtureCatalog;
  readonly competitorCount: CompetitorCount;
  readonly runSeed: number;
  readonly gameplayRoundNumber: number;
  readonly stateCount: 2 | 3 | 4 | 5;
  readonly varyAcquisitionCategories?: boolean;
  readonly ruleBank?: unknown;
}

export const FLUXBALL_QGRAPH_RULE_BANK = validateRuleBank(ruleBankInput);

export function sampleFluxballRules({
  catalog,
  competitorCount,
  runSeed,
  roundNumber,
  ruleBank = FLUXBALL_QGRAPH_RULE_BANK,
}: SampleFluxballRulesOptions): RoundRuleTrace {
  const diagnostics: string[] = [];
  const bank =
    ruleBank === FLUXBALL_QGRAPH_RULE_BANK
      ? FLUXBALL_QGRAPH_RULE_BANK
      : safelyValidateRuleBank(ruleBank, diagnostics);
  if (bank) {
    const record = selectRecord(bank, competitorCount, runSeed, roundNumber);
    if (record) {
      return sampleRecord(bank, record, runSeed, roundNumber, diagnostics);
    }
  }
  diagnostics.push(
    `No valid QPU or Moth-emulator record is eligible for ${competitorCount}P round ${roundNumber}.`,
  );
  try {
    const local = sampleRoundRules({
      catalog,
      competitorCount,
      runSeed,
      roundNumber,
    });
    return deepFreeze({
      ...local,
      sourceMeasurementBasis: "separate-pauli-contexts" as const,
      sourceResolution: resolution("finite-shot-aer", diagnostics),
    });
  } catch (error) {
    diagnostics.push(
      `Local Aer control was unavailable: ${error instanceof Error ? error.message : String(error)}.`,
    );
    return sampleClassicalFallback(
      competitorCount,
      runSeed,
      roundNumber,
      diagnostics,
    );
  }
}

export function buildFluxballRuleSchedule({
  catalog,
  competitorCount,
  runSeed,
  gameplayRoundNumber,
  stateCount,
  varyAcquisitionCategories = false,
  ruleBank = FLUXBALL_QGRAPH_RULE_BANK,
}: BuildFluxballRuleScheduleOptions): readonly FluxballRuleScheduleState[] {
  if (
    !Number.isInteger(gameplayRoundNumber) ||
    gameplayRoundNumber < 1 ||
    gameplayRoundNumber > 4
  ) {
    throw new Error("Fluxball gameplay rounds must be 1 through 4.");
  }
  const categories = [1, 2, 3, 4];
  if (varyAcquisitionCategories) {
    const rng = new DeterministicRng(mixSeed(runSeed, 0x43415453));
    for (let index = categories.length - 1; index > 0; index -= 1) {
      const target = Math.floor(rng.next() * (index + 1));
      [categories[index], categories[target]] = [
        categories[target]!,
        categories[index]!,
      ];
    }
  }
  const category = categories[gameplayRoundNumber - 1]!;
  const sourceRoundBuckets = Object.freeze([
    category * 2 - 1,
    category * 2,
  ]) as readonly [number, number];
  const diagnostics: string[] = [];
  const bank =
    ruleBank === FLUXBALL_QGRAPH_RULE_BANK
      ? FLUXBALL_QGRAPH_RULE_BANK
      : safelyValidateRuleBank(ruleBank, diagnostics);
  if (bank) {
    const records = shuffledScheduleRecords(
      bank,
      competitorCount,
      runSeed,
      gameplayRoundNumber,
      sourceRoundBuckets,
    );
    if (records.length >= stateCount) {
      return deepFreeze(
        records.slice(0, stateCount).map((record, stateIndex) => ({
          stateIndex,
          sourceRoundBuckets,
          trace: sampleRecord(
            bank,
            record,
            runSeed,
            gameplayRoundNumber,
            diagnostics,
            scheduleRuleSeed(runSeed, gameplayRoundNumber, stateIndex),
          ),
        })),
      );
    }
    diagnostics.push(
      `Only ${records.length} provider records were eligible for ${competitorCount}P gameplay round ${gameplayRoundNumber}.`,
    );
  }

  return deepFreeze(
    Array.from({ length: stateCount }, (_, stateIndex) => {
      const sourceRound = sourceRoundBuckets[stateIndex % 2] ?? 1;
      const fallbackSeed = mixSeed(
        runSeed,
        mixSeed(gameplayRoundNumber, stateIndex + 1),
      );
      const sampled = sampleFluxballRules({
        catalog,
        competitorCount,
        runSeed: fallbackSeed,
        roundNumber: sourceRound,
        ruleBank: null,
      });
      return {
        stateIndex,
        sourceRoundBuckets,
        trace: {
          ...sampled,
          roundNumber: gameplayRoundNumber,
          runSeed,
          sourceResolution: resolution(sampled.acquisitionSource, [
            ...diagnostics,
            ...(sampled.sourceResolution?.fallbackReasons ?? []),
          ]),
        },
      };
    }),
  );
}

function sampleRecord(
  bank: FluxballQGraphRuleBank,
  record: FluxballQGraphRecord,
  runSeed: number,
  roundNumber: number,
  diagnostics: readonly string[],
  ruleSeedOverride?: number,
): RoundRuleTrace {
  const ruleSeed = ruleSeedOverride ?? deriveRuleSeed(runSeed, roundNumber);
  const rng = new DeterministicRng(ruleSeed);
  const activePlayerIds = activePlayerIdsFor(record.competitorCount);
  const probabilities = probabilitiesFor(record, activePlayerIds);
  const outcomeOrder = record.measurements.map((entry) =>
    bitsToSigns(entry.bitstring, record.playerOrder, activePlayerIds),
  );
  const samples = CHANNELS.map(({ context, dimension, drawIndex }) => {
    const distribution: RoundRuleDistribution = deepFreeze({
      competitorCount: record.competitorCount,
      fixtureBankId: bank.bankId,
      fixtureId: record.recordId,
      context,
      acquisitionSource: record.source,
      shotsPerCircuit: record.shots,
      outcomeOrder,
      probabilities,
    });
    const prngDraw = rng.next();
    const outcome = selectOutcome(distribution, prngDraw);
    return deepFreeze({
      context,
      dimension,
      distribution,
      drawIndex,
      prngDraw,
      outcome,
      signs: signsForOutcome(outcome, activePlayerIds),
      globalParity: parityForOutcome(outcome),
    });
  });
  const [action, interaction, purpose] = samples;
  if (!action || !interaction || !purpose || rng.drawCount !== 3) {
    throw new Error("QGraph rule sampling did not record exactly three draws.");
  }
  return deepFreeze({
    roundNumber,
    runSeed,
    ruleSeed,
    rngAlgorithm: RNG_ALGORITHM,
    samplingMethod: "three-weighted-draws-from-one-joint-distribution",
    competitorCount: record.competitorCount,
    activePlayerIds: [...activePlayerIds],
    fixtureBankId: bank.bankId,
    fixtureId: record.recordId,
    acquisitionSource: record.source,
    shotsPerCircuit: record.shots,
    sourceMeasurementBasis: "computational",
    sourceResolution: resolution(record.source, diagnostics),
    providerProvenance: {
      engineId: "graph-v1",
      mode: record.mode,
      backendName: record.backendName,
      mothJobId: record.mothJobId,
      ibmJobId: record.ibmJobId,
      submittedAt: record.submittedAt,
      captureMethod: record.captureMethod,
      rawResultSha256: record.rawResultSha256,
      evidencePath: record.evidencePath,
      measurementBasis: "computational",
      bitOrder: "qubit-0-leftmost",
      playerOrder: [...record.playerOrder],
      activePlayNetwork: false,
    },
    axes: {
      X: action as AxisSample<"X", "ACTION">,
      Y: interaction as AxisSample<"Y", "INTERACTION">,
      Z: purpose as AxisSample<"Z", "PURPOSE">,
    },
  });
}

function shuffledScheduleRecords(
  bank: FluxballQGraphRuleBank,
  competitorCount: CompetitorCount,
  runSeed: number,
  gameplayRoundNumber: number,
  sourceRoundBuckets: readonly [number, number],
): FluxballQGraphRecord[] {
  const eligible = bank.records
    .filter(
      (record) =>
        record.competitorCount === competitorCount &&
        record.eligibleRounds.some((round) =>
          sourceRoundBuckets.includes(round),
        ),
    )
    .sort((left, right) => {
      const source = sourceRank(left.source) - sourceRank(right.source);
      return source !== 0
        ? source
        : left.recordId.localeCompare(right.recordId);
    });
  const preferredSource = eligible[0]?.source;
  if (!preferredSource) return [];
  const shuffled = eligible.filter(
    (record) => record.source === preferredSource,
  );
  const rng = new DeterministicRng(
    mixSeed(runSeed, mixSeed(0x5255_4c45, gameplayRoundNumber)),
  );
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(rng.next() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target]!, shuffled[index]!];
  }
  return shuffled;
}

function scheduleRuleSeed(
  runSeed: number,
  gameplayRoundNumber: number,
  stateIndex: number,
): number {
  return mixSeed(
    runSeed,
    mixSeed(0x5354_4154 ^ gameplayRoundNumber, stateIndex + 1),
  );
}

function sampleClassicalFallback(
  competitorCount: CompetitorCount,
  runSeed: number,
  roundNumber: number,
  diagnostics: readonly string[],
): RoundRuleTrace {
  const ruleSeed = deriveRuleSeed(runSeed, roundNumber);
  const rng = new DeterministicRng(ruleSeed);
  const activePlayerIds = activePlayerIdsFor(competitorCount);
  const outcomeOrder = allSignedOutcomes(competitorCount);
  const probability = 1 / outcomeOrder.length;
  const probabilities = Object.freeze(
    Object.fromEntries(outcomeOrder.map((outcome) => [outcome, probability])),
  ) as Readonly<Partial<Record<SignedOutcome, number>>>;
  const samples = CHANNELS.map(({ context, dimension, drawIndex }) => {
    const distribution: RoundRuleDistribution = deepFreeze({
      competitorCount,
      fixtureBankId: "fluxball-deterministic-classical-fallback-v1",
      fixtureId: "uniform-signed-outcomes-v1",
      context,
      acquisitionSource: "deterministic-classical-fallback",
      shotsPerCircuit: 0,
      outcomeOrder,
      probabilities,
    });
    const prngDraw = rng.next();
    const outcome = selectOutcome(distribution, prngDraw);
    return deepFreeze({
      context,
      dimension,
      distribution,
      drawIndex,
      prngDraw,
      outcome,
      signs: signsForOutcome(outcome, activePlayerIds),
      globalParity: parityForOutcome(outcome),
    });
  });
  const [action, interaction, purpose] = samples;
  if (!action || !interaction || !purpose) {
    throw new Error("Classical fallback failed to produce three rule draws.");
  }
  return deepFreeze({
    roundNumber,
    runSeed,
    ruleSeed,
    rngAlgorithm: RNG_ALGORITHM,
    samplingMethod: "three-weighted-draws-from-one-joint-distribution",
    competitorCount,
    activePlayerIds: [...activePlayerIds],
    fixtureBankId: "fluxball-deterministic-classical-fallback-v1",
    fixtureId: "uniform-signed-outcomes-v1",
    acquisitionSource: "deterministic-classical-fallback",
    shotsPerCircuit: 0,
    sourceMeasurementBasis: "classical",
    sourceResolution: resolution(
      "deterministic-classical-fallback",
      diagnostics,
    ),
    axes: {
      X: action as AxisSample<"X", "ACTION">,
      Y: interaction as AxisSample<"Y", "INTERACTION">,
      Z: purpose as AxisSample<"Z", "PURPOSE">,
    },
  });
}

function selectRecord(
  bank: FluxballQGraphRuleBank,
  competitorCount: CompetitorCount,
  runSeed: number,
  roundNumber: number,
): FluxballQGraphRecord | null {
  const eligible = bank.records
    .filter(
      (record) =>
        record.competitorCount === competitorCount &&
        record.eligibleRounds.includes(roundNumber),
    )
    .sort((left, right) => {
      const source = sourceRank(left.source) - sourceRank(right.source);
      return source !== 0
        ? source
        : left.recordId.localeCompare(right.recordId);
    });
  const preferredSource = eligible[0]?.source;
  if (!preferredSource) return null;
  const preferred = eligible.filter(
    (record) => record.source === preferredSource,
  );
  return (
    preferred[deriveRuleSeed(runSeed, roundNumber) % preferred.length] ?? null
  );
}

function sourceRank(source: RuleAcquisitionSource): number {
  const index = SOURCE_ORDER.indexOf(source);
  return index === -1 ? SOURCE_ORDER.length : index;
}

function probabilitiesFor(
  record: FluxballQGraphRecord,
  canonicalOrder: readonly PlayerId[],
): Readonly<Partial<Record<SignedOutcome, number>>> {
  return Object.freeze(
    Object.fromEntries(
      record.measurements.map((entry) => [
        bitsToSigns(entry.bitstring, record.playerOrder, canonicalOrder),
        entry.count / record.shots,
      ]),
    ),
  ) as Readonly<Partial<Record<SignedOutcome, number>>>;
}

function bitsToSigns(
  bitstring: string,
  playerOrder: readonly PlayerId[],
  canonicalOrder: readonly PlayerId[],
): SignedOutcome {
  const signs = new Map<PlayerId, Sign>();
  playerOrder.forEach((playerId, index) => {
    const bit = bitstring[index];
    if (bit !== "0" && bit !== "1") {
      throw new Error(`Bitstring ${bitstring} is missing Player ${playerId}.`);
    }
    signs.set(playerId, bit === "0" ? "+" : "-");
  });
  return canonicalOrder
    .map((playerId) => {
      const sign = signs.get(playerId);
      if (!sign) throw new Error(`Player order is missing Player ${playerId}.`);
      return sign;
    })
    .join("") as SignedOutcome;
}

function selectOutcome(
  distribution: RoundRuleDistribution,
  draw: number,
): SignedOutcome {
  let cumulative = 0;
  for (const outcome of distribution.outcomeOrder) {
    const probability = distribution.probabilities[outcome];
    if (probability === undefined) {
      throw new Error(`Distribution is missing ${outcome}.`);
    }
    cumulative += probability;
    if (draw < cumulative) return outcome;
  }
  const last = distribution.outcomeOrder.at(-1);
  if (!last) throw new Error("Distribution has no outcomes.");
  return last;
}

function signsForOutcome(
  outcome: SignedOutcome,
  activePlayerIds: readonly PlayerId[],
): ActivePlayerMap<Sign> {
  const signs: Partial<Record<PlayerId, Sign>> = {};
  activePlayerIds.forEach((playerId, index) => {
    const sign = outcome[index];
    if (sign !== "+" && sign !== "-") {
      throw new Error(`Outcome ${outcome} is missing Player ${playerId}.`);
    }
    signs[playerId] = sign;
  });
  return Object.freeze(signs);
}

function parityForOutcome(outcome: SignedOutcome): GlobalParity {
  return (outcome.match(/-/g)?.length ?? 0) % 2 === 0 ? "+" : "-";
}

function allSignedOutcomes(competitorCount: CompetitorCount): SignedOutcome[] {
  return Array.from({ length: 2 ** competitorCount }, (_, value) =>
    value
      .toString(2)
      .padStart(competitorCount, "0")
      .replaceAll("0", "+")
      .replaceAll("1", "-"),
  ) as SignedOutcome[];
}

function resolution(
  selectedSource: RuleAcquisitionSource,
  fallbackReasons: readonly string[],
): NonNullable<RoundRuleTrace["sourceResolution"]> {
  return deepFreeze({
    preferredOrder: SOURCE_ORDER,
    selectedSource,
    fallbackReasons: [...fallbackReasons],
  });
}

function safelyValidateRuleBank(
  input: unknown,
  diagnostics: string[],
): FluxballQGraphRuleBank | null {
  try {
    return validateRuleBank(input);
  } catch (error) {
    diagnostics.push(
      `QGraph rule bank was rejected: ${error instanceof Error ? error.message : String(error)}.`,
    );
    return null;
  }
}

export function validateRuleBank(input: unknown): FluxballQGraphRuleBank {
  if (!isObject(input)) throw new Error("bank must be an object");
  if (containsCredentialField(input)) {
    throw new Error("bank must not contain QPU credentials");
  }
  if (input["schemaVersion"] !== "fluxball-qgraph-rule-bank-v1") {
    throw new Error("schemaVersion is unsupported");
  }
  const bankId = requireString(input["bankId"], "bankId");
  if (input["selectionPolicy"] !== SELECTION_POLICY) {
    throw new Error("selectionPolicy is unsupported");
  }
  const fallbackPacks = validateFallbackPacks(input["fallbackPacks"]);
  const rawRecords = input["records"];
  if (!Array.isArray(rawRecords)) throw new Error("records must be an array");
  const records = rawRecords.map((record, index) =>
    validateRecord(record, index),
  );
  const ids = new Set(records.map((record) => record.recordId));
  if (ids.size !== records.length) throw new Error("record IDs must be unique");
  return deepFreeze({
    schemaVersion: "fluxball-qgraph-rule-bank-v1",
    bankId,
    selectionPolicy: SELECTION_POLICY,
    fallbackPacks,
    records,
  });
}

function validateRecord(input: unknown, index: number): FluxballQGraphRecord {
  const label = `records[${index}]`;
  if (!isObject(input)) throw new Error(`${label} must be an object`);
  const source = input["source"];
  if (source !== "moth-qgraph-qpu" && source !== "moth-qgraph-emu") {
    throw new Error(`${label}.source is unsupported`);
  }
  const mode = input["mode"];
  if (mode !== "qpu" && mode !== "emu") {
    throw new Error(`${label}.mode is unsupported`);
  }
  if (
    (source === "moth-qgraph-qpu" && mode !== "qpu") ||
    (source === "moth-qgraph-emu" && mode !== "emu")
  ) {
    throw new Error(`${label} source and mode disagree`);
  }
  const competitorCount = input["competitorCount"];
  if (competitorCount !== 2 && competitorCount !== 4) {
    throw new Error(`${label}.competitorCount must be 2 or 4`);
  }
  if (input["numQubits"] !== competitorCount) {
    throw new Error(`${label}.numQubits must match competitorCount`);
  }
  const couplingMap = validatePairList(
    input["couplingMap"],
    `${label}.couplingMap`,
    competitorCount,
  );
  const operations = validateOperations(
    input["operations"],
    `${label}.operations`,
    competitorCount,
  );
  const shots = requirePositiveInteger(input["shots"], `${label}.shots`);
  const eligibleRounds = input["eligibleRounds"];
  if (
    !Array.isArray(eligibleRounds) ||
    eligibleRounds.length === 0 ||
    eligibleRounds.some(
      (round) => !Number.isInteger(round) || round < 1 || round > 8,
    )
  ) {
    throw new Error(`${label}.eligibleRounds must contain rounds 1 through 8`);
  }
  const expectedPlayers = activePlayerIdsFor(competitorCount);
  const playerOrder = input["playerOrder"];
  if (
    !Array.isArray(playerOrder) ||
    playerOrder.length !== competitorCount ||
    playerOrder.some(
      (player) =>
        typeof player !== "string" ||
        !expectedPlayers.includes(player as PlayerId),
    ) ||
    new Set(playerOrder).size !== competitorCount
  ) {
    throw new Error(
      `${label}.playerOrder must contain each active player exactly once`,
    );
  }
  const rawMeasurements = input["measurements"];
  if (!Array.isArray(rawMeasurements) || rawMeasurements.length === 0) {
    throw new Error(`${label}.measurements must be non-empty`);
  }
  const measurements = rawMeasurements.map((entry, measurementIndex) => {
    if (!isObject(entry)) {
      throw new Error(`${label}.measurements[${measurementIndex}] is invalid`);
    }
    const bitstring = requireString(
      entry["bitstring"],
      `${label}.measurements[${measurementIndex}].bitstring`,
    );
    if (!new RegExp(`^[01]{${competitorCount}}$`).test(bitstring)) {
      throw new Error(`${label} contains an invalid bitstring`);
    }
    return {
      bitstring,
      count: requirePositiveInteger(
        entry["count"],
        `${label}.measurements[${measurementIndex}].count`,
      ),
    };
  });
  if (
    new Set(measurements.map((entry) => entry.bitstring)).size !==
    measurements.length
  ) {
    throw new Error(`${label} repeats a bitstring`);
  }
  if (measurements.reduce((sum, entry) => sum + entry.count, 0) !== shots) {
    throw new Error(`${label} measurement counts do not sum to shots`);
  }
  if (input["engineId"] !== "graph-v1") {
    throw new Error(`${label}.engineId must be graph-v1`);
  }
  if (input["measurementBasis"] !== "computational") {
    throw new Error(`${label}.measurementBasis must be computational`);
  }
  if (input["bitOrder"] !== "qubit-0-leftmost") {
    throw new Error(`${label}.bitOrder is unsupported`);
  }
  const bitToSign = input["bitToSign"];
  if (
    !isObject(bitToSign) ||
    bitToSign["0"] !== "+" ||
    bitToSign["1"] !== "-"
  ) {
    throw new Error(`${label}.bitToSign must map 0 to plus and 1 to minus`);
  }
  const captureMethod = input["captureMethod"];
  if (
    captureMethod !== "user-supplied-terminal-transcript" &&
    captureMethod !== "committed-api-result"
  ) {
    throw new Error(`${label}.captureMethod is unsupported`);
  }
  const rawResultSha256 = nullableString(
    input["rawResultSha256"],
    `${label}.rawResultSha256`,
  );
  if (rawResultSha256 !== null && !/^[0-9a-f]{64}$/.test(rawResultSha256)) {
    throw new Error(`${label}.rawResultSha256 is invalid`);
  }
  const evidencePath = nullableString(
    input["evidencePath"],
    `${label}.evidencePath`,
  );
  if (
    evidencePath !== null &&
    (!evidencePath.startsWith("compiler/quantum_box_moth/evidence/") ||
      evidencePath.includes(".."))
  ) {
    throw new Error(`${label}.evidencePath is outside the evidence directory`);
  }
  if (
    captureMethod === "committed-api-result" &&
    (!rawResultSha256 || !evidencePath)
  ) {
    throw new Error(`${label} committed API provenance is incomplete`);
  }
  const backendName = nullableString(
    input["backendName"],
    `${label}.backendName`,
  );
  const ibmJobId = nullableString(input["ibmJobId"], `${label}.ibmJobId`);
  if (mode === "qpu" && (!backendName || !ibmJobId)) {
    throw new Error(`${label} QPU provenance is incomplete`);
  }
  return deepFreeze({
    recordId: requireString(input["recordId"], `${label}.recordId`),
    source,
    engineId: "graph-v1",
    competitorCount,
    eligibleRounds: [...eligibleRounds] as number[],
    playerOrder: [...playerOrder] as PlayerId[],
    mode,
    backendName,
    mothJobId: requireString(input["mothJobId"], `${label}.mothJobId`),
    ibmJobId,
    submittedAt: nullableString(input["submittedAt"], `${label}.submittedAt`),
    captureMethod,
    rawResultSha256,
    evidencePath,
    shots,
    numQubits: competitorCount,
    couplingMap,
    operations,
    measurementBasis: "computational",
    bitOrder: "qubit-0-leftmost",
    bitToSign: { "0": "+", "1": "-" },
    measurements,
    claimBoundary: requireString(
      input["claimBoundary"],
      `${label}.claimBoundary`,
    ),
  });
}

function validateFallbackPacks(
  input: unknown,
): FluxballQGraphRuleBank["fallbackPacks"] {
  if (!isObject(input)) throw new Error("fallbackPacks must be an object");
  return deepFreeze({
    "2": validateFallbackPack(input["2"], "fallbackPacks.2"),
    "4": validateFallbackPack(input["4"], "fallbackPacks.4"),
  });
}

function validateOperations(
  input: unknown,
  label: string,
  competitorCount: CompetitorCount,
): FluxballQGraphRecord["operations"] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  return deepFreeze(
    input.map((operationInput, index) => {
      const operationLabel = `${label}[${index}]`;
      if (
        !isObject(operationInput) ||
        operationInput["type"] !== "relationship"
      ) {
        throw new Error(`${operationLabel} must be a relationship`);
      }
      const paulisInput = operationInput["paulis"];
      if (!isObject(paulisInput)) {
        throw new Error(`${operationLabel}.paulis must be an object`);
      }
      if (typeof operationInput["update"] !== "boolean") {
        throw new Error(`${operationLabel}.update must be boolean`);
      }
      return {
        type: "relationship" as const,
        qubits: validatePair(
          operationInput["qubits"],
          `${operationLabel}.qubits`,
          competitorCount,
        ),
        paulis: {
          XX: requireFiniteNumber(
            paulisInput["XX"],
            `${operationLabel}.paulis.XX`,
          ),
          YY: requireFiniteNumber(
            paulisInput["YY"],
            `${operationLabel}.paulis.YY`,
          ),
          ZZ: requireFiniteNumber(
            paulisInput["ZZ"],
            `${operationLabel}.paulis.ZZ`,
          ),
        },
        update: operationInput["update"],
      };
    }),
  );
}

function validateFallbackPack(
  input: unknown,
  label: string,
): Readonly<{ packId: string; contentSha256: string }> {
  if (!isObject(input)) throw new Error(`${label} must be an object`);
  const contentSha256 = requireString(
    input["contentSha256"],
    `${label}.contentSha256`,
  );
  if (!/^[0-9a-f]{64}$/.test(contentSha256)) {
    throw new Error(`${label}.contentSha256 is invalid`);
  }
  return deepFreeze({
    packId: requireString(input["packId"], `${label}.packId`),
    contentSha256,
  });
}

function validatePairList(
  input: unknown,
  label: string,
  competitorCount: CompetitorCount,
): readonly (readonly [number, number])[] {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`${label} must be a non-empty array`);
  }
  return Object.freeze(
    input.map((pair, index) =>
      validatePair(pair, `${label}[${index}]`, competitorCount),
    ),
  );
}

function validatePair(
  input: unknown,
  label: string,
  competitorCount: CompetitorCount,
): readonly [number, number] {
  if (
    !Array.isArray(input) ||
    input.length !== 2 ||
    input.some(
      (value) =>
        !Number.isInteger(value) || value < 0 || value >= competitorCount,
    ) ||
    input[0] === input[1]
  ) {
    throw new Error(`${label} must contain two distinct qubit indexes`);
  }
  return Object.freeze([input[0], input[1]]) as readonly [number, number];
}

function containsCredentialField(input: unknown): boolean {
  if (Array.isArray(input)) return input.some(containsCredentialField);
  if (!isObject(input)) return false;
  return Object.entries(input).some(
    ([key, value]) =>
      key === "qpu_token" ||
      key === "qpu_instance" ||
      key === "qpuToken" ||
      key === "qpuInstance" ||
      containsCredentialField(value),
  );
}

function requireString(input: unknown, label: string): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return input;
}

function nullableString(input: unknown, label: string): string | null {
  if (input === null || input === undefined) return null;
  return requireString(input, label);
}

function requirePositiveInteger(input: unknown, label: string): number {
  if (!Number.isSafeInteger(input) || (input as number) <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return input as number;
}

function requireFiniteNumber(input: unknown, label: string): number {
  if (typeof input !== "number" || !Number.isFinite(input)) {
    throw new Error(`${label} must be finite`);
  }
  return input;
}

function isObject(input: unknown): input is Record<string, unknown> {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
