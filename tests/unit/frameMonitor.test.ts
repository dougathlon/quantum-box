import { describe, expect, it } from "vitest";

import { FrameMonitor } from "../../src/core/FrameMonitor";

describe("FrameMonitor", () => {
  it("reports presentation delivery without owning simulation time", () => {
    const monitor = new FrameMonitor(100, 20);
    expect(monitor.sample(0)).toBeNull();
    for (const timestamp of [16, 32, 48, 64, 80]) {
      expect(monitor.sample(timestamp)).toBeNull();
    }
    const report = monitor.sample(100);

    expect(report?.framesPerSecond).toBe(60);
    expect(report?.meanFrameMs).toBeCloseTo(100 / 6);
    expect(report?.worstFrameMs).toBe(20);
    expect(report?.frameBudgetMisses).toBe(0);
  });

  it("counts delayed presentation frames and rejects time reversal", () => {
    const monitor = new FrameMonitor(50, 20);
    monitor.sample(10);
    monitor.sample(26);
    monitor.sample(58);
    expect(monitor.sample(74)?.frameBudgetMisses).toBe(1);
    expect(() => monitor.sample(73)).toThrow("backwards");
  });
});
