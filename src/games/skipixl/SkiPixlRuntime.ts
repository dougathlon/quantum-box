import { FixedStepClock } from "../../core/fixedStep";
import type { RunContext } from "../../core/run";
import type { ScreenScene } from "../../game/ScreenScene";
import type { InputSignal, SemanticAction } from "../../input/InputController";
import type { QuantumBoxShell } from "../../ui/QuantumBoxShell";
import { SKIPIXL_CHALLENGE_PROFILE } from "./SkiPixlChallenge";
import { SkiPixlSession } from "./SkiPixlSession";
import type {
  SkiPixlInput,
  SkiPixlObstacleKind,
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "./types";

export interface SkiPixlRuntimeCallbacks {
  readonly onCompleted: (
    snapshot: SkiPixlSnapshot,
    recording: readonly SkiPixlInput[],
  ) => void;
  readonly onContinue: () => void;
  readonly onReplay: () => void;
  readonly onFeedback?: (
    event:
      | {
          readonly type: "collision";
          readonly kind: SkiPixlObstacleKind;
        }
      | {
          readonly type: "gate";
          readonly passed: boolean;
        },
  ) => void;
  readonly onCarve?: (intensity: number) => void;
  readonly onInputApplied?: (capturedAtMs: number) => void;
}

export class SkiPixlRuntime {
  private readonly clock = new FixedStepClock(1 / 60);
  private readonly held = new Set<SemanticAction>();
  private readonly session: SkiPixlSession;
  private readonly recording: SkiPixlInput[] = [];
  private replayIndex = 0;
  private frameId = 0;
  private previousTimestamp = 0;
  private paused = false;
  private completionReported = false;
  private stopped = false;
  private lastCollisionId: string | null = null;
  private lastGateId: string | null = null;
  private pendingInputAtMs: number | null = null;

  public constructor(
    context: RunContext,
    private readonly payload: SkiPixlPackPayload,
    private readonly scene: ScreenScene,
    private readonly shell: QuantumBoxShell,
    private readonly callbacks: SkiPixlRuntimeCallbacks,
    private readonly replayInputs: readonly SkiPixlInput[] | null = null,
  ) {
    this.session = new SkiPixlSession(context, payload);
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
    this.callbacks.onCarve?.(0);
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
    if (isSkiControl(signal.action)) {
      const changed = this.held.has(signal.action) !== signal.pressed;
      if (signal.pressed) this.held.add(signal.action);
      else this.held.delete(signal.action);
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
    if (signal.action === "primary" && this.isComplete()) {
      this.callbacks.onContinue();
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
    return this.session.snapshot().phase === "complete";
  }

  private readonly frame = (timestamp: number): void => {
    if (this.stopped) return;
    const elapsed = (timestamp - this.previousTimestamp) / 1_000;
    this.previousTimestamp = timestamp;
    let snapshot = this.session.snapshot();
    let inputApplied = false;
    if (!this.paused) {
      const advance = this.clock.advance(elapsed);
      for (let step = 0; step < advance.steps; step += 1) {
        if (snapshot.phase === "complete") break;
        snapshot = this.session.step(this.nextInput(snapshot));
        inputApplied = true;
      }
    }
    this.render(snapshot);
    if (inputApplied && this.pendingInputAtMs !== null) {
      this.callbacks.onInputApplied?.(this.pendingInputAtMs);
      this.pendingInputAtMs = null;
    }
    if (snapshot.phase === "complete" && !this.completionReported) {
      this.completionReported = true;
      this.callbacks.onCompleted(snapshot, freezeRecording(this.recording));
    }
    this.frameId = requestAnimationFrame(this.frame);
  };

  private nextInput(snapshot: SkiPixlSnapshot): SkiPixlInput {
    if (this.replayInputs !== null) {
      const input = this.replayInputs[this.replayIndex];
      if (!input) {
        if (snapshot.phase !== "complete") {
          throw new Error(
            "SkiPixl replay input tape ended before the descent completed.",
          );
        }
        return NEUTRAL_INPUT;
      }
      this.replayIndex += 1;
      const replayInput = Object.freeze({ ...input });
      this.recording.push(replayInput);
      return replayInput;
    }
    const input = skiPixlInputFromHeld(this.held);
    this.recording.push(input);
    return input;
  }

  private render(snapshot: SkiPixlSnapshot): void {
    if (
      snapshot.latestCollision &&
      snapshot.latestCollision.obstacleId !== this.lastCollisionId
    ) {
      this.lastCollisionId = snapshot.latestCollision.obstacleId;
      this.callbacks.onFeedback?.(
        Object.freeze({
          type: "collision",
          kind: snapshot.latestCollision.kind,
        }),
      );
    }
    if (snapshot.latestGate && snapshot.latestGate.gateId !== this.lastGateId) {
      this.lastGateId = snapshot.latestGate.gateId;
      this.callbacks.onFeedback?.(
        Object.freeze({
          type: "gate",
          passed: snapshot.latestGate.passed,
        }),
      );
    }
    const carveIntensity =
      !this.paused &&
      snapshot.phase === "active" &&
      snapshot.knockdownTicksRemaining === 0
        ? Math.abs(snapshot.lateralVelocity) /
          SKIPIXL_CHALLENGE_PROFILE.lateral.maximumSpeed
        : 0;
    this.callbacks.onCarve?.(carveIntensity);
    this.scene.showSkiPixl(snapshot, this.payload, this.paused);
    this.shell.updateSkiPixlHud(snapshot, this.paused);
  }
}

const NEUTRAL_INPUT: SkiPixlInput = Object.freeze({ steer: 0, throttle: 0 });

function axis(negative: boolean, positive: boolean): -1 | 0 | 1 {
  return negative === positive ? 0 : negative ? -1 : 1;
}

function isSkiControl(action: SemanticAction): boolean {
  return (
    action === "p1-left" ||
    action === "p1-right" ||
    action === "p1-down" ||
    action === "p2-left" ||
    action === "p2-right" ||
    action === "p2-down" ||
    action === "p3-down" ||
    action === "p4-down"
  );
}

export function skiPixlInputFromHeld(
  held: ReadonlySet<SemanticAction>,
): SkiPixlInput {
  return Object.freeze({
    steer: axis(
      held.has("p1-left") || held.has("p2-left"),
      held.has("p1-right") || held.has("p2-right"),
    ),
    throttle:
      held.has("p1-down") ||
      held.has("p2-down") ||
      held.has("p3-down") ||
      held.has("p4-down")
        ? 1
        : 0,
  });
}

function earliest(current: number | null, candidate: number): number {
  return current === null ? candidate : Math.min(current, candidate);
}

function freezeRecording(
  inputs: readonly SkiPixlInput[],
): readonly SkiPixlInput[] {
  return Object.freeze(inputs.map((input) => Object.freeze({ ...input })));
}
