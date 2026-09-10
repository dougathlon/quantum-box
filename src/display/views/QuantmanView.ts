import Phaser from "phaser";
import type {
  QuantmanPackPayload,
  QuantmanPursuerRole,
  QuantmanPursuerMode,
  QuantmanSnapshot,
  QuantmanTone,
} from "../../games/quantman/types";
import { quantmanHudModel } from "../../games/quantman/presentation";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import { drawCenteredPixelPanel } from "../PixelHud";
import { drawPixelText } from "../PixelText";
import { drawCanonicalSprite } from "../CanonicalSpriteRaster";
import { quantmanDisplayView } from "./CabinetDisplayViews";

export function renderQuantman(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: QuantmanSnapshot,
  payload: QuantmanPackPayload,
  paused: boolean,
): void {
  const view = quantmanDisplayView(snapshot, paused);
  const state = view.snapshot;
  const g = graphics.clear();

  drawMaze(g, payload, state.currentRows);
  drawTopologyDoors(g, payload, state);

  for (const fragment of payload.fragments) {
    if (view.collectedFragmentIds.includes(fragment.fragmentId)) continue;
    const x = payload.originX + (fragment.col + 0.5) * payload.tileSize;
    const y = payload.originY + (fragment.row + 0.5) * payload.tileSize;
    if (fragment.kind === "power") {
      if (Math.floor(state.tick / 12) % 2 === 0) {
        g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillCircle(x, y, 5);
      }
    } else {
      g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(x - 1, y - 1, 3, 3);
    }
  }

  for (const pursuer of state.pursuers) {
    if (pursuer.respawnTicks > 0) continue;
    drawPursuer(
      g,
      pursuer.x,
      pursuer.y,
      pursuer.tone,
      pursuer.role,
      pursuer.mode,
    );
  }
  drawPlayer(
    g,
    state.player.x,
    state.player.y,
    state.player.facingX,
    state.player.facingY,
    state.invulnerableTicks,
  );

  if (view.paused) {
    drawPause(g);
    return;
  }
  drawHud(g, state);
}

function drawMaze(
  g: Phaser.GameObjects.Graphics,
  payload: QuantmanPackPayload,
  rows: readonly string[],
): void {
  const size = payload.tileSize;
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
  for (let row = 0; row < payload.height; row += 1) {
    for (let col = 0; col < payload.width; col += 1) {
      if (rows[row]?.[col] !== ".") continue;
      const x = payload.originX + col * size;
      const y = payload.originY + row * size;
      if (rows[row - 1]?.[col] !== ".") {
        g.lineBetween(x, y, x + size, y);
      }
      if (rows[row + 1]?.[col] !== ".") {
        g.lineBetween(x, y + size, x + size, y + size);
      }
      if (rows[row]?.[col - 1] !== ".") {
        g.lineBetween(x, y, x, y + size);
      }
      if (rows[row]?.[col + 1] !== ".") {
        g.lineBetween(x + size, y, x + size, y + size);
      }
    }
  }
}

function drawTopologyDoors(
  g: Phaser.GameObjects.Graphics,
  payload: QuantmanPackPayload,
  snapshot: QuantmanSnapshot,
): void {
  const open = new Set(snapshot.openDoorIds);
  const observed = new Set(snapshot.observedDoorIds);
  for (const door of payload.topologyDoors) {
    const x = payload.originX + (door.col + 0.5) * payload.tileSize;
    const y = payload.originY + (door.row + 0.5) * payload.tileSize;
    if (open.has(door.doorId)) {
      g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(x - 2, y - 2, 4, 4);
    }
    if (observed.has(door.doorId)) {
      g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(
        x - 7,
        y - 7,
        14,
        14,
      );
    }
    if (door.doorId === snapshot.focusedDoorId) {
      g.fillStyle(BROWN_BOX_PALETTE.mutedTan, 1).fillRect(x - 2, y - 2, 4, 4);
    }
  }
}

function drawPlayer(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  facingX: -1 | 0 | 1,
  facingY: -1 | 0 | 1,
  invulnerableTicks: number,
): void {
  if (invulnerableTicks > 0 && Math.floor(invulnerableTicks / 5) % 2 === 0) {
    return;
  }
  const frameId =
    facingX < 0 ? "left" : facingY < 0 ? "up" : facingY > 0 ? "down" : "right";
  drawCanonicalSprite(g, "quantman-player-directional-strip", frameId, {
    pixel: 1,
    centerX: x,
    bottomY: y + 8,
  });
}

