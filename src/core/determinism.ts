const UINT32_RANGE = 0x1_0000_0000;

export type Uint32Seed = number & { readonly __uint32Seed: unique symbol };

export function asUint32Seed(value: number): Uint32Seed {
  if (!Number.isInteger(value) || value < 0 || value >= UINT32_RANGE) {
    throw new RangeError("A run seed must be an unsigned 32-bit integer.");
  }
  return value as Uint32Seed;
}

export function fnv1a32(value: string): Uint32Seed {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return asUint32Seed(hash >>> 0);
}

export function deriveSeed(seed: Uint32Seed, namespace: string): Uint32Seed {
  if (!namespace)
    throw new Error("A deterministic seed namespace is required.");
  return fnv1a32(`${seed.toString(16).padStart(8, "0")}:${namespace}`);
}

export class Mulberry32 {
  private state: number;

  public constructor(seed: Uint32Seed) {
    this.state = seed;
  }

  public next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  }

  public nextInt(maximumExclusive: number): number {
    if (!Number.isSafeInteger(maximumExclusive) || maximumExclusive < 1) {
      throw new RangeError("maximumExclusive must be a positive safe integer.");
    }
    return Math.floor(this.next() * maximumExclusive);
  }
}
