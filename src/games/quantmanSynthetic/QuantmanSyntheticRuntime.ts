import fixtureJson from "./data/quantman-labyrinth-synthetic-10x10-v1.json" with { type: "json" };
import { QuantmanSession } from "./game/QuantmanSession";
import type {
  MazeMechanic,
  SemanticInput,
  SessionSnapshot,
} from "./game/types";
import { validateLabyrinthFixture } from "./labyrinth/LabyrinthFixture";
import type {
  LabyrinthFixture,
  QuantmanQpuFixtureAuthority,
} from "./labyrinth/types";

export const QUANTMAN_SYNTHETIC_RULES_VERSION =
  "quantman-synthetic-rules-v3" as const;
export const QUANTMAN_QPU_RULES_VERSION =
  "quantman-labyrinth-rules-v4" as const;
export const QUANTMAN_SYNTHETIC_REPLAY_SCHEMA_VERSION =
  "quantum-box-quantman-synthetic-replay-v1" as const;

export const QUANTMAN_SYNTHETIC_FIXTURE_ID =
  "quantman-labyrinth-synthetic-10x10-v1" as const;
export const QUANTMAN_SYNTHETIC_FIXTURE_CONTENT_SHA256 =
  "3903f4cb59604c5da3284782ee2972b114eb00841510c9ce5ee7f05cfbd8a26a" as const;
export const QUANTMAN_SYNTHETIC_FIXTURE_BYTES_SHA256 =
  "81ea6226a2d7d056b516579c38ad3d82b7a6340d028df4cce8026d44a8ea5fc3" as const;
export const QUANTMAN_SYNTHETIC_SOURCE_COMMIT =
  "d4dd14befae9e1f4c4a1dbac159c8391a94ae435" as const;

export type QuantmanSyntheticPlayMode = "arcade" | "story";

export interface QuantmanSyntheticFixtureIdentity {
  readonly classification: "local-synthetic-control" | "recorded-moth-qpu";
  readonly fixtureId: string;
  readonly fixtureContentSha256: string;
  readonly fixtureBytesSha256: string | null;
  readonly sourceCommit: string | null;
  readonly sourceType: "synthetic" | "qpu";
  readonly provider: string | null;
  readonly backend: string | null;
  readonly jobId: string | null;
  readonly mothJobId: string | null;
  readonly hardwareJobId: string | null;
  readonly campaignId: string | null;
  readonly targetId: string | null;
  readonly redactedRequestSha256: string | null;
  readonly rawResultSha256: string | null;
  readonly captureContentSha256: string | null;
  readonly qpu: boolean;
  readonly recordCount: number;
  readonly compiledTopologyCount: number;
  readonly effectiveWeight: number;
  readonly admissibilityFilterId: string | null;
  readonly admittedRecordCount: number;
  readonly admittedWeight: number;
  readonly excludedRecordCount: number;
  readonly excludedWeight: number;
  readonly limits: readonly string[];
}

export interface QuantmanSyntheticRunContext {
  readonly playMode: QuantmanSyntheticPlayMode;
  readonly runSeed: number;
  readonly startingLives?: number | undefined;
  readonly startingScore?: number | undefined;
  readonly mechanic: MazeMechanic;
  readonly rulesVersion:
    | typeof QUANTMAN_SYNTHETIC_RULES_VERSION
    | typeof QUANTMAN_QPU_RULES_VERSION;
}

export interface QuantmanSyntheticRuntimeOptions {
  readonly playMode: QuantmanSyntheticPlayMode;
  readonly runSeed: number;
  readonly startingLives?: number | undefined;
  readonly startingScore?: number | undefined;
  readonly mechanic: MazeMechanic;
  readonly fixture?: LabyrinthFixture;
  readonly qpuAuthority?: QuantmanQpuFixtureAuthority;
  readonly rulesVersion?: QuantmanSyntheticRunContext["rulesVersion"];
}

