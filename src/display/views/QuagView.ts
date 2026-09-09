import Phaser from "phaser";
import { QUAG_KNOCKOUT_TICKS } from "../../games/quag/QuagSession";
import {
  QUAG_ARENA,
  quagArenaById,
  quagHorizontalSpan,
} from "../../games/quag/QuagArena";
import { quagHudModel, quagHuntRows } from "../../games/quag/presentation";
import {
  QUAG_PLAYER_IDS,
  QUAG_SUBPIXELS,
  type QuagArena,
  type QuagArenaId,
  type QuagPlayerSnapshot,
  type QuagSnapshot,
} from "../../games/quag/types";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import { drawPixelText } from "../PixelText";
import { drawCabinetPauseHeader } from "../PixelHud";
import { drawQGraphCabinetSprite } from "../QGraphCabinetSpriteRaster";
import {
  drawNativePixelLine,
  drawNativePixelRect,
  snapNativePixel,
} from "../NativePixelRaster";

const SPRITE_PIXEL = 1;
const SPRITE_HALF_EXTENT = 10;

export function drawQuagArena(
  graphics: Phaser.GameObjects.Graphics,
  arenaId: QuagArenaId = QUAG_ARENA.id,
): void {
  const arena = quagArenaById(arenaId);
  const g = graphics.clear();
  // The missing vertical walls are intentional: bodies wrap across both open
  // sides, so the arena must not visually imply a collision boundary there.
  const left = native(arena.left);
  const right = native(arena.right);
  const ceiling = native(arena.ceiling);
  const floor = native(arena.floorTop);
  drawNativePixelLine(
    g,
    { x: left, y: ceiling },
    { x: right, y: ceiling },
    { colour: BROWN_BOX_PALETTE.cream },
  );
  drawNativePixelLine(
    g,
    { x: left, y: floor },
    { x: right, y: floor },
    { colour: BROWN_BOX_PALETTE.cream },
  );
  for (const platform of arena.platforms) {
    const platformLeft = native(platform.left);
    const platformTop = native(platform.top);
    const platformWidth = Math.max(1, native(platform.width));
    const thickness = Math.max(1, native(platform.thickness));
    drawNativePixelRect(
      g,
      platformLeft,
      platformTop,
      platformWidth,
      1,
      BROWN_BOX_PALETTE.cream,
    );
    if (thickness > 1) {
      drawNativePixelRect(
        g,
        platformLeft + 2,
        platformTop + 1,
        Math.max(1, platformWidth - 4),
        thickness - 1,
        BROWN_BOX_PALETTE.tobacco,
      );
    }
  }
}

export function renderQuag(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
  paused: boolean,
  interpolationAlpha = 1,
): void {
  const g = graphics.clear();
  const sinceShift =
    snapshot.lastGraphShiftTick === null
      ? -1
      : snapshot.activeTick - snapshot.lastGraphShiftTick;
  if (
    !paused &&
    snapshot.phase === "active" &&
    sinceShift >= 0 &&
    sinceShift < 2
  ) {
    drawNativePixelRect(g, 0, 0, 320, 180, BROWN_BOX_PALETTE.tobacco);
  }
  const arena = quagArenaById(snapshot.arenaId);
  for (const player of snapshot.players) {
    const position = renderedPosition(player, interpolationAlpha);
    if (player.knockedOutTicks > 0) {
      if (player.knockedOutTicks > QUAG_KNOCKOUT_TICKS - 4)
        drawImpactBurst(g, position.x, position.y);
      continue;
    }
    drawPlayer(g, player, position, snapshot.tick, snapshot, arena);
  }
  if (paused) {
    drawCabinetPauseHeader(g);
    return;
  }
  if (snapshot.phase === "ready") {
    drawReadyPanel(g, snapshot);
    return;
  }
  if (snapshot.phase === "round-break") drawRoundBreakPanel(g, snapshot);
  else if (snapshot.phase === "complete") drawResultPanel(g, snapshot);
  else drawHud(g, snapshot);
}

