import {
  expect,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";

import type { TutorialAction } from "../../../src/tutorials/contracts";
import { FLUXBALL_CLUBHOUSE_COMPLETION_SCRIPT } from "../../../src/tutorials/fluxballClubhouse";
import { qongWorkshopCompletionScript } from "../../../src/tutorials/qongWorkshop";
import { QUANTMAN_TOPOLOGY_ROOM_COMPLETION_SCRIPT } from "../../../src/tutorials/quantmanTopologyRoom";
import { SKIPIXL_LODGE_COMPLETION_SCRIPT } from "../../../src/tutorials/skiPixlLodge";

export const SPATIAL_TUTORIAL_CASES = [
  {
    gameId: "qong",
    route: "qong-designer",
    heading: "Qong Workshop",
    actions: qongWorkshopCompletionScript("direct"),
    hasTrueMorph: true,
  },
  {
    gameId: "skipixl",
    route: "designer-skipixl",
    heading: "SkiPixl Lodge",
    actions: SKIPIXL_LODGE_COMPLETION_SCRIPT,
    hasTrueMorph: false,
  },
  {
    gameId: "fluxball",
    route: "designer-fluxball",
    heading: "Fluxball Clubhouse",
    actions: FLUXBALL_CLUBHOUSE_COMPLETION_SCRIPT,
    hasTrueMorph: true,
  },
  {
    gameId: "quantman",
    route: "designer-quantman",
    heading: "Quantman Topology Room",
    actions: QUANTMAN_TOPOLOGY_ROOM_COMPLETION_SCRIPT,
    hasTrueMorph: true,
  },
] as const;

export async function driveVisibleTutorialControls(
  tutorial: Locator,
  actions: readonly TutorialAction[],
  onPhase?: (phase: string) => Promise<void>,
): Promise<readonly string[]> {
  const phases = new Set<string>();
  for (const action of actions) {
    const input = action.type === "move" ? action.direction : "interact";
    await tutorial.locator(`[data-tutorial-input='${input}']`).click();
    if (await tutorial.isVisible()) {
      const phase = await tutorial
        .locator("[data-tutorial='phase']")
        .textContent();
      if (phase) {
        const normalized = phase.trim();
        phases.add(normalized);
        await onPhase?.(normalized);
      }
    }
  }
  return [...phases];
}

export function captureExternalRequests(
  page: Page,
  testInfo: TestInfo,
): string[] {
  const baseURL = testInfo.project.use.baseURL;
  if (typeof baseURL !== "string") {
    throw new Error("Playwright project requires a string baseURL.");
  }
  const allowedOrigin = new URL(baseURL).origin;
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== allowedOrigin) {
      requests.push(request.url());
    }
  });
  return requests;
}

export async function expectNativeDisplay(page: Page): Promise<void> {
  const canvas = page.locator("#quantum-box-canvas canvas");
  await expect(canvas).toHaveCount(1);
  await expect(canvas).toHaveAttribute("width", "320");
  await expect(canvas).toHaveAttribute("height", "180");
}

interface LivePaletteReport {
  readonly schemaVersion: "quantum-box-live-palette-audit-v1";
  readonly surface: {
    readonly page: string | null;
    readonly cabinet: string | null;
  };
  readonly canvas: {
    readonly width: number;
    readonly height: number;
    readonly logicalResolutionMatches: boolean;
    readonly colours: readonly Readonly<{
      readonly rgba: readonly [number, number, number, number];
      readonly count: number;
    }>[];
    readonly unexpectedColours: readonly unknown[];
    readonly passed: boolean;
  };
  readonly dom: {
    readonly violations: readonly unknown[];
    readonly passed: boolean;
  };
  readonly passed: boolean;
}

export async function expectLiveTutorialPalette(page: Page): Promise<void> {
  const output = page.locator("[data-qa-brown-box-palette]");
  await expect(output).toBeAttached();
  await expect
    .poll(async () => {
      const text = await output.textContent();
      if (!text) return null;
      const report = JSON.parse(text) as LivePaletteReport;
      return {
        page: report.surface?.page ?? null,
        cabinet: report.surface?.cabinet ?? null,
        passed: report.passed,
      };
    })
    .toEqual({ page: "main", cabinet: "tutorial-world", passed: true });

  const report = JSON.parse(
    (await output.textContent()) ?? "{}",
  ) as LivePaletteReport;
  expect(report.schemaVersion).toBe("quantum-box-live-palette-audit-v1");
  expect(report.canvas).toMatchObject({
    width: 320,
    height: 180,
    logicalResolutionMatches: true,
    unexpectedColours: [],
    passed: true,
  });
  expect(report.canvas.colours.map(({ rgba }) => rgba.join(","))).toEqual(
    expect.arrayContaining(["43,28,20,255", "86,67,48,255", "214,189,139,255"]),
  );
  expect(report.canvas.colours).toHaveLength(3);
  expect(report.dom).toMatchObject({ violations: [], passed: true });
}

