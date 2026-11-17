import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  auditBitmapCanvasPixels,
  BITMAP_DOM_TEXT_CONTRACT,
  bitmapFocusCursorPlacement,
  bitmapFlowTextHeight,
  scaledReadingGlyphRects,
  bitmapTextLineLeft,
  bitmapTextLayout,
  integerLogicalRect,
  nearestBitmapPixels,
  wrapBitmapText,
} from "../../src/display/BitmapDomText";

const shellSource = readFileSync("src/ui/QuantumBoxShell.ts", "utf8");
const cssSource = readFileSync("src/display/brownBox.css", "utf8");

describe("semantic DOM bitmap mirror", () => {
  it("reduces an image using exact source pixels without blending alpha or colours", () => {
    const clear = [0, 0, 0, 0],
      cream = [214, 189, 139, 255],
      tan = [86, 67, 48, 255];
    const source = {
      width: 5,
      height: 3,
      data: new Uint8ClampedArray([
        ...clear,
        ...cream,
        ...tan,
        ...cream,
        ...clear,
        ...cream,
        ...clear,
        ...tan,
        ...clear,
        ...cream,
        ...tan,
        ...cream,
        ...clear,
        ...cream,
        ...tan,
      ]),
    };
    const data = nearestBitmapPixels(source, 3, 2);
    expect([...data]).toEqual([
      ...clear,
      ...tan,
      ...clear,
      ...tan,
      ...clear,
      ...tan,
    ]);
    expect(auditBitmapCanvasPixels({ data } as ImageData)).toEqual({
      unexpectedColours: [],
      unexpectedAlphaValues: [],
      opaquePixelCount: 3,
    });
    expect(nearestBitmapPixels(source, 5, 3)).toEqual(source.data);
    expect(() => nearestBitmapPixels(source, 0, 2)).toThrow("dimensions");
  });
  it("pins one aria-hidden native bitmap plane while retaining semantic controls", () => {
    expect(BITMAP_DOM_TEXT_CONTRACT.width).toBe(320);
    expect(BITMAP_DOM_TEXT_CONTRACT.height).toBe(180);
    expect(BITMAP_DOM_TEXT_CONTRACT.imageSmoothingEnabled).toBe(false);
    expect(shellSource).toContain(
      'class="qb-bitmap-ui" data-ui="bitmap-text" width="320" height="180" aria-hidden="true"',
    );
    expect(shellSource).toContain(
      '<button class="qb-primary-menu-row" type="button"',
    );
    expect(shellSource).toContain('role="status" aria-live="polite"');
    expect(shellSource).toContain('data-action="story-terminal-action"');
    expect(shellSource).toContain('class="qb-page-panel qb-terminal-page"');
    expect(shellSource).not.toContain('data-cabinet="tutorial-world"');
  });

  it("makes the complete DOM paint transparent without removing focus or input geometry", () => {
    expect(cssSource).toContain("pointer-events: none");
    const semanticRule = cssSource.match(
      /\.qb-bitmap-semantic \{([^}]*)\}/,
    )?.[1];
    expect(semanticRule).toBeDefined();
    expect(semanticRule).toContain("opacity: 0 !important");
    expect(semanticRule).not.toContain("display:");
    expect(semanticRule).not.toContain("visibility:");
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).toContain(
      '"details:not([open])"',
    );
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).toContain(
      "drawFocusCursor",
    );
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).toContain(
      `input[type='text']`,
    );
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).toContain(
      "drawElementGeometry",
    );
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).toContain(
      "drawImages",
    );
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).toContain(
      "drawFormControls",
    );
    expect(cssSource).toContain("outline: 0 !important");
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).not.toContain(
      "drawStatus(",
    );
  });

  it("does not confuse accessibility hiding with visual bitmap suppression", () => {
    const rendererSource = readFileSync("src/display/BitmapDomText.ts", "utf8");
    const paintPredicate = rendererSource.match(
      /function isElementPainted\([\s\S]*?\n}\n\nfunction isElementLayoutVisible/,
    )?.[0];
    expect(paintPredicate).toBeDefined();
    expect(paintPredicate).not.toContain('getAttribute("aria-hidden")');
    expect(shellSource).toContain('<header aria-hidden="true">');
    expect(shellSource).toContain('page.id === "postscript-2"');
    expect(shellSource).toContain('data-action="postscript-moth"');
  });

  it("accepts only the exact three colours and binary alpha", () => {
    expect(BITMAP_DOM_TEXT_CONTRACT.palette).toEqual([
      "#2B1C14",
      "#564330",
      "#D6BD8B",
    ]);
    const data = new Uint8ClampedArray([
      0x2b, 0x1c, 0x14, 0xff, 0x56, 0x43, 0x30, 0xff, 0xd6, 0xbd, 0x8b, 0xff, 0,
      0, 0, 0,
    ]);
    const audit = auditBitmapCanvasPixels({ data } as ImageData);
    expect(audit.unexpectedColours).toEqual([]);
    expect(audit.unexpectedAlphaValues).toEqual([]);
    expect(audit.opaquePixelCount).toBe(3);
  });

  it("reports interpolated alpha and off-palette raster output", () => {
    const data = new Uint8ClampedArray([1, 2, 3, 127]);
    const audit = auditBitmapCanvasPixels({ data } as ImageData);
    expect(audit.unexpectedColours).toEqual(["#010203"]);
    expect(audit.unexpectedAlphaValues).toEqual([127]);
  });

  it("wraps whole semantic labels without browser-font word collisions", () => {
    expect(wrapBitmapText("HUMAN / CPU", 26, 1, 0, 2)).toEqual([
      "HUMAN /",
      "CPU",
    ]);
    expect(wrapBitmapText("ABCDEFGHI", 12, 1, 0, 3)).toEqual([
      "ABCD",
      "EFGH",
      "I",
    ]);
    expect(wrapBitmapText("FIRST LINE\nSECOND LINE", 200, 1, 1, 3)).toEqual([
      "FIRST LINE",
      "SECOND LINE",
    ]);
  });

  it("reserves complete bitmap rows when browser-font wrapping would truncate a tutorial", () => {
    const text =
      "A LINE CROSSING COUNTS AT THE FAR GOAL OR YOUR OWN. OBSERVE EARLY, OR LET THE CROSSING RESOLVE IT.";
    const height = bitmapFlowTextHeight(text, 135);
    expect(height).toBe(50);
    expect(
      wrapBitmapText(text, 135, 1, 1, Math.floor(height / 10), true).join(" "),
    ).toBe(text);
    expect(
      bitmapFlowTextHeight(
        "A PADDLE MATCH WHOSE GOAL RULE IS UNRESOLVED.",
        135,
      ),
    ).toBe(20);
  });

  it("retains a blank column between letters instead of compressing labels", () => {
    expect(bitmapTextLayout("SCORE", 19, 8)).toEqual({
      pixel: 1,
      spacing: 1,
    });
    expect(bitmapTextLayout("TUTORIAL", 31, 8)).toEqual({
      pixel: 1,
      spacing: 1,
    });
    const scoreLayout = bitmapTextLayout("SCORE", 19, 8);
    expect(
      wrapBitmapText("SCORE", 19, scoreLayout.pixel, scoreLayout.spacing, 1),
    ).toEqual(["SCORE"]);
  });

  it("chooses a glyph scale that fits every authored line vertically", () => {
    expect(bitmapTextLayout("ONE\nTWO\nTHREE", 200, 18)).toEqual({
      pixel: 1,
      spacing: 1,
    });
  });

  it("places complete aligned lines inside integer clip boundaries", () => {
    expect(bitmapTextLineLeft(12.2, 42.8, 19, "left")).toBe(13);
    expect(bitmapTextLineLeft(12.2, 42.8, 19, "center")).toBe(18);
    expect(bitmapTextLineLeft(12.2, 42.8, 19, "right")).toBe(23);
  });

  it("publishes an explicit-label fit audit on the bitmap plane", () => {
    const source = readFileSync("src/display/BitmapDomText.ts", "utf8");
    expect(source).toContain('dataset["explicitTextFitAudit"]');
    expect(source).toContain('dataset["fractionalPlacementAudit"]');
    expect(source).toContain('dataset["visibleDomPaintAudit"]');
  });

  it("quantizes each projected DOM rectangle once at the presentation edge", () => {
    expect(
      integerLogicalRect({
        left: 10.49,
        top: 4.51,
        right: 22.6,
        bottom: 11.4,
        width: 12.11,
        height: 6.89,
      }),
    ).toEqual({
      left: 10,
      top: 5,
      right: 23,
      bottom: 11,
      width: 13,
      height: 6,
    });
    expect(() =>
      integerLogicalRect({
        left: Number.NaN,
        top: 0,
        right: 1,
        bottom: 1,
        width: 1,
        height: 1,
      }),
    ).toThrow("must be finite");
  });

  it("removes the clipped Home status column from semantic and bitmap layout", () => {
    expect(shellSource).not.toContain("<small>${status}</small>");
    expect(cssSource).toContain("grid-template-columns: 6cqw minmax(0, 1fr)");
  });

  it("places the focus marker outside the focused control bounds", () => {
    expect(bitmapFocusCursorPlacement(18, 78)).toEqual({
      x: 15,
      side: "left",
    });
    expect(bitmapFocusCursorPlacement(0, 42)).toEqual({
      x: 43,
      side: "right",
    });
    expect(bitmapFocusCursorPlacement(0, 320)).toBeNull();
  });
});

