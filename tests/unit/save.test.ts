import { beforeAll, describe, expect, it } from "vitest";

import { createRunContext, type RunContext } from "../../src/core/run";
import {
  STORY_SEQUENCE,
  type ArcadeCabinetId,
  type StoryStageId,
} from "../../src/games/registry";
import {
  loadInstalledQongStoryBank,
  QongStoryBankUnavailableError,
  requireQongRecoveryReferenceInBankArtifact,
} from "../../src/games/qong/qongStoryPackBank";
import {
  selectStorySkiPixlPack,
  type SkiPixlCommittedPack,
} from "../../src/games/skipixl/SkiPixlCourseAdapter";
import {
  EARLIEST_SAVE_STORAGE_KEY,
  INITIAL_SAVE_STORAGE_KEY,
  LEGACY_SAVE_STORAGE_KEY,
  PREVIOUS_SAVE_STORAGE_KEY,
  SAVE_EXPORT_FILENAME,
  SAVE_STORAGE_KEY,
  SaveRepository,
} from "../../src/save/SaveRepository";
import {
  createDefaultSave,
  DEFAULT_SOUND_VOLUME,
  validateSave,
  type QuantumBoxSave,
  type StoryNarrativeBeatKind,
} from "../../src/save/types";
import { storyV2PresentationFlow } from "../../src/story/v2/flows";
import { storyV2Stage } from "../../src/story/v2/registry";
import { adaptFluxballClubhouseEvidence } from "../../src/tutorials/fluxballClubhouse";
import { adaptQongWorkshopEvidence } from "../../src/tutorials/qongWorkshop";
import { adaptQuantmanTopologyRoomEvidence } from "../../src/tutorials/quantmanTopologyRoom";
import {
  createTutorialRecoveryRecord,
  type TutorialRecoveryRecord,
} from "../../src/tutorials/recovery";
import { adaptSkiPixlLodgeEvidence } from "../../src/tutorials/skiPixlLodge";
import {
  fluxballClubhouseFixtureInput,
  qongWorkshopRunInput,
  quantmanTopologyRoomFixtureInput,
  skiPixlLodgeRunInput,
} from "./tutorialWorldEvidenceFixtures";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  public failWrites = false;

  public get length(): number {
    return this.values.size;
  }

  public clear(): void {
    this.values.clear();
  }

  public getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  public key(index: number): string | null {
    return [...this.values.keys()][index] ?? null;
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }

  public setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error("storage write refused");
    this.values.set(key, value);
  }
}

interface RecoveryFixture {
  readonly context: RunContext;
  readonly record: TutorialRecoveryRecord;
}

let fixtures: Readonly<{
  qong: RecoveryFixture;
  skipixl: RecoveryFixture;
  fluxball: RecoveryFixture;
  quantman: RecoveryFixture;
}>;
let testQongBank: unknown;

beforeAll(async () => {
  testQongBank = await loadInstalledQongStoryBank();
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
  fixtures = Object.freeze({
    qong: Object.freeze({
      context: qong.context,
      record: createTutorialRecoveryRecord(
        "qong",
        qong.context,
        adaptQongWorkshopEvidence(qong),
      ),
    }),
    skipixl: Object.freeze({
      context: skipixl.context,
      record: createTutorialRecoveryRecord(
        "skipixl",
        skipixl.context,
        adaptSkiPixlLodgeEvidence(skipixl),
      ),
    }),
    fluxball: Object.freeze({
      context: fluxball.context,
      record: createTutorialRecoveryRecord(
        "fluxball",
        fluxball.context,
        adaptFluxballClubhouseEvidence(fluxball),
      ),
    }),
    quantman: Object.freeze({
      context: quantman.context,
      record: createTutorialRecoveryRecord(
        "quantman",
        quantman.context,
        adaptQuantmanTopologyRoomEvidence(quantman),
      ),
    }),
  });
});

function testRepository(storage: Storage): SaveRepository {
  return new SaveRepository(storage, (recovery) => {
    requireQongRecoveryReferenceInBankArtifact(
      {
        rulesVersion: recovery.run.rulesVersion,
        pack: recovery.run.pack,
        packSelection: recovery.run.packSelection,
        firstResult: recovery.evidence.result,
      },
      testQongBank,
    );
  });
}

