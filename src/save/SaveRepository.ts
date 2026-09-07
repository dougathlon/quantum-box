import {
  createDefaultSave,
  SAVE_SCHEMA_VERSION,
  validateSave,
  type QuantumBoxSave,
  type QuantumBoxSettings,
  type PendingStoryNarrativeBeat,
  type StoryNarrativeBeatKind,
  type SkiPixlStoryAttemptReceipt,
  type SkiPixlStoryPassReceipt,
} from "./types";
import {
  createLegacyStoryV2PresentationEvidence,
  validateStoryV2PresentationEvidence,
  type StoryV2PresentationEvidence,
} from "../story/v2/evidence";
import { parseStoryV2ResumeToken } from "../story/v2/PresentationMachine";
import { storyV2PresentationFlow } from "../story/v2/flows";
import { storyV2Stage } from "../story/v2/registry";
import { STORY_V2_VERSION } from "../story/v2/types";
import type { RunContext } from "../core/run";
import { canonicalJson } from "../core/canonicalJson";
import {
  gameForStoryStage,
  nextStoryStage,
  type StoryStageId,
} from "../games/registry";
import {
  QongStoryBankUnavailableError,
  requireInstalledQongRecoveryReference,
  validateQongSelectionReceipt,
  type QongPackSelectionReceipt,
} from "../games/qong/qongStoryPackBank";
import {
  validateTutorialRecoveryRecord,
  type TutorialRecoveryRecord,
} from "../tutorials/recovery";
import {
  recordQuantmanArcadeResult,
  recordSkiPixlArcadeResult,
  type PendingQuantmanArcadeRecord,
  type PendingSkiPixlArcadeRecord,
} from "./ArcadeRecords";

export const SAVE_STORAGE_KEY = "quantum-box/save-v5";
export const PREVIOUS_SAVE_STORAGE_KEY = "quantum-box/save-v4";
export const LEGACY_SAVE_STORAGE_KEY = "quantum-box/save-v3";
export const EARLIEST_SAVE_STORAGE_KEY = "quantum-box/save-v2";
export const INITIAL_SAVE_STORAGE_KEY = "quantum-box/save-v1";
export const SAVE_EXPORT_FILENAME = "quantum-box-save-v5.json";

export type QongRecoveryAuthorityVerifier = (
  recovery: TutorialRecoveryRecord<"qong">,
) => void;

/**
 * The persisted recovery is internally valid, but identifies a different
 * installed Qong bank/version. This is recoverable by demoting only Qong's
 * authority; it is not equivalent to a malformed or tampered save.
 */
export class QongRecoveryAuthorityMismatchError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "QongRecoveryAuthorityMismatchError";
  }
}

interface DeferredSave {
  readonly storageKey:
    | typeof SAVE_STORAGE_KEY
    | typeof PREVIOUS_SAVE_STORAGE_KEY
    | typeof LEGACY_SAVE_STORAGE_KEY
    | typeof EARLIEST_SAVE_STORAGE_KEY
    | typeof INITIAL_SAVE_STORAGE_KEY;
  readonly value: QuantumBoxSave;
}

export class SaveRepository {
  private value: QuantumBoxSave;
  private deferredSave: DeferredSave | null = null;

  public constructor(
    private readonly storage: Storage = window.localStorage,
    private readonly verifyQongRecoveryAuthority: QongRecoveryAuthorityVerifier = verifyInstalledQongRecovery,
  ) {
    this.value = this.load();
  }

  public snapshot(): QuantumBoxSave {
    return this.value;
  }

  public updateSettings(change: Partial<QuantumBoxSettings>): QuantumBoxSave {
    if (this.deferredSave !== null) {
      const updatedDeferred = validateSave({
        ...this.deferredSave.value,
        settings: { ...this.deferredSave.value.settings, ...change },
      });
      this.storage.setItem(
        this.deferredSave.storageKey,
        JSON.stringify(updatedDeferred),
      );
      this.deferredSave = {
        storageKey: this.deferredSave.storageKey,
        value: updatedDeferred,
      };
      this.value = createLockedProjection(updatedDeferred);
      return this.value;
    }
    return this.commit({
      ...this.value,
      settings: { ...this.value.settings, ...change },
    });
  }

