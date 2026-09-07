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
    farY: 88,
    nearY: 286,
    farLeft: 170,
    farRight: 470,
    nearLeft: 62,
    nearRight: 578,
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

  g.lineStyle(3, PALETTE.cream, 1)
    .beginPath()
    .moveTo(court.farLeft, court.farY)
    .lineTo(court.farRight, court.farY)
    .lineTo(court.nearRight, court.nearY)
    .lineTo(court.nearLeft, court.nearY)
    .closePath()
    .strokePath();
  g.lineStyle(2, PALETTE.cream, 1)
    .lineBetween(320, court.farY, 320, court.nearY)
    .strokeEllipse(320, 192, 84, 48)
    .fillStyle(PALETTE.cream, 1)
    .fillRect(317, 189, 6, 6);

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
      sport.ball.carrierId === playerId ? ballPoint : null,
    );
  }

  drawPixelSprite(g, FLUXBALL_V2_BALL, {
    pixel: CANONICAL_SPRITE_PIXEL_SCALE,
    centerX: Math.round(ballPoint.x),
    bottomY: Math.round(ballPoint.y + 8),
  });

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
  g.lineStyle(3, PALETTE.cream, 1);
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
    const outward = left ? -18 : 18;
    g.beginPath()
      .moveTo(upper.x, upper.y)
      .lineTo(upper.x + outward, upper.y + 4)
      .lineTo(lower.x + outward, lower.y - 4)
      .lineTo(lower.x, lower.y)
      .strokePath();
    return;
  }
  const top = playerId === "C";
  const y = top ? court.farY : court.nearY;
  const edgeWidth = top
    ? court.farRight - court.farLeft
    : court.nearRight - court.nearLeft;
  const half = (goalHalfExtent / courtAxisLength) * edgeWidth;
  const outward = top ? -19 : 21;
  g.beginPath()
    .moveTo(320 - half, y)
    .lineTo(320 - half + 6, y + outward)
    .lineTo(320 + half - 6, y + outward)
    .lineTo(320 + half, y)
    .strokePath();
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
  heldBall: Readonly<{ x: number; y: number }> | null,
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
  if (carrying && heldBall) drawCarryingPose(g, x, y, heldBall, roundTick);
  if (contacting) {
    const radius = 26 + (roundTick % 2) * 3;
    g.lineStyle(2, PALETTE.cream, 1);
    g.lineBetween(x - radius, y - 19, x - radius + 6, y - 19);
    g.lineBetween(x + radius - 6, y - 19, x + radius, y - 19);
    g.lineBetween(x, y - 19 - radius, x, y - 13 - radius);
    g.lineBetween(x, y - 25 + radius, x, y - 19 + radius);
  }
}

function drawCarryingPose(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  ball: Readonly<{ x: number; y: number }>,
  roundTick: number,
): void {
  const torso = { x, y: y - 19 };
  const dx = ball.x - torso.x;
  const dy = ball.y - torso.y;
  const magnitude = Math.max(1, Math.hypot(dx, dy));
  const nx = dx / magnitude;
  const ny = dy / magnitude;
  const px = -ny;
  const py = nx;
  const waddle = roundTick % 6 < 3 ? 1 : -1;
  const elbow = {
    x: Math.round(torso.x + nx * 7 + px * waddle * 3),
    y: Math.round(torso.y + ny * 7 + py * waddle * 3),
  };
  const hand = {
    x: Math.round(ball.x - nx * 6),
    y: Math.round(ball.y - ny * 6),
  };

  g.lineStyle(3, PALETTE.cream, 1)
    .beginPath()
    .moveTo(Math.round(torso.x + px * 3), Math.round(torso.y + py * 3))
    .lineTo(elbow.x, elbow.y)
    .lineTo(Math.round(hand.x + px * 2), Math.round(hand.y + py * 2))
    .strokePath()
    .beginPath()
    .moveTo(Math.round(torso.x - px * 3), Math.round(torso.y - py * 3))
    .lineTo(
      Math.round(elbow.x - px * waddle * 4),
      Math.round(elbow.y - py * waddle * 4),
    )
    .lineTo(Math.round(hand.x - px * 2), Math.round(hand.y - py * 2))
    .strokePath();
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
  g.lineStyle(2, PALETTE.cream, 1);
  const firstDistance = 15 + flicker * 2;
  g.lineBetween(
    Math.round(x + tailX * firstDistance - direction.y * 3),
    Math.round(y - 4 + tailY * firstDistance + direction.x * 3),
    Math.round(x + tailX * (firstDistance + 6) - direction.y * 3),
    Math.round(y - 4 + tailY * (firstDistance + 6) + direction.x * 3),
  );
  if (speed < 145) return;
  const secondDistance = 22 + ((flicker + 1) % 3) * 2;
  g.lineBetween(
    Math.round(x + tailX * secondDistance + direction.y * 4),
    Math.round(y + 3 + tailY * secondDistance - direction.x * 4),
    Math.round(x + tailX * (secondDistance + 5) + direction.y * 4),
    Math.round(y + 3 + tailY * (secondDistance + 5) - direction.x * 4),
  );
}

function drawPause(g: Phaser.GameObjects.Graphics): void {
  drawCenteredPixelPanel(g, "PAUSED", {
    centerX: 320,
    y: 26,
    pixel: 4,
    border: true,
  });
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  snapshot: FluxballSnapshot,
): void {
  const hud = fluxballHudModel(snapshot, false);
  g.lineStyle(1, PALETTE.cream, 1).lineBetween(238, 68, 402, 68);
  drawPixelText(g, hud.round, {
    x: 320,
    y: 7,
    pixel: 2,
    colour: PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, hud.time, {
    x: 320,
    y: 20,
    pixel: 4,
    colour: PALETTE.cream,
    align: "center",
  });
  if (hud.ruleChange)
    drawPixelText(g, hud.ruleChange, {
      x: 518,
      y: 24,
      pixel: 2,
      colour: PALETTE.cream,
      align: "center",
    });

  drawScore(g, "A", hud.goals.A, hud.roundWins.A, 22, 154, "left");
  drawScore(g, "B", hud.goals.B, hud.roundWins.B, 618, 154, "right");
  if (hud.activePlayerIds.includes("C")) {
    drawScore(g, "C", hud.goals.C, hud.roundWins.C, 126, 18, "center");
  }
  if (hud.activePlayerIds.includes("D")) {
    drawScore(g, "D", hud.goals.D, hud.roundWins.D, 514, 316, "center");
  }
  if (hud.notice)
    drawPixelText(g, hud.notice, {
      x: 320,
      y: 52,
      pixel: 2,
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
    pixel: 2,
    colour: PALETTE.cream,
    align,
  });
  drawPixelText(g, `W${roundWins}`, {
    x,
    y: y + 12,
    pixel: 2,
    colour: PALETTE.cream,
    align,
  });
}