describe("Quantum Box save v5", () => {
  it("advances a completed unsuccessful Medium descent after its canonical presentation", () => {
    const repository = testRepository(new MemoryStorage());
    completeStage(repository, "qong");
    const pack = selectStorySkiPixlPack(0, "P84");
    const run = skiPixlStoryContext(pack, 99, "skipixl-medium");
    repository.recordStoryAttempt(run);
    repository.recordSkiPixlCutResult(run, {
      qualified: false,
      attempt: skiPixlAttempt(pack, run, false),
    });

    prepareCanonicalStoryCompletion(repository, run);
    const save = repository.completeStoryRun(run, null);

    expect(save.story.currentStage).toBe("skipixl");
    expect(save.story.completedStages).toContain("skipixl-medium");
    expect(save.story.skipixlCuts.tripletCursor).toBe(1);
    expect(save.story.skipixlCuts.completedAttempts).toMatchObject([
      {
        stageId: "skipixl-medium",
        cutId: "P84",
        qualified: false,
        runId: run.runId,
      },
    ]);
    expect(save.story.qualifiedRuns["skipixl-medium"]).toEqual(run);
  });

  it("persists Medium and Hard receipts, carries the triplet, and rotates it after failure", () => {
    const repository = testRepository(new MemoryStorage());
    completeStage(repository, "qong");
    expect(repository.snapshot().story.currentStage).toBe("skipixl-medium");

    const first = selectStorySkiPixlPack(0, "P84");
    const failedRun = skiPixlStoryContext(first, 101, "skipixl-medium");
    repository.recordStoryAttempt(failedRun);
    let save = repository.recordSkiPixlCutResult(failedRun, {
      qualified: false,
      attempt: skiPixlAttempt(first, failedRun, false),
    });
    expect(save.story.skipixlCuts).toMatchObject({
      currentCut: "P84",
      tripletCursor: 1,
      tripletId: null,
      successfulPasses: [],
      completedAttempts: [{ qualified: false, runId: failedRun.runId }],
    });

    const p84 = selectStorySkiPixlPack(1, "P84");
    const p84Run = skiPixlStoryContext(p84, 102, "skipixl-medium");
    repository.recordStoryAttempt(p84Run);
    save = repository.recordSkiPixlCutResult(p84Run, {
      qualified: true,
      pass: skiPixlPass(p84, p84Run),
      attempt: skiPixlAttempt(p84, p84Run, true),
    });
    expect(save.story.skipixlCuts.currentCut).toBe("P78");
    expect(save.story.skipixlCuts.tripletId).toBe(p84.payload.tripletId);
    expect(save.story.skipixlCuts.successfulPasses).toHaveLength(1);
    prepareCanonicalStoryCompletion(repository, p84Run);
    repository.completeStoryRun(p84Run, null);
    expect(repository.snapshot().story.currentStage).toBe("skipixl");

    const carriedP78 = selectStorySkiPixlPack(
      999,
      "P78",
      save.story.skipixlCuts.tripletId ?? undefined,
    );
    expect(carriedP78.payload.tripletId).toBe(p84.payload.tripletId);
    const failedHardRun = skiPixlStoryContext(carriedP78, 103);
    repository.recordStoryAttempt(failedHardRun);
    save = repository.recordSkiPixlCutResult(failedHardRun, {
      qualified: false,
      attempt: skiPixlAttempt(carriedP78, failedHardRun, false),
    });
    expect(save.story.skipixlCuts.tripletCursor).toBe(2);
    expect(save.story.skipixlCuts.tripletId).toBeNull();

    const p78 = selectStorySkiPixlPack(
      save.story.skipixlCuts.tripletCursor,
      "P78",
      save.story.skipixlCuts.tripletId ?? undefined,
    );
    const p78Run = skiPixlStoryContext(p78, 104);
    repository.recordStoryAttempt(p78Run);
    save = repository.recordSkiPixlCutResult(p78Run, {
      qualified: true,
      pass: skiPixlPass(p78, p78Run),
      attempt: skiPixlAttempt(p78, p78Run, true),
    });
    expect(save.story.skipixlCuts.currentCut).toBe("P78");
    expect(
      save.story.skipixlCuts.successfulPasses.map(({ cutId }) => cutId),
    ).toEqual(["P84", "P78"]);
    expect(save.story.skipixlCuts.completedAttempts).toHaveLength(4);
    expect(
      save.story.skipixlCuts.completedAttempts.map(
        ({ qualified }) => qualified,
      ),
    ).toEqual([false, true, false, true]);
  });

  it("is versioned, frozen, exportable, and resettable across all five storage generations", () => {
    const storage = new MemoryStorage();
    const repository = testRepository(storage);

    repository.updateSettings({
      reducedMotion: true,
      backgroundProgrammeId: "adaptive-direct-v1",
      arcadeInitials: "QBX",
    });
    expect(repository.snapshot().schemaVersion).toBe("quantum-box-save-v5");
    expect(repository.snapshot().settings).toMatchObject({
      reducedMotion: true,
      backgroundProgrammeId: "adaptive-direct-v1",
      arcadeInitials: "QBX",
    });
    expect(repository.snapshot().story.pendingNarrativeBeat).toBeNull();
    expect(repository.snapshot().story.firstLossExplanations).toEqual({
      qong: false,
      fluxball: false,
    });
    expect(repository.snapshot().arcadeRecords.skipixl.easy).toEqual([]);
    expect(Object.isFrozen(repository.snapshot())).toBe(true);
    expect(JSON.parse(repository.exportJson())).toEqual(repository.snapshot());
    expect(SAVE_EXPORT_FILENAME).toBe("quantum-box-save-v5.json");
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();

    for (const key of [
      PREVIOUS_SAVE_STORAGE_KEY,
      LEGACY_SAVE_STORAGE_KEY,
      EARLIEST_SAVE_STORAGE_KEY,
      INITIAL_SAVE_STORAGE_KEY,
    ]) {
      storage.setItem(key, "stale");
    }
    expect(repository.reset()).toEqual(createDefaultSave());
    expect(storage.length).toBe(0);
  });

  it("persists each first-loss explanation once and reset clears both", () => {
    const repository = testRepository(new MemoryStorage());

    const qong = repository.markFirstLossExplanationSeen("qong");
    expect(qong.story.firstLossExplanations).toEqual({
      qong: true,
      fluxball: false,
    });
    expect(repository.markFirstLossExplanationSeen("qong")).toBe(qong);

    expect(
      repository.markFirstLossExplanationSeen("fluxball").story
        .firstLossExplanations,
    ).toEqual({ qong: true, fluxball: true });
    expect(repository.reset().story.firstLossExplanations).toEqual({
      qong: false,
      fluxball: false,
    });
  });

  it("saves scoreboard initials and the retained record in one validated commit", () => {
    const repository = testRepository(new MemoryStorage());
    const recorded = repository.recordSkiPixlArcadeScore(
      {
        kind: "skipixl",
        difficulty: "easy",
        runId: "run-repeatable",
        rulesVersion: "skipixl-rules-test",
        pack: {
          packId: "skipixl-pack-test",
          contentSha256: "a".repeat(64),
          schemaVersion: "skipixl-pack-test-v1",
          source: "moth-platform-qpu-capture",
        },
        officialTimeMs: 42_000,
        missedGates: 1,
        collisions: 2,
      },
      "YOU",
    );
    const sequence = recorded.arcadeRecords.skipixl.easy[0]?.recordedSequence;
    if (!sequence) throw new Error("Test score did not persist.");

    const updated = repository.updateArcadeScoreInitials(sequence, "qbx");
    expect(updated.settings.arcadeInitials).toBe("QBX");
    expect(updated.arcadeRecords.skipixl.easy[0]?.initials).toBe("QBX");
    expect(validateSave(JSON.parse(repository.exportJson()))).toEqual(updated);
  });

  it("discards corrupt state across every supported storage key", () => {
    const storage = new MemoryStorage();
    for (const key of [
      SAVE_STORAGE_KEY,
      PREVIOUS_SAVE_STORAGE_KEY,
      LEGACY_SAVE_STORAGE_KEY,
      EARLIEST_SAVE_STORAGE_KEY,
      INITIAL_SAVE_STORAGE_KEY,
    ]) {
      storage.setItem(key, "not-json");
    }

    expect(testRepository(storage).snapshot()).toEqual(createDefaultSave());
    expect(storage.length).toBe(0);
  });

  it("requires the exact eight-stage prefix and the matching next stage", () => {
    const base = createDefaultSave();
    expect(() =>
      validateSave({
        ...base,
        story: { ...base.story, recoveredFormulae: ["qong", "qong"] },
      }),
    ).toThrow("duplicates");
    expect(() =>
      validateSave({
        ...base,
        story: {
          ...base.story,
          currentStage: "fluxball-two",
          completedStages: ["qong", "skipixl"],
        },
      }),
    ).toThrow("exact Story prefix");
    expect(() =>
      validateSave({
        ...base,
        story: {
          ...base.story,
          currentStage: "quantman",
          completedStages: ["qong"],
        },
      }),
    ).toThrow("next Story stage");
  });

  it("advances all eight stages and unlocks each formula only after its debrief stage", () => {
    const repository = testRepository(new MemoryStorage());
    const formulaeAfterStage = new Map<StoryStageId, readonly string[]>([
      ["qong", ["qong"]],
      ["skipixl-medium", ["qong"]],
      ["skipixl", ["qong", "skipixl"]],
      ["fluxball-two", ["qong", "skipixl"]],
      ["fluxball-four", ["qong", "skipixl", "fluxball"]],
      ["quantman-stabilize", ["qong", "skipixl", "fluxball"]],
      ["quantman", ["qong", "skipixl", "fluxball", "quantman"]],
      ["quarry", ["qong", "skipixl", "fluxball", "quantman"]],
    ]);

    for (const [index, stage] of STORY_SEQUENCE.entries()) {
      const save = completeStage(repository, stage);
      expect(save.story.completedStages).toEqual(
        STORY_SEQUENCE.slice(0, index + 1),
      );
      expect(save.story.currentStage).toBe(
        STORY_SEQUENCE[index + 1] ?? "complete",
      );
      expect(save.story.recoveredFormulae).toEqual(
        formulaeAfterStage.get(stage),
      );
      expect(save.story.qualifiedRuns[stage]).toEqual(storyContext(stage));
    }
    expect(repository.snapshot().story.debriefedFormulae).toEqual([
      "qong",
      "skipixl",
      "fluxball",
      "quantman",
    ]);
    expect(repository.snapshot().story.tutorialRecoveries).toEqual({});
  });

  it("stores and resumes a qualified narrative beat before advancing Story", () => {
    const storage = new MemoryStorage();
    const repository = testRepository(storage);
    const context = fixtures.qong.context;
    repository.recordStoryAttempt(context);

    let save = repository.recordPendingNarrativeBeat(context, {
      beatId: "qong-opponent-paddle-morph",
      kind: "debrief",
      activeTick: 9_001,
      evidenceSha256: "a".repeat(64),
    });
    expect(save.story.currentStage).toBe("qong");
    expect(save.story.completedStages).toEqual([]);
    expect(save.story.pendingNarrativeBeat).toMatchObject({
      stage: "qong",
      beatId: "qong-opponent-paddle-morph",
      qualifiedRun: context,
    });

    save = repository.updatePendingNarrativeBeat("qong-well-done");
    expect(
      testRepository(storage).snapshot().story.pendingNarrativeBeat,
    ).toEqual(save.story.pendingNarrativeBeat);
    expect(() => repository.completeStoryRun(context, null)).toThrow(
      "has not reached its completion beat",
    );
    const otherRun = createRunContext({
      gameId: "qong",
      storyStage: "qong",
      playMode: "story",
      rulesVersion: context.rulesVersion,
      runSeed: 22,
      pack: context.pack,
      packSelection: context.packSelection,
    });
    repository.updatePendingNarrativeBeat(finalStoryBeatId("qong"));
    expect(() => repository.completeStoryRun(otherRun, null)).toThrow(
      "does not match its qualified Story presentation run",
    );
    expect(
      repository.completeStoryRun(context, null).story.pendingNarrativeBeat,
    ).toBeNull();
  });

  it("rejects pending beat ids outside the stage presentation flow", () => {
    const storage = new MemoryStorage();
    const repository = testRepository(storage);
    const context = fixtures.qong.context;
    repository.recordStoryAttempt(context);
    const save = repository.recordPendingNarrativeBeat(context, {
      beatId: "qong-opponent-paddle-morph",
      kind: "debrief",
      activeTick: 100,
      evidenceSha256: "b".repeat(64),
    });

    expect(() =>
      repository.updatePendingNarrativeBeat("not-a-qong-beat"),
    ).toThrow("not valid for its stage");
    expect(repository.snapshot()).toEqual(save);

    const tampered = structuredClone(save);
    if (tampered.story.pendingNarrativeBeat === null) {
      throw new Error("Pending narrative fixture was not created.");
    }
    (tampered.story.pendingNarrativeBeat as { beatId: string }).beatId =
      "not-a-qong-beat";
    expect(() => validateSave(tampered)).toThrow(
      "not part of its canonical presentation flow",
    );
  });

  it("rejects a pending beat whose frozen run identity was edited", () => {
    const repository = testRepository(new MemoryStorage());
    repository.recordStoryAttempt(fixtures.qong.context);
    const save = repository.recordPendingNarrativeBeat(fixtures.qong.context, {
      beatId: "qong-well-done",
      kind: "debrief",
      activeTick: 100,
      evidenceSha256: "b".repeat(64),
    });
    const tampered = structuredClone(save);
    if (tampered.story.pendingNarrativeBeat === null) {
      throw new Error("Pending narrative fixture was not created.");
    }
    (
      tampered.story.pendingNarrativeBeat.qualifiedRun as { runId: string }
    ).runId = "run-tampered";
    expect(() => validateSave(tampered)).toThrow(
      "pending Story run identity is inconsistent",
    );
  });

  it("rejects legacy tutorial recovery on a new canonical transition", () => {
    const repository = testRepository(new MemoryStorage());
    repository.recordStoryAttempt(fixtures.qong.context);
    expect(() =>
      repository.completeStoryRun(fixtures.qong.context, fixtures.qong.record),
    ).toThrow("canonical Story transition");
    expect(repository.snapshot().story.currentStage).toBe("qong");
    prepareCanonicalStoryCompletion(repository, fixtures.qong.context);
    expect(
      repository.completeStoryRun(fixtures.qong.context, null).story
        .currentStage,
    ).toBe("skipixl-medium");
  });

  it("requires Qong selector consumption before canonical completion", () => {
    const repository = testRepository(new MemoryStorage());
    expect(() =>
      repository.completeStoryRun(fixtures.qong.context, null),
    ).toThrow("requires its qualified canonical Story presentation");

    prepareCanonicalStoryCompletion(repository, fixtures.qong.context);
    const beforeAttempt = repository.snapshot();
    expect(() =>
      repository.completeStoryRun(fixtures.qong.context, null),
    ).toThrow(
      "requires the saved selector position produced when this run started",
    );
    expect(repository.snapshot()).toBe(beforeAttempt);

    repository.recordStoryAttempt(fixtures.qong.context);
    const completed = repository.completeStoryRun(fixtures.qong.context, null);
    const receipt = fixtures.qong.context.packSelection;
    expect(receipt).not.toBeNull();
    expect(completed.story.qongSelector).toEqual({
      cursor: receipt!.selectorCursorAfter,
      cycle: receipt!.selectorCycleAfter,
      recoveredSelection: receipt,
    });
  });

  it("migrates a completed v4 save to Quantman Stabilize without inventing new completion", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PREVIOUS_SAVE_STORAGE_KEY,
      JSON.stringify(completedLegacyV4Save()),
    );

    const migrated = testRepository(storage).snapshot();
    expect(migrated.schemaVersion).toBe("quantum-box-save-v5");
    expect(migrated.story.currentStage).toBe("quantman-stabilize");
    expect(migrated.story.completedStages).toEqual([
      "qong",
      "skipixl-medium",
      "skipixl",
      "fluxball-two",
      "fluxball-four",
    ]);
    expect(migrated.story.inspectOnlyFormulae).toContain("quantman");
    expect(migrated.story.tutorialRecoveries.quantman).toBeUndefined();
    expect(migrated.story.attempts.quantman).toBeUndefined();
    expect(migrated.story.attempts["quantman-stabilize"]).toBe(4);
    expect(migrated.story.pendingNarrativeBeat).toBeNull();
    expect(migrated.arcadeRecords.nextSequence).toBe(1);
    expect(storage.getItem(PREVIOUS_SAVE_STORAGE_KEY)).toBeNull();
  });

  it("maps P84 and P78 v4 receipts onto the new Medium and Hard boundaries", () => {
    const p90 = selectStorySkiPixlPack(0, "P90");
    const p84 = selectStorySkiPixlPack(0, "P84", p90.payload.tripletId);
    const p78 = selectStorySkiPixlPack(0, "P78", p90.payload.tripletId);
    const passes = [
      skiPixlPass(p90, skiPixlStoryContext(p90, 201)),
      skiPixlPass(p84, skiPixlStoryContext(p84, 202)),
      skiPixlPass(p78, skiPixlStoryContext(p78, 203)),
    ];

    const mediumStorage = new MemoryStorage();
    mediumStorage.setItem(
      PREVIOUS_SAVE_STORAGE_KEY,
      JSON.stringify(partialLegacyV4SkiPixlSave(passes.slice(0, 2))),
    );
    const medium = testRepository(mediumStorage).snapshot();
    expect(medium.story.completedStages).toEqual(["qong", "skipixl-medium"]);
    expect(medium.story.currentStage).toBe("skipixl");
    expect(medium.story.attempts.skipixl).toBe(3);

    const hardStorage = new MemoryStorage();
    hardStorage.setItem(
      PREVIOUS_SAVE_STORAGE_KEY,
      JSON.stringify(partialLegacyV4SkiPixlSave(passes)),
    );
    const hard = testRepository(hardStorage).snapshot();
    expect(hard.story.completedStages).toEqual([
      "qong",
      "skipixl-medium",
      "skipixl",
    ]);
    expect(hard.story.currentStage).toBe("fluxball-two");
  });

  it("migrates v1 aliases into inspect-only formulae and the first SkiPixl stage", () => {
    const storage = new MemoryStorage();
    const base = createDefaultSave();
    storage.setItem(
      INITIAL_SAVE_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: "quantum-box-save-v1",
        story: {
          currentStage: "skiblur",
          completedStages: ["qong"],
          recoveredFormulae: ["qong", "skiblur"],
          attempts: { qong: 1, skiblur: 3 },
        },
        settings: {
          reducedMotion: false,
          crtFlicker: true,
          soundMuted: false,
        },
      }),
    );

    const migrated = testRepository(storage).snapshot();
    expect(migrated.story.currentStage).toBe("qong");
    expect(migrated.story.completedStages).toEqual([]);
    expect(migrated.story.recoveredFormulae).toEqual(["qong", "skipixl"]);
    expect(migrated.story.inspectOnlyFormulae).toEqual(["qong", "skipixl"]);
    expect(migrated.story.attempts).toEqual({
      qong: 1,
      "skipixl-medium": 3,
    });
    expect(migrated.settings.soundVolume).toBe(DEFAULT_SOUND_VOLUME);
    expect(migrated.settings.backgroundProgrammeId).toBe(
      base.settings.backgroundProgrammeId,
    );
    expect(migrated.arcadeRecords).toEqual(base.arcadeRecords);
  });

  it("retains a valid v4 source if writing its v5 migration is refused", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      PREVIOUS_SAVE_STORAGE_KEY,
      JSON.stringify(completedLegacyV4Save()),
    );
    const previous = storage.getItem(PREVIOUS_SAVE_STORAGE_KEY);
    storage.failWrites = true;

    expect(testRepository(storage).snapshot().schemaVersion).toBe(
      "quantum-box-save-v5",
    );
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(PREVIOUS_SAVE_STORAGE_KEY)).toBe(previous);
  });

  it("preserves a legacy recovery while its Qong bank is temporarily unavailable", () => {
    const storage = new MemoryStorage();
    const legacyAuthority = legacyQongAuthoritySave();
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(legacyAuthority));

    const locked = new SaveRepository(storage, () => {
      throw new QongStoryBankUnavailableError("bank temporarily unavailable");
    });
    expect(locked.snapshot().story).toEqual(createDefaultSave().story);
    expect(locked.snapshot().settings).toEqual(legacyAuthority.settings);
    expect(JSON.parse(locked.exportJson())).toEqual(legacyAuthority);
    expect(storage.getItem(SAVE_STORAGE_KEY)).not.toBeNull();
  });

  it("normalizes an invalid background id but rejects an invalid sound level", () => {
    const base = createDefaultSave();
    const normalized = validateSave({
      ...base,
      settings: { ...base.settings, backgroundProgrammeId: "missing" },
    });
    expect(normalized.settings.backgroundProgrammeId).toBe(
      base.settings.backgroundProgrammeId,
    );
    expect(() =>
      validateSave({
        ...base,
        settings: { ...base.settings, soundVolume: 1.01 },
      }),
    ).toThrow("soundVolume");
  });

  it("keeps memory and persisted progress unchanged when storage refuses a commit", () => {
    const storage = new MemoryStorage();
    const repository = testRepository(storage);
    repository.recordStoryAttempt(fixtures.qong.context);
    prepareCanonicalStoryCompletion(repository, fixtures.qong.context);
    const before = repository.snapshot();
    const serializedBefore = storage.getItem(SAVE_STORAGE_KEY);
    storage.failWrites = true;

    expect(() =>
      repository.completeStoryRun(fixtures.qong.context, null),
    ).toThrow("storage write refused");
    expect(repository.snapshot()).toBe(before);
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBe(serializedBefore);
  });

  it("rejects Arcade mutation authority", () => {
    const repository = testRepository(new MemoryStorage());
    const arcadeRun = createRunContext({
      gameId: "qong",
      playMode: "arcade",
      rulesVersion: "qong-rules-v1",
      runSeed: 10,
      pack: fixturePack("qong-synthetic-control-v1"),
    });

    expect(() => repository.recordStoryAttempt(arcadeRun)).toThrow(
      "Only a frozen Story run",
    );
    expect(repository.snapshot()).toEqual(createDefaultSave());
  });
});

