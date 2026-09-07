import type {
  SkiPixlGate,
  SkiPixlObstacle,
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "./types";

export interface SkiPixlVisibleObstacle extends SkiPixlObstacle {
  readonly relativeDistance: number;
}

export interface SkiPixlVisibleGate extends SkiPixlGate {
  readonly relativeDistance: number;
}

export interface SkiPixlPublicObservation {
  readonly courseId: string;
  readonly distance: number;
  readonly courseLength: number;
  readonly secondsRemaining: number;
  readonly corridorMinX: number;
  readonly corridorMaxX: number;
  readonly skierX: number;
  readonly lateralVelocity: number;
  readonly steeringAngle: number;
  readonly speed: number;
  readonly knockdownTicksRemaining: number;
  readonly visibleObstacles: readonly SkiPixlVisibleObstacle[];
  readonly visibleGates: readonly SkiPixlVisibleGate[];
}

export function observeSkiPixl(
  payload: SkiPixlPackPayload,
  snapshot: SkiPixlSnapshot,
  lookaheadDistance = 520,
): SkiPixlPublicObservation {
  const visibleObstacles = payload.obstacles
    .slice(snapshot.obstaclesResolved)
    .filter(
      (obstacle) =>
        obstacle.distance >= snapshot.distance &&
        obstacle.distance - snapshot.distance <= lookaheadDistance,
    )
    .map((obstacle) =>
      Object.freeze({
        ...obstacle,
        relativeDistance: obstacle.distance - snapshot.distance,
      }),
    );
  const visibleGates = (payload.gates ?? [])
    .slice(snapshot.gatesResolved)
    .filter(
      (gate) =>
        gate.distance >= snapshot.distance &&
        gate.distance - snapshot.distance <= lookaheadDistance,
    )
    .map((gate) =>
      Object.freeze({
        ...gate,
        relativeDistance: gate.distance - snapshot.distance,
      }),
    );
  return Object.freeze({
    courseId: payload.courseId,
    distance: snapshot.distance,
    courseLength: snapshot.courseLength,
    secondsRemaining: snapshot.secondsRemaining,
    corridorMinX: payload.corridorMinX,
    corridorMaxX: payload.corridorMaxX,
    skierX: snapshot.skierX,
    lateralVelocity: snapshot.lateralVelocity,
    steeringAngle: snapshot.steeringAngle,
    speed: snapshot.speed,
    knockdownTicksRemaining: snapshot.knockdownTicksRemaining,
    visibleObstacles: Object.freeze(visibleObstacles),
    visibleGates: Object.freeze(visibleGates),
  });
}
