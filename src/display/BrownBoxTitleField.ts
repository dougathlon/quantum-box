import {
  resolveBrownBoxFieldFrameAtEpoch,
  updateBrownBoxFieldStateDataset,
} from "./BrownBoxField";
import { BROWN_BOX_LOGICAL_SCREEN } from "./BrownBoxTheme";
import {
  DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME,
  type BrownBoxBackgroundProgramme,
  type BrownBoxBackgroundProgrammeTarget,
  type LoadedBrownBoxBackgroundProgramme,
} from "./backgrounds/BrownBoxBackgroundPrograms";
import {
  resolveBrownBoxViewportFieldLayout,
  type BrownBoxViewportFieldAsset,
} from "./BrownBoxViewportField";
import { drawTitleLettering, TITLE_LETTERING_CONTRACT } from "./TitleLettering";

export interface BrownBoxTitleScreenBounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface BrownBoxTitleFieldLayout {
  readonly width: number;
  readonly height: number;
  readonly pixelScale: number;
  readonly assetX: number;
  readonly assetY: number;
  readonly assetWidth: number;
  readonly assetHeight: number;
  readonly fieldX: number;
  readonly fieldY: number;
  readonly fieldWidth: number;
  readonly fieldHeight: number;
  readonly screen: BrownBoxTitleScreenBounds;
}

export function resolveBrownBoxTitleFieldLayout(
  width: number,
  height: number,
  foregroundWidth: number,
  maskWidth: number,
  maskHeight: number,
  maskBounds: BrownBoxTitleScreenBounds,
): BrownBoxTitleFieldLayout {
  const viewport = resolveBrownBoxViewportFieldLayout(
    width,
    height,
    foregroundWidth,
  );
  if (maskWidth <= 0 || maskHeight <= 0) {
    throw new Error("Brown Box title mask dimensions must be positive.");
  }
  const assetScale = Math.min(width / maskWidth, height / maskHeight);
  const assetWidth = maskWidth * assetScale;
  const assetHeight = maskHeight * assetScale;
  const assetX = (width - assetWidth) / 2;
  const assetY = (height - assetHeight) / 2;
  const screen = Object.freeze({
    x: assetX + maskBounds.x * assetScale,
    y: assetY + maskBounds.y * assetScale,
    width: maskBounds.width * assetScale,
    height: maskBounds.height * assetScale,
  });
  const fieldWidth = BROWN_BOX_LOGICAL_SCREEN.width * viewport.pixelScale;
  const fieldHeight = BROWN_BOX_LOGICAL_SCREEN.height * viewport.pixelScale;
  return Object.freeze({
    width: viewport.width,
    height: viewport.height,
    pixelScale: viewport.pixelScale,
    assetX,
    assetY,
    assetWidth,
    assetHeight,
    fieldX: Math.round(screen.x + (screen.width - fieldWidth) / 2),
    fieldY: Math.round(screen.y + (screen.height - fieldHeight) / 2),
    fieldWidth,
    fieldHeight,
    screen,
  });
}

export function resolveBrownBoxTitleFieldBoundary(
  pixelScale: number,
  sourceBoundaryX: number,
): number {
  if (!Number.isInteger(pixelScale) || pixelScale <= 0) {
    throw new Error("Brown Box title pixel scale must be a positive integer.");
  }
  if (!Number.isInteger(sourceBoundaryX)) {
    throw new Error("Brown Box title source boundary must be an integer.");
  }
  const clampedBoundary = Math.min(
    BROWN_BOX_LOGICAL_SCREEN.width,
    Math.max(0, sourceBoundaryX),
  );
  return clampedBoundary * pixelScale;
}

/**
 * Maps the selected native 320x180 programme and its hard replacement schedule
 * into the photographed CRT mask. The mask changes presentation geometry only;
 * it does not alter field pixels, state order, timing, or provenance.
 */
