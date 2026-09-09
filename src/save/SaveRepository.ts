import type { RunContext } from "../core/run";
import type { StoryChapterId, StoryStageId } from "../games/registry";
import {
  QongStoryBankUnavailableError,
  requireInstalledQongRecoveryReference,
  validateQongSelectionReceipt,
  type QongPackSelectionReceipt,
} from "../games/qong/qongStoryPackBank";
import {
  branchStoryOutcome,
  chapterStages,
  STORY_OPENING_NODE_ID,
  storyNode,
} from "../story/terminal";
import type { StoryOutcome, StoryTerminalActionId } from "../story/terminal";
import type { TutorialRecoveryRecord } from "../tutorials/recovery";
import {
  normalizeInitials,
  recordQuantmanArcadeResult,
  recordSkiPixlArcadeResult,
  updateArcadeRecordInitials,
  type PendingQuantmanArcadeRecord,
  type PendingSkiPixlArcadeRecord,
} from "./ArcadeRecords";
import {
  createDefaultSave,
  SAVE_SCHEMA_VERSION,
  validateSave,
  type QuantumBoxSave,
  type QuantumBoxSettings,
  type SkiPixlStoryAttemptReceipt,
  type SkiPixlStoryPassReceipt,
} from "./types";

export const SAVE_STORAGE_KEY = "quantum-box/save-v6";
export const PREVIOUS_SAVE_STORAGE_KEY = "quantum-box/save-v5";
export const LEGACY_SAVE_STORAGE_KEY = "quantum-box/save-v4";
export const EARLIEST_SAVE_STORAGE_KEY = "quantum-box/save-v3";
export const INITIAL_SAVE_STORAGE_KEY = "quantum-box/save-v2";
export const ORIGINAL_SAVE_STORAGE_KEY = "quantum-box/save-v1";
export const SAVE_EXPORT_FILENAME = "quantum-box-save-v6.json";

export type StoryAttemptSource = "main-story" | "terminal-retry";

export type QongRecoveryAuthorityVerifier = (
  recovery: TutorialRecoveryRecord<"qong">,
) => void;

/**
 * The persisted recovery is internally valid, but identifies a different
 * installed Qong bank/version. This is recoverable by demoting only Qong's
 * authority; it is not equivalent to malformed or tampered save data.
 */
export class QongRecoveryAuthorityMismatchError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "QongRecoveryAuthorityMismatchError";
  }
}

interface DeferredSave {
  readonly storageKey: string;
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

