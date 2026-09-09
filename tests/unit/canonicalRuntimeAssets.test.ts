import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CANONICAL_RUNTIME_ASSETS } from "../../src/assets/CanonicalRuntimeAssets";
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
const shippedManifestPath = resolve(
  assetRoot,
  "manifests/shipped-runtime-handoff.json",
);
const displaySource = readFileSync("src/display/BrownBoxDisplay.ts", "utf8");
const fluxballSource = readFileSync(
  "src/display/views/FluxballView.ts",
  "utf8",
);
const qongSource = readFileSync("src/display/views/QongView.ts", "utf8");
const skiPixlSource = readFileSync("src/display/views/SkiPixlView.ts", "utf8");
const quantmanSource = readFileSync(
  "src/display/views/QuantmanSyntheticView.ts",
  "utf8",
);
const sha256 = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("canonical runtime asset manifest", () => {
  it("locks the source, archive, and shipped manifests to approved hashes", () => {
    expect(sha256(sourceManifestPath)).toBe(
      "aa12069a34edd3b60585b476bac6f73d01dfd503fbbbac6f9808b7e30ebdb842",
    );
    expect(sha256(runtimeManifestPath)).toBe(
      "1ffdb24e076cb10c51402523c7b66ef462a8a8ba9a492d29bc1560d32b43e9ae",
    );
    expect(sha256(shippedManifestPath)).toBe(
      "51311236eaaec3cc6627ae987c94891a7d043043e630ffb8765a2bc64e3cd83e",
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

  it("maps each canonical source pixel to one native framebuffer pixel", () => {
    expect(CANONICAL_SPRITE_PIXEL_SCALE).toBe(1);
  });

  it("maps manifest anchors onto existing cabinet coordinates", () => {
    expect(
      canonicalSpritePlacement(20, 20, 10, 10, {
        pixel: 1,
        centerX: 100,
        bottomY: 80,
      }),
    ).toEqual({ pixel: 1, centerX: 100, bottomY: 90 });
    expect(
      canonicalSpritePlacement(20, 20, 10, 20, {
        pixel: 1,
        centerX: 100,
        bottomY: 80,
      }),
    ).toEqual({ pixel: 1, centerX: 100, bottomY: 80 });
  });

  it("loads only the cabinet families in production", () => {
    const shipped = JSON.parse(readFileSync(shippedManifestPath, "utf8"));
    expect(shipped.runtimeFiles).toHaveLength(31);
    expect(shipped.archiveHandoff.sha256).toBe(
      "1ffdb24e076cb10c51402523c7b66ef462a8a8ba9a492d29bc1560d32b43e9ae",
    );
    expect(displaySource).toContain("CANONICAL_RUNTIME_ASSETS");
    expect(CANONICAL_RUNTIME_ASSETS).toHaveLength(31);
    expect(
      CANONICAL_RUNTIME_ASSETS.every((asset) =>
        /assets\/(?:fluxball|qong|quantman|skipixl)\//u.test(
          asset.relativePath,
        ),
      ),
    ).toBe(true);
    expect(
      CANONICAL_RUNTIME_ASSETS.some((asset) =>
        /(?:designer|morphs|player)\//u.test(asset.relativePath),
      ),
    ).toBe(false);
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
      expect(
        CANONICAL_RUNTIME_ASSETS.map((asset) => asset.fileId),
      ).not.toContain(fileId);
    }
  });
});