  public recordStoryAttempt(context: RunContext): QuantumBoxSave {
    this.requireStoryAuthorityAvailable();
    const stage = requireCurrentStoryAuthority(this.value, context);
    const qongSelector =
      stage === "qong"
        ? advanceQongSelector(this.value, context)
        : this.value.story.qongSelector;
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        attempts: {
          ...this.value.story.attempts,
          [stage]: (this.value.story.attempts[stage] ?? 0) + 1,
        },
        qongSelector,
      },
    });
  }

  public recordPendingNarrativeBeat(
    context: RunContext,
    input: Readonly<{
      beatId: string;
      kind: StoryNarrativeBeatKind;
      activeTick: number;
      evidenceSha256: string;
      presentationEvidence?: StoryV2PresentationEvidence;
    }>,
  ): QuantumBoxSave {
    this.requireStoryAuthorityAvailable();
    const stage = requireCurrentStoryAuthority(this.value, context);
    const pendingNarrativeBeat: PendingStoryNarrativeBeat = Object.freeze({
      schemaVersion: "quantum-box-pending-story-beat-v2",
      stage,
      beatId: input.beatId,
      kind: input.kind,
      qualifiedRun: context,
      qualification: Object.freeze({
        outcome: "qualified",
        activeTick: input.activeTick,
        evidenceSha256: input.evidenceSha256,
      }),
      presentationEvidence: input.presentationEvidence
        ? validateStoryV2PresentationEvidence(input.presentationEvidence, {
            stageId: stage,
            run: context,
            activeTick: input.activeTick,
            evidenceSha256: input.evidenceSha256,
          })
        : createLegacyStoryV2PresentationEvidence({
            stageId: stage,
            run: context,
            activeTick: input.activeTick,
            evidenceSha256: input.evidenceSha256,
          }),
    });
    return this.commit({
      ...this.value,
      story: { ...this.value.story, pendingNarrativeBeat },
    });
  }

  public updatePendingNarrativeBeat(beatId: string): QuantumBoxSave {
    const pending = this.value.story.pendingNarrativeBeat;
    if (pending === null) {
      throw new Error("No qualified Story transition is pending.");
    }
    requireCanonicalStoryBeat(pending.stage, beatId);
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        pendingNarrativeBeat: { ...pending, beatId },
      },
    });
  }

  public recordSkiPixlArcadeScore(
    result: PendingSkiPixlArcadeRecord,
    initials: string,
  ): QuantumBoxSave {
    return this.commit({
      ...this.value,
      arcadeRecords: recordSkiPixlArcadeResult(
        this.value.arcadeRecords,
        result,
        initials,
      ),
    });
  }

  public recordQuantmanArcadeScore(
    result: PendingQuantmanArcadeRecord,
    initials: string,
  ): QuantumBoxSave {
    return this.commit({
      ...this.value,
      arcadeRecords: recordQuantmanArcadeResult(
        this.value.arcadeRecords,
        result,
        initials,
      ),
    });
  }

  public markFirstLossExplanationSeen(
    gameId: "qong" | "fluxball",
  ): QuantumBoxSave {
    if (this.value.story.firstLossExplanations[gameId]) return this.value;
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        firstLossExplanations: {
          ...this.value.story.firstLossExplanations,
          [gameId]: true,
        },
      },
    });
  }

  public recordSkiPixlCutResult(
    context: RunContext,
    result:
      | Readonly<{
          qualified: false;
          attempt: SkiPixlStoryAttemptReceipt;
        }>
      | Readonly<{
          qualified: true;
          pass: SkiPixlStoryPassReceipt;
          attempt: SkiPixlStoryAttemptReceipt;
        }>,
  ): QuantumBoxSave {
    this.requireStoryAuthorityAvailable();
    const stage = requireCurrentStoryAuthority(this.value, context);
    if (stage !== "skipixl-medium" && stage !== "skipixl") {
      throw new Error("SkiPixl cut progress requires the active Story stage.");
    }
    const expectedCut = stage === "skipixl-medium" ? "P84" : "P78";
    const current = this.value.story.skipixlCuts;
    if (
      result.attempt.stageId !== stage ||
      result.attempt.cutId !== expectedCut ||
      result.attempt.qualified !== result.qualified ||
      result.attempt.runId !== context.runId ||
      result.attempt.packId !== context.pack.packId ||
      result.attempt.contentSha256 !== context.pack.contentSha256
    ) {
      throw new Error(
        "SkiPixl attempt receipt does not match the active Story run.",
      );
    }
    const completedAttempts = [...current.completedAttempts, result.attempt];
    if (!result.qualified) {
      return this.commit({
        ...this.value,
        story: {
          ...this.value.story,
          skipixlCuts: {
            ...current,
            currentCut: expectedCut,
            tripletCursor: current.tripletCursor + 1,
            tripletId: null,
            completedAttempts,
          },
        },
      });
    }
    if (result.pass.cutId !== expectedCut) {
      throw new Error("SkiPixl pass does not match the current residual cut.");
    }
    if (
      result.pass.tripletId !== result.attempt.tripletId ||
      result.pass.packId !== result.attempt.packId ||
      result.pass.contentSha256 !== result.attempt.contentSha256 ||
      result.pass.runId !== result.attempt.runId ||
      result.pass.elapsedSeconds !== result.attempt.elapsedSeconds ||
      result.pass.collisionCount !== result.attempt.collisionCount
    ) {
      throw new Error("SkiPixl pass and attempt receipts disagree.");
    }
    if (
      stage === "skipixl" &&
      current.tripletId !== null &&
      result.pass.tripletId !== current.tripletId
    ) {
      throw new Error(
        "SkiPixl Hard must use the Medium triplet until a failed attempt rotates it.",
      );
    }
    const retainedPasses = current.successfulPasses.filter(
      (pass) => pass.cutId !== expectedCut,
    );
    const successfulPasses = [...retainedPasses, result.pass].sort(
      (left, right) =>
        ["P90", "P84", "P78"].indexOf(left.cutId) -
        ["P90", "P84", "P78"].indexOf(right.cutId),
    );
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        skipixlCuts: {
          currentCut: "P78",
          tripletCursor: current.tripletCursor,
          tripletId: result.pass.tripletId,
          successfulPasses,
          completedAttempts,
        },
      },
    });
  }

  public completeStoryRun(
    context: RunContext,
    recovery: TutorialRecoveryRecord | null,
  ): QuantumBoxSave {
    this.requireStoryAuthorityAvailable();
    const stage = requireCurrentStoryAuthority(this.value, context);
    const validatedRecovery = requireStageRecovery(
      stage,
      context,
      recovery,
      this.verifyQongRecoveryAuthority,
    );
    if (validatedRecovery === null) {
      requireCanonicalStoryCompletionAuthority(this.value, stage, context);
    }
    const nextStage = nextStoryStage(stage);
    const completedStages = [...this.value.story.completedStages, stage];
    const currentGame = gameForStoryStage(stage).id;
    const nextGame =
      nextStage === "complete" ? null : gameForStoryStage(nextStage).id;
    const recoveredFormulae =
      nextGame === currentGame ||
      this.value.story.recoveredFormulae.includes(currentGame)
        ? this.value.story.recoveredFormulae
        : [...this.value.story.recoveredFormulae, currentGame];
    const debriefedFormulae =
      validatedRecovery === null &&
      !isMidChapterStage(stage) &&
      !this.value.story.debriefedFormulae.includes(currentGame)
        ? [...this.value.story.debriefedFormulae, currentGame]
        : this.value.story.debriefedFormulae;
    const qongSelector =
      stage === "qong"
        ? completeQongSelector(this.value, context)
        : this.value.story.qongSelector;
    const tutorialRecoveries =
      validatedRecovery === null
        ? this.value.story.tutorialRecoveries
        : {
            ...this.value.story.tutorialRecoveries,
            [currentGame]: validatedRecovery,
          };
    const inspectOnlyFormulae =
      validatedRecovery === null
        ? debriefedFormulae.includes(currentGame)
          ? this.value.story.inspectOnlyFormulae.filter(
              (gameId) => gameId !== currentGame,
            )
          : this.value.story.inspectOnlyFormulae
        : this.value.story.inspectOnlyFormulae.filter(
            (gameId) => gameId !== currentGame,
          );
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        currentStage: nextStage,
        completedStages,
        recoveredFormulae,
        inspectOnlyFormulae,
        debriefedFormulae,
        qongSelector,
        tutorialRecoveries,
        pendingNarrativeBeat: null,
        qualifiedRuns: {
          ...this.value.story.qualifiedRuns,
          [stage]: context,
        },
      },
    });
  }

  public reset(): QuantumBoxSave {
    this.deferredSave = null;
    this.value = createDefaultSave();
    this.storage.removeItem(SAVE_STORAGE_KEY);
    this.storage.removeItem(PREVIOUS_SAVE_STORAGE_KEY);
    this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
    this.storage.removeItem(EARLIEST_SAVE_STORAGE_KEY);
    this.storage.removeItem(INITIAL_SAVE_STORAGE_KEY);
    return this.value;
  }

  public exportJson(): string {
    return `${JSON.stringify(this.deferredSave?.value ?? this.value, null, 2)}\n`;
  }

  private commit(next: QuantumBoxSave): QuantumBoxSave {
    this.requireStoryAuthorityAvailable();
    const validated = validateSave(next);
    requirePersistedQongAuthority(validated, this.verifyQongRecoveryAuthority);
    this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(validated));
    this.value = validated;
    return validated;
  }

  private load(): QuantumBoxSave {
    const candidates = [
      {
        key: SAVE_STORAGE_KEY,
        serialized: this.storage.getItem(SAVE_STORAGE_KEY),
      },
      {
        key: PREVIOUS_SAVE_STORAGE_KEY,
        serialized: this.storage.getItem(PREVIOUS_SAVE_STORAGE_KEY),
      },
      {
        key: LEGACY_SAVE_STORAGE_KEY,
        serialized: this.storage.getItem(LEGACY_SAVE_STORAGE_KEY),
      },
      {
        key: EARLIEST_SAVE_STORAGE_KEY,
        serialized: this.storage.getItem(EARLIEST_SAVE_STORAGE_KEY),
      },
      {
        key: INITIAL_SAVE_STORAGE_KEY,
        serialized: this.storage.getItem(INITIAL_SAVE_STORAGE_KEY),
      },
    ] as const;

    for (const candidate of candidates) {
      if (candidate.serialized === null) continue;
      let validated: QuantumBoxSave;
      try {
        validated = validateSave(JSON.parse(candidate.serialized) as unknown);
      } catch {
        this.storage.removeItem(candidate.key);
        continue;
      }
      try {
        requirePersistedQongAuthority(
          validated,
          this.verifyQongRecoveryAuthority,
        );
      } catch (error) {
        if (error instanceof QongStoryBankUnavailableError) {
          this.deferredSave = {
            storageKey: candidate.key,
            value: validated,
          };
          return createLockedProjection(validated);
        }
        if (error instanceof QongRecoveryAuthorityMismatchError) {
          const demoted = demoteMismatchedQongAuthority(validated);
          try {
            this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(demoted));
            this.storage.removeItem(PREVIOUS_SAVE_STORAGE_KEY);
            this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
            this.storage.removeItem(EARLIEST_SAVE_STORAGE_KEY);
            this.storage.removeItem(INITIAL_SAVE_STORAGE_KEY);
          } catch {
            // Preserve the original bytes if the recoverable demotion cannot
            // be committed. The in-memory projection still exposes all
            // non-Qong data without treating the old Qong bank as authority.
          }
          return demoted;
        }
        this.storage.removeItem(candidate.key);
        continue;
      }

      if (candidate.key === SAVE_STORAGE_KEY) {
        if (JSON.stringify(validated) !== candidate.serialized) {
          try {
            this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(validated));
          } catch {
            // The validated in-memory migration remains usable; retain the
            // original bytes when storage cannot accept the safer projection.
          }
        }
        this.storage.removeItem(PREVIOUS_SAVE_STORAGE_KEY);
        this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
        this.storage.removeItem(EARLIEST_SAVE_STORAGE_KEY);
        this.storage.removeItem(INITIAL_SAVE_STORAGE_KEY);
        return validated;
      }

      try {
        this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(validated));
        this.storage.removeItem(PREVIOUS_SAVE_STORAGE_KEY);
        this.storage.removeItem(LEGACY_SAVE_STORAGE_KEY);
        this.storage.removeItem(EARLIEST_SAVE_STORAGE_KEY);
        this.storage.removeItem(INITIAL_SAVE_STORAGE_KEY);
      } catch {
        // Keep the valid older key intact so a failed migration never loses it.
      }
      return validated;
    }

    return createDefaultSave();
  }

  private requireStoryAuthorityAvailable(): void {
    if (this.deferredSave !== null) {
      throw new QongStoryBankUnavailableError(
        "Qong Story authority is temporarily unavailable; preserved progress remains locked.",
      );
    }
  }
}

