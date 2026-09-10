import type Phaser from "phaser";
import { qongHudModel } from "../../games/qong/presentation";
import type { QongOpponent, QongSnapshot } from "../../games/qong/types";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import { drawCanonicalSprite } from "../CanonicalSpriteRaster";
import { drawCabinetPauseHeader } from "../PixelHud";
import { drawPixelText, drawRefinedHudText } from "../PixelText";
import {
  drawNativePixelLine,
  drawNativePixelRect,
  snapNativePixel,
} from "../NativePixelRaster";
import { qongDisplayView } from "./CabinetDisplayViews";

export function renderQong(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: QongSnapshot,
  opponent: QongOpponent,
  paused: boolean,
  options: Readonly<{
    hidePaddles?: boolean;
    refinedHudPreview?: boolean;
  }> = {},
): void {
  const view = qongDisplayView(snapshot, paused);
  const g = graphics.clear();
  drawFrame(
    g,
    9,
    options.refinedHudPreview ? 32 : 24,
    302,
    options.refinedHudPreview ? 130 : 138,
  );
  for (let y = options.refinedHudPreview ? 36 : 28; y < 161; y += 9) {
    drawNativePixelLine(
      g,
      { x: 160, y },
      { x: 160, y: y + 4 },
      {
        colour: BROWN_BOX_PALETTE.cream,
      },
    );
  }

  if (!options.hidePaddles) {
    drawCanonicalSprite(g, "qong-paddle", "paddle", {
      pixel: 1,
      centerX: 17,
      bottomY: snapNativePixel(view.leftPaddleY / 2 + 10),
    });
    drawCanonicalSprite(g, "qong-paddle", "paddle", {
      pixel: 1,
      centerX: 303,
      bottomY: snapNativePixel(view.rightPaddleY / 2 + 10),
    });
  }
  drawNativePixelRect(
    g,
    snapNativePixel(view.ball.x / 2) - 2,
    snapNativePixel(view.ball.y / 2) - 2,
    5,
    5,
    BROWN_BOX_PALETTE.cream,
  );

  if (view.paused) {
    drawCabinetPauseHeader(g);
    return;
  }
  drawHud(g, snapshot, opponent, options.refinedHudPreview ?? false);
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  snapshot: QongSnapshot,
  opponent: QongOpponent,
  refined = false,
): void {
  const drawText = refined ? drawRefinedHudText : drawPixelText;
  const hud = qongHudModel(snapshot, opponent, false);
  drawNativePixelLine(
    g,
    { x: 9, y: refined ? 30 : 22 },
    { x: 311, y: refined ? 30 : 22 },
    {
      colour: BROWN_BOX_PALETTE.cream,
    },
  );
  drawText(g, hud.leftLabel, {
    x: 11,
    y: 4,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
  });
  drawText(g, hud.leftScore, {
    x: 11,
    y: refined ? 14 : 11,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
  });
  drawText(g, hud.rightLabel, {
    x: 309,
    y: 4,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "right",
  });
  drawText(g, hud.rightScore, {
    x: 309,
    y: refined ? 14 : 11,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "right",
  });
  for (const x of [78, 153, 223]) {
    drawNativePixelLine(
      g,
      { x, y: 2 },
      { x, y: refined ? 28 : 20 },
      {
        colour: BROWN_BOX_PALETTE.mutedTan,
      },
    );
  }
  drawHudSection(g, "ROUND:", hud.round, 55, refined);
  drawHudSection(g, "RULE STATE:", hud.ruleState, 115, refined);
  drawHudSection(g, "GOAL:", hud.goal, 188, refined);
  drawHudSection(g, "WINNER:", hud.winner, 255, refined);
}

function drawHudSection(
  g: Phaser.GameObjects.Graphics,
  label: string,
  text: string,
  centerX: number,
  refined: boolean,
): void {
  const drawText = refined ? drawRefinedHudText : drawPixelText;
  drawText(g, label, {
    x: centerX,
    y: 2,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawText(g, text.slice(text.indexOf(":") + 2), {
    x: centerX,
    y: refined ? 16 : 10,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}

function drawFrame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const colour = BROWN_BOX_PALETTE.cream;
  drawNativePixelLine(g, { x, y }, { x: x + width, y }, { colour });
  drawNativePixelLine(g, { x, y }, { x, y: y + height }, { colour });
  drawNativePixelLine(
    g,
    { x: x + width, y },
    { x: x + width, y: y + height },
    { colour },
  );
  drawNativePixelLine(
    g,
    { x, y: y + height },
    { x: x + width, y: y + height },
    { colour },
  );
}
