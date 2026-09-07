export const RNG_ALGORITHM = "mulberry32-v1" as const;

function assertUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff_ffff) {
    throw new RangeError(
      `${label} must be an unsigned 32-bit integer; received ${value}.`,
    );
  }
}

export function mixSeed(seed: number, salt: number): number {
  assertUint32(seed, "Seed");
  assertUint32(salt, "Salt");
  let mixed = (seed ^ salt) >>> 0;
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x7feb352d);
  mixed = Math.imul(mixed ^ (mixed >>> 15), 0x846ca68b);
  return (mixed ^ (mixed >>> 16)) >>> 0;
}

export class DeterministicRng {
  #state: number;
  #drawCount = 0;

  public constructor(seed: number) {
    assertUint32(seed, "Seed");
    this.#state = seed >>> 0;
  }

  public get drawCount(): number {
    return this.#drawCount;
  }

  public next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let value = this.#state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    this.#drawCount += 1;
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  }
}
