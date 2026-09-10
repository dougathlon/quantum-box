import { canonicalJson } from "../core/canonicalJson";
import { deriveSeed } from "../core/determinism";
import { createRunContext, type RunContext } from "../core/run";
import { createFluxballDesignerEvidence } from "../games/fluxball/FluxballDesignerEvidence";
import { FLUXBALL_PLAYABLE_RULE_BANK } from "../games/fluxball/fluxballControlPacks";
import { FluxballSession } from "../games/fluxball/FluxballSession";
import {
  FLUXBALL_LEGACY_RULES_VERSION,
  FLUXBALL_PREVIOUS_RULES_VERSION,
  FLUXBALL_OLDEST_RULES_VERSION,
  FLUXBALL_OLDER_RULES_VERSION,
} from "../games/fluxball/types";
import { GAME_IDS, type GameId, type StoryRunStageId } from "../games/registry";
import { validateQongSelectionReceipt } from "../games/qong/qongStoryPackBank";
import {
  changedQuantmanDoorIds,
  quantmanDoorIsOpen,
  quantmanTopologyRows,
} from "../games/quantman/QuantmanTopology";
import { QUANTMAN_CONTROL_PACK } from "../games/quantman/quantmanControlPack";
import { firstPathStep } from "../games/quantman/QuantmanPursuerPolicy";
import type {
  QuantmanCell,
  QuantmanLabyrinthState,
  QuantmanPackPayload,
  QuantmanPursuerMode,
} from "../games/quantman/types";
import type { CommittedPack } from "../packs/types";
import {
  createSkiPixlDesignerEvidence,
  findInstalledSkiPixlPack,
} from "../games/skipixl/SkiPixlCourseAdapter";
import type { TutorialEvidenceGate } from "./contracts";
import type { FluxballClubhouseEvidence } from "./fluxballClubhouse";
import type { QongWorkshopEvidence } from "./qongWorkshop";
import type { QuantmanTopologyRoomEvidence } from "./quantmanTopologyRoom";
import type { SkiPixlLodgeEvidence } from "./skiPixlLodge";

export const TUTORIAL_RECOVERY_SCHEMA_VERSION = "qbox-tutorial-recovery-v1";

export interface TutorialEvidenceByGame {
  readonly qong: QongWorkshopEvidence;
  readonly skipixl: SkiPixlLodgeEvidence;
  readonly fluxball: FluxballClubhouseEvidence;
  readonly quantman: QuantmanTopologyRoomEvidence;
}

export interface TutorialWorldIdByGame {
  readonly qong: "qong-workshop";
  readonly skipixl: "skipixl-lodge";
  readonly fluxball: "fluxball-clubhouse";
  readonly quantman: "quantman-topology-room";
}

export type TutorialRecoveryRecord<G extends GameId = GameId> = Readonly<{
  schemaVersion: typeof TUTORIAL_RECOVERY_SCHEMA_VERSION;
  gameId: G;
  worldId: TutorialWorldIdByGame[G];
  run: RunContext;
  evidenceOrigin: "completed-story-run";
  evidenceStatus: "validated-run";
  storyProgressEligible: true;
  evidenceLabel: string;
  evidenceSha256: string;
  recoverySha256: string;
  evidence: TutorialEvidenceByGame[G];
}>;

export type TutorialRecoveryRecords = Readonly<
  Partial<{ [G in GameId]: TutorialRecoveryRecord<G> }>
>;

const WORLD_ID_BY_GAME: TutorialWorldIdByGame = Object.freeze({
  qong: "qong-workshop",
  skipixl: "skipixl-lodge",
  fluxball: "fluxball-clubhouse",
  quantman: "quantman-topology-room",
});

const STORY_STAGE_BY_GAME: Readonly<Record<GameId, StoryRunStageId>> =
  Object.freeze({
    qong: "qong",
    skipixl: "skipixl",
    fluxball: "fluxball-four",
    quantman: "quantman",
  });

const SOURCE_BY_GAME: Readonly<Record<GameId, string>> = Object.freeze({
  qong: "moth-api-qpu",
  skipixl: "moth-platform-qpu-capture",
  fluxball: "mixed-preacquired-bank",
  quantman: "moth-api-emulator",
});

const EVIDENCE_LABEL_BY_GAME: Readonly<Record<GameId, string>> = Object.freeze({
  qong: "VALIDATED MOTH COIN TOSS STORY RUN",
  skipixl: "VALIDATED QPIXL STORY RUN · IBM FEZ CAPTURE",
  fluxball: "VALIDATED FLUXBALL STORY RUN · OFFLINE QGRAPH RULEFIELD",
  quantman: "VALIDATED QUANTMAN STORY RUN · MOTH REMOTE AER",
});

const SHA256_PATTERN = /^[0-9a-f]{64}$/;

export function createTutorialRecoveryRecord<G extends GameId>(
  gameId: G,
  run: RunContext,
  gate: TutorialEvidenceGate<unknown>,
): TutorialRecoveryRecord<G> {
  if (
    gate.status !== "validated-run" ||
    !gate.storyProgressEligible ||
    gate.value === null
  ) {
    throw new Error(
      `${gameId} recovery requires validated completed-run evidence.`,
    );
  }
  requireMatchingStoryRun(gameId, run);
  if (gate.label !== EVIDENCE_LABEL_BY_GAME[gameId]) {
    throw new Error(`${gameId} recovery evidence label is not canonical.`);
  }
  const evidence = cloneJson(gate.value);
  validateEvidenceShape(gameId, run, evidence);
  const unsigned = {
    schemaVersion: TUTORIAL_RECOVERY_SCHEMA_VERSION,
    gameId,
    worldId: WORLD_ID_BY_GAME[gameId],
    run: cloneJson(run),
    evidenceOrigin: "completed-story-run" as const,
    evidenceStatus: "validated-run" as const,
    storyProgressEligible: true as const,
    evidenceLabel: gate.label,
    evidenceSha256: sha256CanonicalJsonSync(evidence),
    evidence,
  };
  const record = {
    ...unsigned,
    recoverySha256: sha256CanonicalJsonSync(unsigned),
  } as TutorialRecoveryRecord<G>;
  return validateTutorialRecoveryRecord(record) as TutorialRecoveryRecord<G>;
}