function drawHud(g: Phaser.GameObjects.Graphics, snapshot: QuagSnapshot): void {
  const hud = quagHudModel(snapshot, false);
  const centers = [44, 122, 200, 278];
  const metadata = [
    "QUARRY",
    `ROUND ${hud.round}`,
    `SHIFT ${Math.ceil(snapshot.ticksUntilRemeasurement / 20)}S`,
    `TIME ${hud.time}`,
  ];
  const hunts = quagHuntRows(snapshot);
  for (const [index, id] of QUAG_PLAYER_IDS.entries()) {
    const player = snapshot.players.find((entry) => entry.id === id)!;
    const human = snapshot.humanPlayerIds.includes(id);
    const owner = human
      ? snapshot.humanPlayerIds.length === 1
        ? "YOU"
        : `P${index + 1}`
      : "CPU";
    for (const [y, text] of [
      [1, metadata[index]!],
      [9, hunts[index]!],
      [16, `${owner} ${player.score} PTS`],
    ] as const) {
      drawPixelText(g, text, {
        x: centers[index]!,
        y,
        pixel: 1,
        colour: BROWN_BOX_PALETTE.cream,
        align: "center",
      });
    }
  }
}

function compactPoints(snapshot: QuagSnapshot): string {
  return snapshot.players
    .map((player) => `${player.id}${String(player.score).padStart(2, "0")}`)
    .join(" ");
}

function drawPlayer(
  g: Phaser.GameObjects.Graphics,
  player: QuagPlayerSnapshot,
  position: Readonly<{ x: number; y: number }>,
  tick: number,
  snapshot: QuagSnapshot,
  arena: QuagArena,
): void {
  const copies = [position.x];
  const span = native(quagHorizontalSpan(arena));
  const arenaLeft = native(arena.left);
  const arenaRight = native(arena.right);
  if (position.x - SPRITE_HALF_EXTENT < arenaLeft)
    copies.push(position.x + span);
  if (position.x + SPRITE_HALF_EXTENT > arenaRight)
    copies.push(position.x - span);
  for (const x of copies) {
    if (player.graceTicks === 0 || Math.floor(tick / 4) % 2 === 0)
      drawQGraphCabinetSprite(
        g,
        "quag-player-directional-strip",
        `${player.id.toLowerCase()}-${player.facing < 0 ? "left" : "right"}-${motionFrame(player, snapshot)}`,
        {
          pixel: SPRITE_PIXEL,
          centerX: x,
          bottomY: position.y + SPRITE_HALF_EXTENT,
        },
      );
    drawIdentity(g, player, x, position.y, snapshot, arena);
  }
}

function motionFrame(
  player: QuagPlayerSnapshot,
  snapshot: QuagSnapshot,
): string {
  const recentCapture =
    snapshot.latestEvent?.type === "CAPTURE" &&
    snapshot.activeTick - snapshot.latestEvent.tick < 5
      ? snapshot.latestEvent
      : null;
  if (
    recentCapture?.captureEdges.some((edge) => edge.startsWith(`${player.id}>`))
  )
    return "catch";
  if (
    recentCapture?.captureEdges.some((edge) => edge.endsWith(`>${player.id}`))
  )
    return "impact";
  if (player.velocityYSubpixels < -20) return "flap-up";
  if (player.velocityYSubpixels > 44) return "fall";
  if (!player.grounded) return "flap-down";
  if (Math.abs(player.velocityXSubpixels) < 8) return "idle";
  return Math.floor(player.movementSequence / 2) % 2 === 0
    ? "waddle-a"
    : "waddle-b";
}

function drawIdentity(
  g: Phaser.GameObjects.Graphics,
  player: QuagPlayerSnapshot,
  x: number,
  y: number,
  snapshot: QuagSnapshot,
  arena: QuagArena,
): void {
  const isHuman = snapshot.humanPlayerIds.includes(player.id);
  const labelY = Math.max(native(arena.ceiling) + 2, y - 16);
  const humanNumber = QUAG_PLAYER_IDS.indexOf(player.id) + 1;
  drawPixelText(
    g,
    isHuman
      ? snapshot.humanPlayerIds.length === 1
        ? `YOU ${player.id}`
        : `P${humanNumber} ${player.id}`
      : player.id,
    {
      x,
      y: labelY,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    },
  );
  if (!isHuman) return;
  const markerY = Math.max(native(arena.ceiling) + 5, y - 11);
  drawNativePixelLine(
    g,
    { x: x - 2, y: markerY },
    { x: x + 2, y: markerY },
    { colour: BROWN_BOX_PALETTE.cream },
  );
  drawNativePixelLine(
    g,
    { x: x - 1, y: markerY + 1 },
    { x: x + 1, y: markerY + 1 },
    { colour: BROWN_BOX_PALETTE.cream },
  );
  drawNativePixelRect(g, x, markerY + 2, 1, 1, BROWN_BOX_PALETTE.cream);
}

