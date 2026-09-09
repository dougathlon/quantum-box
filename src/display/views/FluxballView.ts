import Phaser from "phaser";
import type { FluxballSnapshot } from "../../games/fluxball/types";
import type { PlayerId } from "../../games/fluxball/standalone/modes";
import { fluxballHudModel } from "../../games/fluxball/presentation";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import { drawCenteredPixelPanel } from "../PixelHud";
import { drawPixelText } from "../PixelText";
import { CANONICAL_SPRITE_PIXEL_SCALE } from "../CanonicalSpriteRaster";
import { drawQGraphCabinetSprite } from "../QGraphCabinetSpriteRaster";
import { drawPixelSprite, FLUXBALL_V2_BALL } from "../PixelSprites";
import { fluxballDisplayView } from "./CabinetDisplayViews";
import {
  drawNativePixelEllipse,
  drawNativePixelLine,
  drawNativePixelPolyline,
  drawNativePixelRect,
  snapNativePixel,
} from "../NativePixelRaster";

const PALETTE = {
  ink: BROWN_BOX_PALETTE.ink,
  cream: BROWN_BOX_PALETTE.cream,
} as const;

export function renderFluxball(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: FluxballSnapshot,
  paused: boolean,
): void {
  const view = fluxballDisplayView(snapshot, paused);
  const g = graphics.clear();
  const sport = view.sport;
  if (!sport) {
    if (view.paused) drawPause(g);
    else drawHud(g, snapshot);
    return;
  }

  const court = {
    farY: 44,
    nearY: 143,
    farLeft: 85,
    farRight: 235,
    nearLeft: 31,
    nearRight: 289,
  } as const;
  const project = (x: number, y: number) => {
    const depth = Phaser.Math.Clamp(y / sport.court.height, 0, 1);
    const horizontal = Phaser.Math.Clamp(x / sport.court.width, 0, 1);
    const left = Phaser.Math.Linear(court.farLeft, court.nearLeft, depth);
    const right = Phaser.Math.Linear(court.farRight, court.nearRight, depth);
    return {
      x: Phaser.Math.Linear(left, right, horizontal),
      y: Phaser.Math.Linear(court.farY, court.nearY, depth),
      depth,
    };
  };

  drawNativePixelPolyline(
    g,
    [
      { x: court.farLeft, y: court.farY },
      { x: court.farRight, y: court.farY },
      { x: court.nearRight, y: court.nearY },
      { x: court.nearLeft, y: court.nearY },
    ],
    { colour: PALETTE.cream, thickness: 2 },
    true,
  );
  drawNativePixelLine(
    g,
    { x: 160, y: court.farY },
    { x: 160, y: court.nearY },
    { colour: PALETTE.cream },
  );
  drawNativePixelEllipse(g, { x: 160, y: 96 }, 21, 12, {
    colour: PALETTE.cream,
  });
  drawNativePixelRect(g, 159, 95, 3, 3, PALETTE.cream);

  drawGoal(g, "A", court, sport.court.goalHalfExtent, sport.court.height);
  drawGoal(g, "B", court, sport.court.goalHalfExtent, sport.court.height);
  if (snapshot.format.competitorCount === 4) {
    drawGoal(
      g,
      "C",
      court,
      sport.court.horizontalGoalHalfExtent,
      sport.court.width,
    );
    drawGoal(
      g,
      "D",
      court,
      sport.court.horizontalGoalHalfExtent,
      sport.court.width,
    );
  }

  const ballPoint = project(sport.ball.x, sport.ball.y);

  for (const [playerIndex, playerId] of view.orderedPlayerIds.entries()) {
    const player = sport.players[playerId];
    if (!player) continue;
    const point = project(player.x, player.y);
    const screenMotion = normalizeScreenMotion(player.resolvedMotion);
    const speed = Math.hypot(player.resolvedMotion.x, player.resolvedMotion.y);
    const strideRaised =
      speed >= 60 && (sport.roundTick + playerIndex * 2) % 4 < 2;
    const lean = Math.min(2, speed / 80);
    const figureX = Math.round(point.x + screenMotion.x * lean);
    const figureY = Math.round(
      point.y + screenMotion.y * lean - (strideRaised ? 1 : 0),
    );
    drawMotionAccents(
      g,
      figureX,
      figureY,
      screenMotion,
      speed,
      sport.roundTick + playerIndex,
    );
    drawFigure(
      g,
      figureX,
      figureY,
      playerId,
      sport.ball.carrierId === playerId,
      sport.roundTick,
      speed,
      sport.latestContact?.playerId === playerId &&
        sport.roundTick - sport.latestContact.tick <= 2,
      sport.ball.carrierId === playerId
        ? normalizeScreenMotion(player.resolvedMotion)
        : null,
    );
  }

  if (sport.ball.carrierId === null) {
    drawPixelSprite(g, FLUXBALL_V2_BALL, {
      pixel: CANONICAL_SPRITE_PIXEL_SCALE,
      centerX: Math.round(ballPoint.x),
      bottomY: Math.round(ballPoint.y + 4),
    });
  }

  if (view.paused) {
    drawPause(g);
    return;
  }
  drawHud(g, snapshot);
}

