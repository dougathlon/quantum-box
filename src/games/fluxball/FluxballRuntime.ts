import { FixedStepClock } from "../../core/fixedStep";
import type { RunContext } from "../../core/run";
import type { ScreenScene } from "../../game/ScreenScene";
import type { InputSignal, SemanticAction } from "../../input/InputController";
import type { QuantumBoxShell } from "../../ui/QuantumBoxShell";
import { FluxballSession } from "./FluxballSession";
import type { PlayerInput } from "./standalone/input";
import type { PlayerId } from "./standalone/modes";
import {
  createFluxballFeedbackCursor,
  routeFluxballFeedback,
  type FluxballFeedbackCursor,
  type FluxballFeedbackEvent,
} from "./FluxballFeedback";
import type {
  FluxballFormat,
  FluxballHumanInput,
  FluxballRevealRequest,
  FluxballSnapshot,
} from "./types";

export interface FluxballRuntimeCallbacks {
  readonly onCompleted: (
    snapshot: FluxballSnapshot,
    recording: readonly FluxballHumanInput[],
  ) => void;
  readonly onContinue: () => void;
  readonly onReplay: () => void;
  readonly onFeedback?: (event: FluxballFeedbackEvent) => void;
  readonly onInputApplied?: (capturedAtMs: number) => void;
  readonly onAudit?: (evidence: unknown) => void;
}

export class FluxballRuntime {
  private readonly clock = new FixedStepClock(1 / 20);
  private readonly held = new Set<SemanticAction>();
  private readonly session: FluxballSession;
  private readonly recording: FluxballHumanInput[] = [];
  private replayIndex = 0;
  private frameId = 0;
  private previousTimestamp = 0;
  private paused = false;
  private completionReported = false;
  private stopped = false;
  private feedbackCursor: FluxballFeedbackCursor =
    createFluxballFeedbackCursor();
  private pendingInputAtMs: number | null = null;
  private pendingRevealRequests: FluxballRevealRequest[] = [];
  private revealHistoryPage = 0;
  private readonly playMode: RunContext["playMode"];

  public constructor(
    context: RunContext,
    format: FluxballFormat,
    private readonly scene: ScreenScene,
    private readonly shell: QuantumBoxShell,
    private readonly callbacks: FluxballRuntimeCallbacks,
    private readonly replayInputs: readonly FluxballHumanInput[] | null = null,
  ) {
    this.playMode = context.playMode;
    this.session = new FluxballSession(context, format);
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
    const snapshot = this.session.snapshot();
    if (isDirectional(signal.action)) {
      if (signal.pressed && snapshot.phase === "reveal") {
        if (signal.action.endsWith("-left")) this.changeRevealPage(-1);
        else if (signal.action.endsWith("-right")) this.changeRevealPage(1);
        return;
      }
      const changed = this.held.has(signal.action) !== signal.pressed;
      if (signal.pressed) this.held.add(signal.action);
      else this.held.delete(signal.action);
      if (changed && !this.paused && snapshot.phase === "active") {
        this.pendingInputAtMs = earliest(
          this.pendingInputAtMs,
          signal.capturedAtMs,
        );
      }
      return;
    }
    if (!signal.pressed) return;
    const revealPlayerId = revealPlayerFor(signal, snapshot);
    if (revealPlayerId && snapshot.phase === "active" && !this.paused) {
      this.pendingRevealRequests.push(
        Object.freeze({
          playerId: revealPlayerId,
          capturedAtMs: signal.capturedAtMs,
        }),
      );
      this.pendingInputAtMs = earliest(
        this.pendingInputAtMs,
        signal.capturedAtMs,
      );
      return;
    }
    if (signal.action === "primary" || signal.action === "p1-action")
      this.advanceRevealOrExit();
    else if (signal.action === "secondary" && this.isComplete()) {
      this.callbacks.onReplay();
    } else if (signal.action === "pause") this.togglePause();
  }

  public togglePause(): boolean | null {
    if (this.session.snapshot().phase !== "active") return null;
    this.paused = !this.paused;
    this.clock.reset();
    this.render(this.session.snapshot());
    return this.paused;
  }

  public pause(): boolean {
    if (this.paused || this.session.snapshot().phase !== "active") return false;
    this.paused = true;
    this.clock.reset();
    this.render(this.session.snapshot());
    return true;
  }

  public requestReplay(): void {
    if (this.isComplete()) this.callbacks.onReplay();
  }

  public continueRound(): void {
    this.advanceRevealOrExit();
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
    if (!this.paused && snapshot.phase === "active") {
      const advance = this.clock.advance(elapsed);
      for (let step = 0; step < advance.steps; step += 1) {
        if (snapshot.phase !== "active") break;
        snapshot = this.session.step(this.nextInput(snapshot));
        this.dispatchFeedback(snapshot);
        inputApplied = true;
      }
    }
    this.render(snapshot);
    if (inputApplied && this.pendingInputAtMs !== null) {
      this.callbacks.onInputApplied?.(this.pendingInputAtMs);
      this.pendingInputAtMs = null;
    }
    this.reportCompletion(snapshot);
    this.frameId = requestAnimationFrame(this.frame);
  };

