import { FixedStepClock } from "../../core/fixedStep";
import type { RunContext } from "../../core/run";
import type { ScreenScene } from "../../game/ScreenScene";
import type { InputSignal, SemanticAction } from "../../input/InputController";
import type { QuantumBoxShell } from "../../ui/QuantumBoxShell";
import { QongSession } from "./QongSession";
import type {
  QongInput,
  QongOpponent,
  QongPackPayload,
  QongSnapshot,
} from "./types";
import {
  createQongFeedbackCursor,
  qongFeedbackFrame,
  routeQongFeedback,
  type QongFeedbackCursor,
  type QongFeedbackEvent,
} from "./QongFeedback";

export interface QongRuntimeCallbacks {
  readonly onCompleted: (
    snapshot: QongSnapshot,
    recording: readonly QongInput[],
  ) => void;
  readonly onContinue: () => void;
  readonly onReplay: () => void;
  readonly onFeedback?: (event: "observe" | "goal") => void;
  readonly onFeedbackEvent?: (event: QongFeedbackEvent) => void;
  readonly onInputApplied?: (capturedAtMs: number) => void;
  readonly onAudit?: (evidence: unknown) => void;
}

export class QongRuntime {
  private readonly clock = new FixedStepClock(1 / 60);
  private readonly held = new Set<SemanticAction>();
  private readonly session: QongSession;
  private readonly recording: QongInput[] = [];
  private replayIndex = 0;
  private frameId = 0;
  private previousTimestamp = 0;
  private observeQueued = false;
  private paused = false;
  private completionReported = false;
  private stopped = false;
  private feedbackCursor: QongFeedbackCursor;
  private pendingInputAtMs: number | null = null;

  public constructor(
    context: RunContext,
    payload: QongPackPayload,
    private readonly opponent: QongOpponent,
    private readonly scene: ScreenScene,
    private readonly shell: QuantumBoxShell,
    private readonly callbacks: QongRuntimeCallbacks,
    private readonly replayInputs: readonly QongInput[] | null = null,
  ) {
    this.session = new QongSession(context, payload, opponent);
    this.feedbackCursor = createQongFeedbackCursor(
      qongFeedbackFrame(this.session.snapshot()),
    );
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
  }

  public handleInput(signal: InputSignal): void {
    if (this.stopped) return;
    if (
      signal.action === "p1-action" ||
      (signal.action === "p2-action" && this.opponent === "local")
    ) {
      signal = { ...signal, action: "primary" };
    }
    if (this.replayInputs !== null) {
      if (!signal.pressed) return;
      if (
        signal.action === "primary" &&
        this.session.snapshot().phase === "complete"
      ) {
        this.callbacks.onContinue();
      } else if (
        signal.action === "secondary" &&
        this.session.snapshot().phase === "complete"
      ) {
        this.callbacks.onReplay();
      } else if (signal.action === "pause") {
        this.togglePause();
      }
      return;
    }
    if (isDirectional(signal.action)) {
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
    if (signal.action === "primary") {
      if (this.session.snapshot().phase === "complete")
        this.callbacks.onContinue();
      else this.observeQueued = true;
    } else if (
      signal.action === "secondary" &&
      this.session.snapshot().phase === "complete"
    ) {
      this.callbacks.onReplay();
    } else if (signal.action === "pause") {
      this.paused = !this.paused;
      this.clock.reset();
      this.render(this.session.snapshot());
    }
  }

  public requestObserve(): void {
    if (
      this.replayInputs === null &&
      this.session.snapshot().phase !== "complete"
    ) {
      this.observeQueued = true;
    }
  }

  public requestReplay(): void {
    if (this.session.snapshot().phase === "complete") {
      this.callbacks.onReplay();
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

  public isPaused(): boolean {
    return this.paused;
  }

  public isComplete(): boolean {
    return this.session.snapshot().phase === "complete";
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
        if (snapshot.phase === "complete") break;
        const input = this.nextInput(snapshot);
        snapshot = this.session.step(input);
        this.dispatchFeedback(snapshot);
        inputApplied = true;
        this.observeQueued = false;
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

  private leftAxis(): -1 | 0 | 1 {
    return qongAxisForPlayer(this.held, 1);
  }

  private rightAxis(): -1 | 0 | 1 {
    return qongAxisForPlayer(this.held, 2);
  }

  private nextInput(snapshot: QongSnapshot): QongInput {
    if (this.replayInputs !== null) {
      const input = this.replayInputs[this.replayIndex];
      if (!input) {
        if (snapshot.phase !== "complete") {
          throw new Error(
            "Qong replay input tape ended before the recorded match completed.",
          );
        }
        return NEUTRAL_INPUT;
      }
      this.replayIndex += 1;
      const replayInput = Object.freeze({ ...input });
      this.recording.push(replayInput);
      return replayInput;
    }
    const input = Object.freeze({
      leftAxis: this.leftAxis(),
      rightAxis: this.rightAxis(),
      observePressed: this.observeQueued,
    });
    this.recording.push(input);
    return input;
  }

  private render(snapshot: QongSnapshot): void {
    this.scene.showQong(snapshot, this.opponent, this.paused);
    this.shell.updateQongHud(snapshot, this.opponent, this.paused);
    if (this.opponent === "cpu") {
      this.callbacks.onAudit?.(this.session.developerAudit());
    }
  }

  private dispatchFeedback(snapshot: QongSnapshot): void {
    const route = routeQongFeedback(
      this.feedbackCursor,
      qongFeedbackFrame(snapshot),
    );
    this.feedbackCursor = route.cursor;
    for (const event of route.events) {
      this.callbacks.onFeedbackEvent?.(event);
      if (event === "measurement-start") this.callbacks.onFeedback?.("observe");
      else if (event === "goal-resolution") this.callbacks.onFeedback?.("goal");
    }
  }
}

export function qongAxisForPlayer(
  held: ReadonlySet<SemanticAction>,
  player: 1 | 2,
): -1 | 0 | 1 {
  const up = held.has(`p${player}-up`);
  const down = held.has(`p${player}-down`);
  return up === down ? 0 : up ? -1 : 1;
}

const NEUTRAL_INPUT: QongInput = Object.freeze({
  leftAxis: 0,
  rightAxis: 0,
  observePressed: false,
});

function freezeRecording(inputs: readonly QongInput[]): readonly QongInput[] {
  return Object.freeze(inputs.map((input) => Object.freeze({ ...input })));
}

function isDirectional(action: SemanticAction): boolean {
  return action.startsWith("p1-") || action.startsWith("p2-");
}

function earliest(current: number | null, candidate: number): number {
  return current === null ? candidate : Math.min(current, candidate);
}