function completeStage(
  repository: SaveRepository,
  stage: StoryStageId,
): QuantumBoxSave {
  const context = storyContext(stage);
  repository.recordStoryAttempt(context);
  prepareCanonicalStoryCompletion(repository, context);
  return repository.completeStoryRun(context, null);
}

function prepareCanonicalStoryCompletion(
  repository: SaveRepository,
  context: RunContext,
): void {
  const stage = context.storyStage;
  if (stage === null) {
    throw new Error("Canonical Story completion requires a Story stage.");
  }
  const flow = storyV2PresentationFlow(storyV2Stage(stage).presentationFlowId);
  const openingBeat = flow.beats[0];
  if (!openingBeat) {
    throw new Error(`${stage} has no canonical Story presentation beats.`);
  }
  repository.recordPendingNarrativeBeat(context, {
    beatId: openingBeat.id,
    kind: narrativeKindForStage(stage),
    activeTick: 100,
    evidenceSha256: "a".repeat(64),
  });
  for (const beat of flow.beats.slice(1)) {
    repository.updatePendingNarrativeBeat(beat.id);
  }
}

function finalStoryBeatId(stage: StoryStageId): string {
  const flow = storyV2PresentationFlow(storyV2Stage(stage).presentationFlowId);
  const finalBeat = flow.beats.at(-1);
  if (!finalBeat) throw new Error(`${stage} has no Story presentation beats.`);
  return finalBeat.id;
}

