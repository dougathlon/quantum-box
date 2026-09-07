import type { PlayerInput } from "./types";

export type Direction = keyof PlayerInput;
export type KeyboardSchemeId = "wasd" | "arrows" | "tfgh" | "ijkl";

export interface KeyBinding {
  schemeId: KeyboardSchemeId;
  direction: Direction;
}

export interface KeyboardScheme {
  readonly id: KeyboardSchemeId;
  readonly controllerId: `keyboard:${KeyboardSchemeId}`;
  readonly label: string;
  readonly joinCode: string;
  readonly joinLabel: string;
}

export const KEYBOARD_SCHEMES = [
  {
    id: "wasd",
    controllerId: "keyboard:wasd",
    label: "WASD",
    joinCode: "Space",
    joinLabel: "SPACE",
  },
  {
    id: "arrows",
    controllerId: "keyboard:arrows",
    label: "ARROWS",
    joinCode: "Enter",
    joinLabel: "ENTER",
  },
  {
    id: "tfgh",
    controllerId: "keyboard:tfgh",
    label: "TFGH",
    joinCode: "KeyR",
    joinLabel: "R",
  },
  {
    id: "ijkl",
    controllerId: "keyboard:ijkl",
    label: "IJKL",
    joinCode: "KeyO",
    joinLabel: "O",
  },
] as const satisfies readonly KeyboardScheme[];

export const KEY_BINDINGS: Readonly<Record<string, KeyBinding>> = Object.freeze(
  {
    KeyW: { schemeId: "wasd", direction: "up" },
    KeyS: { schemeId: "wasd", direction: "down" },
    KeyA: { schemeId: "wasd", direction: "left" },
    KeyD: { schemeId: "wasd", direction: "right" },
    ArrowUp: { schemeId: "arrows", direction: "up" },
    ArrowDown: { schemeId: "arrows", direction: "down" },
    ArrowLeft: { schemeId: "arrows", direction: "left" },
    ArrowRight: { schemeId: "arrows", direction: "right" },
    KeyT: { schemeId: "tfgh", direction: "up" },
    KeyG: { schemeId: "tfgh", direction: "down" },
    KeyF: { schemeId: "tfgh", direction: "left" },
    KeyH: { schemeId: "tfgh", direction: "right" },
    KeyI: { schemeId: "ijkl", direction: "up" },
    KeyK: { schemeId: "ijkl", direction: "down" },
    KeyJ: { schemeId: "ijkl", direction: "left" },
    KeyL: { schemeId: "ijkl", direction: "right" },
  },
);

const SCHEME_BY_JOIN_CODE = new Map<string, (typeof KEYBOARD_SCHEMES)[number]>(
  KEYBOARD_SCHEMES.map((scheme) => [scheme.joinCode, scheme]),
);

export function keyboardSchemeForJoinCode(code: string): KeyboardScheme | null {
  return SCHEME_BY_JOIN_CODE.get(code) ?? null;
}

export function bindingForCode(code: string): KeyBinding | null {
  return KEY_BINDINGS[code] ?? null;
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!target || typeof target !== "object") return false;
  const candidate = target as {
    isContentEditable?: boolean;
    tagName?: string;
  };
  if (candidate.isContentEditable) return true;
  const tag = candidate.tagName?.toUpperCase();
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
}
