import { describe, expect, it } from "vitest";
import { SaveRepository } from "../../src/save/SaveRepository";
import { validateSave } from "../../src/save/types";
import { persistSkiPixlStoryResult } from "../../src/app/StoryResultPersistence";
import { selectStorySkiPixlPack } from "../../src/games/skipixl/SkiPixlCourseAdapter";
import { createRunContext } from "../../src/core/run";
import { postscriptUnlocked } from "../../src/story/terminal/postscript";

function setup() {
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v),
    removeItem: (k: string) => data.delete(k),
  };
  const repository = new SaveRepository(storage, () => undefined);
  return {
    repository,
    reload: () => new SaveRepository(storage, () => undefined),
  };
}
function finish(
  repository: SaveRepository,
  stage: "skipixl-feasible" | "skipixl-overloaded",
  qualified: boolean,
  seed = 71,
) {
  const pack = selectStorySkiPixlPack(
    0,
    stage === "skipixl-feasible" ? "P84" : "P78",
  );
  const run = createRunContext({
    gameId: "skipixl",
    playMode: "story",
    storyStage: stage,
    rulesVersion: pack.rulesVersion,
    runSeed: seed,
    pack: {
      packId: pack.packId,
      contentSha256: pack.contentSha256,
      schemaVersion: pack.schemaVersion,
      source: pack.source,
    },
  });
  repository.setStoryNode(`game-${stage}`);
  repository.recordStoryAttempt(run);
  persistSkiPixlStoryResult(repository, run, pack, {
    storyQualified: qualified,
    elapsedSeconds: qualified ? 50 : 61,
    collisions: [],
    gateResults: [],
  });
  return repository.recordStoryOutcome(run, qualified ? "finished" : "failed");
}
describe("SkiPixl Story progression independent of clears", () => {
  it.each([false, true])(
    "continues after feasible loss and overloaded qualified=%s, preserving reload",
    (qualified) => {
      const { repository, reload } = setup();
      repository.setStoryNode("game-skipixl-feasible");
      finish(repository, "skipixl-feasible", false);
      repository.advanceStoryTerminal("continue");
      repository.advanceStoryTerminal("continue");
      repository.advanceStoryTerminal("continue");
      repository.advanceStoryTerminal("play");
      expect(repository.snapshot().story.currentNodeId).toBe(
        "game-skipixl-overloaded",
      );
      const result = finish(repository, "skipixl-overloaded", qualified);
      expect(result.story.clearedStages).not.toContain("skipixl-feasible");
      expect(postscriptUnlocked(result.story.clearedStages)).toBe(false);
      expect(reload().snapshot()).toEqual(result);
      repository.advanceStoryTerminal("continue");
      expect(repository.snapshot().story.currentNodeId).not.toBe(
        "game-skipixl-overloaded",
      );
    },
  );
  it("retains later clears when an earlier course is retried and lost", () => {
    const { repository, reload } = setup();
    finish(repository, "skipixl-feasible", true);
    finish(repository, "skipixl-overloaded", true);
    finish(repository, "skipixl-feasible", false);
    expect(
      repository
        .snapshot()
        .story.skipixlCuts.successfulPasses.map((p) => p.cutId),
    ).toEqual(["P84", "P78"]);
    expect(reload().snapshot()).toEqual(repository.snapshot());
  });
  it("bounds 129 attempts without losing successful receipts", () => {
    const { repository, reload } = setup();
    finish(repository, "skipixl-feasible", true);
    for (let i = 0; i < 129; i++)
      finish(repository, "skipixl-overloaded", false, i + 100);
    const state = repository.snapshot();
    expect(state.story.skipixlCuts.completedAttempts).toHaveLength(128);
    expect(
      state.story.skipixlCuts.successfulPasses.map((p) => p.cutId),
    ).toEqual(["P84"]);
    expect(reload().snapshot()).toEqual(state);
  });
  it("still rejects duplicate and out-of-order clear receipts", () => {
    const { repository } = setup();
    finish(repository, "skipixl-feasible", true);
    finish(repository, "skipixl-overloaded", true);
    const save = repository.snapshot(),
      cuts = save.story.skipixlCuts;
    for (const passes of [
      [cuts.successfulPasses[0], cuts.successfulPasses[0]],
      [...cuts.successfulPasses].reverse(),
    ]) {
      expect(() =>
        validateSave({
          ...save,
          story: {
            ...save.story,
            skipixlCuts: { ...cuts, successfulPasses: passes },
          },
        }),
      ).toThrow();
    }
  });
});
