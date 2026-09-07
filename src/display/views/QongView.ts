import type Phaser from "phaser";
import { qongHudModel } from "../../games/qong/presentation";
import type { QongOpponent, QongSnapshot } from "../../games/qong/types";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import { drawCanonicalSprite } from "../CanonicalSpriteRaster";
import { drawCenteredPixelPanel } from "../PixelHud";
import { drawPixelText } from "../PixelText";
import { qongDisplayView } from "./CabinetDisplayViews";

export function renderQong(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: QongSnapshot,
  opponent: QongOpponent,
  paused: boolean,
  options: Readonly<{ hidePaddles?: boolean }> = {},
): void {
  const view = qongDisplayView(snapshot, paused);
  const g = graphics.clear();
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(18, 48, 604, 276);
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
  for (let y = 55; y < 321; y += 18) g.lineBetween(320, y, 320, y + 9);

  if (!options.hidePaddles) {
    drawCanonicalSprite(g, "qong-paddle", "paddle", {
      pixel: 2,
      centerX: 34,
      bottomY: view.leftPaddleY + 20,
    });
    drawCanonicalSprite(g, "qong-paddle", "paddle", {
      pixel: 2,
      centerX: 606,
      bottomY: view.rightPaddleY + 20,
    });
  }
  g.fillStyle(BROWN_BOX_PALETTE.cream).fillRect(
    view.ball.x - 5,
    view.ball.y - 5,
    10,
    10,
  );

  if (view.paused) {
    drawPause(g);
    return;
  }
  drawHud(g, snapshot, opponent);
}

function drawPause(g: Phaser.GameObjects.Graphics): void {
  drawCenteredPixelPanel(g, "PAUSED", {
    centerX: 320,
    y: 12,
    pixel: 4,
    border: true,
  });
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  snapshot: QongSnapshot,
  opponent: QongOpponent,
): void {
  const hud = qongHudModel(snapshot, opponent, false);
  g.lineStyle(1, BROWN_BOX_PALETTE.cream, 1).lineBetween(18, 45, 622, 45);
  drawPixelText(g, hud.leftLabel, {
    x: 22,
    y: 8,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
  });
  drawPixelText(g, hud.leftScore, {
    x: 22,
    y: 21,
    pixel: 4,
    colour: BROWN_BOX_PALETTE.cream,
  });
  drawPixelText(g, hud.rightLabel, {
    x: 618,
    y: 8,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "right",
  });
  drawPixelText(g, hud.rightScore, {
    x: 618,
    y: 21,
    pixel: 4,
    colour: BROWN_BOX_PALETTE.cream,
    align: "right",
  });
  g.lineStyle(1, BROWN_BOX_PALETTE.mutedTan, 1);
  for (const x of [155, 305, 445]) g.lineBetween(x, 4, x, 40);
  drawHudSection(g, "ROUND:", hud.round, 110);
  drawHudSection(g, "RULE STATE:", hud.ruleState, 230);
  drawHudSection(g, "GOAL:", hud.goal, 375);
  drawHudSection(g, "WINNER:", hud.winner, 510);
}

function drawHudSection(
  g: Phaser.GameObjects.Graphics,
  label: string,
  text: string,
  centerX: number,
): void {
  drawPixelText(g, label, {
    x: centerX,
    y: 3,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, text.slice(text.indexOf(":") + 2), {
    x: centerX,
    y: 20,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}
