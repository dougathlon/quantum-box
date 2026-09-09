import {
  resolveBrownBoxFieldFrameAtEpoch,
  type BrownBoxFieldStateProvenance,
  updateBrownBoxFieldStateDataset,
} from "./BrownBoxField";
import { BROWN_BOX_LOGICAL_SCREEN } from "./BrownBoxTheme";
import {
  DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME,
  type BrownBoxBackgroundProgramme,
  type BrownBoxBackgroundProgrammeTarget,
  type LoadedBrownBoxBackgroundProgramme,
} from "./backgrounds/BrownBoxBackgroundPrograms";

export interface BrownBoxViewportFieldAsset
  extends BrownBoxFieldStateProvenance {
  readonly url: string;
}

export interface BrownBoxViewportFieldLayout {
  readonly width: number;
  readonly height: number;
  readonly pixelScale: number;
  readonly tileWidth: number;
  readonly tileHeight: number;
  readonly originX: number;
  readonly originY: number;
}

export interface BrownBoxViewportFieldOptions {
  readonly surfaceClass?: string;
  readonly assembly?: string;
  readonly scaleMode?: "foreground-width" | "viewport-integer";
}

const QPIXL_PANEL_SIZE = 20;
const MAX_DISPLAY_PIXEL_SCALE = 6;
const QPIXL_PANEL_COLUMNS = BROWN_BOX_LOGICAL_SCREEN.width / QPIXL_PANEL_SIZE;
const QPIXL_PANEL_ROWS = BROWN_BOX_LOGICAL_SCREEN.height / QPIXL_PANEL_SIZE;

export function resolveBrownBoxDisplayPixelScale(
  width: number,
  height: number,
): number {
  const resolvedWidth = positiveInteger(width, "viewport width");
  const resolvedHeight = positiveInteger(height, "viewport height");
  return Math.max(
    1,
    Math.min(
      MAX_DISPLAY_PIXEL_SCALE,
      Math.floor(resolvedWidth / BROWN_BOX_LOGICAL_SCREEN.width),
      Math.floor(resolvedHeight / BROWN_BOX_LOGICAL_SCREEN.height),
    ),
  );
}

export function resolveBrownBoxViewportFieldLayout(
  width: number,
  height: number,
  foregroundWidth: number,
): BrownBoxViewportFieldLayout {
  const resolvedWidth = positiveInteger(width, "viewport width");
  const resolvedHeight = positiveInteger(height, "viewport height");
  const resolvedForegroundWidth = positiveInteger(
    foregroundWidth,
    "foreground width",
  );
  const pixelScale = Math.max(
    1,
    Math.round(resolvedForegroundWidth / BROWN_BOX_LOGICAL_SCREEN.width),
  );
  const tileWidth = BROWN_BOX_LOGICAL_SCREEN.width * pixelScale;
  const tileHeight = BROWN_BOX_LOGICAL_SCREEN.height * pixelScale;
  return Object.freeze({
    width: resolvedWidth,
    height: resolvedHeight,
    pixelScale,
    tileWidth,
    tileHeight,
    originX: Math.floor((resolvedWidth - tileWidth) / 2),
    originY: Math.floor((resolvedHeight - tileHeight) / 2),
  });
}

export function resolveBrownBoxViewportReplacementBoundary(
  viewportWidth: number,
  sourceBoundaryX: number,
): number {
  const width = positiveInteger(viewportWidth, "viewport width");
  if (!Number.isInteger(sourceBoundaryX)) {
    throw new Error("Brown Box source boundary must be an integer.");
  }
  const clampedBoundary = Math.min(
    BROWN_BOX_LOGICAL_SCREEN.width,
    Math.max(0, sourceBoundaryX),
  );
  return Math.round((clampedBoundary * width) / BROWN_BOX_LOGICAL_SCREEN.width);
}

/**
 * One presentation canvas spans the entire internal viewport. The selected
 * 320x180 programme endpoints remain byte-unaltered in the gameplay plane.
 * Outside it, exact 20x20 endpoint panels are stitched into a deterministic
 * local extension that preserves their integer pixel scale and provider-derived
 * pixels without pretending the expanded viewport is a provider return.
 */
