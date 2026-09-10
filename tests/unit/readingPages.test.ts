import { describe, expect, it } from "vitest";
import { readingPages } from "../../src/display/ReadingPages";
import {
  terminalGlyphRects,
  terminalTextWidth,
  TERMINAL_GLYPHS,
} from "../../src/display/TerminalTypeface";
import {
  pixelTextRects,
  normalizePixelText,
} from "../../src/display/PixelText";
import { STORY_TERMINAL_PAGES } from "../../src/story/terminal/content";
import { ARCADE_CABINET_DEFINITIONS } from "../../src/games/registry";

describe("shared refined reading face", () => {
  it("renders a separated five-row trademark at reading size", () => {
    const rows = TERMINAL_GLYPHS["™"]!.split("/");
    expect(rows.slice(0, 5).every((row) => row.includes("1"))).toBe(true);
    expect(rows.every((row) => row[3] === "0")).toBe(true);
    expect(terminalTextWidth("™")).toBe(9);
    expect(normalizePixelText("QRNG™")).toBe("QRNG™");
  });

  it("distinguishes D from O with a continuous square left stem at both sizes", () => {
    for (const render of [
      (text: string) => terminalGlyphRects(text),
      (text: string) => pixelTextRects(text, { x: 0, y: 0, pixel: 1 }),
    ]) {
      const d = render("D");
      const o = render("O");
      const height = Math.max(...d.map((r) => r.y + r.height));
      for (let y = 0; y < height; y += 0.5)
        expect(d.some((r) => r.x === 0 && r.y === y)).toBe(true);
      expect(o.some((r) => r.x === 0 && r.y === 0)).toBe(false);
      expect(d).not.toEqual(o);
    }
  });
  it("distinguishes B from 8 at reading and compact sizes", () => {
    for (const render of [
      (text: string) => terminalGlyphRects(text),
      (text: string) => pixelTextRects(text, { x: 0, y: 0, pixel: 1 }),
    ]) {
      const b = render("B"),
        eight = render("8");
      const height = Math.max(...b.map((r) => r.y + r.height));
      for (let y = 0; y < height; y += 0.5)
        expect(b.some((r) => r.x === 0 && r.y === y)).toBe(true);
      expect(eight.some((r) => r.x === 0 && r.y === 0)).toBe(false);
    }
  });
  it("preserves every Story and tutorial word within the reading measure", () => {
    const bodies = Object.values(STORY_TERMINAL_PAGES).map((p) => p.body);
    for (const game of Object.values(ARCADE_CABINET_DEFINITIONS))
      bodies.push([
        game.brief.premise,
        game.brief.object,
        game.brief.condition,
        game.brief.controls,
      ]);
    for (const body of bodies)
      for (const height of [76, 90]) {
        const pages = readingPages(body, 282, height);
        const collapse = (text: string) => text.replace(/\s+/g, " ").trim();
        expect(collapse(pages.flat().join(" "))).toBe(collapse(body.join(" ")));
        for (const page of pages) {
          expect(
            page.reduce(
              (sum, block) => sum + block.split("\n").length * 10,
              0,
            ) +
              (page.length - 1) * 8,
          ).toBeLessThanOrEqual(height);
          for (const line of page.join("\n").split("\n"))
            expect(
              terminalTextWidth(normalizePixelText(line)),
            ).toBeLessThanOrEqual(282);
        }
      }
  });
  it("defines complete rectangular glyphs on the finer binary grid", () => {
    for (const [character, pattern] of Object.entries(TERMINAL_GLYPHS)) {
      const rows = pattern.split("/");
      expect(rows).toHaveLength(7);
      expect(
        rows.every((r) => r.length === rows[0]!.length && /^[01]+$/.test(r)),
      ).toBe(true);
      for (const r of terminalGlyphRects(character)) {
        expect(Number.isInteger(r.x * 2) && Number.isInteger(r.y * 2)).toBe(
          true,
        );
        expect(r.x + r.width).toBeLessThanOrEqual(terminalTextWidth(character));
        expect(r.y + r.height).toBeLessThanOrEqual(7);
      }
    }
  });
});
