import { describe, expect, it, vi } from "vitest";

import {
  drawNativePixelEllipse,
  drawNativePixelFilledEllipse,
  drawNativePixelLine,
  drawNativePixelRect,
  snapNativePixel,
} from "../../src/display/NativePixelRaster";

function graphicsMock() {
  const graphics = {
    fillStyle: vi.fn(),
    fillRect: vi.fn(),
  };
  graphics.fillStyle.mockReturnValue(graphics);
  graphics.fillRect.mockReturnValue(graphics);
  return graphics;
}

describe("native pixel raster", () => {
  it("snaps finite presentation positions once", () => {
    expect(snapNativePixel(14.49)).toBe(14);
    expect(snapNativePixel(14.5)).toBe(15);
    expect(() => snapNativePixel(Number.NaN)).toThrow("finite");
  });

  it("rejects fractional rectangles at the public drawing boundary", () => {
    const graphics = graphicsMock();
    expect(() =>
      drawNativePixelRect(graphics as never, 1.5, 2, 3, 4, 0xd6bd8b),
    ).toThrow("integer");
    expect(graphics.fillRect).not.toHaveBeenCalled();
  });

  it("rasterizes lines as integer pixel rectangles", () => {
    const graphics = graphicsMock();
    drawNativePixelLine(
      graphics as never,
      { x: 1, y: 1 },
      { x: 6, y: 4 },
      { colour: 0xd6bd8b },
    );
    expect(graphics.fillRect).toHaveBeenCalled();
    for (const [x, y, width, height] of graphics.fillRect.mock.calls) {
      expect([x, y, width, height].every(Number.isInteger)).toBe(true);
      expect(width).toBe(1);
      expect(height).toBe(1);
    }
  });

  it("rasterizes ellipses without vector primitives", () => {
    const graphics = graphicsMock();
    drawNativePixelEllipse(graphics as never, { x: 10, y: 10 }, 5, 3, {
      colour: 0xd6bd8b,
    });
    expect(graphics.fillRect.mock.calls.length).toBeGreaterThan(16);
    expect(() =>
      drawNativePixelEllipse(graphics as never, { x: 10.5, y: 10 }, 5, 3, {
        colour: 0xd6bd8b,
      }),
    ).toThrow("integer");
  });

  it("fills ellipses as integer scanlines", () => {
    const graphics = graphicsMock();
    drawNativePixelFilledEllipse(
      graphics as never,
      { x: 10, y: 10 },
      4,
      3,
      0xd6bd8b,
    );
    expect(graphics.fillRect).toHaveBeenCalledTimes(7);
    for (const [x, y, width, height] of graphics.fillRect.mock.calls) {
      expect([x, y, width, height].every(Number.isInteger)).toBe(true);
      expect(height).toBe(1);
    }
  });
});