function narrativeKindForStage(stage: StoryStageId): StoryNarrativeBeatKind {
  const completion = storyV2PresentationFlow(
    storyV2Stage(stage).presentationFlowId,
  ).completion;
  if (completion.kind === "launch-stage") return "interlude";
  if (completion.kind === "complete-story") return "finale";
  return "debrief";
}

function storyContext(stage: StoryStageId): RunContext {
  if (stage === "qong") return fixtures.qong.context;
  const gameId: ArcadeCabinetId =
    stage === "quarry"
      ? "quarry"
      : stage.startsWith("skipixl")
        ? "skipixl"
        : stage.startsWith("fluxball")
          ? "fluxball"
          : "quantman";
  return createRunContext({
    gameId,
    storyStage: stage,
    playMode: "story",
    rulesVersion: `${stage}-rules-v1`,
    runSeed: 1_000 + STORY_SEQUENCE.indexOf(stage),
    pack: fixturePack(`${stage}-pack-v1`),
  });
}

function fixturePack(packId: string) {
  return Object.freeze({
    packId,
    contentSha256: "c".repeat(64),
    schemaVersion: "quantum-box-test-pack-v1",
    source: "synthetic-control",
  });
}

function completedLegacyV4Save(): Record<string, unknown> {
  const base = createDefaultSave();
  return {
    schemaVersion: "quantum-box-save-v4",
    story: {
      currentStage: "complete",
      completedStages: [
        "qong",
        "skipixl",
        "fluxball-two",
        "fluxball-four",
        "quantman",
      ],
      recoveredFormulae: ["qong", "skipixl", "fluxball", "quantman"],
      inspectOnlyFormulae: [],
      attempts: { qong: 1, skipixl: 2, "fluxball-two": 3, quantman: 4 },
      qongSelector: recoveredQongSelector(),
      skipixlCuts: base.story.skipixlCuts,
      tutorialRecoveries: {
        qong: fixtures.qong.record,
        skipixl: fixtures.skipixl.record,
        fluxball: fixtures.fluxball.record,
        quantman: fixtures.quantman.record,
      },
    },
    settings: legacyV4Settings(),
  };
}

