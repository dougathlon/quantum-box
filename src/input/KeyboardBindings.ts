import type { PlayerId } from "../games/fluxball/standalone/modes";

export const KEYBOARD_PLAYERS = ["A", "B", "C", "D"] as const;
export const KEYBOARD_CONTROLS = [
  "up",
  "down",
  "left",
  "right",
  "action",
] as const;

export type KeyboardControl = (typeof KEYBOARD_CONTROLS)[number];
export type PlayerKeyboardBindings = Readonly<Record<KeyboardControl, string>>;
export type KeyboardBindings = Readonly<
  Record<PlayerId, PlayerKeyboardBindings>
>;

export const RESERVED_KEY_CODES = Object.freeze([
  "Escape",
  "KeyP",
  "KeyM",
  "KeyX",
]);

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = deepFreeze({
  A: { up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD", action: "Space" },
  B: {
    up: "ArrowUp",
    down: "ArrowDown",
    left: "ArrowLeft",
    right: "ArrowRight",
    action: "Enter",
  },
  C: { up: "KeyT", down: "KeyG", left: "KeyF", right: "KeyH", action: "KeyR" },
  D: { up: "KeyI", down: "KeyK", left: "KeyJ", right: "KeyL", action: "KeyO" },
});

export function validateKeyboardBindings(value: unknown): KeyboardBindings {
  if (!isRecord(value)) throw new Error("Keyboard bindings are incomplete.");
  const seen = new Set<string>();
  const result = {} as Record<PlayerId, PlayerKeyboardBindings>;
  for (const playerId of KEYBOARD_PLAYERS) {
    const player = value[playerId];
    if (!isRecord(player)) {
      throw new Error(`Player ${playerId} keyboard bindings are incomplete.`);
    }
    const controls = {} as Record<KeyboardControl, string>;
    for (const control of KEYBOARD_CONTROLS) {
      const code = player[control];
      if (typeof code !== "string" || code.length === 0) {
        throw new Error(`Player ${playerId} ${control} binding is invalid.`);
      }
      if (RESERVED_KEY_CODES.includes(code)) {
        throw new Error(
          `${displayKeyCode(code)} is reserved for system control.`,
        );
      }
      if (seen.has(code)) {
        throw new Error(`${displayKeyCode(code)} is already assigned.`);
      }
      seen.add(code);
      controls[control] = code;
    }
    result[playerId] = Object.freeze(controls);
  }
  return deepFreeze(result);
}

export function displayKeyCode(code: string): string {
  if (code === "Space") return "SPACE";
  if (code === "Enter") return "ENTER";
  if (code.startsWith("Key")) return code.slice(3).toUpperCase();
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Arrow")) return code.slice(5).toUpperCase();
  return code.replace(/([a-z])([A-Z])/g, "$1 $2").toUpperCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}
