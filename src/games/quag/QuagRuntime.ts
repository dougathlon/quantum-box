import { FixedStepClock } from "../../core/fixedStep";
import type { RunContext } from "../../core/run";
import type { ScreenScene } from "../../game/ScreenScene";
import type { InputSignal, SemanticAction } from "../../input/InputController";
import type { QuantumBoxShell } from "../../ui/QuantumBoxShell";
import type { QGraphCabinetPack } from "../qgraph/QGraphPack";
import {
  createQuagFeedbackCursor,
  routeQuagFeedback,
  type QuagFeedbackCursor,
  type QuagFeedbackEvent,
} from "./QuagFeedback";
import { QuagSession } from "./QuagSession";
import type { QuagScenario } from "./QuagSession";
import {
  QUAG_PLAYER_IDS,
  type QuagInput,
  type QuagPhase,
  type QuagPlayerControl,
  type QuagPlayerId,
  type QuagSnapshot,
} from "./types";

export interface QuagRuntimeCallbacks {
  readonly onCompleted: (
    snapshot: QuagSnapshot,
    recording: readonly QuagInput[],
  ) => void;
  readonly onExit: () => void;
  readonly onRestart: () => void;
  readonly onReplay: () => void;
  readonly onFeedback?: (event: "capture" | "shift") => void;
  readonly onFeedbackEvent?: (event: QuagFeedbackEvent) => void;
  readonly onInputApplied?: (capturedAtMs: number) => void;
}

export class QuagRuntime {
  private readonly clock = new FixedStepClock(1 / 20);
  private readonly held = new Set<SemanticAction>();
  private readonly session: QuagSession;
  private readonly recording: QuagInput[] = [];
  private replayIndex = 0;
  private frameId = 0;
  private previousTimestamp = 0;
  private paused = false;
  private completionReported = false;
  private stopped = false;
  private feedbackCursor: QuagFeedbackCursor;
  private pendingInputAtMs: number | null = null;
  private readonly flapQueued = new Set<QuagPlayerId>();
  private readonly humanPlayerIds: ReadonlySet<QuagPlayerId>;
  private interpolationAlpha = 1;

  public constructor(
    context: RunContext,
    pack: QGraphCabinetPack,
    private readonly scene: ScreenScene,
    private readonly shell: QuantumBoxShell,
    private readonly callbacks: QuagRuntimeCallbacks,
    private readonly replayInputs: readonly QuagInput[] | null = null,
    scenario: QuagScenario = {},
  ) {
    this.session = new QuagSession(context, pack, scenario);
    this.humanPlayerIds = new Set(this.session.snapshot().humanPlayerIds);
    this.feedbackCursor = createQuagFeedbackCursor(this.session.snapshot());
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
    this.flapQueued.clear();
  }