function createLockedProjection(save: QuantumBoxSave): QuantumBoxSave {
  return validateSave({
    ...createDefaultSave(),
    settings: save.settings,
  });
}

function requireStageRecovery(
  stage: Exclude<QuantumBoxSave["story"]["currentStage"], "complete">,
  context: RunContext,
  recovery: TutorialRecoveryRecord | null,
  verifyQongRecoveryAuthority: QongRecoveryAuthorityVerifier,
): TutorialRecoveryRecord | null {
  if (isRecoveryOptionalStage(stage)) {
    if (recovery !== null) {
      throw new Error(
        `${stage} uses the canonical Story transition rather than a legacy tutorial recovery.`,
      );
    }
    return null;
  }
  if (recovery === null) {
    throw new Error(
      `${stage} completion requires its tutorial recovery record.`,
    );
  }
  const validated = validateTutorialRecoveryRecord(recovery);
  const expectedGame = gameForStoryStage(stage).id;
  if (
    validated.gameId !== expectedGame ||
    validated.run.runId !== context.runId ||
    canonicalJson(validated.run) !== canonicalJson(context)
  ) {
    throw new Error(
      `${stage} tutorial recovery does not match the completed Story run.`,
    );
  }
  if (validated.gameId === "qong") {
    verifyQongRecoveryAuthority(validated as TutorialRecoveryRecord<"qong">);
  }
  return validated;
}

