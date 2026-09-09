import { describe, expect, it } from "vitest";

import { createRunContext } from "../../src/core/run";
import { createEmptyArcadeRecords } from "../../src/save/ArcadeRecords";
import {
  SAVE_EXPORT_FILENAME,
  SAVE_STORAGE_KEY,
  SaveRepository,
} from "../../src/save/SaveRepository";
import {
  SAVE_SCHEMA_VERSION,
  createDefaultSave,
  validateSave,
} from "../../src/save/types";

const HASH = "a".repeat(64);

describe("save v6 Story graph", () => {
  it("starts at the introduction with empty evidence and leaderboards", () => {
    const save = createDefaultSave();
    expect(save.schemaVersion).toBe("quantum-box-save-v6");
    expect(SAVE_SCHEMA_VERSION).toBe("quantum-box-save-v6");
    expect(SAVE_STORAGE_KEY).toBe("quantum-box/save-v6");
    expect(SAVE_EXPORT_FILENAME).toBe("quantum-box-save-v6.json");
    expect(save.story.currentNodeId).toBe("intro-1");
    expect(save.story.clearedStages).toEqual([]);
    expect(save.arcadeRecords).toEqual(createEmptyArcadeRecords());
  });

  it("persists terminal transitions before a cabinet launches", () => {
    const repository = new SaveRepository(new MemoryStorage(), () => undefined);
    repository.setStoryNode("skipixl-feasible-tutorial");
    const advanced = repository.advanceStoryTerminal("play");
    expect(advanced.story.currentNodeId).toBe("game-skipixl-feasible");
  });

  it("branches a main Story outcome but leaves the cursor fixed for Terminal retries", () => {
    const repository = new SaveRepository(new MemoryStorage(), () => undefined);
    const run = skiRun("skipixl-feasible", 41);
    repository.setStoryNode("game-skipixl-feasible");
    repository.recordStoryAttempt(run);
    const finished = repository.recordStoryOutcome(run, "finished");
    expect(finished.story.currentNodeId).toBe("skipixl-feasible-response");
    expect(finished.story.clearedStages).toContain("skipixl-feasible");

    const retryRun = skiRun("skipixl-overloaded", 43);
    repository.recordStoryAttempt(retryRun, "terminal-retry");
    const retried = repository.recordStoryOutcome(
      retryRun,
      "failed",
      "terminal-retry",
    );
    expect(retried.story.currentNodeId).toBe("skipixl-feasible-response");
    expect(retried.story.lastOutcomes["skipixl-overloaded"]).toBe("failed");
  });

  it("unlocks a transcript only after every required chapter stage clears", () => {
    const repository = new SaveRepository(new MemoryStorage(), () => undefined);
    expect(() => repository.markTranscriptSeen("skipixl")).toThrow(
      "required clears",
    );
    for (const [stage, seed] of [
      ["skipixl-feasible", 47],
      ["skipixl-overloaded", 53],
    ] as const) {
      const run = skiRun(stage, seed);
      repository.recordStoryAttempt(run, "terminal-retry");
      repository.recordStoryOutcome(run, "finished", "terminal-retry");
    }
    expect(
      repository.markTranscriptSeen("skipixl").story.transcriptSeen,
    ).toEqual(["skipixl"]);
  });

  it("migrates v5 proof without upgrading obsolete 4P Individual evidence", () => {
    const base = createDefaultSave();
    const oldStory = {
      currentStage: "complete",
      completedStages: [
        "qong",
        "skipixl-medium",
        "skipixl",
        "fluxball-two",
        "fluxball-four",
        "quantman-stabilize",
        "quantman",
        "quarry",
      ],
      attempts: {
        qong: 1,
        "skipixl-medium": 1,
        skipixl: 1,
        "fluxball-two": 1,
        "fluxball-four": 1,
        "quantman-stabilize": 1,
        quarry: 1,
      },
      qongSelector: { cursor: 0, cycle: 0, recoveredSelection: null },
      skipixlCuts: {
        currentCut: "P78",
        tripletCursor: 0,
        tripletId: "triplet-a",
        successfulPasses: [skiPass("P84"), skiPass("P78")],
        completedAttempts: [],
      },
      tutorialRecoveries: {},
      qualifiedRuns: {},
      firstLossExplanations: { qong: false, fluxball: false },
    };
    const migrated = validateSave({
      schemaVersion: "quantum-box-save-v5",
      story: oldStory,
      settings: base.settings,
      arcadeRecords: createEmptyArcadeRecords(),
    });
    expect(migrated.story.clearedStages).toEqual([
      "qong",
      "skipixl-feasible",
      "skipixl-overloaded",
      "quantman-hold",
      "fluxball-global",
      "quarry",
    ]);
    expect(migrated.story.clearedStages).not.toContain("fluxball-individual");
    expect(migrated.story.currentNodeId).toBe("fluxball-individual-pre");
    expect(migrated.story.legacyV5).toEqual(oldStory);
  });

  it("recovers an invalid node at the earliest unfinished stage", () => {
    const base = createDefaultSave();
    const recovered = validateSave({
      ...base,
      story: {
        ...base.story,
        currentNodeId: "not-a-story-node",
        experiencedStages: ["qong"],
        clearedStages: ["qong"],
        completedStages: ["qong"],
      },
    });
    expect(recovered.story.currentNodeId).toBe("skipixl-intro");
  });

  it("shows Quantman's first-failure page after the first loss, not the first launch", () => {
    const repository = new SaveRepository(new MemoryStorage(), () => undefined);
    repository.setStoryNode("game-quantman-hold");
    repository.recordStoryAttempt(quantmanRun(131));
    repository.recordStoryAttempt(quantmanRun(137));
    const firstLoss = repository.recordStoryOutcome(quantmanRun(137), "lost");
    expect(firstLoss.story.currentNodeId).toBe("quantman-loss-first");
    expect(firstLoss.story.firstLossExplanations.quantman).toBe(true);

    repository.setStoryNode("game-quantman-hold");
    repository.recordStoryAttempt(quantmanRun(139));
    expect(
      repository.recordStoryOutcome(quantmanRun(139), "lost").story
        .currentNodeId,
    ).toBe("quantman-loss-later");
  });
});

function skiRun(
  stage: "skipixl-feasible" | "skipixl-overloaded",
  runSeed: number,
) {
  return createRunContext({
    gameId: "skipixl",
    storyStage: stage,
    playMode: "story",
    rulesVersion: "skipixl-rules-test-v1",
    runSeed,
    pack: {
      packId: `${stage}-test-pack`,
      contentSha256: HASH,
      schemaVersion: "test-pack-v1",
      source: "test-fixture",
    },
  });
}

function quantmanRun(runSeed: number) {
  return createRunContext({
    gameId: "quantman",
    storyStage: "quantman-hold",
    playMode: "story",
    rulesVersion: "quantman-rules-test-v1",
    runSeed,
    pack: {
      packId: "quantman-test-pack",
      contentSha256: HASH,
      schemaVersion: "test-pack-v1",
      source: "test-fixture",
    },
  });
}

function skiPass(cutId: "P84" | "P78") {
  return {
    cutId,
    tripletId: "triplet-a",
    packId: `${cutId.toLowerCase()}-pack`,
    contentSha256: HASH,
    runId: `${cutId.toLowerCase()}-run`,
    elapsedSeconds: 59,
    collisionCount: 1,
  };
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
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
    this.values.set(key, value);
  }
}
