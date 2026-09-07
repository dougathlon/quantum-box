import { QUAG_ARENA, shortestWrappedDeltaX } from "./QuagArena";
import {
  QUAG_SUBPIXELS,
  type QuagArena,
  type QuagInput,
  type QuagPlayerId,
  type QuagPlayerSnapshot,
} from "./types";

export interface QuagCpuObservation {
  readonly playerId: QuagPlayerId;
  readonly tick: number;
  readonly graphPhase: number;
  readonly players: readonly QuagPlayerSnapshot[];
  readonly outgoingTargets: readonly QuagPlayerId[];
  readonly policySeed: number;
  readonly arena?: QuagArena;
}

interface Destination {
  readonly x: number;
  readonly y: number;
}

const CPU_CADENCE = Object.freeze({ A: 4, B: 4, C: 5, D: 6 } as const);

export function chooseQuagCpuInput(observation: QuagCpuObservation): QuagInput {
  const self = observation.players.find(
    (player) => player.id === observation.playerId,
  );
  if (!self || self.knockedOutTicks > 0) return NEUTRAL_INPUT;
  const target = selectTarget(observation, self);
  const destination = target
    ? pursuitDestination(observation.playerId, target)
    : patrolDestination(observation);
  const selfX = self.xSubpixels / QUAG_SUBPIXELS;
  const selfY = self.ySubpixels / QUAG_SUBPIXELS;
  const arena = observation.arena ?? QUAG_ARENA;
  const deltaX = shortestWrappedDeltaX(selfX, destination.x, arena);
  const horizontal = Math.abs(deltaX) < 5 ? 0 : deltaX < 0 ? -1 : 1;
  const cadence = CPU_CADENCE[observation.playerId];
  const flapWindow =
    (observation.tick +
      observation.policySeed +
      playerOrdinal(observation.playerId)) %
      cadence ===
    0;
  const wantsAltitude = selfY > destination.y + 5;
  const fallingNearFloor =
    selfY > arena.floorTop - 46 && self.velocityYSubpixels > 0;
  const flapPressed =
    self.flapCooldownTicks === 0 &&
    flapWindow &&
    (wantsAltitude || fallingNearFloor);
  return Object.freeze({ horizontal, flapPressed });
}

function selectTarget(
  observation: QuagCpuObservation,
  self: QuagPlayerSnapshot,
): QuagPlayerSnapshot | undefined {
  const selfX = self.xSubpixels / QUAG_SUBPIXELS;
  const selfY = self.ySubpixels / QUAG_SUBPIXELS;
  return observation.players
    .filter(
      (player) =>
        observation.outgoingTargets.includes(player.id) &&
        player.knockedOutTicks === 0 &&
        player.graceTicks === 0,
    )
    .sort((left, right) => {
      const leftScore = targetDistance(
        selfX,
        selfY,
        left,
        observation.arena ?? QUAG_ARENA,
      );
      const rightScore = targetDistance(
        selfX,
        selfY,
        right,
        observation.arena ?? QUAG_ARENA,
      );
      return leftScore - rightScore || left.id.localeCompare(right.id);
    })[0];
}

function targetDistance(
  selfX: number,
  selfY: number,
  target: QuagPlayerSnapshot,
  arena: QuagArena,
): number {
  const targetX = target.xSubpixels / QUAG_SUBPIXELS;
  const targetY = target.ySubpixels / QUAG_SUBPIXELS;
  return (
    Math.abs(shortestWrappedDeltaX(selfX, targetX, arena)) +
    Math.abs(selfY - targetY)
  );
}

function pursuitDestination(
  playerId: QuagPlayerId,
  target: QuagPlayerSnapshot,
): Destination {
  const targetX = target.xSubpixels / QUAG_SUBPIXELS;
  const targetY = target.ySubpixels / QUAG_SUBPIXELS;
  if (playerId === "C") {
    return Object.freeze({
      x: targetX + (target.velocityXSubpixels * 4) / QUAG_SUBPIXELS,
      y: targetY + (target.velocityYSubpixels * 4) / QUAG_SUBPIXELS - 18,
    });
  }
  if (playerId === "D") {
    return Object.freeze({
      x: targetX + (target.velocityXSubpixels * 6) / QUAG_SUBPIXELS,
      y: targetY - 28,
    });
  }
  return Object.freeze({ x: targetX, y: targetY - 14 });
}

function patrolDestination(observation: QuagCpuObservation): Destination {
  const perches = (observation.arena ?? QUAG_ARENA).spawnPerches;
  const index =
    (observation.policySeed +
      observation.graphPhase * 17 +
      playerOrdinal(observation.playerId) * 31) %
    perches.length;
  const perch = perches[index]!;
  return Object.freeze({ x: perch.x, y: perch.platformTop - 28 });
}

function playerOrdinal(playerId: QuagPlayerId): number {
  return playerId === "A" ? 0 : playerId === "B" ? 1 : playerId === "C" ? 2 : 3;
}

const NEUTRAL_INPUT: QuagInput = Object.freeze({
  horizontal: 0,
  flapPressed: false,
});
