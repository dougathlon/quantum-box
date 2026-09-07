export class SeededRng {
  private state: number;

  public constructor(seed: number) {
    this.state = seed >>> 0 || 0x6d2b79f5;
  }

  public nextUint32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  public nextInt(maxExclusive: number): number {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error(
        `PRNG bound must be a positive safe integer: ${maxExclusive}.`,
      );
    }
    const range = 0x1_0000_0000;
    const limit = Math.floor(range / maxExclusive) * maxExclusive;
    let value = this.nextUint32();
    while (value >= limit) value = this.nextUint32();
    return value % maxExclusive;
  }

  public snapshot(): number {
    return this.state;
  }
}
