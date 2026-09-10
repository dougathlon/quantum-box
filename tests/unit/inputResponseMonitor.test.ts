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
      invalidSampleCount: 0,
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

  it("keeps invalid timestamps out of measurements without throwing", () => {
    expect(() => new InputResponseMonitor(0)).toThrow("positive integer");
    const monitor = new InputResponseMonitor();
    for (const [capture, present] of [
      [NaN, 1],
      [2, 1],
      [-1, 1],
      [0, Infinity],
      [0, NaN],
    ]) {
      expect(() => monitor.sample(capture!, present!)).not.toThrow();
    }
    expect(monitor.report()).toMatchObject({
      sampleCount: 0,
      invalidSampleCount: 5,
      windowSamples: 0,
      medianMs: null,
      p95Ms: null,
      worstMs: null,
    });
    monitor.sample(10, 20);
    monitor.sample(30, 29);
    expect(monitor.report()).toMatchObject({
      sampleCount: 1,
      invalidSampleCount: 6,
      medianMs: 10,
    });
  });
});
