import type { RunContext } from "../core/run";
import { createRunContext } from "../core/run";
import { canonicalJson } from "../core/canonicalJson";
import { fluxballRulePackFor } from "../games/fluxball/fluxballControlPacks";
import type { FluxballFormat } from "../games/fluxball/types";
import type { StoryStageId } from "../games/registry";
import {
  selectQongStoryPack,
  type QongStoryPackBank,
  type QongStoryPackSelection,
} from "../games/qong/qongStoryPackBank";
import {
  findInstalledSkiPixlPack,
  type SkiPixlCommittedPack,
} from "../games/skipixl/SkiPixlCourseAdapter";
import type { SkiPixlSnapshot } from "../games/skipixl/types";
import { QUANTMAN_QPU_RULES_VERSION } from "../games/quantmanSynthetic";
import type { LabyrinthFixture } from "../games/quantmanSynthetic/labyrinth/types";
import type { QGraphCabinetPack } from "../games/qgraph/QGraphPack";
import { QUAG_RULES_VERSION } from "../games/quag/types";
import type { SaveRepository } from "../save/SaveRepository";
import type {
  QuantumBoxSave,
  SkiPixlStoryAttemptReceipt,
  SkiPixlStoryPassReceipt,
} from "../save/types";

/**
 * Application-level boundary between a finished SkiPixl simulation and the
 * persisted Story cut state. Keeping this outside the runtime prevents a
 * replay or an Arcade result from acquiring Story authority.
 */
export function persistSkiPixlStoryResult(
  repository: SaveRepository,
  context: RunContext,
  pack: SkiPixlCommittedPack,
  snapshot: Pick<
    SkiPixlSnapshot,
    "storyQualified" | "elapsedSeconds" | "collisions" | "gateResults"
  >,
): QuantumBoxSave {
  if (context.playMode !== "story") {
    throw new Error("Only a Story SkiPixl result can update cut progress.");
  }
  const stageId = context.storyStage;
  if (stageId !== "skipixl-feasible" && stageId !== "skipixl-overloaded") {
    throw new Error("SkiPixl Story result has no active SkiPixl stage.");
  }
  const receipt = pack.payload.receipt;
  if (
    (receipt.schemaVersion !== "skipixl-course-receipt-v7" &&
      receipt.schemaVersion !== "skipixl-course-receipt-v8" &&
      receipt.schemaVersion !== "skipixl-course-receipt-v9") ||
    pack.payload.cutId === undefined ||
    pack.payload.tripletId === undefined ||
    receipt.cutId !== pack.payload.cutId ||
    receipt.tripletId !== pack.payload.tripletId
  ) {
    throw new Error(
      "SkiPixl Story progress requires an exact v7, v8 or v9 cut receipt.",
    );
  }
  const passedGateCount = snapshot.gateResults.filter(
    ({ passed }) => passed,
  ).length;
  const attempt: SkiPixlStoryAttemptReceipt = Object.freeze({
    stageId,
    cutId: receipt.cutId,
    tripletId: receipt.tripletId,
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    runId: context.runId,
    qualified: snapshot.storyQualified,
    elapsedSeconds: snapshot.elapsedSeconds,
    collisionCount: snapshot.collisions.length,
    gateCount: snapshot.gateResults.length,
    passedGateCount,
    missedGateCount: snapshot.gateResults.length - passedGateCount,
    courseReceiptSchemaVersion: receipt.schemaVersion,
    bankId: receipt.bankId,
    bankContentSha256: receipt.bankContentSha256,
    decoderVersion: receipt.decoderVersion,
    segments: Object.freeze(
      receipt.segments.map((segment) =>
        Object.freeze({
          order: segment.order,
          segmentId: segment.segmentId,
          sourceSha256: segment.sourceSha256,
          returnedValuesSha256: segment.returnedValuesSha256,
          mothJobId: segment.mothJobId,
          ibmJobId: segment.ibmJobId,
        }),
      ),
    ),
  });
  if (!snapshot.storyQualified) {
    return repository.recordSkiPixlCutResult(context, {
      qualified: false,
      attempt,
    });
  }
  const pass: SkiPixlStoryPassReceipt = Object.freeze({
    cutId: receipt.cutId,
    tripletId: receipt.tripletId,
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    runId: context.runId,
    elapsedSeconds: snapshot.elapsedSeconds,
    collisionCount: snapshot.collisions.length,
  });
  return repository.recordSkiPixlCutResult(context, {
    qualified: true,
    pass,
    attempt,
  });
}

