import { describe, expect, it, vi } from "vitest";

import {
  drawTitleLettering,
  TITLE_LETTERING_CONTRACT,
  titleLetteringRects,
} from "../../src/display/TitleLettering";

describe("original title lettering", () => {
  it("uses an original five-by-seven raster at the photographed source size", () => {
    expect(TITLE_LETTERING_CONTRACT.viewBox).toEqual({
      width: 1672,
      height: 941,
    });
    expect(TITLE_LETTERING_CONTRACT.raster).toBe("five-by-seven-original-v1");
    expect(titleLetteringRects("QUANTUM BOX", 252, 10).length).toBeGreaterThan(
      100,
    );
  });

  it("draws only hard-edged integer rectangles", () => {
    const fillRect = vi.fn();
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect,
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;

    drawTitleLettering(context, 0.4, 1.2, 0.75);

    expect(fillRect).toHaveBeenCalled();
    for (const [x, y, width, height] of fillRect.mock.calls) {
      expect(Number.isInteger(x)).toBe(true);
      expect(Number.isInteger(y)).toBe(true);
      expect(Number.isInteger(width)).toBe(true);
      expect(Number.isInteger(height)).toBe(true);
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
    }
  });

  it("rejects a non-positive presentation scale", () => {
    expect(() =>
      drawTitleLettering({} as CanvasRenderingContext2D, 0, 0, 0),
    ).toThrow("positive and finite");
  });
});