export interface QuantmanSyntheticTerminalResult {
  readonly outcome: "cleared" | "lost";
  readonly cleared: boolean;
  readonly playMode: QuantmanSyntheticPlayMode;
  readonly mechanic: MazeMechanic;
  readonly runSeed: number;
  readonly startingLives?: number | undefined;
  readonly startingScore?: number | undefined;
  readonly score: number;
  readonly remainingLives: number;
  readonly activeTicks: number;
  readonly fixtureId: string;
  readonly fixtureContentSha256: string;
}

/**
 * Renderer-neutral state consumed by the main game's Arcade and Story adapters.
 * The simulation snapshot is authoritative; a renderer may interpolate from it
 * but must not write gameplay state back into this runtime.
 */
export interface QuantmanSyntheticRuntimeSnapshot {
  readonly run: QuantmanSyntheticRunContext;
  readonly fixture: QuantmanSyntheticFixtureIdentity;
  readonly simulation: SessionSnapshot;
  readonly terminal: QuantmanSyntheticTerminalResult | null;
}

export interface QuantmanSyntheticReplayTape {
  readonly schemaVersion: typeof QUANTMAN_SYNTHETIC_REPLAY_SCHEMA_VERSION;
  readonly rulesVersion: QuantmanSyntheticRunContext["rulesVersion"];
  readonly playMode: QuantmanSyntheticPlayMode;
  readonly runSeed: number;
  readonly startingLives?: number | undefined;
  readonly startingScore?: number | undefined;
  readonly mechanic: MazeMechanic;
  readonly fixtureId: string;
  readonly fixtureContentSha256: string;
  readonly inputs: readonly SemanticInput[];
}

const fixture = deepFreeze(
  validateLabyrinthFixture(fixtureJson),
) as LabyrinthFixture;

assertCanonicalSyntheticFixture(fixture);

export const QUANTMAN_SYNTHETIC_FIXTURE: LabyrinthFixture = fixture;

export const QUANTMAN_SYNTHETIC_FIXTURE_IDENTITY: QuantmanSyntheticFixtureIdentity =
  deepFreeze({
    classification: "local-synthetic-control",
    fixtureId: QUANTMAN_SYNTHETIC_FIXTURE_ID,
    fixtureContentSha256: QUANTMAN_SYNTHETIC_FIXTURE_CONTENT_SHA256,
    fixtureBytesSha256: QUANTMAN_SYNTHETIC_FIXTURE_BYTES_SHA256,
    sourceCommit: QUANTMAN_SYNTHETIC_SOURCE_COMMIT,
    sourceType: "synthetic",
    provider: null,
    backend: null,
    jobId: null,
    mothJobId: null,
    hardwareJobId: null,
    campaignId: null,
    targetId: null,
    redactedRequestSha256: null,
    rawResultSha256: null,
    captureContentSha256: null,
    qpu: false,
    recordCount: 512,
    compiledTopologyCount: 256,
    effectiveWeight: 5636,
    admissibilityFilterId: null,
    admittedRecordCount: 512,
    admittedWeight: 5636,
    excludedRecordCount: 0,
    excludedWeight: 0,
    limits: [
      "No Moth request or provider job produced this fixture.",
      "This fixture is not QPU or quantum-hardware output.",
      "It is a local deterministic gameplay control for a future separately validated provider bank.",
    ],
  });

export class QuantmanSyntheticRuntime {
  public readonly context: QuantmanSyntheticRunContext;
  public readonly session: QuantmanSession;
  public readonly fixture: LabyrinthFixture;
  public readonly fixtureIdentity: QuantmanSyntheticFixtureIdentity;
  private readonly inputs: SemanticInput[] = [];

