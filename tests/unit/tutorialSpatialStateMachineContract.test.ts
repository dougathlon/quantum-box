import { describe, expect, it } from "vitest";

import { createQongWorkshop } from "../../src/tutorials/qongWorkshop";

describe("spatial tutorial snapshot/action contract", () => {
  it("moves Player Candidate C one cardinal tile and reports blocked collisions", () => {
    const world = createQongWorkshop();
    expect(world.snapshot().player).toMatchObject({
      role: "player-candidate-c",
      tile: { row: 7, col: 5 },
      facing: "up",
      lastMoveBlocked: false,
    });

    world.dispatch({ type: "move", direction: "down" });
    expect(world.snapshot().player).toMatchObject({
      tile: { row: 7, col: 5 },
      facing: "down",
      lastMoveBlocked: true,
    });

    world.dispatch({ type: "move", direction: "left" });
    expect(world.snapshot().player).toMatchObject({
      tile: { row: 7, col: 4 },
      facing: "left",
      lastMoveBlocked: false,
    });
    expect(() => JSON.stringify(world.snapshot())).not.toThrow();
  });
});
