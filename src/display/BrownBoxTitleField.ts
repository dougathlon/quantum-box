import type {
  BrownBoxBackgroundProgramme,
  BrownBoxBackgroundProgrammeTarget,
  LoadedBrownBoxBackgroundProgramme,
} from "./backgrounds/BrownBoxBackgroundPrograms";
import {
  BrownBoxViewportField,
  resolveBrownBoxDisplayPixelScale,
  resolveBrownBoxViewportFieldLayout,
  type BrownBoxViewportFieldAsset,
} from "./BrownBoxViewportField";
import { BROWN_BOX_LOGICAL_SCREEN } from "./BrownBoxTheme";
import { drawTitleLettering, TITLE_LETTERING_CONTRACT } from "./TitleLettering";

/**
 * The opening is the same selected Brown Box programme as the internal screen.
 * A transparent native surface carries QUANTUM BOX and PRESS START so no
 * independently scaled foreground lettering enters the game.
 */
export class BrownBoxTitleField implements BrownBoxBackgroundProgrammeTarget {
  private readonly field: BrownBoxViewportField;
  private readonly prompt: HTMLCanvasElement;
  private readonly context: CanvasRenderingContext2D;
  private readonly resizeObserver: ResizeObserver;
  private destroyed = false;

  public constructor(
    private readonly host: HTMLElement,
    assets: readonly BrownBoxViewportFieldAsset[],
    reducedMotion: boolean,
  ) {
    this.field = new BrownBoxViewportField(host, host, assets, reducedMotion, {
      surfaceClass: "qb-title-field-surface",
      assembly: "native-320x180-title-field-v2",
      scaleMode: "viewport-integer",
    });
    this.prompt = document.createElement("canvas");
    this.prompt.className = "qb-title-prompt-surface";
    this.prompt.dataset["titleLettering"] = TITLE_LETTERING_CONTRACT.raster;
    this.prompt.setAttribute("aria-hidden", "true");
    const context = this.prompt.getContext("2d", { alpha: true });
    if (!context)
      throw new Error("Brown Box title prompt canvas is unavailable.");
    context.imageSmoothingEnabled = false;
    this.context = context;
    this.host.append(this.prompt);
    this.resizeObserver = new ResizeObserver(() => this.renderPrompt());
    this.resizeObserver.observe(this.host);
    this.renderPrompt();
  }

  public get programmeId(): BrownBoxBackgroundProgramme["programmeId"] {
    return this.field.programmeId;
  }

  public setProgramme(
    loadedProgramme: LoadedBrownBoxBackgroundProgramme,
    startedAtMs: number,
  ): void {
    this.field.setProgramme(loadedProgramme, startedAtMs);
  }

  public setReducedMotion(reducedMotion: boolean): void {
    this.field.setReducedMotion(reducedMotion);
  }

  public destroy(): void {
    this.destroyed = true;
    this.resizeObserver.disconnect();
    this.field.destroy();
    this.prompt.remove();
  }

  private renderPrompt(): void {
    if (this.destroyed) return;
    const width = Math.round(this.host.clientWidth);
    const height = Math.round(this.host.clientHeight);
    if (width <= 0 || height <= 0) return;
    const foregroundWidth =
      BROWN_BOX_LOGICAL_SCREEN.width *
      resolveBrownBoxDisplayPixelScale(width, height);
    const layout = resolveBrownBoxViewportFieldLayout(
      width,
      height,
      foregroundWidth,
    );
    if (this.prompt.width !== width) this.prompt.width = width;
    if (this.prompt.height !== height) this.prompt.height = height;
    this.context.imageSmoothingEnabled = false;
    this.context.clearRect(0, 0, width, height);
    drawTitleLettering(
      this.context,
      layout.originX,
      layout.originY,
      layout.pixelScale,
    );
    this.prompt.dataset["fieldPixelScale"] = String(layout.pixelScale);
  }
}
