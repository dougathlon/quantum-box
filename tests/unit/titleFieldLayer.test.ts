import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  resolveBrownBoxTitleFieldBoundary,
  resolveBrownBoxTitleFieldLayout,
} from "../../src/display/BrownBoxTitleField";

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

const sha256 = (path: string) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");

describe("physical title field presentation", () => {
  it("uses the reviewed binary mask without shipping a title-only field derivative", () => {
    const expected =
      "88e931ba0ddcc9cfc9f81a374bae2d43a69fba3e5fc972f630c731282fe2943f";
    expect(sha256(titleMaskPath)).toBe(expected);
    expect(manifestSource).toContain(expected);
    expect(manifestSource).toContain("title-b3-s3-screen-layer.png");
    expect(manifestSource).not.toContain("title-qrt-coarse-screen-layer.png");
  });

  it("drives the title from the same endpoints and field schedule as the internal display", () => {
    expect(shellSource).toContain("new BrownBoxTitleField(");
    expect(shellSource).toContain("titleAssets.screenMask");
    expect(titleFieldSource).toContain("resolveBrownBoxFieldFrameAtEpoch(");
    expect(titleFieldSource).toContain("updateBrownBoxFieldStateDataset(");
    expect(titleFieldSource).toContain(
      'this.canvas.dataset["fieldProgramme"] = this.programme.programmeId',
    );
    expect(titleFieldSource).toContain("public setProgramme(");
    expect(titleFieldSource).toContain(
      'this.context.globalCompositeOperation = "destination-in"',
    );
    expect(titleFieldSource).toContain("this.context.clip()");
    expect(titleFieldSource).not.toMatch(/gradient|blur|opacity/i);
  });

  it("maps the native hard boundary across the complete photographed CRT", () => {
    expect(resolveBrownBoxTitleFieldBoundary(2, 0)).toBe(0);
    expect(resolveBrownBoxTitleFieldBoundary(2, 160)).toBe(320);
    expect(resolveBrownBoxTitleFieldBoundary(2, 320)).toBe(640);
  });

  it("crops the native field into the title CRT at the internal field's exact pixel scale", () => {
    const layout = resolveBrownBoxTitleFieldLayout(796, 998, 640, 1672, 941, {
      x: 265,
      y: 123,
      width: 918,
      height: 516,
    });
    expect(layout.pixelScale).toBe(2);
    expect(layout.fieldWidth).toBe(640);
    expect(layout.fieldHeight).toBe(360);
    expect(layout.screen.width).toBeLessThan(layout.fieldWidth);
    expect(layout.screen.height).toBeLessThan(layout.fieldHeight);
  });

  it("keeps the title field backing size independent from visual transforms", () => {
    expect(titleFieldSource).toContain("this.host.clientWidth");
    expect(titleFieldSource).toContain("this.host.clientHeight");
    expect(titleFieldSource).not.toContain("this.host.getBoundingClientRect()");
  });

  it("cuts directly to the internal screen without an opening zoom state", () => {
    expect(shellSource).not.toContain('dataset["surface"] = "transition"');
    expect(shellSource).not.toContain("transitionTimer");
    expect(stylesSource).not.toContain("qb-enter-screen");
  });
});
