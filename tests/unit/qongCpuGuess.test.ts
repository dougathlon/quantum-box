import { describe, expect, it } from "vitest";
import { asUint32Seed } from "../../src/core/determinism";
import {
  QongCpuPolicy,
  createQongCpuBelief,
} from "../../src/games/qong/QongCpuPolicy";
import type {
  QongGoalEvent,
  QongPublicState,
} from "../../src/games/qong/types";

const state: QongPublicState = {
  goalRule: "unresolved",
  rallyNumber: 1,
  ball: { x: 320, y: 180, vx: 1, vy: 0 },
  leftPaddleY: 180,
  rightPaddleY: 180,
  leftScore: 0,
  rightScore: 0,
};
const belief = createQongCpuBelief();
function decide(
  policy: QongCpuPolicy,
  rally: number,
  tick: number,
  events: QongGoalEvent[] = [],
  leftScore = 0,
) {
  return policy.decide(
    {
      tick,
      selfId: "cpu",
      publicState: { ...state, rallyNumber: rally, leftScore },
      publicEvents: events,
    },
    belief,
  ).action.strategy;
}

describe("Qong independent rally guesses", () => {
  it("produces the same guesses for opposite public outcome histories", () => {
    for (let seed = 0; seed < 64; seed++) {
      const direct = new QongCpuPolicy(asUint32Seed(seed));
      const invert = new QongCpuPolicy(asUint32Seed(seed));
      const directEvents: QongGoalEvent[] = [];
      const invertEvents: QongGoalEvent[] = [];
      for (let rally = 1; rally <= 7; rally++) {
        expect(
          decide(direct, rally, rally * 100, directEvents, rally - 1),
        ).toBe(decide(invert, rally, rally * 100, invertEvents, 0));
        directEvents.push({
          kind: "goal",
          rallyNumber: rally,
          goalSide: "right",
          pointWinner: "left",
        });
        invertEvents.push({
          kind: "goal",
          rallyNumber: rally,
          goalSide: "right",
          pointWinner: "right",
        });
      }
    }
  });
  it("holds each unresolved guess and does not consume future guesses on extra frames", () => {
    const sparse = new QongCpuPolicy(asUint32Seed(83));
    const busy = new QongCpuPolicy(asUint32Seed(83));
    for (let rally = 1; rally <= 7; rally++) {
      const guess = decide(sparse, rally, rally * 1000);
      for (let frame = 0; frame < 500; frame++)
        expect(decide(busy, rally, rally * 1000 + frame)).toBe(guess);
    }
  });
  it("makes balanced guesses with chance repeats instead of forced alternation", () => {
    let defend = 0;
    let repeats = 0;
    for (let seed = 0; seed < 1000; seed++) {
      const policy = new QongCpuPolicy(asUint32Seed(seed));
      let previous: string | null = null;
      for (let rally = 1; rally <= 7; rally++) {
        const guess = decide(policy, rally, rally * 100);
        if (guess === "defend") defend++;
        if (guess === previous) repeats++;
        previous = guess;
      }
    }
    expect(defend / 7000).toBeGreaterThan(0.47);
    expect(defend / 7000).toBeLessThan(0.53);
    expect(repeats / 6000).toBeGreaterThan(0.47);
    expect(repeats / 6000).toBeLessThan(0.53);
  });
});