interface CourtShape {
  readonly farY: number;
  readonly nearY: number;
  readonly farLeft: number;
  readonly farRight: number;
  readonly nearLeft: number;
  readonly nearRight: number;
}

function drawGoal(
  g: Phaser.GameObjects.Graphics,
  playerId: PlayerId,
  court: CourtShape,
  goalHalfExtent: number,
  courtAxisLength: number,
): void {
  if (playerId === "A" || playerId === "B") {
    const left = playerId === "A";
    const upperDepth = 0.5 - goalHalfExtent / courtAxisLength;
    const lowerDepth = 0.5 + goalHalfExtent / courtAxisLength;
    const edgeAt = (depth: number) =>
      Phaser.Math.Linear(
        left ? court.farLeft : court.farRight,
        left ? court.nearLeft : court.nearRight,
        depth,
      );
    const upper = {
      x: edgeAt(upperDepth),
      y: Phaser.Math.Linear(court.farY, court.nearY, upperDepth),
    };
    const lower = {
      x: edgeAt(lowerDepth),
      y: Phaser.Math.Linear(court.farY, court.nearY, lowerDepth),
    };
    const outward = left ? -9 : 9;
    drawNativePixelPolyline(
      g,
      [
        nativePoint(upper.x, upper.y),
        nativePoint(upper.x + outward, upper.y + 2),
        nativePoint(lower.x + outward, lower.y - 2),
        nativePoint(lower.x, lower.y),
      ],
      { colour: PALETTE.cream, thickness: 2 },
    );
    return;
  }
  const top = playerId === "C";
  const y = top ? court.farY : court.nearY;
  const edgeWidth = top
    ? court.farRight - court.farLeft
    : court.nearRight - court.nearLeft;
  const half = (goalHalfExtent / courtAxisLength) * edgeWidth;
  const outward = top ? -10 : 11;
  drawNativePixelPolyline(
    g,
    [
      nativePoint(160 - half, y),
      nativePoint(160 - half + 3, y + outward),
      nativePoint(160 + half - 3, y + outward),
      nativePoint(160 + half, y),
    ],
    { colour: PALETTE.cream, thickness: 2 },
  );
}

function drawFigure(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  playerId: PlayerId,
  carrying: boolean,
  roundTick: number,
  speed: number,
  contacting: boolean,
  heldDirection: Readonly<{ x: number; y: number }> | null,
): void {
  const motionFrame =
    speed < 24
      ? "idle"
      : (roundTick + playerId.charCodeAt(0)) % 8 < 4
        ? "stride-a"
        : "stride-b";
  drawQGraphCabinetSprite(
    g,
    "fluxball-player-motion-strip",
    `fluxball-player-${playerId.toLowerCase()}-${motionFrame}`,
    {
      pixel: CANONICAL_SPRITE_PIXEL_SCALE,
      centerX: x,
      bottomY: y,
    },
  );
  if (carrying && heldDirection)
    drawCarryingPose(g, x, y, heldDirection, roundTick);
  if (contacting) {
    const radius = 13 + (roundTick % 2);
    drawNativePixelLine(
      g,
      { x: x - radius, y: y - 10 },
      { x: x - radius + 3, y: y - 10 },
      { colour: PALETTE.cream },
    );
    drawNativePixelLine(
      g,
      { x: x + radius - 3, y: y - 10 },
      { x: x + radius, y: y - 10 },
      { colour: PALETTE.cream },
    );
    drawNativePixelLine(
      g,
      { x, y: y - 10 - radius },
      { x, y: y - 7 - radius },
      { colour: PALETTE.cream },
    );
    drawNativePixelLine(
      g,
      { x, y: y - 13 + radius },
      { x, y: y - 10 + radius },
      { colour: PALETTE.cream },
    );
  }
}

