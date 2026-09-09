import { describe, expect, it, vi } from "vitest";

import {
  QUANTMAN_SYNTHETIC_FIXTURE,
  QuantmanSyntheticMainGameRuntime,
  QuantmanSyntheticRuntime,
  type QuantmanSyntheticFrameScheduler,
  type QuantmanSyntheticRuntimeSnapshot,
} from "../../src/games/quantmanSynthetic";
import type { InputSignal } from "../../src/input/InputController";
import {
  QUANTMAN_SYNTHETIC_VIEWPORT,
  quantmanSyntheticActorScreenPosition,
  quantmanSyntheticHudModel,
  quantmanSyntheticWallSegments,
} from "../../src/display/views/QuantmanSyntheticView";

describe("Quantman synthetic main-game runtime", () => {
  it("translates semantic input and retains travel direction after key release", () => {
    const scheduler = new ManualFrameScheduler();
    const presentations: QuantmanSyntheticRuntimeSnapshot[] = [];
    const applied = vi.fn();
    const runtime = new QuantmanSyntheticMainGameRuntime(
      {
        playMode: "arcade",
        runSeed: 47,
        mechanic: "stabilize-gaze",
        scheduler,
      },
      {
        present: (snapshot) => presentations.push(snapshot),
      },
      callbacks({ onInputApplied: applied }),
    );

    runtime.start();
    runtime.handleInput(signal("p1-right", true, 12));
    scheduler.advance(17);

    expect(runtime.snapshot().simulation).toMatchObject({
      phase: "active",
      activeTick: 1,
      player: { facing: "right" },
    });
    expect(runtime.replayTape().inputs).toEqual([
      { direction: "right", start: true },
    ]);
    expect(applied).toHaveBeenCalledOnce();
    expect(applied).toHaveBeenCalledWith(12);

    const progressBeforeRelease = runtime.snapshot().simulation.player.progress;
    runtime.handleInput(signal("p1-right", false, 20));
    scheduler.advance(17);

    expect(runtime.snapshot().simulation.player).toMatchObject({
      facing: "right",
      movementDirection: "right",
    });
    expect(runtime.snapshot().simulation.player.progress).toBeGreaterThan(
      progressBeforeRelease,
    );
    expect(runtime.replayTape().inputs).toEqual([
      { direction: "right", start: true },
      { direction: null, start: false },
    ]);
    expect(applied).toHaveBeenCalledTimes(2);
    expect(applied).toHaveBeenLastCalledWith(20);
    expect(presentations.length).toBeGreaterThanOrEqual(2);
    runtime.stop();
  });

  it("freezes simulation while paused and delegates retry as a fresh run", () => {
    const scheduler = new ManualFrameScheduler();
    const freshRun = vi.fn();
    const pauseChanged = vi.fn();
    const runtime = new QuantmanSyntheticMainGameRuntime(
      {
        playMode: "story",
        runSeed: 53,
        mechanic: "inverse-gaze",
        scheduler,
      },
      { present: () => undefined },
      callbacks({
        onFreshRunRequested: freshRun,
        onPauseChanged: pauseChanged,
      }),
    );

    runtime.start();
    runtime.handleInput(signal("p1-action", true, 1));
    scheduler.advance(17);
    expect(runtime.snapshot().simulation.activeTick).toBe(1);

    runtime.handleInput(signal("pause", true, 20));
    scheduler.advance(1_000);
    expect(runtime.snapshot().simulation.activeTick).toBe(1);
    expect(pauseChanged).toHaveBeenCalledWith(true);

    runtime.handleInput(signal("secondary", true, 21));
    expect(freshRun).toHaveBeenCalledWith({
      reason: "retry",
      previousRun: runtime.snapshot().run,
      terminal: null,
    });
    runtime.stop();
  });

  it("keeps player-facing replay absent while retaining an exact QA tape", () => {
    const scheduler = new ManualFrameScheduler();
    const runtime = new QuantmanSyntheticMainGameRuntime(
      {
        playMode: "arcade",
        runSeed: 59,
        mechanic: "stabilize-gaze",
        replayInputs: [{ direction: "down", start: true }],
        scheduler,
      },
      { present: () => undefined },
      callbacks(),
    );

    runtime.start();
    runtime.handleInput(signal("p1-left", true, 1));
    scheduler.advance(17);
    expect(runtime.replayTape().inputs).toEqual([
      { direction: "down", start: true },
    ]);
    runtime.stop();
  });
});

