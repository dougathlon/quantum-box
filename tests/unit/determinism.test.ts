import { describe, expect, it } from "vitest";

import {
  asUint32Seed,
  deriveSeed,
  fnv1a32,
  Mulberry32,
} from "../../src/core/determinism";

describe("deterministic primitives", () => {
  it("keeps a stable golden stream", () => {
    const random = new Mulberry32(asUint32Seed(0x12345678));

    expect(Array.from({ length: 5 }, () => random.next())).toEqual([
      0.10615200875326991, 0.941276284167543, 0.9398706152569503,
      0.2338848018553108, 0.9045877147000283,
    ]);
  });

  it("derives stable, namespaced seeds", () => {
    const root = fnv1a32("fixture-hash:browser-seed");

    expect(deriveSeed(root, "rules")).toBe(deriveSeed(root, "rules"));
    expect(deriveSeed(root, "rules")).not.toBe(deriveSeed(root, "physics"));
  });

  it("rejects values outside the unsigned 32-bit domain", () => {
    expect(() => asUint32Seed(-1)).toThrow(RangeError);
    expect(() => asUint32Seed(0x1_0000_0000)).toThrow(RangeError);
    expect(() => asUint32Seed(1.5)).toThrow(RangeError);
  });
});
