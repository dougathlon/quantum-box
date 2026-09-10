import { describe, expect, it } from "vitest";
import { readGamepad } from "../../src/input/GamepadMapping";
import { gamepadActions } from "../../src/input/InputController";
import { GamepadInput } from "../../src/games/fluxball/standalone/input/GamepadInput";
function pad(count: number, pressed: number[], axes = [0, 0]): Gamepad {
  return {
    id: `nes-${count}`,
    index: 0,
    connected: true,
    mapping: "",
    axes,
    buttons: Array.from({ length: count }, (_, i) => ({
      pressed: pressed.includes(i),
      value: pressed.includes(i) ? 1 : 0,
    })),
  } as unknown as Gamepad;
}
describe("unmapped USB NES controllers", () => {
  it("uses four-button A/B/Select/Start without triggering mute or retry", () => {
    expect(gamepadActions(pad(4, [0, 3], [-1, 1]), 1)).toEqual(
      new Set(["primary", "start", "p1-left", "p1-down"]),
    );
    expect(gamepadActions(pad(4, [1]), 1)).toEqual(new Set(["back"]));
    expect(gamepadActions(pad(4, [2]), 1)).toEqual(new Set(["back"]));
  });
  it("uses the common ten-button USB layout as a fallback", () => {
    expect(readGamepad(pad(10, [1, 9])).primary).toBe(true);
    expect(readGamepad(pad(10, [1, 9])).start).toBe(true);
    expect(readGamepad(pad(10, [2])).back).toBe(true);
  });
  it("joins once and moves in multiplayer, releasing on disconnect", () => {
    let connected: (Gamepad | null)[] = [pad(4, [3], [-1, 0])];
    const input = new GamepadInput(() => connected);
    expect(input.poll().startRequests).toHaveLength(1);
    expect(input.poll().startRequests).toHaveLength(0);
    expect(input.snapshot("gamepad:0")).not.toBeNull();
    connected = [];
    expect(input.poll().disconnectedControllerIds).toEqual(["gamepad:0"]);
    expect(input.snapshot("gamepad:0")).toBeNull();
  });
});