export class BrownBoxTitleField implements BrownBoxBackgroundProgrammeTarget {
  private readonly canvas: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private endpoints: readonly HTMLImageElement[];
  private readonly mask: HTMLImageElement;
  private readonly resizeObserver: ResizeObserver;
  private programme: BrownBoxBackgroundProgramme =
    DEFAULT_BROWN_BOX_BACKGROUND_PROGRAMME;
  private programmeStartedAtMs = 0;
  private loadGeneration = 0;
  private maskBounds: BrownBoxTitleScreenBounds | null = null;
  private endpointsReady = false;
  private ready = false;
  private reducedMotion: boolean;
  private animationFrameId = 0;
  private previousTick = -1;
  private previousWidth = 0;
  private previousHeight = 0;
  private previousForegroundWidth = 0;
  private destroyed = false;

  public constructor(
    private readonly host: HTMLElement,
    private readonly foreground: HTMLElement,
    screenMaskUrl: string,
    assets: readonly BrownBoxViewportFieldAsset[],
    reducedMotion: boolean,
  ) {
    validateAssets(assets, this.programme);
    this.reducedMotion = reducedMotion;
    this.canvas = document.createElement("canvas");
    this.canvas.className = "qb-title-field-surface";
    this.canvas.dataset["fieldProgramme"] = this.programme.programmeId;
    this.canvas.dataset["fieldAssembly"] = "native-320x180-title-mask-v1";
    this.canvas.setAttribute("aria-hidden", "true");
    const context = this.canvas.getContext("2d", { alpha: true });
    if (!context)
      throw new Error("Brown Box title field canvas is unavailable.");
    context.imageSmoothingEnabled = false;
    this.context = context;
    const copyLayer = host.querySelector(".qb-title-layer--copy");
    host.insertBefore(this.canvas, copyLayer);

    const endpoints = assets.map(({ url }) => createImage(url));
    this.endpoints = endpoints;
    this.mask = createImage(screenMaskUrl);
    const loadGeneration = ++this.loadGeneration;
    this.resizeObserver = new ResizeObserver(() => this.invalidate());
    this.resizeObserver.observe(this.host);
    this.resizeObserver.observe(this.foreground);
    void waitForImage(this.mask)
      .then(() => {
        if (this.destroyed) return;
        this.maskBounds = resolveOpaqueBounds(this.mask);
        this.updateReadyState();
      })
      .catch((error: unknown) => {
        this.canvas.dataset["fieldError"] =
          error instanceof Error
            ? error.message
            : "Title field endpoint failed to load.";
      });
    void Promise.all(endpoints.map(waitForImage))
      .then(() => {
        if (this.destroyed || loadGeneration !== this.loadGeneration) return;
        this.endpointsReady = true;
        this.updateReadyState();
      })
      .catch((error: unknown) => {
        this.canvas.dataset["fieldError"] =
          error instanceof Error
            ? error.message
            : "Title field endpoint failed to load.";
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
    this.endpointsReady = true;
    this.ready = this.maskBounds !== null;
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

  private updateReadyState(): void {
    this.ready = this.endpointsReady && this.maskBounds !== null;
    if (!this.ready) return;
    this.invalidate();
    this.startAnimation();
  }

  public setReducedMotion(reducedMotion: boolean): void {
    if (this.reducedMotion === reducedMotion) return;
    this.reducedMotion = reducedMotion;
    if (reducedMotion) {
      this.stopAnimation();
      this.invalidate();
    } else {
      this.invalidate();
      this.startAnimation();
    }
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
    if (!this.ready || this.destroyed || this.maskBounds === null) return;
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
    // Layout dimensions stay fixed while the photographed title is transformed.
    // Reading its transformed rect here would resize and then transform the
    // canvas, making the field scale independently from the other title layers.
    const width = Math.round(this.host.clientWidth);
    const height = Math.round(this.host.clientHeight);
    if (width <= 0 || height <= 0) return;
    const computedForegroundWidth = Number.parseFloat(
      getComputedStyle(this.foreground).width,
    );
    const foregroundWidth = Math.max(1, Math.round(computedForegroundWidth));
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
    const layout = resolveBrownBoxTitleFieldLayout(
      width,
      height,
      foregroundWidth,
      this.mask.naturalWidth,
      this.mask.naturalHeight,
      this.maskBounds,
    );
    const boundaryWidth = resolveBrownBoxTitleFieldBoundary(
      layout.pixelScale,
      frame.replacementBoundaryX,
    );

    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.globalCompositeOperation = "source-over";
    this.context.imageSmoothingEnabled = false;
    this.drawEndpoint(this.endpoints[frame.currentStateIndex]!, layout);
    if (boundaryWidth > 0) {
      this.context.save();
      this.context.beginPath();
      this.context.rect(
        layout.fieldX,
        layout.fieldY,
        boundaryWidth,
        layout.fieldHeight,
      );
      this.context.clip();
      this.drawEndpoint(this.endpoints[frame.followingStateIndex]!, layout);
      this.context.restore();
    }
    this.context.globalCompositeOperation = "destination-in";
    this.context.drawImage(
      this.mask,
      layout.assetX,
      layout.assetY,
      layout.assetWidth,
      layout.assetHeight,
    );
    this.context.globalCompositeOperation = "source-over";

    drawTitleLettering(
      this.context,
      layout.assetX,
      layout.assetY,
      layout.assetWidth / TITLE_LETTERING_CONTRACT.viewBox.width,
    );

    this.canvas.dataset["fieldBoundary"] = String(boundaryWidth);
    this.canvas.dataset["fieldPixelScale"] = String(layout.pixelScale);
    this.canvas.dataset["titleLettering"] = TITLE_LETTERING_CONTRACT.raster;
  }

  private drawEndpoint(
    image: HTMLImageElement,
    layout: BrownBoxTitleFieldLayout,
  ): void {
    this.context.drawImage(
      image,
      0,
      0,
      BROWN_BOX_LOGICAL_SCREEN.width,
      BROWN_BOX_LOGICAL_SCREEN.height,
      layout.fieldX,
      layout.fieldY,
      layout.fieldWidth,
      layout.fieldHeight,
    );
  }
}

function resolveOpaqueBounds(
  mask: HTMLImageElement,
): BrownBoxTitleScreenBounds {
  const probe = document.createElement("canvas");
  probe.width = mask.naturalWidth;
  probe.height = mask.naturalHeight;
  const context = probe.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Brown Box title mask probe is unavailable.");
  context.drawImage(mask, 0, 0);
  const pixels = context.getImageData(0, 0, probe.width, probe.height).data;
  let minX = probe.width;
  let minY = probe.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < probe.height; y += 1) {
    for (let x = 0; x < probe.width; x += 1) {
      const alpha = pixels[(y * probe.width + x) * 4 + 3]!;
      if (alpha === 0) continue;
      if (alpha !== 255) {
        throw new Error("Brown Box title mask alpha must remain binary.");
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < minX || maxY < minY) {
    throw new Error("Brown Box title mask is empty.");
  }
  return Object.freeze({
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  });
}

function createImage(url: string): HTMLImageElement {
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
          new Error(`Brown Box title field asset failed to load: ${image.src}`),
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
    throw new Error("Brown Box title field requires every programme endpoint.");
  }
  for (const [index, asset] of assets.entries()) {
    const expected = programme.states[index]!;
    if (
      asset.stateId !== expected.stateId ||
      asset.sha256 !== expected.sha256
    ) {
      throw new Error(
        "Brown Box title field endpoints are out of programme order.",
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
      "Brown Box title field loaded endpoint count is inconsistent.",
    );
  }
  for (const image of images) {
    if (
      image.naturalWidth !== programme.width ||
      image.naturalHeight !== programme.height
    ) {
      throw new Error(
        "Brown Box title field loaded endpoint dimensions are inconsistent.",
      );
    }
  }
}
