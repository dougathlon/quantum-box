import { describe, expect, it } from "vitest";

import { freezeObservation } from "../../src/agents/contracts";

describe("agent observation boundary", () => {
  it("copies and deeply freezes public observations", () => {
    const source = {
      tick: 12,
      selfId: "cpu-1",
      publicState: { ball: { x: 10, y: 20 } },
      publicEvents: [{ kind: "bounce", side: "left" }],
    };
    const observation = freezeObservation(source);

    source.publicState.ball.x = 99;
    expect(observation.publicState.ball.x).toBe(10);
    expect(Object.isFrozen(observation.publicState.ball)).toBe(true);
    expect(Object.isFrozen(observation.publicEvents[0])).toBe(true);
    expect("hiddenRules" in observation).toBe(false);
  });
});
