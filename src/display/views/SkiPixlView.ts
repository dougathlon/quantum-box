import Phaser from "phaser";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import type {
  SkiPixlObstacle,
  SkiPixlPackPayload,
  SkiPixlSnapshot,
} from "../../games/skipixl/types";
import {
  SKIPIXL_PLAYER_Y,
  SKIPIXL_WORLD_SCALE,
  skiPixlDisplayView,
} from "./CabinetDisplayViews";
import { drawPixelSprite, type PixelSprite } from "../PixelSprites";
import {
  CANONICAL_SPRITE_PIXEL_SCALE,
  drawCanonicalSprite,
} from "../CanonicalSpriteRaster";
import { drawPixelText, pixelTextWidth } from "../PixelText";
import {
  formatSkiPixlTime,
  skiPixlCanvasPrompt,
  skiPixlDistanceLabel,
} from "../../games/skipixl/presentation";

const TREE_SPRITE = Object.freeze([
  "......C......",
  ".....CCC.....",
  "....CCCCC....",
  "......C......",
  "...CCCCCCC...",
  "..CCCCCCCCC..",
  "......C......",
  ".CCCCCCCCCCC.",
  "CCCCCCCCCCCCC",
  ".....CCC.....",
  ".....CCC.....",
  ".....CCC.....",
  "....CCCCC....",
]) satisfies PixelSprite;
const MOGUL_SPRITE = Object.freeze([
  ".......CC...",
  "...CC.CCCC..",
  "..CCCC...CC.",
  ".CC.......CC",
  "CCCCCCCCCCCC",
]) satisfies PixelSprite;

/**
 * SkiPixl keeps the Atari downhill camera convention: the skier remains near
 * the top of the field, faces the bottom of the screen, and upcoming terrain
 * enters below them before scrolling upward. The QPixl decoder remains the
 * sole authority for obstacle kind and horizontal placement.
 */