function partialLegacyV4SkiPixlSave(
  successfulPasses: readonly ReturnType<typeof skiPixlPass>[],
): Record<string, unknown> {
  const hardComplete = successfulPasses.some(({ cutId }) => cutId === "P78");
  const tripletId = successfulPasses.at(-1)?.tripletId ?? null;
  return {
    schemaVersion: "quantum-box-save-v4",
    story: {
      currentStage: "skipixl",
      completedStages: ["qong"],
      recoveredFormulae: hardComplete ? ["qong", "skipixl"] : ["qong"],
      inspectOnlyFormulae: [],
      attempts: { qong: 1, skipixl: 3 },
      qongSelector: recoveredQongSelector(),
      skipixlCuts: {
        currentCut: successfulPasses.length >= 2 ? "P78" : "P84",
        tripletCursor: 0,
        tripletId,
        successfulPasses,
      },
      tutorialRecoveries: {
        qong: fixtures.qong.record,
        ...(hardComplete ? { skipixl: fixtures.skipixl.record } : {}),
      },
    },
    settings: legacyV4Settings(),
  };
}

function legacyQongAuthoritySave(): QuantumBoxSave {
  const base = createDefaultSave();
  return validateSave({
    ...base,
    story: {
      ...base.story,
      currentStage: "skipixl-medium",
      completedStages: ["qong"],
      recoveredFormulae: ["qong"],
      qongSelector: recoveredQongSelector(),
      tutorialRecoveries: { qong: fixtures.qong.record },
    },
  });
}

