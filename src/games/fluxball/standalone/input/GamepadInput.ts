import { readGamepad } from "../../../../input/GamepadMapping";
import type { LobbyController } from "../modes";
import { inputFromAxis, type PlayerInput } from "./types";

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
      if (!gamepad || !gamepad.connected) {
        continue;
      }
      connected.add(gamepad.index);
      const pressed = readGamepad(gamepad).start;
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
    if (!gamepad || !gamepad.connected) {
      return null;
    }
    const state = readGamepad(gamepad);
    return Object.freeze(
      inputFromAxis(
        {
          x:
            Math.abs(gamepad.axes[0] ?? 0) >= 0.3
              ? gamepad.axes[0]!
              : Number(state.right) - Number(state.left),
          y:
            Math.abs(gamepad.axes[1] ?? 0) >= 0.3
              ? gamepad.axes[1]!
              : Number(state.down) - Number(state.up),
        },
        0.3,
      ),
    );
  }
}