  public constructor(options: QuantmanSyntheticRuntimeOptions) {
    assertUint32(options.runSeed);
    this.fixture = options.fixture ?? QUANTMAN_SYNTHETIC_FIXTURE;
    this.context = deepFreeze({
      playMode: options.playMode,
      runSeed: options.runSeed >>> 0,
      ...(options.startingLives !== undefined
        ? { startingLives: options.startingLives }
        : {}),
      ...(options.startingScore !== undefined
        ? { startingScore: options.startingScore }
        : {}),
      mechanic: options.mechanic,
      rulesVersion:
        options.rulesVersion ??
        (this.fixture.provenance.sourceType === "qpu"
          ? QUANTMAN_QPU_RULES_VERSION
          : QUANTMAN_SYNTHETIC_RULES_VERSION),
    });
    this.session = new QuantmanSession(
      this.fixture,
      this.context.runSeed,
      {
        mechanic: options.mechanic,
        startingLives: options.startingLives,
        startingScore: options.startingScore,
      },
      options.qpuAuthority ?? null,
    );
    this.fixtureIdentity = fixtureIdentity(
      this.fixture,
      options.qpuAuthority ?? null,
      this.session.bank.topologies.length,
      this.session.bank.effectiveShots,
    );
  }

  public step(input: SemanticInput): QuantmanSyntheticRuntimeSnapshot {
    const canonicalInput = canonicalizeInput(input);
    this.inputs.push(canonicalInput);
    this.session.step(canonicalInput);
    return this.snapshot();
  }

  public snapshot(): QuantmanSyntheticRuntimeSnapshot {
    const simulation = this.session.snapshot();
    return deepFreeze({
      run: this.context,
      fixture: this.fixtureIdentity,
      simulation,
      terminal: terminalResult(this.context, this.fixture, simulation),
    });
  }

  public replayTape(): QuantmanSyntheticReplayTape {
    return deepFreeze({
      schemaVersion: QUANTMAN_SYNTHETIC_REPLAY_SCHEMA_VERSION,
      rulesVersion: this.context.rulesVersion,
      playMode: this.context.playMode,
      runSeed: this.context.runSeed,
      mechanic: this.context.mechanic,
      fixtureId: this.fixture.fixtureId,
      fixtureContentSha256: this.fixture.contentSha256,
      ...(this.context.startingLives !== undefined
        ? { startingLives: this.context.startingLives }
        : {}),
      ...(this.context.startingScore !== undefined
        ? { startingScore: this.context.startingScore }
        : {}),
      inputs: this.inputs.map((input) => ({ ...input })),
    });
  }
}

export function runQuantmanSyntheticReplay(
  tape: QuantmanSyntheticReplayTape,
  replayFixture: LabyrinthFixture = QUANTMAN_SYNTHETIC_FIXTURE,
  qpuAuthority: QuantmanQpuFixtureAuthority | null = null,
): QuantmanSyntheticRuntimeSnapshot {
  assertReplayTape(tape, replayFixture);
  const runtime = new QuantmanSyntheticRuntime({
    playMode: tape.playMode,
    runSeed: tape.runSeed,
    startingLives: tape.startingLives,
    startingScore: tape.startingScore,
    mechanic: tape.mechanic,
    fixture: replayFixture,
    ...(qpuAuthority ? { qpuAuthority } : {}),
    rulesVersion: tape.rulesVersion,
  });
  for (const input of tape.inputs) runtime.step(input);
  return runtime.snapshot();
}

function terminalResult(
  context: QuantmanSyntheticRunContext,
  activeFixture: LabyrinthFixture,
  snapshot: SessionSnapshot,
): QuantmanSyntheticTerminalResult | null {
  if (snapshot.phase !== "won" && snapshot.phase !== "lost") return null;
  return deepFreeze({
    outcome: snapshot.phase === "won" ? "cleared" : "lost",
    cleared: snapshot.phase === "won",
    playMode: context.playMode,
    mechanic: context.mechanic,
    runSeed: context.runSeed,
    score: snapshot.score,
    remainingLives: snapshot.lives,
    activeTicks: snapshot.activeTick,
    fixtureId: activeFixture.fixtureId,
    fixtureContentSha256: activeFixture.contentSha256,
  });
}