/**
 * Fully validates a persisted recovery synchronously so save loading cannot
 * accept evidence first and discover tampering only after gameplay begins.
 */
export function validateTutorialRecoveryRecord(
  input: unknown,
): TutorialRecoveryRecord {
  if (!isRecord(input)) {
    throw new Error("Tutorial recovery record is not an object.");
  }
  const gameId = input["gameId"];
  if (!isGameId(gameId)) {
    throw new Error("Tutorial recovery record has an invalid game ID.");
  }
  requireExactKeys(
    input,
    [
      "schemaVersion",
      "gameId",
      "worldId",
      "run",
      "evidenceOrigin",
      "evidenceStatus",
      "storyProgressEligible",
      "evidenceLabel",
      "evidenceSha256",
      "recoverySha256",
      "evidence",
    ],
    `${gameId} tutorial recovery`,
  );
  if (
    input["schemaVersion"] !== TUTORIAL_RECOVERY_SCHEMA_VERSION ||
    input["worldId"] !== WORLD_ID_BY_GAME[gameId]
  ) {
    throw new Error(`${gameId} tutorial recovery identity is invalid.`);
  }
  const run = validateStoredRun(input["run"]);
  requireMatchingStoryRun(gameId, run);
  const evidenceLabel = input["evidenceLabel"];
  const evidenceSha256 = input["evidenceSha256"];
  const recoverySha256 = input["recoverySha256"];
  if (
    input["evidenceOrigin"] !== "completed-story-run" ||
    input["evidenceStatus"] !== "validated-run" ||
    input["storyProgressEligible"] !== true ||
    evidenceLabel !== EVIDENCE_LABEL_BY_GAME[gameId] ||
    typeof evidenceSha256 !== "string" ||
    !SHA256_PATTERN.test(evidenceSha256) ||
    typeof recoverySha256 !== "string" ||
    !SHA256_PATTERN.test(recoverySha256)
  ) {
    throw new Error(`${gameId} tutorial recovery provenance is invalid.`);
  }
  const evidence = cloneJson(input["evidence"]);
  const actualEvidenceHash = sha256CanonicalJsonSync(evidence);
  if (actualEvidenceHash !== evidenceSha256) {
    throw new Error(`${gameId} tutorial recovery evidence hash changed.`);
  }
  validateEvidenceShape(gameId, run, evidence);
  validateInstalledRecoveryAuthority(gameId, run, evidence);
  const unsigned = {
    schemaVersion: TUTORIAL_RECOVERY_SCHEMA_VERSION,
    gameId,
    worldId: WORLD_ID_BY_GAME[gameId],
    run,
    evidenceOrigin: "completed-story-run" as const,
    evidenceStatus: "validated-run" as const,
    storyProgressEligible: true as const,
    evidenceLabel,
    evidenceSha256,
    evidence,
  };
  if (sha256CanonicalJsonSync(unsigned) !== recoverySha256) {
    throw new Error(`${gameId} tutorial recovery identity hash changed.`);
  }
  return deepFreeze({ ...unsigned, recoverySha256 }) as TutorialRecoveryRecord;
}

/**
 * Anchors persisted recovery evidence to the exact installed cabinet packs.
 * Content-addressing a caller-provided object proves only self-consistency;
 * this check rejects records rebuilt around an arbitrary but well-formed pack.
 */
export function validateInstalledRecoveryAuthority(
  gameId: GameId,
  run: RunContext,
  evidence: unknown,
): void {
  if (gameId === "qong") return;
  if (!isRecord(evidence) || run.packSelection !== null) {
    throw new Error(
      `${gameId} recovery is not anchored to installed authority.`,
    );
  }
  if (gameId === "skipixl") {
    const pack = findInstalledSkiPixlPack(
      run.pack.packId,
      run.pack.contentSha256,
    );
    if (!pack || !runMatchesPack(run, pack)) {
      throw new Error("SkiPixl recovery pack is not installed.");
    }
    const designer = createSkiPixlDesignerEvidence(pack);
    const grids = designer.segments.map((rows, gridIndex) => {
      const row = rows[2];
      if (!row) throw new Error("Installed SkiPixl evidence row is missing.");
      const reading = row.selectedHazards.reduce(
        (strongest, hazard) =>
          strongest === null ||
          hazard.absoluteResidual > strongest.absoluteResidual
            ? hazard
            : strongest,
        null as (typeof row.selectedHazards)[number] | null,
      );
      const obstacle = pack.payload.obstacles.find(
        (candidate) => candidate.obstacleId === reading?.obstacleId,
      );
      if (!reading || !obstacle) {
        throw new Error("Installed SkiPixl evidence obstacle is missing.");
      }
      return { gridIndex, segmentId: row.segmentId, row, reading, obstacle };
    });
    requireCanonicalMatch(
      evidence,
      {
        packId: pack.packId,
        decoderVersion: designer.decoderVersion,
        grids,
      },
      "SkiPixl recovery evidence is not derived from its installed pack.",
    );
    return;
  }
  if (gameId === "fluxball") {
    const pack = FLUXBALL_PLAYABLE_RULE_BANK;
    if (!runMatchesPack(run, pack)) {
      throw new Error("Fluxball recovery pack is not installed.");
    }
    const session = new FluxballSession(run, {
      competitorCount: 4,
      ruleMode: "individual",
      roundSeconds: 60,
      humanPlayerIds: ["A"],
    });
    let snapshot = session.snapshot();
    const neutralInput = Object.freeze({ players: {} });
    for (let round = 0; round < 4; round += 1) {
      while (snapshot.phase === "active") snapshot = session.step(neutralInput);
      snapshot = session.continueAfterReveal();
    }
    const designer = createFluxballDesignerEvidence(pack, snapshot);
    requireCanonicalMatch(
      evidence,
      {
        packId: pack.packId,
        fixtureId: designer.fixtureId,
        players: designer.activePlayerIds,
        relationships: designer.axes,
      },
      "Fluxball recovery evidence is not derived from its installed pack.",
    );
    return;
  }
  const pack = QUANTMAN_CONTROL_PACK;
  if (!runMatchesPack(run, pack)) {
    throw new Error("Quantman recovery pack is not installed.");
  }
  validateInstalledQuantmanEvidence(evidence, pack.payload, run);
}

