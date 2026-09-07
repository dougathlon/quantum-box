import { FixedStepClock } from "../../core/fixedStep";
import type { ScreenScene } from "../../game/ScreenScene";
import type { QongOpponent, QongSnapshot } from "../../games/qong/types";
import type { InputSignal } from "../../input/InputController";
import type { QuantumBoxShell } from "../../ui/QuantumBoxShell";
import {
  QONG_STORY_STEP_SECONDS,
  QongStorySequenceMachine,
  type QongStoryDirection,
  type QongStoryPhase,
} from "./QongStorySequence";

export interface QongStoryRuntimeCallbacks {
  readonly onPhaseChanged: (phase: QongStoryPhase, beatId: string) => void;
  readonly onTerminal: () => void;
  readonly onBack: () => void;
  readonly onCue: (
    cue: "story-morph" | "story-door" | "story-step" | "story-transport",
  ) => void;
}

export class QongStoryRuntime {
  private readonly clock = new FixedStepClock(QONG_STORY_STEP_SECONDS);
  private readonly machine: QongStorySequenceMachine;
  private frameId = 0;
  private previousTimestamp = 0;
  private stopped = false;

  public constructor(
    finalCourt: QongSnapshot,
    opponent: QongOpponent,
    resumeBeatId: string | null,
    reducedMotion: boolean,
    private readonly scene: ScreenScene,
    private readonly shell: QuantumBoxShell,
    private readonly callbacks: QongStoryRuntimeCallbacks,
  ) {
    this.machine = new QongStorySequenceMachine(
      finalCourt,
      resumeBeatId,
      reducedMotion,
    );
    this.scene.showQongStoryCourt(finalCourt, opponent);
  }

  public start(): void {
    if (this.stopped || this.frameId !== 0) return;
    this.previousTimestamp = performance.now();
    const snapshot = this.machine.snapshot();
    this.shell.beginQongStory(snapshot);
    this.callbacks.onCue("story-morph");
    this.frameId = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.stopped = true;
    cancelAnimationFrame(this.frameId);
    this.frameId = 0;
  }

  public handleInput(signal: InputSignal): void {
    if (this.stopped) return;
    if (signal.action === "back" && signal.pressed) {
      this.callbacks.onBack();
      return;
    }
    const direction = directionForSignal(signal.action);
    if (direction) {
      this.machine.setDirection(direction, signal.pressed);
      return;
    }
    if (
      signal.pressed &&
      (signal.action === "primary" || signal.action.endsWith("-action"))
    ) {
      this.machine.queueAction();
    }
  }

  public nudge(direction: QongStoryDirection): void {
    if (this.stopped) return;
    this.shell.updateQongStory(this.machine.nudge(direction));
    this.callbacks.onCue("story-step");
  }

  public use(): void {
    if (this.stopped) return;
    this.machine.queueAction();
  }

  private readonly frame = (timestamp: number): void => {
    if (this.stopped) return;
    const elapsed = (timestamp - this.previousTimestamp) / 1000;
    this.previousTimestamp = timestamp;
    const advance = this.clock.advance(elapsed);
    for (let step = 0; step < advance.steps; step += 1) {
      const result = this.machine.advance();
      this.shell.updateQongStory(result.snapshot);
      if (result.footstep) this.callbacks.onCue("story-step");
      if (result.phaseChanged) {
        this.callbacks.onPhaseChanged(
          result.snapshot.phase,
          result.snapshot.persistenceBeatId,
        );
        if (result.snapshot.phase === "door-opening") {
          this.callbacks.onCue("story-door");
        } else if (result.snapshot.phase === "office-walk") {
          this.callbacks.onCue("story-transport");
        }
      }
      if (result.terminalEntered) {
        this.stop();
        this.callbacks.onTerminal();
        return;
      }
    }
    this.frameId = requestAnimationFrame(this.frame);
  };
}

function directionForSignal(
  action: InputSignal["action"],
): QongStoryDirection | null {
  if (action.endsWith("-up")) return "up";
  if (action.endsWith("-down")) return "down";
  if (action.endsWith("-left")) return "left";
  if (action.endsWith("-right")) return "right";
  return null;
}
