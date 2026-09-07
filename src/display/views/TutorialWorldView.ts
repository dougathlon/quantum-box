import type Phaser from "phaser";
import type {
  TileDirection,
  TilePosition,
  TutorialWorldDefinition,
  TutorialWorldId,
} from "../../tutorials/contracts";
import type { AnyTutorialRuntimeSnapshot } from "../../tutorials/registry";
import { BROWN_BOX_PALETTE } from "../BrownBoxTheme";
import {
  CANONICAL_SPRITE_PIXEL_SCALE,
  drawCanonicalSprite,
} from "../CanonicalSpriteRaster";
import {
  drawPixelText,
  normalizePixelText,
  pixelTextWidth,
} from "../PixelText";

export const TUTORIAL_WORLD_LAYOUT = Object.freeze({
  originX: 100,
  originY: 0,
  tileSize: 40,
  columns: 11,
  rows: 9,
});

/**
 * The tutorial renderer still draws on the legacy 640x360 cabinet plane, which
 * the shared display scales by one half. Two legacy pixels therefore produce
 * one exact native framebuffer pixel; a one-pixel glyph would be sampled at a
 * half-pixel and become illegible.
 */
export const TUTORIAL_WORLD_TEXT_PIXEL = 2;

export type TutorialZoneProgress = "idle" | "visited" | "selected" | "resolved";

/**
 * The 640x360 graphics plane maps exactly onto the native 320x180 display.
 * Each 40-unit tile is therefore a 20x20 logical-pixel cell: the same footprint
 * as the canonical Designer and morph frames.
 */
export function renderTutorialWorld(
  graphics: Phaser.GameObjects.Graphics,
  snapshot: AnyTutorialRuntimeSnapshot,
): void {
  const definition = snapshot.definition;
  assertRenderableTutorialWorld(definition, snapshot);

  const g = graphics.clear();
  drawWorldMotif(g, snapshot.world.worldId);
  drawCollisionRoom(g, definition);
  drawInteractionZones(g, definition, snapshot);
  drawDesigner(g, definition, snapshot);
  drawPlayer(g, snapshot);
  drawPhaseRail(g, snapshot);
  drawTutorialOverlay(g, snapshot);
}

export function tutorialOverlayLines(
  source: string,
  maxWidth = 400,
  pixel = 1,
): readonly string[] {
  const words = normalizePixelText(source).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (pixelTextWidth(candidate, pixel) <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line.length > 0) lines.push(line);
    line = word;
  }
  if (line.length > 0) lines.push(line);
  return Object.freeze(lines);
}

export function tutorialMorphFrame(step: number): 0 | 2 | 4 | 6 {
  if (!Number.isSafeInteger(step) || step < 0 || step > 3) {
    throw new Error(`Tutorial morph step is outside 0..3: ${step}`);
  }
  return [0, 2, 4, 6][step] as 0 | 2 | 4 | 6;
}

export function tutorialAuthorityLabel(
  snapshot: AnyTutorialRuntimeSnapshot,
): string {
  switch (snapshot.evidence.authority) {
    case "validated-story-run":
      return "STORY EVIDENCE";
    case "saved-recovery-replay":
      return "REPLAY / NO STORY PROGRESS";
    case "development-fixture":
      return "FIXTURE / NO STORY PROGRESS";
    case "unavailable":
      return "EVIDENCE UNAVAILABLE";
  }
}

export function shouldDrawTutorialFeedback(
  snapshot: AnyTutorialRuntimeSnapshot,
): boolean {
  if (snapshot.world.dialogue !== null) return true;
  if (snapshot.world.feedback === null) return false;

  const isInitialNonAuthoritativeFixture =
    snapshot.world.phase === "approach" &&
    (snapshot.evidence.authority === "development-fixture" ||
      snapshot.evidence.authority === "saved-recovery-replay");
  return !isInitialNonAuthoritativeFixture;
}

export function tutorialTileCenter(tile: TilePosition): Readonly<{
  x: number;
  y: number;
  bottomY: number;
}> {
  const { originX, originY, tileSize } = TUTORIAL_WORLD_LAYOUT;
  return Object.freeze({
    x: originX + tile.col * tileSize + tileSize / 2,
    y: originY + tile.row * tileSize + tileSize / 2,
    bottomY: originY + (tile.row + 1) * tileSize - 2,
  });
}

