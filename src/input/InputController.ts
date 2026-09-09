import {
  DEFAULT_KEYBOARD_BINDINGS,
  KEYBOARD_CONTROLS,
  KEYBOARD_PLAYERS,
  validateKeyboardBindings,
  type KeyboardBindings,
} from "./KeyboardBindings";

export const SEMANTIC_ACTIONS = [
  "p1-up",
  "p1-down",
  "p1-left",
  "p1-right",
  "p2-up",
  "p2-down",
  "p2-left",
  "p2-right",
  "p3-up",
  "p3-down",
  "p3-left",
  "p3-right",
  "p4-up",
  "p4-down",
  "p4-left",
  "p4-right",
  "p1-action",
  "p2-action",
  "p3-action",
  "p4-action",
  "primary",
  "secondary",
  "start",
  "back",
  "pause",
  "mute",
] as const;
export type SemanticAction = (typeof SEMANTIC_ACTIONS)[number];

export interface InputSignal {
  readonly action: SemanticAction;
  readonly pressed: boolean;
  readonly source: "keyboard" | "gamepad";
  readonly deviceId: string;
  readonly capturedAtMs: number;
}

export type InputListener = (signal: InputSignal) => void;

export interface InputDeviceEvent {
  readonly deviceId: string;
  readonly label: string;
  readonly connected: boolean;
}

export type InputDeviceListener = (event: InputDeviceEvent) => void;

const SYSTEM_KEYBOARD_ACTIONS: Readonly<Record<string, SemanticAction>> = {
  KeyX: "secondary",
  Escape: "back",
  KeyP: "pause",
  KeyM: "mute",
};

export class InputController {
  private readonly listeners = new Set<InputListener>();
  private readonly deviceListeners = new Set<InputDeviceListener>();
  private readonly latchedUntilRelease = new Set<SemanticAction>();
  private readonly gamepadState = new Map<
    string,
    ReadonlySet<SemanticAction>
  >();
  private frameId = 0;
  private disposed = false;
  private keyboardBindings: KeyboardBindings;

  public constructor(
    private readonly windowTarget: Window = window,
    private readonly documentTarget: Document = document,
    keyboardBindings: KeyboardBindings = DEFAULT_KEYBOARD_BINDINGS,
  ) {
    this.keyboardBindings = validateKeyboardBindings(keyboardBindings);
    windowTarget.addEventListener("keydown", this.onKeyDown);
    windowTarget.addEventListener("keyup", this.onKeyUp);
    windowTarget.addEventListener("blur", this.onBlur);
    this.frameId = windowTarget.requestAnimationFrame(this.pollGamepads);
  }

  public subscribe(listener: InputListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public subscribeDevices(listener: InputDeviceListener): () => void {
    this.deviceListeners.add(listener);
    return () => this.deviceListeners.delete(listener);
  }

  public setKeyboardBindings(bindings: KeyboardBindings): void {
    this.releaseKeyboardActions();
    this.keyboardBindings = validateKeyboardBindings(bindings);
  }

  /**
   * Prevent a held action from being observed as a second press after a
   * synchronous screen transition. The releasing edge is still delivered so
   * a cabinet can never retain a stale held control.
   */
  public latchUntilRelease(action: SemanticAction): void {
    this.latchedUntilRelease.add(action);
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.windowTarget.cancelAnimationFrame(this.frameId);
    this.windowTarget.removeEventListener("keydown", this.onKeyDown);
    this.windowTarget.removeEventListener("keyup", this.onKeyUp);
    this.windowTarget.removeEventListener("blur", this.onBlur);
    this.listeners.clear();
    this.deviceListeners.clear();
    this.gamepadState.clear();
    this.latchedUntilRelease.clear();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) return;
    const action = this.keyboardAction(event.code);
    if (!action || event.repeat) return;
    event.preventDefault();
    this.emit({
      action,
      pressed: true,
      source: "keyboard",
      deviceId: "keyboard:primary",
      capturedAtMs: performance.now(),
    });
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    if (isEditableTarget(event.target)) return;
    const action = this.keyboardAction(event.code);
    if (!action) return;
    event.preventDefault();
    this.emit({
      action,
      pressed: false,
      source: "keyboard",
      deviceId: "keyboard:primary",
      capturedAtMs: performance.now(),
    });
  };

  private readonly onBlur = (): void => {
    this.releaseKeyboardActions();
  };

