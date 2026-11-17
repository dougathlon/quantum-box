import {
  QUAG_ARENA,
  QUAG_BODY_HALF_WIDTH,
  QUAG_BODY_HALF_HEIGHT,
  shortestWrappedDeltaX,
} from "./QuagArena";
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

export const QUARRY_CPU_TUNING = Object.freeze({
  decisionTicks: 4,
  patrolTicks: 80,
  threatDistance: 120,
  cPredictionTicks: 2,
  dPredictionTicks: 3,
});

/** Per-bird tactical memory; observations contain only current visible relations. */
export class QuagCpuPolicy {
  private lastDecisionTick = -Infinity;
  private destination: Destination | null = null;
  private goalKey = "";
  private route: {
    x: number;
    platformTop: number;
    startedTick: number;
  } | null = null;

  public decide(
    observation: QuagCpuObservation & {
      readonly incomingHunters: readonly QuagPlayerId[];
    },
  ): QuagInput {
    const self = observation.players.find((p) => p.id === observation.playerId);
    if (!self || self.knockedOutTicks > 0) {
      this.destination = null;
      this.route = null;
      return NEUTRAL_INPUT;
    }
    const arena = observation.arena ?? QUAG_ARENA;
    const x = self.xSubpixels / QUAG_SUBPIXELS;
    const y = self.ySubpixels / QUAG_SUBPIXELS;
    if (
      !this.destination ||
      observation.tick - this.lastDecisionTick >=
        QUARRY_CPU_TUNING.decisionTicks
    ) {
      const hunters = observation.players.filter(
        (p) =>
          observation.incomingHunters.includes(p.id) &&
          p.knockedOutTicks === 0 &&
          p.graceTicks === 0,
      );
      const threat = hunters
        .filter(
          (p) =>
            targetDistance(x, y, p, arena) < QUARRY_CPU_TUNING.threatDistance,
        )
        .sort(
          (a, b) =>
            targetDistance(x, y, a, arena) - targetDistance(x, y, b, arena),
        )[0];
      const prey = selectTarget(observation, self);
      let key: string;
      if (threat) {
        const hx = threat.xSubpixels / QUAG_SUBPIXELS;
        const hy = threat.ySubpixels / QUAG_SUBPIXELS;
        // Prefer nearby shelter that increases separation; penalize crossing the hunter.
        const escape = [...arena.spawnPerches].sort((a, b) => {
          const value = (p: typeof a) => {
            const travel = shortestWrappedDeltaX(x, p.x, arena);
            const hunterDirection = shortestWrappedDeltaX(x, hx, arena);
            const crosses =
              Math.sign(travel) === Math.sign(hunterDirection) &&
              Math.abs(travel) > Math.abs(hunterDirection);
            return (
              Math.abs(shortestWrappedDeltaX(hx, p.x, arena)) +
              Math.abs(hy - (p.platformTop - 28)) * 0.6 -
              Math.abs(travel) * 0.35 -
              (crosses ? 160 : 0)
            );
          };
          return value(b) - value(a);
        })[0]!;
        this.destination = { x: escape.x, y: escape.platformTop - 28 };
        key = `escape-${threat.id}`;
      } else if (prey) {
        const prediction =
          observation.playerId === "C"
            ? QUARRY_CPU_TUNING.cPredictionTicks
            : observation.playerId === "D"
              ? QUARRY_CPU_TUNING.dPredictionTicks
              : 0;
        this.destination = {
          x:
            (prey.xSubpixels + prey.velocityXSubpixels * prediction) /
            QUAG_SUBPIXELS,
          y:
            (prey.ySubpixels +
              (observation.playerId === "C"
                ? prey.velocityYSubpixels * prediction
                : 0)) /
              QUAG_SUBPIXELS -
            (observation.playerId === "D"
              ? 28
              : observation.playerId === "C"
                ? 18
                : 14),
        };
        key = `prey-${prey.id}`;
      } else {
        const phase = Math.floor(
          observation.tick / QUARRY_CPU_TUNING.patrolTicks,
        );
        const perch =
          arena.spawnPerches[
            (observation.policySeed +
              observation.graphPhase * 17 +
              playerOrdinal(observation.playerId) * 31 +
              phase) %
              arena.spawnPerches.length
          ]!;
        this.destination = { x: perch.x, y: perch.platformTop - 28 };
        key = `perch-${perch.id}`;
      }
      if (key !== this.goalKey) this.route = null;
      this.goalKey = key;
      this.lastDecisionTick = observation.tick;
    }
    // Stay outside the edge until the body is below the platform, not merely airborne.
    if (
      this.route &&
      (y > this.route.platformTop + 4 ||
        observation.tick - this.route.startedTick > 80)
    )
      this.route = null;
    if (!this.route && self.grounded && this.destination.y > y + 12) {
      const platform = arena.platforms.find(
        (p) =>
          Math.abs(y + QUAG_BODY_HALF_HEIGHT - p.top) < 2 &&
          x + QUAG_BODY_HALF_WIDTH > p.left &&
          x - QUAG_BODY_HALF_WIDTH < p.left + p.width,
      );
      if (platform) {
        const edges = [
          platform.left - QUAG_BODY_HALF_WIDTH - 6,
          platform.left + platform.width + QUAG_BODY_HALF_WIDTH + 6,
        ];
        edges.sort(
          (a, b) =>
            Math.abs(a - x) +
            0.35 *
              Math.abs(shortestWrappedDeltaX(a, this.destination!.x, arena)) -
            Math.abs(b - x) -
            0.35 *
              Math.abs(shortestWrappedDeltaX(b, this.destination!.x, arena)),
        );
        this.route = {
          x: edges[0]!,
          platformTop: platform.top,
          startedTick: observation.tick,
        };
      }
    }
    const destination = this.route
      ? { x: this.route.x, y: this.route.platformTop + 32 }
      : this.destination;
    const delta = shortestWrappedDeltaX(x, destination.x, arena);
    const horizontal = Math.abs(delta) < 5 ? 0 : delta < 0 ? -1 : 1;
    const flapWindow =
      (observation.tick +
        observation.policySeed +
        playerOrdinal(observation.playerId)) %
        CPU_CADENCE[observation.playerId] ===
      0;
    return {
      horizontal,
      flapPressed:
        self.flapCooldownTicks === 0 &&
        flapWindow &&
        (y > destination.y + 5 ||
          (y > arena.floorTop - 46 && self.velocityYSubpixels > 0)),
    };
  }
}
