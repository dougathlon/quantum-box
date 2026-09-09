import Phaser from "phaser";
import { QUAG_KNOCKOUT_TICKS } from "../../games/quag/QuagSession";
import {
  QUAG_ARENA,
  quagArenaById,
  quagHorizontalSpan,
} from "../../games/quag/QuagArena";
import {
  quagHudModel,
  quagRelationPresentation,
} from "../../games/quag/presentation";
import {
  QUAG_PLAYER_IDS,
  QUAG_SUBPIXELS,
  type QuagArena,
  type QuagArenaId,
  type QuagPlayerId,
  type QuagPlayerSnapshot,
  type QuagSnapshot,
} from "../../games/quag/types";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import { drawPixelText } from "../PixelText";
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
  drawWrapMouth(g, left, ceiling, floor, -1);
  drawWrapMouth(g, right, ceiling, floor, 1);
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
  drawHud(g, snapshot, paused);
  drawDirectedRelations(g, snapshot, interpolationAlpha);
  drawTargetMarkers(g, snapshot, interpolationAlpha);
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
  drawGraphShiftPulse(g, snapshot);
  if (snapshot.phase === "ready") drawReadyPanel(g, snapshot);
  else if (snapshot.phase === "round-break") drawRoundBreakPanel(g, snapshot);
  else if (snapshot.phase === "complete") drawResultPanel(g, snapshot);
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
  paused: boolean,
): void {
  const hud = quagHudModel(snapshot, paused);
  drawNativePixelLine(
    g,
    { x: 9, y: 22 },
    { x: 311, y: 22 },
    { colour: BROWN_BOX_PALETTE.cream },
  );
  for (const x of [64, 128, 192, 256]) {
    drawNativePixelLine(
      g,
      { x, y: 2 },
      { x, y: 20 },
      { colour: BROWN_BOX_PALETTE.cream },
    );
  }
  drawHudSection(g, "ROUND", hud.round, 32);
  drawHudSection(g, "SCORE", compactHudPoints(snapshot), 96);
  drawQuarryHudValue(g, hud.targets, snapshot.humanPlayerIds.length);
  drawHudSection(
    g,
    `STATE ${snapshot.graphPhase}`,
    `${Math.ceil(snapshot.ticksUntilRemeasurement / 20)}S`,
    224,
  );
  drawHudSection(g, paused ? "PAUSED" : "TIME", hud.time, 288);
}

