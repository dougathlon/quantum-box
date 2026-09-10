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

export const SKIPIXL_PLAYER_Y = 58;
export const SKIPIXL_WORLD_SCALE = 0.525;

export interface SkiPixlVisibleObstacle {
  readonly obstacle: SkiPixlObstacle;
  readonly screenY: number;
}

export interface SkiPixlVisibleGate {
  readonly gate: SkiPixlGate;
  readonly screenY: number;
}

export interface SkiPixlDisplayView {
  readonly direction: "down-screen";
  readonly playerY: number;
  readonly distance: number;
  readonly finishY: number;
  readonly visibleObstacles: readonly SkiPixlVisibleObstacle[];
  readonly visibleGates: readonly SkiPixlVisibleGate[];
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
    .filter(({ screenY }) => screenY >= 27 && screenY <= 172);
  const visibleGates = (payload.gates ?? [])
    .filter((gate) => gate.distance >= snapshot.distance - 30)
    .map((gate) => Object.freeze({ gate, screenY: worldToY(gate.distance) }))
    .filter(({ screenY }) => screenY >= 27 && screenY <= 172);
  return Object.freeze({
    direction: "down-screen",
    playerY: SKIPIXL_PLAYER_Y,
    distance: snapshot.distance,
    finishY: worldToY(payload.courseLength),
    visibleObstacles: Object.freeze(visibleObstacles),
    visibleGates: Object.freeze(visibleGates),
    paused,
  });
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
