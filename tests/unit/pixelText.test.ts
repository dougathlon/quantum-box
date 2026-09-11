import { describe, expect, it } from "vitest";

import {
  drawCanvasPixelText,
  drawPixelText,
  normalizePixelText,
  pixelTextRects,
  pixelTextWidth,
} from "../../src/display/PixelText";

describe("Brown Box rectangle pixel text", () => {
  it("measures variable-width text on the logical integer grid", () => {
    expect(pixelTextWidth("0:00.00", 4)).toBe(92);
    expect(pixelTextWidth("4270 M", 2)).toBe(46);
    expect(pixelTextWidth("", 4)).toBe(0);
  });

  it("draws only integer cream rectangles without a font rasterizer", () => {
    const rectangles: number[][] = [];
    const graphics = {
      fillStyle: () => graphics,
      fillRect: (x: number, y: number, width: number, height: number) => {
        rectangles.push([x, y, width, height]);
        return graphics;
      },
    };

    const bounds = drawPixelText(graphics as never, "READY 2", {
      x: 160,
      y: 40,
      pixel: 2,
      colour: 0xd6bd8b,
      align: "center",
    });

    expect(rectangles.length).toBeGreaterThan(20);
    expect(rectangles.flat().every(Number.isInteger)).toBe(true);
    expect(
      rectangles.every(([, , width, height]) => width === 1 && height === 1),
    ).toBe(true);
    expect(bounds.left + bounds.width / 2).toBe(160);
    expect(bounds.height).toBe(10);
  });

  it("normalizes the punctuation used by semantic menus and evidence pages", () => {
    expect(normalizePixelText("left ← 20×20 — 'Q' …")).toBe(
      "LEFT < 20X20 - 'Q' ...",
    );
    expect(
      pixelTextRects("A+B=2", { x: 0, y: 0, pixel: 1 }).length,
    ).toBeGreaterThan(42);
  });

  it("draws dedicated locked and unlocked status glyphs", () => {
    expect(pixelTextWidth("🔒", 1)).toBe(5);
    expect(pixelTextWidth("🔓", 1)).toBe(5);
    expect(pixelTextRects("🔒", { x: 0, y: 0, pixel: 1 })).not.toEqual(
      pixelTextRects("🔓", { x: 0, y: 0, pixel: 1 }),
    );
  });

  it("draws the terminal trademark mark without a fallback glyph", () => {
    expect(pixelTextWidth("™", 1)).toBe(7);
    expect(pixelTextRects("™", { x: 0, y: 0, pixel: 1 })).not.toEqual(
      pixelTextRects("?", { x: 0, y: 0, pixel: 1 }),
    );
  });

  it("shares the same integer rectangle raster with the DOM bitmap plane", () => {
    const rectangles: number[][] = [];
    const context = {
      fillStyle: "",
      fillRect: (x: number, y: number, width: number, height: number) => {
        rectangles.push([x, y, width, height]);
      },
    };
    const bounds = drawCanvasPixelText(context as never, "MENU", {
      x: 80,
      y: 12,
      pixel: 2,
      colour: "#D6BD8B",
      align: "center",
    });
    expect(context.fillStyle).toBe("#D6BD8B");
    expect(rectangles.length).toBeGreaterThan(20);
    expect(rectangles.flat().every(Number.isInteger)).toBe(true);
    expect(bounds.left + bounds.width / 2).toBe(80);
  });

  it("rejects fractional foreground placement", () => {
    expect(() => pixelTextRects("GRID", { x: 1.5, y: 0, pixel: 1 })).toThrow(
      "native integer",
    );
  });
});

it("keeps Fluxball score glyph widths and heights uniform without changing the default face", () => {
  const graphics = { fillStyle: () => {}, fillRect: () => {} };
  const options = { x: 0, y: 0, pixel: 1, colour: 0, glyphWidth: 3 };
  const wins = drawPixelText(graphics as never, "WINS", options);
  const goal = drawPixelText(graphics as never, "GOAL", options);
  expect(wins).toEqual(goal);
  expect(wins.height).toBe(5);
  expect(wins.width).toBe(15);
  expect(pixelTextWidth("WINS", 1)).toBeGreaterThan(wins.width);
  expect(
    pixelTextRects("W", { ...options }).every(
      (r) => r.x + r.width <= 3 && r.y + r.height <= 5,
    ),
  ).toBe(true);
});

it("renders a distinct Backspace key glyph in both lettering sizes", async () => {
  const { TERMINAL_GLYPHS, terminalGlyphRects, terminalTextWidth } =
    await import("../../src/display/TerminalTypeface");
  expect(TERMINAL_GLYPHS["⌫"]).toBeDefined();
  expect(terminalTextWidth("⌫")).toBe(9);
  expect(terminalGlyphRects("⌫")).not.toEqual(terminalGlyphRects("?"));
  expect(pixelTextWidth("⌫", 1)).toBe(9);
  expect(pixelTextRects("⌫", { x: 0, y: 0, pixel: 1 })).not.toEqual(
    pixelTextRects("?", { x: 0, y: 0, pixel: 1 }),
  );
});
