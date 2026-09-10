/** Standard pads plus the common USB NES four-button and ten-button layouts. */
export interface GamepadButtonMapping {
  primary: number;
  back: number;
  start: number;
  select: number;
}
const mappingCache = new Map<string, GamepadButtonMapping | null>();
export function controllerMappingKey(id: string): string {
  return `qbox-controller-v1:${id}`;
}
function savedMapping(id: string): GamepadButtonMapping | null {
  if (mappingCache.has(id)) return mappingCache.get(id)!;
  let value = null;
  try {
    const candidate = JSON.parse(
      localStorage.getItem(controllerMappingKey(id)) ?? "null",
    );
    if (
      candidate &&
      ["primary", "back", "start", "select"].every(
        (key) =>
          Number.isInteger(candidate[key]) &&
          candidate[key] >= 0 &&
          candidate[key] < 32,
      ) &&
      new Set([
        candidate.primary,
        candidate.back,
        candidate.start,
        candidate.select,
      ]).size === 4
    )
      value = candidate;
  } catch {
    /* Storage may be unavailable; the built-in mapping still works. */
  }
  mappingCache.set(id, value);
  return value;
}
export function readGamepad(gamepad: Gamepad) {
  const button = (index: number) =>
    Boolean(
      gamepad.buttons[index]?.pressed ||
        (gamepad.buttons[index]?.value ?? 0) > 0.5,
    );
  const standard =
    gamepad.mapping === "standard" || gamepad.buttons.length >= 12;
  const small = gamepad.buttons.length <= 4;
  const x = gamepad.axes[0] ?? 0;
  const y = gamepad.axes[1] ?? 0;
  const saved = savedMapping(gamepad.id);
  return {
    left: x < -0.3 || (standard && button(14)),
    right: x > 0.3 || (standard && button(15)),
    up: y < -0.3 || (standard && button(12)),
    down: y > 0.3 || (standard && button(13)),
    primary: button(saved?.primary ?? (standard || small ? 0 : 1)),
    back:
      button(saved?.back ?? (standard || small ? 1 : 2)) ||
      button(
        saved?.select ??
          (small ? 2 : standard ? 8 : gamepad.buttons.length - 2),
      ),
    start: button(
      saved?.start ?? (small ? 3 : standard ? 9 : gamepad.buttons.length - 1),
    ),
    secondary: !saved && standard && button(2),
    mute: !saved && standard && button(3),
  };
}
