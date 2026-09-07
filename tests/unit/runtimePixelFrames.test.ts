import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  RUNTIME_PIXEL_FRAME_SUMMARY,
  requireRuntimePixelFrame,
} from "../../src/assets/RuntimePixelFrames";
import { canonicalSpriteFrame } from "../../src/display/CanonicalSpriteRaster";
import { qgraphCabinetSpriteFrame } from "../../src/display/QGraphCabinetSpriteRaster";

const canonicalRasterSource = readFileSync(
  "src/display/CanonicalSpriteRaster.ts",
  "utf8",
);
const qgraphRasterSource = readFileSync(
  "src/display/QGraphCabinetSpriteRaster.ts",
  "utf8",
);

describe("browser-independent runtime pixel frames", () => {
  it("covers every canonical and QGraph cabinet frame", () => {
    expect(RUNTIME_PIXEL_FRAME_SUMMARY).toEqual([
      expect.objectContaining({
        familyId: "canonical-runtime-v2",
        frameCount: 98,
      }),
      expect.objectContaining({
        familyId: "qgraph-cabinet-v1",
        frameCount: 81,
      }),
    ]);
  });

  it("provides Qong and Quarry frames without a browser texture manager", () => {
    const paddle = canonicalSpriteFrame("qong-paddle", "paddle");
    const duck = qgraphCabinetSpriteFrame(
      "quag-player-directional-strip",
      "a-right-idle",
    );
    expect(paddle).toHaveLength(20);
    expect(paddle.every((row) => row.length === 20)).toBe(true);
    expect(duck).toHaveLength(20);
    expect(duck.every((row) => row.length === 20)).toBe(true);
    expect(paddle.join("")).toContain("C");
    expect(duck.join("")).toContain("C");
  });

  it("does not read or validate sprite pixels through browser canvas APIs", () => {
    for (const source of [canonicalRasterSource, qgraphRasterSource]) {
      expect(source).not.toContain("getPixel(");
      expect(source).not.toContain("getImageData(");
      expect(source).not.toContain("TextureManager");
      expect(source).toContain("requireRuntimePixelFrame");
    }
  });

  it("fails closed for unmanifested frame identities", () => {
    expect(() =>
      requireRuntimePixelFrame(
        "canonical-runtime-v2",
        "qong-paddle",
        "missing",
      ),
    ).toThrow(/Runtime pixel frame is missing/);
  });
});
