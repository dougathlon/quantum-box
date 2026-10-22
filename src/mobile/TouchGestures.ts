export type TouchMovement = "vertical" | "horizontal" | "stick" | "swipe";
export type TouchDirection = "up" | "down" | "left" | "right";

export const TOUCH_DEAD_ZONE = 9;
export const TOUCH_STICK_RADIUS = 36;
export const TOUCH_SWIPE_DISTANCE = 14;

export function movementForCabinet(cabinet: string | undefined): TouchMovement {
  if (cabinet === "qong") return "vertical";
  if (cabinet === "skipixl" || cabinet === "quag") return "horizontal";
  if (cabinet === "quantman") return "swipe";
  return "stick";
}

export function stickDirections(
  x: number,
  y: number,
  mode: Exclude<TouchMovement, "swipe">,
): TouchDirection[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [];
  if (mode === "horizontal")
    return Math.abs(x) < TOUCH_DEAD_ZONE ? [] : [x < 0 ? "left" : "right"];
  if (mode === "vertical")
    return Math.abs(y) < TOUCH_DEAD_ZONE ? [] : [y < 0 ? "up" : "down"];
  const distance = Math.hypot(x, y);
  if (distance < TOUCH_DEAD_ZONE) return [];
  const directions: TouchDirection[] = [];
  if (Math.abs(x) / distance >= 0.45) directions.push(x < 0 ? "left" : "right");
  if (Math.abs(y) / distance >= 0.45) directions.push(y < 0 ? "up" : "down");
  return directions;
}

export function swipeDirection(x: number, y: number): TouchDirection | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (Math.max(Math.abs(x), Math.abs(y)) < TOUCH_SWIPE_DISTANCE) return null;
  if (Math.abs(Math.abs(x) - Math.abs(y)) < 3) return null;
  return Math.abs(x) > Math.abs(y)
    ? x < 0
      ? "left"
      : "right"
    : y < 0
      ? "up"
      : "down";
}