  private releaseKeyboardActions(): void {
    for (const action of SEMANTIC_ACTIONS) {
      this.emit({
        action,
        pressed: false,
        source: "keyboard",
        deviceId: "keyboard:primary",
        capturedAtMs: performance.now(),
      });
    }
  }

  private keyboardAction(code: string): SemanticAction | undefined {
    const systemAction = SYSTEM_KEYBOARD_ACTIONS[code];
    if (systemAction) return systemAction;
    for (
      let playerIndex = 0;
      playerIndex < KEYBOARD_PLAYERS.length;
      playerIndex += 1
    ) {
      const playerId = KEYBOARD_PLAYERS[playerIndex];
      if (!playerId) continue;
      const bindings = this.keyboardBindings[playerId];
      for (const control of KEYBOARD_CONTROLS) {
        if (bindings[control] !== code) continue;
        const playerNumber = playerIndex + 1;
        return control === "action"
          ? (`p${playerNumber}-action` as SemanticAction)
          : (`p${playerNumber}-${control}` as SemanticAction);
      }
    }
    return undefined;
  }

  private readonly pollGamepads = (): void => {
    if (this.disposed) return;
    const seen = new Set<string>();
    for (const gamepad of this.windowTarget.navigator.getGamepads()) {
      if (!gamepad || !gamepad.connected || gamepad.mapping !== "standard")
        continue;
      const id = `gamepad:${gamepad.index}`;
      seen.add(id);
      if (!this.gamepadState.has(id)) {
        this.emitDevice({
          deviceId: id,
          label: gamepadLabel(gamepad),
          connected: true,
        });
      }
      const current = gamepadActions(gamepad, gamepad.index === 0 ? 1 : 2);
      const previous = this.gamepadState.get(id) ?? new Set<SemanticAction>();
      for (const action of SEMANTIC_ACTIONS) {
        if (current.has(action) !== previous.has(action)) {
          this.emit({
            action,
            pressed: current.has(action),
            source: "gamepad",
            deviceId: id,
            capturedAtMs: performance.now(),
          });
        }
      }
      this.gamepadState.set(id, current);
    }
    for (const [id, previous] of this.gamepadState) {
      if (seen.has(id)) continue;
      for (const action of previous) {
        this.emit({
          action,
          pressed: false,
          source: "gamepad",
          deviceId: id,
          capturedAtMs: performance.now(),
        });
      }
      this.gamepadState.delete(id);
      this.emitDevice({
        deviceId: id,
        label: `GAMEPAD ${Number(id.slice("gamepad:".length)) + 1}`,
        connected: false,
      });
    }
    this.frameId = this.windowTarget.requestAnimationFrame(this.pollGamepads);
  };

  private emit(signal: InputSignal): void {
    if (signal.pressed && this.latchedUntilRelease.has(signal.action)) return;
    if (!signal.pressed) this.latchedUntilRelease.delete(signal.action);
    const frozen = Object.freeze({ ...signal });
    for (const listener of this.listeners) listener(frozen);
  }

  private emitDevice(event: InputDeviceEvent): void {
    const frozen = Object.freeze({ ...event });
    for (const listener of this.deviceListeners) listener(frozen);
  }
}

function gamepadLabel(gamepad: Gamepad): string {
  const supplied = gamepad.id.trim();
  return supplied || `GAMEPAD ${gamepad.index + 1}`;
}

export function gamepadActions(
  gamepad: Gamepad,
  player: 1 | 2,
): ReadonlySet<SemanticAction> {
  const actions = new Set<SemanticAction>();
  const button = (index: number): boolean =>
    Boolean(gamepad.buttons[index]?.pressed);
  const x = gamepad.axes[0] ?? 0;
  const y = gamepad.axes[1] ?? 0;
  if (x < -0.3 || button(14)) actions.add(`p${player}-left`);
  if (x > 0.3 || button(15)) actions.add(`p${player}-right`);
  if (y < -0.3 || button(12)) actions.add(`p${player}-up`);
  if (y > 0.3 || button(13)) actions.add(`p${player}-down`);
  if (button(0)) actions.add("primary");
  if (button(1)) actions.add("back");
  if (button(2)) actions.add("secondary");
  if (button(9)) actions.add("start");
  if (button(8)) actions.add("back");
  if (button(3)) actions.add("mute");
  return actions;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)
  );
}