export function tutorialZoneProgress(
  snapshot: AnyTutorialRuntimeSnapshot,
  zoneId: string,
): TutorialZoneProgress {
  switch (snapshot.gameId) {
    case "qong": {
      const mechanism = snapshot.world.mechanism;
      if (zoneId === "coin-result" && mechanism.inspectedResult) {
        return "visited";
      }
      if (zoneId === "selection" && mechanism.inspectedSelection) {
        return "visited";
      }
      if (
        (zoneId === "direct" || zoneId === "invert") &&
        mechanism.selectedRule === zoneId
      ) {
        return mechanism.mappingCorrect ? "resolved" : "selected";
      }
      break;
    }
    case "skipixl": {
      const mechanism = snapshot.world.mechanism;
      const gridIndex = suffixIndex(zoneId, "grid-");
      const obstacleIndex = suffixIndex(zoneId, "obstacle-");
      if (gridIndex !== null) {
        if (mechanism.linkedGridIndexes.includes(gridIndex)) return "resolved";
        if (mechanism.selectedGridIndex === gridIndex) return "selected";
        if (mechanism.inspectedGridIndexes.includes(gridIndex))
          return "visited";
      }
      if (obstacleIndex !== null) {
        if (mechanism.linkedGridIndexes.includes(obstacleIndex)) {
          return "resolved";
        }
        if (mechanism.selectedGridIndex === obstacleIndex) return "selected";
      }
      break;
    }
    case "fluxball": {
      const mechanism = snapshot.world.mechanism;
      const relationshipIndex = suffixIndex(zoneId, "relationship-");
      const playerIndex = suffixIndex(zoneId, "player-");
      if (relationshipIndex !== null) {
        if (mechanism.resolvedRelationshipIndexes.includes(relationshipIndex)) {
          return "resolved";
        }
        if (
          mechanism.inspectedRelationshipIndexes.includes(relationshipIndex)
        ) {
          return "visited";
        }
      }
      if (
        playerIndex !== null &&
        mechanism.selectedPlayerId === ["A", "B", "C", "D"][playerIndex]
      ) {
        return "selected";
      }
      break;
    }
    case "quantman": {
      const mechanism = snapshot.world.mechanism;
      const doorIndex = suffixIndex(zoneId, "door-");
      if (doorIndex !== null) {
        if (mechanism.heldDoorIndex === doorIndex) return "selected";
        if (mechanism.inspectedDoorIndexes.includes(doorIndex))
          return "visited";
      }
      if (zoneId === "observation-console" && mechanism.observation) {
        return "resolved";
      }
      if (zoneId === "changed-route" && mechanism.changedRouteInspected) {
        return "resolved";
      }
      break;
    }
  }
  return snapshot.world.visitedZoneIds.includes(zoneId) ? "visited" : "idle";
}

function assertRenderableTutorialWorld(
  definition: TutorialWorldDefinition,
  snapshot: AnyTutorialRuntimeSnapshot,
): void {
  if (
    definition.worldId !== snapshot.worldId ||
    definition.worldId !== snapshot.world.worldId
  ) {
    throw new Error("Tutorial definition and snapshot world IDs diverged.");
  }
  if (
    definition.collisionRows.length !== TUTORIAL_WORLD_LAYOUT.rows ||
    definition.collisionRows.some(
      (row) => row.length !== TUTORIAL_WORLD_LAYOUT.columns,
    )
  ) {
    throw new Error(
      `${definition.worldId} must use the canonical 11x9 tutorial room.`,
    );
  }
}

