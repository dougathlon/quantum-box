import { describe, expect, it } from "vitest";

import { auditBrownBoxPixelBuffer } from "../../src/debug/BrownBoxCanvasAudit";

const WIDTH = 320;
const HEIGHT = 180;

describe("Brown Box native canvas palette audit", () => {
  it("accepts an exact logical frame using only the three approved opaque colours", () => {
    const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
    const colours = [
      [43, 28, 20, 255],
      [86, 67, 48, 255],
      [214, 189, 139, 255],
    ] as const;
    for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
      pixels.set(colours[pixel % colours.length]!, pixel * 4);
    }

    const report = auditBrownBoxPixelBuffer(WIDTH, HEIGHT, pixels);

    expect(report).toMatchObject({
      width: WIDTH,
      height: HEIGHT,
      logicalResolutionMatches: true,
      pixelCount: WIDTH * HEIGHT,
      passed: true,
    });
    expect(report.colours).toHaveLength(3);
    expect(report.unexpectedColours).toEqual([]);
  });

  it("accepts transparent pixels where the viewport field shows through", () => {
    const report = auditBrownBoxPixelBuffer(
      WIDTH,
      HEIGHT,
      solidFrame([0, 0, 0, 0]),
    );

    expect(report.passed).toBe(true);
    expect(report.unexpectedColours).toEqual([]);
  });

  it("fails closed on an intermediate colour or partially transparent pixel", () => {
    const pixels = solidFrame([43, 28, 20, 255]);
    pixels.set([128, 96, 72, 255], 0);
    pixels.set([214, 189, 139, 128], 4);

    const report = auditBrownBoxPixelBuffer(WIDTH, HEIGHT, pixels);

    expect(report.passed).toBe(false);
    expect(report.unexpectedColours).toEqual([
      { rgba: [128, 96, 72, 255], count: 1 },
      { rgba: [214, 189, 139, 128], count: 1 },
    ]);
  });

  it("fails closed when the renderer is not natively 320 by 180", () => {
    const report = auditBrownBoxPixelBuffer(
      640,
      360,
      new Uint8ClampedArray(640 * 360 * 4).fill(255),
    );

    expect(report.logicalResolutionMatches).toBe(false);
    expect(report.passed).toBe(false);
  });

  it("rejects a malformed RGBA buffer", () => {
    expect(() =>
      auditBrownBoxPixelBuffer(WIDTH, HEIGHT, new Uint8ClampedArray(4)),
    ).toThrow(/does not match 320×180 RGBA/);
  });
});

function solidFrame(
  rgba: readonly [number, number, number, number],
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
  for (let pixel = 0; pixel < WIDTH * HEIGHT; pixel += 1) {
    pixels.set(rgba, pixel * 4);
  }
  return pixels;
}
