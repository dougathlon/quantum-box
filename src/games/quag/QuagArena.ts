import type {
  QuagArena,
  QuagArenaId,
  QuagPlatform,
  QuagSpawnPerch,
} from "./types";

export const QUAG_BODY_HALF_WIDTH = 14;
export const QUAG_BODY_HALF_HEIGHT = 16;
export const QUAG_CAPTURE_HEIGHT_ADVANTAGE = 8;

const BOUNDS = Object.freeze({
  left: 18,
  right: 622,
  ceiling: 48,
  floorTop: 324,
});

export const QUAG_ARENAS = Object.freeze([
  arena(
    "quarry-aerial-arena-v1",
    [
      platform("lower-left", 30, 266, 154),
      platform("lower-centre", 243, 278, 154),
      platform("lower-right", 456, 266, 154),
      platform("middle-left", 92, 198, 164),
      platform("middle-right", 384, 198, 164),
      platform("upper-centre", 236, 126, 168),
    ],
    [
      perch("spawn-a", 92, 266, 1),
      perch("spawn-b", 548, 266, -1),
      perch("spawn-c", 174, 198, 1),
      perch("spawn-d", 466, 198, -1),
      perch("spawn-upper", 320, 126, 1),
      perch("spawn-floor-left", 52, 324, 1),
      perch("spawn-floor-right", 588, 324, -1),
    ],
  ),
  arena(
    "quarry-aerial-arena-v2",
    [
      platform("lower-left", 42, 278, 178),
      platform("lower-right", 420, 278, 178),
      platform("middle-centre", 226, 218, 188),
      platform("upper-left", 66, 146, 164),
      platform("upper-right", 410, 146, 164),
      platform("high-centre", 274, 92, 92),
    ],
    [
      perch("spawn-a", 112, 278, 1),
      perch("spawn-b", 528, 278, -1),
      perch("spawn-c", 126, 146, 1),
      perch("spawn-d", 514, 146, -1),
      perch("spawn-middle", 320, 218, 1),
      perch("spawn-high", 320, 92, -1),
      perch("spawn-floor", 320, 324, 1),
    ],
  ),
  arena(
    "quarry-aerial-arena-v3",
    [
      platform("lower-wide", 170, 282, 300),
      platform("left-step", 42, 230, 128),
      platform("right-step", 470, 230, 128),
      platform("middle-left", 150, 174, 138),
      platform("middle-right", 352, 174, 138),
      platform("upper-left", 48, 112, 148),
      platform("upper-right", 444, 112, 148),
    ],
    [
      perch("spawn-a", 104, 230, 1),
      perch("spawn-b", 536, 230, -1),
      perch("spawn-c", 219, 174, 1),
      perch("spawn-d", 421, 174, -1),
      perch("spawn-upper-left", 120, 112, 1),
      perch("spawn-upper-right", 520, 112, -1),
      perch("spawn-lower", 320, 282, 1),
    ],
  ),
]);

export const QUAG_ARENA = QUAG_ARENAS[0]!;

export function quagArenaById(id: QuagArenaId): QuagArena {
  const result = QUAG_ARENAS.find((candidate) => candidate.id === id);
  if (!result) throw new Error(`Unknown Quarry arena: ${id}`);
  return result;
}

export function wrapQuagX(
  x: number,
  selectedArena: QuagArena = QUAG_ARENA,
): Readonly<{ x: number; wrapped: boolean }> {
  const span = quagHorizontalSpan(selectedArena);
  if (x < selectedArena.left - QUAG_BODY_HALF_WIDTH)
    return Object.freeze({ x: x + span, wrapped: true });
  if (x > selectedArena.right + QUAG_BODY_HALF_WIDTH)
    return Object.freeze({ x: x - span, wrapped: true });
  return Object.freeze({ x, wrapped: false });
}

export function quagHorizontalSpan(
  selectedArena: QuagArena = QUAG_ARENA,
): number {
  return selectedArena.right - selectedArena.left + QUAG_BODY_HALF_WIDTH * 2;
}

export function shortestWrappedDeltaX(
  from: number,
  to: number,
  selectedArena: QuagArena = QUAG_ARENA,
): number {
  const span = quagHorizontalSpan(selectedArena);
  const direct = to - from;
  if (direct > span / 2) return direct - span;
  if (direct < -span / 2) return direct + span;
  return direct;
}

export function quagLandingTop(
  previousCenterY: number,
  nextCenterY: number,
  centerX: number,
  selectedArena: QuagArena = QUAG_ARENA,
): number | null {
  const previousBottom = previousCenterY + QUAG_BODY_HALF_HEIGHT;
  const nextBottom = nextCenterY + QUAG_BODY_HALF_HEIGHT;
  if (nextBottom < previousBottom) return null;
  const floor = Object.freeze({
    id: "floor",
    left: selectedArena.left,
    top: selectedArena.floorTop,
    width: selectedArena.right - selectedArena.left,
    thickness: 4,
  });
  const candidates = [...selectedArena.platforms, floor].filter(
    (candidate) =>
      previousBottom <= candidate.top &&
      nextBottom >= candidate.top &&
      centerX + QUAG_BODY_HALF_WIDTH >= candidate.left &&
      centerX - QUAG_BODY_HALF_WIDTH <= candidate.left + candidate.width,
  );
  if (candidates.length === 0) return null;
  return Math.min(...candidates.map((candidate) => candidate.top));
}

export function quagBodiesOverlap(
  leftX: number,
  leftY: number,
  rightX: number,
  rightY: number,
  selectedArena: QuagArena = QUAG_ARENA,
): boolean {
  return (
    Math.abs(shortestWrappedDeltaX(leftX, rightX, selectedArena)) <
      QUAG_BODY_HALF_WIDTH * 2 &&
    Math.abs(leftY - rightY) < QUAG_BODY_HALF_HEIGHT * 2
  );
}

function arena(
  id: QuagArenaId,
  platforms: readonly QuagPlatform[],
  spawnPerches: readonly QuagSpawnPerch[],
): QuagArena {
  return Object.freeze({
    id,
    ...BOUNDS,
    platforms: Object.freeze([...platforms]),
    spawnPerches: Object.freeze([...spawnPerches]),
  });
}

function platform(
  id: string,
  left: number,
  top: number,
  width: number,
): QuagPlatform {
  return Object.freeze({ id, left, top, width, thickness: 4 });
}

function perch(
  id: string,
  x: number,
  platformTop: number,
  facing: -1 | 1,
): QuagSpawnPerch {
  return Object.freeze({ id, x, platformTop, facing });
}
