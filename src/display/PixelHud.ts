import type Phaser from "phaser";
import { BROWN_BOX_PALETTE } from "./BrownBoxTheme";
import { drawPixelText, pixelTextWidth } from "./PixelText";

export interface CenteredPixelPanelOptions {
  readonly centerX: number;
  readonly y: number;
  readonly pixel?: number;
  readonly paddingX?: number;
  readonly paddingY?: number;
  readonly border?: boolean;
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
    graphics
      .lineStyle(2, BROWN_BOX_PALETTE.cream, 1)
      .strokeRect(panelX, panelY, panelWidth, panelHeight);
  }
  drawPixelText(graphics, text, {
    x: options.centerX,
    y: options.y,
    pixel,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}
