import { describe, expect, it } from "vitest";

import { gamepadActions } from "../../src/input/InputController";
import { InputController } from "../../src/input/InputController";
import { qongAxisForPlayer } from "../../src/games/qong/QongRuntime";
import {
  DEFAULT_KEYBOARD_BINDINGS,
  validateKeyboardBindings,
} from "../../src/input/KeyboardBindings";

describe("Quantum Box keyboard profiles", () => {
  it("defines four disjoint five-control profiles", () => {
    const validated = validateKeyboardBindings(DEFAULT_KEYBOARD_BINDINGS);
    const codes = Object.values(validated).flatMap((player) =>
      Object.values(player),
    );
    expect(codes).toHaveLength(20);
    expect(new Set(codes).size).toBe(20);
    expect(validated.C).toEqual({
      up: "KeyT",
      down: "KeyG",
      left: "KeyF",
      right: "KeyH",
      action: "KeyR",
    });
    expect(validated.D.action).toBe("KeyO");
  });

  it("rejects reserved and duplicate assignments", () => {
    expect(() =>
      validateKeyboardBindings({
        ...DEFAULT_KEYBOARD_BINDINGS,
        C: { ...DEFAULT_KEYBOARD_BINDINGS.C, action: "KeyX" },
      }),
    ).toThrow("reserved");
    expect(() =>
      validateKeyboardBindings({
        ...DEFAULT_KEYBOARD_BINDINGS,
        D: { ...DEFAULT_KEYBOARD_BINDINGS.D, action: "Space" },
      }),
    ).toThrow("already assigned");
  });
});

describe("Quantum Box gamepad map", () => {
  it("maps standard face buttons to selection, pause, and mute", () => {
    const pressed = new Set([0, 2, 3]);
    const gamepad = {
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, (_, index) => ({
        pressed: pressed.has(index),
      })),
    } as unknown as Gamepad;

    expect(gamepadActions(gamepad, 1)).toEqual(
      new Set(["primary", "pause", "mute"]),
    );
  });

  it("maps the first pad's horizontal axis and primary button to Designer controls", () => {
    const left = {
      axes: [-0.8, 0],
      buttons: Array.from({ length: 16 }, (_, index) => ({
        pressed: index === 0,
      })),
    } as unknown as Gamepad;
    const right = {
      axes: [0.8, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    } as unknown as Gamepad;

    expect(gamepadActions(left, 1)).toEqual(new Set(["p1-left", "primary"]));
    expect(gamepadActions(right, 1)).toEqual(new Set(["p1-right"]));
  });

  it("maps the complete standard control surface without conflating player axes", () => {
    const pressed = new Set([0, 1, 2, 3, 8, 9, 12, 15]);
    const gamepad = {
      axes: [0, 0],
      buttons: Array.from({ length: 16 }, (_, index) => ({
        pressed: pressed.has(index),
      })),
    } as unknown as Gamepad;

    expect(gamepadActions(gamepad, 2)).toEqual(
      new Set([
        "p2-right",
        "p2-up",
        "primary",
        "secondary",
        "start",
        "back",
        "pause",
        "mute",
      ]),
    );
  });
});

describe("Quantum Box gamepad lifecycle", () => {
  it("announces connection, releases held controls, and reconnects once", () => {
    let frame: FrameRequestCallback | null = null;
    const testPad = {
      id: "TEST PAD",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, -1],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false })),
    } as unknown as Gamepad;
    let gamepads: readonly (Gamepad | null)[] = [testPad];
    const target = {
      navigator: { getGamepads: () => gamepads },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      },
      cancelAnimationFrame: () => undefined,
    } as unknown as Window;
    const controller = new InputController(target, {} as Document);
    const devices: string[] = [];
    const inputs: string[] = [];
    controller.subscribeDevices((event) =>
      devices.push(`${event.label}:${event.connected}`),
    );
    controller.subscribe((signal) => {
      if (signal.action === "p1-up")
        inputs.push(`${signal.action}:${signal.pressed}`);
    });

    if (!frame) throw new Error("Gamepad poll frame was not scheduled.");
    (frame as FrameRequestCallback)(0);
    gamepads = [];
    if (!frame) throw new Error("Disconnect poll frame was not scheduled.");
    (frame as FrameRequestCallback)(16);
    gamepads = [testPad];
    if (!frame) throw new Error("Reconnect poll frame was not scheduled.");
    (frame as FrameRequestCallback)(32);
    if (!frame) throw new Error("Stable poll frame was not scheduled.");
    (frame as FrameRequestCallback)(48);

    expect(devices).toEqual([
      "TEST PAD:true",
      "GAMEPAD 1:false",
      "TEST PAD:true",
    ]);
    expect(inputs).toEqual(["p1-up:true", "p1-up:false", "p1-up:true"]);
    controller.dispose();
  });

  it("release-latches a transition action without swallowing its release", () => {
    let frame: FrameRequestCallback | null = null;
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false }));
    const testPad = {
      id: "TEST PAD",
      index: 0,
      connected: true,
      mapping: "standard",
      axes: [0, 0],
      buttons,
    } as unknown as Gamepad;
    const target = {
      navigator: { getGamepads: () => [testPad] },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      requestAnimationFrame: (callback: FrameRequestCallback) => {
        frame = callback;
        return 1;
      },
      cancelAnimationFrame: () => undefined,
    } as unknown as Window;
    const controller = new InputController(target, {} as Document);
    const inputs: string[] = [];
    controller.subscribe((signal) =>
      inputs.push(`${signal.action}:${signal.pressed}`),
    );

    controller.latchUntilRelease("primary");
    buttons[0] = { pressed: true };
    if (!frame) throw new Error("Gamepad poll frame was not scheduled.");
    (frame as FrameRequestCallback)(0);
    buttons[0] = { pressed: false };
    (frame as FrameRequestCallback)(16);
    buttons[0] = { pressed: true };
    (frame as FrameRequestCallback)(32);

    expect(inputs).toEqual(["primary:false", "primary:true"]);
    controller.dispose();
  });
});

describe("Qong input ownership", () => {
  it("keeps Player B directions isolated from Player A in CPU play", () => {
    const held = new Set(["p2-up", "p2-left"] as const);
    expect(qongAxisForPlayer(held, 1)).toBe(0);
    expect(qongAxisForPlayer(held, 2)).toBe(-1);
  });
});
