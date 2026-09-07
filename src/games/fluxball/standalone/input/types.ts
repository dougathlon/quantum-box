import type { ActivePlayerMap, PlayerId } from "../modes";

export interface Axis {
  x: number;
  y: number;
}

export interface PlayerInput {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export type PlayerInputFrame = ActivePlayerMap<PlayerInput>;

export const NEUTRAL_PLAYER_INPUT: Readonly<PlayerInput> = Object.freeze({
  up: false,
  down: false,
  left: false,
  right: false,
});

export const NEUTRAL_INPUT_FRAME: PlayerInputFrame = Object.freeze({
  A: NEUTRAL_PLAYER_INPUT,
  B: NEUTRAL_PLAYER_INPUT,
  C: NEUTRAL_PLAYER_INPUT,
  D: NEUTRAL_PLAYER_INPUT,
});

export function inputForPlayer(
  frame: PlayerInputFrame,
  playerId: PlayerId,
): Readonly<PlayerInput> {
  return frame[playerId] ?? NEUTRAL_PLAYER_INPUT;
}

export function copyPlayerInput(input: PlayerInput): PlayerInput {
  return {
    up: input.up,
    down: input.down,
    left: input.left,
    right: input.right,
  };
}

export function axisFromInput(input: PlayerInput): Axis {
  return normalizeAxis({
    x: Number(input.right) - Number(input.left),
    y: Number(input.down) - Number(input.up),
  });
}

export function normalizeAxis(axis: Axis): Axis {
  const length = Math.hypot(axis.x, axis.y);
  if (length <= Number.EPSILON) return { x: 0, y: 0 };
  if (length <= 1) return { x: axis.x, y: axis.y };
  return { x: axis.x / length, y: axis.y / length };
}

export function inputFromAxis(axis: Axis, deadZone = 0.01): PlayerInput {
  return {
    up: axis.y < -deadZone,
    down: axis.y > deadZone,
    left: axis.x < -deadZone,
    right: axis.x > deadZone,
  };
}