function drawCarryingPose(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  heldDirection: Readonly<{ x: number; y: number }>,
  roundTick: number,
): void {
  const torso = { x, y: y - 10 };
  const directionMagnitude = Math.hypot(heldDirection.x, heldDirection.y);
  const nx = directionMagnitude > 0 ? heldDirection.x / directionMagnitude : 1;
  const ny = directionMagnitude > 0 ? heldDirection.y / directionMagnitude : 0;
  const px = -ny;
  const py = nx;
  const handPhase = roundTick % 6 < 3 ? 1 : 0;
  const socket = {
    x: Math.round(torso.x + nx * (8 + handPhase)),
    y: Math.round(torso.y + ny * (7 + handPhase)),
  };

  drawPixelSprite(g, FLUXBALL_V2_BALL, {
    pixel: CANONICAL_SPRITE_PIXEL_SCALE,
    centerX: socket.x,
    bottomY: socket.y + 4,
  });

  drawNativePixelPolyline(
    g,
    [
      nativePoint(torso.x + px * 2, torso.y + py * 2),
      nativePoint(torso.x + nx * 3 + px * 3, torso.y + ny * 3 + py * 3),
      nativePoint(socket.x - nx * 3 + px, socket.y - ny * 3 + py),
    ],
    { colour: PALETTE.cream },
  );
  drawNativePixelPolyline(
    g,
    [
      nativePoint(torso.x - px * 2, torso.y - py * 2),
      nativePoint(torso.x + nx * 3 - px * 3, torso.y + ny * 3 - py * 3),
      nativePoint(socket.x - nx * 3 - px, socket.y - ny * 3 - py),
    ],
    { colour: PALETTE.cream },
  );
}

function normalizeScreenMotion(
  motion: Readonly<{ x: number; y: number }>,
): Readonly<{ x: number; y: number }> {
  const screenX = motion.x;
  const screenY = motion.y * 0.58;
  const magnitude = Math.hypot(screenX, screenY);
  if (magnitude <= Number.EPSILON) return { x: 0, y: 0 };
  return { x: screenX / magnitude, y: screenY / magnitude };
}

function drawMotionAccents(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  direction: Readonly<{ x: number; y: number }>,
  speed: number,
  phase: number,
): void {
  if (speed < 100) return;
  const flicker = phase % 3;
  const tailX = -direction.x;
  const tailY = -direction.y;
  const firstDistance = 8 + flicker;
  drawNativePixelLine(
    g,
    nativePoint(
      Math.round(x + tailX * firstDistance - direction.y * 2),
      Math.round(y - 2 + tailY * firstDistance + direction.x * 2),
    ),
    nativePoint(
      Math.round(x + tailX * (firstDistance + 3) - direction.y * 2),
      Math.round(y - 2 + tailY * (firstDistance + 3) + direction.x * 2),
    ),
    { colour: PALETTE.cream },
  );
  if (speed < 145) return;
  const secondDistance = 11 + ((flicker + 1) % 3);
  drawNativePixelLine(
    g,
    nativePoint(
      Math.round(x + tailX * secondDistance + direction.y * 4),
      Math.round(y + 2 + tailY * secondDistance - direction.x * 2),
    ),
    nativePoint(
      Math.round(x + tailX * (secondDistance + 5) + direction.y * 4),
      Math.round(y + 2 + tailY * (secondDistance + 3) - direction.x * 2),
    ),
    { colour: PALETTE.cream },
  );
}

function drawPause(g: Phaser.GameObjects.Graphics): void {
  drawCenteredPixelPanel(g, "PAUSED", {
    centerX: 160,
    y: 13,
    pixel: 2,
    border: true,
  });
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  snapshot: FluxballSnapshot,
): void {
  const hud = fluxballHudModel(snapshot, false);
  drawNativePixelLine(
    g,
    { x: 119, y: 34 },
    { x: 201, y: 34 },
    { colour: PALETTE.cream },
  );
  drawPixelText(g, hud.round, {
    x: 160,
    y: 4,
    pixel: 1,
    colour: PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, hud.time, {
    x: 160,
    y: 10,
    pixel: 2,
    colour: PALETTE.cream,
    align: "center",
  });
  if (hud.ruleChange)
    drawPixelText(g, hud.ruleChange, {
      x: 259,
      y: 12,
      pixel: 1,
      colour: PALETTE.cream,
      align: "center",
    });

  drawScore(g, "A", hud.goals.A, hud.roundWins.A, 11, 77, "left");
  drawScore(g, "B", hud.goals.B, hud.roundWins.B, 309, 77, "right");
  if (hud.activePlayerIds.includes("C")) {
    drawScore(g, "C", hud.goals.C, hud.roundWins.C, 63, 9, "center");
  }
  if (hud.activePlayerIds.includes("D")) {
    drawScore(g, "D", hud.goals.D, hud.roundWins.D, 257, 158, "center");
  }
  if (hud.notice)
    drawPixelText(g, hud.notice, {
      x: 160,
      y: 26,
      pixel: 1,
      colour: PALETTE.cream,
      align: "center",
    });
}

function drawScore(
  g: Phaser.GameObjects.Graphics,
  playerId: PlayerId,
  goals: string,
  roundWins: string,
  x: number,
  y: number,
  align: "left" | "center" | "right",
): void {
  drawPixelText(g, `${playerId} G${goals}`, {
    x,
    y,
    pixel: 1,
    colour: PALETTE.cream,
    align,
  });
  drawPixelText(g, `W${roundWins}`, {
    x,
    y: y + 6,
    pixel: 1,
    colour: PALETTE.cream,
    align,
  });
}

function nativePoint(x: number, y: number): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: snapNativePixel(x), y: snapNativePixel(y) });
}
