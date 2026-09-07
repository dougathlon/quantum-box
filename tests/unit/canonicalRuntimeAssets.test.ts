import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { designerMorphFrame } from "../../src/display/views/DesignerEncounterView";
import {
  canonicalSpritePlacement,
  CANONICAL_SPRITE_PIXEL_SCALE,
} from "../../src/display/CanonicalSpriteRaster";

const assetRoot = resolve("src/assets/canonical-runtime-assets-v2");
const sourceManifestPath = resolve(assetRoot, "manifests/source-manifest.json");
const runtimeManifestPath = resolve(
  assetRoot,
  "manifests/runtime-handoff.json",
);
const displaySource = readFileSync("src/display/BrownBoxDisplay.ts", "utf8");
const fluxballSource = readFileSync(
  "src/display/views/FluxballView.ts",
  "utf8",
);
const qongSource = readFileSync("src/display/views/QongView.ts", "utf8");
const skiPixlSource = readFileSync("src/display/views/SkiPixlView.ts", "utf8");
const quantmanSource = readFileSync(
  "src/display/views/QuantmanView.ts",
  "utf8",
);
const designerSource = readFileSync(
  "src/display/views/DesignerEncounterView.ts",
  "utf8",
);
const sha256 = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("canonical runtime asset manifest", () => {
  it("locks both manifests to their approved source hashes", () => {
    expect(sha256(sourceManifestPath)).toBe(
      "aa12069a34edd3b60585b476bac6f73d01dfd503fbbbac6f9808b7e30ebdb842",
    );
    expect(sha256(runtimeManifestPath)).toBe(
      "1ffdb24e076cb10c51402523c7b66ef462a8a8ba9a492d29bc1560d32b43e9ae",
    );
  });

  it("records SHA-256 lineage for every immutable source and runtime file", () => {
    const source = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
    const runtime = JSON.parse(readFileSync(runtimeManifestPath, "utf8"));
    expect(source.sourceMutation).toBe("prohibited");
    expect(source.sources).toHaveLength(26);
    expect(runtime.runtimeFiles).toHaveLength(45);
    expect(
      source.sources.every(
        (entry: { sourceLocator: string }) =>
          !entry.sourceLocator.startsWith("/") &&
          !entry.sourceLocator.includes(".."),
      ),
    ).toBe(true);
    for (const entry of [...source.sources, ...runtime.runtimeFiles]) {
      expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it("plays all approved true-morph strips across interaction states", () => {
    expect(designerMorphFrame("approach", 0)).toBe(0);
    expect(designerMorphFrame("dialogue", 0)).toBe(2);
    expect(designerMorphFrame("dialogue", 1)).toBe(4);
    expect(designerMorphFrame("dialogue", 2)).toBe(6);
    expect(designerMorphFrame("mechanism", 0)).toBe(6);
  });

  it("maps each canonical source pixel to one native framebuffer pixel", () => {
    expect(CANONICAL_SPRITE_PIXEL_SCALE).toBe(2);
  });

  it("maps manifest anchors onto existing cabinet coordinates", () => {
    expect(
      canonicalSpritePlacement(20, 20, 10, 10, {
        pixel: 2,
        centerX: 100,
        bottomY: 80,
      }),
    ).toEqual({ pixel: 2, centerX: 100, bottomY: 100 });
    expect(
      canonicalSpritePlacement(20, 20, 10, 20, {
        pixel: 2,
        centerX: 100,
        bottomY: 80,
      }),
    ).toEqual({ pixel: 2, centerX: 100, bottomY: 80 });
  });

  it("loads and consumes every approved runtime family without a SkiPixl morph", () => {
    expect(displaySource).toContain("CANONICAL_RUNTIME_ASSETS");
    expect(qongSource).toContain('"qong-paddle"');
    expect(qongSource).toContain("drawCanonicalSprite");
    expect(fluxballSource).toContain('"fluxball-player-motion-strip"');
    expect(fluxballSource).toContain("drawQGraphCabinetSprite");
    expect(skiPixlSource).toContain('"skipixl-steering-seven-angle-strip"');
    expect(skiPixlSource).toContain('"skipixl-approved-five-state-strip"');
    expect(quantmanSource).toContain('"quantman-player-directional-strip"');
    expect(quantmanSource).toContain('"quantman-ghost-directional-strip"');
    for (const fileId of [
      "player-c-four-direction-walk-strip",
      "designer-wizard-action-strip",
      "qong-paddle-to-wizard",
      "fluxball-player-a-to-wizard",
      "quantman-ghost-c-to-wizard",
    ]) {
      expect(designerSource).toContain(`"${fileId}"`);
    }
    expect(designerSource).not.toContain("skipixl-to-wizard");
  });
});