function runMatchesPack(
  run: RunContext,
  pack: Pick<
    CommittedPack<unknown>,
    | "gameId"
    | "packId"
    | "contentSha256"
    | "schemaVersion"
    | "source"
    | "rulesVersion"
  >,
): boolean {
  const rulesMatch =
    run.rulesVersion === pack.rulesVersion ||
    (pack.gameId === "fluxball" &&
      (run.rulesVersion === FLUXBALL_PREVIOUS_RULES_VERSION ||
        run.rulesVersion === FLUXBALL_LEGACY_RULES_VERSION ||
        run.rulesVersion === FLUXBALL_OLDER_RULES_VERSION ||
        run.rulesVersion === FLUXBALL_OLDEST_RULES_VERSION));
  return (
    rulesMatch &&
    canonicalJson(run.pack) ===
      canonicalJson({
        packId: pack.packId,
        contentSha256: pack.contentSha256,
        schemaVersion: pack.schemaVersion,
        source: pack.source,
      })
  );
}

function requireCanonicalMatch(
  actual: unknown,
  expected: unknown,
  message: string,
): void {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(message);
  }
}

function validateInstalledQuantmanEvidence(
  evidence: unknown,
  payload: QuantmanPackPayload,
  run: RunContext,
): void {
  const value = requireRecord(evidence, "Quantman installed evidence");
  const fixture = payload.labyrinthEnsemble;
  const doors = requireArrayLength(
    value["doors"],
    1,
    3,
    "Quantman installed observations",
  );
  if (
    value["packId"] !== QUANTMAN_CONTROL_PACK.packId ||
    value["fixtureId"] !== fixture.fixtureId ||
    value["rawResultSha256"] !== fixture.acquisition.rawResultSha256 ||
    value["observationsUsed"] !== doors.length
  ) {
    throw new Error("Quantman recovery provenance is not installed.");
  }

  const installedDoorIds = new Set(
    payload.topologyDoors.map((door) => door.doorId),
  );
  const installedPursuerIds = new Set(
    payload.pursuers.map((pursuer) => pursuer.pursuerId),
  );
  let previousResponseTick = 0;
  doors.forEach((candidate, index) => {
    const observation = requireRecord(
      candidate,
      `Quantman installed observation ${index + 1}`,
    );
    const heldDoor = payload.topologyDoors.find(
      (door) => door.doorId === observation["doorId"],
    );
    const before = fixture.states.find(
      (state) => state.stateId === observation["beforeStateId"],
    );
    const after = fixture.states.find(
      (state) => state.stateId === observation["afterStateId"],
    );
    if (!heldDoor || !before || !after || before.stateId === after.stateId) {
      throw new Error(
        `Quantman observation ${index + 1} is not in the installed ensemble.`,
      );
    }
    const changedDoorIds = changedQuantmanDoorIds(
      payload.topologyDoors,
      before,
      after,
    );
    const traversedDoorIds = observation[
      "traversedDoorIds"
    ] as readonly string[];
    const changedDoorOpenedAndTraversed = traversedDoorIds.some((doorId) => {
      if (!changedDoorIds.includes(doorId)) return false;
      const door = payload.topologyDoors.find(
        (candidateDoor) => candidateDoor.doorId === doorId,
      );
      return (
        door !== undefined &&
        !quantmanDoorIsOpen(before, door) &&
        quantmanDoorIsOpen(after, door)
      );
    });
    if (
      observation["observationIndex"] !== index + 1 ||
      canonicalJson(observation["sourceRooms"]) !==
        canonicalJson(heldDoor.sourceRooms) ||
      observation["beforeBitstring"] !== before.bitstring ||
      observation["afterBitstring"] !== after.bitstring ||
      observation["beforeDoorOpen"] !== quantmanDoorIsOpen(before, heldDoor) ||
      observation["afterDoorOpen"] !== quantmanDoorIsOpen(after, heldDoor) ||
      canonicalJson(observation["changedDoorIds"]) !==
        canonicalJson(changedDoorIds) ||
      changedDoorIds.includes(heldDoor.doorId) ||
      traversedDoorIds.some((doorId) => !installedDoorIds.has(doorId)) ||
      (observation["exploited"] === true && !changedDoorOpenedAndTraversed)
    ) {
      throw new Error(
        `Quantman observation ${index + 1} is not derived from installed topology.`,
      );
    }
    validateQuantmanCompatibleStateCount(
      observation,
      payload,
      run,
      before,
      after,
      heldDoor.doorId,
      index + 1,
    );
    const beforeRows = quantmanTopologyRows(payload, before);
    const afterRows = quantmanTopologyRows(payload, after);
    const responses = requireArrayLength(
      observation["pursuerResponses"],
      payload.pursuers.length,
      payload.pursuers.length,
      `Quantman observation ${index + 1} pursuer responses`,
    );
    let observationResponseTick: number | null = null;
    responses.forEach((responseCandidate, responseIndex) => {
      const responseTick = validateInstalledQuantmanPursuerResponse(
        responseCandidate,
        payload,
        beforeRows,
        afterRows,
        after.stateId,
        index + 1,
        responseIndex,
        installedPursuerIds,
      );
      if (
        (observationResponseTick !== null &&
          responseTick !== observationResponseTick) ||
        responseTick <= previousResponseTick
      ) {
        throw new Error(
          `Quantman observation ${index + 1} pursuer response tick is not run-derived.`,
        );
      }
      observationResponseTick ??= responseTick;
    });
    previousResponseTick = observationResponseTick!;
  });
}

