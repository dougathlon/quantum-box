import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const productionViewPaths = [
  "src/display/views/QongView.ts",
  "src/display/views/SkiPixlView.ts",
  "src/display/views/FluxballView.ts",
  "src/display/views/QuantmanSyntheticView.ts",
  "src/display/views/QuagView.ts",
] as const;

const productionSources = productionViewPaths.map((path) => ({
  path,
  source: readFileSync(path, "utf8"),
}));

describe("native production cabinet boundary", () => {
  it("contains no legacy half-scale plane", () => {
    const display = readFileSync("src/display/BrownBoxDisplay.ts", "utf8");
    const theme = readFileSync("src/display/BrownBoxTheme.ts", "utf8");
    const scene = readFileSync("src/game/ScreenScene.ts", "utf8");
    for (const source of [display, theme, scene]) {
      expect(source).not.toContain("LEGACY_CABINET_PLANE");
      expect(source).not.toContain("createLegacyCabinetPlane");
      expect(source).not.toContain("setScale(0.5)");
    }
    expect(scene).toContain("createNativePixelPlane");
  });

  it("uses explicit raster helpers instead of Phaser vector primitives", () => {
    const prohibited =
      /\.lineStyle\(|\.lineBetween\(|\.strokeRect\(|\.strokeEllipse\(|\.fillCircle\(|\.fillEllipse\(|\.fillTriangle\(|\.beginPath\(|\.moveTo\(|\.lineTo\(|\.strokePath\(/;
    for (const { path, source } of productionSources) {
      expect(source, path).not.toMatch(prohibited);
      expect(source, path).toContain("NativePixel");
    }
  });

  it("keeps canonical source pixels at native scale", () => {
    const source = readFileSync("src/display/CanonicalSpriteRaster.ts", "utf8");
    expect(source).toContain("CANONICAL_SPRITE_PIXEL_SCALE = 1");
    expect(source).toContain("Math.round(");
  });

  it("keeps the production opening on the native field without photo imports", () => {
    const title = readFileSync("src/display/BrownBoxTitleField.ts", "utf8");
    const shell = readFileSync("src/ui/QuantumBoxShell.ts", "utf8");
    const assets = readFileSync("src/assets/manifest.ts", "utf8");
    expect(title).toContain("new BrownBoxViewportField(");
    expect(title).toContain("drawTitleLettering(");
    expect(readFileSync("src/display/TitleLettering.ts", "utf8")).toContain(
      'text: "QUANTUM BOX"',
    );
    expect(title).not.toMatch(
      /BrownBoxAssetManifest|title-formica|screen-layer/,
    );
    expect(shell).not.toMatch(
      /QuantumBoxTitleAssets|title-formica|screen-layer/,
    );
    expect(assets).not.toContain("BrownBoxAssetManifest");
  });

  it("keeps the menu raster on one audited 320 by 180 plane", () => {
    const source = readFileSync("src/display/BitmapDomText.ts", "utf8");
    expect(source).toContain("const LOGICAL_WIDTH = 320");
    expect(source).toContain("const LOGICAL_HEIGHT = 180");
    expect(source).toContain('dataset["fractionalPlacementAudit"]');
    expect(source).toContain('dataset["visibleDomPaintAudit"]');
  });
});