export async function expectTutorialFrameFits(
  page: Page,
  tutorial: Locator,
): Promise<void> {
  await expect(tutorial).toBeVisible();
  const layout = await tutorialFrameLayout(page);

  expectScreenLayoutFits(layout);
  expect(layout.controls).not.toBeNull();
  expect(layout.dialogue).not.toBeNull();
  expect(layout.controlsInsideFrame).toBe(true);
  expect(layout.dialogueInsideFrame).toBe(true);
  expect(layout.controls?.width).toBeGreaterThan(0);
  if (!layout.dialogueHidden) {
    expect(layout.dialogue?.width).toBeGreaterThan(0);
    expect(layout.dialogue?.height).toBeGreaterThan(0);
  }
  expect(layout.controlsOverflow).toEqual({
    horizontal: false,
    clippedVertical: false,
  });
  expect(layout.buttonsOutside).toBe(false);
}

export async function expectScreenFrameFits(page: Page): Promise<void> {
  expectScreenLayoutFits(await tutorialFrameLayout(page));
}

interface FrameBounds {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
}

interface TutorialFrameLayout {
  readonly viewport: Readonly<{ width: number; height: number }>;
  readonly shell: FrameBounds;
  readonly frame: FrameBounds;
  readonly canvas: FrameBounds;
  readonly controls: FrameBounds | null;
  readonly dialogue: FrameBounds | null;
  readonly dialogueHidden: boolean;
  readonly canvasImageRendering: string;
  readonly bodyOverflow: Readonly<{
    horizontal: boolean;
    vertical: boolean;
  }>;
  readonly controlsInsideFrame: boolean;
  readonly dialogueInsideFrame: boolean;
  readonly controlsOverflow: Readonly<{
    horizontal: boolean;
    clippedVertical: boolean;
  }>;
  readonly buttonsOutside: boolean;
}

async function tutorialFrameLayout(page: Page): Promise<TutorialFrameLayout> {
  const layout = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".qb-shell");
    const frame = document.querySelector<HTMLElement>(".qb-screen-frame");
    const canvas = document.querySelector<HTMLCanvasElement>(
      "#quantum-box-canvas canvas",
    );
    const controls = document.querySelector<HTMLElement>(
      ".qb-designer-encounter-controls",
    );
    const dialogue = document.querySelector<HTMLElement>(
      "[data-tutorial='dialogue']",
    );
    if (!shell || !frame || !canvas) {
      throw new Error("Quantum Box screen frame is incomplete.");
    }
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    const frameBounds = rect(frame);
    const canvasBounds = rect(canvas);
    const controlsBounds = controls ? rect(controls) : null;
    const dialogueBounds = dialogue ? rect(dialogue) : null;
    const inside = (
      container: ReturnType<typeof rect>,
      content: ReturnType<typeof rect> | null,
    ) =>
      content === null ||
      (content.left >= container.left - 1 &&
        content.right <= container.right + 1 &&
        content.top >= container.top - 1 &&
        content.bottom <= container.bottom + 1);
    return {
      viewport: { width: innerWidth, height: innerHeight },
      shell: rect(shell),
      frame: frameBounds,
      canvas: canvasBounds,
      controls: controlsBounds,
      dialogue: dialogueBounds,
      dialogueHidden: dialogue?.hidden ?? true,
      canvasImageRendering: getComputedStyle(canvas).imageRendering,
      bodyOverflow: {
        horizontal: document.documentElement.scrollWidth > innerWidth + 1,
        vertical: document.documentElement.scrollHeight > innerHeight + 1,
      },
      controlsInsideFrame: inside(frameBounds, controlsBounds),
      dialogueInsideFrame: inside(frameBounds, dialogueBounds),
      controlsOverflow: controls
        ? {
            horizontal: controls.scrollWidth > controls.clientWidth + 1,
            clippedVertical:
              controls.scrollHeight > controls.clientHeight + 1 &&
              getComputedStyle(controls).overflowY === "hidden",
          }
        : { horizontal: false, clippedVertical: false },
      buttonsOutside:
        controls && controlsBounds
          ? [...controls.querySelectorAll("button")].some((button) => {
              const bounds = button.getBoundingClientRect();
              return (
                bounds.left < controlsBounds.left - 1 ||
                bounds.right > controlsBounds.right + 1 ||
                bounds.top < controlsBounds.top - 1 ||
                bounds.bottom > controlsBounds.bottom + 1
              );
            })
          : false,
    };
  });
  return layout;
}

function expectScreenLayoutFits(layout: TutorialFrameLayout): void {
  expect(layout.shell).toMatchObject({
    left: 0,
    top: 0,
    right: layout.viewport.width,
    bottom: layout.viewport.height,
  });
  expect(layout.frame).toMatchObject({
    left: 0,
    top: 0,
    right: layout.viewport.width,
    bottom: layout.viewport.height,
  });
  expect(layout.canvas).toEqual(layout.frame);
  expect(layout.canvas.width / layout.canvas.height).toBeCloseTo(16 / 9, 5);
  expect(["pixelated", "crisp-edges"]).toContain(layout.canvasImageRendering);
  expect(layout.bodyOverflow).toEqual({ horizontal: false, vertical: false });
}
