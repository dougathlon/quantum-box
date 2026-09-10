import type Phaser from "phaser";

import {
  BROWN_BOX_CSS_PALETTE,
  BROWN_BOX_LOGICAL_SCREEN,
} from "../display/BrownBoxTheme";

export type RgbaTuple = readonly [number, number, number, number];

export interface BrownBoxPixelCount {
  readonly rgba: RgbaTuple;
  readonly count: number;
}

export interface BrownBoxCanvasPaletteReport {
  readonly width: number;
  readonly height: number;
  readonly logicalResolutionMatches: boolean;
  readonly pixelCount: number;
  readonly colours: readonly BrownBoxPixelCount[];
  readonly unexpectedColours: readonly BrownBoxPixelCount[];
  readonly passed: boolean;
}

export interface BrownBoxStyleViolation {
  readonly element: string;
  readonly property: string;
  readonly value: string;
}

export interface BrownBoxDomStyleReport {
  readonly visibleElementCount: number;
  readonly resolvedColours: readonly string[];
  readonly violations: readonly BrownBoxStyleViolation[];
  readonly passed: boolean;
}

export interface BrownBoxLivePaletteReport {
  readonly schemaVersion: "quantum-box-live-palette-audit-v1";
  readonly frame: number;
  readonly surface: {
    readonly page: string | null;
    readonly view: string | null;
    readonly cabinet: string | null;
  };
  readonly canvas: BrownBoxCanvasPaletteReport;
  readonly dom: BrownBoxDomStyleReport;
  readonly passed: boolean;
}

const APPROVED_RGBA = new Set([
  "0,0,0,0",
  "43,28,20,255",
  "86,67,48,255",
  "214,189,139,255",
]);

const APPROVED_CSS_COLOURS = new Set([
  "rgb(43, 28, 20)",
  "rgb(86, 67, 48)",
  "rgb(214, 189, 139)",
  "rgba(0, 0, 0, 0)",
]);

const COLOUR_PROPERTIES = [
  "color",
  "backgroundColor",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "outlineColor",
] as const;

const EFFECT_PROPERTIES = {
  boxShadow: "none",
  filter: "none",
  mixBlendMode: "normal",
  opacity: "1",
  textShadow: "none",
} as const;

