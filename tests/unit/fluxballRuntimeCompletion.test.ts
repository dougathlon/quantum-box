import { afterEach, describe, expect, it, vi } from "vitest";
import { createRunContext } from "../../src/core/run";
import type { ScreenScene } from "../../src/game/ScreenScene";
import {
  FluxballRuntime,
  type FluxballRuntimeCallbacks,
} from "../../src/games/fluxball/FluxballRuntime";
import { FLUXBALL_PLAYABLE_RULE_BANK } from "../../src/games/fluxball/fluxballControlPacks";
import {
  FLUXBALL_RULES_VERSION,
  type FluxballSnapshot,
} from "../../src/games/fluxball/types";
import { InputController } from "../../src/input/InputController";
import type { QuantumBoxShell } from "../../src/ui/QuantumBoxShell";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Fluxball automatic final results", () => {
  it("retains intermediate reveals and completes once with final rules without consuming a held action", () => {
    const test = harness();
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
    // The app latches transition actions before routing them into the cabinet.
    controller.subscribe((signal) => {
      if (signal.pressed && signal.action === "p1-action")
        controller.latchUntilRelease(signal.action);
      test.runtime.handleInput(signal);
    });
    const key = (type: "keydown" | "keyup") =>
      listeners.get(type)?.({
        code: "Space",
        repeat: false,
        target: null,
        preventDefault: () => {},
      } as unknown as KeyboardEvent);
    test.runtime.start();
    for (let round = 1; round <= 3; round++) {
      while (
        test.snapshot().phase === "active" &&
        test.snapshot().sport!.roundTick < 795
      )
        test.frame();
      if (round === 3) key("keydown");
      while (test.snapshot().phase === "active") test.frame();
      expect(test.snapshot().phase).toBe(round === 3 ? "complete" : "reveal");
      expect(test.snapshot().reveal?.roundNumber).toBe(round);
      if (round < 3) {
        for (let idle = 0; idle < 10; idle++) test.frame();
        expect(test.snapshot().phase).toBe("reveal");
        expect(test.onCompleted).not.toHaveBeenCalled();
        test.runtime.continueRound();
      }
    }
    expect(test.onCompleted).toHaveBeenCalledTimes(1);
    const [completed, recording] = test.onCompleted.mock.calls[0]!;
    expect(completed.phase).toBe("complete");
    expect(completed.reveal?.epochs).toHaveLength(2);
    expect(completed.reveal?.rules).toEqual(completed.reveal?.epochs[1]?.rules);
    expect(recording).toHaveLength(2400);
    expect(test.onContinue).not.toHaveBeenCalled();
    // A button held into results cannot become a second press until released.
    key("keydown");
    for (let idle = 0; idle < 10; idle++) test.frame();
    expect(test.onContinue).not.toHaveBeenCalled();
    expect(test.onCompleted).toHaveBeenCalledTimes(1);
    expect(test.snapshot()).toEqual(completed);
    key("keyup");
    key("keydown");
    expect(test.onContinue).toHaveBeenCalledTimes(1);
    expect(test.onCompleted).toHaveBeenCalledTimes(1);
    controller.dispose();
    test.runtime.stop();
  });

  it("does not schedule another frame if completion stops the runtime", () => {
    const test = harness();
    test.onCompleted.mockImplementation(() => test.runtime.stop());
    test.runtime.start();
    let scheduledBeforeFinalFrame = 0;
    for (let round = 1; round <= 3; round++) {
      while (test.snapshot().phase === "active") {
        scheduledBeforeFinalFrame =
          test.requestAnimationFrame.mock.calls.length;
        test.frame();
      }
      if (round < 3) test.runtime.continueRound();
    }
    expect(test.requestAnimationFrame).toHaveBeenCalledTimes(
      scheduledBeforeFinalFrame,
    );
    test.frame();
    expect(test.requestAnimationFrame).toHaveBeenCalledTimes(
      scheduledBeforeFinalFrame,
    );
    expect(test.onCompleted).toHaveBeenCalledTimes(1);
  });
});

function harness() {
  vi.stubGlobal("HTMLElement", class {});
  let nextFrame: FrameRequestCallback = () => {};
  let latest!: FluxballSnapshot;
  let now = 0;
  let frames = 0;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
    nextFrame = callback;
    return 1;
  });
  vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const onCompleted = vi.fn<FluxballRuntimeCallbacks["onCompleted"]>();
  const onContinue = vi.fn();
  const runtime = new FluxballRuntime(
    createRunContext({
      gameId: "fluxball",
      playMode: "arcade",
      rulesVersion: FLUXBALL_RULES_VERSION,
      runSeed: 31,
      pack: FLUXBALL_PLAYABLE_RULE_BANK,
    }),
    {
      competitorCount: 2,
      ruleMode: "global",
      roundSeconds: 40,
      humanPlayerIds: ["A", "B"],
    },
    {
      showFluxball: (snapshot: FluxballSnapshot) => {
        latest = snapshot;
      },
    } as unknown as ScreenScene,
    { updateFluxballHud: () => {} } as unknown as QuantumBoxShell,
    { onCompleted, onContinue, onReplay: vi.fn() },
  );
  return {
    runtime,
    onCompleted,
    onContinue,
    requestAnimationFrame,
    snapshot: () => latest,
    frame: () => {
      if (++frames > 3000)
        throw new Error(
          "Fluxball did not finish within its three-round frame budget.",
        );
      now += 50;
      nextFrame(now);
    },
  };
}
