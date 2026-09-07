import type Phaser from "phaser";
import type { QuantmanSyntheticRuntimeSnapshot } from "../../games/quantmanSynthetic/QuantmanSyntheticRuntime";
import { TUNING } from "../../games/quantmanSynthetic/config";
import {
  edgeTouchesGhostHome,
  GHOST_HOME_ROOMS,
  TUNNEL_ROW,
} from "../../games/quantmanSynthetic/game/MazeTraversal";
import type {
  ActorSnapshot,
  GhostRole,
  SessionSnapshot,
} from "../../games/quantmanSynthetic/game/types";
import { RoomGraph } from "../../games/quantmanSynthetic/labyrinth/RoomGraph";
import type { DirectionName } from "../../games/quantmanSynthetic/labyrinth/types";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import { drawCanonicalSprite } from "../CanonicalSpriteRaster";
import { drawCenteredPixelPanel } from "../PixelHud";
import { drawPixelText } from "../PixelText";

export const QUANTMAN_SYNTHETIC_VIEWPORT = Object.freeze({
  width: 640,
  height: 360,
  boardLeft: 180,
  boardTop: 40,
  cellSize: 28,
  boardSize: 280,
});

export interface QuantmanSyntheticHudModel {
  readonly mode: "STABILIZE GAZE" | "INVERSE GAZE";
  readonly phase: "READY" | "ACTIVE" | "PAUSED" | "SCREEN CLEARED" | "RUN LOST";
  readonly score: string;
  readonly lives: string;
  readonly remaining: string;
  readonly wallPass: string;
  readonly ghostEat: string;
  readonly gaze: string;
  readonly controls: string;
  readonly sourceClassification:
    | "RECORDED IBM FEZ RETURN"
    | "LOCAL SYNTHETIC CONTROL";
  readonly announcement: string;
}