  public handleInput(signal: InputSignal): void {
    if (this.stopped) return;
    const horizontalPlayer = quagHorizontalPlayer(signal.action);
    const flapPlayer = quagFlapPlayer(signal.action);
    if (this.replayInputs === null && horizontalPlayer !== null) {
      if (!this.humanPlayerIds.has(horizontalPlayer)) return;
      const changed = this.held.has(signal.action) !== signal.pressed;
      if (signal.pressed) this.held.add(signal.action);
      else this.held.delete(signal.action);
      if (changed) this.noteInput(signal.capturedAtMs);
      return;
    }
    if (
      this.replayInputs === null &&
      signal.pressed &&
      flapPlayer !== null &&
      !this.paused &&
      !this.isComplete()
    ) {
      if (!this.humanPlayerIds.has(flapPlayer)) return;
      this.flapQueued.add(flapPlayer);
      this.noteInput(signal.capturedAtMs);
      return;
    }
    if (!signal.pressed) return;
    if (
      flapPlayer !== null &&
      this.humanPlayerIds.has(flapPlayer) &&
      this.isComplete()
    )
      this.callbacks.onExit();
    else if (signal.action === "secondary") {
      if (this.isComplete()) this.callbacks.onReplay();
      else if (this.paused) this.callbacks.onRestart();
    } else if (signal.action === "pause") this.togglePause();
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

  public requestRestart(): void {
    this.callbacks.onRestart();
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
      this.interpolationAlpha = advance.alpha;
      for (let step = 0; step < advance.steps; step += 1) {
        if (snapshot.phase === "complete") break;
        const phaseBeforeStep = snapshot.phase;
        const input = this.nextInput(snapshot);
        snapshot = this.session.step(input);
        this.processEvents(snapshot, input);
        if (phaseBeforeStep === "active") inputApplied = true;
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

  private nextInput(snapshot: QuagSnapshot): QuagInput {
    if (this.replayInputs !== null) {
      const input = this.replayInputs[this.replayIndex];
      if (!input) {
        if (snapshot.phase !== "complete")
          throw new Error(
            "Quarry replay tape ended before the round completed.",
          );
        return NEUTRAL_INPUT;
      }
      this.replayIndex += 1;
      const frozen = freezeInput(input);
      this.recording.push(frozen);
      return frozen;
    }
    const players = Object.fromEntries(
      QUAG_PLAYER_IDS.filter((id) => this.humanPlayerIds.has(id)).map((id) => [
        id,
        Object.freeze({
          horizontal: playerAxis(this.held, id),
          flapPressed: this.flapQueued.has(id),
        }) satisfies QuagPlayerControl,
      ]),
    );
    const playerA = players["A"] ?? NEUTRAL_CONTROL;
    const input = Object.freeze({
      horizontal: playerA.horizontal,
      flapPressed: playerA.flapPressed,
      players: Object.freeze(players),
    });
    this.flapQueued.clear();
    this.recording.push(input);
    return input;
  }

  private processEvents(snapshot: QuagSnapshot, input: QuagInput): void {
    const route = routeQuagFeedback(this.feedbackCursor, snapshot, input);
    this.feedbackCursor = route.cursor;
    for (const event of route.events) {
      this.callbacks.onFeedbackEvent?.(event);
      if (event.type === "capture") this.callbacks.onFeedback?.("capture");
      else if (event.type === "graph-shift")
        this.callbacks.onFeedback?.("shift");
    }
  }

  private noteInput(capturedAtMs: number): void {
    if (this.paused || this.isComplete()) return;
    this.pendingInputAtMs = earliest(this.pendingInputAtMs, capturedAtMs);
  }

  private render(snapshot: QuagSnapshot): void {
    this.scene.showQuag(
      snapshot,
      this.paused,
      quagRenderInterpolationAlpha(
        snapshot.phase,
        this.paused,
        this.interpolationAlpha,
      ),
    );
    this.shell.updateQuagHud(snapshot, this.paused);
  }
}

export function quagRenderInterpolationAlpha(
  phase: QuagPhase,
  paused: boolean,
  interpolationAlpha: number,
): number {
  return paused || phase !== "active" ? 1 : interpolationAlpha;
}

const NEUTRAL_INPUT: QuagInput = Object.freeze({
  horizontal: 0,
  flapPressed: false,
});

function quagHorizontalPlayer(action: SemanticAction): QuagPlayerId | null {
  const match = /^p([1-4])-(?:left|right)$/.exec(action);
  return match ? QUAG_PLAYER_IDS[Number(match[1]) - 1]! : null;
}

function quagFlapPlayer(action: SemanticAction): QuagPlayerId | null {
  if (action === "primary") return "A";
  const match = /^p([1-4])-(?:action|up)$/.exec(action);
  return match ? QUAG_PLAYER_IDS[Number(match[1]) - 1]! : null;
}

function playerAxis(
  held: ReadonlySet<SemanticAction>,
  playerId: QuagPlayerId,
): -1 | 0 | 1 {
  const playerNumber = QUAG_PLAYER_IDS.indexOf(playerId) + 1;
  const left = held.has(`p${playerNumber}-left` as SemanticAction);
  const right = held.has(`p${playerNumber}-right` as SemanticAction);
  return ((right ? 1 : 0) - (left ? 1 : 0)) as -1 | 0 | 1;
}

function earliest(current: number | null, candidate: number): number {
  return current === null ? candidate : Math.min(current, candidate);
}

function freezeRecording(inputs: readonly QuagInput[]): readonly QuagInput[] {
  return Object.freeze(inputs.map(freezeInput));
}

function freezeInput(input: QuagInput): QuagInput {
  if (!input.players) return Object.freeze({ ...input });
  const players = Object.freeze(
    Object.fromEntries(
      Object.entries(input.players).map(([id, control]) => [
        id,
        Object.freeze({ ...control }),
      ]),
    ),
  ) as Readonly<Partial<Record<QuagPlayerId, QuagPlayerControl>>>;
  return Object.freeze({ ...input, players });
}

const NEUTRAL_CONTROL: QuagPlayerControl = Object.freeze({
  horizontal: 0,
  flapPressed: false,
});