export function renderSkiPixl(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: SkiPixlSnapshot,
  payload: SkiPixlPackPayload,
  paused: boolean,
  options: Readonly<{ hideCompletionPrompt?: boolean }> = {},
): void {
  const view = skiPixlDisplayView(snapshot, payload, paused);
  const g = graphics.clear();

  for (const cue of view.groundCues) {
    drawGroundCue(g, cue.x, Math.round(cue.screenY), cue.length);
  }

  for (const { gate, screenY } of view.visibleGates) {
    drawGate(g, gate.leftX, gate.rightX, Math.round(screenY));
  }

  for (const { obstacle, screenY } of view.visibleObstacles) {
    drawObstacle(g, obstacle, Math.round(screenY));
  }

  if (view.finishY >= 10 && view.finishY <= 350) {
    drawFinish(g, Math.round(view.finishY));
  }

  drawSpeedSpray(g, snapshot);
  drawSkier(g, snapshot);

  drawHud(g, snapshot, payload, paused, options.hideCompletionPrompt === true);
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  snapshot: SkiPixlSnapshot,
  payload: SkiPixlPackPayload,
  paused: boolean,
  hideCompletionPrompt: boolean,
): void {
  g.lineStyle(1, BROWN_BOX_PALETTE.cream, 1).lineBetween(264, 49, 376, 49);
  drawPixelText(g, skiPixlDistanceLabel(snapshot), {
    x: 320,
    y: 11,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, formatSkiPixlTime(snapshot.elapsedSeconds), {
    x: 320,
    y: 25,
    pixel: 4,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, `LIMIT ${snapshot.targetSeconds}`, {
    x: 407,
    y: 27,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "left",
  });
  drawPixelText(g, difficultyLabel(payload), {
    x: 96,
    y: 17,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "left",
  });
  const gateCount = payload.gates?.length ?? 0;
  if (gateCount > 0) {
    const passedGateCount = snapshot.gateResults.filter(
      ({ passed }) => passed,
    ).length;
    drawPixelText(g, `GATES ${passedGateCount}/${gateCount}`, {
      x: 96,
      y: 31,
      pixel: 2,
      colour: BROWN_BOX_PALETTE.cream,
      align: "left",
    });
  }
  if (snapshot.latestGate) {
    drawPixelText(
      g,
      snapshot.latestGate.passed ? "GATE CLEAR" : "GATE MISSED +2.5",
      {
        x: 320,
        y: 55,
        pixel: 2,
        colour: BROWN_BOX_PALETTE.cream,
        align: "center",
      },
    );
  }

  const prompt = hideCompletionPrompt
    ? ""
    : skiPixlCanvasPrompt(snapshot, paused);
  if (prompt.length === 0) return;
  const promptWidth = pixelTextWidth(prompt, 4);
  const promptTop = paused ? 58 : 168;
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(
    Math.round(320 - promptWidth / 2) - 10,
    promptTop,
    promptWidth + 20,
    36,
  );
  drawPixelText(g, prompt, {
    x: 320,
    y: promptTop + 8,
    pixel: 4,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}

function difficultyLabel(payload: SkiPixlPackPayload): string {
  switch (payload.difficulty) {
    case "easy":
      return "EASY DOWNHILL";
    case "medium":
      return "MEDIUM SLALOM";
    case "hard":
      return "HARD SLALOM";
    default:
      return "DOWNHILL";
  }
}

function drawGroundCue(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  length: number,
): void {
  g.fillStyle(BROWN_BOX_PALETTE.tobacco, 1).fillRect(
    Math.round(x),
    y,
    1,
    Math.max(2, Math.round(length * SKIPIXL_WORLD_SCALE)),
  );
}

function drawGate(
  g: Phaser.GameObjects.Graphics,
  leftX: number,
  rightX: number,
  y: number,
): void {
  const poleTop = y - 22;
  g.fillStyle(BROWN_BOX_PALETTE.cream, 1)
    .fillRect(Math.round(leftX) - 1, poleTop, 3, 24)
    .fillRect(Math.round(rightX) - 1, poleTop, 3, 24)
    .fillRect(Math.round(leftX) + 2, poleTop + 2, 10, 7)
    .fillRect(Math.round(rightX) - 11, poleTop + 2, 10, 7);
  g.fillStyle(BROWN_BOX_PALETTE.darkTobacco, 1)
    .fillRect(Math.round(leftX) + 4, poleTop + 4, 6, 3)
    .fillRect(Math.round(rightX) - 9, poleTop + 4, 6, 3);
}

function drawSpeedSpray(
  g: Phaser.GameObjects.Graphics,
  snapshot: SkiPixlSnapshot,
): void {
  if (snapshot.phase !== "active" || snapshot.knockdownTicksRemaining > 0)
    return;
  const cadence = snapshot.tick % 6;
  const spread = 7 + Math.abs(snapshot.steeringAngle) * 2;
  const tail = 8 + Math.round((snapshot.speed - 56) * 0.25);
  g.fillStyle(BROWN_BOX_PALETTE.cream, 1)
    .fillRect(
      Math.round(snapshot.skierX - spread),
      SKIPIXL_PLAYER_Y + 3 + cadence,
      2,
      2,
    )
    .fillRect(
      Math.round(snapshot.skierX + spread),
      SKIPIXL_PLAYER_Y + 6 - cadence,
      2,
      2,
    )
    .fillRect(Math.round(snapshot.skierX - 2), SKIPIXL_PLAYER_Y + tail, 4, 2);
}

function drawFinish(g: Phaser.GameObjects.Graphics, y: number): void {
  for (let x = 96; x < 544; x += 16) {
    if ((x / 16) % 2 === 0) {
      g.fillStyle(BROWN_BOX_PALETTE.cream).fillRect(x, y, 16, 6);
    } else {
      g.fillStyle(BROWN_BOX_PALETTE.cream).fillRect(x, y + 6, 16, 6);
    }
  }
}

function drawObstacle(
  g: Phaser.GameObjects.Graphics,
  obstacle: SkiPixlObstacle,
  y: number,
): void {
  drawOutlinedSprite(
    g,
    obstacle.kind === "tree" ? TREE_SPRITE : MOGUL_SPRITE,
    obstacle.x,
    y + (obstacle.kind === "tree" ? 13 : 5),
  );
}

function drawSkier(
  g: Phaser.GameObjects.Graphics,
  snapshot: SkiPixlSnapshot,
): void {
  if (snapshot.knockdownTicksRemaining > 0) {
    drawOutlinedCanonicalSprite(
      g,
      "skipixl-approved-five-state-strip",
      snapshot.knockdownTicksRemaining <= 12 ? "recovery" : "fall",
      snapshot.skierX,
      SKIPIXL_PLAYER_Y,
      CANONICAL_SPRITE_PIXEL_SCALE,
    );
    return;
  }

  drawOutlinedCanonicalSprite(
    g,
    "skipixl-steering-seven-angle-strip",
    skiPixlFrameForAngle(snapshot.steeringAngle),
    snapshot.skierX,
    SKIPIXL_PLAYER_Y,
    CANONICAL_SPRITE_PIXEL_SCALE,
  );
}

export function skiPixlFrameForAngle(
  angle: SkiPixlSnapshot["steeringAngle"],
): string {
  switch (angle) {
    case -3:
      return "hard-left";
    case -2:
      return "mid-left";
    case -1:
      return "soft-left";
    case 0:
      return "neutral";
    case 1:
      return "soft-right";
    case 2:
      return "mid-right";
    case 3:
      return "hard-right";
  }
}

function drawOutlinedCanonicalSprite(
  g: Phaser.GameObjects.Graphics,
  fileId: string,
  frameId: string,
  centerX: number,
  bottomY: number,
  pixel = CANONICAL_SPRITE_PIXEL_SCALE,
): void {
  const outline = BROWN_BOX_PALETTE.darkTobacco;
  const offsets = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ] as const;
  for (const [offsetX, offsetY] of offsets) {
    drawCanonicalSprite(g, fileId, frameId, {
      pixel,
      centerX: centerX + offsetX,
      bottomY: bottomY + offsetY,
      cream: outline,
      tan: outline,
      dark: outline,
    });
  }
  drawCanonicalSprite(g, fileId, frameId, { pixel, centerX, bottomY });
}

function drawOutlinedSprite(
  g: Phaser.GameObjects.Graphics,
  pattern: PixelSprite,
  centerX: number,
  bottomY: number,
  pixel = 2,
): void {
  const outline = BROWN_BOX_PALETTE.darkTobacco;
  const offsets = [
    [-2, 0],
    [2, 0],
    [0, -2],
    [0, 2],
  ] as const;
  for (const [offsetX, offsetY] of offsets) {
    drawPixelSprite(g, pattern, {
      pixel,
      centerX: centerX + offsetX,
      bottomY: bottomY + offsetY,
      cream: outline,
      tan: outline,
      dark: outline,
    });
  }
  drawPixelSprite(g, pattern, {
    pixel,
    centerX,
    bottomY,
  });
}