function recoveredQongSelector() {
  const receipt = fixtures.qong.context.packSelection;
  if (receipt === null)
    throw new Error("Qong fixture lacks a selector receipt.");
  return Object.freeze({
    cursor: receipt.selectorCursorAfter,
    cycle: receipt.selectorCycleAfter,
    recoveredSelection: receipt,
  });
}

function legacyV4Settings(): Record<string, unknown> {
  const settings = createDefaultSave().settings;
  return {
    reducedMotion: settings.reducedMotion,
    crtFlicker: settings.crtFlicker,
    soundMuted: settings.soundMuted,
    soundVolume: settings.soundVolume,
    keyboardBindings: settings.keyboardBindings,
  };
}

function skiPixlStoryContext(
  pack: SkiPixlCommittedPack,
  runSeed: number,
  storyStage: Extract<StoryStageId, "skipixl-medium" | "skipixl"> = "skipixl",
): RunContext {
  return createRunContext({
    gameId: "skipixl",
    storyStage,
    playMode: "story",
    rulesVersion: pack.rulesVersion,
    runSeed,
    pack: {
      packId: pack.packId,
      contentSha256: pack.contentSha256,
      schemaVersion: pack.schemaVersion,
      source: pack.source,
    },
  });
}

function skiPixlPass(pack: SkiPixlCommittedPack, context: RunContext) {
  if (pack.payload.receipt.schemaVersion !== "skipixl-course-receipt-v7") {
    throw new Error("Expected a v7 SkiPixl course receipt.");
  }
  return {
    cutId: pack.payload.receipt.cutId,
    tripletId: pack.payload.receipt.tripletId,
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    runId: context.runId,
    elapsedSeconds: 60,
    collisionCount: 2,
  } as const;
}

