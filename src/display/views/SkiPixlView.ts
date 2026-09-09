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
import { drawCabinetPauseHeader } from "../PixelHud";
import {
  formatSkiPixlTime,
  skiPixlCanvasPrompt,
  skiPixlDistanceLabel,
} from "../../games/skipixl/presentation";
import {
  drawNativePixelLine,
  drawNativePixelRect,
  snapNativePixel,
} from "../NativePixelRaster";

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

  if (view.finishY >= 5 && view.finishY <= 175) {
    drawFinish(g, Math.round(view.finishY));
  }

  drawSpeedTrails(g, snapshot);
  drawSkier(g, snapshot);

  if (paused) {
    drawCabinetPauseHeader(g);
    return;
  }
  drawHud(g, snapshot, payload, options.hideCompletionPrompt === true);
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  snapshot: SkiPixlSnapshot,
  payload: SkiPixlPackPayload,
  hideCompletionPrompt: boolean,
): void {
  drawNativePixelLine(
    g,
    { x: 132, y: 24 },
    { x: 188, y: 24 },
    {
      colour: BROWN_BOX_PALETTE.cream,
    },
  );
  drawPixelText(g, skiPixlDistanceLabel(snapshot), {
    x: 160,
    y: 6,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, formatSkiPixlTime(snapshot.elapsedSeconds), {
    x: 160,
    y: 13,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, `LIMIT ${snapshot.targetSeconds}`, {
    x: 204,
    y: 14,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "left",
  });
  drawPixelText(g, difficultyLabel(payload), {
    x: 48,
    y: 9,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "left",
  });
  const gateCount = payload.gates?.length ?? 0;
  if (gateCount > 0) {
    const passedGateCount = snapshot.gateResults.filter(
      ({ passed }) => passed,
    ).length;
    drawPixelText(g, `GATES ${passedGateCount}/${gateCount}`, {
      x: 48,
      y: 16,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "left",
    });
  }
  if (snapshot.latestGate) {
    drawPixelText(
      g,
      snapshot.latestGate.passed ? "GATE CLEAR" : "GATE MISSED +2.5",
      {
        x: 160,
        y: 28,
        pixel: 1,
        colour: BROWN_BOX_PALETTE.cream,
        align: "center",
      },
    );
  }

  const prompt = hideCompletionPrompt
    ? ""
    : skiPixlCanvasPrompt(snapshot, false);
  if (prompt.length === 0) return;
  const promptWidth = pixelTextWidth(prompt, 2);
  const promptTop = 84;
  drawPanelFrame(
    g,
    Math.round(160 - promptWidth / 2) - 5,
    promptTop,
    promptWidth + 10,
    18,
  );
  drawPixelText(g, prompt, {
    x: 160,
    y: promptTop + 4,
    pixel: 2,
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
  drawNativePixelRect(
    g,
    snapNativePixel(x / 2),
    y,
    1,
    Math.max(2, Math.round(length * SKIPIXL_WORLD_SCALE)),
    BROWN_BOX_PALETTE.tobacco,
  );
}

function drawGate(
  g: Phaser.GameObjects.Graphics,
  leftX: number,
  rightX: number,
  y: number,
): void {
  const left = snapNativePixel(leftX / 2);
  const right = snapNativePixel(rightX / 2);
  const poleTop = y - 11;
  drawNativePixelRect(g, left - 1, poleTop, 2, 12, BROWN_BOX_PALETTE.cream);
  drawNativePixelRect(g, right - 1, poleTop, 2, 12, BROWN_BOX_PALETTE.cream);
  drawNativePixelRect(g, left + 1, poleTop + 1, 5, 4, BROWN_BOX_PALETTE.cream);
  drawNativePixelRect(g, right - 5, poleTop + 1, 5, 4, BROWN_BOX_PALETTE.cream);
  drawNativePixelRect(
    g,
    left + 2,
    poleTop + 2,
    3,
    2,
    BROWN_BOX_PALETTE.darkTobacco,
  );
  drawNativePixelRect(
    g,
    right - 4,
    poleTop + 2,
    3,
    2,
    BROWN_BOX_PALETTE.darkTobacco,
  );
}

function drawSpeedTrails(
  g: Phaser.GameObjects.Graphics,
  snapshot: SkiPixlSnapshot,
): void {
  if (snapshot.phase !== "active" || snapshot.knockdownTicksRemaining > 0)
    return;
  const skierX = snapNativePixel(snapshot.skierX / 2);
  const boosted = snapshot.speed > 74;
  const cadence = snapshot.tick % 3;
  const spread = 4 + Math.round(Math.abs(snapshot.steeringAngle) * 0.5);
  const trailLength = boosted ? 7 : 3;
  // The canonical skier occupies a 20-pixel frame; trails stay above it.
  const lanes = boosted
    ? [-spread - 2, -spread + 1, spread - 1, spread + 2]
    : [-spread, spread];

  lanes.forEach((offset, index) => {
    const stagger = (index + cadence) % 3;
    const nearY = SKIPIXL_PLAYER_Y - 22 - stagger;
    drawNativePixelLine(
      g,
      { x: skierX + offset, y: nearY - trailLength },
      { x: skierX + offset, y: nearY },
      { colour: BROWN_BOX_PALETTE.cream },
    );
  });

  if (boosted) {
    const centerY = SKIPIXL_PLAYER_Y - 24 - cadence;
    drawNativePixelLine(
      g,
      { x: skierX - 1, y: centerY - 5 },
      { x: skierX - 1, y: centerY },
      { colour: BROWN_BOX_PALETTE.cream },
    );
    drawNativePixelLine(
      g,
      { x: skierX + 1, y: centerY - 4 },
      { x: skierX + 1, y: centerY },
      { colour: BROWN_BOX_PALETTE.cream },
    );
  }
}

function drawFinish(g: Phaser.GameObjects.Graphics, y: number): void {
  for (let x = 48; x < 272; x += 8) {
    if ((x / 8) % 2 === 0) {
      drawNativePixelRect(g, x, y, 8, 3, BROWN_BOX_PALETTE.cream);
    } else {
      drawNativePixelRect(g, x, y + 3, 8, 3, BROWN_BOX_PALETTE.cream);
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
    snapNativePixel(obstacle.x / 2),
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
      snapNativePixel(snapshot.skierX / 2),
      SKIPIXL_PLAYER_Y,
      CANONICAL_SPRITE_PIXEL_SCALE,
    );
    return;
  }

  drawOutlinedCanonicalSprite(
    g,
    "skipixl-steering-seven-angle-strip",
    skiPixlFrameForAngle(snapshot.steeringAngle),
    snapNativePixel(snapshot.skierX / 2),
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
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
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
  pixel = 1,
): void {
  const outline = BROWN_BOX_PALETTE.darkTobacco;
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
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

function drawPanelFrame(
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