function validateQuantmanCompatibleStateCount(
  observation: Record<string, unknown>,
  payload: QuantmanPackPayload,
  run: RunContext,
  before: QuantmanLabyrinthState,
  after: QuantmanLabyrinthState,
  heldDoorId: string,
  observationIndex: number,
): void {
  const expectedCount = observation["compatibleStateCount"];
  const changedDoorIds = new Set(
    changedQuantmanDoorIds(payload.topologyDoors, before, after),
  );
  const optionallyPinned = payload.topologyDoors.filter(
    (door) => door.doorId !== heldDoorId && !changedDoorIds.has(door.doorId),
  );
  const subsetCount = 2 ** optionallyPinned.length;
  for (let mask = 0; mask < subsetCount; mask += 1) {
    const pinned = new Set<string>([heldDoorId]);
    optionallyPinned.forEach((door, bit) => {
      if ((mask & (2 ** bit)) !== 0) pinned.add(door.doorId);
    });
    const candidates = payload.labyrinthEnsemble.states.filter(
      (candidate) =>
        candidate.stateId !== before.stateId &&
        payload.topologyDoors.every(
          (door) =>
            !pinned.has(door.doorId) ||
            quantmanDoorIsOpen(candidate, door) ===
              quantmanDoorIsOpen(before, door),
        ),
    );
    if (candidates.length !== expectedCount || candidates.length === 0) {
      continue;
    }
    const scored = candidates.map((state) => ({
      state,
      changedDoorIds: changedQuantmanDoorIds(
        payload.topologyDoors,
        before,
        state,
      ),
    }));
    const maximumChange = Math.max(
      ...scored.map((candidate) => candidate.changedDoorIds.length),
    );
    const materiallyDifferent = scored.filter(
      (candidate) => candidate.changedDoorIds.length === maximumChange,
    );
    const selectedIndex =
      deriveSeed(run.runSeed, `quantman:observation:${observationIndex - 1}`) %
      materiallyDifferent.length;
    if (materiallyDifferent[selectedIndex]?.state.stateId === after.stateId) {
      return;
    }
  }
  throw new Error(
    `Quantman observation ${observationIndex} compatible-state count is not derived from its installed ensemble and run.`,
  );
}

function validateInstalledQuantmanPursuerResponse(
  candidate: unknown,
  payload: QuantmanPackPayload,
  beforeRows: readonly string[],
  afterRows: readonly string[],
  afterStateId: string,
  observationIndex: number,
  responseIndex: number,
  installedPursuerIds: ReadonlySet<string>,
): number {
  const response = requireRecord(
    candidate,
    `Quantman observation ${observationIndex} pursuer response ${responseIndex + 1}`,
  );
  const pursuer = payload.pursuers[responseIndex];
  const pursuerId = response["pursuerId"];
  const tick = response["tick"];
  const mode = response["mode"] as QuantmanPursuerMode;
  const ownCell = validateQuantmanCell(response["ownCell"], "own cell");
  const previousNextCell = validateQuantmanCell(
    response["previousNextCell"],
    "previous next cell",
  );
  const nextCell = validateQuantmanCell(response["nextCell"], "next cell");
  const targetCell = validateQuantmanCell(
    response["targetCell"],
    "target cell",
  );
  if (
    !pursuer ||
    response["observationIndex"] !== observationIndex ||
    !isPositiveSafeInteger(tick) ||
    Number(tick) > payload.timeLimitSeconds * 60 ||
    response["topologyStateId"] !== afterStateId ||
    pursuerId !== pursuer.pursuerId ||
    typeof pursuerId !== "string" ||
    !installedPursuerIds.has(pursuerId) ||
    !cellIsWalkable(afterRows, ownCell) ||
    !cellIsWalkable(beforeRows, previousNextCell) ||
    !cellIsWalkable(afterRows, nextCell) ||
    !cellIsWithinRows(afterRows, targetCell) ||
    cellDistance(ownCell, previousNextCell) > 1 ||
    cellDistance(ownCell, nextCell) > 1
  ) {
    throw new Error(
      `Quantman observation ${observationIndex} pursuer response ${responseIndex + 1} is not run-derived.`,
    );
  }
  if (mode === "hesitate") {
    if (!sameCell(ownCell, nextCell) || !sameCell(ownCell, targetCell)) {
      throw new Error(
        `Quantman observation ${observationIndex} pursuer hesitation is inconsistent.`,
      );
    }
  } else {
    if (mode === "chase" && !cellIsWalkable(afterRows, targetCell)) {
      throw new Error(
        `Quantman observation ${observationIndex} chase target is blocked.`,
      );
    }
    if (
      mode === "patrol" &&
      !pursuer.patrol.some((cell) => sameCell(cell, targetCell))
    ) {
      throw new Error(
        `Quantman observation ${observationIndex} patrol target is not installed.`,
      );
    }
    if (!sameCell(firstPathStep(afterRows, ownCell, targetCell), nextCell)) {
      throw new Error(
        `Quantman observation ${observationIndex} pursuer route is inconsistent.`,
      );
    }
  }
  return Number(tick);
}

/** Kept as a named entry point for callers that predate save v3. */
export const validateTutorialRecoveryRecordShape =
  validateTutorialRecoveryRecord;

