import type Phaser from "phaser";
import { BROWN_BOX_PALETTE } from "./BrownBoxTheme";
import { drawPixelText, pixelTextWidth } from "./PixelText";
import { drawNativePixelLine } from "./NativePixelRaster";

export interface CenteredPixelPanelOptions {
  readonly centerX: number;
  readonly y: number;
  readonly pixel?: number;
  readonly paddingX?: number;
  readonly paddingY?: number;
  readonly border?: boolean;
}

export function drawCabinetPauseHeader(
  graphics: Phaser.GameObjects.Graphics,
  headerHeight = 24,
): void {
  const paddingY = Math.min(5, Math.floor((headerHeight - 14) / 2));
  drawCenteredPixelPanel(graphics, "PAUSED", {
    centerX: 160,
    y: 1 + paddingY,
    pixel: 2,
    paddingY,
    border: true,
  });
}

export function drawCenteredPixelPanel(
  graphics: Phaser.GameObjects.Graphics,
  text: string,
  options: CenteredPixelPanelOptions,
): void {
  if (text.length === 0) return;
  const pixel = options.pixel ?? 2;
  const paddingX = options.paddingX ?? 8;
  const paddingY = options.paddingY ?? 5;
  const textWidth = pixelTextWidth(text, pixel);
  const panelX = Math.round(options.centerX - textWidth / 2) - paddingX;
  const panelY = options.y - paddingY;
  const panelWidth = textWidth + paddingX * 2;
  const panelHeight = pixel * 5 + paddingY * 2;

  if (options.border) {
    const colour = BROWN_BOX_PALETTE.cream;
    drawNativePixelLine(
      graphics,
      { x: panelX, y: panelY },
      { x: panelX + panelWidth, y: panelY },
      { colour },
    );
    drawNativePixelLine(
      graphics,
      { x: panelX, y: panelY },
      { x: panelX, y: panelY + panelHeight },
      { colour },
    );
    drawNativePixelLine(
      graphics,
      { x: panelX + panelWidth, y: panelY },
      { x: panelX + panelWidth, y: panelY + panelHeight },
      { colour },
    );
    drawNativePixelLine(
      graphics,
      { x: panelX, y: panelY + panelHeight },
      { x: panelX + panelWidth, y: panelY + panelHeight },
      { colour },
    );
  }
  drawPixelText(graphics, text, {
    x: options.centerX,
    y: options.y,
    pixel,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}
