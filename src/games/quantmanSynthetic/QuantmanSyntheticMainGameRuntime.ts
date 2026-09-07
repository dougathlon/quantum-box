import { FixedStepClock } from "../../core/fixedStep";
import type { InputSignal, SemanticAction } from "../../input/InputController";
import { TUNING } from "./config";
import type { DirectionName } from "./labyrinth/types";
import {
  QuantmanSyntheticRuntime,
  type QuantmanSyntheticReplayTape,
  type QuantmanSyntheticRunContext,
  type QuantmanSyntheticRuntimeOptions,
  type QuantmanSyntheticRuntimeSnapshot,
} from "./QuantmanSyntheticRuntime";
import type { SemanticInput } from "./game/types";

export type QuantmanSyntheticFeedback =
  | "collectible"
  | "power"
  | "caught"
  | "ghost-eaten"
  | "topology-change"
  | "cleared"
  | "lost";

/**
 * The app owns the Phaser scene and the semantic DOM. This deliberately small
 * port keeps the fixed-step game independent from both of them.
 */
export interface QuantmanSyntheticPresentationPort {
  readonly present: (
    snapshot: QuantmanSyntheticRuntimeSnapshot,
    paused: boolean,
  ) => void;
}

export interface QuantmanSyntheticFreshRunRequest {
  readonly reason: "retry";
  readonly previousRun: QuantmanSyntheticRunContext;
  readonly terminal: QuantmanSyntheticRuntimeSnapshot["terminal"];
}

export interface QuantmanSyntheticMainGameCallbacks {
  readonly onCompleted: (
    snapshot: QuantmanSyntheticRuntimeSnapshot,
    replayTape: QuantmanSyntheticReplayTape,
  ) => void;
  readonly onContinue: () => void;
  readonly onExit: () => void;
  /** The app must allocate a new run/seed. This runtime never rewinds itself. */
  readonly onFreshRunRequested: (
    request: QuantmanSyntheticFreshRunRequest,
  ) => void;
  readonly onPauseChanged?: (paused: boolean) => void;
  readonly onFeedback?: (feedback: QuantmanSyntheticFeedback) => void;
  readonly onInputApplied?: (capturedAtMs: number) => void;
}

export interface QuantmanSyntheticFrameScheduler {
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (frameId: number) => void;
}

export interface QuantmanSyntheticMainGameRuntimeOptions
  extends QuantmanSyntheticRuntimeOptions {
  /** Internal QA only. There is intentionally no player-facing replay action. */
  readonly replayInputs?: readonly SemanticInput[];
  readonly scheduler?: QuantmanSyntheticFrameScheduler;
}

/**
 * Main-game adapter for the imported 10x10 synthetic Quantman simulation.
 * Exactly one semantic input is recorded for each authoritative 60 Hz step;
 * render cadence and pause state cannot alter simulation state.
 */
export class QuantmanSyntheticMainGameRuntime {
  private readonly clock = new FixedStepClock(1 / TUNING.simulationHz);
  private readonly engine: QuantmanSyntheticRuntime;
  private readonly scheduler: QuantmanSyntheticFrameScheduler;
  private readonly replayInputs: readonly SemanticInput[] | null;
  private readonly heldDirections = new Set<DirectionName>();
  private readonly directionOrder: DirectionName[] = [];
  private replayIndex = 0;
  private frameId: number | null = null;
  private previousTimestamp = 0;
  private stopped = false;
  private paused = false;
  private startQueued = false;
  private latchedDirection: DirectionName | null = null;
  private completionReported = false;
  private pendingInputAtMs: number | null = null;

  public constructor(
    options: QuantmanSyntheticMainGameRuntimeOptions,
    private readonly presentation: QuantmanSyntheticPresentationPort,
    private readonly callbacks: QuantmanSyntheticMainGameCallbacks,
  ) {
    this.engine = new QuantmanSyntheticRuntime(options);
    this.replayInputs = options.replayInputs
      ? Object.freeze(options.replayInputs.map(canonicalInput))
      : null;
    this.scheduler = options.scheduler ?? browserFrameScheduler();
  }