  /** Persist a terminal node before the UI or a cabinet transition begins. */
  public setStoryNode(nodeId: string): QuantumBoxSave {
    storyNode(nodeId);
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        currentNodeId: nodeId,
        storyCompleted:
          nodeId === "story-complete" || this.value.story.storyCompleted,
      },
    });
  }

  public advanceStoryTerminal(action: StoryTerminalActionId): QuantumBoxSave {
    const current = storyNode(this.value.story.currentNodeId);
    if (
      current.kind !== "terminal-page" &&
      current.kind !== "loading-transition" &&
      current.kind !== "placeholder"
    ) {
      throw new Error(
        "The current Story node is not an interactive terminal page.",
      );
    }
    const target = current.transitions[action];
    if (!target) {
      throw new Error(
        `Story action ${action} is not available on ${current.id}.`,
      );
    }
    return this.setStoryNode(target);
  }

  public recordStoryAttempt(
    context: RunContext,
    source: StoryAttemptSource = "main-story",
  ): QuantumBoxSave {
    this.requireStoryAuthorityAvailable();
    const stage = requireStoryRun(context);
    if (source === "main-story") {
      const node = storyNode(this.value.story.currentNodeId);
      if (node.kind !== "game-launch" || node.stageId !== stage) {
        throw new Error("Story run authority does not match the current node.");
      }
    }
    const qongSelector =
      stage === "qong"
        ? advanceQongSelector(this.value, context)
        : this.value.story.qongSelector;
    const experiencedStages = this.value.story.experiencedStages.includes(stage)
      ? this.value.story.experiencedStages
      : [...this.value.story.experiencedStages, stage];
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        experiencedStages,
        attempts: {
          ...this.value.story.attempts,
          [stage]: (this.value.story.attempts[stage] ?? 0) + 1,
        },
        qongSelector,
      },
    });
  }

  /**
   * Record an authoritative cabinet outcome. Main Story resolves to a terminal
   * branch; Terminal retries leave the main cursor untouched.
   */
  public recordStoryOutcome(
    context: RunContext,
    outcomeValue: StoryOutcome,
    source: StoryAttemptSource = "main-story",
  ): QuantumBoxSave {
    this.requireStoryAuthorityAvailable();
    const stage = requireStoryRun(context);
    if ((this.value.story.attempts[stage] ?? 0) < 1) {
      throw new Error("A Story outcome requires a recorded attempt.");
    }
    let currentNodeId = this.value.story.currentNodeId;
    if (source === "main-story") {
      const launch = storyNode(currentNodeId);
      if (launch.kind !== "game-launch" || launch.stageId !== stage) {
        throw new Error(
          "Story outcome does not match the current launch node.",
        );
      }
      const branch = storyNode(launch.outcomeNodeId);
      if (branch.kind !== "outcome-branch" || branch.stageId !== stage) {
        throw new Error("Story launch has an invalid outcome branch.");
      }
      currentNodeId = branchStoryOutcome(
        branch,
        outcomeValue,
        firstLossExplanationAlreadyShown(
          stage,
          this.value.story.firstLossExplanations,
        ),
      );
    }
    const cleared = outcomeValue === "won" || outcomeValue === "finished";
    const clearedStages =
      cleared && !this.value.story.clearedStages.includes(stage)
        ? [...this.value.story.clearedStages, stage]
        : this.value.story.clearedStages;
    const qongSelector =
      stage === "qong" && cleared
        ? completeQongSelector(this.value, context)
        : this.value.story.qongSelector;
    const qualifiedRuns = cleared
      ? { ...this.value.story.qualifiedRuns, [stage]: context }
      : this.value.story.qualifiedRuns;
    const firstLossExplanations =
      !cleared && stage === "qong"
        ? { ...this.value.story.firstLossExplanations, qong: true }
        : !cleared && stage === "quantman-hold"
          ? { ...this.value.story.firstLossExplanations, quantman: true }
          : !cleared &&
              (stage === "fluxball-global" || stage === "fluxball-individual")
            ? { ...this.value.story.firstLossExplanations, fluxball: true }
            : this.value.story.firstLossExplanations;
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        currentNodeId,
        clearedStages,
        completedStages: clearedStages,
        lastOutcomes: {
          ...this.value.story.lastOutcomes,
          [stage]: outcomeValue,
        },
        qongSelector,
        qualifiedRuns,
        firstLossExplanations,
      },
    });
  }

  public markTranscriptSeen(chapterId: StoryChapterId): QuantumBoxSave {
    const chapterCleared = chapterStages(chapterId).every((stage) =>
      this.value.story.clearedStages.includes(stage),
    );
    if (!chapterCleared) {
      throw new Error(
        "A Terminal transcript unlocks only after its required clears.",
      );
    }
    if (this.value.story.transcriptSeen.includes(chapterId)) return this.value;
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        transcriptSeen: [...this.value.story.transcriptSeen, chapterId],
      },
    });
  }

  /** Replay the demonstration without erasing results or Arcade history. */
  public replayStoryFromStart(): QuantumBoxSave {
    return this.commit({
      ...this.value,
      story: {
        ...this.value.story,
        currentNodeId: STORY_OPENING_NODE_ID,
        storyCompleted: false,
      },
    });
  }

  public recordSkiPixlCutResult(
    context: RunContext,
    result:
      | Readonly<{ qualified: false; attempt: SkiPixlStoryAttemptReceipt }>
      | Readonly<{
          qualified: true;
          pass: SkiPixlStoryPassReceipt;
          attempt: SkiPixlStoryAttemptReceipt;
        }>,
  ): QuantumBoxSave {
    this.requireStoryAuthorityAvailable();
    const stage = requireStoryRun(context);
    if (stage !== "skipixl-feasible" && stage !== "skipixl-overloaded") {
      throw new Error("SkiPixl cut progress requires a SkiPixl Story stage.");
    }
    const expectedCut = stage === "skipixl-feasible" ? "P84" : "P78";
    const current = this.value.story.skipixlCuts;
    if (
      result.attempt.stageId !== stage ||
      result.attempt.cutId !== expectedCut ||
      result.attempt.qualified !== result.qualified ||
      result.attempt.runId !== context.runId ||
      result.attempt.packId !== context.pack.packId ||
      result.attempt.contentSha256 !== context.pack.contentSha256
    ) {
      throw new Error("SkiPixl attempt receipt does not match the Story run.");
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
    if (
      result.pass.cutId !== expectedCut ||
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
      stage === "skipixl-overloaded" &&
      current.tripletId !== null &&
      result.pass.tripletId !== current.tripletId
    ) {
      throw new Error(
        "SkiPixl overloaded course must retain its feasible-course triplet until failure rotates it.",
      );
    }
    const successfulPasses = [
      ...current.successfulPasses.filter((pass) => pass.cutId !== expectedCut),
      result.pass,
    ].sort(
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

  public updateArcadeScoreInitials(
    recordedSequence: number,
    initials: string,
  ): QuantumBoxSave {
    const normalized = normalizeInitials(initials);
    return this.commit({
      ...this.value,
      settings: { ...this.value.settings, arcadeInitials: normalized },
      arcadeRecords: updateArcadeRecordInitials(
        this.value.arcadeRecords,
        recordedSequence,
        normalized,
      ),
    });
  }

  public markFirstLossExplanationSeen(
    gameId: "qong" | "quantman" | "fluxball",
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

  public reset(): QuantumBoxSave {
    this.deferredSave = null;
    this.value = createDefaultSave();
    for (const key of ALL_SAVE_STORAGE_KEYS) this.storage.removeItem(key);
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
    for (const key of ALL_SAVE_STORAGE_KEYS) {
      const serialized = this.storage.getItem(key);
      if (serialized === null) continue;
      let validated: QuantumBoxSave;
      try {
        validated = validateSave(JSON.parse(serialized) as unknown);
      } catch {
        this.storage.removeItem(key);
        continue;
      }
      try {
        requirePersistedQongAuthority(
          validated,
          this.verifyQongRecoveryAuthority,
        );
      } catch (error) {
        if (error instanceof QongStoryBankUnavailableError) {
          this.deferredSave = { storageKey: key, value: validated };
          return createLockedProjection(validated);
        }
        if (error instanceof QongRecoveryAuthorityMismatchError) {
          const demoted = demoteMismatchedQongAuthority(validated);
          this.promoteLoadedSave(demoted, key);
          return demoted;
        }
        this.storage.removeItem(key);
        continue;
      }
      this.promoteLoadedSave(validated, key);
      return validated;
    }
    return createDefaultSave();
  }

  private promoteLoadedSave(save: QuantumBoxSave, sourceKey: string): void {
    try {
      this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
      for (const key of ALL_SAVE_STORAGE_KEYS) {
        if (key !== SAVE_STORAGE_KEY) this.storage.removeItem(key);
      }
    } catch {
      // Preserve the source key when storage cannot accept the v6 projection.
      if (sourceKey === SAVE_STORAGE_KEY) return;
    }
  }

  private requireStoryAuthorityAvailable(): void {
    if (this.deferredSave !== null) {
      throw new QongStoryBankUnavailableError(
        "Qong Story authority is temporarily unavailable; preserved progress remains locked.",
      );
    }
  }
}

function firstLossExplanationAlreadyShown(
  stage: StoryStageId,
  state: QuantumBoxSave["story"]["firstLossExplanations"],
): boolean {
  if (stage === "qong") return state.qong;
  if (stage === "quantman-hold") return state.quantman;
  if (stage === "fluxball-global" || stage === "fluxball-individual")
    return state.fluxball;
  return false;
}

const ALL_SAVE_STORAGE_KEYS = Object.freeze([
  SAVE_STORAGE_KEY,
  PREVIOUS_SAVE_STORAGE_KEY,
  LEGACY_SAVE_STORAGE_KEY,
  EARLIEST_SAVE_STORAGE_KEY,
  INITIAL_SAVE_STORAGE_KEY,
  ORIGINAL_SAVE_STORAGE_KEY,
]);

function createLockedProjection(save: QuantumBoxSave): QuantumBoxSave {
  return validateSave({
    ...createDefaultSave(),
    settings: save.settings,
    arcadeRecords: save.arcadeRecords,
  });
}

function requireStoryRun(context: RunContext): StoryStageId {
  if (context.playMode !== "story" || context.storyStage === null) {
    throw new Error("Only a frozen Story run can mutate Story progression.");
  }
  if (!isStoryStageId(context.storyStage)) {
    throw new Error(
      "Legacy Story stage identifiers cannot mutate v6 progress.",
    );
  }
  return context.storyStage;
}

function isStoryStageId(value: string): value is StoryStageId {
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
  return validateSave({
    ...save,
    story: {
      ...save.story,
      currentNodeId: "qong-intro",
      storyCompleted: false,
      experiencedStages: save.story.experiencedStages.filter(
        (stage) => stage !== "qong",
      ),
      clearedStages: save.story.clearedStages.filter(
        (stage) => stage !== "qong",
      ),
      completedStages: save.story.completedStages.filter(
        (stage) => stage !== "qong",
      ),
      qongSelector: { cursor: 0, cycle: 0, recoveredSelection: null },
      tutorialRecoveries: retainedRecoveries,
      qualifiedRuns: Object.fromEntries(
        Object.entries(save.story.qualifiedRuns).filter(
          ([stage]) => stage !== "qong",
        ),
      ),
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
    throw new Error("Qong Story requires its frozen selection receipt.");
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
      "Qong selection does not match the saved selector position.",
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
      "Qong completion requires the selector position produced when its run started.",
    );
  }
  return {
    cursor: receipt.selectorCursorAfter,
    cycle: receipt.selectorCycleAfter,
    recoveredSelection: receipt,
  };
}

export { SAVE_SCHEMA_VERSION };