function renderedPosition(
  player: QuagPlayerSnapshot,
  interpolationAlpha: number,
): Readonly<{ x: number; y: number }> {
  const previousX = player.previousXSubpixels / QUAG_SUBPIXELS;
  let currentX = player.xSubpixels / QUAG_SUBPIXELS;
  // All layouts share their outer span, so interpolation can resolve the
  // wrapped segment from the immutable movement endpoints alone.
  const span = quagHorizontalSpan();
  if (currentX - previousX > span / 2) currentX -= span;
  else if (currentX - previousX < -span / 2) currentX += span;
  let x = Phaser.Math.Linear(previousX, currentX, interpolationAlpha);
  if (x < QUAG_ARENA.left - 14) x += span;
  else if (x > QUAG_ARENA.right + 14) x -= span;
  return Object.freeze({
    x: snapNativePixel(x / 2),
    y: Math.round(
      Phaser.Math.Linear(
        player.previousYSubpixels / QUAG_SUBPIXELS,
        player.ySubpixels / QUAG_SUBPIXELS,
        interpolationAlpha,
      ) / 2,
    ),
  });
}

function drawImpactBurst(
  g: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
): void {
  drawNativePixelRect(
    g,
    centerX - 1,
    centerY - 1,
    2,
    2,
    BROWN_BOX_PALETTE.cream,
  );
  for (const [x, y] of [
    [-8, 0],
    [8, 0],
    [0, -8],
    [0, 8],
    [-6, -6],
    [6, -6],
    [-6, 6],
    [6, 6],
  ] as const) {
    drawNativePixelRect(
      g,
      centerX + x - 1,
      centerY + y - 1,
      2,
      2,
      BROWN_BOX_PALETTE.cream,
    );
  }
}

function drawReadyPanel(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
): void {
  drawFrame(g, 104, 0, 112, 22, BROWN_BOX_PALETTE.cream);
  drawPixelText(
    g,
    `READY ${Math.max(1, Math.ceil(snapshot.readyTicksRemaining / 20))}`,
    {
      x: 160,
      y: 3,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    },
  );
  drawPixelText(g, `QUARRY ${quagHudModel(snapshot, false).targets}`, {
    x: 160,
    y: 9,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, "CATCH FROM ABOVE", {
    x: 160,
    y: 16,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}

function drawResultPanel(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
): void {
  drawRoundNotice(
    g,
    snapshot,
    quagHudModel(snapshot, false).notice,
    "SPACE / A EXIT · X / X RETRY",
  );
}

function drawRoundBreakPanel(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
): void {
  const winner =
    snapshot.roundWinnerIds.length === 1
      ? `${snapshot.roundWinnerIds[0]} WINS ROUND ${snapshot.roundNumber}`
      : `ROUND ${snapshot.roundNumber} DRAW`;
  drawRoundNotice(
    g,
    snapshot,
    winner,
    `NEXT ROUND ${Math.max(1, Math.ceil(snapshot.roundBreakTicksRemaining / 20))}`,
  );
}

function drawRoundNotice(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
  title: string,
  action: string,
): void {
  drawFrame(g, 50, 0, 220, 22, BROWN_BOX_PALETTE.cream);
  for (const [index, line] of [
    title,
    `R ${compactRoundWins(snapshot)} · P ${compactPoints(snapshot)}`,
    action,
  ].entries()) {
    drawPixelText(g, line, {
      x: 160,
      y: [3, 9, 16][index]!,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    });
  }
}

function compactRoundWins(snapshot: QuagSnapshot): string {
  return snapshot.players
    .map((player) => `${player.id}${player.roundWins}`)
    .join(" ");
}

function native(value: number): number {
  return snapNativePixel(value / 2);
}

function drawFrame(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  width: number,
  height: number,
  colour: number,
): void {
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
