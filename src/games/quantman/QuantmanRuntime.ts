import { FixedStepClock } from "../../core/fixedStep";
import type { RunContext } from "../../core/run";
import type { InputSignal, SemanticAction } from "../../input/InputController";
import { QuantmanSession } from "./QuantmanSession";
import type {
  QuantmanInput,
  QuantmanPackPayload,
  QuantmanSnapshot,
} from "./types";

/**
 * Recovery-only ports for the retired Quantman implementation. The canonical
 * app no longer exposes these hooks; retaining local structural ports keeps
 * the historical runtime inspectable without restoring it to production.
 */
interface LegacyQuantmanScenePort {
  readonly showQuantman: (
    snapshot: QuantmanSnapshot,
    payload: QuantmanPackPayload,
    paused: boolean,
  ) => void;
}

interface LegacyQuantmanShellPort {
  readonly updateQuantmanHud: (
    snapshot: QuantmanSnapshot,
    paused: boolean,
  ) => void;
}

export interface QuantmanRuntimeCallbacks {
  readonly onCompleted: (
    snapshot: QuantmanSnapshot,
    recording: readonly QuantmanInput[],
  ) => void;
  readonly onContinue: () => void;
  readonly onReplay: () => void;
  readonly onFeedback?: (
    event: "fragment" | "caught" | "exit-unlocked" | "observe",
  ) => void;
  readonly onInputApplied?: (capturedAtMs: number) => void;
}

export class QuantmanRuntime {
  private readonly clock = new FixedStepClock(1 / 60);
  private readonly held = new Set<SemanticAction>();
  private readonly directionOrder: SemanticAction[] = [];
  private readonly session: QuantmanSession;
  private readonly recording: QuantmanInput[] = [];
  private replayIndex = 0;
  private frameId = 0;
  private previousTimestamp = 0;
  private paused = false;
  private completionReported = false;
  private stopped = false;
  private lastEventId = 0;
  private pendingInputAtMs: number | null = null;
  private latchedDirection: SemanticAction | null = null;

  public constructor(
    context: RunContext,
    private readonly payload: QuantmanPackPayload,
    private readonly scene: LegacyQuantmanScenePort,
    private readonly shell: LegacyQuantmanShellPort,
    private readonly callbacks: QuantmanRuntimeCallbacks,
    private readonly replayInputs: readonly QuantmanInput[] | null = null,
  ) {
    this.session = new QuantmanSession(context, payload);
  }

  public start(): void {
    if (this.frameId !== 0 || this.stopped) return;
    this.previousTimestamp = performance.now();
    this.render(this.session.snapshot());
    this.frameId = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
    this.held.clear();
    this.directionOrder.length = 0;
    this.latchedDirection = null;
  }

  public handleInput(signal: InputSignal): void {
    if (this.stopped) return;
    if (this.replayInputs !== null) {
      if (!signal.pressed) return;
      if (signal.action === "primary" && this.isComplete()) {
        this.callbacks.onContinue();
      } else if (signal.action === "secondary" && this.isComplete()) {
        this.callbacks.onReplay();
      } else if (signal.action === "pause") {
        this.togglePause();
      }
      return;
    }
    if (isDirectional(signal.action)) {
      const changed = this.held.has(signal.action) !== signal.pressed;
      if (signal.pressed) {
        this.held.add(signal.action);
        removeDirection(this.directionOrder, signal.action);
        this.directionOrder.push(signal.action);
        if (!this.paused) this.latchedDirection = signal.action;
      } else {
        this.held.delete(signal.action);
        removeDirection(this.directionOrder, signal.action);
      }
      if (
        changed &&
        !this.paused &&
        this.session.snapshot().phase === "active"
      ) {
        this.pendingInputAtMs = earliest(
          this.pendingInputAtMs,
          signal.capturedAtMs,
        );
      }
      return;
    }
    if (!signal.pressed) return;
    if (signal.action === "primary") {
      if (this.isComplete()) this.callbacks.onContinue();
    } else if (signal.action === "secondary" && this.isComplete()) {
      this.callbacks.onReplay();
    } else if (signal.action === "pause") {
      this.togglePause();
    }
  }

  public togglePause(): boolean | null {
    if (this.isComplete()) return null;
    this.paused = !this.paused;
    this.clock.reset();
    this.render(this.session.snapshot());
    return this.paused;
  }

  public pause(): boolean {
    if (this.paused || this.isComplete()) return false;
    this.paused = true;
    this.clock.reset();
    this.render(this.session.snapshot());
    return true;
  }

  public requestReplay(): void {
    if (this.isComplete()) this.callbacks.onReplay();
  }

  public isComplete(): boolean {
    return this.session.snapshot().phase !== "active";
  }

