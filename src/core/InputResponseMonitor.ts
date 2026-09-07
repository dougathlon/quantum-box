export interface InputResponseReport {
  readonly sampleCount: number;
  readonly windowSamples: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly worstMs: number;
}

/** Presentation-only input-response observer. It receives timestamps only and
 * has no reference to simulation time, rules, seeds, packs, or game state. */
export class InputResponseMonitor {
  private readonly latenciesMs: number[] = [];
  private sampleCount = 0;

  public constructor(private readonly maxSamples = 240) {
    if (!Number.isInteger(maxSamples) || maxSamples <= 0) {
      throw new Error(
        "Input response sample bound must be a positive integer.",
      );
    }
  }

  public sample(
    capturedAtMs: number,
    presentedAtMs: number,
  ): InputResponseReport {
    if (!Number.isFinite(capturedAtMs) || !Number.isFinite(presentedAtMs)) {
      throw new Error("Input response timestamps must be finite.");
    }
    const latencyMs = presentedAtMs - capturedAtMs;
    if (latencyMs < 0) {
      throw new Error("Input response timestamps cannot move backwards.");
    }
    this.sampleCount += 1;
    this.latenciesMs.push(latencyMs);
    if (this.latenciesMs.length > this.maxSamples) this.latenciesMs.shift();
    return this.report();
  }

  public report(): InputResponseReport {
    if (this.latenciesMs.length === 0) {
      return Object.freeze({
        sampleCount: this.sampleCount,
        windowSamples: 0,
        medianMs: 0,
        p95Ms: 0,
        worstMs: 0,
      });
    }
    const ordered = [...this.latenciesMs].sort((a, b) => a - b);
    return Object.freeze({
      sampleCount: this.sampleCount,
      windowSamples: ordered.length,
      medianMs: percentile(ordered, 0.5),
      p95Ms: percentile(ordered, 0.95),
      worstMs: ordered.at(-1) ?? 0,
    });
  }
}

function percentile(ordered: readonly number[], fraction: number): number {
  const index = Math.max(0, Math.ceil(ordered.length * fraction) - 1);
  return ordered[index] ?? 0;
}