export function validateTutorialRecoveryRecords(
  input: unknown,
): TutorialRecoveryRecords {
  if (!isRecord(input)) {
    throw new Error("Quantum Box tutorial recovery records are invalid.");
  }
  const output: Partial<Record<GameId, TutorialRecoveryRecord>> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!isGameId(key) || value === null) {
      throw new Error("Quantum Box tutorial recovery records are invalid.");
    }
    const record = validateTutorialRecoveryRecord(value);
    if (record.gameId !== key) {
      throw new Error("Tutorial recovery record key does not match its game.");
    }
    output[key] = record;
  }
  return deepFreeze(output) as TutorialRecoveryRecords;
}

export function tutorialRecoveryCanonicalMaterial(
  record: TutorialRecoveryRecord,
): string {
  return canonicalJson({
    schemaVersion: record.schemaVersion,
    gameId: record.gameId,
    worldId: record.worldId,
    run: record.run,
    evidenceOrigin: record.evidenceOrigin,
    evidenceStatus: record.evidenceStatus,
    storyProgressEligible: record.storyProgressEligible,
    evidenceLabel: record.evidenceLabel,
    evidenceSha256: record.evidenceSha256,
    evidence: record.evidence,
  });
}

export function sha256CanonicalJsonSync(value: unknown): string {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const bitLength = BigInt(bytes.length) * 8n;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Number(bitLength >> 32n), false);
  view.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn), false);

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 =
        rotateRight(words[index - 15]!, 7) ^
        rotateRight(words[index - 15]!, 18) ^
        (words[index - 15]! >>> 3);
      const s1 =
        rotateRight(words[index - 2]!, 17) ^
        rotateRight(words[index - 2]!, 19) ^
        (words[index - 2]! >>> 10);
      words[index] = (words[index - 16]! + s0 + words[index - 7]! + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = state;
    for (let index = 0; index < 64; index += 1) {
      const sum1 =
        rotateRight(e!, 6) ^ rotateRight(e!, 11) ^ rotateRight(e!, 25);
      const choice = (e! & f!) ^ (~e! & g!);
      const temp1 =
        (h! + sum1 + choice + SHA256_CONSTANTS[index]! + words[index]!) >>> 0;
      const sum0 =
        rotateRight(a!, 2) ^ rotateRight(a!, 13) ^ rotateRight(a!, 22);
      const majority = (a! & b!) ^ (a! & c!) ^ (b! & c!);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d! + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    state[0] = (state[0]! + a!) >>> 0;
    state[1] = (state[1]! + b!) >>> 0;
    state[2] = (state[2]! + c!) >>> 0;
    state[3] = (state[3]! + d!) >>> 0;
    state[4] = (state[4]! + e!) >>> 0;
    state[5] = (state[5]! + f!) >>> 0;
    state[6] = (state[6]! + g!) >>> 0;
    state[7] = (state[7]! + h!) >>> 0;
  }
  return [...state].map((word) => word.toString(16).padStart(8, "0")).join("");
}

function validateStoredRun(input: unknown): RunContext {
  if (!isRecord(input) || !isRecord(input["pack"])) {
    throw new Error("Tutorial recovery run identity is incomplete.");
  }
  const pack = input["pack"];
  const rebuilt = createRunContext({
    gameId: input["gameId"] as GameId,
    storyStage: input["storyStage"] as RunContext["storyStage"],
    playMode: input["playMode"] as RunContext["playMode"],
    rulesVersion: input["rulesVersion"] as string,
    runSeed: input["runSeed"] as number,
    pack: {
      packId: pack["packId"] as string,
      contentSha256: pack["contentSha256"] as string,
      schemaVersion: pack["schemaVersion"] as string,
      source: pack["source"] as string,
    },
    packSelection:
      (input["packSelection"] as RunContext["packSelection"]) ?? null,
  });
  if (
    typeof input["runId"] !== "string" ||
    rebuilt.runId !== input["runId"] ||
    canonicalJson(rebuilt) !== canonicalJson(input)
  ) {
    throw new Error("Tutorial recovery run identity changed.");
  }
  if (rebuilt.gameId === "qong") {
    validateQongSelectionReceipt(rebuilt.packSelection);
  }
  return rebuilt;
}

function requireMatchingStoryRun(gameId: GameId, run: RunContext): void {
  if (
    run.gameId !== gameId ||
    run.playMode !== "story" ||
    run.storyStage !== STORY_STAGE_BY_GAME[gameId] ||
    run.pack.source !== SOURCE_BY_GAME[gameId]
  ) {
    throw new Error(
      `${gameId} recovery lacks matching completed Story authority.`,
    );
  }
}

function validateEvidenceShape(
  gameId: GameId,
  run: RunContext,
  value: unknown,
): void {
  if (!isRecord(value) || value["packId"] !== run.pack.packId) {
    throw new Error(`${gameId} recovery evidence does not match its run pack.`);
  }
  switch (gameId) {
    case "qong":
      validateQongEvidence(run, value);
      break;
    case "skipixl":
      validateSkiPixlEvidence(value);
      break;
    case "fluxball":
      validateFluxballEvidence(value);
      break;
    case "quantman":
      validateQuantmanEvidence(value);
      break;
  }
}

