import { describe, expect, it } from "vitest";

import { FixedStepClock } from "../../src/core/fixedStep";

describe("FixedStepClock", () => {
  it("produces the same simulated steps across render partitions", () => {
    const whole = new FixedStepClock(1 / 60);
    const partitioned = new FixedStepClock(1 / 60);

    const wholeSteps = whole.advance(0.15).steps;
    const partitionedSteps = [0.04, 0.03, 0.05, 0.03].reduce(
      (total, elapsed) => total + partitioned.advance(elapsed).steps,
      0,
    );

    expect(partitionedSteps).toBe(wholeSteps);
  });

  it("bounds a stalled render frame", () => {
    const clock = new FixedStepClock(1 / 60, 0.25);

    expect(clock.advance(10).steps).toBe(15);
  });
});