describe("Quantman synthetic cabinet presentation", () => {
  it("uses the native integer 320x180 plane for the exact 10x10 fixture", () => {
    const runtime = new QuantmanSyntheticRuntime({
      playMode: "arcade",
      runSeed: 61,
      mechanic: "stabilize-gaze",
    });
    const snapshot = runtime.snapshot();
    const segments = quantmanSyntheticWallSegments(
      snapshot.simulation.topologyWallMask,
    );

    expect(QUANTMAN_SYNTHETIC_FIXTURE).toMatchObject({
      width: 10,
      height: 10,
    });
    expect(QUANTMAN_SYNTHETIC_VIEWPORT).toEqual({
      width: 320,
      height: 180,
      boardLeft: 90,
      boardTop: 20,
      cellSize: 14,
      boardSize: 140,
    });
    expect(segments.length).toBeGreaterThan(0);
    for (const segment of segments) {
      expect(Object.values(segment).every(Number.isInteger)).toBe(true);
      expect(segment.x1).toBeGreaterThanOrEqual(90);
      expect(segment.x2).toBeLessThanOrEqual(230);
      expect(segment.y1).toBeGreaterThanOrEqual(20);
      expect(segment.y2).toBeLessThanOrEqual(160);
    }
    expect(
      quantmanSyntheticActorScreenPosition(snapshot.simulation.player),
    ).toEqual({ x: 167, y: 153 });
  });

  it("keeps terminal and provenance language concise and truthful", () => {
    const runtime = new QuantmanSyntheticRuntime({
      playMode: "story",
      runSeed: 67,
      mechanic: "inverse-gaze",
    });
    const ready = runtime.snapshot();
    expect(quantmanSyntheticHudModel(ready, false)).toMatchObject({
      mode: "INVERSE GAZE",
      phase: "READY",
      sourceClassification: "LOCAL SYNTHETIC CONTROL",
      controls: "MOVE / SPACE · START",
    });
    expect(quantmanSyntheticHudModel(ready, false).announcement).toContain(
      "no provider request",
    );

    const cleared = withPhase(ready, "won");
    expect(quantmanSyntheticHudModel(cleared, false)).toMatchObject({
      phase: "SCREEN CLEARED",
      controls: "RETRY · X   CONTINUE · SPACE",
    });
    const lost = withPhase(ready, "lost");
    expect(quantmanSyntheticHudModel(lost, false).phase).toBe("RUN LOST");
    expect(quantmanSyntheticHudModel(ready, true).phase).toBe("PAUSED");
  });
});

function callbacks(
  overrides: Partial<
    ConstructorParameters<typeof QuantmanSyntheticMainGameRuntime>[2]
  > = {},
): ConstructorParameters<typeof QuantmanSyntheticMainGameRuntime>[2] {
  return {
    onCompleted: () => undefined,
    onContinue: () => undefined,
    onExit: () => undefined,
    onFreshRunRequested: () => undefined,
    ...overrides,
  };
}

function signal(
  action: InputSignal["action"],
  pressed: boolean,
  capturedAtMs: number,
): InputSignal {
  return Object.freeze({
    action,
    pressed,
    source: "keyboard",
    deviceId: "keyboard:primary",
    capturedAtMs,
  });
}

function withPhase(
  snapshot: QuantmanSyntheticRuntimeSnapshot,
  phase: "won" | "lost",
): QuantmanSyntheticRuntimeSnapshot {
  return {
    ...snapshot,
    simulation: { ...snapshot.simulation, phase },
    terminal: {
      outcome: phase === "won" ? "cleared" : "lost",
      cleared: phase === "won",
      playMode: snapshot.run.playMode,
      mechanic: snapshot.run.mechanic,
      runSeed: snapshot.run.runSeed,
      score: snapshot.simulation.score,
      remainingLives: snapshot.simulation.lives,
      activeTicks: snapshot.simulation.activeTick,
      fixtureId: snapshot.fixture.fixtureId,
      fixtureContentSha256: snapshot.fixture.fixtureContentSha256,
    },
  };
}

class ManualFrameScheduler implements QuantmanSyntheticFrameScheduler {
  private timestamp = 0;
  private nextId = 1;
  private callbacks = new Map<number, FrameRequestCallback>();

  public now(): number {
    return this.timestamp;
  }

  public requestFrame(callback: FrameRequestCallback): number {
    const id = this.nextId;
    this.nextId += 1;
    this.callbacks.set(id, callback);
    return id;
  }

  public cancelFrame(frameId: number): void {
    this.callbacks.delete(frameId);
  }

  public advance(deltaMs: number): void {
    this.timestamp += deltaMs;
    const entry = [...this.callbacks.entries()][0];
    if (!entry) throw new Error("No Quantman frame is scheduled.");
    this.callbacks.delete(entry[0]);
    entry[1](this.timestamp);
  }
}
