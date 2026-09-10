import { describe, expect, it, vi } from "vitest";

import {
  drawTitleLettering,
  TITLE_LETTERING_CONTRACT,
  titleLetteringRects,
} from "../../src/display/TitleLettering";

describe("original title lettering", () => {
  it("uses an original five-by-seven raster on the shared field grid", () => {
    expect(TITLE_LETTERING_CONTRACT.logicalScreen).toEqual({
      width: 320,
      height: 180,
    });
    expect(TITLE_LETTERING_CONTRACT.raster).toBe("refined-five-by-seven-v1");
    expect(TITLE_LETTERING_CONTRACT.title.pixel).toBe(3);
    expect(TITLE_LETTERING_CONTRACT.prompt.pixel).toBe(2);
    const title = TITLE_LETTERING_CONTRACT.title;
    const prompt = TITLE_LETTERING_CONTRACT.prompt;
    expect(
      titleLetteringRects(title.text, title.y, title.pixel, title.tracking)
        .length,
    ).toBeGreaterThan(100);
    expect(
      titleLetteringRects(prompt.text, prompt.y, prompt.pixel, prompt.tracking)
        .length,
    ).toBeGreaterThan(50);
  });

  it("draws every hard-edged rectangle on the same integer grid as the field", () => {
    const fillRect = vi.fn();
    const context = {
      save: vi.fn(),
      restore: vi.fn(),
      fillRect,
      fillStyle: "",
    } as unknown as CanvasRenderingContext2D;

    for (const pixelScale of [1, 2, 3, 4, 5, 6]) {
      fillRect.mockClear();
      drawTitleLettering(context, -11, 7, pixelScale);

      expect(fillRect).toHaveBeenCalled();
      for (const [x, y, width, height] of fillRect.mock.calls) {
        expect(Number.isInteger(x)).toBe(true);
        expect(Number.isInteger(y)).toBe(true);
        expect(Number.isInteger(width)).toBe(true);
        expect(Number.isInteger(height)).toBe(true);
        expect(width).toBeGreaterThan(0);
        expect(height).toBeGreaterThan(0);
      }
    }
  });

  it("keeps both title lines inside the native 320 by 180 field", () => {
    const title = TITLE_LETTERING_CONTRACT.title;
    const prompt = TITLE_LETTERING_CONTRACT.prompt;
    const rects = [
      ...titleLetteringRects(title.text, title.y, title.pixel, title.tracking),
      ...titleLetteringRects(
        prompt.text,
        prompt.y,
        prompt.pixel,
        prompt.tracking,
      ),
    ];

    for (const rect of rects) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(320);
      expect(rect.y + rect.height).toBeLessThanOrEqual(180);
    }
  });

  it("rejects a fractional presentation scale", () => {
    expect(() =>
      drawTitleLettering({} as CanvasRenderingContext2D, 0, 0, 1.5),
    ).toThrow("positive integer");
  });
});