export function isInstalledFluxballStoryRun(
  savedRun: RunContext | null,
  stage: Extract<StoryStageId, "fluxball-global" | "fluxball-individual">,
  format: FluxballFormat,
): boolean {
  if (!savedRun) return false;
  const pack = fluxballRulePackFor(format.competitorCount);
  const expected = createRunContext({
    gameId: "fluxball",
    storyStage: stage,
    playMode: "story",
    rulesVersion: pack.rulesVersion,
    runSeed: savedRun.runSeed,
    pack: {
      packId: pack.packId,
      contentSha256: pack.contentSha256,
      schemaVersion: pack.schemaVersion,
      source: pack.source,
    },
  });
  return canonicalJson(expected) === canonicalJson(savedRun);
}

/**
 * Resolve a completed Qong stage exclusively from its persisted qualified run.
 * The selector is replayed against the installed bank, then the complete run
 * identity is reconstructed so an old selector cursor cannot substitute for
 * the pack and seed that actually qualified.
 */
export function resolveInstalledQongStoryRun(
  bank: QongStoryPackBank,
  savedRun: RunContext | null,
): QongStoryPackSelection | null {
  const receipt = savedRun?.packSelection;
  if (!savedRun || !receipt) return null;
  try {
    const selection = selectQongStoryPack(bank, {
      cursor: receipt.selectorCursorBefore,
      cycle: receipt.selectorCycle,
    });
    if (canonicalJson(selection.receipt) !== canonicalJson(receipt)) {
      return null;
    }
    const expected = createRunContext({
      gameId: "qong",
      storyStage: "qong",
      playMode: "story",
      rulesVersion: selection.pack.rulesVersion,
      runSeed: savedRun.runSeed,
      pack: packIdentity(selection.pack),
      packSelection: selection.receipt,
    });
    return exactRunMatches(expected, savedRun) ? selection : null;
  } catch {
    return null;
  }
}

/** Return the installed course only when it recreates the exact saved run. */
export function resolveInstalledSkiPixlStoryRun(
  savedRun: RunContext | null,
  stage: Extract<StoryStageId, "skipixl-feasible" | "skipixl-overloaded">,
): SkiPixlCommittedPack | null {
  if (!savedRun) return null;
  const pack = findInstalledSkiPixlPack(
    savedRun.pack.packId,
    savedRun.pack.contentSha256,
  );
  const expectedCut = stage === "skipixl-feasible" ? "P84" : "P78";
  if (!pack || pack.payload.cutId !== expectedCut) return null;
  const expected = createRunContext({
    gameId: "skipixl",
    storyStage: stage,
    playMode: "story",
    rulesVersion: pack.rulesVersion,
    runSeed: savedRun.runSeed,
    pack: packIdentity(pack),
  });
  return exactRunMatches(expected, savedRun) ? pack : null;
}

export function isInstalledQuantmanStoryRun(
  savedRun: RunContext | null,
  stage: Extract<StoryStageId, "quantman-hold">,
  fixture: LabyrinthFixture,
): boolean {
  if (!savedRun) return false;
  const expected = createRunContext({
    gameId: "quantman",
    storyStage: stage,
    playMode: "story",
    rulesVersion: QUANTMAN_QPU_RULES_VERSION,
    runSeed: savedRun.runSeed,
    pack: {
      packId: fixture.fixtureId,
      contentSha256: fixture.contentSha256,
      schemaVersion: fixture.schemaVersion,
      source: "moth-api-qpu",
    },
  });
  return exactRunMatches(expected, savedRun);
}

export function isInstalledQuarryStoryRun(
  savedRun: RunContext | null,
  pack: QGraphCabinetPack,
): boolean {
  if (!savedRun) return false;
  const expected = createRunContext({
    gameId: "quarry",
    storyStage: "quarry",
    playMode: "story",
    rulesVersion: QUAG_RULES_VERSION,
    runSeed: savedRun.runSeed,
    pack: {
      packId: pack.packId,
      contentSha256: pack.contentSha256,
      schemaVersion: pack.schemaVersion,
      source: pack.sourceClassification,
    },
  });
  return exactRunMatches(expected, savedRun);
}

export interface StoryRetryLaunch {
  readonly stage: StoryStageId;
  readonly replay: boolean;
}

/**
 * A RETRY is always a fresh interactive run. Completed-stage retries retain
 * replay authority, while an active Story attempt remains authoritative.
 */
export function resolveStoryRetryLaunch(
  context: RunContext,
  activeStoryReplay: boolean,
): StoryRetryLaunch | null {
  if (context.playMode !== "story" || context.storyStage === null) return null;
  if (!isCurrentStoryStage(context.storyStage)) return null;
  return Object.freeze({
    stage: context.storyStage,
    replay: activeStoryReplay,
  });
}

function isCurrentStoryStage(value: string): value is StoryStageId {
  return [
    "qong",
    "skipixl-feasible",
    "skipixl-overloaded",
    "quantman-hold",
    "fluxball-global",
    "fluxball-individual",
    "quarry",
  ].includes(value);
}

function exactRunMatches(expected: RunContext, saved: RunContext): boolean {
  return canonicalJson(expected) === canonicalJson(saved);
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
