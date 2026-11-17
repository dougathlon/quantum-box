import { afterEach, describe, expect, it, vi } from "vitest";
import { createRunContext } from "../../src/core/run";
import type { ScreenScene } from "../../src/game/ScreenScene";
import { QUAG_SYNTHETIC_QGRAPH_PACK } from "../../src/games/qgraph/quarrySyntheticPack";
import {
  QuagRuntime,
  type QuagRuntimeCallbacks,
} from "../../src/games/quag/QuagRuntime";
import { QuagSession } from "../../src/games/quag/QuagSession";
import {
  QUAG_RULES_VERSION,
  type QuagInput,
  type QuagSnapshot,
} from "../../src/games/quag/types";
import { InputController } from "../../src/input/InputController";
import type { QuantumBoxShell } from "../../src/ui/QuantumBoxShell";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Quarry manual round continuation", () => {
  it.each(["story", "arcade"] as const)(
    "holds the %s result indefinitely, protects three seconds, then advances once",
    (playMode) => {
      const t = harness(playMode);
      t.runtime.start();
      t.frame();
      t.frame();
      const result = t.snapshot();
      expect(result.phase).toBe("round-break");
      for (let i = 0; i < 59; i++) {
        t.frame();
        t.runtime.continueRound();
        expect(t.snapshot()).toEqual(result);
      }
      for (let i = 0; i < 400; i++) t.frame();
      expect(t.snapshot()).toEqual(result);
      expect(t.onCompleted).not.toHaveBeenCalled();
      t.runtime.continueRound();
      expect(t.snapshot().phase).toBe("active");
      expect(t.snapshot().roundNumber).toBe(2);
      expect(t.snapshot().roundTick).toBe(0);
      const next = t.snapshot();
      t.runtime.continueRound();
      expect(t.snapshot()).toEqual(next);
      t.runtime.stop();
    },
  );

  it("does not queue early, held or repeated Space into continuation or a flap", () => {
    const t = harness("arcade");
    vi.stubGlobal("HTMLElement", class {});
    const listeners = new Map<string, (event: KeyboardEvent) => void>();
    const controller = new InputController(
      {
        addEventListener: (
          name: string,
          listener: (event: KeyboardEvent) => void,
        ) => listeners.set(name, listener),
        removeEventListener: () => {},
        requestAnimationFrame: () => 1,
        cancelAnimationFrame: () => {},
      } as unknown as Window,
      {} as Document,
    );
    controller.subscribe((signal) => {
      if (signal.pressed && signal.action === "p1-action")
        controller.latchUntilRelease(signal.action);
      t.runtime.handleInput(signal);
    });
    const key = (type: "keydown" | "keyup", repeat = false) =>
      listeners.get(type)?.({
        code: "Space",
        repeat,
        target: null,
        preventDefault: () => {},
      } as unknown as KeyboardEvent);
    t.runtime.start();
    t.frame();
    t.frame();
    // Mash during the protected display; none of these presses is queued.
    for (let i = 0; i < 40; i++) {
      key("keydown");
      key("keyup");
      t.frame();
    }
    key("keydown");
    for (let i = 0; i < 40; i++) {
      t.frame();
      key("keydown", true);
    }
    expect(t.snapshot().phase).toBe("round-break");
    key("keyup");
    key("keydown");
    expect(t.snapshot().roundNumber).toBe(2);
    expect(t.snapshot().phase).toBe("active");
    key("keydown", true);
    t.frame();
    key("keyup");
    t.frame();
    expect(t.snapshot().phase).toBe("round-break");
    for (let i = 0; i < 60; i++) t.frame();
    t.runtime.continueRound();
    t.frame();
    t.frame();
    const recording = t.onCompleted.mock.calls[0]![1];
    expect(recording.every((input) => !input.flapPressed)).toBe(true);
    controller.dispose();
    t.runtime.stop();
  });

  it.each([
    QUAG_RULES_VERSION,
    "quarry-rules-v7",
    "quarry-rules-v6",
    "quarry-rules-v5",
  ])(
    "preserves %s replay ticks, outcomes and explicit replay continuation",
    (rulesVersion) => {
      const t = harness("arcade", rulesVersion);
      t.runtime.start();
      for (let round = 1; round <= 3; round++) {
        t.frame();
        t.frame();
        if (round < 3) {
          for (let i = 0; i < 60; i++) t.frame();
          t.runtime.continueRound();
        }
      }
      expect(t.onCompleted).toHaveBeenCalledTimes(1);
      const [completed, recording] = t.onCompleted.mock.calls[0]!;
      const replay = new QuagSession(
        t.context,
        QUAG_SYNTHETIC_QGRAPH_PACK,
        t.scenario,
      );
      for (const input of recording) replay.step(input);
      expect(replay.snapshot()).toEqual(completed);
      expect(recording).toHaveLength(
        6 +
          2 *
            ([QUAG_RULES_VERSION, "quarry-rules-v7"].includes(rulesVersion)
              ? 60
              : 40),
      );
      t.runtime.stop();
      const playback = harness("arcade", rulesVersion, recording);
      playback.runtime.start();
      for (let round = 1; round <= 3; round++) {
        playback.frame();
        playback.frame();
        if (round < 3) {
          for (let i = 0; i < 80; i++) playback.frame();
          expect(playback.snapshot().phase).toBe("round-break");
          playback.runtime.continueRound();
        }
      }
      expect(playback.onCompleted).toHaveBeenCalledTimes(1);
      expect(playback.onCompleted.mock.calls[0]![0]).toEqual(completed);
      playback.runtime.stop();
    },
  );

  it("cannot advance while paused or stopped", () => {
    const t = harness("arcade");
    t.runtime.start();
    t.frame();
    t.frame();
    t.runtime.pause();
    for (let i = 0; i < 80; i++) t.frame();
    t.runtime.continueRound();
    expect(t.snapshot().phase).toBe("round-break");
    t.runtime.togglePause();
    t.runtime.stop();
    t.runtime.continueRound();
    expect(t.snapshot().phase).toBe("round-break");
  });
});

function harness(
  playMode: "story" | "arcade",
  rulesVersion = QUAG_RULES_VERSION,
  replayInputs: readonly QuagInput[] | null = null,
) {
  let nextFrame: FrameRequestCallback = () => {};
  let latest!: QuagSnapshot;
  let now = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const context = createRunContext({
    gameId: "quarry",
    playMode,
    rulesVersion,
    runSeed: 31,
    storyStage: playMode === "story" ? "quarry" : null,
    pack: {
      packId: "quarry-round-continuation-control",
      contentSha256: "a".repeat(64),
      schemaVersion: "quantum-box-pack-v1",
      source: "synthetic-control",
    },
  });
  const scenario = {
    readyTicks: 0,
    roundTicks: 2,
    totalRounds: 3,
    cpuEnabled: false,
  };
  const onCompleted = vi.fn<QuagRuntimeCallbacks["onCompleted"]>();
  const runtime = new QuagRuntime(
    context,
    QUAG_SYNTHETIC_QGRAPH_PACK,
    {
      showQuag: (snapshot: QuagSnapshot) => {
        latest = snapshot;
      },
    } as unknown as ScreenScene,
    { updateQuagHud: () => {} } as unknown as QuantumBoxShell,
    { onCompleted, onExit: vi.fn(), onRestart: vi.fn(), onReplay: vi.fn() },
    replayInputs,
    scenario,
  );
  return {
    context,
    scenario,
    runtime,
    onCompleted,
    snapshot: () => latest,
    frame: () => {
      now += 50;
      nextFrame(now);
    },
  };
}