export interface QuantmanSyntheticWallSegment {
  readonly edgeIndex: number;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

const GRAPH = new RoomGraph(10, 10);

/** Render-only adapter for the legacy 640x360 cabinet plane. */
export function renderQuantmanSynthetic(
  graphics: Phaser.GameObjects.Graphics,
  runtime: QuantmanSyntheticRuntimeSnapshot,
  paused: boolean,
): void {
  const state = runtime.simulation;
  const g = graphics.clear();
  drawTopology(g, state);
  drawCollectibles(g, state);
  drawActors(g, state);
  drawHud(g, quantmanSyntheticHudModel(runtime, paused));
}

export function quantmanSyntheticHudModel(
  runtime: QuantmanSyntheticRuntimeSnapshot,
  paused: boolean,
): QuantmanSyntheticHudModel {
  const state = runtime.simulation;
  const phase = paused
    ? "PAUSED"
    : state.phase === "ready"
      ? "READY"
      : state.phase === "active"
        ? "ACTIVE"
        : state.phase === "won"
          ? "SCREEN CLEARED"
          : "RUN LOST";
  const mode =
    state.mechanic === "stabilize-gaze" ? "STABILIZE GAZE" : "INVERSE GAZE";
  const controls =
    state.phase === "won" || state.phase === "lost"
      ? "RETRY · X   CONTINUE · SPACE"
      : paused
        ? "RESUME · P   RETRY · X"
        : state.phase === "ready"
          ? "MOVE / SPACE · START"
          : "MOVE · WASD / ARROWS   PAUSE · P";
  const gaze = gazeLabel(state);
  const sourceClassification =
    runtime.fixture.classification === "recorded-moth-qpu"
      ? "RECORDED IBM FEZ RETURN"
      : "LOCAL SYNTHETIC CONTROL";
  return Object.freeze({
    mode,
    phase,
    score: state.score.toString().padStart(5, "0"),
    lives: String(state.lives),
    remaining: String(state.remainingCollectibles).padStart(3, "0"),
    wallPass: powerSeconds(state.wallPassTicks),
    ghostEat: powerSeconds(state.ghostEatTicks),
    gaze,
    controls,
    sourceClassification,
    announcement: `${mode}. ${phase}. Score ${state.score}. ${state.lives} lives. ${state.remainingCollectibles} objects remain. ${gaze}. ${sourceClassification === "RECORDED IBM FEZ RETURN" ? "Recorded IBM Fez return; active play is offline." : "Local synthetic control; no provider request."}`,
  });
}

export function quantmanSyntheticActorScreenPosition(
  actor: Pick<ActorSnapshot, "row" | "col">,
): Readonly<{ x: number; y: number }> {
  return Object.freeze({
    x: Math.round(
      QUANTMAN_SYNTHETIC_VIEWPORT.boardLeft +
        (actor.col + 0.5) * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
    ),
    y: Math.round(
      QUANTMAN_SYNTHETIC_VIEWPORT.boardTop +
        (actor.row + 0.5) * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
    ),
  });
}

export function quantmanSyntheticWallSegments(
  wallMask: string,
): readonly QuantmanSyntheticWallSegment[] {
  return Object.freeze(
    GRAPH.edges.flatMap((edge) => {
      if (!GRAPH.isWall(wallMask, edge.index)) return [];
      const a = edge.aCoordinate;
      const b = edge.bCoordinate;
      if (a.row === b.row) {
        const x = Math.max(a.col, b.col);
        return [
          Object.freeze({
            edgeIndex: edge.index,
            x1:
              QUANTMAN_SYNTHETIC_VIEWPORT.boardLeft +
              x * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
            y1:
              QUANTMAN_SYNTHETIC_VIEWPORT.boardTop +
              a.row * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
            x2:
              QUANTMAN_SYNTHETIC_VIEWPORT.boardLeft +
              x * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
            y2:
              QUANTMAN_SYNTHETIC_VIEWPORT.boardTop +
              (a.row + 1) * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
          }),
        ];
      }
      const y = Math.max(a.row, b.row);
      return [
        Object.freeze({
          edgeIndex: edge.index,
          x1:
            QUANTMAN_SYNTHETIC_VIEWPORT.boardLeft +
            a.col * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
          y1:
            QUANTMAN_SYNTHETIC_VIEWPORT.boardTop +
            y * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
          x2:
            QUANTMAN_SYNTHETIC_VIEWPORT.boardLeft +
            (a.col + 1) * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
          y2:
            QUANTMAN_SYNTHETIC_VIEWPORT.boardTop +
            y * QUANTMAN_SYNTHETIC_VIEWPORT.cellSize,
        }),
      ];
    }),
  );
}

function drawTopology(
  g: Phaser.GameObjects.Graphics,
  state: SessionSnapshot,
): void {
  drawPerimeterWithTunnel(g);
  const changed = new Set(state.changedEdgeIndices);
  for (const segment of quantmanSyntheticWallSegments(state.topologyWallMask)) {
    if (edgeTouchesGhostHome(GRAPH, segment.edgeIndex)) continue;
    g.lineStyle(
      changed.has(segment.edgeIndex) ? 4 : 2,
      changed.has(segment.edgeIndex)
        ? BROWN_BOX_PALETTE.mutedTan
        : BROWN_BOX_PALETTE.cream,
      1,
    ).lineBetween(segment.x1, segment.y1, segment.x2, segment.y2);
  }
  drawGhostHome(g);
  if (state.mechanic === "stabilize-gaze") drawGazeCone(g, state);
  else if (state.gazeTargetEdgeIndex !== null) {
    const segment = quantmanSyntheticWallSegmentsForEdge(
      state.gazeTargetEdgeIndex,
    );
    drawTargetCorners(
      g,
      segment,
      state.gazeStatus === "applied"
        ? BROWN_BOX_PALETTE.cream
        : BROWN_BOX_PALETTE.mutedTan,
    );
  }
}

function drawCollectibles(
  g: Phaser.GameObjects.Graphics,
  state: SessionSnapshot,
): void {
  const collected = new Set(state.collectedRooms);
  state.collectibleKinds.forEach((kind, room) => {
    if (collected.has(room)) return;
    const position = roomPosition(room);
    if (kind === "pellet") {
      g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(
        position.x - 2,
        position.y - 2,
        4,
        4,
      );
    } else if (kind === "wall-pass") {
      g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(
        position.x - 7,
        position.y - 7,
        14,
        14,
      );
      g.fillStyle(BROWN_BOX_PALETTE.mutedTan, 1).fillRect(
        position.x - 2,
        position.y - 5,
        4,
        10,
      );
    } else {
      g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillCircle(
        position.x,
        position.y,
        7,
      );
      g.fillStyle(BROWN_BOX_PALETTE.ink, 1).fillRect(
        position.x - 2,
        position.y - 4,
        4,
        8,
      );
    }
  });
}

function drawActors(
  g: Phaser.GameObjects.Graphics,
  state: SessionSnapshot,
): void {
  for (const ghost of state.ghosts) {
    if (ghost.mode === "respawning") continue;
    const position = quantmanSyntheticActorScreenPosition(ghost);
    drawCanonicalSprite(
      g,
      "quantman-ghost-directional-strip",
      ghost.mode === "waiting" ? "neutral" : ghost.facing,
      {
        pixel: 2,
        centerX: position.x,
        bottomY: position.y + 16,
      },
    );
    drawGhostRole(g, position.x, position.y, ghost.role);
    if (ghost.mode === "frightened") {
      g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(
        position.x - 17,
        position.y - 17,
        34,
        34,
      );
    }
  }

  const player = quantmanSyntheticActorScreenPosition(state.player);
  drawCanonicalSprite(
    g,
    "quantman-player-directional-strip",
    state.player.facing,
    {
      pixel: 2,
      centerX: player.x,
      bottomY: player.y + 16,
    },
  );
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  hud: QuantmanSyntheticHudModel,
): void {
  drawPixelText(g, hud.mode, {
    x: 320,
    y: 12,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });

  drawSideValue(g, "SCORE", hud.score, 20, 54, "left");
  drawSideValue(g, "LIVES", hud.lives, 20, 112, "left");
  drawSideValue(g, "LEFT", hud.remaining, 20, 170, "left");
  drawSideValue(g, "PASS WALLS", hud.wallPass, 620, 54, "right");
  drawSideValue(g, "EAT GHOSTS", hud.ghostEat, 620, 112, "right");
  drawPixelText(g, hud.gaze, {
    x: 620,
    y: 176,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "right",
  });

  if (hud.phase !== "ACTIVE") {
    drawCenteredPixelPanel(g, hud.phase, {
      centerX: 320,
      y: 169,
      pixel: 3,
      border: true,
      paddingX: 10,
      paddingY: 7,
    });
  }
}

function drawSideValue(
  g: Phaser.GameObjects.Graphics,
  label: string,
  value: string,
  x: number,
  y: number,
  align: "left" | "right",
): void {
  drawPixelText(g, label, {
    x,
    y,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.mutedTan,
    align,
  });
  drawPixelText(g, value, {
    x,
    y: y + 17,
    pixel: 3,
    colour: BROWN_BOX_PALETTE.cream,
    align,
  });
}

function drawGazeCone(
  g: Phaser.GameObjects.Graphics,
  state: SessionSnapshot,
): void {
  const origin = quantmanSyntheticActorScreenPosition(state.player);
  const vector = directionVector(state.player.facing);
  const perpendicular = { x: -vector.y, y: vector.x };
  const startDistance = 13;
  const endDistance = QUANTMAN_SYNTHETIC_VIEWPORT.cellSize * 2;
  const nearHalfWidth = 4;
  const farHalfWidth = 14;
  const start = {
    x: origin.x + vector.x * startDistance,
    y: origin.y + vector.y * startDistance,
  };
  const end = {
    x: origin.x + vector.x * endDistance,
    y: origin.y + vector.y * endDistance,
  };
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1)
    .lineBetween(
      start.x + perpendicular.x * nearHalfWidth,
      start.y + perpendicular.y * nearHalfWidth,
      end.x + perpendicular.x * farHalfWidth,
      end.y + perpendicular.y * farHalfWidth,
    )
    .lineBetween(
      start.x - perpendicular.x * nearHalfWidth,
      start.y - perpendicular.y * nearHalfWidth,
      end.x - perpendicular.x * farHalfWidth,
      end.y - perpendicular.y * farHalfWidth,
    )
    .lineBetween(
      end.x + perpendicular.x * farHalfWidth,
      end.y + perpendicular.y * farHalfWidth,
      end.x - perpendicular.x * farHalfWidth,
      end.y - perpendicular.y * farHalfWidth,
    );
}