function validateQongEvidence(
  run: RunContext,
  value: Record<string, unknown>,
): void {
  requireExactKeys(value, ["packId", "result", "selection"], "Qong evidence");
  const result = requireRecord(value["result"], "Qong recorded result");
  const selection = requireRecord(value["selection"], "Qong selector evidence");
  requireExactKeys(
    result,
    [
      "rallyId",
      "outcome",
      "bit",
      "rule",
      "mothJobId",
      "hardwareJobId",
      "backendName",
      "shots",
      "heads",
      "tails",
    ],
    "Qong recorded result",
  );
  requireExactKeys(
    selection,
    [
      "bits",
      "bitIndices",
      "selectedPackIndex",
      "selectedPackId",
      "selectorPackId",
    ],
    "Qong selector evidence",
  );
  const outcome = result["outcome"];
  const expectedBit = outcome === "heads" ? 0 : outcome === "tails" ? 1 : null;
  const expectedRule =
    outcome === "heads" ? "direct" : outcome === "tails" ? "invert" : null;
  const shots = result["shots"];
  const heads = result["heads"];
  const tails = result["tails"];
  const receipt = run.packSelection;
  if (
    receipt === null ||
    selection["selectedPackId"] !== run.pack.packId ||
    selection["selectedPackId"] !== receipt.selectedPackId ||
    selection["selectorPackId"] !== receipt.selectorPackId ||
    canonicalJson(selection["bits"]) !== canonicalJson(receipt.selectorBits) ||
    canonicalJson(selection["bitIndices"]) !==
      canonicalJson(receipt.selectorBitIndices) ||
    selection["selectedPackIndex"] !== receipt.selectedPackIndex ||
    expectedBit === null ||
    result["bit"] !== expectedBit ||
    result["rule"] !== expectedRule ||
    !isPositiveSafeInteger(shots) ||
    !isNonNegativeSafeInteger(heads) ||
    !isNonNegativeSafeInteger(tails) ||
    Number(heads) + Number(tails) !== Number(shots)
  ) {
    throw new Error("Qong recovery evidence is inconsistent with its run.");
  }
  for (const key of [
    "rallyId",
    "mothJobId",
    "hardwareJobId",
    "backendName",
  ] as const) {
    if (typeof result[key] !== "string" || result[key].trim().length === 0) {
      throw new Error(`Qong recovery ${key} is missing.`);
    }
  }
}

function validateSkiPixlEvidence(value: Record<string, unknown>): void {
  requireExactKeys(
    value,
    ["packId", "decoderVersion", "grids"],
    "SkiPixl evidence",
  );
  if (
    typeof value["decoderVersion"] !== "string" ||
    value["decoderVersion"].trim().length === 0
  ) {
    throw new Error("SkiPixl recovery decoder is missing.");
  }
  const grids = requireArrayLength(value["grids"], 3, 3, "SkiPixl QPixl grids");
  grids.forEach((candidate, index) => {
    const grid = requireRecord(candidate, `SkiPixl grid ${index + 1}`);
    requireExactKeys(
      grid,
      ["gridIndex", "segmentId", "row", "reading", "obstacle"],
      `SkiPixl grid ${index + 1}`,
    );
    const row = requireRecord(grid["row"], `SkiPixl grid ${index + 1} row`);
    const reading = requireRecord(
      grid["reading"],
      `SkiPixl grid ${index + 1} reading`,
    );
    const obstacle = requireRecord(
      grid["obstacle"],
      `SkiPixl grid ${index + 1} obstacle`,
    );
    requireExactKeys(
      row,
      [
        "segmentOrder",
        "segmentId",
        "localRow",
        "courseRow",
        "selectionThreshold",
        "selectedHazards",
      ],
      `SkiPixl grid ${index + 1} row`,
    );
    const legacyHazardKeys = [
      "obstacleId",
      "column",
      "cellIndex",
      "sourceByte",
      "sourceValue",
      "returnedValue",
      "residual",
      "absoluteResidual",
      "kind",
    ];
    const hazardKeys =
      value["decoderVersion"] === "skipixl-triplet-residual-cuts-v4" ||
      value["decoderVersion"] === "skipixl-triplet-residual-slalom-v5" ||
      value["decoderVersion"] === "skipixl-triplet-residual-slalom-v6" ||
      value["decoderVersion"] === "skipixl-triplet-residual-slalom-v7" ||
      value["decoderVersion"] === "skipixl-triplet-residual-slalom-v8"
        ? [
            ...legacyHazardKeys,
            "x",
            "distance",
            "horizontalOffset",
            "downhillOffset",
            "offsetSourceCellIndexes",
          ]
        : legacyHazardKeys;
    requireExactKeys(reading, hazardKeys, `SkiPixl grid ${index + 1} reading`);
    const selectedHazards = requireArrayLength(
      row["selectedHazards"],
      1,
      20,
      `SkiPixl grid ${index + 1} selected hazards`,
    );
    selectedHazards.forEach((hazard, hazardIndex) =>
      requireExactKeys(
        requireRecord(
          hazard,
          `SkiPixl grid ${index + 1} hazard ${hazardIndex + 1}`,
        ),
        hazardKeys,
        `SkiPixl grid ${index + 1} hazard ${hazardIndex + 1}`,
      ),
    );
    const legacyObstacleKeys = [
      "obstacleId",
      "row",
      "distance",
      "column",
      "x",
      "kind",
      "segmentId",
      "cellIndex",
      "residual",
      "absoluteResidual",
      "rowHazardIndex",
      "rowHazardCount",
    ];
    requireExactKeys(
      obstacle,
      value["decoderVersion"] === "skipixl-triplet-residual-cuts-v4" ||
        value["decoderVersion"] === "skipixl-triplet-residual-slalom-v5" ||
        value["decoderVersion"] === "skipixl-triplet-residual-slalom-v6" ||
        value["decoderVersion"] === "skipixl-triplet-residual-slalom-v7" ||
        value["decoderVersion"] === "skipixl-triplet-residual-slalom-v8"
        ? [
            ...legacyObstacleKeys,
            "baseDistance",
            "downhillOffset",
            "baseX",
            "horizontalOffset",
            "offsetSourceCellIndexes",
          ]
        : legacyObstacleKeys,
      `SkiPixl grid ${index + 1} obstacle`,
    );
    const numeric = [
      "sourceByte",
      "sourceValue",
      "returnedValue",
      "residual",
      "absoluteResidual",
    ] as const;
    const sourceByte = reading["sourceByte"];
    const obstacleId = obstacle["obstacleId"];
    const kind = reading["kind"];
    if (
      grid["gridIndex"] !== index ||
      row["segmentOrder"] !== index ||
      typeof grid["segmentId"] !== "string" ||
      grid["segmentId"].trim().length === 0 ||
      grid["segmentId"] !== row["segmentId"] ||
      grid["segmentId"] !== obstacle["segmentId"] ||
      row["courseRow"] !== obstacle["row"] ||
      reading["obstacleId"] !== obstacle["obstacleId"] ||
      reading["column"] !== obstacle["column"] ||
      reading["cellIndex"] !== obstacle["cellIndex"] ||
      reading["kind"] !== obstacle["kind"] ||
      (kind !== "tree" && kind !== "rock") ||
      typeof obstacleId !== "string" ||
      obstacleId.trim().length === 0 ||
      ![
        row["localRow"],
        row["courseRow"],
        reading["column"],
        reading["cellIndex"],
        obstacle["row"],
        obstacle["column"],
        obstacle["cellIndex"],
        obstacle["rowHazardIndex"],
        obstacle["rowHazardCount"],
      ].every(isNonNegativeSafeInteger) ||
      typeof row["selectionThreshold"] !== "number" ||
      !Number.isFinite(row["selectionThreshold"]) ||
      Number(row["selectionThreshold"]) <= 0 ||
      typeof obstacle["distance"] !== "number" ||
      !Number.isFinite(obstacle["distance"]) ||
      typeof obstacle["x"] !== "number" ||
      !Number.isFinite(obstacle["x"]) ||
      !numeric.every(
        (key) =>
          typeof reading[key] === "number" && Number.isFinite(reading[key]),
      ) ||
      !Number.isSafeInteger(sourceByte) ||
      Number(sourceByte) < 0 ||
      Number(sourceByte) > 255 ||
      Math.abs(Number(reading["sourceValue"]) - Number(sourceByte) / 255) >
        1e-12 ||
      Math.abs(
        Number(reading["residual"]) -
          (Number(reading["returnedValue"]) - Number(reading["sourceValue"])),
      ) > 1e-12 ||
      Math.abs(
        Number(reading["absoluteResidual"]) -
          Math.abs(Number(reading["residual"])),
      ) > 1e-12 ||
      Number(reading["absoluteResidual"]) < Number(row["selectionThreshold"]) ||
      obstacle["rowHazardCount"] !== selectedHazards.length ||
      !selectedHazards.some(
        (hazard) =>
          isRecord(hazard) && hazard["obstacleId"] === reading["obstacleId"],
      )
    ) {
      throw new Error(`SkiPixl grid ${index + 1} is inconsistent.`);
    }
  });
}

