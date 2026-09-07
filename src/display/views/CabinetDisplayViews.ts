import type { PlayerId } from "../../games/fluxball/standalone/modes";
import type { FluxballSnapshot } from "../../games/fluxball/types";
import type { QongSnapshot } from "../../games/qong/types";
import type { QuantmanSnapshot } from "../../games/quantman/types";
import type {
  SkiPixlGate,
  SkiPixlObstacle,
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "../../games/skipixl/types";

export interface QongDisplayView {
  readonly phase: QongSnapshot["phase"];
  readonly ball: QongSnapshot["ball"];
  readonly leftPaddleY: number;
  readonly rightPaddleY: number;
  readonly observationsRemaining: number;
  readonly measurementState: QongSnapshot["measurementState"];
  readonly goalRule: QongSnapshot["goalRule"];
  readonly paused: boolean;
}

export function qongDisplayView(
  snapshot: QongSnapshot,
  paused: boolean,
): QongDisplayView {
  return Object.freeze({
    phase: snapshot.phase,
    ball: Object.freeze({ ...snapshot.ball }),
    leftPaddleY: snapshot.leftPaddleY,
    rightPaddleY: snapshot.rightPaddleY,
    observationsRemaining: snapshot.observationsRemaining,
    measurementState: snapshot.measurementState,
    goalRule: snapshot.goalRule,
    paused,
  });
}

export const SKIPIXL_PLAYER_Y = 116;
export const SKIPIXL_WORLD_SCALE = 1.05;

export interface SkiPixlVisibleObstacle {
  readonly obstacle: SkiPixlObstacle;
  readonly screenY: number;
}

export interface SkiPixlVisibleGate {
  readonly gate: SkiPixlGate;
  readonly screenY: number;
}

export interface SkiPixlGroundCue {
  readonly x: number;
  readonly screenY: number;
  readonly length: number;
}

export interface SkiPixlDisplayView {
  readonly direction: "down-screen";
  readonly playerY: number;
  readonly distance: number;
  readonly finishY: number;
  readonly visibleObstacles: readonly SkiPixlVisibleObstacle[];
  readonly visibleGates: readonly SkiPixlVisibleGate[];
  readonly groundCues: readonly SkiPixlGroundCue[];
  readonly paused: boolean;
}

export function skiPixlDisplayView(
  snapshot: SkiPixlSnapshot,
  payload: SkiPixlPackPayload,
  paused: boolean,
): SkiPixlDisplayView {
  const worldToY = (distance: number): number =>
    SKIPIXL_PLAYER_Y + (distance - snapshot.distance) * SKIPIXL_WORLD_SCALE;
  const visibleObstacles = payload.obstacles
    .filter((obstacle) => obstacle.distance >= snapshot.distance - 40)
    .map((obstacle) =>
      Object.freeze({ obstacle, screenY: worldToY(obstacle.distance) }),
    )
    .filter(({ screenY }) => screenY >= 54 && screenY <= 344);
  const visibleGates = (payload.gates ?? [])
    .filter((gate) => gate.distance >= snapshot.distance - 30)
    .map((gate) => Object.freeze({ gate, screenY: worldToY(gate.distance) }))
    .filter(({ screenY }) => screenY >= 54 && screenY <= 344);
  const groundCues = payload.obstacles
    .flatMap((obstacle) => {
      const firstDistance =
        obstacle.distance - 31 + ((obstacle.cellIndex * 13) % 63);
      const secondDistance =
        obstacle.distance - 27 + ((obstacle.cellIndex * 29) % 57);
      const firstX = clamp(
        obstacle.x - 58 + ((obstacle.cellIndex * 31) % 117),
        payload.corridorMinX,
        payload.corridorMaxX,
      );
      const secondX = clamp(
        obstacle.x - 44 + ((obstacle.cellIndex * 47) % 89),
        payload.corridorMinX,
        payload.corridorMaxX,
      );
      return [
        Object.freeze({
          x: firstX,
          screenY: worldToY(firstDistance),
          length: 3 + (obstacle.cellIndex % 4),
        }),
        Object.freeze({
          x: secondX,
          screenY: worldToY(secondDistance),
          length: 2 + (obstacle.cellIndex % 3),
        }),
      ];
    })
    .filter(({ screenY }) => screenY >= 54 && screenY <= 344);

  return Object.freeze({
    direction: "down-screen",
    playerY: SKIPIXL_PLAYER_Y,
    distance: snapshot.distance,
    finishY: worldToY(payload.courseLength),
    visibleObstacles: Object.freeze(visibleObstacles),
    visibleGates: Object.freeze(visibleGates),
    groundCues: Object.freeze(groundCues),
    paused,
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export interface FluxballDisplayView {
  readonly sport: FluxballSnapshot["sport"];
  readonly orderedPlayerIds: readonly PlayerId[];
  readonly paused: boolean;
}

export function fluxballDisplayView(
  snapshot: FluxballSnapshot,
  paused: boolean,
): FluxballDisplayView {
  const sport = snapshot.sport;
  const orderedPlayerIds = sport
    ? [...sport.activePlayerIds].sort((left, right) => {
        const leftPlayer = sport.players[left];
        const rightPlayer = sport.players[right];
        return (leftPlayer?.y ?? 0) - (rightPlayer?.y ?? 0);
      })
    : [];
  return Object.freeze({
    sport,
    orderedPlayerIds: Object.freeze(orderedPlayerIds),
    paused,
  });
}

export interface QuantmanDisplayView {
  readonly snapshot: QuantmanSnapshot;
  readonly collectedFragmentIds: readonly string[];
  readonly paused: boolean;
}

export function quantmanDisplayView(
  snapshot: QuantmanSnapshot,
  paused: boolean,
): QuantmanDisplayView {
  return Object.freeze({
    snapshot,
    collectedFragmentIds: Object.freeze([...snapshot.collectedFragmentIds]),
    paused,
  });
}
