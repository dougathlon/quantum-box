import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  auditBitmapCanvasPixels,
  BITMAP_DOM_TEXT_CONTRACT,
  wrapBitmapText,
} from "../../src/display/BitmapDomText";

const shellSource = readFileSync("src/ui/QuantumBoxShell.ts", "utf8");
const cssSource = readFileSync("src/display/brownBox.css", "utf8");

describe("semantic DOM bitmap mirror", () => {
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
    expect(shellSource).toContain('data-action="story-v2-continue"');
    expect(shellSource).toContain('class="qb-story-dialogue"');
    expect(shellSource).not.toContain('data-cabinet="tutorial-world"');
  });

  it("makes DOM glyph paint transparent without removing focus or input geometry", () => {
    expect(cssSource).toContain(".qb-bitmap-semantic *");
    expect(cssSource).toContain("color: transparent !important");
    expect(cssSource).toContain("pointer-events: none");
    const semanticRule = cssSource.match(
      /\.qb-bitmap-semantic,\n\.qb-bitmap-semantic \* \{([^}]*)\}/,
    )?.[1];
    expect(semanticRule).toBeDefined();
    expect(semanticRule).not.toContain("display:");
    expect(semanticRule).not.toContain("visibility:");
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).toContain(
      '"details:not([open])"',
    );
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).toContain(
      "drawFocusCursor",
    );
    expect(cssSource).toContain("outline: 0 !important");
    expect(readFileSync("src/display/BitmapDomText.ts", "utf8")).not.toContain(
      "drawStatus(",
    );
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
  });

  it("removes the clipped Home status column from semantic and bitmap layout", () => {
    expect(shellSource).not.toContain("<small>${status}</small>");
    expect(cssSource).toContain("grid-template-columns: 6cqw minmax(0, 1fr)");
  });
});