function skiPixlAttempt(
  pack: SkiPixlCommittedPack,
  context: RunContext,
  qualified: boolean,
) {
  const receipt = pack.payload.receipt;
  if (
    receipt.schemaVersion !== "skipixl-course-receipt-v7" ||
    context.storyStage === null
  ) {
    throw new Error("Expected a v7 SkiPixl Story course receipt.");
  }
  return {
    stageId: context.storyStage as "skipixl-medium" | "skipixl",
    cutId: receipt.cutId,
    tripletId: receipt.tripletId,
    packId: pack.packId,
    contentSha256: pack.contentSha256,
    runId: context.runId,
    qualified,
    elapsedSeconds: 60,
    collisionCount: 2,
    gateCount: 2,
    passedGateCount: 1,
    missedGateCount: 1,
    courseReceiptSchemaVersion: receipt.schemaVersion,
    bankId: receipt.bankId,
    bankContentSha256: receipt.bankContentSha256,
    decoderVersion: receipt.decoderVersion,
    segments: receipt.segments.map((segment) => ({
      order: segment.order,
      segmentId: segment.segmentId,
      sourceSha256: segment.sourceSha256,
      returnedValuesSha256: segment.returnedValuesSha256,
      mothJobId: segment.mothJobId,
      ibmJobId: segment.ibmJobId,
    })),
  } as const;
}