function validateFluxballEvidence(value: Record<string, unknown>): void {
  requireExactKeys(
    value,
    ["packId", "fixtureId", "players", "relationships"],
    "Fluxball evidence",
  );
  if (
    typeof value["packId"] !== "string" ||
    value["packId"].trim().length === 0 ||
    typeof value["fixtureId"] !== "string" ||
    value["fixtureId"].trim().length === 0
  ) {
    throw new Error("Fluxball recovery fixture is missing.");
  }
  const players = requireArrayLength(
    value["players"],
    4,
    4,
    "Fluxball players",
  );
  if (
    new Set(players).size !== players.length ||
    [...players].sort().join(":") !== "A:B:C:D"
  ) {
    throw new Error("Fluxball recovery players are invalid.");
  }
  const relationships = requireArrayLength(
    value["relationships"],
    3,
    3,
    "Fluxball QGraph relationships",
  );
  const expected = [
    ["X", "ACTION", 0],
    ["Y", "INTERACTION", 1],
    ["Z", "PURPOSE", 2],
  ] as const;
  relationships.forEach((candidate, index) => {
    const relationship = requireRecord(
      candidate,
      `Fluxball relationship ${index + 1}`,
    );
    requireExactKeys(
      relationship,
      ["context", "dimension", "outcome", "signs", "rules", "drawIndex"],
      `Fluxball relationship ${index + 1}`,
    );
    const signs = requireRecord(relationship["signs"], "Fluxball signs");
    const rules = requireRecord(relationship["rules"], "Fluxball rules");
    const identity = expected[index]!;
    if (
      relationship["context"] !== identity[0] ||
      relationship["dimension"] !== identity[1] ||
      relationship["drawIndex"] !== identity[2] ||
      typeof relationship["outcome"] !== "string" ||
      relationship["outcome"].trim().length === 0 ||
      Object.keys(signs).sort().join(":") !== [...players].sort().join(":") ||
      Object.keys(rules).sort().join(":") !== [...players].sort().join(":") ||
      players.some(
        (player) =>
          (signs[String(player)] !== "+" && signs[String(player)] !== "-") ||
          typeof rules[String(player)] !== "string" ||
          String(rules[String(player)]).trim().length === 0,
      )
    ) {
      throw new Error(`Fluxball relationship ${index + 1} is invalid.`);
    }
  });
}