  private nextInput(snapshot: FluxballSnapshot): FluxballHumanInput {
    if (this.replayInputs !== null) {
      const input = this.replayInputs[this.replayIndex];
      if (!input) {
        if (snapshot.phase === "active") {
          throw new Error(
            "Fluxball replay input tape ended before the match completed.",
          );
        }
        return EMPTY_INPUT;
      }
      this.replayIndex += 1;
      const frozen = freezeInput(input);
      this.recording.push(frozen);
      return frozen;
    }
    const players: Partial<Record<PlayerId, Readonly<PlayerInput>>> = {};
    for (const playerId of snapshot.format.humanPlayerIds) {
      const playerNumber =
        (["A", "B", "C", "D"] as const).indexOf(playerId) + 1;
      players[playerId] = Object.freeze({
        up: this.held.has(`p${playerNumber}-up` as SemanticAction),
        down: this.held.has(`p${playerNumber}-down` as SemanticAction),
        left: this.held.has(`p${playerNumber}-left` as SemanticAction),
        right: this.held.has(`p${playerNumber}-right` as SemanticAction),
      });
    }
    const input = freezeInput({
      players,
      revealRequests: this.pendingRevealRequests.splice(0),
    });
    this.recording.push(input);
    return input;
  }

  private advanceRevealOrExit(): void {
    const snapshot = this.session.snapshot();
    if (snapshot.phase === "active") return;
    if (snapshot.phase === "complete") {
      this.callbacks.onContinue();
      return;
    }
    this.paused = false;
    this.clock.reset();
    this.revealHistoryPage = 0;
    const next = this.session.continueAfterReveal();
    this.render(next);
    this.reportCompletion(next);
  }

  private changeRevealPage(delta: -1 | 1): void {
    const snapshot = this.session.snapshot();
    const pageCount = snapshot.reveal?.epochs.length ?? 0;
    if (pageCount < 2) return;
    this.revealHistoryPage = Math.max(
      0,
      Math.min(pageCount - 1, this.revealHistoryPage + delta),
    );
    this.render(snapshot);
  }

  private reportCompletion(snapshot: FluxballSnapshot): void {
    if (snapshot.phase !== "complete" || this.completionReported) return;
    this.completionReported = true;
    this.callbacks.onCompleted(snapshot, freezeRecording(this.recording));
  }

  private render(snapshot: FluxballSnapshot): void {
    this.scene.showFluxball(snapshot, this.paused);
    this.shell.updateFluxballHud(
      snapshot,
      this.paused,
      this.playMode,
      this.revealHistoryPage,
    );
    this.callbacks.onAudit?.(this.session.developerAudit());
  }

  private dispatchFeedback(snapshot: FluxballSnapshot): void {
    const route = routeFluxballFeedback(this.feedbackCursor, snapshot);
    this.feedbackCursor = route.cursor;
    for (const event of route.events) this.callbacks.onFeedback?.(event);
  }
}

const EMPTY_INPUT: FluxballHumanInput = Object.freeze({
  players: {},
  revealRequests: [],
});

function isDirectional(action: SemanticAction): boolean {
  return /^p[1-4]-(up|down|left|right)$/.test(action);
}

function earliest(current: number | null, candidate: number): number {
  return current === null ? candidate : Math.min(current, candidate);
}

function freezeInput(input: FluxballHumanInput): FluxballHumanInput {
  const players: Partial<Record<PlayerId, Readonly<PlayerInput>>> = {};
  for (const [playerId, value] of Object.entries(input.players)) {
    if (value) players[playerId as PlayerId] = Object.freeze({ ...value });
  }
  return Object.freeze({
    players: Object.freeze(players),
    revealRequests: Object.freeze(
      (input.revealRequests ?? []).map((request) =>
        Object.freeze({ ...request }),
      ),
    ),
  });
}

function revealPlayerFor(
  signal: InputSignal,
  snapshot: FluxballSnapshot,
): PlayerId | null {
  const actionMatch = /^p([1-4])-action$/.exec(signal.action);
  if (actionMatch) {
    const playerId = (["A", "B", "C", "D"] as const)[
      Number(actionMatch[1]) - 1
    ];
    return playerId && snapshot.format.humanPlayerIds.includes(playerId)
      ? playerId
      : null;
  }
  if (signal.action === "start" && signal.source === "keyboard") {
    return snapshot.format.humanPlayerIds.includes("B") ? "B" : null;
  }
  if (signal.action !== "primary") return null;
  if (signal.source === "keyboard" || signal.deviceId === "gamepad:0") {
    return snapshot.format.humanPlayerIds.includes("A") ? "A" : null;
  }
  if (signal.deviceId === "gamepad:1") {
    return snapshot.format.humanPlayerIds.includes("B") ? "B" : null;
  }
  return null;
}

function freezeRecording(
  inputs: readonly FluxballHumanInput[],
): readonly FluxballHumanInput[] {
  return Object.freeze(inputs.map(freezeInput));
}