function requireCanonicalStoryBeat(stage: StoryStageId, beatId: string): void {
  const definition = storyV2Stage(stage);
  parseStoryV2ResumeToken({
    schemaVersion: STORY_V2_VERSION,
    stageId: stage,
    flowId: definition.presentationFlowId,
    beatId,
  });
}

function requireCanonicalStoryCompletionAuthority(
  save: QuantumBoxSave,
  stage: StoryStageId,
  context: RunContext,
): void {
  const pending = save.story.pendingNarrativeBeat;
  if (pending === null) {
    throw new Error(
      `${stage} completion requires its qualified canonical Story presentation.`,
    );
  }
  if (
    pending.stage !== stage ||
    canonicalJson(pending.qualifiedRun) !== canonicalJson(context)
  ) {
    throw new Error(
      `${stage} completion does not match its qualified Story presentation run.`,
    );
  }
  requireCanonicalStoryBeat(stage, pending.beatId);
  const flow = storyV2PresentationFlow(storyV2Stage(stage).presentationFlowId);
  const finalBeat = flow.beats.at(-1);
  if (!finalBeat || pending.beatId !== finalBeat.id) {
    throw new Error(
      `${stage} canonical Story presentation has not reached its completion beat.`,
    );
  }

  // V1-V4 progress is normalized by validateSave/load before repository
  // mutation. Retained recovery records remain available to their validation
  // and replay compatibility paths, but never authorize a new V2 promotion.
}