function drawCollisionRoom(
  g: Phaser.GameObjects.Graphics,
  definition: TutorialWorldDefinition,
): void {
  const { originX, originY, tileSize } = TUTORIAL_WORLD_LAYOUT;
  for (let row = 0; row < definition.collisionRows.length; row += 1) {
    for (let col = 0; col < definition.collisionRows[row]!.length; col += 1) {
      const x = originX + col * tileSize;
      const y = originY + row * tileSize;
      const wall = definition.collisionRows[row]![col] === "#";
      if (!wall) continue;

      g.fillStyle(BROWN_BOX_PALETTE.tobacco, 1).fillRect(
        x,
        y,
        tileSize,
        tileSize,
      );

      g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
      if (definition.collisionRows[row - 1]?.[col] === ".") {
        g.lineBetween(x, y, x + tileSize, y);
      }
      if (definition.collisionRows[row + 1]?.[col] === ".") {
        g.lineBetween(x, y + tileSize, x + tileSize, y + tileSize);
      }
      if (definition.collisionRows[row]?.[col - 1] === ".") {
        g.lineBetween(x, y, x, y + tileSize);
      }
      if (definition.collisionRows[row]?.[col + 1] === ".") {
        g.lineBetween(x + tileSize, y, x + tileSize, y + tileSize);
      }
    }
  }
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1);
  g.lineBetween(originX, 0, originX, 360);
  g.lineBetween(originX + 440, 0, originX + 440, 360);
}

function drawInteractionZones(
  g: Phaser.GameObjects.Graphics,
  definition: TutorialWorldDefinition,
  snapshot: AnyTutorialRuntimeSnapshot,
): void {
  for (const zone of definition.interactionZones) {
    for (const tile of zone.tiles) {
      const center = tutorialTileCenter(tile);
      const progress = tutorialZoneProgress(snapshot, zone.zoneId);
      const active = snapshot.world.activeZoneId === zone.zoneId;
      const glyph = tutorialZoneGlyph(snapshot.world.worldId, zone.zoneId);
      const selected = progress === "selected";

      drawZoneCorners(
        g,
        center.x,
        center.y,
        active ? 18 : 16,
        BROWN_BOX_PALETTE.cream,
      );
      if (progress === "visited" || progress === "resolved") {
        g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(
          center.x - 10,
          center.y + 8,
          20,
          4,
        );
      }
      if (progress === "resolved") {
        g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(
          center.x - 12,
          center.y - 12,
          24,
          24,
        );
      }
      if (glyph) {
        drawPixelText(g, glyph, {
          x: center.x,
          y: center.y - 6,
          pixel: 2,
          colour: BROWN_BOX_PALETTE.cream,
          align: "center",
        });
      }
    }
  }
}

function drawDesigner(
  g: Phaser.GameObjects.Graphics,
  definition: TutorialWorldDefinition,
  snapshot: AnyTutorialRuntimeSnapshot,
): void {
  const designerZone = definition.interactionZones.find(
    (zone) => zone.zoneId === definition.designer.approachZoneId,
  );
  const tile = designerZone?.tiles[0];
  if (!tile) return;
  const center = tutorialTileCenter(tile);
  const morphAsset = snapshot.morphAssetId;

  if (
    snapshot.world.phase === "true-morph" &&
    morphAsset &&
    snapshot.world.designer.morph
  ) {
    const frame = tutorialMorphFrame(snapshot.world.designer.morph.step);
    drawCanonicalSprite(g, morphAsset, `morph-${frame}`, {
      pixel: CANONICAL_SPRITE_PIXEL_SCALE,
      centerX: center.x,
      bottomY: center.bottomY,
    });
    return;
  }
  if (snapshot.world.phase === "approach" && morphAsset) {
    drawCanonicalSprite(g, morphAsset, "morph-0", {
      pixel: CANONICAL_SPRITE_PIXEL_SCALE,
      centerX: center.x,
      bottomY: center.bottomY,
    });
    return;
  }

  drawCanonicalSprite(
    g,
    "designer-wizard-action-strip",
    designerFrame(snapshot),
    {
      pixel: CANONICAL_SPRITE_PIXEL_SCALE,
      centerX: center.x,
      bottomY: center.bottomY,
    },
  );
}

function designerFrame(snapshot: AnyTutorialRuntimeSnapshot): string {
  switch (snapshot.world.phase) {
    case "dialogue":
      return (snapshot.world.dialogue?.lineNumber ?? 1) % 2 === 0
        ? "talk-b"
        : "talk-a";
    case "spatial-exploration":
      return "point-right";
    case "mechanism-interaction":
      return "gesture-open";
    case "demonstrated-understanding":
    case "completion":
      return "gesture-raised";
    case "approach":
    case "true-morph":
      return "idle";
  }
}

