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
import { drawCabinetPauseHeader, drawCabinetStatusHeader } from "../PixelHud";
import { drawPixelText } from "../PixelText";
import {
  drawNativePixelFilledEllipse,
  drawNativePixelLine,
  drawNativePixelRect,
} from "../NativePixelRaster";

export const QUANTMAN_SYNTHETIC_VIEWPORT = Object.freeze({
  width: 320,
  height: 180,
  boardLeft: 90,
  boardTop: 20,
  cellSize: 14,
  boardSize: 140,
});

export interface QuantmanSyntheticHudModel {
  readonly mode: "HOLD" | "INVERT";
  readonly phase:
    | "READY"
    | "ACTIVE"
    | "PAUSED"
    | "SCREEN CLEARED"
    | "GAME OVER";
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

/** Native 320x180 renderer; simulation state remains resolution-independent. */
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
  if (paused) {
    drawCabinetPauseHeader(g, QUANTMAN_SYNTHETIC_VIEWPORT.boardTop);
    return;
  }
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
          : "GAME OVER";
  const mode = state.mechanic === "stabilize-gaze" ? "HOLD" : "INVERT";
  const controls =
    state.phase === "won" || state.phase === "lost"
      ? "RETRY · X / X   CONTINUE · SPACE / A"
      : paused
        ? "RESUME · P / START   RETRY · X / X"
        : state.phase === "ready"
          ? "MOVE · WASD / ARROWS   START · SPACE / A"
          : "MOVE · WASD / ARROWS   PAUSE · P / START";
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
    drawNativePixelLine(
      g,
      { x: segment.x1, y: segment.y1 },
      { x: segment.x2, y: segment.y2 },
      {
        colour: changed.has(segment.edgeIndex)
          ? BROWN_BOX_PALETTE.mutedTan
          : BROWN_BOX_PALETTE.cream,
        thickness: changed.has(segment.edgeIndex) ? 2 : 1,
      },
    );
  }
  drawGhostHome(g);
  drawGazeCone(g, state);
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
      drawNativePixelRect(
        g,
        position.x - 1,
        position.y - 1,
        2,
        2,
        BROWN_BOX_PALETTE.cream,
      );
    } else if (kind === "wall-pass") {
      drawFrame(
        g,
        position.x - 4,
        position.y - 4,
        8,
        8,
        BROWN_BOX_PALETTE.cream,
      );
      drawNativePixelRect(
        g,
        position.x - 1,
        position.y - 3,
        2,
        6,
        BROWN_BOX_PALETTE.mutedTan,
      );
    } else {
      drawNativePixelFilledEllipse(g, position, 4, 4, BROWN_BOX_PALETTE.cream);
      drawNativePixelRect(
        g,
        position.x - 1,
        position.y - 2,
        2,
        4,
        BROWN_BOX_PALETTE.ink,
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
        pixel: 1,
        centerX: position.x,
        bottomY: position.y + 8,
      },
    );
    drawGhostRole(g, position.x, position.y, ghost.role);
    if (ghost.mode === "frightened") {
      drawFrame(
        g,
        position.x - 9,
        position.y - 9,
        18,
        18,
        BROWN_BOX_PALETTE.cream,
      );
    }
  }

  const player = quantmanSyntheticActorScreenPosition(state.player);
  drawCanonicalSprite(
    g,
    "quantman-player-directional-strip",
    state.player.facing,
    {
      pixel: 1,
      centerX: player.x,
      bottomY: player.y + 8,
    },
  );
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  hud: QuantmanSyntheticHudModel,
): void {
  if (hud.phase !== "ACTIVE")
    drawCabinetStatusHeader(g, hud.phase, QUANTMAN_SYNTHETIC_VIEWPORT.boardTop);
  else {
    drawPixelText(g, "QUANTMAN", {
      x: 160,
      y: 4,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    });
    drawPixelText(g, hud.mode, {
      x: 160,
      y: 11,
      pixel: 1,
      colour: BROWN_BOX_PALETTE.cream,
      align: "center",
    });
  }

  drawSideValue(g, "SCORE", hud.score, 10, 27, "left");
  drawSideValue(g, "LIVES", hud.lives, 10, 56, "left");
  drawSideValue(g, "LEFT", hud.remaining, 10, 85, "left");
  drawSideValue(g, "PASS WALLS", hud.wallPass, 310, 27, "right");
  drawSideValue(g, "EAT GHOSTS", hud.ghostEat, 310, 56, "right");
  drawPixelText(g, hud.gaze, {
    x: 310,
    y: 88,
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align: "right",
  });
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
    pixel: 1,
    colour: BROWN_BOX_PALETTE.cream,
    align,
  });
  drawPixelText(g, value, {
    x,
    y: y + 9,
    pixel: 1,
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
  const startDistance = 7;
  const endDistance = QUANTMAN_SYNTHETIC_VIEWPORT.cellSize * 2;
  const nearHalfWidth = 2;
  const farHalfWidth = 7;
  const start = {
    x: origin.x + vector.x * startDistance,
    y: origin.y + vector.y * startDistance,
  };
  const end = {
    x: origin.x + vector.x * endDistance,
    y: origin.y + vector.y * endDistance,
  };
  drawNativePixelLine(
    g,
    nativePoint(
      start.x + perpendicular.x * nearHalfWidth,
      start.y + perpendicular.y * nearHalfWidth,
    ),
    nativePoint(
      end.x + perpendicular.x * farHalfWidth,
      end.y + perpendicular.y * farHalfWidth,
    ),
    { colour: BROWN_BOX_PALETTE.cream },
  );
  drawNativePixelLine(
    g,
    nativePoint(
      start.x - perpendicular.x * nearHalfWidth,
      start.y - perpendicular.y * nearHalfWidth,
    ),
    nativePoint(
      end.x - perpendicular.x * farHalfWidth,
      end.y - perpendicular.y * farHalfWidth,
    ),
    { colour: BROWN_BOX_PALETTE.cream },
  );
  drawNativePixelLine(
    g,
    nativePoint(
      end.x + perpendicular.x * farHalfWidth,
      end.y + perpendicular.y * farHalfWidth,
    ),
    nativePoint(
      end.x - perpendicular.x * farHalfWidth,
      end.y - perpendicular.y * farHalfWidth,
    ),
    { colour: BROWN_BOX_PALETTE.cream },
  );
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
  const colour = BROWN_BOX_PALETTE.cream;
  for (const [start, end] of [
    [
      { x: left, y: top },
      { x: right, y: top },
    ],
    [
      { x: left, y: bottom },
      { x: right, y: bottom },
    ],
    [
      { x: left, y: top },
      { x: left, y: tunnelTop },
    ],
    [
      { x: left, y: tunnelBottom },
      { x: left, y: bottom },
    ],
    [
      { x: right, y: top },
      { x: right, y: tunnelTop },
    ],
    [
      { x: right, y: tunnelBottom },
      { x: right, y: bottom },
    ],
    [
      { x: left - 7, y: tunnelTop },
      { x: left, y: tunnelTop },
    ],
    [
      { x: left - 7, y: tunnelBottom },
      { x: left, y: tunnelBottom },
    ],
    [
      { x: right, y: tunnelTop },
      { x: right + 7, y: tunnelTop },
    ],
    [
      { x: right, y: tunnelBottom },
      { x: right + 7, y: tunnelBottom },
    ],
  ] as const)
    drawNativePixelLine(g, start, end, { colour });
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
  const gateHalfWidth = 4;
  drawNativePixelRect(
    g,
    left + 1,
    top + 1,
    size - 2,
    size - 2,
    BROWN_BOX_PALETTE.ink,
  );
  const cream = BROWN_BOX_PALETTE.cream;
  drawNativePixelLine(
    g,
    { x: left, y: top },
    { x: center - gateHalfWidth, y: top },
    { colour: cream },
  );
  drawNativePixelLine(
    g,
    { x: center + gateHalfWidth, y: top },
    { x: left + size, y: top },
    { colour: cream },
  );
  drawNativePixelLine(
    g,
    { x: left, y: top },
    { x: left, y: top + size },
    { colour: cream },
  );
  drawNativePixelLine(
    g,
    { x: left + size, y: top },
    { x: left + size, y: top + size },
    { colour: cream },
  );
  drawNativePixelLine(
    g,
    { x: left, y: top + size },
    { x: left + size, y: top + size },
    { colour: cream },
  );
  drawNativePixelLine(
    g,
    { x: center - gateHalfWidth, y: top },
    { x: center + gateHalfWidth, y: top },
    { colour: BROWN_BOX_PALETTE.mutedTan },
  );
}

function drawGhostRole(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  role: GhostRole,
): void {
  g.fillStyle(BROWN_BOX_PALETTE.ink, 1);
  if (role === "direct") g.fillRect(x - 1, y - 6, 2, 2);
  else if (role === "ambush") g.fillRect(x - 4, y - 6, 8, 2);
  else if (role === "flank") {
    g.fillRect(x - 4, y - 6, 2, 2);
    g.fillRect(x + 2, y - 6, 2, 2);
  } else {
    g.fillRect(x - 1, y - 7, 2, 6);
    g.fillRect(x - 4, y - 5, 8, 2);
  }
}

function nativePoint(x: number, y: number): Readonly<{ x: number; y: number }> {
  return Object.freeze({ x: Math.round(x), y: Math.round(y) });
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
