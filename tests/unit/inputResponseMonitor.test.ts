import { describe, expect, it } from "vitest";

import { InputResponseMonitor } from "../../src/core/InputResponseMonitor";

describe("InputResponseMonitor", () => {
  it("reports median, p95, and worst presentation latency", () => {
    const monitor = new InputResponseMonitor();
    for (const latency of [12, 16, 18, 22, 31, 48, 64, 72, 81, 96]) {
      monitor.sample(100, 100 + latency);
    }

    expect(monitor.report()).toEqual({
      sampleCount: 10,
      windowSamples: 10,
      medianMs: 31,
      p95Ms: 96,
      worstMs: 96,
    });
  });

  it("retains a bounded rolling window without losing the total sample count", () => {
    const monitor = new InputResponseMonitor(3);
    monitor.sample(0, 90);
    monitor.sample(0, 60);
    monitor.sample(0, 30);
    const report = monitor.sample(0, 15);

    expect(report.sampleCount).toBe(4);
    expect(report.windowSamples).toBe(3);
    expect(report.medianMs).toBe(30);
    expect(report.p95Ms).toBe(60);
    expect(report.worstMs).toBe(60);
  });

  it("rejects invalid bounds and timestamps", () => {
    expect(() => new InputResponseMonitor(0)).toThrow("positive integer");
    const monitor = new InputResponseMonitor();
    expect(() => monitor.sample(Number.NaN, 1)).toThrow("finite");
    expect(() => monitor.sample(2, 1)).toThrow("backwards");
  });
});
