import { describe, expect, it } from "vitest";
import { createRunContext } from "../../src/core/run";
import { STORY_SEQUENCE, type StoryStageId } from "../../src/games/registry";
import {
  SaveRepository,
  SAVE_STORAGE_KEY,
} from "../../src/save/SaveRepository";
import { createDefaultSave, validateSave } from "../../src/save/types";
import {
  inferLegacyReadPageIds,
  readTranscriptPageIds,
  storyNode,
  storyTerminalPage,
} from "../../src/story/terminal";
import {
  TEST_QONG_SELECTION,
  TEST_QONG_PACK_ID,
  TEST_QONG_PACK_HASH,
} from "../fixtures/qongStoryBank";

describe("Story read history", () => {
  it.each([false, true])(
    "completes the full narrative with all successful outcomes=%s",
    (successful) => {
      const storage = new MemoryStorage();
      const repo = new SaveRepository(storage, () => undefined);
      const attempted: StoryStageId[] = [];
      let steps = 0;
      while (
        repo.snapshot().story.currentNodeId !== "story-complete" &&
        steps++ < 100
      ) {
        const node = storyNode(repo.snapshot().story.currentNodeId);
        if (node.kind === "game-launch") {
          attempted.push(node.stageId);
          const run = runFor(
            node.stageId,
            repo.snapshot().story.qongSelector.cursor,
          );
          repo.recordStoryAttempt(run);
          const outcome = node.stageId.startsWith("skipixl")
            ? successful
              ? "finished"
              : "failed"
            : successful
              ? "won"
              : "lost";
          repo.recordStoryOutcome(run, outcome);
          const result = storyNode(repo.snapshot().story.currentNodeId);
          if (!("pageId" in result))
            throw new Error("Expected an outcome page");
          expect(
            storyTerminalPage(result.pageId).actions.map((action) => action.id),
          ).toEqual(
            successful
              ? ["continue"]
              : result.id.endsWith("loss-first")
                ? ["retry"]
                : ["retry", "continue"],
          );
        } else if ("transitions" in node) {
          repo.advanceStoryTerminal(
            node.transitions.continue
              ? "continue"
              : node.transitions.retry
                ? "retry"
                : "play",
          );
        } else {
          throw new Error(`Unexpected narrative node ${node.id}`);
        }
      }
      expect(steps).toBeLessThan(100);
      expect(attempted).toEqual(
        successful
          ? STORY_SEQUENCE
          : STORY_SEQUENCE.flatMap((stage) =>
              stage === "qong" || stage === "quantman-hold"
                ? [stage, stage]
                : [stage],
            ),
      );
      expect(repo.snapshot().story.storyCompleted).toBe(true);
      expect(repo.snapshot().story.readPageIds.slice(-2)).toEqual([
        "postscript-1",
        "postscript-2",
      ]);
      expect(repo.snapshot().story.clearedStages).toEqual(
        successful ? STORY_SEQUENCE : [],
      );
      expect(Object.keys(repo.snapshot().story.qualifiedRuns)).toEqual(
        successful ? STORY_SEQUENCE : [],
      );
      expect(new SaveRepository(storage, () => undefined).snapshot()).toEqual(
        repo.snapshot(),
      );
    },
  );

  it("records fully displayed pages, ignores stale callbacks, and survives reload", () => {
    const storage = new MemoryStorage();
    const repo = new SaveRepository(storage, () => undefined);
    expect(repo.snapshot().story.readPageIds).toEqual([]);
    repo.setStoryNode("qong-loss-first");
    expect(repo.snapshot().story.readPageIds).toEqual([]);
    repo.markStoryPageRead("intro-1");
    expect(repo.snapshot().story.readPageIds).toEqual([]);
    repo.markStoryPageRead("qong-loss-first");
    repo.markStoryPageRead("qong-loss-first");
    expect(repo.snapshot().story.readPageIds).toEqual(["qong-loss-first"]);
    expect(new SaveRepository(storage, () => undefined).snapshot()).toEqual(
      repo.snapshot(),
    );
  });

  it("records the source, not an unseen destination, when continuing or retrying", () => {
    const repo = new SaveRepository(new MemoryStorage(), () => undefined);
    repo.advanceStoryTerminal("continue");
    expect(repo.snapshot().story.readPageIds).toEqual(["intro-1"]);
    repo.setStoryNode("qong-loss-first");
    repo.advanceStoryTerminal("retry");
    expect(repo.snapshot().story.readPageIds).toEqual([
      "intro-1",
      "qong-loss-first",
    ]);
    repo.markStoryPageRead("game-qong");
    expect(repo.snapshot().story.readPageIds).toEqual([
      "intro-1",
      "qong-loss-first",
    ]);
  });

  it("retains read history without using it to grant transcript access", () => {
    const repo = new SaveRepository(new MemoryStorage(), () => undefined);
    for (const id of [
      "intro-1",
      "qong-intro",
      "qong-loss-first",
      "qong-debrief-1",
      "load-skipixl",
    ]) {
      repo.setStoryNode(id);
      repo.markStoryPageRead(id);
    }
    const before = repo.snapshot();
    expect(readTranscriptPageIds("qong", before.story.readPageIds)).toEqual([
      "intro-1",
      "qong-intro",
      "qong-loss-first",
      "qong-debrief-1",
    ]);
    expect(readTranscriptPageIds("skipixl", before.story.readPageIds)).toEqual([
      "load-skipixl",
    ]);
    expect(repo.snapshot()).toBe(before);
    expect(() => repo.markTranscriptSeen("qong")).toThrow(
      "All chapter stages must be cleared",
    );
    expect(repo.snapshot().story.qualifiedRuns).toEqual({});
    expect(repo.snapshot().story.clearedStages).toEqual([]);
    const cleared = runFor("qong");
    repo.recordStoryAttempt(cleared, "terminal-retry");
    repo.recordStoryOutcome(cleared, "won", "terminal-retry");
    expect(repo.markTranscriptSeen("qong").story.transcriptSeen).toEqual([
      "qong",
    ]);
    repo.setStoryNode("qong-debrief-2");
    repo.markStoryPageRead("qong-debrief-2");
    expect(repo.snapshot().story.transcriptSeen).toEqual([]);
    repo.replayStoryFromStart();
    expect(repo.snapshot().story.readPageIds).toContain("qong-loss-first");
  });

  it.each([
    ["ending-4", "won"],
    ["ending-4", "lost"],
    ["story-complete", "won"],
    ["story-complete", "lost"],
  ] as const)(
    "retains the %s narrative cursor after an independent retry is %s",
    (nodeId, outcome) => {
      const storage = new MemoryStorage();
      const repo = new SaveRepository(storage, () => undefined);
      repo.setStoryNode("quantman-loss-first");
      repo.markStoryPageRead("quantman-loss-first");
      repo.setStoryNode(nodeId);
      const before = repo.snapshot().story;
      const run = runFor("quantman-hold");
      repo.recordStoryAttempt(run, "terminal-retry");
      repo.recordStoryOutcome(run, outcome, "terminal-retry");
      const after = new SaveRepository(storage, () => undefined).snapshot()
        .story;
      expect(after.currentNodeId).toBe(before.currentNodeId);
      expect(after.storyCompleted).toBe(before.storyCompleted);
      expect(after.readPageIds).toEqual(before.readPageIds);
      expect(after.clearedStages).toEqual(
        outcome === "won" ? ["quantman-hold"] : [],
      );
      expect(after.qualifiedRuns["quantman-hold"]).toEqual(
        outcome === "won" ? run : undefined,
      );
    },
  );

  it("recovers mandatory predecessor pages without inferring unseen outcome branches", () => {
    const read = inferLegacyReadPageIds("fluxball-individual-pre");
    expect(read).toEqual(
      expect.arrayContaining([
        "intro-1",
        "intro-2",
        "intro-3",
        "qong-intro",
        "qong-tutorial",
        "qong-debrief-1",
        "skipixl-intro",
        "quantman-intro",
        "fluxball-split-intro",
      ]),
    );
    for (const unseen of [
      "qong-success",
      "qong-loss-first",
      "qong-loss-later",
      "quantman-success",
      "fluxball-global-post-win",
      "fluxball-global-post-loss",
      "fluxball-individual-pre",
      "postscript-1",
    ]) {
      expect(read).not.toContain(unseen);
    }
    const base = createDefaultSave();
    const { readPageIds: _history, ...legacyStory } = base.story;
    const migrated = validateSave({
      ...base,
      story: { ...legacyStory, currentNodeId: "fluxball-individual-pre" },
    });
    expect(migrated.story.readPageIds).toEqual(read);
    expect(migrated.story.clearedStages).toEqual([]);
    expect(inferLegacyReadPageIds("unknown-page")).toEqual([]);
  });

  it("resumes an old completed save at the unread Postscript without resetting evidence", () => {
    const base = createDefaultSave();
    const { readPageIds: _history, ...legacyStory } = base.story;
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_STORAGE_KEY,
      JSON.stringify({
        ...base,
        settings: { ...base.settings, soundVolume: 0.27 },
        story: {
          ...legacyStory,
          currentNodeId: "story-complete",
          storyCompleted: true,
          experiencedStages: ["quarry"],
          clearedStages: ["quarry"],
          attempts: { quarry: 2 },
          lastOutcomes: { quarry: "won" },
        },
      }),
    );
    const repo = new SaveRepository(storage, () => undefined);
    expect(repo.snapshot().story.currentNodeId).toBe("postscript-1");
    expect(repo.snapshot().story.storyCompleted).toBe(false);
    expect(repo.snapshot().story.clearedStages).toEqual(["quarry"]);
    expect(repo.snapshot().story.attempts).toEqual({ quarry: 2 });
    expect(repo.snapshot().story.lastOutcomes).toEqual({ quarry: "won" });
    expect(repo.snapshot().story.qualifiedRuns).toEqual({});
    expect(repo.snapshot().settings.soundVolume).toBe(0.27);
    expect(repo.snapshot().arcadeRecords).toEqual(base.arcadeRecords);
    expect(repo.snapshot().story.readPageIds).toContain("ending-4");
    expect(repo.snapshot().story.readPageIds).not.toContain("quarry-post-win");
    expect(repo.snapshot().story.readPageIds).not.toContain("postscript-1");
    expect(repo.snapshot().story.readPageIds).not.toContain("postscript-2");
    repo.advanceStoryTerminal("continue");
    repo.advanceStoryTerminal("continue");
    const reloaded = new SaveRepository(storage, () => undefined).snapshot();
    expect(reloaded.story.currentNodeId).toBe("story-complete");
    expect(reloaded.story.storyCompleted).toBe(true);
    expect(reloaded.story.clearedStages).toEqual(["quarry"]);
    expect(readTranscriptPageIds("quarry", reloaded.story.readPageIds)).toEqual(
      expect.arrayContaining(["postscript-1", "postscript-2"]),
    );
  });

  it("keeps explicit read histories exact and rejects unknown or duplicate page IDs", () => {
    const base = createDefaultSave();
    expect(
      validateSave({
        ...base,
        story: { ...base.story, currentNodeId: "ending-4" },
      }).story.readPageIds,
    ).toEqual([]);
    for (const readPageIds of [
      ["unrecognized"],
      ["constructor"],
      ["__proto__"],
      ["intro-1", "intro-1"],
    ]) {
      expect(() =>
        validateSave({ ...base, story: { ...base.story, readPageIds } }),
      ).toThrow();
    }
  });

  it.each(["postscript-1", "postscript-2"])(
    "retains an old in-progress %s cursor without claiming the current page was read",
    (currentNodeId) => {
      const base = createDefaultSave();
      const { readPageIds: _history, ...legacyStory } = base.story;
      const migrated = validateSave({
        ...base,
        story: { ...legacyStory, currentNodeId },
      });
      expect(migrated.story.currentNodeId).toBe(currentNodeId);
      expect(migrated.story.storyCompleted).toBe(false);
      expect(migrated.story.readPageIds.includes("postscript-1")).toBe(
        currentNodeId === "postscript-2",
      );
      expect(migrated.story.readPageIds).not.toContain("postscript-2");
      expect(migrated.story.clearedStages).toEqual([]);
      expect(validateSave(migrated)).toEqual(migrated);
    },
  );

  it("handles the persisted Quantman alias and preserves legacy narrative order", () => {
    expect(inferLegacyReadPageIds("quantman-explain-4")).toEqual(
      inferLegacyReadPageIds("quantman-explain-5"),
    );
    expect(inferLegacyReadPageIds("quantman-explain-4")).toContain(
      "quantman-explain-3",
    );
    expect(inferLegacyReadPageIds("quantman-explain-4")).not.toContain(
      "quantman-explain-5",
    );
    const fluxball = readTranscriptPageIds(
      "fluxball",
      inferLegacyReadPageIds("ending-4"),
    );
    expect(fluxball.indexOf("fluxball-split-intro")).toBeLessThan(
      fluxball.indexOf("fluxball-individual-pre"),
    );
  });

  it.each(["constructor", "toString", "__proto__"])(
    "rejects prototype member %s as a Story identity",
    (id) => {
      const base = createDefaultSave();
      const { readPageIds: _history, ...legacyStory } = base.story;
      const recovered = validateSave({
        ...base,
        story: { ...legacyStory, currentNodeId: id },
      });
      expect(recovered.story.currentNodeId).toBe("qong-intro");
      expect(recovered.story.readPageIds).toEqual([]);
      expect(() => storyNode(id)).toThrow("Unknown Story node");
      expect(() => storyTerminalPage(id)).toThrow(
        "Unknown Story terminal page",
      );
    },
  );
});

function runFor(stage: StoryStageId, qongSelectorCursor = 0) {
  const gameId =
    stage === "qong" || stage === "quarry"
      ? stage
      : stage.startsWith("skipixl")
        ? "skipixl"
        : stage.startsWith("fluxball")
          ? "fluxball"
          : "quantman";
  return createRunContext({
    gameId,
    storyStage: stage,
    playMode: "story",
    rulesVersion: "story-routing-test-v1",
    runSeed: 71,
    pack: {
      packId: stage === "qong" ? TEST_QONG_PACK_ID : `${stage}-test-pack`,
      contentSha256: stage === "qong" ? TEST_QONG_PACK_HASH : "a".repeat(64),
      schemaVersion: "test-pack-v1",
      source: stage === "qong" ? "moth-api-qpu" : "test-fixture",
    },
    packSelection:
      stage === "qong"
        ? {
            ...TEST_QONG_SELECTION,
            selectorCursorBefore: qongSelectorCursor,
            selectorCursorAfter: qongSelectorCursor + 2,
            selectorBitIndices: [qongSelectorCursor, qongSelectorCursor + 1],
          }
        : null,
  });
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