export function auditBrownBoxPixelBuffer(
  width: number,
  height: number,
  pixels: Uint8ClampedArray,
): BrownBoxCanvasPaletteReport {
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    throw new Error("Brown Box canvas dimensions must be integers.");
  }
  if (pixels.length !== width * height * 4) {
    throw new Error(
      `Brown Box pixel buffer length ${pixels.length} does not match ${width}×${height} RGBA.`,
    );
  }

  const counts = new Map<string, number>();
  for (let index = 0; index < pixels.length; index += 4) {
    const key = `${pixels[index]},${pixels[index + 1]},${pixels[index + 2]},${pixels[index + 3]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const colours = [...counts.entries()]
    .map(([key, count]) =>
      Object.freeze({
        rgba: Object.freeze(key.split(",").map(Number)) as RgbaTuple,
        count,
      }),
    )
    .sort((left, right) =>
      rgbaKey(left.rgba).localeCompare(rgbaKey(right.rgba)),
    );
  const unexpectedColours = colours.filter(
    ({ rgba }) => !APPROVED_RGBA.has(rgbaKey(rgba)),
  );
  const logicalResolutionMatches =
    width === BROWN_BOX_LOGICAL_SCREEN.width * 2 &&
    height === BROWN_BOX_LOGICAL_SCREEN.height * 2;
  return Object.freeze({
    width,
    height,
    logicalResolutionMatches,
    pixelCount: width * height,
    colours: Object.freeze(colours),
    unexpectedColours: Object.freeze(unexpectedColours),
    passed: logicalResolutionMatches && unexpectedColours.length === 0,
  });
}

export function startBrownBoxCanvasAudit(
  game: Phaser.Game,
  root: HTMLElement,
): () => void {
  const output = document.createElement("output");
  output.hidden = true;
  output.dataset["qaBrownBoxPalette"] = "";
  output.setAttribute("aria-hidden", "true");
  root.append(output);

  let stopped = false;
  let pending = false;
  let firstTimer = 0;

  const capture = () => {
    if (stopped || pending || !game.renderer) return;
    pending = true;
    game.renderer.snapshot((snapshot) => {
      pending = false;
      if (stopped) return;
      if (!(snapshot instanceof HTMLImageElement)) {
        output.textContent = JSON.stringify({
          schemaVersion: "quantum-box-live-palette-audit-v1",
          passed: false,
          error: "Renderer snapshot did not return an image.",
        });
        return;
      }
      try {
        const canvas = document.createElement("canvas");
        canvas.width = snapshot.naturalWidth || snapshot.width;
        canvas.height = snapshot.naturalHeight || snapshot.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error("2D audit context is unavailable.");
        context.drawImage(snapshot, 0, 0);
        const pixels = context.getImageData(
          0,
          0,
          canvas.width,
          canvas.height,
        ).data;
        const canvasReport = auditBrownBoxPixelBuffer(
          canvas.width,
          canvas.height,
          pixels,
        );
        const domReport = auditVisibleInternalStyles(root);
        const shell = root.querySelector<HTMLElement>(".qb-shell");
        const cabinet = root.querySelector<HTMLElement>(
          ".qb-cabinet-ui:not([hidden])",
        );
        const report: BrownBoxLivePaletteReport = Object.freeze({
          schemaVersion: "quantum-box-live-palette-audit-v1",
          frame: game.loop.frame,
          surface: Object.freeze({
            page: shell?.dataset["page"] ?? null,
            view: shell?.dataset["view"] ?? null,
            cabinet: cabinet?.dataset["cabinet"] ?? null,
          }),
          canvas: canvasReport,
          dom: domReport,
          passed: canvasReport.passed && domReport.passed,
        });
        output.textContent = JSON.stringify(report);
      } catch (error) {
        output.textContent = JSON.stringify({
          schemaVersion: "quantum-box-live-palette-audit-v1",
          passed: false,
          error:
            error instanceof Error ? error.message : "Unknown audit error.",
        });
      }
    }, "image/png");
  };

  firstTimer = window.setTimeout(capture, 250);
  const interval = window.setInterval(capture, 750);
  return () => {
    stopped = true;
    window.clearTimeout(firstTimer);
    window.clearInterval(interval);
    output.remove();
  };
}

function auditVisibleInternalStyles(root: HTMLElement): BrownBoxDomStyleReport {
  const internal = root.querySelector<HTMLElement>(".qb-internal");
  if (!internal || internal.hidden) {
    return Object.freeze({
      visibleElementCount: 0,
      resolvedColours: Object.freeze([]),
      violations: Object.freeze([
        Object.freeze({
          element: ".qb-internal",
          property: "visibility",
          value: "hidden",
        }),
      ]),
      passed: false,
    });
  }

  const status = root.querySelector<HTMLElement>(".qb-status");
  const elements = [
    internal,
    ...internal.querySelectorAll<HTMLElement>("*"),
    ...(status ? [status] : []),
  ].filter((element) => element.getClientRects().length > 0);
  const resolvedColours = new Set<string>();
  const violations: BrownBoxStyleViolation[] = [];
  for (const element of elements) {
    const style = window.getComputedStyle(element);
    for (const property of COLOUR_PROPERTIES) {
      const value = style[property];
      resolvedColours.add(value);
      if (!APPROVED_CSS_COLOURS.has(value)) {
        violations.push(
          Object.freeze({
            element: describeElement(element),
            property,
            value,
          }),
        );
      }
    }
    for (const [property, defaultExpected] of Object.entries(
      EFFECT_PROPERTIES,
    )) {
      const expected =
        property === "opacity" &&
        element.classList.contains("qb-bitmap-semantic")
          ? "0"
          : defaultExpected;
      const value = style[property as keyof CSSStyleDeclaration] as string;
      if (value !== expected) {
        violations.push(
          Object.freeze({
            element: describeElement(element),
            property,
            value,
          }),
        );
      }
    }
    const backgroundImage = style.backgroundImage;
    const approvedFieldImage =
      element === internal &&
      /qrt-state-[1-4]-background-320x180\.png/.test(backgroundImage);
    if (backgroundImage !== "none" && !approvedFieldImage) {
      violations.push(
        Object.freeze({
          element: describeElement(element),
          property: "backgroundImage",
          value: backgroundImage,
        }),
      );
    }
  }

  return Object.freeze({
    visibleElementCount: elements.length,
    resolvedColours: Object.freeze([...resolvedColours].sort()),
    violations: Object.freeze(violations),
    passed: violations.length === 0,
  });
}

function describeElement(element: HTMLElement): string {
  const id = element.id ? `#${element.id}` : "";
  const classes = [...element.classList].map((name) => `.${name}`).join("");
  return `${element.tagName.toLowerCase()}${id}${classes}`;
}

function rgbaKey(rgba: RgbaTuple): string {
  return rgba.join(",");
}

export const BROWN_BOX_AUDIT_CSS_PALETTE = Object.freeze([
  BROWN_BOX_CSS_PALETTE.darkTobacco,
  BROWN_BOX_CSS_PALETTE.mutedTan,
  BROWN_BOX_CSS_PALETTE.cream,
]);