function drawPlayer(
  g: Phaser.GameObjects.Graphics,
  snapshot: AnyTutorialRuntimeSnapshot,
): void {
  const center = tutorialTileCenter(snapshot.world.player.tile);
  drawCanonicalSprite(
    g,
    "player-c-four-direction-walk-strip",
    playerFrame(
      snapshot.world.player.facing,
      snapshot.world.player.tile,
      snapshot.world.player.lastMoveBlocked,
    ),
    {
      pixel: CANONICAL_SPRITE_PIXEL_SCALE,
      centerX: center.x,
      bottomY: center.bottomY,
    },
  );
  if (snapshot.world.player.lastMoveBlocked) {
    drawBlockedMove(g, center.x, center.y, snapshot.world.player.facing);
  }
}

function playerFrame(
  facing: TileDirection,
  tile: TilePosition,
  blocked: boolean,
): string {
  const posture = !blocked && (tile.row + tile.col) % 2 === 1 ? "walk" : "idle";
  switch (facing) {
    case "up":
      return `back-${posture}`;
    case "down":
      return `front-${posture}`;
    case "left":
      return `left-${posture}`;
    case "right":
      return `right-${posture}`;
  }
}

function drawBlockedMove(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  facing: TileDirection,
): void {
  const offsets: Readonly<Record<TileDirection, readonly [number, number]>> = {
    up: [0, -18],
    down: [0, 18],
    left: [-18, 0],
    right: [18, 0],
  };
  const [offsetX, offsetY] = offsets[facing];
  g.fillStyle(BROWN_BOX_PALETTE.cream, 1).fillRect(
    x + offsetX - (offsetX === 0 ? 8 : 2),
    y + offsetY - (offsetY === 0 ? 8 : 2),
    offsetX === 0 ? 16 : 4,
    offsetY === 0 ? 16 : 4,
  );
}

function drawZoneCorners(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  radius: number,
  colour: number,
): void {
  g.fillStyle(colour, 1);
  const near = radius - 6;
  g.fillRect(x - radius, y - radius, 8, 2);
  g.fillRect(x - radius, y - radius, 2, 8);
  g.fillRect(x + near, y - radius, 8, 2);
  g.fillRect(x + radius - 2, y - radius, 2, 8);
  g.fillRect(x - radius, y + radius - 2, 8, 2);
  g.fillRect(x - radius, y + near, 2, 8);
  g.fillRect(x + near, y + radius - 2, 8, 2);
  g.fillRect(x + radius - 2, y + near, 2, 8);
}

function drawPhaseRail(
  g: Phaser.GameObjects.Graphics,
  snapshot: AnyTutorialRuntimeSnapshot,
): void {
  const phases = [
    "approach",
    "true-morph",
    "dialogue",
    "spatial-exploration",
    "mechanism-interaction",
    "demonstrated-understanding",
    "completion",
  ] as const;
  const current = phases.indexOf(snapshot.world.phase);
  for (let index = 0; index < phases.length; index += 1) {
    g.fillStyle(
      index <= current ? BROWN_BOX_PALETTE.cream : BROWN_BOX_PALETTE.tobacco,
      1,
    ).fillRect(574, 102 + index * 22, 34, 6);
  }
}

