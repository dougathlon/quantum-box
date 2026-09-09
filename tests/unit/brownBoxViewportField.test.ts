import { describe, expect, it } from "vitest";

import {
  resolveBrownBoxDisplayPixelScale,
  resolveBrownBoxViewportFieldLayout,
  resolveBrownBoxViewportReplacementBoundary,
} from "../../src/display/BrownBoxViewportField";

describe("Brown Box continuous viewport field", () => {
  it("matches the internal display scale at every supported viewport", () => {
    expect(resolveBrownBoxDisplayPixelScale(320, 180)).toBe(1);
    expect(resolveBrownBoxDisplayPixelScale(713, 736)).toBe(2);
    expect(resolveBrownBoxDisplayPixelScale(1024, 720)).toBe(3);
    expect(resolveBrownBoxDisplayPixelScale(1280, 720)).toBe(4);
    expect(resolveBrownBoxDisplayPixelScale(1920, 1080)).toBe(6);
    expect(resolveBrownBoxDisplayPixelScale(2560, 1440)).toBe(6);
  });

  it("keeps the square browser panel and centred foreground on one pixel scale", () => {
    expect(resolveBrownBoxViewportFieldLayout(713, 736, 640)).toEqual({
      width: 713,
      height: 736,
      pixelScale: 2,
      tileWidth: 640,
      tileHeight: 360,
      originX: 36,
      originY: 188,
    });
  });

  it("uses the same exact field scale when the foreground fills 16 by 9", () => {
    expect(resolveBrownBoxViewportFieldLayout(1280, 720, 1280)).toEqual({
      width: 1280,
      height: 720,
      pixelScale: 4,
      tileWidth: 1280,
      tileHeight: 720,
      originX: 0,
      originY: 0,
    });
    expect(resolveBrownBoxViewportFieldLayout(1920, 1080, 1920)).toEqual({
      width: 1920,
      height: 1080,
      pixelScale: 6,
      tileWidth: 1920,
      tileHeight: 1080,
      originX: 0,
      originY: 0,
    });
  });

  it("moves the hard replacement boundary across the complete viewport", () => {
    expect(resolveBrownBoxViewportReplacementBoundary(713, 0)).toBe(0);
    expect(resolveBrownBoxViewportReplacementBoundary(713, 160)).toBe(357);
    expect(resolveBrownBoxViewportReplacementBoundary(713, 320)).toBe(713);
  });

  it("fails closed on invalid viewport geometry", () => {
    expect(() => resolveBrownBoxViewportFieldLayout(0, 720, 640)).toThrow(
      /viewport width/,
    );
    expect(() => resolveBrownBoxViewportReplacementBoundary(713, 0.5)).toThrow(
      /source boundary/,
    );
  });
});
