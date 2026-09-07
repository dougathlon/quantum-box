import { skiPixlCollisionClearance } from "./SkiPixlChallenge";
import type { SkiPixlPublicObservation } from "./SkiPixlObservation";
import type { SkiPixlInput, SkiPixlSteeringAngle } from "./types";

const NEUTRAL_INPUT: SkiPixlInput = Object.freeze({ steer: 0, throttle: 0 });
const SKIER_RADIUS = 9;
const SAFETY_MARGIN = 3;

/**
 * Deterministic public-state-only policy used to measure whether a generated
 * field is navigable. It sees exactly the same forward window as a player and
 * receives no course payload, seed, or hidden route.
 */
export function skiPixlLookaheadInput(
  observation: SkiPixlPublicObservation,
): SkiPixlInput {
  if (observation.knockdownTicksRemaining > 0) return NEUTRAL_INPUT;
  const targetX = chooseTargetX(observation);
  const delta = targetX - observation.skierX;
  const magnitude = Math.abs(delta);
  const desiredMagnitude =
    magnitude < 4 ? 0 : magnitude < 18 ? 1 : magnitude < 42 ? 2 : 3;
  const desiredAngle = (Math.sign(delta) *
    desiredMagnitude) as SkiPixlSteeringAngle;
  return steerToward(observation.steeringAngle, desiredAngle);
}

function chooseTargetX(observation: SkiPixlPublicObservation): number {
  const minimum = observation.corridorMinX + SKIER_RADIUS;
  const maximum = observation.corridorMaxX - SKIER_RADIUS;
  const bands = groupedDistanceBands(observation);
  if (bands.length === 0 && observation.visibleGates.length === 0)
    return observation.skierX;
  const consideredBands = bands.slice(0, 5);
  const candidates = new Set<number>([observation.skierX, minimum, maximum]);
  for (const gate of observation.visibleGates.slice(0, 2)) {
    candidates.add(gate.centerX);
    candidates.add((gate.centerX + gate.leftX) / 2);
    candidates.add((gate.centerX + gate.rightX) / 2);
  }
  for (const band of consideredBands) {
    for (const candidate of safeGapCandidates(
      band.obstacles,
      minimum,
      maximum,
      observation.skierX,
    )) {
      candidates.add(candidate);
    }
  }

  let bestX = observation.skierX;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    let score = Math.abs(candidate - observation.skierX) * 0.009;
    const candidateDirection = Math.sign(candidate - observation.skierX);
    if (
      candidateDirection !== 0 &&
      observation.lateralVelocity !== 0 &&
      candidateDirection !== Math.sign(observation.lateralVelocity)
    ) {
      score += Math.min(2.5, Math.abs(observation.lateralVelocity) / 40);
    }
    for (const band of consideredBands) {
      let collides = false;
      let worstPenalty = 0;
      let clearance = Number.POSITIVE_INFINITY;
      for (const obstacle of band.obstacles) {
        const pathX = projectedPathX(
          observation.skierX,
          candidate,
          obstacle.relativeDistance,
        );
        const separation =
          Math.abs(pathX - obstacle.x) -
          skiPixlCollisionClearance(obstacle.kind);
        clearance = Math.min(clearance, separation);
        if (separation <= SAFETY_MARGIN) {
          collides = true;
          worstPenalty = Math.max(
            worstPenalty,
            obstacle.kind === "tree" ? 2.6 : 2.1,
          );
        }
      }
      const urgency = 1 + 720 / (band.relativeDistance + 36);
      if (collides) {
        score += urgency * worstPenalty;
      } else {
        score -= Math.min(24, clearance) * urgency * 0.025;
      }
    }
    for (const gate of observation.visibleGates.slice(0, 2)) {
      const safeLeft = gate.leftX + SKIER_RADIUS + 2;
      const safeRight = gate.rightX - SKIER_RADIUS - 2;
      const urgency = 1 + 620 / (gate.relativeDistance + 40);
      const pathX = projectedPathX(
        observation.skierX,
        candidate,
        gate.relativeDistance,
      );
      if (pathX < safeLeft || pathX > safeRight) {
        score += urgency * 4.5;
      } else {
        score -= urgency * 1.2;
      }
    }
    if (
      score < bestScore - 1e-9 ||
      (Math.abs(score - bestScore) <= 1e-9 &&
        Math.abs(candidate - observation.skierX) <
          Math.abs(bestX - observation.skierX)) ||
      (Math.abs(score - bestScore) <= 1e-9 &&
        Math.abs(candidate - observation.skierX) ===
          Math.abs(bestX - observation.skierX) &&
        candidate < bestX)
    ) {
      bestScore = score;
      bestX = candidate;
    }
  }
  return bestX;
}

function projectedPathX(
  currentX: number,
  targetX: number,
  relativeDistance: number,
): number {
  const progress = Math.min(1, Math.max(0, relativeDistance / 190));
  return currentX + (targetX - currentX) * progress;
}

function safeGapCandidates(
  obstacles: SkiPixlPublicObservation["visibleObstacles"],
  minimum: number,
  maximum: number,
  skierX: number,
): readonly number[] {
  const intervals = obstacles
    .map((obstacle) => {
      const clearance =
        skiPixlCollisionClearance(obstacle.kind) + SAFETY_MARGIN;
      return [
        Math.max(minimum, obstacle.x - clearance),
        Math.min(maximum, obstacle.x + clearance),
      ] as const;
    })
    .filter(([start, end]) => start <= end)
    .sort(([left], [right]) => left - right);
  const merged: Array<[number, number]> = [];
  for (const [start, end] of intervals) {
    const prior = merged.at(-1);
    if (!prior || start > prior[1]) merged.push([start, end]);
    else prior[1] = Math.max(prior[1], end);
  }
  const gaps: Array<[number, number]> = [];
  let cursor = minimum;
  for (const [start, end] of merged) {
    if (start > cursor) gaps.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (cursor < maximum) gaps.push([cursor, maximum]);
  const candidates: number[] = [];
  for (const [start, end] of gaps) {
    if (end - start < 2) continue;
    const safeStart = start + 1;
    const safeEnd = end - 1;
    candidates.push(
      (safeStart + safeEnd) / 2,
      Math.max(safeStart, Math.min(safeEnd, skierX)),
    );
  }
  return Object.freeze(candidates);
}

function groupedDistanceBands(observation: SkiPixlPublicObservation): readonly {
  readonly relativeDistance: number;
  readonly obstacles: SkiPixlPublicObservation["visibleObstacles"];
}[] {
  const bands = new Map<
    number,
    {
      readonly relativeDistance: number;
      readonly obstacles: SkiPixlPublicObservation["visibleObstacles"];
    }
  >();
  for (const obstacle of observation.visibleObstacles) {
    const bandId = Math.floor(obstacle.relativeDistance / 56);
    const prior = bands.get(bandId);
    bands.set(bandId, {
      relativeDistance: Math.min(
        prior?.relativeDistance ?? Number.POSITIVE_INFINITY,
        obstacle.relativeDistance,
      ),
      obstacles: Object.freeze([...(prior?.obstacles ?? []), obstacle]),
    });
  }
  return Object.freeze(
    [...bands.values()].sort(
      (left, right) => left.relativeDistance - right.relativeDistance,
    ),
  );
}

function steerToward(
  currentAngle: number,
  desiredAngle: SkiPixlSteeringAngle,
): SkiPixlInput {
  return Object.freeze({
    steer:
      desiredAngle === currentAngle ? 0 : desiredAngle < currentAngle ? -1 : 1,
    throttle: 0,
  });
}