function validateQuantmanEvidence(value: Record<string, unknown>): void {
  requireExactKeys(
    value,
    ["packId", "fixtureId", "rawResultSha256", "observationsUsed", "doors"],
    "Quantman evidence",
  );
  if (
    typeof value["fixtureId"] !== "string" ||
    value["fixtureId"].trim().length === 0 ||
    typeof value["rawResultSha256"] !== "string" ||
    !SHA256_PATTERN.test(value["rawResultSha256"]) ||
    !isPositiveSafeInteger(value["observationsUsed"])
  ) {
    throw new Error("Quantman recovery provenance is invalid.");
  }
  const doors = requireArrayLength(
    value["doors"],
    1,
    3,
    "Quantman played observations",
  );
  if (value["observationsUsed"] !== doors.length) {
    throw new Error("Quantman recovery observation count is inconsistent.");
  }
  let exploited = false;
  doors.forEach((candidate, index) => {
    const door = requireRecord(candidate, `Quantman observation ${index + 1}`);
    requireExactKeys(
      door,
      [
        "observationIndex",
        "doorId",
        "sourceRooms",
        "beforeStateId",
        "beforeBitstring",
        "beforeDoorOpen",
        "afterStateId",
        "afterBitstring",
        "afterDoorOpen",
        "changedDoorIds",
        "compatibleStateCount",
        "traversedDoorIds",
        "pursuerResponses",
        "exploited",
      ],
      `Quantman observation ${index + 1}`,
    );
    const sourceRooms = requireArrayLength(
      door["sourceRooms"],
      2,
      2,
      "Quantman source rooms",
    );
    const changed = requireArrayLength(
      door["changedDoorIds"],
      1,
      Number.MAX_SAFE_INTEGER,
      "Quantman changed doors",
    );
    const traversed = Array.isArray(door["traversedDoorIds"])
      ? door["traversedDoorIds"]
      : null;
    const responses = requireArrayLength(
      door["pursuerResponses"],
      1,
      Number.MAX_SAFE_INTEGER,
      `Quantman observation ${index + 1} pursuer responses`,
    );
    const heldDoorId = door["doorId"];
    if (
      door["observationIndex"] !== index + 1 ||
      typeof heldDoorId !== "string" ||
      heldDoorId.length === 0 ||
      sourceRooms.some((room) => !isNonNegativeSafeInteger(room)) ||
      typeof door["beforeStateId"] !== "string" ||
      typeof door["afterStateId"] !== "string" ||
      door["beforeStateId"] === door["afterStateId"] ||
      typeof door["beforeBitstring"] !== "string" ||
      typeof door["afterBitstring"] !== "string" ||
      typeof door["beforeDoorOpen"] !== "boolean" ||
      door["afterDoorOpen"] !== door["beforeDoorOpen"] ||
      changed.includes(heldDoorId) ||
      !isPositiveSafeInteger(door["compatibleStateCount"]) ||
      traversed === null ||
      traversed.some(
        (entry) => typeof entry !== "string" || entry.trim().length === 0,
      ) ||
      typeof door["exploited"] !== "boolean" ||
      door["exploited"] !== traversed.length > 0
    ) {
      throw new Error(`Quantman observation ${index + 1} is invalid.`);
    }
    const responseIds = new Set<string>();
    let responseTick: number | null = null;
    responses.forEach((candidateResponse, responseIndex) => {
      const response = requireRecord(
        candidateResponse,
        `Quantman observation ${index + 1} pursuer response ${responseIndex + 1}`,
      );
      requireExactKeys(
        response,
        [
          "observationIndex",
          "tick",
          "topologyStateId",
          "pursuerId",
          "ownCell",
          "previousNextCell",
          "nextCell",
          "targetCell",
          "mode",
        ],
        `Quantman observation ${index + 1} pursuer response ${responseIndex + 1}`,
      );
      const pursuerId = response["pursuerId"];
      const tick = response["tick"];
      if (
        response["observationIndex"] !== index + 1 ||
        !isPositiveSafeInteger(tick) ||
        (responseTick !== null && responseTick !== tick) ||
        response["topologyStateId"] !== door["afterStateId"] ||
        typeof pursuerId !== "string" ||
        pursuerId.trim().length === 0 ||
        responseIds.has(pursuerId) ||
        !isQuantmanPursuerMode(response["mode"])
      ) {
        throw new Error(
          `Quantman observation ${index + 1} pursuer response ${responseIndex + 1} is invalid.`,
        );
      }
      validateQuantmanCell(response["ownCell"], "own cell");
      validateQuantmanCell(response["previousNextCell"], "previous next cell");
      validateQuantmanCell(response["nextCell"], "next cell");
      validateQuantmanCell(response["targetCell"], "target cell");
      responseIds.add(pursuerId);
      responseTick ??= Number(tick);
    });
    exploited ||= door["exploited"] === true;
  });
  if (!exploited) {
    throw new Error("Quantman recovery lacks an exploited played trace.");
  }
}

function validateQuantmanCell(value: unknown, label: string): QuantmanCell {
  const cell = requireRecord(value, `Quantman pursuer ${label}`);
  requireExactKeys(cell, ["row", "col"], `Quantman pursuer ${label}`);
  if (
    !isNonNegativeSafeInteger(cell["row"]) ||
    !isNonNegativeSafeInteger(cell["col"])
  ) {
    throw new Error(`Quantman pursuer ${label} is invalid.`);
  }
  return Object.freeze({ row: Number(cell["row"]), col: Number(cell["col"]) });
}

function isQuantmanPursuerMode(value: unknown): value is QuantmanPursuerMode {
  return (
    value === "patrol" ||
    value === "chase" ||
    value === "investigate" ||
    value === "hesitate"
  );
}

function cellIsWithinRows(
  rows: readonly string[],
  cell: QuantmanCell,
): boolean {
  return rows[cell.row]?.[cell.col] !== undefined;
}

function cellIsWalkable(rows: readonly string[], cell: QuantmanCell): boolean {
  return rows[cell.row]?.[cell.col] === ".";
}

function cellDistance(left: QuantmanCell, right: QuantmanCell): number {
  return Math.abs(left.row - right.row) + Math.abs(left.col - right.col);
}

function sameCell(left: QuantmanCell, right: QuantmanCell): boolean {
  return left.row === right.row && left.col === right.col;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} is missing.`);
  return value;
}

function requireExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
): void {
  if (Object.keys(value).sort().join(":") !== [...keys].sort().join(":")) {
    throw new Error(`${label} is not normalized.`);
  }
}

function requireArrayLength(
  value: unknown,
  minimum: number,
  maximum: number,
  label: string,
): readonly unknown[] {
  if (
    !Array.isArray(value) ||
    value.length < minimum ||
    value.length > maximum
  ) {
    throw new Error(`${label} are incomplete.`);
  }
  return value;
}

function isPositiveSafeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isNonNegativeSafeInteger(value: unknown): boolean {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isGameId(value: unknown): value is GameId {
  return typeof value === "string" && GAME_IDS.includes(value as GameId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function rotateRight(value: number, count: number): number {
  return (value >>> count) | (value << (32 - count));
}

const SHA256_CONSTANTS = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