it("orders diagnostic alpha values numerically", () => {
  const data = new Uint8ClampedArray([0, 0, 0, 100, 0, 0, 0, 2, 0, 0, 0, 10]);
  expect(
    auditBitmapCanvasPixels({ data } as ImageData).unexpectedAlphaValues,
  ).toEqual([2, 10, 100]);
});

describe("explicit Arcade reading roles", () => {
  it.each(["top", "bottom"] as const)(
    "renders two complete, equal colon dots at 5.5 cells with %s alignment",
    (alignment) => {
      for (const x of [0, 0.25, 0.5, 17.75]) {
        for (const y of [0, 0.25, 0.5, 0.75, 42, 67.5]) {
          const rects = scaledReadingGlyphRects(":", x, y, 0.75, alignment);
          const rows = new Map<number, Set<number>>();
          for (const rect of rects) {
            for (
              let row = rect.y * 2;
              row < (rect.y + rect.height) * 2;
              row++
            ) {
              const pixels = rows.get(row) ?? new Set<number>();
              for (let col = rect.x * 2; col < (rect.x + rect.width) * 2; col++)
                pixels.add(col);
              rows.set(row, pixels);
            }
          }
          const inkRows = [...rows.keys()].sort((a, b) => a - b);
          expect(inkRows).toHaveLength(4);
          expect(inkRows[1]).toBe(inkRows[0]! + 1);
          expect(inkRows[3]).toBe(inkRows[2]! + 1);
          expect(inkRows[2]).toBeGreaterThan(inkRows[1]! + 1);
          const columns = [...rows.get(inkRows[0]!)!].sort((a, b) => a - b);
          expect(columns).toHaveLength(2);
          expect(columns[1]).toBe(columns[0]! + 1);
          for (const row of rows.values())
            expect([...row].sort((a, b) => a - b)).toEqual(columns);
        }
      }
    },
  );
  it.each([0.625, 0.75, 1])(
    "keeps scale %s glyphs identical after punctuation",
    (scale) => {
      const glyph = scaledReadingGlyphRects("M", 0, 42, scale, "bottom");
      for (const prefix of [
        "",
        "A, ",
        "LEFT / RIGHT: ",
        "MOVEMENT: NORMAL. BALL: ",
        "WHY? ",
        "ONCE PER ROUND, ",
        "WHEN THE SCREEN PULSES, ",
      ]) {
        const rendered = scaledReadingGlyphRects(
          prefix + "M",
          17,
          42,
          scale,
          "bottom",
        ).slice(-glyph.length);
        const origin = Math.min(...rendered.map((r) => r.x));
        expect(rendered.map((r) => ({ ...r, x: r.x - origin }))).toEqual(glyph);
      }
    },
  );
  it.each([0.625, 0.75, 1])(
    "keeps scale %s on the binary native pixel grid",
    (scale) => {
      const glyphs = scaledReadingGlyphRects(
        "QONG · SCORE 0123456789 / ⌫",
        16.5,
        42,
        scale,
      );
      expect(glyphs.length).toBeGreaterThan(100);
      for (const rect of glyphs) {
        for (const value of Object.values(rect))
          expect(Number.isInteger(value * 2)).toBe(true);
        expect(rect.width).toBeGreaterThan(0);
        expect(rect.height).toBeGreaterThan(0);
      }
    },
  );
  it("measures scaled flow with the same wrap and line advance as rendering", () => {
    const text =
      "OTHERWISE, YOU'LL HAVE TO WAIT FOR A GOAL TO FIND OUT WHO SCORED.";
    expect(bitmapFlowTextHeight(text, 135, 0.75)).toBe(
      wrapBitmapText(text, 135, 0.75, 0.75, Infinity, true).length * 7.5,
    );
    expect(bitmapFlowTextHeight(text, 135)).toBe(
      wrapBitmapText(text, 135, 1, 1, Infinity, true).length * 10,
    );
  });
});

