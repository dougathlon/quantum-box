import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const titleMaskPath = "src/assets/brown-box/title-b3-s3-screen-layer.png";
const manifestSource = readFileSync(
  "src/display/BrownBoxAssetManifest.ts",
  "utf8",
);
const titleFieldSource = readFileSync(
  "src/display/BrownBoxTitleField.ts",
  "utf8",
);
const shellSource = readFileSync("src/ui/QuantumBoxShell.ts", "utf8");
const stylesSource = readFileSync("src/styles.css", "utf8");
const assetEntrySource = readFileSync("src/assets/manifest.ts", "utf8");

const sha256 = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("native title field presentation", () => {
  it("retains the retired photographic source without importing it in production", () => {
    const expected =
      "88e931ba0ddcc9cfc9f81a374bae2d43a69fba3e5fc972f630c731282fe2943f";
    expect(sha256(titleMaskPath)).toBe(expected);
    expect(manifestSource).toContain(expected);
    expect(manifestSource).toContain("title-b3-s3-screen-layer.png");
    expect(manifestSource).not.toContain("title-qrt-coarse-screen-layer.png");
    expect(assetEntrySource).not.toContain("BrownBoxAssetManifest");
    expect(shellSource).not.toContain("QuantumBoxTitleAssets");
    expect(shellSource).not.toContain("titleAssets");
  });

  it("drives the title from the same viewport field as the internal display", () => {
    expect(shellSource).toContain("new BrownBoxTitleField(");
    expect(titleFieldSource).toContain("new BrownBoxViewportField(");
    expect(titleFieldSource).toContain("native-320x180-title-field-v2");
    expect(titleFieldSource).toContain("public setProgramme(");
    expect(titleFieldSource).toContain("drawTitleLettering(");
    expect(titleFieldSource).toContain("layout.originX");
    expect(titleFieldSource).toContain("layout.originY");
    expect(titleFieldSource).toContain("layout.pixelScale");
    expect(titleFieldSource).toContain("resolveBrownBoxDisplayPixelScale");
    expect(titleFieldSource).not.toContain("getComputedStyle");
    expect(titleFieldSource).not.toMatch(/mask|destination-in|photograph/i);
  });

  it("keeps the title field backing size independent from visual transforms", () => {
    expect(titleFieldSource).toContain("this.host.clientWidth");
    expect(titleFieldSource).toContain("this.host.clientHeight");
    expect(titleFieldSource).not.toContain("this.host.getBoundingClientRect()");
  });

  it("keeps only the semantic start control on the opening", () => {
    expect(shellSource).toContain('data-action="press-start"');
    expect(shellSource).not.toContain("qb-title-layer--device");
    expect(shellSource).not.toContain("qb-title-layer--copy");
  });

  it("cuts directly to the internal screen without an opening zoom state", () => {
    expect(shellSource).not.toContain('dataset["surface"] = "transition"');
    expect(shellSource).not.toContain("transitionTimer");
    expect(stylesSource).not.toContain("qb-enter-screen");
  });
});
