export interface FrameReport {
  readonly framesPerSecond: number;
  readonly meanFrameMs: number;
  readonly worstFrameMs: number;
  readonly frameBudgetMisses: number;
  readonly observedMs: number;
}

/** Presentation-only timing observer. It receives renderer timestamps and has
 * no reference to a cabinet session, clock, seed, input, or pack. */
export class FrameMonitor {
  private windowStart: number | null = null;
  private previousTimestamp: number | null = null;
  private readonly intervals: number[] = [];

  public constructor(
    private readonly reportWindowMs = 1_000,
    private readonly frameBudgetMs = 20,
  ) {
    if (reportWindowMs <= 0 || frameBudgetMs <= 0) {
      throw new Error("Frame monitor bounds must be positive.");
    }
  }

  public sample(timestampMs: number): FrameReport | null {
    if (!Number.isFinite(timestampMs)) {
      throw new Error("Frame timestamp must be finite.");
    }
    if (this.windowStart === null || this.previousTimestamp === null) {
      this.windowStart = timestampMs;
      this.previousTimestamp = timestampMs;
      return null;
    }
    const interval = timestampMs - this.previousTimestamp;
    if (interval < 0)
      throw new Error("Frame timestamps cannot move backwards.");
    this.previousTimestamp = timestampMs;
    this.intervals.push(interval);
    const observedMs = timestampMs - this.windowStart;
    if (observedMs < this.reportWindowMs) return null;

    const total = this.intervals.reduce((sum, value) => sum + value, 0);
    const report = Object.freeze({
      framesPerSecond: (this.intervals.length * 1_000) / observedMs,
      meanFrameMs: total / this.intervals.length,
      worstFrameMs: Math.max(...this.intervals),
      frameBudgetMisses: this.intervals.filter(
        (value) => value > this.frameBudgetMs,
      ).length,
      observedMs,
    });
    this.windowStart = timestampMs;
    this.intervals.length = 0;
    return report;
  }
}