export class BrownBoxViewportField
  implements BrownBoxBackgroundProgrammeTarget
{
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private endpoints: readonly HTMLImageElement[];
  private readonly resizeObserver: ResizeObserver;
  private programme: BrownBoxBackgroundProgramme =
    DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME;
  private programmeStartedAtMs = 0;
  private loadGeneration = 0;
  private ready = false;
  private reducedMotion: boolean;
  private animationFrameId = 0;
  private previousTick = -1;
  private previousWidth = 0;
  private previousHeight = 0;
  private previousForegroundWidth = 0;
  private readonly scaleMode: NonNullable<
    BrownBoxViewportFieldOptions["scaleMode"]
  >;
  private destroyed = false;

  public constructor(
    private readonly host: HTMLElement,
    private readonly foreground: HTMLElement,
    assets: readonly BrownBoxViewportFieldAsset[],
    reducedMotion: boolean,
    options: BrownBoxViewportFieldOptions = {},
  ) {
    validateAssets(assets, this.programme);
    this.reducedMotion = reducedMotion;
    this.canvas = document.createElement("canvas");
    this.canvas.className = options.surfaceClass ?? "qb-field-surface";
    this.canvas.dataset["fieldProgramme"] = this.programme.programmeId;
    this.canvas.dataset["fieldAssembly"] =
      options.assembly ?? "local-qpixl-panel-remix-v1";
    this.scaleMode = options.scaleMode ?? "foreground-width";
    this.canvas.setAttribute("aria-hidden", "true");
    const context = this.canvas.getContext("2d", { alpha: false });
    if (!context)
      throw new Error("Brown Box viewport field canvas is unavailable.");
    context.imageSmoothingEnabled = false;
    this.context = context;
    this.host.prepend(this.canvas);
    const endpoints = assets.map(({ url }) => createEndpointImage(url));
    this.endpoints = endpoints;
    const loadGeneration = ++this.loadGeneration;
    this.resizeObserver = new ResizeObserver(() => this.invalidate());
    this.resizeObserver.observe(this.host);
    this.resizeObserver.observe(this.foreground);
    void Promise.all(endpoints.map(waitForImage))
      .then(() => {
        if (this.destroyed || loadGeneration !== this.loadGeneration) return;
        this.ready = true;
        this.invalidate();
        this.startAnimation();
      })
      .catch((error: unknown) => {
        this.canvas.dataset["fieldError"] =
          error instanceof Error
            ? error.message
            : "Field endpoint failed to load.";
      });
  }

  public get programmeId(): BrownBoxBackgroundProgramme["programmeId"] {
    return this.programme.programmeId;
  }

  public setProgramme(
    loadedProgramme: LoadedBrownBoxBackgroundProgramme,
    startedAtMs: number,
  ): void {
    if (!Number.isFinite(startedAtMs)) {
      throw new Error("Brown Box background start time must be finite.");
    }
    validateLoadedProgramme(loadedProgramme);
    this.loadGeneration += 1;
    this.programme = loadedProgramme.programme;
    this.endpoints = loadedProgramme.images;
    this.programmeStartedAtMs = startedAtMs;
    this.ready = true;
    updateBrownBoxFieldStateDataset(
      this.canvas,
      this.programme,
      resolveBrownBoxFieldFrameAtEpoch(
        startedAtMs,
        startedAtMs,
        this.reducedMotion,
        this.programme,
      ),
      startedAtMs,
    );
    delete this.canvas.dataset["fieldError"];
    this.invalidate();
    this.startAnimation();
  }

  public setReducedMotion(reducedMotion: boolean): void {
    if (this.reducedMotion === reducedMotion) return;
    this.reducedMotion = reducedMotion;
    this.invalidate();
    if (reducedMotion) this.stopAnimation();
    else this.startAnimation();
  }

  public destroy(): void {
    this.destroyed = true;
    this.stopAnimation();
    this.resizeObserver.disconnect();
    this.canvas.remove();
  }

  private readonly animate = (time: number): void => {
    this.animationFrameId = 0;
    this.render(time);
    this.startAnimation();
  };

  private startAnimation(): void {
    if (
      this.destroyed ||
      !this.ready ||
      this.reducedMotion ||
      this.animationFrameId !== 0
    ) {
      return;
    }
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  private stopAnimation(): void {
    if (this.animationFrameId === 0) return;
    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;
  }

  private invalidate(): void {
    this.previousTick = -1;
    if (this.ready) this.render(this.reducedMotion ? 0 : performance.now());
  }

  private render(time: number): void {
    if (!this.ready || this.destroyed) return;
    const frame = resolveBrownBoxFieldFrameAtEpoch(
      time,
      this.programmeStartedAtMs,
      this.reducedMotion,
      this.programme,
    );
    updateBrownBoxFieldStateDataset(
      this.canvas,
      this.programme,
      frame,
      this.programmeStartedAtMs,
    );
    const hostRect = this.host.getBoundingClientRect();
    const foregroundRect = this.foreground.getBoundingClientRect();
    const width = Math.max(1, Math.round(hostRect.width));
    const height = Math.max(1, Math.round(hostRect.height));
    const foregroundWidth =
      this.scaleMode === "viewport-integer"
        ? BROWN_BOX_LOGICAL_SCREEN.width *
          resolveBrownBoxDisplayPixelScale(width, height)
        : Math.max(1, Math.round(foregroundRect.width));
    if (
      frame.loopTick === this.previousTick &&
      width === this.previousWidth &&
      height === this.previousHeight &&
      foregroundWidth === this.previousForegroundWidth
    ) {
      return;
    }
    this.previousTick = frame.loopTick;
    this.previousWidth = width;
    this.previousHeight = height;
    this.previousForegroundWidth = foregroundWidth;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.context.imageSmoothingEnabled = false;
    const layout = resolveBrownBoxViewportFieldLayout(
      width,
      height,
      foregroundWidth,
    );
    this.drawEndpoint(this.endpoints[frame.currentStateIndex]!, layout);
    const boundary = resolveBrownBoxViewportReplacementBoundary(
      width,
      frame.replacementBoundaryX,
    );
    if (boundary > 0) {
      this.context.save();
      this.context.beginPath();
      this.context.rect(0, 0, boundary, height);
      this.context.clip();
      this.drawEndpoint(this.endpoints[frame.followingStateIndex]!, layout);
      this.context.restore();
    }
    this.canvas.dataset["fieldBoundary"] = String(boundary);
    this.canvas.dataset["fieldPixelScale"] = String(layout.pixelScale);
  }

  private drawEndpoint(
    image: HTMLImageElement,
    layout: BrownBoxViewportFieldLayout,
  ): void {
    const panelSize = QPIXL_PANEL_SIZE * layout.pixelScale;
    const minColumn = Math.floor(-layout.originX / panelSize);
    const maxColumn =
      Math.ceil((layout.width - layout.originX) / panelSize) - 1;
    const minRow = Math.floor(-layout.originY / panelSize);
    const maxRow = Math.ceil((layout.height - layout.originY) / panelSize) - 1;
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        const source = resolveSourcePanel(column, row);
        this.context.drawImage(
          image,
          source.column * QPIXL_PANEL_SIZE,
          source.row * QPIXL_PANEL_SIZE,
          QPIXL_PANEL_SIZE,
          QPIXL_PANEL_SIZE,
          layout.originX + column * panelSize,
          layout.originY + row * panelSize,
          panelSize,
          panelSize,
        );
      }
    }
  }
}

