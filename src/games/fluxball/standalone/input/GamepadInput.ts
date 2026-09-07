import type { LobbyController } from "../modes";
import { inputFromAxis, type PlayerInput } from "./types";

const START_BUTTON = 9;
const DPAD_UP = 12;
const DPAD_DOWN = 13;
const DPAD_LEFT = 14;
const DPAD_RIGHT = 15;
const DEAD_ZONE = 0.25;

export interface GamepadPollResult {
  readonly startRequests: readonly LobbyController[];
  readonly disconnectedControllerIds: readonly string[];
}

type GamepadProvider = () => readonly (Gamepad | null)[];

function controllerId(index: number): string {
  return `gamepad:${index}`;
}

function indexFromControllerId(id: string): number | null {
  if (!id.startsWith("gamepad:")) return null;
  const value = Number(id.slice("gamepad:".length));
  return Number.isInteger(value) && value >= 0 ? value : null;
}

function buttonPressed(gamepad: Gamepad, index: number): boolean {
  const button = gamepad.buttons[index];
  return Boolean(button?.pressed || (button?.value ?? 0) > 0.5);
}

export class GamepadInput {
  private readonly priorStart = new Map<number, boolean>();
  private readonly previouslyConnected = new Set<number>();

  public constructor(
    private readonly provider: GamepadProvider = () => navigator.getGamepads(),
  ) {}

  public poll(): GamepadPollResult {
    const gamepads = this.provider();
    const connected = new Set<number>();
    const startRequests: LobbyController[] = [];
    for (const gamepad of gamepads) {
      if (!gamepad || !gamepad.connected || gamepad.mapping !== "standard") {
        continue;
      }
      connected.add(gamepad.index);
      const pressed = buttonPressed(gamepad, START_BUTTON);
      if (pressed && !this.priorStart.get(gamepad.index)) {
        startRequests.push({
          controllerId: controllerId(gamepad.index),
          label: `GAMEPAD ${gamepad.index + 1}`,
        });
      }
      this.priorStart.set(gamepad.index, pressed);
    }
    const disconnectedControllerIds = [...this.previouslyConnected]
      .filter((index) => !connected.has(index))
      .map(controllerId);
    this.previouslyConnected.clear();
    connected.forEach((index) => this.previouslyConnected.add(index));
    for (const index of [...this.priorStart.keys()]) {
      if (!connected.has(index)) this.priorStart.delete(index);
    }
    return Object.freeze({
      startRequests: Object.freeze(startRequests),
      disconnectedControllerIds: Object.freeze(disconnectedControllerIds),
    });
  }

  public snapshot(id: string): Readonly<PlayerInput> | null {
    const index = indexFromControllerId(id);
    if (index === null) return null;
    const gamepad = this.provider()[index];
    if (!gamepad || !gamepad.connected || gamepad.mapping !== "standard") {
      return null;
    }
    const rawX = gamepad.axes[0] ?? 0;
    const rawY = gamepad.axes[1] ?? 0;
    const axisX = Math.abs(rawX) >= DEAD_ZONE ? rawX : 0;
    const axisY = Math.abs(rawY) >= DEAD_ZONE ? rawY : 0;
    const x =
      axisX +
      Number(buttonPressed(gamepad, DPAD_RIGHT)) -
      Number(buttonPressed(gamepad, DPAD_LEFT));
    const y =
      axisY +
      Number(buttonPressed(gamepad, DPAD_DOWN)) -
      Number(buttonPressed(gamepad, DPAD_UP));
    return Object.freeze(inputFromAxis({ x, y }, DEAD_ZONE));
  }
}