function drawTargetCorners(
  g: Phaser.GameObjects.Graphics,
  segment: QuantmanSyntheticWallSegment,
  colour: number,
): void {
  const x = Math.round((segment.x1 + segment.x2) / 2);
  const y = Math.round((segment.y1 + segment.y2) / 2);
  const radius = 10;
  const corner = 5;
  g.lineStyle(2, colour, 1)
    .lineBetween(x - radius, y - radius, x - radius + corner, y - radius)
    .lineBetween(x - radius, y - radius, x - radius, y - radius + corner)
    .lineBetween(x + radius, y - radius, x + radius - corner, y - radius)
    .lineBetween(x + radius, y - radius, x + radius, y - radius + corner)
    .lineBetween(x - radius, y + radius, x - radius + corner, y + radius)
    .lineBetween(x - radius, y + radius, x - radius, y + radius - corner)
    .lineBetween(x + radius, y + radius, x + radius - corner, y + radius)
    .lineBetween(x + radius, y + radius, x + radius, y + radius - corner);
}

function drawPerimeterWithTunnel(g: Phaser.GameObjects.Graphics): void {
  const {
    boardLeft: left,
    boardTop: top,
    boardSize: size,
    cellSize,
  } = QUANTMAN_SYNTHETIC_VIEWPORT;
  const right = left + size;
  const bottom = top + size;
  const tunnelTop = top + TUNNEL_ROW * cellSize;
  const tunnelBottom = tunnelTop + cellSize;
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1)
    .lineBetween(left, top, right, top)
    .lineBetween(left, bottom, right, bottom)
    .lineBetween(left, top, left, tunnelTop)
    .lineBetween(left, tunnelBottom, left, bottom)
    .lineBetween(right, top, right, tunnelTop)
    .lineBetween(right, tunnelBottom, right, bottom)
    .lineBetween(left - 14, tunnelTop, left, tunnelTop)
    .lineBetween(left - 14, tunnelBottom, left, tunnelBottom)
    .lineBetween(right, tunnelTop, right + 14, tunnelTop)
    .lineBetween(right, tunnelBottom, right + 14, tunnelBottom);
}

