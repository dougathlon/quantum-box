import Phaser from "phaser";
import { QUAG_KNOCKOUT_TICKS } from "../../games/quag/QuagSession";
import {
  QUAG_ARENA,
  quagArenaById,
  quagHorizontalSpan,
  shortestWrappedDeltaX,
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

const SPRITE_PIXEL = 2;
const SPRITE_HALF_EXTENT = 20;

export function drawQuagArena(
  graphics: Phaser.GameObjects.Graphics,
  arenaId: QuagArenaId = QUAG_ARENA.id,
): void {
  const arena = quagArenaById(arenaId);
  const g = graphics.clear();
  // The missing vertical walls are intentional: bodies wrap across both open
  // sides, so the arena must not visually imply a collision boundary there.
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(arena.left, arena.ceiling, arena.right, arena.ceiling);
  g.lineBetween(arena.left, arena.floorTop, arena.right, arena.floorTop);
  drawWrapMouth(g, arena.left, arena.ceiling, arena.floorTop, -1);
  drawWrapMouth(g, arena.right, arena.ceiling, arena.floorTop, 1);
  for (const platform of arena.platforms) {
    g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(
      platform.left,
      platform.top,
      platform.width,
      2,
    );
    g.fillStyle(BROWN_BOX_PALETTE.tobacco, 1).fillRect(
      platform.left + 4,
      platform.top + 2,
      platform.width - 8,
      platform.thickness - 2,
    );
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
  g.lineStyle(1, BROWN_BOX_PALETTE.cream, 1).lineBetween(18, 45, 622, 45);
  for (const x of [128, 256, 384, 512]) g.lineBetween(x, 4, x, 40);
  drawHudSection(g, "ROUND", hud.round, 64);
  drawHudSection(g, "SCORE", compactHudPoints(snapshot), 192);
  drawQuarryHudValue(g, hud.targets, snapshot.humanPlayerIds.length);
  drawHudSection(
    g,
    `STATE ${snapshot.graphPhase}`,
    `${Math.ceil(snapshot.ticksUntilRemeasurement / 20)}S`,
    448,
  );
  drawHudSection(g, paused ? "PAUSED" : "TIME", hud.time, 576);
}

function drawQuarryHudValue(
  g: Phaser.GameObjects.Graphics,
  targets: string,
  humanCount: number,
): void {
  drawPixelText(g, "QUARRY", {
    x: 320,
    y: 4,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  const entries = targets.split(" ");
  if (humanCount <= 2) {
    drawPixelText(g, targets, {
      x: 320,
      y: humanCount === 1 ? 21 : 24,
      pixel: 2,
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
      x: 320,
      y: 18 + index * 12,
      pixel: 2,
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
    y: 4,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, value, {
    x: centerX,
    y: 21,
    pixel: 2,
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
  const span = quagHorizontalSpan(arena);
  if (position.x - SPRITE_HALF_EXTENT < arena.left)
    copies.push(position.x + span);
  if (position.x + SPRITE_HALF_EXTENT > arena.right)
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
  const labelY = Math.max(arena.ceiling + 3, y - 31);
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
      pixel: 2,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    },
  );
  if (!isHuman) return;
  const markerY = Math.max(arena.ceiling + 10, y - 22);
  g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillTriangle(
    x - 3,
    markerY,
    x + 3,
    markerY,
    x,
    markerY + 4,
  );
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
    const markerY = Math.max(position.y, arena.ceiling + 27);
    drawOpenBrackets(g, position.x, markerY, 25);
    const span = quagHorizontalSpan(arena);
    if (position.x - 25 < arena.left)
      drawOpenBrackets(g, position.x + span, markerY, 25);
    if (position.x + 25 > arena.right)
      drawOpenBrackets(g, position.x - span, markerY, 25);
  }
}

function drawOpenBrackets(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  extent: number,
): void {
  const corner = 7;
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(x - extent, y - extent, x - extent + corner, y - extent);
  g.lineBetween(x - extent, y - extent, x - extent, y - extent + corner);
  g.lineBetween(x + extent, y - extent, x + extent - corner, y - extent);
  g.lineBetween(x + extent, y - extent, x + extent, y - extent + corner);
  g.lineBetween(x - extent, y + extent, x - extent + corner, y + extent);
  g.lineBetween(x - extent, y + extent, x - extent, y + extent - corner);
  g.lineBetween(x + extent, y + extent, x + extent - corner, y + extent);
  g.lineBetween(x + extent, y + extent, x + extent, y + extent - corner);
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
    x: Math.round(x),
    y: Math.round(
      Phaser.Math.Linear(
        player.previousYSubpixels / QUAG_SUBPIXELS,
        player.ySubpixels / QUAG_SUBPIXELS,
        interpolationAlpha,
      ),
    ),
  });
}

function drawGraceMarker(
  g: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
  tick: number,
): void {
  const extent = 23 + (Math.floor(tick / 4) % 2) * 2;
  const segment = 8;
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(centerX - extent, centerY, centerX - extent, centerY - segment);
  g.lineBetween(centerX - extent, centerY, centerX - extent, centerY + segment);
  g.lineBetween(centerX + extent, centerY, centerX + extent, centerY - segment);
  g.lineBetween(centerX + extent, centerY, centerX + extent, centerY + segment);
  g.lineBetween(centerX, centerY - extent, centerX - segment, centerY - extent);
  g.lineBetween(centerX, centerY - extent, centerX + segment, centerY - extent);
  g.lineBetween(centerX, centerY + extent, centerX - segment, centerY + extent);
  g.lineBetween(centerX, centerY + extent, centerX + segment, centerY + extent);
}

function drawImpactBurst(
  g: Phaser.GameObjects.Graphics,
  centerX: number,
  centerY: number,
): void {
  g.fillStyle(BROWN_BOX_PALETTE.cream, 1);
  g.fillRect(centerX - 2, centerY - 2, 4, 4);
  for (const [x, y] of [
    [-16, 0],
    [16, 0],
    [0, -16],
    [0, 16],
    [-11, -11],
    [11, -11],
    [-11, 11],
    [11, 11],
  ] as const) {
    g.fillRect(centerX + x - 2, centerY + y - 2, 4, 4);
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
  g.lineStyle(4, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(arena.left, arena.ceiling, arena.right, arena.ceiling);
  g.lineBetween(arena.left, arena.floorTop, arena.right, arena.floorTop);
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
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(214, 153, 212, 69);
  drawPixelText(
    g,
    `READY ${Math.max(1, Math.ceil(snapshot.readyTicksRemaining / 20))}`,
    {
      x: 320,
      y: 163,
      pixel: 3,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    },
  );
  drawPixelText(g, `QUARRY ${quagHudModel(snapshot, false).targets}`, {
    x: 320,
    y: 188,
    pixel: snapshot.humanPlayerIds.length > 1 ? 1 : 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, "CATCH FROM ABOVE", {
    x: 320,
    y: 205,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
}

function drawResultPanel(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuagSnapshot,
): void {
  const hud = quagHudModel(snapshot, false);
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(202, 139, 236, 92);
  drawPixelText(g, hud.notice, {
    x: 320,
    y: 151,
    pixel: 3,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, `ROUNDS ${compactRoundWins(snapshot)}`, {
    x: 320,
    y: 177,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, `POINTS ${compactPoints(snapshot)}`, {
    x: 320,
    y: 195,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, "SPACE EXIT · X RETRY", {
    x: 320,
    y: 213,
    pixel: 2,
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
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(204, 148, 232, 72);
  drawPixelText(g, winner, {
    x: 320,
    y: 160,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(
    g,
    `R ${compactRoundWins(snapshot)} · P ${compactPoints(snapshot)}`,
    {
      x: 320,
      y: 181,
      pixel: 2,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    },
  );
  drawPixelText(
    g,
    `NEXT ROUND ${Math.max(1, Math.ceil(snapshot.roundBreakTicksRemaining / 20))}`,
    {
      x: 320,
      y: 202,
      pixel: 2,
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
    const dx = shortestWrappedDeltaX(source.x, target.x, arena);
    const dy = target.y - source.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) continue;
    const ux = dx / distance;
    const uy = dy / distance;
    const startX = source.x + ux * 22;
    const startY = source.y + uy * 22;
    const endX = source.x + dx - ux * 22;
    const endY = target.y - uy * 22;
    g.lineStyle(1, BROWN_BOX_PALETTE.cream, 1);
    if (relation.sourceKind === "human") {
      g.lineBetween(startX, startY, endX, endY);
    } else {
      drawDashedLine(g, startX, startY, endX, endY, 3, 3);
    }
    drawRelationArrow(g, startX, startY, endX, endY, 0.62, 6);
    drawRelationArrow(g, startX, startY, endX, endY, 1, 7);
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
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  if (distance <= 0) return;
  for (let offset = 0; offset < distance; offset += dash + gap) {
    const from = offset / distance;
    const to = Math.min(distance, offset + dash) / distance;
    g.lineBetween(
      startX + dx * from,
      startY + dy * from,
      startX + dx * to,
      startY + dy * to,
    );
  }
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
  g.lineBetween(x, y, x - ux * size + wingX, y - uy * size + wingY);
  g.lineBetween(x, y, x - ux * size - wingX, y - uy * size - wingY);
}

function drawWrapMouth(
  g: Phaser.GameObjects.Graphics,
  x: number,
  top: number,
  bottom: number,
  direction: -1 | 1,
): void {
  const center = Math.round((top + bottom) / 2);
  const inner = x + direction * 8;
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(x, center - 12, inner, center - 4);
  g.lineBetween(inner, center - 4, x, center + 4);
  g.lineBetween(x, center + 4, inner, center + 12);
}
