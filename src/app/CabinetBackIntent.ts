/** Back opens pause during play and exits from the pause menu. */
export function cabinetBackIntent(
  complete: boolean,
  paused: boolean,
  story: boolean,
): "pause" | "story-session" | "back" {
  if (complete) return "back";
  if (!paused) return "pause";
  return story ? "story-session" : "back";
}