function drawGhostHome(g: Phaser.GameObjects.Graphics): void {
  const first = GHOST_HOME_ROOMS[0];
  const row = Math.floor(first / 10);
  const col = first % 10;
  const { boardLeft, boardTop, cellSize } = QUANTMAN_SYNTHETIC_VIEWPORT;
  const left = boardLeft + col * cellSize;
  const top = boardTop + row * cellSize;
  const size = cellSize * 2;
  const center = left + size / 2;
  const gateHalfWidth = 8;
  g.fillStyle(BROWN_BOX_PALETTE.ink, 1).fillRect(
    left + 2,
    top + 2,
    size - 4,
    size - 4,
  );
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1)
    .lineBetween(left, top, center - gateHalfWidth, top)
    .lineBetween(center + gateHalfWidth, top, left + size, top)
    .lineBetween(left, top, left, top + size)
    .lineBetween(left + size, top, left + size, top + size)
    .lineBetween(left, top + size, left + size, top + size);
  g.lineStyle(2, BROWN_BOX_PALETTE.mutedTan, 1).lineBetween(
    center - gateHalfWidth,
    top,
    center + gateHalfWidth,
    top,
  );
}

function drawGhostRole(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  role: GhostRole,
): void {
  g.fillStyle(BROWN_BOX_PALETTE.ink, 1);
  if (role === "direct") g.fillRect(x - 2, y - 11, 4, 4);
  else if (role === "ambush") g.fillRect(x - 7, y - 11, 14, 3);
  else if (role === "flank") {
    g.fillRect(x - 7, y - 11, 4, 4);
    g.fillRect(x + 3, y - 11, 4, 4);
  } else {
    g.fillRect(x - 2, y - 14, 4, 12);
    g.fillRect(x - 7, y - 9, 14, 4);
  }
}

function quantmanSyntheticWallSegmentsForEdge(
  edgeIndex: number,
): QuantmanSyntheticWallSegment {
  const edge = GRAPH.edges[edgeIndex];
  if (!edge) throw new Error(`Unknown Quantman edge ${edgeIndex}.`);
  const mask = Array.from({ length: GRAPH.edges.length }, (_, index) =>
    index === edgeIndex ? "1" : "0",
  ).join("");
  const segment = quantmanSyntheticWallSegments(mask)[0];
  if (!segment) throw new Error(`Unable to map Quantman edge ${edgeIndex}.`);
  return segment;
}

function roomPosition(room: number): Readonly<{ x: number; y: number }> {
  return quantmanSyntheticActorScreenPosition({
    row: Math.floor(room / 10),
    col: room % 10,
  });
}

function directionVector(
  direction: DirectionName,
): Readonly<{ x: -1 | 0 | 1; y: -1 | 0 | 1 }> {
  return {
    up: Object.freeze({ x: 0, y: -1 }),
    right: Object.freeze({ x: 1, y: 0 }),
    down: Object.freeze({ x: 0, y: 1 }),
    left: Object.freeze({ x: -1, y: 0 }),
  }[direction];
}

function gazeLabel(state: SessionSnapshot): string {
  if (state.mechanic === "stabilize-gaze") {
    return `HELD ${state.observedEdgeIndices.length}`;
  }
  if (state.gazeStatus === "perimeter") return "EDGE NONE";
  if (state.gazeStatus === "deferred") return "EDGE HELD";
  if (state.gazeStatus === "applied") return "EDGE FLIPPED";
  const percent = Math.round(
    (state.gazeDwellTicks / TUNING.topologyPeriodTicks) * 100,
  );
  return `EDGE ${percent}%`;
}

function powerSeconds(ticks: number): string {
  return ticks > 0 ? `${(ticks / TUNING.simulationHz).toFixed(1)}S` : "--";
}