describe("bottom-aligned Arcade lettering", () => {
  it.each([0.625, 0.75, 1])(
    "aligns scale %s without changing the glyph raster",
    (scale) => {
      for (const y of [0, 6.25, 7.5, 15, 42, 67.5]) {
        const original = scaledReadingGlyphRects(
          "HOLD: SCORE 0123 / ⌫",
          17,
          y,
          scale,
        );
        const aligned = scaledReadingGlyphRects(
          "HOLD: SCORE 0123 / ⌫",
          17,
          y,
          scale,
          "bottom",
        );
        const oldBottom = Math.max(...original.map((r) => r.y + r.height));
        const shift = Math.ceil(oldBottom) - oldBottom;
        expect(Math.max(...aligned.map((r) => r.y + r.height))).toBe(
          Math.ceil(oldBottom),
        );
        expect([0, 0.5]).toContain(shift);
        expect(aligned).toEqual(
          original.map((r) => ({ ...r, y: r.y + shift })),
        );
        expect(
          scaledReadingGlyphRects("HOLD: SCORE 0123 / ⌫", 17, y, scale, "top"),
        ).toEqual(original);
      }
    },
  );

  it("aligns every wrapped body line, including half-row origins", () => {
    const lines = wrapBitmapText(
      "OTHERWISE, YOU'LL HAVE TO WAIT FOR A GOAL TO FIND OUT WHO SCORED.",
      134,
      0.75,
      0.75,
      Infinity,
      true,
    );
    expect(lines.length).toBe(3);
    for (const [index, line] of lines.entries()) {
      const rects = scaledReadingGlyphRects(
        line,
        167,
        111 + index * 7.5,
        0.75,
        "bottom",
      );
      expect(
        Number.isInteger(Math.max(...rects.map((r) => r.y + r.height))),
      ).toBe(true);
    }
  });
});