function drawQuarryHudValue(
  g: Phaser.GameObjects.Graphics,
  targets: string,
  humanCount: number,
): void {
  drawPixelText(g, "QUARRY", {
    x: 160,
    y: 2,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  const entries = targets.split(" ");
  if (humanCount <= 2) {
    drawPixelText(g, targets, {
      x: 160,
      y: humanCount === 1 ? 11 : 12,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    });
    return;
  }
  const split = Math.ceil(entries.length / 2);
  for (const [index, line] of [
    entries.slice(0, split).join(" "),
    entries.slice(split).join(" "),
  ].entries()) {
    drawPixelText(g, line, {
      x: 160,
      y: 9 + index * 6,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    });
  }
}

function drawHudSection(
  g: Phaser.GameObjects.Graphics,
  label: string,
  value: string,
  centerX: number,
): void {
  drawPixelText(g, label, {
    x: centerX,
    y: 2,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, value, {
    x: centerX,
    y: 11,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}

function compactPoints(snapshot: QuagSnapshot): string {
  return snapshot.players
    .map((player) => `${player.id}${String(player.score).padStart(2, "0")}`)
    .join(" ");
}

function compactHudPoints(snapshot: QuagSnapshot): string {
  return snapshot.players
    .map((player) => `${player.id}${player.score}`)
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
    if (player.graceTicks > 0) drawGraceMarker(g, x, position.y, tick);
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

function drawTargetMarkers(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
  interpolationAlpha: number,
): void {
  const hardBlink =
    graphShiftIsRecent(snapshot) &&
    Math.floor((snapshot.activeTick - snapshot.lastGraphShiftTick!) / 2) % 2 ===
      1;
  if (hardBlink) return;
  const arena = quagArenaById(snapshot.arenaId);
  for (const targetId of snapshot.humanTargets) {
    const target = snapshot.players.find((player) => player.id === targetId);
    if (!target || target.knockedOutTicks > 0) continue;
    const position = renderedPosition(target, interpolationAlpha);
    const markerY = Math.max(position.y, native(arena.ceiling) + 14);
    drawOpenBrackets(g, position.x, markerY, 13);
    const span = native(quagHorizontalSpan(arena));
    if (position.x - 13 < native(arena.left))
      drawOpenBrackets(g, position.x + span, markerY, 13);
    if (position.x + 13 > native(arena.right))
      drawOpenBrackets(g, position.x - span, markerY, 13);
  }
}

function drawOpenBrackets(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  extent: number,
): void {
  const corner = 4;
  drawCorners(g, x, y, extent, corner, BROWN_BOX_PALETTE.cream);
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

function drawGraceMarker(
  g: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  tick: number,
): void {
  const extent = 12 + (Math.floor(tick / 4) % 2);
  const segment = 4;
  const colour = BROWN_BOX_PALETTE.cream;
  for (const [start, end] of [
    [
      { x: centerX - extent, y: centerY },
      { x: centerX - extent, y: centerY - segment },
    ],
    [
      { x: centerX - extent, y: centerY },
      { x: centerX - extent, y: centerY + segment },
    ],
    [
      { x: centerX + extent, y: centerY },
      { x: centerX + extent, y: centerY - segment },
    ],
    [
      { x: centerX + extent, y: centerY },
      { x: centerX + extent, y: centerY + segment },
    ],
    [
      { x: centerX, y: centerY - extent },
      { x: centerX - segment, y: centerY - extent },
    ],
    [
      { x: centerX, y: centerY - extent },
      { x: centerX + segment, y: centerY - extent },
    ],
    [
      { x: centerX, y: centerY + extent },
      { x: centerX - segment, y: centerY + extent },
    ],
    [
      { x: centerX, y: centerY + extent },
      { x: centerX + segment, y: centerY + extent },
    ],
  ] as const)
    drawNativePixelLine(g, start, end, { colour });
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

function drawGraphShiftPulse(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
): void {
  if (!graphShiftIsRecent(snapshot)) return;
  const elapsed = snapshot.activeTick - snapshot.lastGraphShiftTick!;
  if (Math.floor(elapsed / 2) % 2 !== 0) return;
  const arena = quagArenaById(snapshot.arenaId);
  drawNativePixelLine(
    g,
    { x: native(arena.left), y: native(arena.ceiling) },
    { x: native(arena.right), y: native(arena.ceiling) },
    { colour: BROWN_BOX_PALETTE.cream, thickness: 2 },
  );
  drawNativePixelLine(
    g,
    { x: native(arena.left), y: native(arena.floorTop) },
    { x: native(arena.right), y: native(arena.floorTop) },
    { colour: BROWN_BOX_PALETTE.cream, thickness: 2 },
  );
}

function graphShiftIsRecent(snapshot: QuagSnapshot): boolean {
  return Boolean(
    snapshot.lastGraphShiftTick !== null &&
      snapshot.activeTick - snapshot.lastGraphShiftTick < 10,
  );
}

function drawReadyPanel(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
): void {
  drawFrame(g, 107, 77, 106, 35, BROWN_BOX_PALETTE.cream);
  drawPixelText(
    g,
    `READY ${Math.max(1, Math.ceil(snapshot.readyTicksRemaining / 20))}`,
    {
      x: 160,
      y: 82,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    },
  );
  drawPixelText(g, `QUARRY ${quagHudModel(snapshot, false).targets}`, {
    x: 160,
    y: 94,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, "CATCH FROM ABOVE", {
    x: 160,
    y: 103,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}

function drawResultPanel(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
): void {
  const hud = quagHudModel(snapshot, false);
  drawFrame(g, 101, 70, 118, 46, BROWN_BOX_PALETTE.cream);
  drawPixelText(g, hud.notice, {
    x: 160,
    y: 76,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, `ROUNDS ${compactRoundWins(snapshot)}`, {
    x: 160,
    y: 89,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, `POINTS ${compactPoints(snapshot)}`, {
    x: 160,
    y: 98,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, "SPACE EXIT · X RETRY", {
    x: 160,
    y: 107,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}

function drawRoundBreakPanel(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
): void {
  const winner =
    snapshot.roundWinnerIds.length === 1
      ? `${snapshot.roundWinnerIds[0]} WINS ROUND ${snapshot.roundNumber}`
      : `ROUND ${snapshot.roundNumber} DRAW`;
  drawFrame(g, 102, 74, 116, 36, BROWN_BOX_PALETTE.cream);
  drawPixelText(g, winner, {
    x: 160,
    y: 80,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(
    g,
    `R ${compactRoundWins(snapshot)} · P ${compactPoints(snapshot)}`,
    {
      x: 160,
      y: 91,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    },
  );
  drawPixelText(
    g,
    `NEXT ROUND ${Math.max(1, Math.ceil(snapshot.roundBreakTicksRemaining / 20))}`,
    {
      x: 160,
      y: 101,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    },
  );
}

function compactRoundWins(snapshot: QuagSnapshot): string {
  return snapshot.players
    .map((player) => `${player.id}${player.roundWins}`)
    .join(" ");
}

function drawDirectedRelations(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
  interpolationAlpha: number,
): void {
  const arena = quagArenaById(snapshot.arenaId);
  const positions = new Map(
    snapshot.players.map((player) => [
      player.id,
      renderedPosition(player, interpolationAlpha),
    ]),
  );
  for (const relation of quagRelationPresentation(snapshot)) {
    const { sourceId, targetId } = relation;
    const source = positions.get(sourceId);
    const target = positions.get(targetId);
    if (!source || !target) continue;
    const span = native(quagHorizontalSpan(arena));
    let dx = target.x - source.x;
    if (dx > span / 2) dx -= span;
    else if (dx < -span / 2) dx += span;
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) continue;
    const ux = dx / distance;
    const uy = dy / distance;
    const startX = source.x + ux * 11;
    const startY = source.y + uy * 11;
    const endX = source.x + dx - ux * 11;
    const endY = target.y - uy * 11;
    if (relation.sourceKind === "human") {
      drawNativePixelLine(g, point(startX, startY), point(endX, endY), {
        colour: BROWN_BOX_PALETTE.cream,
      });
    } else {
      drawDashedLine(g, startX, startY, endX, endY, 2, 2);
    }
    drawRelationArrow(g, startX, startY, endX, endY, 0.62, 3);
    drawRelationArrow(g, startX, startY, endX, endY, 1, 4);
  }
}

function drawDashedLine(
  g: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  dash: number,
  gap: number,
): void {
  drawNativePixelLine(g, point(startX, startY), point(endX, endY), {
    colour: BROWN_BOX_PALETTE.cream,
    dash: { on: dash, off: gap },
  });
}

function drawRelationArrow(
  g: Phaser.GameObjects.Graphics,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  progress: number,
  size: number,
): void {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0) return;
  const ux = dx / distance;
  const uy = dy / distance;
  const x = startX + dx * progress;
  const y = startY + dy * progress;
  const wingX = -uy * size;
  const wingY = ux * size;
  drawNativePixelLine(
    g,
    point(x, y),
    point(x - ux * size + wingX, y - uy * size + wingY),
    { colour: BROWN_BOX_PALETTE.cream },
  );
  drawNativePixelLine(
    g,
    point(x, y),
    point(x - ux * size - wingX, y - uy * size - wingY),
    { colour: BROWN_BOX_PALETTE.cream },
  );
}

function drawWrapMouth(
  g: Phaser.GameObjects.Graphics,
  x: number,
  top: number,
  bottom: number,
  direction: -1 | 1,
): void {
  const center = Math.round((top + bottom) / 2);
  const inner = x + direction * 4;
  const colour = BROWN_BOX_PALETTE.cream;
  drawNativePixelLine(
    g,
    { x, y: center - 6 },
    { x: inner, y: center - 2 },
    { colour },
  );
  drawNativePixelLine(
    g,
    { x: inner, y: center - 2 },
    { x, y: center + 2 },
    { colour },
  );
  drawNativePixelLine(
    g,
    { x, y: center + 2 },
    { x: inner, y: center + 6 },
    { colour },
  );
}

function native(value: number): number {
  return snapNativePixel(value / 2);
}

function point(x: number, y: number): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: snapNativePixel(x), y: snapNativePixel(y) });
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

function drawCorners(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  corner: number,
  colour: number,
): void {
  for (const [start, end] of [
    [
      { x: x - radius, y: y - radius },
      { x: x - radius + corner, y: y - radius },
    ],
    [
      { x: x - radius, y: y - radius },
      { x: x - radius, y: y - radius + corner },
    ],
    [
      { x: x + radius, y: y - radius },
      { x: x + radius - corner, y: y - radius },
    ],
    [
      { x: x + radius, y: y - radius },
      { x: x + radius, y: y - radius + corner },
    ],
    [
      { x: x - radius, y: y + radius },
      { x: x - radius + corner, y: y + radius },
    ],
    [
      { x: x - radius, y: y + radius },
      { x: x - radius, y: y + radius - corner },
    ],
    [
      { x: x + radius, y: y + radius },
      { x: x + radius - corner, y: y + radius },
    ],
    [
      { x: x + radius, y: y + radius },
      { x: x + radius, y: y + radius - corner },
    ],
  ] as const)
    drawNativePixelLine(g, start, end, { colour });
}