function drawTutorialOverlay(
  g: Phaser.GameObjects.Graphics,
  snapshot: AnyTutorialRuntimeSnapshot,
): void {
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(106, 6, 428, 34);
  drawPixelText(g, snapshot.title, {
    x: 320,
    y: 11,
    pixel: 2,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });
  drawPixelText(g, tutorialAuthorityLabel(snapshot), {
    x: 320,
    y: 27,
    pixel: TUTORIAL_WORLD_TEXT_PIXEL,
    colour: BROWN_BOX_PALETTE.cream,
    align: "center",
  });

  const dialogue = snapshot.world.dialogue;
  const source = dialogue?.line ?? snapshot.world.feedback;
  if (!source || !shouldDrawTutorialFeedback(snapshot)) return;
  const dialogueMode = dialogue !== null;
  const top = dialogueMode ? 218 : 296;
  const height = dialogueMode ? 90 : 20;
  g.lineStyle(2, BROWN_BOX_PALETTE.cream, 1).strokeRect(106, top, 428, height);
  if (dialogue) {
    drawPixelText(g, "THE DESIGNER", {
      x: 118,
      y: top + 10,
      pixel: 2,
      colour: BROWN_BOX_PALETTE.cream,
    });
    drawPixelText(g, `${dialogue.lineNumber}/${dialogue.lineCount}`, {
      x: 522,
      y: top + 10,
      pixel: TUTORIAL_WORLD_TEXT_PIXEL,
      colour: BROWN_BOX_PALETTE.cream,
      align: "right",
    });
  }
  const lines = tutorialOverlayLines(
    source,
    400,
    TUTORIAL_WORLD_TEXT_PIXEL,
  ).slice(0, dialogueMode ? 4 : 1);
  lines.forEach((line, index) => {
    drawPixelText(g, line, {
      x: 118,
      y: top + (dialogueMode ? 33 : 8) + index * TUTORIAL_WORLD_TEXT_PIXEL * 6,
      pixel: TUTORIAL_WORLD_TEXT_PIXEL,
      colour: BROWN_BOX_PALETTE.cream,
    });
  });
}

function drawWorldMotif(
  g: Phaser.GameObjects.Graphics,
  worldId: TutorialWorldId,
): void {
  g.lineStyle(2, BROWN_BOX_PALETTE.tobacco, 1);
  switch (worldId) {
    case "qong-workshop":
      g.strokeRect(28, 112, 8, 80);
      g.strokeRect(604, 112, 8, 80);
      g.lineBetween(68, 84, 68, 276);
      for (let y = 92; y < 276; y += 20) g.lineBetween(68, y, 68, y + 10);
      return;
    case "skipixl-lodge":
      g.lineBetween(18, 286, 72, 74);
      g.lineBetween(48, 286, 86, 136);
      g.lineBetween(554, 136, 592, 286);
      g.lineBetween(568, 74, 622, 286);
      return;
    case "fluxball-clubhouse":
      g.strokeCircle(56, 180, 34);
      g.lineBetween(22, 180, 90, 180);
      g.strokeCircle(584, 180, 34);
      g.lineBetween(550, 180, 618, 180);
      return;
    case "quantman-topology-room":
      for (let index = 0; index < 4; index += 1) {
        g.strokeRect(
          20 + (index % 2) * 34,
          136 + Math.floor(index / 2) * 34,
          24,
          24,
        );
      }
      for (let index = 0; index < 4; index += 1) {
        g.strokeRect(
          556 + (index % 2) * 34,
          136 + Math.floor(index / 2) * 34,
          24,
          24,
        );
      }
      return;
  }
}

function tutorialZoneGlyph(worldId: TutorialWorldId, zoneId: string): string {
  if (zoneId === "designer") return "";
  switch (worldId) {
    case "qong-workshop":
      return (
        (
          {
            "coin-result": "C",
            selection: "S",
            direct: "D",
            invert: "I",
          } as const
        )[zoneId as "coin-result" | "selection" | "direct" | "invert"] ?? ""
      );
    case "skipixl-lodge": {
      const grid = suffixIndex(zoneId, "grid-");
      if (grid !== null) return `G${grid + 1}`;
      const obstacle = suffixIndex(zoneId, "obstacle-");
      return obstacle === null ? "" : `O${obstacle + 1}`;
    }
    case "fluxball-clubhouse": {
      const relationship = suffixIndex(zoneId, "relationship-");
      if (relationship !== null) return ["X", "Y", "Z"][relationship] ?? "";
      const player = suffixIndex(zoneId, "player-");
      return player === null ? "" : (["A", "B", "C", "D"][player] ?? "");
    }
    case "quantman-topology-room": {
      const door = suffixIndex(zoneId, "door-");
      if (door !== null) return `D${door + 1}`;
      if (zoneId === "observation-console") return "O";
      if (zoneId === "changed-route") return "R";
      return "";
    }
  }
}

function suffixIndex(zoneId: string, prefix: string): number | null {
  if (!zoneId.startsWith(prefix)) return null;
  const index = Number(zoneId.slice(prefix.length));
  return Number.isSafeInteger(index) && index >= 0 ? index : null;
}