function assertCanonicalSyntheticFixture(value: LabyrinthFixture): void {
  if (
    value.fixtureId !== QUANTMAN_SYNTHETIC_FIXTURE_ID ||
    value.contentSha256 !== QUANTMAN_SYNTHETIC_FIXTURE_CONTENT_SHA256 ||
    value.width !== 10 ||
    value.height !== 10 ||
    value.records.length !== 512 ||
    value.records.reduce((sum, record) => sum + record.weight, 0) !== 5636 ||
    value.provenance.sourceType !== "synthetic"
  ) {
    throw new Error("Quantman synthetic fixture identity has changed.");
  }
}

function assertReplayTape(
  tape: QuantmanSyntheticReplayTape,
  replayFixture: LabyrinthFixture,
): void {
  if (
    tape.schemaVersion !== QUANTMAN_SYNTHETIC_REPLAY_SCHEMA_VERSION ||
    (tape.rulesVersion !== QUANTMAN_SYNTHETIC_RULES_VERSION &&
      tape.rulesVersion !== QUANTMAN_QPU_RULES_VERSION) ||
    tape.fixtureId !== replayFixture.fixtureId ||
    tape.fixtureContentSha256 !== replayFixture.contentSha256
  ) {
    throw new Error(
      "Quantman synthetic replay identity does not match the canonical fixture.",
    );
  }
  assertUint32(tape.runSeed);
}

function fixtureIdentity(
  activeFixture: LabyrinthFixture,
  authority: QuantmanQpuFixtureAuthority | null,
  compiledTopologyCount: number,
  effectiveWeight: number,
): QuantmanSyntheticFixtureIdentity {
  if (activeFixture === QUANTMAN_SYNTHETIC_FIXTURE) {
    return QUANTMAN_SYNTHETIC_FIXTURE_IDENTITY;
  }
  const provenance = activeFixture.provenance;
  if (
    provenance.sourceType !== "qpu" ||
    !provenance.mothJobId ||
    !provenance.hardwareJobId ||
    !provenance.rawResultSha256 ||
    authority?.fixtureId !== activeFixture.fixtureId ||
    authority.fixtureContentSha256 !== activeFixture.contentSha256 ||
    !authority.admissibility.runtimeEligible
  ) {
    throw new Error("Quantman non-canonical fixture lacks QPU provenance.");
  }
  return deepFreeze({
    classification: "recorded-moth-qpu",
    fixtureId: activeFixture.fixtureId,
    fixtureContentSha256: activeFixture.contentSha256,
    fixtureBytesSha256: null,
    sourceCommit: null,
    sourceType: "qpu",
    provider: activeFixture.provenance.generatorOrProvider,
    backend: activeFixture.provenance.backend ?? null,
    jobId: provenance.hardwareJobId,
    mothJobId: provenance.mothJobId,
    hardwareJobId: provenance.hardwareJobId,
    campaignId: authority.campaignId,
    targetId: authority.targetId,
    redactedRequestSha256: authority.redactedRequestSha256,
    rawResultSha256: authority.rawResultSha256,
    captureContentSha256: authority.captureContentSha256,
    qpu: true,
    recordCount: activeFixture.records.length,
    compiledTopologyCount,
    effectiveWeight,
    admissibilityFilterId: authority.admissibility.filterId,
    admittedRecordCount: authority.admissibility.summary.admittedRecordCount,
    admittedWeight: authority.admissibility.summary.admittedWeight,
    excludedRecordCount: authority.admissibility.summary.excludedRecordCount,
    excludedWeight: authority.admissibility.summary.excludedWeight,
    limits: [...activeFixture.provenance.limits],
  });
}

function canonicalizeInput(input: SemanticInput): SemanticInput {
  if (
    input.direction !== null &&
    input.direction !== "up" &&
    input.direction !== "right" &&
    input.direction !== "down" &&
    input.direction !== "left"
  ) {
    throw new Error(`Unknown Quantman direction: ${String(input.direction)}.`);
  }
  return Object.freeze({
    direction: input.direction,
    start: input.start === true,
  });
}

function assertUint32(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new Error(`Quantman run seed must be a uint32: ${value}.`);
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