function isMidChapterStage(
  stage: Exclude<QuantumBoxSave["story"]["currentStage"], "complete">,
): boolean {
  return (
    stage === "skipixl-medium" ||
    stage === "fluxball-two" ||
    stage === "quantman-stabilize"
  );
}

function isRecoveryOptionalStage(
  _stage: Exclude<QuantumBoxSave["story"]["currentStage"], "complete">,
): boolean {
  return true;
}

function verifyInstalledQongRecovery(
  recovery: TutorialRecoveryRecord<"qong">,
): void {
  requireInstalledQongRecoveryReference({
    rulesVersion: recovery.run.rulesVersion,
    pack: recovery.run.pack,
    packSelection: recovery.run.packSelection,
    firstResult: recovery.evidence.result,
  });
}

function isInstalledBankMismatch(error: unknown): error is Error {
  return (
    error instanceof Error &&
    [
      "Qong recovery does not reference the installed Story bank authority.",
      "Qong recovery pack selection is absent from the installed Story bank.",
      "Installed Qong recovery provenance is incomplete.",
    ].includes(error.message)
  );
}

function demoteMismatchedQongAuthority(save: QuantumBoxSave): QuantumBoxSave {
  const { qong: _rejectedQongRecovery, ...retainedRecoveries } =
    save.story.tutorialRecoveries;
  const qongWasAccessible = save.story.recoveredFormulae.includes("qong");
  const inspectOnlyFormulae = qongWasAccessible
    ? [
        ...save.story.inspectOnlyFormulae.filter((gameId) => gameId !== "qong"),
        "qong" as const,
      ]
    : save.story.inspectOnlyFormulae;
  return validateSave({
    ...save,
    story: {
      ...save.story,
      currentStage: "qong",
      completedStages: [],
      inspectOnlyFormulae,
      qongSelector: {
        cursor: 0,
        cycle: 0,
        recoveredSelection: null,
      },
      tutorialRecoveries: retainedRecoveries,
    },
  });
}

