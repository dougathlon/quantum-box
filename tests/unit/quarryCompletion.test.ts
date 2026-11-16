import { describe, expect, it, vi } from "vitest";
import { QuantumBoxApp } from "../../src/app/QuantumBoxApp";
import { createRunContext } from "../../src/core/run";
import { QuagSession } from "../../src/games/quag/QuagSession";
import {
  QUAG_RULES_VERSION,
  type QuagInput,
  type QuagPlayerId,
  type QuagSnapshot,
} from "../../src/games/quag/types";
import { QUAG_SYNTHETIC_QGRAPH_PACK } from "../../src/games/qgraph/quarrySyntheticPack";

vi.mock("phaser", () => ({ default: { Scene: class {} } }));

function complete(
  playMode: "story" | "arcade",
  winnerIds: readonly QuagPlayerId[],
  rulesVersion = QUAG_RULES_VERSION,
) {
  const context = createRunContext({
    gameId: "quarry",
    playMode,
    storyStage: playMode === "story" ? "quarry" : null,
    rulesVersion,
    runSeed: 23,
    pack: {
      packId: "quarry-completion-test-control",
      contentSha256: "a".repeat(64),
      schemaVersion: "quantum-box-pack-v1",
      source: "synthetic-control",
    },
  });
  const snapshot: QuagSnapshot = {
    ...new QuagSession(context, QUAG_SYNTHETIC_QGRAPH_PACK).snapshot(),
    phase: "complete",
    winnerIds,
  };
  const captureReplay = vi.fn();
  const recordActiveStoryOutcome = vi.fn();
  const announce = vi.fn();
  const play = vi.fn();
  // Exercise the real completion boundary without starting a browser or cabinet.
  const app = Object.assign(Object.create(QuantumBoxApp.prototype), {
    activeRun: context,
    quagIsReplay: false,
    captureReplay,
    recordActiveStoryOutcome,
    shell: { announce },
    audio: { setPaused: vi.fn(), play },
  }) as {
    completeQuag(snapshot: QuagSnapshot, recording: readonly QuagInput[]): void;
  };
  app.completeQuag(snapshot, []);
  return { captureReplay, recordActiveStoryOutcome, announce, play, snapshot };
}

describe("Quarry completion result descriptions", () => {
  it.each(["story", "arcade"] as const)(
    "records an all-player draw as a draw in %s",
    (mode) => {
      const result = complete(mode, ["A", "B", "C", "D"]);
      expect(result.captureReplay).toHaveBeenCalledWith(
        [],
        result.snapshot,
        false,
        "draw",
      );
      expect(result.announce).toHaveBeenCalledWith(
        mode === "story"
          ? "Quarry draw. Continue to the terminal."
          : "Quarry complete · human/CPU draw between A/B/C/D.",
      );
      expect(result.play).toHaveBeenCalledWith("quag-match-draw");
      if (mode === "story") {
        expect(result.recordActiveStoryOutcome).toHaveBeenCalledWith("lost");
      } else {
        expect(result.recordActiveStoryOutcome).not.toHaveBeenCalled();
      }
    },
  );

  it.each([
    { winners: ["A"] as const, qualified: true, result: "won" },
    { winners: ["A", "B"] as const, qualified: true, result: "won" },
    { winners: ["B", "C"] as const, qualified: false, result: "lost" },
  ])("keeps winner metadata and Story outcome for $winners", (testCase) => {
    const result = complete("story", testCase.winners);
    expect(result.captureReplay).toHaveBeenCalledWith(
      [],
      result.snapshot,
      testCase.qualified,
      `winner ${testCase.winners.join("/")}`,
    );
    expect(result.recordActiveStoryOutcome).toHaveBeenCalledWith(
      testCase.result,
    );
    expect(result.announce).toHaveBeenCalledWith(
      `Quarry ${testCase.result}. Continue to the terminal.`,
    );
  });

  it.each(["quarry-rules-v4", "quarry-rules-v5"])(
    "preserves the legacy %s partial-tie draw",
    (rulesVersion) => {
      const result = complete("story", ["A", "B"], rulesVersion);
      expect(result.captureReplay).toHaveBeenCalledWith(
        [],
        result.snapshot,
        false,
        "draw",
      );
      expect(result.recordActiveStoryOutcome).toHaveBeenCalledWith("lost");
      expect(result.announce).toHaveBeenCalledWith(
        "Quarry draw. Continue to the terminal.",
      );
    },
  );
});
