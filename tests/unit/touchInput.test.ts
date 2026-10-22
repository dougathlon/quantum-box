import { permitsArcadeMode } from "../../src/mobile/MobileMode";
import {
  movementForCabinet,
  stickDirections,
  swipeDirection,
} from "../../src/mobile/TouchGestures";
import { describe, expect, it } from "vitest";
import {
  InputController,
  type InputSignal,
} from "../../src/input/InputController";

describe("touch semantic input", () => {
  function setup() {
    const target = {
      addEventListener() {},
      removeEventListener() {},
      requestAnimationFrame: () => 1,
      cancelAnimationFrame() {},
    } as unknown as Window;
    const input = new InputController(target, {} as Document);
    const signals: InputSignal[] = [];
    input.subscribe((signal) => signals.push(signal));
    return { input, signals };
  }
  it("supports simultaneous direction and action without repeated press edges", () => {
    const { input, signals } = setup();
    input.setTouchAction("p1-left", true);
    input.setTouchAction("p1-action", true);
    input.setTouchAction("p1-left", true);
    input.setTouchAction("p1-left", false);
    expect(signals.map((s) => [s.action, s.pressed])).toEqual([
      ["p1-left", true],
      ["p1-action", true],
      ["p1-left", false],
    ]);
    expect(
      signals.every(
        (s) => s.source === "touch" && Number.isFinite(s.capturedAtMs),
      ),
    ).toBe(true);
    input.dispose();
    expect(signals.at(-1)).toMatchObject({
      action: "p1-action",
      pressed: false,
    });
  });
  it("respects transition latching until the finger releases", () => {
    const { input, signals } = setup();
    input.latchUntilRelease("p1-action");
    input.setTouchAction("p1-action", true);
    expect(signals).toHaveLength(0);
    input.setTouchAction("p1-action", false);
    input.setTouchAction("p1-action", true);
    expect(signals.map((s) => s.pressed)).toEqual([false, true]);
    input.dispose();
  });
});

describe("game-specific touch gestures", () => {
  it("uses swipe turns for Quantman and axis-restricted steering where appropriate", () => {
    expect(movementForCabinet("quantman")).toBe("swipe");
    expect(movementForCabinet("qong")).toBe("vertical");
    expect(movementForCabinet("skipixl")).toBe("horizontal");
    expect(movementForCabinet("quag")).toBe("horizontal");
    expect(movementForCabinet("fluxball")).toBe("stick");
  });
  it("ignores slight movement and noise on a game's unused axis", () => {
    expect(stickDirections(8, 8, "stick")).toEqual(["right", "down"]);
    expect(stickDirections(5, 5, "stick")).toEqual([]);
    expect(stickDirections(8, 200, "horizontal")).toEqual([]);
    expect(stickDirections(200, -8, "vertical")).toEqual([]);
    expect(stickDirections(-14, 100, "horizontal")).toEqual(["left"]);
    expect(stickDirections(-100, 14, "vertical")).toEqual(["down"]);
  });
  it("supports diagonals without interpreting near-axis drift as a second direction", () => {
    expect(stickDirections(24, -24, "stick")).toEqual(["right", "up"]);
    expect(stickDirections(-24, 6, "stick")).toEqual(["left"]);
    expect(stickDirections(6, 24, "stick")).toEqual(["down"]);
  });
  it("requires a purposeful cardinal swipe, not a tap or ambiguous diagonal", () => {
    expect(swipeDirection(0, 0)).toBeNull();
    expect(swipeDirection(13, 0)).toBeNull();
    expect(swipeDirection(22, 22)).toBeNull();
    expect(swipeDirection(14, 3)).toBe("right");
    expect(swipeDirection(-20, 3)).toBe("left");
    expect(swipeDirection(3, -20)).toBe("up");
    expect(swipeDirection(3, 20)).toBe("down");
  });
  it("rejects invalid coordinates without emitting gameplay input", () => {
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(stickDirections(bad, 10, "stick")).toEqual([]);
      expect(stickDirections(10, bad, "horizontal")).toEqual([]);
      expect(swipeDirection(bad, 10)).toBeNull();
      expect(swipeDirection(10, bad)).toBeNull();
    }
  });
});

describe("mobile human-player policy", () => {
  it("excludes a second human while retaining all CPU match formats", () => {
    for (const mode of ["LOCAL TWO PLAYER", "2 PLAYER"]) {
      expect(permitsArcadeMode(mode, true)).toBe(false);
      expect(permitsArcadeMode(mode, false)).toBe(true);
    }
    for (const mode of [
      "HUMAN / CPU",
      "1 PLAYER",
      "2-WAY SHARED",
      "2-WAY SPLIT",
      "4-WAY SHARED",
      "4-WAY SPLIT",
      "HOLD",
      "INVERT",
    ])
      expect(permitsArcadeMode(mode, true)).toBe(true);
  });
});