function requirePersistedQongAuthority(
  save: QuantumBoxSave,
  verifyQongRecoveryAuthority: QongRecoveryAuthorityVerifier,
): void {
  const recovery = save.story.tutorialRecoveries.qong;
  if (recovery === undefined) return;
  try {
    verifyQongRecoveryAuthority(recovery);
  } catch (error) {
    if (isInstalledBankMismatch(error)) {
      throw new QongRecoveryAuthorityMismatchError(error.message);
    }
    throw error;
  }
}

function requireQongSelection(context: RunContext): QongPackSelectionReceipt {
  if (context.packSelection === null) {
    throw new Error(
      "Qong Story completion lacks its frozen selection receipt.",
    );
  }
  return validateQongSelectionReceipt(context.packSelection);
}

function advanceQongSelector(
  save: QuantumBoxSave,
  context: RunContext,
): QuantumBoxSave["story"]["qongSelector"] {
  const receipt = requireQongSelection(context);
  const current = save.story.qongSelector;
  if (
    receipt.selectorCursorBefore !== current.cursor ||
    receipt.selectorCycle !== current.cycle
  ) {
    throw new Error(
      "Qong Story selection does not match the saved selector position.",
    );
  }
  return {
    ...current,
    cursor: receipt.selectorCursorAfter,
    cycle: receipt.selectorCycleAfter,
  };
}

function completeQongSelector(
  save: QuantumBoxSave,
  context: RunContext,
): QuantumBoxSave["story"]["qongSelector"] {
  const receipt = requireQongSelection(context);
  const current = save.story.qongSelector;
  if (
    current.cursor !== receipt.selectorCursorAfter ||
    current.cycle !== receipt.selectorCycleAfter
  ) {
    throw new Error(
      "Qong Story completion requires the saved selector position produced when this run started.",
    );
  }
  return {
    cursor: receipt.selectorCursorAfter,
    cycle: receipt.selectorCycleAfter,
    recoveredSelection: receipt,
  };
}

export { SAVE_SCHEMA_VERSION };

function requireCurrentStoryAuthority(
  save: QuantumBoxSave,
  context: RunContext,
): Exclude<QuantumBoxSave["story"]["currentStage"], "complete"> {
  if (context.playMode !== "story" || context.storyStage === null) {
    throw new Error("Only a frozen Story run can mutate Story progression.");
  }
  if (save.story.currentStage === "complete") {
    throw new Error("Quantum Box Story is already complete.");
  }
  if (context.storyStage !== save.story.currentStage) {
    throw new Error("Story run authority does not match the current stage.");
  }
  return save.story.currentStage;
}
