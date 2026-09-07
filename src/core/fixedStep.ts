export interface FixedStepAdvance {
  readonly steps: number;
  readonly alpha: number;
  readonly elapsedSeconds: number;
}

export class FixedStepClock {
  private accumulatorSeconds = 0;

  public constructor(
    public readonly stepSeconds: number,
    private readonly maximumFrameSeconds = 0.25,
  ) {
    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new RangeError("stepSeconds must be positive.");
    }
    if (!Number.isFinite(maximumFrameSeconds) || maximumFrameSeconds <= 0) {
      throw new RangeError("maximumFrameSeconds must be positive.");
    }
  }

  public advance(rawElapsedSeconds: number): FixedStepAdvance {
    const elapsedSeconds = Math.min(
      this.maximumFrameSeconds,
      Math.max(0, Number.isFinite(rawElapsedSeconds) ? rawElapsedSeconds : 0),
    );
    this.accumulatorSeconds += elapsedSeconds;
    const steps = Math.floor(this.accumulatorSeconds / this.stepSeconds);
    this.accumulatorSeconds -= steps * this.stepSeconds;
    return Object.freeze({
      steps,
      alpha: this.accumulatorSeconds / this.stepSeconds,
      elapsedSeconds,
    });
  }

  public reset(): void {
    this.accumulatorSeconds = 0;
  }
}