  public start(): void {
    if (this.frameId !== null || this.stopped) return;
    this.previousTimestamp = this.scheduler.now();
    this.render();
    this.frameId = this.scheduler.requestFrame(this.frame);
  }

  public stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.frameId !== null) this.scheduler.cancelFrame(this.frameId);
    this.frameId = null;
    this.clearInput();
  }

  public handleInput(signal: InputSignal): void {
    if (this.stopped) return;
    if (this.replayInputs !== null) {
      this.handleReplayControl(signal);
      return;
    }

    const direction = directionForAction(signal.action);
    if (direction !== null) {
      const changed = this.heldDirections.has(direction) !== signal.pressed;
      if (signal.pressed) {
        this.heldDirections.add(direction);
        removeDirection(this.directionOrder, direction);
        this.directionOrder.push(direction);
        this.latchedDirection = direction;
        if (this.snapshot().simulation.phase === "ready") {
          this.startQueued = true;
        }
      } else {
        this.heldDirections.delete(direction);
        removeDirection(this.directionOrder, direction);
      }
      if (changed && !this.paused && !this.isComplete()) {
        this.noteInput(signal.capturedAtMs);
      }
      return;
    }

    if (!signal.pressed) return;
    if (isStartAction(signal.action)) {
      if (this.isComplete()) {
        this.callbacks.onContinue();
      } else if (!this.paused) {
        this.startQueued = true;
        this.noteInput(signal.capturedAtMs);
      }
    } else if (signal.action === "secondary") {
      if (this.isComplete() || this.paused) this.requestFreshRun();
    } else if (signal.action === "pause") {
      this.togglePause();
    } else if (signal.action === "back") {
      this.callbacks.onExit();
    }
  }

  public togglePause(): boolean | null {
    if (this.snapshot().simulation.phase !== "active") return null;
    this.paused = !this.paused;
    this.clock.reset();
    if (this.paused) this.clearInput();
    this.callbacks.onPauseChanged?.(this.paused);
    this.render();
    return this.paused;
  }

  public pause(): boolean {
    if (this.paused || this.snapshot().simulation.phase !== "active") {
      return false;
    }
    this.paused = true;
    this.clock.reset();
    this.clearInput();
    this.callbacks.onPauseChanged?.(true);
    this.render();
    return true;
  }

  public requestFreshRun(): void {
    const snapshot = this.snapshot();
    this.callbacks.onFreshRunRequested(
      Object.freeze({
        reason: "retry",
        previousRun: snapshot.run,
        terminal: snapshot.terminal,
      }),
    );
  }

  /** Compatibility name for UI whose visible label is RETRY. */
  public requestRetry(): void {
    this.requestFreshRun();
  }

  public snapshot(): QuantmanSyntheticRuntimeSnapshot {
    return this.engine.snapshot();
  }

  public replayTape(): QuantmanSyntheticReplayTape {
    return this.engine.replayTape();
  }

  public isComplete(): boolean {
    return this.snapshot().terminal !== null;
  }

  public isPaused(): boolean {
    return this.paused;
  }

  private readonly frame = (timestamp: number): void => {
    if (this.stopped) return;
    const elapsedSeconds = (timestamp - this.previousTimestamp) / 1_000;
    this.previousTimestamp = timestamp;
    let snapshot = this.snapshot();
    let stepped = false;
    if (!this.paused) {
      const advance = this.clock.advance(elapsedSeconds);
      for (let step = 0; step < advance.steps; step += 1) {
        if (snapshot.terminal !== null) break;
        const input = this.nextInput(snapshot);
        if (
          snapshot.simulation.phase === "ready" &&
          input.direction === null &&
          !input.start
        ) {
          continue;
        }
        const previous = snapshot;
        snapshot = this.engine.step(input);
        this.routeFeedback(previous, snapshot);
        stepped = true;
      }
    }
    this.presentation.present(snapshot, this.paused);
    if (stepped && this.pendingInputAtMs !== null) {
      this.callbacks.onInputApplied?.(this.pendingInputAtMs);
      this.pendingInputAtMs = null;
    }
    this.reportCompletion(snapshot);
    this.frameId = this.scheduler.requestFrame(this.frame);
  };

  private nextInput(snapshot: QuantmanSyntheticRuntimeSnapshot): SemanticInput {
    if (this.replayInputs !== null) {
      const input = this.replayInputs[this.replayIndex];
      if (!input) {
        if (snapshot.terminal === null) {
          throw new Error(
            "Quantman synthetic replay ended before a terminal state.",
          );
        }
        return NEUTRAL_INPUT;
      }
      this.replayIndex += 1;
      return input;
    }

    const direction =
      this.latchedDirection ?? this.directionOrder.at(-1) ?? null;
    this.latchedDirection = null;
    const input = Object.freeze({
      direction,
      start: this.startQueued,
    });
    this.startQueued = false;
    return input;
  }

  private routeFeedback(
    previous: QuantmanSyntheticRuntimeSnapshot,
    current: QuantmanSyntheticRuntimeSnapshot,
  ): void {
    const before = previous.simulation;
    const after = current.simulation;
    if (after.lives < before.lives) this.callbacks.onFeedback?.("caught");
    if (after.ghostsEaten > before.ghostsEaten) {
      this.callbacks.onFeedback?.("ghost-eaten");
    }
    if (
      after.wallPassTicks > before.wallPassTicks ||
      after.ghostEatTicks > before.ghostEatTicks
    ) {
      this.callbacks.onFeedback?.("power");
    } else if (after.collectedRooms.length > before.collectedRooms.length) {
      this.callbacks.onFeedback?.("collectible");
    }
    if (after.topologyHistory.length > before.topologyHistory.length) {
      this.callbacks.onFeedback?.("topology-change");
    }
    if (before.phase !== "won" && after.phase === "won") {
      this.callbacks.onFeedback?.("cleared");
    } else if (before.phase !== "lost" && after.phase === "lost") {
      this.callbacks.onFeedback?.("lost");
    }
  }

  private reportCompletion(snapshot: QuantmanSyntheticRuntimeSnapshot): void {
    if (snapshot.terminal === null || this.completionReported) return;
    this.completionReported = true;
    this.callbacks.onCompleted(snapshot, this.engine.replayTape());
  }

  private handleReplayControl(signal: InputSignal): void {
    if (!signal.pressed) return;
    if (isStartAction(signal.action) && this.isComplete()) {
      this.callbacks.onContinue();
    } else if (signal.action === "secondary") {
      if (this.isComplete() || this.paused) this.requestFreshRun();
    } else if (signal.action === "pause") {
      this.togglePause();
    } else if (signal.action === "back") {
      this.callbacks.onExit();
    }
  }

  private clearInput(): void {
    this.heldDirections.clear();
    this.directionOrder.length = 0;
    this.latchedDirection = null;
    this.startQueued = false;
    this.pendingInputAtMs = null;
  }

  private noteInput(capturedAtMs: number): void {
    this.pendingInputAtMs =
      this.pendingInputAtMs === null
        ? capturedAtMs
        : Math.min(this.pendingInputAtMs, capturedAtMs);
  }

  private render(): void {
    this.presentation.present(this.snapshot(), this.paused);
  }
}

const NEUTRAL_INPUT: SemanticInput = Object.freeze({
  direction: null,
  start: false,
});

function directionForAction(action: SemanticAction): DirectionName | null {
  if (action === "p1-up") return "up";
  if (action === "p1-right") return "right";
  if (action === "p1-down") return "down";
  if (action === "p1-left") return "left";
  return null;
}

function isStartAction(action: SemanticAction): boolean {
  return action === "p1-action" || action === "primary" || action === "start";
}

function removeDirection(
  directions: DirectionName[],
  direction: DirectionName,
): void {
  const index = directions.indexOf(direction);
  if (index >= 0) directions.splice(index, 1);
}

function canonicalInput(input: SemanticInput): SemanticInput {
  return Object.freeze({
    direction: input.direction,
    start: input.start === true,
  });
}

function browserFrameScheduler(): QuantmanSyntheticFrameScheduler {
  return Object.freeze({
    now: () => performance.now(),
    requestFrame: (callback: FrameRequestCallback) =>
      requestAnimationFrame(callback),
    cancelFrame: (frameId: number) => cancelAnimationFrame(frameId),
  });
}