  private readonly frame = (timestamp: number): void => {
    if (this.stopped) return;
    const elapsed = (timestamp - this.previousTimestamp) / 1000;
    this.previousTimestamp = timestamp;
    let snapshot = this.session.snapshot();
    let inputApplied = false;
    if (!this.paused) {
      const advance = this.clock.advance(elapsed);
      for (let step = 0; step < advance.steps; step += 1) {
        if (snapshot.phase !== "active") break;
        snapshot = this.session.step(this.nextInput(snapshot));
        inputApplied = true;
      }
    }
    this.render(snapshot);
    if (inputApplied && this.pendingInputAtMs !== null) {
      this.callbacks.onInputApplied?.(this.pendingInputAtMs);
      this.pendingInputAtMs = null;
    }
    if (snapshot.phase !== "active" && !this.completionReported) {
      this.completionReported = true;
      this.callbacks.onCompleted(snapshot, freezeRecording(this.recording));
    }
    this.frameId = requestAnimationFrame(this.frame);
  };

  private nextInput(snapshot: QuantmanSnapshot): QuantmanInput {
    if (this.replayInputs !== null) {
      const input = this.replayInputs[this.replayIndex];
      if (!input) {
        if (snapshot.phase === "active") {
          throw new Error(
            "Quantman replay input tape ended before the maze run completed.",
          );
        }
        return NEUTRAL_INPUT;
      }
      this.replayIndex += 1;
      const replayInput = Object.freeze({ ...input });
      this.recording.push(replayInput);
      return replayInput;
    }
    const direction = latestHeldDirection(
      this.held,
      this.directionOrder,
      this.latchedDirection,
    );
    this.latchedDirection = null;
    const input = Object.freeze({
      x: direction.x,
      y: direction.y,
      observe: false,
    });
    this.recording.push(input);
    return input;
  }

  private render(snapshot: QuantmanSnapshot): void {
    const event = snapshot.latestEvent;
    if (event && event.eventId !== this.lastEventId) {
      this.lastEventId = event.eventId;
      if (
        event.type === "FRAGMENT_COLLECTED" ||
        event.type === "POWER_PELLET_COLLECTED" ||
        event.type === "PURSUER_EATEN"
      ) {
        this.callbacks.onFeedback?.("fragment");
      } else if (event.type === "PLAYER_CAUGHT") {
        this.callbacks.onFeedback?.("caught");
      } else if (event.type === "EXIT_UNLOCKED") {
        this.callbacks.onFeedback?.("exit-unlocked");
      } else if (event.type === "TOPOLOGY_OBSERVED") {
        this.callbacks.onFeedback?.("observe");
      }
    }
    this.scene.showQuantman(snapshot, this.payload, this.paused);
    this.shell.updateQuantmanHud(snapshot, this.paused);
  }
}

const NEUTRAL_INPUT: QuantmanInput = Object.freeze({
  x: 0,
  y: 0,
  observe: false,
});

function isDirectional(action: SemanticAction): boolean {
  return action.startsWith("p1-") || action.startsWith("p2-");
}

function latestHeldDirection(
  held: ReadonlySet<SemanticAction>,
  directionOrder: readonly SemanticAction[],
  latchedDirection: SemanticAction | null,
): Readonly<{ x: -1 | 0 | 1; y: -1 | 0 | 1 }> {
  const action =
    [...directionOrder].reverse().find((item) => held.has(item)) ??
    latchedDirection;
  if (action?.endsWith("-left")) return Object.freeze({ x: -1, y: 0 });
  if (action?.endsWith("-right")) return Object.freeze({ x: 1, y: 0 });
  if (action?.endsWith("-up")) return Object.freeze({ x: 0, y: -1 });
  if (action?.endsWith("-down")) return Object.freeze({ x: 0, y: 1 });
  return Object.freeze({ x: 0, y: 0 });
}

export function quantmanLookTriggersShift(
  previous: Readonly<{ x: -1 | 0 | 1; y: -1 | 0 | 1 }>,
  next: Readonly<{ x: -1 | 0 | 1; y: -1 | 0 | 1 }>,
): boolean {
  if (next.x === 0 && next.y === 0) return false;
  return previous.x !== next.x || previous.y !== next.y;
}

function removeDirection(
  directionOrder: SemanticAction[],
  action: SemanticAction,
): void {
  const index = directionOrder.indexOf(action);
  if (index >= 0) directionOrder.splice(index, 1);
}

function earliest(current: number | null, candidate: number): number {
  return current === null ? candidate : Math.min(current, candidate);
}

function freezeRecording(
  inputs: readonly QuantmanInput[],
): readonly QuantmanInput[] {
  return Object.freeze(inputs.map((input) => Object.freeze({ ...input })));
}