function resolveSourcePanel(
  column: number,
  row: number,
): Readonly<{ column: number; row: number }> {
  if (
    column >= 0 &&
    column < QPIXL_PANEL_COLUMNS &&
    row >= 0 &&
    row < QPIXL_PANEL_ROWS
  ) {
    return Object.freeze({ column, row });
  }
  return Object.freeze({
    column: positiveModulo(column * 5 + row * 3 + 7, QPIXL_PANEL_COLUMNS),
    row: positiveModulo(row * 5 + column * 2 + 4, QPIXL_PANEL_ROWS),
  });
}

function createEndpointImage(url: string): HTMLImageElement {
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  return image;
}

function waitForImage(image: HTMLImageElement): Promise<HTMLImageElement> {
  if (image.complete && image.naturalWidth > 0) return Promise.resolve(image);
  return new Promise((resolve, reject) => {
    image.addEventListener("load", () => resolve(image), { once: true });
    image.addEventListener(
      "error",
      () =>
        reject(
          new Error(`Brown Box field endpoint failed to load: ${image.src}`),
        ),
      { once: true },
    );
  });
}

function validateAssets(
  assets: readonly BrownBoxViewportFieldAsset[],
  programme: BrownBoxBackgroundProgramme,
): void {
  if (assets.length !== programme.states.length) {
    throw new Error(
      "Brown Box viewport field requires every programme endpoint.",
    );
  }
  for (const [index, asset] of assets.entries()) {
    const expected = programme.states[index]!;
    if (
      asset.stateId !== expected.stateId ||
      asset.sha256 !== expected.sha256
    ) {
      throw new Error(
        "Brown Box viewport field endpoints are out of programme order.",
      );
    }
  }
}

function validateLoadedProgramme(
  loadedProgramme: LoadedBrownBoxBackgroundProgramme,
): void {
  const { programme, images } = loadedProgramme;
  if (images.length !== programme.states.length) {
    throw new Error(
      "Brown Box viewport field loaded endpoint count is inconsistent.",
    );
  }
  for (const image of images) {
    if (
      image.naturalWidth !== programme.width ||
      image.naturalHeight !== programme.height
    ) {
      throw new Error(
        "Brown Box viewport field loaded endpoint dimensions are inconsistent.",
      );
    }
  }
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Brown Box ${name} must be positive and finite.`);
  }
  return Math.max(1, Math.round(value));
}

function positiveModulo(value: number, modulus: number): number {
  return ((value % modulus) + modulus) % modulus;
}
