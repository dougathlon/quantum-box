export interface InputResponseReport {
  readonly sampleCount: number;
  readonly windowSamples: number;
  readonly invalidSampleCount: number;
  readonly medianMs: number | null;
  readonly p95Ms: number | null;
  readonly worstMs: number | null;
}

/** Presentation-only input-response observer. It receives timestamps only and
 * has no reference to simulation time, rules, seeds, packs, or game state. */
export class InputResponseMonitor {
  private readonly latenciesMs: number[] = [];
  private sampleCount = 0;
  private invalidSampleCount = 0;

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
    const latencyMs = presentedAtMs - capturedAtMs;
    if (
      !Number.isFinite(capturedAtMs) ||
      !Number.isFinite(presentedAtMs) ||
      !Number.isFinite(latencyMs) ||
      capturedAtMs < 0 ||
      presentedAtMs < 0 ||
      latencyMs < 0
    ) {
      this.invalidSampleCount += 1;
      return this.report();
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
        invalidSampleCount: this.invalidSampleCount,
        windowSamples: 0,
        medianMs: null,
        p95Ms: null,
        worstMs: null,
      });
    }
    const ordered = [...this.latenciesMs].sort((a, b) => a - b);
    return Object.freeze({
      sampleCount: this.sampleCount,
      invalidSampleCount: this.invalidSampleCount,
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
