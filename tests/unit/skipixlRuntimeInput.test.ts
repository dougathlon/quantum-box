import { describe, expect, it } from "vitest";

import { skiPixlInputFromHeld } from "../../src/games/skipixl/SkiPixlRuntime";
import type { SemanticAction } from "../../src/input/InputController";

describe("SkiPixl browser input", () => {
  it("maps Down to boost without changing the steering axis", () => {
    const held = new Set<SemanticAction>(["p1-left", "p1-down"]);

    expect(skiPixlInputFromHeld(held)).toEqual({
      steer: -1,
      throttle: 1,
    });
  });

  it("returns to cruise as soon as every Down control is released", () => {
    const held = new Set<SemanticAction>(["p2-right"]);

    expect(skiPixlInputFromHeld(held)).toEqual({
      steer: 1,
      throttle: 0,
    });
  });

  it("accepts the primary Down control from keyboard or gamepad mappings", () => {
    for (const action of [
      "p1-down",
      "p2-down",
      "p3-down",
      "p4-down",
    ] as const) {
      expect(skiPixlInputFromHeld(new Set<SemanticAction>([action]))).toEqual({
        steer: 0,
        throttle: 1,
      });
    }
  });
});