function drawPursuer(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  tone: QuantmanTone,
  role: QuantmanPursuerRole,
  mode: QuantmanPursuerMode,
): void {
  const frameId =
    mode === "investigate"
      ? "down"
      : mode === "hesitate"
        ? "up"
        : tone === "orange"
          ? "right"
          : "left";
  drawCanonicalSprite(g, "quantman-ghost-directional-strip", frameId, {
    pixel: 1,
    centerX: x,
    bottomY: y + 8,
  });
  if (mode === "frightened") {
    g.lineStyle(2, BROWN_BOX_PALETTE.mutedTan, 1).strokeRect(
      x - 8,
      y - 8,
      16,
      16,
    );
    return;
  }
  drawPursuerMark(g, x, y, role);
  g.fillStyle(BROWN_BOX_PALETTE.mutedTan, 1).fillRect(
    x + (tone === "orange" ? -2 : 1),
    y + 2,
    2,
    2,
  );
  if (mode === "chase") {
    g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeCircle(x, y, 14);
  } else if (mode === "investigate") {
    g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
    g.lineBetween(x - 11, y - 12, x - 3, y - 12);
    g.lineBetween(x + 3, y - 12, x + 11, y - 12);
  } else if (mode === "hesitate") {
    g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(x - 9, y - 15, 3, 3);
    g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(x - 1, y - 15, 3, 3);
    g.fillStyle(BROWN_BOX_PALETTE.mutedTan, 1).fillRect(x + 7, y - 15, 3, 3);
  }
}

function drawPursuerMark(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  role: QuantmanPursuerRole,
): void {
  g.fillStyle(BROWN_BOX_PALETTE.ink, 1);
  if (role === "direct") {
    g.fillRect(x - 1, y - 6, 3, 3);
  } else if (role === "ambush") {
    g.fillRect(x - 5, y - 6, 10, 2);
  } else if (role === "flank") {
    g.fillRect(x - 5, y - 6, 3, 3);
    g.fillRect(x + 2, y - 6, 3, 3);
  } else {
    g.fillRect(x - 1, y - 8, 3, 7);
    g.fillRect(x - 4, y - 5, 9, 3);
  }
}

function drawPause(g: Phaser.GameObjects.Graphics): void {
  drawCenteredPixelPanel(g, "PAUSED", {
    centerX: 320,
    y: 7,
    pixel: 4,
    border: true,
  });
}

function drawHud(
  g: Phaser.GameObjects.Graphics,
  snapshot: QuantmanSnapshot,
): void {
  const hud = quantmanHudModel(snapshot, false);
  if (snapshot.started && snapshot.phase !== "active") {
    drawCenteredPixelPanel(g, hud.notice, {
      centerX: 320,
      y: 7,
      pixel: 4,
      border: true,
    });
    return;
  }
  // Keep the telemetry inside the display's safe area. The physical screen
  // mask trims the first few native rows at wide responsive scales.
  g.lineStyle(1, BROWN_BOX_PALETTE.cream, 1).lineBetween(8, 33, 632, 33);
  drawPixelText(g, `DOT ${hud.fragments}`, {
    x: 18,
    y: 10,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
  });
  drawPixelText(g, hud.lives, {
    x: 18,
    y: 22,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
  });
  drawPixelText(g, hud.state, {
    x: 320,
    y: 10,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, hud.focus, {
    x: 320,
    y: 22,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, `TIME ${hud.time}`, {
    x: 622,
    y: 10,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "right",
  });
  if (!snapshot.started) {
    drawCenteredPixelPanel(g, "READY", {
      centerX: 320,
      y: 174,
      pixel: 2,
    });
  } else if (
    snapshot.frightenedTicks > 0 ||
    snapshot.latestEvent?.type === "PLAYER_CAUGHT"
  ) {
    drawCenteredPixelPanel(g, hud.notice, {
      centerX: 320,
      y: 174,
      pixel: 2,
    });
  }
}
